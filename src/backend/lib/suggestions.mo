import SugTypes "../types/suggestions";
import AuthTypes "../types/auth-users";
import HRCoreTypes "../types/hr-core";
import CommonTypes "../types/common";
import List "mo:core/List";
import Map  "mo:core/Map";
import Time "mo:core/Time";

module {

  // ── Helpers ────────────────────────────────────────────────────────────────

  func roleToText(r : CommonTypes.Role) : Text {
    switch (r) {
      case (#Admin)     "Admin";
      case (#HRManager) "HRManager";
      case (#ZSM)       "ZSM";
      case (#RSM)       "RSM";
      case (#ASM)       "ASM";
      case (#MR)        "MR";
    }
  };

  func leaveTypeToText(t : HRCoreTypes.LeaveType) : Text {
    switch (t) {
      case (#casual)      "CL";
      case (#sick)        "SL";
      case (#unpaid)      "LWP";  // legacy UPL displayed as LWP
      case (#pl)          "PL";
      case (#ml)          "ML";
      case (#lwp)         "LWP";
      case (#co)          "CO";

    }
  };

  // ── Suggestions logic ──────────────────────────────────────────────────────

  /// Create and append a new SuggestionSubmission. Returns the created record.
  public func submitSuggestion(
    submissions  : List.List<SugTypes.SuggestionSubmission>,
    nextId       : { var value : Nat },
    session      : AuthTypes.Session,
    employeeId   : Text,
    input        : SugTypes.SubmitSuggestionInput,
  ) : SugTypes.SuggestionSubmission {
    let sub : SugTypes.SuggestionSubmission = {
      id                    = nextId.value;
      submittedByUserId     = session.userId.toText();
      submittedByName       = session.name;
      submittedByRole       = roleToText(session.role);
      submittedByEmployeeId = employeeId;
      submissionType        = input.submissionType;
      subject               = input.subject;
      description           = input.description;
      priority              = input.priority;
      attachmentUrl         = input.attachmentUrl;
      status                = "Pending";
      submittedAt           = Time.now();
      statusUpdatedAt       = null;
      hrReply               = null;
      hrReplyAt             = null;
      hrReplyByName         = null;
      closingRemark         = null;
      isReadByHR            = false;
      isReadByEmployee      = true; // submitter has "seen" it
    };
    nextId.value += 1;
    submissions.add(sub);
    sub
  };

  /// HR/Admin updates the status of a submission.
  /// Returns null if not found.
  public func updateSuggestionStatus(
    submissions  : List.List<SugTypes.SuggestionSubmission>,
    input        : SugTypes.UpdateSuggestionStatusInput,
  ) : ?SugTypes.SuggestionSubmission {
    let idx = submissions.findIndex(func(s : SugTypes.SuggestionSubmission) : Bool {
      s.id == input.suggestionId
    });
    switch (idx) {
      case null { null };
      case (?i) {
        let old = submissions.at(i);
        let updated : SugTypes.SuggestionSubmission = {
          old with
          status          = input.status;
          statusUpdatedAt = ?Time.now();
          closingRemark   = switch (input.remark) { case (?r) ?r; case null old.closingRemark };
          isReadByEmployee = false; // employee needs to see the status change
        };
        submissions.put(i, updated);
        ?updated
      };
    }
  };

  /// HR/Admin adds a reply to a submission.
  /// Sets isReadByEmployee=false so employee sees the notification badge.
  /// Returns null if not found.
  public func addSuggestionReply(
    submissions  : List.List<SugTypes.SuggestionSubmission>,
    hrName       : Text,
    input        : SugTypes.AddSuggestionReplyInput,
  ) : ?SugTypes.SuggestionSubmission {
    let idx = submissions.findIndex(func(s : SugTypes.SuggestionSubmission) : Bool {
      s.id == input.suggestionId
    });
    switch (idx) {
      case null { null };
      case (?i) {
        let old = submissions.at(i);
        let updated : SugTypes.SuggestionSubmission = {
          old with
          hrReply          = ?input.reply;
          hrReplyAt        = ?Time.now();
          hrReplyByName    = ?hrName;
          isReadByEmployee = false; // employee needs to see the reply
        };
        submissions.put(i, updated);
        ?updated
      };
    }
  };

  /// Return all submissions by the calling user (any role).
  public func getMySubmissions(
    submissions : List.List<SugTypes.SuggestionSubmission>,
    userId      : Nat,
  ) : [SugTypes.SuggestionSubmission] {
    let userIdText = userId.toText();
    submissions.filter(func(s) { s.submittedByUserId == userIdText }).toArray()
  };

  /// Return all submissions filtered by optional SuggestionFilter (HR/Admin).
  public func getAllSubmissions(
    submissions : List.List<SugTypes.SuggestionSubmission>,
    filter      : ?SugTypes.SuggestionFilter,
  ) : [SugTypes.SuggestionSubmission] {
    let arr = submissions.toArray();
    switch (filter) {
      case null { arr };
      case (?f) {
        arr.filter(func(s : SugTypes.SuggestionSubmission) : Bool {
          let roleOk = switch (f.submittedByRole) {
            case null { true };
            case (?r) { s.submittedByRole == r };
          };
          let typeOk = switch (f.submissionType) {
            case null { true };
            case (?t) { s.submissionType == t };
          };
          let priOk = switch (f.priority) {
            case null { true };
            case (?p) { s.priority == p };
          };
          let statusOk = switch (f.status) {
            case null  { true };
            case (?st) { s.status == st };
          };
          let nameOk = switch (f.employeeName) {
            case null { true };
            case (?n) {
              s.submittedByName.toLower().contains(#text (n.toLower()))
            };
          };
          let fromOk = switch (f.fromDate) {
            case null  { true };
            case (?fd) { s.submittedAt >= fd };
          };
          let toOk = switch (f.toDate) {
            case null  { true };
            case (?td) { s.submittedAt <= td };
          };
          roleOk and typeOk and priOk and statusOk and nameOk and fromOk and toOk
        })
      };
    }
  };

  /// Count unread submissions for HR (isReadByHR = false).
  public func getUnreadSuggestionCount(
    submissions : List.List<SugTypes.SuggestionSubmission>,
  ) : Nat {
    var count = 0;
    for (s in submissions.values()) {
      if (not s.isReadByHR) { count += 1 };
    };
    count
  };

  /// Mark a set of submissions as read by HR (isReadByHR := true).
  public func markSuggestionsAsRead(
    submissions : List.List<SugTypes.SuggestionSubmission>,
    ids         : [Nat],
  ) {
    submissions.mapInPlace(func(s : SugTypes.SuggestionSubmission) : SugTypes.SuggestionSubmission {
      let shouldMark = ids.find(func(n : Nat) : Bool { n == s.id }) != null;
      if (shouldMark and not s.isReadByHR) {
        { s with isReadByHR = true }
      } else {
        s
      }
    })
  };

  /// Count submissions belonging to this user where isReadByEmployee = false
  /// (i.e. HR has replied or changed status since the user last checked).
  public func getUnreadReplyCount(
    submissions : List.List<SugTypes.SuggestionSubmission>,
    userId      : Nat,
  ) : Nat {
    let userIdText = userId.toText();
    var count = 0;
    for (s in submissions.values()) {
      if (s.submittedByUserId == userIdText and not s.isReadByEmployee) {
        count += 1;
      };
    };
    count
  };

  // ── On-Leave visibility logic ──────────────────────────────────────────────

  /// Return today's ISO date string "YYYY-MM-DD" derived from nanoseconds.
  public func todayIso() : Text {
    let now : Int = Time.now();
    let secs : Int = now / 1_000_000_000;
    let days : Int = secs / 86400;
    let z    : Int = days + 719468;
    let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe  : Int = z - era * 146097;
    let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y    : Int = yoe + era * 400;
    let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp   : Int = (5 * doy + 2) / 153;
    let d    : Int = doy - (153 * mp + 2) / 5 + 1;
    let m    : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr   : Int = if (m <= 2) y + 1 else y;
    let ys = yr.toText();
    let ms = if (m < 10) "0" # m.toText() else m.toText();
    let ds = if (d < 10) "0" # d.toText() else d.toText();
    ys # "-" # ms # "-" # ds
  };

  /// Return true when `today` falls within [fromDate, toDate] (all ISO strings).
  func isOnLeaveToday(fromDate : Text, toDate : Text, today : Text) : Bool {
    fromDate <= today and today <= toDate
  };

  /// Resolve the display name for the approver of a leave application.
  func approverName(
    users      : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    approverId : ?Nat,
  ) : Text {
    switch (approverId) {
      case null { "" };
      case (?aid) {
        switch (users.get(aid)) {
          case (?u) { u.name };
          case null { "" };
        }
      };
    }
  };

  /// Build the list of employees who are on approved leave today,
  /// scoped by the requesting user's role and hierarchy.
  ///
  /// Visibility rules:
  ///   MR        — peer MRs in the same area (same reportsTo manager)
  ///   ASM       — direct subordinate MRs
  ///   RSM       — ASMs and MRs under them
  ///   ZSM       — RSMs, ASMs, MRs under them
  ///   HR/Admin  — entire organisation
  public func getOnLeaveEmployeesForUser(
    leaves    : List.List<HRCoreTypes.LeaveApplication>,
    users     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    userId    : AuthTypes.UserId,
  ) : [SugTypes.OnLeaveEmployee] {
    let today = todayIso();

    // Collect IDs that are visible to this user
    let visibleIds : List.List<Nat> = List.empty();

    switch (users.get(userId)) {
      case null { return [] };
      case (?me) {
        switch (me.role) {
          case (#Admin or #HRManager) {
            // All users
            for ((_uid, u) in users.entries()) {
              visibleIds.add(u.id);
            };
          };

          case (#ZSM) {
            // RSMs, ASMs, MRs that directly or indirectly report upward to this ZSM.
            // Collect immediate reports (RSMs), their reports (ASMs), and their reports (MRs).
            for ((_uid, u) in users.entries()) {
              switch (u.reportsTo) {
                case (?mid) {
                  if (mid == userId) {
                    // direct report (RSM)
                    visibleIds.add(u.id);
                    // RSM's subordinates (ASMs)
                    for ((_uid2, u2) in users.entries()) {
                      switch (u2.reportsTo) {
                        case (?mid2) {
                          if (mid2 == u.id) {
                            visibleIds.add(u2.id);
                            // ASM's subordinates (MRs)
                            for ((_uid3, u3) in users.entries()) {
                              switch (u3.reportsTo) {
                                case (?mid3) {
                                  if (mid3 == u2.id) { visibleIds.add(u3.id) };
                                };
                                case null {};
                              };
                            };
                          };
                        };
                        case null {};
                      };
                    };
                  };
                };
                case null {};
              };
            };
          };

          case (#RSM) {
            // ASMs and their MRs
            for ((_uid, u) in users.entries()) {
              switch (u.reportsTo) {
                case (?mid) {
                  if (mid == userId) {
                    // direct ASM
                    visibleIds.add(u.id);
                    // ASM's MRs
                    for ((_uid2, u2) in users.entries()) {
                      switch (u2.reportsTo) {
                        case (?mid2) {
                          if (mid2 == u.id) { visibleIds.add(u2.id) };
                        };
                        case null {};
                      };
                    };
                  };
                };
                case null {};
              };
            };
          };

          case (#ASM) {
            // Direct subordinate MRs only
            for ((_uid, u) in users.entries()) {
              switch (u.reportsTo) {
                case (?mid) { if (mid == userId) { visibleIds.add(u.id) } };
                case null {};
              };
            };
          };

          case (#MR) {
            // Peer MRs: share the same direct manager (reportsTo)
            switch (me.reportsTo) {
              case null {};
              case (?myManager) {
                for ((_uid, u) in users.entries()) {
                  if (u.id != userId and u.role == #MR) {
                    switch (u.reportsTo) {
                      case (?theirManager) {
                        if (theirManager == myManager) { visibleIds.add(u.id) };
                      };
                      case null {};
                    };
                  };
                };
              };
            };
          };
        };
      };
    };

    // Build result from approved leaves that overlap today
    let result : List.List<SugTypes.OnLeaveEmployee> = List.empty();
    for (leave in leaves.values()) {
      if (
        leave.status == #approved and
        isOnLeaveToday(leave.fromDate, leave.toDate, today) and
        visibleIds.find(func(id : Nat) : Bool { id == leave.employeeId }) != null
      ) {
        switch (users.get(leave.employeeId)) {
          case null {};
          case (?emp) {
            result.add({
              employeeId     = emp.employeeId;
              employeeName   = emp.name;
              role           = roleToText(emp.role);
              leaveType      = leaveTypeToText(leave.leaveType);
              fromDate       = leave.fromDate;
              toDate         = leave.toDate;
              leaveId        = leave.id;
              reason         = leave.reason;
              approvedByName = approverName(users, leave.approvedBy);
              approvedAt     = null; // approvedAt timestamp not stored in LeaveApplication
            });
          };
        };
      };
    };
    result.toArray()
  };

};
