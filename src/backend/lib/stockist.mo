import Types    "../types/stockist";
import LocTypes  "../types/location-master";
import Map       "mo:core/Map";
import List      "mo:core/List";

module {
  public type StockistRecord         = Types.StockistRecord;
  public type StockistId             = Types.StockistId;
  public type CreateStockistRequest  = Types.CreateStockistRequest;
  public type UpdateStockistRequest  = Types.UpdateStockistRequest;
  public type StockistFilter         = Types.StockistFilter;
  public type UserId                 = Types.UserId;
  public type Timestamp              = Types.Timestamp;

  /// Look up the HQ ID for a given area from the location master.
  func resolveHqForArea(
    areas : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs   : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    areaId : Nat,
  ) : Nat {
    switch (areas.get(areaId)) {
      case (?area) { area.hqId };
      case null    { 0 };
    }
  };

  /// Create a new stockist record. hqId is auto-derived from the area's hqId.
  public func createStockist(
    stockists      : Map.Map<StockistId, StockistRecord>,
    areas          : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs            : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    nextId         : { var value : Nat },
    req            : CreateStockistRequest,
    callerId       : UserId,
    now            : Timestamp,
  ) : { #ok : StockistRecord; #err : Text } {
    // Validate required fields
    if (req.name.size() == 0)           { return #err("Stockist name is required") };
    if (req.proprietorName.size() == 0) { return #err("Proprietor name is required") };
    if (req.mobileNumber.size() == 0)   { return #err("Mobile number is required") };

    let hqId = resolveHqForArea(areas, hqs, req.areaId);
    let id = nextId.value;
    nextId.value += 1;
    let record : StockistRecord = {
      id;
      name              = req.name;
      proprietorName    = req.proprietorName;
      mobileNumber      = req.mobileNumber;
      emailId           = req.emailId;
      address           = req.address;
      areaId            = req.areaId;
      hqId;
      drugLicenseNumber = req.drugLicenseNumber;
      gstNumber         = req.gstNumber;
      remarks           = req.remarks;
      isActive          = true;
      createdAt         = now;
      createdBy         = callerId;
    };
    stockists.add(id, record);
    #ok(record)
  };

  /// Update fields on an existing stockist. Recalculates hqId if areaId changes.
  public func updateStockist(
    stockists : Map.Map<StockistId, StockistRecord>,
    areas     : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs       : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    req       : UpdateStockistRequest,
  ) : { #ok : StockistRecord; #err : Text } {
    switch (stockists.get(req.id)) {
      case null { #err("Stockist not found") };
      case (?existing) {
        let newAreaId = switch (req.areaId) { case (?a) a; case null existing.areaId };
        let newHqId = switch (req.areaId) {
          case (?_) { resolveHqForArea(areas, hqs, newAreaId) };
          case null { existing.hqId };
        };
        let updated : StockistRecord = {
          existing with
          name              = switch (req.name)              { case (?v) v; case null existing.name              };
          proprietorName    = switch (req.proprietorName)    { case (?v) v; case null existing.proprietorName    };
          mobileNumber      = switch (req.mobileNumber)      { case (?v) v; case null existing.mobileNumber      };
          emailId           = switch (req.emailId)           { case (?v) ?v; case null existing.emailId          };
          address           = switch (req.address)           { case (?v) v; case null existing.address           };
          areaId            = newAreaId;
          hqId              = newHqId;
          drugLicenseNumber = switch (req.drugLicenseNumber) { case (?v) ?v; case null existing.drugLicenseNumber };
          gstNumber         = switch (req.gstNumber)         { case (?v) ?v; case null existing.gstNumber        };
          remarks           = switch (req.remarks)           { case (?v) ?v; case null existing.remarks          };
          isActive          = switch (req.isActive)          { case (?v) v; case null existing.isActive          };
        };
        stockists.add(req.id, updated);
        #ok(updated)
      };
    }
  };

  /// List stockists with optional filters. Case-insensitive name search.
  public func listStockists(
    stockists : Map.Map<StockistId, StockistRecord>,
    filter    : StockistFilter,
  ) : [StockistRecord] {
    let result = List.empty<StockistRecord>();
    for ((_, s) in stockists.entries()) {
      switch (filter.isActive) {
        case (?active) { if (s.isActive != active) continue };
        case null {};
      };
      switch (filter.areaId) {
        case (?aid) { if (s.areaId != aid) continue };
        case null {};
      };
      switch (filter.hqId) {
        case (?hid) { if (s.hqId != hid) continue };
        case null {};
      };
      switch (filter.nameSearch) {
        case (?ns) {
          let lower = ns.toLower();
          if (not s.name.toLower().contains(#text lower)) continue;
        };
        case null {};
      };
      result.add(s);
    };
    result.toArray()
  };

  /// Get a single stockist by ID.
  public func getStockist(
    stockists  : Map.Map<StockistId, StockistRecord>,
    stockistId : StockistId,
  ) : ?StockistRecord {
    stockists.get(stockistId)
  };

  /// Deactivate a stockist (soft delete).
  public func deactivateStockist(
    stockists  : Map.Map<StockistId, StockistRecord>,
    stockistId : StockistId,
  ) : Bool {
    switch (stockists.get(stockistId)) {
      case null { false };
      case (?existing) {
        stockists.add(stockistId, { existing with isActive = false });
        true
      };
    }
  };

  /// Return all active stockists for a given areaId.
  public func listStockistsByArea(
    stockists : Map.Map<StockistId, StockistRecord>,
    areaId    : Nat,
  ) : [StockistRecord] {
    let result = List.empty<StockistRecord>();
    for ((_, s) in stockists.entries()) {
      if (s.areaId == areaId and s.isActive) { result.add(s) };
    };
    result.toArray()
  };

  /// Bulk-upload stockists. Validates each row; skips rows with empty name.
  public func bulkUploadStockists(
    stockists : Map.Map<StockistId, StockistRecord>,
    areas     : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs       : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    nextId    : { var value : Nat },
    items     : [Types.BulkStockistInput],
    callerId  : UserId,
    now       : Timestamp,
  ) : Types.BulkUploadResult {
    var succeeded : Nat = 0;
    var failed    : Nat = 0;
    let errors    = List.empty<Text>();

    for (item in items.values()) {
      if (item.name == "") {
        failed += 1;
        errors.add("Row with empty name skipped");
      } else if (item.proprietorName == "") {
        failed += 1;
        errors.add("Row '" # item.name # "': proprietorName is required");
      } else if (item.mobileNumber == "") {
        failed += 1;
        errors.add("Row '" # item.name # "': mobileNumber is required");
      } else {
        let hqId = resolveHqForArea(areas, hqs, item.areaId);
        let id = nextId.value;
        nextId.value += 1;
        let record : StockistRecord = {
          id;
          name              = item.name;
          proprietorName    = item.proprietorName;
          mobileNumber      = item.mobileNumber;
          emailId           = null;
          address           = item.address;
          areaId            = item.areaId;
          hqId;
          drugLicenseNumber = item.drugLicenseNumber;
          gstNumber         = item.gstNumber;
          remarks           = item.remarks;
          isActive          = true;
          createdAt         = now;
          createdBy         = callerId;
        };
        stockists.add(id, record);
        succeeded += 1;
      };
    };

    { succeeded; failed; errors = errors.toArray() }
  };
};
