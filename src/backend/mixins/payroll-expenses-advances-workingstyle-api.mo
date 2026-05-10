import Debug "mo:core/Debug";
import Types     "../types/payroll-expenses-advances-workingstyle";
import AuthTypes  "../types/auth-users";
import HRTypes    "../types/hr-core";
import Lib        "../lib/payroll-expenses-advances-workingstyle";
import List       "mo:core/List";
import Map        "mo:core/Map";
import Time       "mo:core/Time";
import Nat        "mo:core/Nat";

/// Mixin exposing the payroll-expenses-advances-workingstyle public API.
/// Injected state: advances, expenseSheets, incentiveBonusSheets, workingStyleRecords,
///                 sessions, users (for auth/name resolution).
mixin (
  sessions              : Map.Map<Text, AuthTypes.Session>,
  users                 : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  advances              : List.List<Types.EmployeeAdvance>,
  expenseSheets         : List.List<Types.ExpenseSheet>,
  incentiveBonusSheets  : List.List<Types.IncentiveBonusSheet>,
  workingStyleRecords   : List.List<Types.WorkingStyleRecord>,
  tadaExpenses          : List.List<HRTypes.TaDaExpense>,
  nextAdvanceId         : { var value : Nat },
  nextExpenseSheetId    : { var value : Nat },
  nextIncentiveBonusId  : { var value : Nat },
  nextWorkingStyleId    : { var value : Nat },
) {

  // ── Auth helpers ───────────────────────────────────────────────────────────

  func peaGetSession(token : Text) : ?AuthTypes.Session {
    sessions.get(token);
  };

  func peaIsHrOrAdmin(token : Text) : Bool {
    switch (peaGetSession(token)) {
      case (?s) {
        switch (users.get(s.userId)) {
          case (?u) { u.role == #HRManager or u.role == #Admin };
          case null { false };
        }
      };
      case null { false };
    };
  };

  func peaGetSessionUser(token : Text) : ?AuthTypes.UserRecord {
    switch (peaGetSession(token)) {
      case (?s) { users.get(s.userId) };
      case null { null };
    };
  };

  func peaGenAdvanceId() : Text {
    let id = nextAdvanceId.value;
    nextAdvanceId.value += 1;
    "ADV-" # id.toText();
  };

  func genExpenseSheetId() : Text {
    let id = nextExpenseSheetId.value;
    nextExpenseSheetId.value += 1;
    "EXP-" # id.toText();
  };

  func genIncentiveBonusId() : Text {
    let id = nextIncentiveBonusId.value;
    nextIncentiveBonusId.value += 1;
    "IBS-" # id.toText();
  };

  func genWorkingStyleId() : Text {
    let id = nextWorkingStyleId.value;
    nextWorkingStyleId.value += 1;
    "WS-" # id.toText();
  };

  // ── Employee Advance ───────────────────────────────────────────────────────

  /// HR/Admin: Record a new advance paid to an employee.
  public shared ({ caller }) func createAdvance(
    input : Types.CreateAdvanceInput,
  ) : async { #ok : Text; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    let id = peaGenAdvanceId();
    let resultId = Lib.createAdvance(advances, input, token, Time.now(), id);
    #ok(resultId);
  };

  /// HR/Admin: Update number of remaining installments or installment amount.
  public shared ({ caller }) func updateAdvance(
    id    : Text,
    input : Types.UpdateAdvanceInput,
  ) : async { #ok; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    Lib.updateAdvance(advances, id, input);
  };

  /// HR/Admin: Cancel an advance with a remark.
  public shared ({ caller }) func cancelAdvance(
    id     : Text,
    remark : Text,
  ) : async { #ok; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    Lib.cancelAdvance(advances, id, remark);
  };

  /// HR/Admin: Pause or resume deduction for an advance.
  public shared ({ caller }) func pauseAdvance(
    id     : Text,
    pause  : Bool,
    remark : Text,
  ) : async { #ok; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    Lib.pauseAdvance(advances, id, pause, remark);
  };

  /// Employee self-view: get own advances.
  public shared query ({ caller }) func getMyAdvances() : async [Types.EmployeeAdvance] {
    let token = caller.toText();
    switch (peaGetSessionUser(token)) {
      case null { [] };
      case (?u) {
        Lib.getAdvancesByEmployee(advances, u.employeeId);
      };
    };
  };

  /// HR/Admin: Get all advances for a specific employee.
  public shared query ({ caller }) func getAdvancesByEmployee(
    employeeId : Text,
  ) : async [Types.EmployeeAdvance] {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) { return [] };
    Lib.getAdvancesByEmployee(advances, employeeId);
  };

  /// HR/Admin: Get all advances across all employees.
  public shared query ({ caller }) func getAllAdvances() : async [Types.EmployeeAdvance] {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) { return [] };
    Lib.getAllAdvances(advances);
  };

  /// HR/Admin: Trigger monthly installment deduction processing for a given month/year.
  public shared ({ caller }) func processMonthlyAdvanceDeductions(
    month : Nat,
    year  : Nat,
  ) : async { #ok; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    Lib.processMonthlyAdvanceDeductions(advances, month, year);
  };

  // ── Expense Sheet ──────────────────────────────────────────────────────────

  /// HR/Admin: Generate or regenerate an expense sheet from approved TA/DA records.
  /// Line items are built from the TaDaExpense records injected via the HR-Core mixin.
  /// Here the mixin accepts pre-built lineItems from the caller (frontend collects them).
  public shared ({ caller }) func generateExpenseSheet(
    employeeId : Text,
    month      : Nat,
    year       : Nat,
    lineItems  : [Types.ExpenseLineItem],
  ) : async { #ok : Text; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    let id = genExpenseSheetId();
    let resultId = Lib.generateExpenseSheet(expenseSheets, employeeId, month, year, lineItems, Time.now(), id);
    #ok(resultId);
  };

  /// Employee/HR/Admin: Fetch expense sheet for a specific employee/month/year.
  public shared query ({ caller }) func getExpenseSheet(
    employeeId : Text,
    month      : Nat,
    year       : Nat,
  ) : async ?Types.ExpenseSheet {
    let token = caller.toText();
    switch (peaGetSessionUser(token)) {
      case null { null };
      case (?u) {
        // Employee can only view their own; HR/Admin can view any
        if (u.role != #HRManager and u.role != #Admin and u.employeeId != employeeId) {
          return null;
        };
        Lib.getExpenseSheet(expenseSheets, employeeId, month, year);
      };
    };
  };

  /// Employee self-view: Fetch own expense sheet for a specific month/year.
  public shared query ({ caller }) func getMyExpenseSheet(
    month : Nat,
    year  : Nat,
  ) : async ?Types.ExpenseSheet {
    let token = caller.toText();
    switch (peaGetSessionUser(token)) {
      case null { null };
      case (?u) {
        Lib.getExpenseSheet(expenseSheets, u.employeeId, month, year);
      };
    };
  };

  /// HR/Admin: Get expense sheets matching filter.
  public shared query ({ caller }) func getAllExpenseSheets(
    filter : Types.ExpenseSheetFilter,
  ) : async [Types.ExpenseSheet] {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) { return [] };
    Lib.getAllExpenseSheets(expenseSheets, filter);
  };

  /// HR/Admin: Mark an expense sheet as Paid.
  public shared ({ caller }) func markExpenseSheetPaid(
    sheetId     : Text,
    paymentDate : Int,
  ) : async { #ok; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    Lib.markExpenseSheetPaid(expenseSheets, sheetId, paymentDate, token);
  };

  /// System/Admin: Refresh DueForPayment flags based on current date.
  public shared ({ caller }) func refreshExpenseSheetStatus() : async () {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) { return };
    Lib.refreshExpenseSheetStatus(expenseSheets, Time.now());
  };

  // ── Incentive & Bonus Sheet ────────────────────────────────────────────────

  /// HR/Admin: Generate or regenerate an incentive/bonus sheet.
  public shared ({ caller }) func generateIncentiveBonusSheet(
    employeeId     : Text,
    quarter        : Nat,
    year           : Nat,
    monthlyEntries : [Types.IncentiveMonthEntry],
    bonusEntries   : [Types.BonusEntry],
  ) : async { #ok : Text; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    let id = genIncentiveBonusId();
    let resultId = Lib.generateIncentiveBonusSheet(
      incentiveBonusSheets, employeeId, quarter, year,
      monthlyEntries, bonusEntries, Time.now(), id,
    );
    #ok(resultId);
  };

  /// Employee/HR/Admin: Fetch incentive/bonus sheet for a specific employee/quarter/year.
  public shared query ({ caller }) func getIncentiveBonusSheet(
    employeeId : Text,
    quarter    : Nat,
    year       : Nat,
  ) : async ?Types.IncentiveBonusSheet {
    let token = caller.toText();
    switch (peaGetSessionUser(token)) {
      case null { null };
      case (?u) {
        if (u.role != #HRManager and u.role != #Admin and u.employeeId != employeeId) {
          return null;
        };
        Lib.getIncentiveBonusSheet(incentiveBonusSheets, employeeId, quarter, year);
      };
    };
  };

  /// Employee self-view: Fetch own incentive/bonus sheet for a specific quarter/year.
  public shared query ({ caller }) func getMyIncentiveBonusSheet(
    quarter : Nat,
    year    : Nat,
  ) : async ?Types.IncentiveBonusSheet {
    let token = caller.toText();
    switch (peaGetSessionUser(token)) {
      case null { null };
      case (?u) {
        Lib.getIncentiveBonusSheet(incentiveBonusSheets, u.employeeId, quarter, year);
      };
    };
  };

  /// HR/Admin: Get incentive/bonus sheets matching filter.
  public shared query ({ caller }) func getAllIncentiveBonusSheets(
    filter : Types.IncentiveBonusSheetFilter,
  ) : async [Types.IncentiveBonusSheet] {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) { return [] };
    Lib.getAllIncentiveBonusSheets(incentiveBonusSheets, filter);
  };

  /// HR/Admin: Mark an incentive/bonus sheet as Paid.
  public shared ({ caller }) func markIncentiveBonusSheetPaid(
    sheetId     : Text,
    paymentDate : Int,
  ) : async { #ok; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    Lib.markIncentiveBonusSheetPaid(incentiveBonusSheets, sheetId, paymentDate, token);
  };

  /// HR/Admin: Add a bonus entry to an incentive/bonus sheet.
  public shared ({ caller }) func addBonusEntry(
    sheetId : Text,
    entry   : Types.BonusEntry,
  ) : async { #ok; #err : Text } {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) {
      return #err("Unauthorized: HR or Admin access required");
    };
    Lib.addBonusEntry(incentiveBonusSheets, sheetId, entry);
  };

  /// System/Admin: Refresh DueForPayment flags for incentive/bonus sheets.
  public shared ({ caller }) func refreshIncentiveBonusSheetStatus() : async () {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) { return };
    Lib.refreshIncentiveBonusSheetStatus(incentiveBonusSheets, Time.now());
  };

  // ── Working Style ──────────────────────────────────────────────────────────

  /// MR (or higher authority with MR charge): Submit today's working style.
  /// Rejected if already submitted today for this employee.
  public shared func submitWorkingStyle(
    input : Types.SubmitWorkingStyleInput,
  ) : async { #ok : Text; #err : Text } {
    let token = input.token;
    switch (peaGetSessionUser(token)) {
      case null { return #err("Unauthorized: session not found") };
      case (?submitter) {
        // When WorkingWith, resolve higher authority user record via userId (Nat)
        // workingWithUserId is the numeric UserId stored as Text (e.g. "42")
        let haUserOpt : ?(AuthTypes.UserId, AuthTypes.UserRecord) = switch (input.workingWithUserId) {
          case null { null };
          case (?wid) {
            if (wid == "") { null }
            else {
              switch (Nat.fromText(wid)) {
                case null {
                  // Non-numeric userId — return clear error immediately
                  return #err("Invalid higher authority ID: '" # wid # "' is not a valid user ID");
                };
                case (?uid) {
                  switch (users.get(uid)) {
                    case null {
                      return #err("Higher authority not found: no user with ID " # wid);
                    };
                    case (?haUser) { ?(uid, haUser) };
                  }
                };
              }
            }
          };
        };
        let withName : ?Text = switch (haUserOpt) {
          case null { null };
          case (?(_, haUser)) { ?haUser.name };
        };
        let id = genWorkingStyleId();
        let now = Time.now();
        let dayStart : Int = input.date - (input.date % 86_400_000_000_000);
        // Check duplicate for the submitter
        let dup = workingStyleRecords.find(func(r) {
          r.employeeId == input.employeeId and
          (r.date - (r.date % 86_400_000_000_000)) == dayStart
        });
        switch (dup) {
          case (?_) { #err("Working style already submitted for today") };
          case null {
            let rec : Types.WorkingStyleRecord = {
              id;
              employeeId        = input.employeeId;
              date              = dayStart;
              workingMode       = input.workingMode;
              workingWithUserId = input.workingWithUserId;
              workingWithName   = withName;
              stationSource     = input.stationSource;
              otherStationName  = input.otherStationName;
              submittedAt       = now;
              workingType       = input.workingType;
              additionalArea    = input.additionalArea;
            };
            workingStyleRecords.add(rec);
            // If WorkingWith — auto-create record on the higher authority's working sheet
            // Uses the HA's human-readable employeeId (e.g. "EMP-007") for the record,
            // so their portal queries (which filter by employeeId) pick it up correctly.
            switch (input.workingMode) {
              case (#WorkingWith) {
                switch (haUserOpt) {
                  case null {};
                  case (?(_, haUser)) {
                    let haEmployeeId = haUser.employeeId;
                    // Only add if no record already exists for that authority today
                    let haDup = workingStyleRecords.find(func(r) {
                      r.employeeId == haEmployeeId and
                      (r.date - (r.date % 86_400_000_000_000)) == dayStart
                    });
                    switch (haDup) {
                      case (?_) {};
                      case null {
                        let haId = genWorkingStyleId();
                        let haRec : Types.WorkingStyleRecord = {
                          id               = haId;
                          employeeId       = haEmployeeId;
                          date             = dayStart;
                          workingMode      = #WorkingWith;
                          workingWithUserId = ?submitter.id.toText();
                          workingWithName   = ?submitter.name;
                          stationSource    = input.stationSource;
                          otherStationName = input.otherStationName;
                          submittedAt      = now;
                          workingType      = input.workingType;
                          additionalArea   = input.additionalArea;
                        };
                        workingStyleRecords.add(haRec);
                      };
                    };
                  };
                };
              };
              case (#WorkingAlone) {};
            };
            #ok(id);
          };
        };
      };
    };
  };

  /// MR self-view: Get today's working style record.
  public shared query ({ caller }) func getTodayWorkingStyle(
    employeeId : Text,
  ) : async ?Types.WorkingStyleRecord {
    let token = caller.toText();
    switch (peaGetSessionUser(token)) {
      case null { null };
      case (?_) {
        let now = Time.now();
        let todayStart : Int = now - (now % 86_400_000_000_000);
        Lib.getTodayWorkingStyle(workingStyleRecords, employeeId, todayStart);
      };
    };
  };

  /// Employee self-view: Get own working style history within a date range.
  public shared query ({ caller }) func getWorkingStyleHistory(
    employeeId : Text,
    from       : Int,
    to         : Int,
  ) : async [Types.WorkingStyleRecord] {
    let token = caller.toText();
    switch (peaGetSessionUser(token)) {
      case null { [] };
      case (?u) {
        // Employee can view their own; HR/Admin can view any
        if (u.role != #HRManager and u.role != #Admin and u.employeeId != employeeId) {
          return [];
        };
        Lib.getWorkingStyleHistory(workingStyleRecords, employeeId, from, to);
      };
    };
  };

  /// ASM and above: Get working style history for all subordinates.
  public shared query ({ caller }) func getTeamWorkingStyleHistory(
    managerId : Text,
    from      : Int,
    to        : Int,
  ) : async [Types.WorkingStyleRecord] {
    let token = caller.toText();
    switch (peaGetSessionUser(token)) {
      case null { [] };
      case (?_mgr) {
        // Collect subordinate IDs from manager's userId
        let mgrUid : ?AuthTypes.UserId = switch (Nat.fromText(managerId)) {
          case (?uid) { ?uid };
          case null   { null };
        };
        let subordinateIds : [Text] = switch (mgrUid) {
          case null { [] };
          case (?mid) {
            let subs = users.foldLeft<AuthTypes.UserId, AuthTypes.UserRecord, [Text]>(
              [],
              func(acc, _uid, rec) {
                switch (rec.reportsTo) {
                  case (?rt) {
                    if (rt == mid) { acc.concat([rec.employeeId]) }
                    else { acc }
                  };
                  case null { acc };
                }
              }
            );
            subs;
          };
        };
        Lib.getTeamWorkingStyleHistory(workingStyleRecords, subordinateIds, from, to);
      };
    };
  };

  /// HR/Admin: Get all working style records within a date range.
  public shared query ({ caller }) func getAllWorkingStyleRecords(
    from : Int,
    to   : Int,
  ) : async [Types.WorkingStyleRecord] {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) { return [] };
    Lib.getAllWorkingStyleRecords(workingStyleRecords, from, to);
  };

  /// HR/Admin: Weekly TA/DA summary — all personal expense submissions in a date range.
  /// Returns the raw TaDaExpense records; the frontend aggregates by role.
  /// `from` and `to` are nanosecond timestamps (Int).
  public shared query ({ caller }) func getWeeklyTaDaSummaryByRole(
    from : Int,
    to   : Int,
  ) : async [HRTypes.TaDaExpense] {
    let token = caller.toText();
    if (not peaIsHrOrAdmin(token)) { return [] };
    tadaExpenses.filter(func(e) {
      e.submittedAt >= from and e.submittedAt <= to
    }).toArray();
  };
};
