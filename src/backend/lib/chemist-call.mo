import Types "../types/chemist-call";
import List  "mo:core/List";
import Map   "mo:core/Map";

module {
  public type ChemistCallRecord  = Types.ChemistCallRecord;
  public type ChemistCallInfo    = Types.ChemistCallInfo;
  public type ChemistCallInput   = Types.ChemistCallInput;
  public type StockistCallRecord = Types.StockistCallRecord;
  public type StockistCallInfo   = Types.StockistCallInfo;
  public type StockistCallInput  = Types.StockistCallInput;
  public type CoverageRow        = Types.CoverageRow;
  public type UserId             = Types.UserId;

  // ── Conversion helpers ────────────────────────────────────────────────────

  public func chemistToInfo(r : ChemistCallRecord) : ChemistCallInfo {
    {
      id               = r.id;
      mrId             = r.mrId;
      chemistId        = r.chemistId;
      chemistName      = r.chemistName;
      station          = r.station;
      area             = r.area;
      date             = r.date;
      productsEnquired = r.productsEnquired;
      orderNoted       = r.orderNoted;
      gpsLocation      = r.gpsLocation;
      remarks          = r.remarks;
      createdAt        = r.createdAt;
    }
  };

  public func stockistToInfo(r : StockistCallRecord) : StockistCallInfo {
    {
      id                = r.id;
      mrId              = r.mrId;
      stockistId        = r.stockistId;
      stockistName      = r.stockistName;
      station           = r.station;
      area              = r.area;
      date              = r.date;
      productsDiscussed = r.productsDiscussed;
      orderQty          = r.orderQty;
      gpsLocation       = r.gpsLocation;
      remarks           = r.remarks;
      createdAt         = r.createdAt;
    }
  };

  // ── Date-range helpers ────────────────────────────────────────────────────

  /// True when `date` ("YYYY-MM-DD") is within [fromDate, toDate] inclusive.
  private func inRange(date : Text, fromDate : Text, toDate : Text) : Bool {
    date >= fromDate and date <= toDate
  };

  /// True when the `mrId` is found in the `mrIds` array.
  private func inTeam(mrId : UserId, mrIds : [Nat]) : Bool {
    switch (mrIds.find(func(id : Nat) : Bool { id == mrId })) {
      case null  { false };
      case (?_)  { true };
    }
  };

  // ── Chemist Call Functions ────────────────────────────────────────────────

  /// Create a new chemist call record; returns the new callId.
  public func submitChemistCall(
    chemistCalls     : List.List<ChemistCallRecord>,
    nextChemistCallId : { var val : Nat },
    mrId  : UserId,
    input : ChemistCallInput,
    now   : Int,
  ) : Nat {
    let id = nextChemistCallId.val;
    let record : ChemistCallRecord = {
      id               = id;
      mrId             = mrId;
      chemistId        = input.chemistId;
      var chemistName  = input.chemistName;
      var station      = input.station;
      var area         = input.area;
      date             = input.date;
      var productsEnquired = input.productsEnquired;
      var orderNoted   = input.orderNoted;
      gpsLocation      = input.gpsLocation;
      var remarks      = input.remarks;
      createdAt        = now;
    };
    chemistCalls.add(record);
    nextChemistCallId.val += 1;
    id
  };

  /// Get a single chemist call by ID.
  public func getChemistCall(
    chemistCalls : List.List<ChemistCallRecord>,
    callId       : Nat,
  ) : ?ChemistCallInfo {
    switch (chemistCalls.find(func(r : ChemistCallRecord) : Bool { r.id == callId })) {
      case null  { null };
      case (?r)  { ?chemistToInfo(r) };
    }
  };

  /// List all chemist calls for a specific MR within a date range.
  public func listMyChemistCalls(
    chemistCalls : List.List<ChemistCallRecord>,
    mrId         : UserId,
    fromDate     : Text,
    toDate       : Text,
  ) : [ChemistCallInfo] {
    let result = List.empty<ChemistCallInfo>();
    for (r in chemistCalls.values()) {
      if (r.mrId == mrId and inRange(r.date, fromDate, toDate)) {
        result.add(chemistToInfo(r))
      }
    };
    result.toArray()
  };

  /// List chemist calls for a team of MRs within a date range.
  public func listChemistCallsForTeam(
    chemistCalls : List.List<ChemistCallRecord>,
    mrIds        : [Nat],
    fromDate     : Text,
    toDate       : Text,
  ) : [ChemistCallInfo] {
    let result = List.empty<ChemistCallInfo>();
    for (r in chemistCalls.values()) {
      if (inTeam(r.mrId, mrIds) and inRange(r.date, fromDate, toDate)) {
        result.add(chemistToInfo(r))
      }
    };
    result.toArray()
  };

  /// Get all chemist calls for a specific MR on a given date.
  public func getChemistCallsByDate(
    chemistCalls : List.List<ChemistCallRecord>,
    mrId         : UserId,
    date         : Text,
  ) : [ChemistCallInfo] {
    let result = List.empty<ChemistCallInfo>();
    for (r in chemistCalls.values()) {
      if (r.mrId == mrId and r.date == date) {
        result.add(chemistToInfo(r))
      }
    };
    result.toArray()
  };

  // ── Stockist Call Functions ───────────────────────────────────────────────

  /// Create a new stockist call record; returns the new callId.
  public func submitStockistCall(
    stockistCalls     : List.List<StockistCallRecord>,
    nextStockistCallId : { var val : Nat },
    mrId  : UserId,
    input : StockistCallInput,
    now   : Int,
  ) : Nat {
    let id = nextStockistCallId.val;
    let record : StockistCallRecord = {
      id                    = id;
      mrId                  = mrId;
      stockistId            = input.stockistId;
      var stockistName      = input.stockistName;
      var station           = input.station;
      var area              = input.area;
      date                  = input.date;
      var productsDiscussed = input.productsDiscussed;
      var orderQty          = input.orderQty;
      gpsLocation           = input.gpsLocation;
      var remarks           = input.remarks;
      createdAt             = now;
    };
    stockistCalls.add(record);
    nextStockistCallId.val += 1;
    id
  };

  /// Get a single stockist call by ID.
  public func getStockistCall(
    stockistCalls : List.List<StockistCallRecord>,
    callId        : Nat,
  ) : ?StockistCallInfo {
    switch (stockistCalls.find(func(r : StockistCallRecord) : Bool { r.id == callId })) {
      case null  { null };
      case (?r)  { ?stockistToInfo(r) };
    }
  };

  /// List all stockist calls for a specific MR within a date range.
  public func listMyStockistCalls(
    stockistCalls : List.List<StockistCallRecord>,
    mrId          : UserId,
    fromDate      : Text,
    toDate        : Text,
  ) : [StockistCallInfo] {
    let result = List.empty<StockistCallInfo>();
    for (r in stockistCalls.values()) {
      if (r.mrId == mrId and inRange(r.date, fromDate, toDate)) {
        result.add(stockistToInfo(r))
      }
    };
    result.toArray()
  };

  /// List stockist calls for a team of MRs within a date range.
  public func listStockistCallsForTeam(
    stockistCalls : List.List<StockistCallRecord>,
    mrIds         : [Nat],
    fromDate      : Text,
    toDate        : Text,
  ) : [StockistCallInfo] {
    let result = List.empty<StockistCallInfo>();
    for (r in stockistCalls.values()) {
      if (inTeam(r.mrId, mrIds) and inRange(r.date, fromDate, toDate)) {
        result.add(stockistToInfo(r))
      }
    };
    result.toArray()
  };

  /// Get all stockist calls for a specific MR on a given date.
  public func getStockistCallsByDate(
    stockistCalls : List.List<StockistCallRecord>,
    mrId          : UserId,
    date          : Text,
  ) : [StockistCallInfo] {
    let result = List.empty<StockistCallInfo>();
    for (r in stockistCalls.values()) {
      if (r.mrId == mrId and r.date == date) {
        result.add(stockistToInfo(r))
      }
    };
    result.toArray()
  };

  // ── Coverage Report Functions ─────────────────────────────────────────────

  /// Build a CoverageRow list grouped by (mrId, station) for chemist visits.
  public func getChemistCoverage(
    chemistCalls : List.List<ChemistCallRecord>,
    mrIds        : [Nat],
    fromDate     : Text,
    toDate       : Text,
    mrNames      : [(Nat, Text)],
  ) : [CoverageRow] {
    // Accumulate visit counts per (mrId, station, area) key
    // Key text = "<mrId>|<station>"
    let countMap = Map.empty<Text, { mrId: Nat; station: Text; area: Text; count: Nat }>();
    for (r in chemistCalls.values()) {
      if (inTeam(r.mrId, mrIds) and inRange(r.date, fromDate, toDate)) {
        let key = r.mrId.toText() # "|" # r.station;
        switch (countMap.get(key)) {
          case null {
            countMap.add(key, { mrId = r.mrId; station = r.station; area = r.area; count = 1 })
          };
          case (?entry) {
            countMap.add(key, { entry with count = entry.count + 1 })
          };
        }
      }
    };

    // Look up MR name helper
    let nameFor = func(mrId : Nat) : Text {
      switch (mrNames.find(func((id, _) : (Nat, Text)) : Bool { id == mrId })) {
        case null       { "Unknown" };
        case (?(_, n))  { n };
      }
    };

    let period = fromDate # " to " # toDate;
    let result = List.empty<CoverageRow>();
    for ((_, entry) in countMap.entries()) {
      result.add({
        mrId           = entry.mrId;
        mrName         = nameFor(entry.mrId);
        station        = entry.station;
        area           = entry.area;
        chemistVisits  = entry.count;
        stockistVisits = 0;
        period         = period;
      })
    };
    result.toArray()
  };

  /// Build a CoverageRow list grouped by (mrId, station) for stockist visits.
  public func getStockistCoverage(
    stockistCalls : List.List<StockistCallRecord>,
    mrIds         : [Nat],
    fromDate      : Text,
    toDate        : Text,
    mrNames       : [(Nat, Text)],
  ) : [CoverageRow] {
    let countMap = Map.empty<Text, { mrId: Nat; station: Text; area: Text; count: Nat }>();
    for (r in stockistCalls.values()) {
      if (inTeam(r.mrId, mrIds) and inRange(r.date, fromDate, toDate)) {
        let key = r.mrId.toText() # "|" # r.station;
        switch (countMap.get(key)) {
          case null {
            countMap.add(key, { mrId = r.mrId; station = r.station; area = r.area; count = 1 })
          };
          case (?entry) {
            countMap.add(key, { entry with count = entry.count + 1 })
          };
        }
      }
    };

    let nameFor = func(mrId : Nat) : Text {
      switch (mrNames.find(func((id, _) : (Nat, Text)) : Bool { id == mrId })) {
        case null       { "Unknown" };
        case (?(_, n))  { n };
      }
    };

    let period = fromDate # " to " # toDate;
    let result = List.empty<CoverageRow>();
    for ((_, entry) in countMap.entries()) {
      result.add({
        mrId           = entry.mrId;
        mrName         = nameFor(entry.mrId);
        station        = entry.station;
        area           = entry.area;
        chemistVisits  = 0;
        stockistVisits = entry.count;
        period         = period;
      })
    };
    result.toArray()
  };

  /// Count chemist and stockist calls for an MR on a given date.
  /// Used by DCR auto-fill / daily summary.
  public func getDailyCallCounts(
    chemistCalls  : List.List<ChemistCallRecord>,
    stockistCalls : List.List<StockistCallRecord>,
    mrId          : UserId,
    date          : Text,
  ) : { chemistCount : Nat; stockistCount : Nat } {
    var cc : Nat = 0;
    var sc : Nat = 0;
    for (r in chemistCalls.values()) {
      if (r.mrId == mrId and r.date == date) { cc += 1 }
    };
    for (r in stockistCalls.values()) {
      if (r.mrId == mrId and r.date == date) { sc += 1 }
    };
    { chemistCount = cc; stockistCount = sc }
  };

  /// Summary of today's chemist and stockist calls for a given MR.
  public func getTodayCallSummary(
    chemistCalls  : List.List<ChemistCallRecord>,
    stockistCalls : List.List<StockistCallRecord>,
    mrId          : UserId,
    today         : Text,
  ) : { chemistCalls : Nat; stockistCalls : Nat; totalCalls : Nat } {
    let counts = getDailyCallCounts(chemistCalls, stockistCalls, mrId, today);
    {
      chemistCalls  = counts.chemistCount;
      stockistCalls = counts.stockistCount;
      totalCalls    = counts.chemistCount + counts.stockistCount;
    }
  };
};
