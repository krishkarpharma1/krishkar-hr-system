import AuthTypes "../types/auth-users";
import Map        "mo:core/Map";
import List       "mo:core/List";
import Nat        "mo:core/Nat";

module {
  public type UserId     = AuthTypes.UserId;
  public type UserRecord = AuthTypes.UserRecord;
  public type Role       = AuthTypes.Role;

  // ── Legacy per-role config (kept for backward compat read) ──────────────────

  public type EmpIdCounter = {
    var prefix       : Text;
    var nextSequence : Nat;
  };

  public type EmpIdConfig = {
    roleKey        : Text;
    prefix         : Text;
    startingNumber : Nat;
    padWidth       : Nat;
  };

  // ── New company-wide UID format ─────────────────────────────────────────────

  /// Per-year sequential counter. Key = year (e.g. 2026), Value = last-used seq number.
  public type UidYearCounters = Map.Map<Nat, Nat>;

  /// Admin-configurable UID settings.
  public type UidConfig = {
    var companyPrefix : Text;          // e.g. "KP"
    yearCounters      : UidYearCounters; // mutable map: year → last seq used
  };

  /// Build an empty UidConfig with default prefix "KP".
  public func emptyUidConfig() : UidConfig {
    {
      var companyPrefix = "KP";
      yearCounters      = Map.empty<Nat, Nat>();
    }
  };

  // ── UID generation ───────────────────────────────────────────────────────────

  /// Generate the next UID for the given year.
  /// Format: [CompanyPrefix]-[Year]-[ZeroPaddedSeq]
  /// e.g. KP-2026-001, KP-2026-002, ..., KP-2026-010, ..., KP-2026-100
  /// Counter per year starts at 1 and only ever increments.
  public func generateUID(uidConfig : UidConfig, year : Nat) : Text {
    let prevSeq = switch (uidConfig.yearCounters.get(year)) {
      case (?n) n;
      case null 0;
    };
    let nextSeq = prevSeq + 1;
    uidConfig.yearCounters.add(year, nextSeq);
    let seqText = zeroPad(nextSeq, 3);
    uidConfig.companyPrefix # "-" # year.toText() # "-" # seqText
  };

  /// Get the current company prefix.
  public func getCompanyPrefix(uidConfig : UidConfig) : Text {
    uidConfig.companyPrefix
  };

  /// Set the company prefix (Admin only — access enforced by mixin).
  public func setCompanyPrefix(uidConfig : UidConfig, prefix : Text) : () {
    uidConfig.companyPrefix := prefix
  };

  // ── Legacy per-role ID generation (kept for read/migration purposes) ─────────

  public func roleKey(role : Role) : Text {
    switch (role) {
      case (#MR)        { "MR" };
      case (#ASM)       { "ASM" };
      case (#RSM)       { "RSM" };
      case (#ZSM)       { "ZSM" };
      case (#HRManager) { "HR" };
      case (#Admin)     { "ADMIN" };
    }
  };

  public func generateNextId(
    counters : Map.Map<Text, EmpIdCounter>,
    configs  : Map.Map<Text, EmpIdConfig>,
    rKey     : Text,
  ) : Text {
    let cfg : EmpIdConfig = switch (configs.get(rKey)) {
      case (?c) { c };
      case null {
        switch (configs.get("default")) {
          case (?c) { c };
          case null { { roleKey = "default"; prefix = "EMP"; startingNumber = 1; padWidth = 3 } };
        }
      };
    };
    let counter : EmpIdCounter = switch (counters.get(rKey)) {
      case (?c) { c };
      case null {
        let c : EmpIdCounter = { var prefix = cfg.prefix; var nextSequence = cfg.startingNumber };
        counters.add(rKey, c);
        c
      };
    };
    let seq = counter.nextSequence;
    counter.nextSequence += 1;
    let seqText = zeroPad(seq, cfg.padWidth);
    cfg.prefix # seqText
  };

  public func saveConfig(
    configs  : Map.Map<Text, EmpIdConfig>,
    counters : Map.Map<Text, EmpIdCounter>,
    config   : EmpIdConfig,
  ) {
    configs.add(config.roleKey, config);
    switch (counters.get(config.roleKey)) {
      case null {
        let c : EmpIdCounter = {
          var prefix       = config.prefix;
          var nextSequence = config.startingNumber;
        };
        counters.add(config.roleKey, c);
      };
      case (?c) {
        c.prefix := config.prefix;
        if (config.startingNumber > c.nextSequence) {
          c.nextSequence := config.startingNumber;
        };
      };
    };
  };

  public func listConfigs(
    configs : Map.Map<Text, EmpIdConfig>,
  ) : [EmpIdConfig] {
    let result = List.empty<EmpIdConfig>();
    for ((_, cfg) in configs.entries()) {
      result.add(cfg);
    };
    result.toArray()
  };

  // ── Bulk UID migration ───────────────────────────────────────────────────────

  /// Extract the 4-digit year from a nanosecond Int timestamp.
  /// Falls back to currentYear if timestamp is 0 or parsing fails.
  func yearFromTimestamp(ts : Int, currentYear : Nat) : Nat {
    if (ts <= 0) return currentYear;
    let secs : Int = ts / 1_000_000_000;
    let days : Int = secs / 86400;
    let z : Int = days + 719468;
    let era : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe : Int = z - era * 146097;
    let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y : Int = yoe + era * 400;
    let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp : Int = (5 * doy + 2) / 153;
    let m : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr : Int = if (m <= 2) y + 1 else y;
    if (yr > 0) yr.toNat() else currentYear
  };

  /// Determine if an employeeId looks like the OLD per-role format (no dash separators)
  /// e.g. "MR001", "ASM002" — legacy IDs don't contain "-".
  func isOldFormat(eid : Text) : Bool {
    // New UIDs always contain "-" (e.g. KP-2026-001).
    // Old UIDs have no "-" (e.g. MR001, ASM002, EMP001).
    not eid.contains(#char '-')
  };

  /// Bulk-assign new UIDs to all existing employees that either:
  ///   (a) have an empty employeeId, or
  ///   (b) have an old-format employeeId (no "-" separator)
  /// Processes users in ascending creation order (oldest first).
  /// Uses the year extracted from each user's createdAt timestamp.
  /// Returns the number of users updated.
  public func bulkMigrateUids(
    users      : Map.Map<UserId, UserRecord>,
    uidConfig  : UidConfig,
    currentYear : Nat,
  ) : Nat {
    // Collect all users that need a new UID
    let toMigrate = List.empty<UserRecord>();
    for ((_, u) in users.entries()) {
      if (u.employeeId == "" or isOldFormat(u.employeeId)) {
        toMigrate.add(u);
      };
    };
    // Sort ascending by createdAt (oldest first)
    toMigrate.sortInPlace(func(a : UserRecord, b : UserRecord) : {#less; #equal; #greater} {
      if (a.createdAt < b.createdAt)      { #less }
      else if (a.createdAt > b.createdAt) { #greater }
      else                                { #equal }
    });

    var count = 0;
    for (u in toMigrate.values()) {
      let year = yearFromTimestamp(u.createdAt, currentYear);
      let newUid = generateUID(uidConfig, year);
      u.employeeId := newUid;
      count += 1;
    };
    count
  };

  /// Original bulk-assign for employees with empty employeeId only (legacy).
  public func bulkAssignMissingIds(
    users    : Map.Map<UserId, UserRecord>,
    counters : Map.Map<Text, EmpIdCounter>,
    configs  : Map.Map<Text, EmpIdConfig>,
  ) : Nat {
    let missing = List.empty<UserRecord>();
    for ((_, u) in users.entries()) {
      if (u.employeeId == "") {
        missing.add(u);
      };
    };
    missing.sortInPlace(func(a : UserRecord, b : UserRecord) : {#less; #equal; #greater} {
      if (a.createdAt < b.createdAt)      { #less }
      else if (a.createdAt > b.createdAt) { #greater }
      else                                { #equal }
    });

    var count = 0;
    for (u in missing.values()) {
      let rKey = roleKey(u.role);
      let newId = generateNextId(counters, configs, rKey);
      u.employeeId := newId;
      count += 1;
    };
    count
  };

  // ── Private helpers ──────────────────────────────────────────────────────────

  public func zeroPad(n : Nat, width : Nat) : Text {
    let s = n.toText();
    let len = s.size();
    if (len >= width) { s }
    else {
      var pad = "";
      var i = len;
      while (i < width) {
        pad := pad # "0";
        i += 1;
      };
      pad # s
    }
  };
};
