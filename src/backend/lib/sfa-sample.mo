import List "mo:core/List";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import Types "../types/sfa-sample";

/// Domain logic for Sample Allocation and Usage tracking.
/// Receives state by reference — no owned state.
module {

  // ── Helpers ───────────────────────────────────────────────────────────────

  public func allocationToInfo(a : Types.SampleAllocationRecord) : Types.SampleAllocationInfo {
    {
      id           = a.id;
      mrId         = a.mrId;
      productId    = a.productId;
      productName  = a.productName;
      month        = a.month;
      year         = a.year;
      allocatedQty = a.allocatedQty;
      usedQty      = a.usedQty;
      allocatedBy  = a.allocatedBy;
      allocatedAt  = a.allocatedAt;
      remarks      = a.remarks;
    };
  };

  // ── Sample Allocation ─────────────────────────────────────────────────────

  /// Allocate samples to an MR for a given product, month, and year.
  /// If an allocation already exists for (mrId, productId, month, year),
  /// the quantity is added to the existing allocation (upsert).
  /// Returns the allocationId.
  public func allocateSamples(
    allocations : List.List<Types.SampleAllocationRecord>,
    nextId      : { var val : Nat },
    adminId     : Types.UserId,
    input       : Types.SampleAllocationInput,
  ) : Nat {
    // Check for existing allocation for (mrId, productId, month, year)
    switch (allocations.find(func(a : Types.SampleAllocationRecord) : Bool {
      a.mrId == input.mrId and
      a.productId == input.productId and
      a.month == input.month and
      a.year == input.year
    })) {
      case (?existing) {
        // Update: add to existing allocation quantity
        existing.allocatedQty := existing.allocatedQty + input.allocatedQty;
        // Update remarks if provided
        if (input.remarks != "") { existing.remarks := input.remarks };
        existing.id
      };
      case null {
        // Create new allocation
        let id = nextId.val;
        nextId.val += 1;
        allocations.add({
          id;
          mrId              = input.mrId;
          productId         = input.productId;
          var productName   = input.productName;
          month             = input.month;
          year              = input.year;
          var allocatedQty  = input.allocatedQty;
          var usedQty       = (0 : Int);
          allocatedBy       = adminId;
          allocatedAt       = Time.now();
          var remarks       = input.remarks;
        });
        id
      };
    };
  };

  public func getSampleAllocation(
    allocations  : List.List<Types.SampleAllocationRecord>,
    allocationId : Nat,
  ) : ?Types.SampleAllocationRecord {
    allocations.find(func(a : Types.SampleAllocationRecord) : Bool { a.id == allocationId });
  };

  public func listSampleAllocationsForMR(
    allocations : List.List<Types.SampleAllocationRecord>,
    mrId        : Types.UserId,
    month       : Nat,
    year        : Nat,
  ) : [Types.SampleAllocationInfo] {
    allocations.filter(func(a : Types.SampleAllocationRecord) : Bool {
      a.mrId == mrId and a.month == month and a.year == year
    }).map<Types.SampleAllocationRecord, Types.SampleAllocationInfo>(allocationToInfo).toArray();
  };

  public func listAllSampleAllocations(
    allocations : List.List<Types.SampleAllocationRecord>,
    month       : Nat,
    year        : Nat,
  ) : [Types.SampleAllocationInfo] {
    allocations.filter(func(a : Types.SampleAllocationRecord) : Bool {
      a.month == month and a.year == year
    }).map<Types.SampleAllocationRecord, Types.SampleAllocationInfo>(allocationToInfo).toArray();
  };

  // ── Sample Usage ──────────────────────────────────────────────────────────

  /// Record sample usage for an MR from a call report.
  /// For each usage entry, finds the matching allocation and increments usedQty.
  /// Returns the list of created usage record IDs.
  public func recordSampleUsage(
    allocations  : List.List<Types.SampleAllocationRecord>,
    usages       : List.List<Types.SampleUsageRecord>,
    nextUsageId  : { var val : Nat },
    mrId         : Types.UserId,
    callReportId : Nat,
    inputs       : [Types.SampleUsageInput],
    now          : Types.Timestamp,
  ) : [Nat] {
    let createdIds = List.empty<Nat>();

    // Derive current month/year from now (nanoseconds)
    let secs     = now / 1_000_000_000;
    let days     = secs / 86_400;
    var year : Int = 1970;
    var remaining : Int = days;
    label yearLoop loop {
      let diy : Int = if (((year % 4 == 0) and (year % 100 != 0)) or (year % 400 == 0)) 366 else 365;
      if (remaining < diy) break yearLoop;
      remaining -= diy;
      year += 1;
    };
    let daysInMonths : [Int] = [
      31, if (((year % 4 == 0) and (year % 100 != 0)) or (year % 400 == 0)) 29 else 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    ];
    var month : Int = 1;
    label monthLoop loop {
      if (month > 12) break monthLoop;
      let dim = daysInMonths[month.toNat() - 1];
      if (remaining < dim) break monthLoop;
      remaining -= dim;
      month += 1;
    };
    let currentMonth = month.toNat();
    let currentYear  = year.toNat();

    for (input in inputs.values()) {
      // Deduct from allocation (find by mrId + productId + current month/year)
      switch (allocations.find(func(a : Types.SampleAllocationRecord) : Bool {
        a.mrId == mrId and
        a.productId == input.productId and
        a.month == currentMonth and
        a.year == currentYear
      })) {
        case (?alloc) { alloc.usedQty := alloc.usedQty + input.qtyUsed };
        case null {};  // No allocation found — still record usage for audit
      };

      let uid = nextUsageId.val;
      nextUsageId.val += 1;
      usages.add({
        id           = uid;
        mrId;
        callReportId;
        productId    = input.productId;
        productName  = input.productName;
        qtyUsed      = input.qtyUsed;
        usedAt       = now;
        doctorId     = input.doctorId;
        doctorName   = input.doctorName;
      });
      createdIds.add(uid);
    };

    createdIds.toArray();
  };

  // ── Balance View ──────────────────────────────────────────────────────────

  /// Compute sample balance for an MR for a given month/year.
  /// Returns one SampleBalanceView per allocation record.
  public func getSampleBalance(
    allocations : List.List<Types.SampleAllocationRecord>,
    mrId        : Types.UserId,
    month       : Nat,
    year        : Nat,
  ) : [Types.SampleBalanceView] {
    allocations.filter(func(a : Types.SampleAllocationRecord) : Bool {
      a.mrId == mrId and a.month == month and a.year == year
    })
    .map<Types.SampleAllocationRecord, Types.SampleBalanceView>(func(a) {
      {
        productId    = a.productId;
        productName  = a.productName;
        productCode  = "";   // productCode is on Product master; caller resolves if needed
        allocatedQty = a.allocatedQty;
        usedQty      = a.usedQty;
        remainingQty = a.allocatedQty - a.usedQty;
        month        = a.month;
        year         = a.year;
      }
    })
    .toArray();
  };

  /// Compute sample balances for a list of MR IDs.
  /// Returns pairs of (mrId, [SampleBalanceView]).
  public func getSampleBalanceForTeam(
    allocations : List.List<Types.SampleAllocationRecord>,
    mrIds       : [Types.UserId],
    month       : Nat,
    year        : Nat,
  ) : [(Nat, [Types.SampleBalanceView])] {
    mrIds.map<Types.UserId, (Nat, [Types.SampleBalanceView])>(func(mrId) {
      (mrId, getSampleBalance(allocations, mrId, month, year))
    });
  };

};
