import Types     "../types/stockist";
import LocTypes  "../types/location-master";
import FieldTypes "../types/field-ops";
import AuthTypes "../types/auth-users";
import AuthLib   "../lib/auth-users";
import Lib       "../lib/stockist";
import Map       "mo:core/Map";
import List      "mo:core/List";
import Time      "mo:core/Time";

/// Public API mixin for Stockist Master management.
/// Admin/HR can create, update, deactivate stockists.
/// MR/ASM can view stockists in their assigned area (read-only).
mixin (
  sessions          : Map.Map<Text, AuthTypes.Session>,
  users             : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  stockists         : Map.Map<Types.StockistId, Types.StockistRecord>,
  hqs               : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
  areas             : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  nextStockistId    : { var value : Nat },
  bulkUploadHistory : List.List<FieldTypes.BulkUploadRecord>,
  nextBulkHistoryId : { var value : Nat },
) {

  func stockIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _ { false };
    }
  };

  /// Create a new stockist (Admin/HR only).
  public shared func createStockist(
    token : Text,
    req   : Types.CreateStockistRequest,
  ) : async { #ok : Types.StockistRecord; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not stockIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        Lib.createStockist(stockists, areas, hqs, nextStockistId, req, session.userId, Time.now())
      };
    }
  };

  /// Update an existing stockist's details (Admin/HR only).
  public shared func updateStockist(
    token : Text,
    req   : Types.UpdateStockistRequest,
  ) : async { #ok : Types.StockistRecord; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not stockIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        Lib.updateStockist(stockists, areas, hqs, req)
      };
    }
  };

  /// List stockists with optional filters.
  /// Admin/HR see all active and inactive; MR/ASM see only active stockists in their assigned area(s).
  public shared func listStockists(
    token  : Text,
    filter : Types.StockistFilter,
  ) : async [Types.StockistRecord] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (stockIsAdminOrHR(session.role)) {
          // Admin/HR: apply filter as-is
          Lib.listStockists(stockists, filter)
        } else {
          // Field staff: restrict to their own area(s) and active only
          let userAreas : [Nat] = switch (users.get(session.userId)) {
            case (?u) { u.areaIds };
            case null { [] };
          };
          let result = List.empty<Types.StockistRecord>();
          for (areaId in userAreas.values()) {
            for (s in Lib.listStockistsByArea(stockists, areaId).values()) {
              result.add(s);
            };
          };
          result.toArray()
        }
      };
    }
  };

  /// Get a single stockist by ID.
  public shared func getStockist(
    token      : Text,
    stockistId : Types.StockistId,
  ) : async ?Types.StockistRecord {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?_) {
        Lib.getStockist(stockists, stockistId)
      };
    }
  };

  /// Deactivate a stockist so it no longer appears in field staff dropdowns (Admin/HR only).
  public shared func deactivateStockist(
    token      : Text,
    stockistId : Types.StockistId,
  ) : async { #ok; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not stockIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        if (Lib.deactivateStockist(stockists, stockistId)) { #ok }
        else { #err("Stockist not found") }
      };
    }
  };

  /// List active stockists filtered by area ID (used by field staff sale entry dropdowns).
  public shared func listStockistsByArea(
    token  : Text,
    areaId : Nat,
  ) : async [Types.StockistRecord] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?_) {
        Lib.listStockistsByArea(stockists, areaId)
      };
    }
  };

  /// Bulk-upload stockists from a parsed CSV/Excel payload (Admin/HR only).
  /// Records a history entry after each upload operation.
  public shared func bulkUploadStockists(
    token : Text,
    items : [Types.BulkStockistInput],
  ) : async { #ok : Types.BulkUploadResult; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not stockIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        let result = Lib.bulkUploadStockists(stockists, areas, hqs, nextStockistId, items, session.userId, Time.now());
        let histId = nextBulkHistoryId.value;
        nextBulkHistoryId.value += 1;
        bulkUploadHistory.add({
          id          = histId;
          uploadType  = "stockists";
          uploadedBy  = session.userId;
          uploadedAt  = Time.now();
          totalRows   = items.size();
          savedRows   = result.succeeded;
          skippedRows = result.failed;
          errors      = result.errors;
        });
        #ok(result)
      };
    }
  };
};
