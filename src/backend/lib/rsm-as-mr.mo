import List      "mo:core/List";
import Map       "mo:core/Map";
import Types     "../types/rsm-as-mr";
import ACTypes   "../types/additional-charge";
import AuthTypes "../types/auth-users";
import NotifTypes "../types/notifications";

/// Domain logic for RSM acting as MR.
/// All functions are pure helpers — state is injected by callers.
module {

  // ── Query: active MR additional role ──────────────────────────────────────

  /// Return the active AdditionalCharge that assigns an MR role to the given RSM.
  /// Returns null if the RSM has no active MR additional role.
  public func getAdditionalMrRole(
    charges    : List.List<ACTypes.AdditionalCharge>,
    employeeId : Types.UserId,
    now        : Types.Timestamp,
  ) : ?ACTypes.AdditionalCharge {
    charges.find(func(c : ACTypes.AdditionalCharge) : Bool {
      c.employeeId == employeeId and
      c.chargeType == #Role and
      now >= c.effectiveFrom and now <= c.effectiveTo and
      (switch (c.additionalRole) {
        case (? #MR) { true };
        case _       { false };
      })
    })
  };

  /// Build the RsmMrModeConfig from an active MR-role AdditionalCharge.
  /// Returns null if the charge does not carry MR-mode metadata.
  public func buildRsmMrModeConfig(
    charge : ACTypes.AdditionalCharge,
  ) : ?Types.RsmMrModeConfig {
    let hqId : Text = switch (charge.additionalHqId) {
      case (?hid) { hid.toText() };
      case null   { "0" };
    };
    ?{
      mrTerritoryHqId = hqId;
      gradeLevel      = "MR";
      isActive        = true;
      chargeId        = charge.id;
    }
  };

  // ── Self-approval prevention ───────────────────────────────────────────────

  /// Returns true when the caller (approverId) is the same person as the submitter
  /// operating in MR mode (detects RSM trying to approve their own MR-mode submission).
  /// Used by DCR and MTP approval gates to redirect to ZSM.
  public func isRsmActingAsMr(
    charges     : List.List<ACTypes.AdditionalCharge>,
    approverId  : Types.UserId,
    submitterId : Types.UserId,
    now         : Types.Timestamp,
  ) : Bool {
    if (approverId != submitterId) { return false };
    switch (getAdditionalMrRole(charges, submitterId, now)) {
      case (?_) { true };
      case null { false };
    }
  };

  // ── Approval routing ──────────────────────────────────────────────────────

  /// Resolve the correct MTP/DCR approver when an RSM submits in MR mode.
  /// Walks the reportsTo chain above the RSM to find the first non-RSM authority.
  /// Returns null if no such authority is found.
  public func getMrModeApprover(
    users : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    rsmId : Types.UserId,
  ) : ?Types.UserId {
    var current : ?AuthTypes.UserId = switch (users.get(rsmId)) {
      case (?u) { u.reportsTo };
      case null { null };
    };
    var depth = 0;
    label walk loop {
      if (depth > 10) { break walk };
      switch (current) {
        case null { break walk };
        case (?mid) {
          if (mid != rsmId) { return ?mid };
          current := switch (users.get(mid)) {
            case (?u) { u.reportsTo };
            case null { null };
          };
          depth += 1;
        };
      };
    };
    null
  };

  // ── Notifications ─────────────────────────────────────────────────────────

  /// Build in-app notifications when an RSM is assigned the MR Additional Role.
  /// Returns up to two NotificationRecords: one for the RSM, one for the ZSM.
  /// Caller must store them in the notifications map.
  public func buildMrAssignmentNotifications(
    payload    : Types.RsmMrAssignmentNotification,
    notifIdRef : { var value : Nat },
    now        : Types.Timestamp,
  ) : [NotifTypes.NotificationRecord] {
    let result = List.empty<NotifTypes.NotificationRecord>();

    let rsmNid = "mrmode_rsm_" # now.toText() # "_" # notifIdRef.value.toText();
    notifIdRef.value += 1;
    result.add({
      id                = rsmNid;
      recipientId       = payload.rsmId.toText();
      senderId          = "system";
      notificationType  = #mrModeAssigned;
      title             = "MR Additional Role Assigned";
      body              = "You have been assigned an Additional Role of MR for territory " #
                          payload.territoryName # ", effective " # payload.startDate #
                          ". Switch to MR mode from your dashboard to begin field activities.";
      isRead            = false;
      relatedEntityId   = null;
      relatedEntityType = ?"additionalCharge";
      createdAt         = now;
    });

    switch (payload.zsmId) {
      case null {};
      case (?zid) {
        let zsmNid = "mrmode_zsm_" # now.toText() # "_" # notifIdRef.value.toText();
        notifIdRef.value += 1;
        result.add({
          id                = zsmNid;
          recipientId       = zid.toText();
          senderId          = "system";
          notificationType  = #mrModeAssigned;
          title             = "RSM Assigned as Acting MR";
          body              = payload.rsmName # " has been assigned as Acting MR for territory " #
                              payload.territoryName # " from " # payload.startDate #
                              ". Their MR-mode activity and approvals will be routed to you.";
          isRead            = false;
          relatedEntityId   = null;
          relatedEntityType = ?"additionalCharge";
          createdAt         = now;
        });
      };
    };

    result.toArray()
  };

  /// Build an in-app notification for the ZSM when an RSM submits a DCR in MR mode.
  /// Returns a single NotificationRecord. Caller must store it.
  public func buildRsmMrDcrNotification(
    zsmId         : Types.UserId,
    rsmName       : Text,
    territoryName : Text,
    date          : Text,
    notifIdRef    : { var value : Nat },
    now           : Types.Timestamp,
  ) : NotifTypes.NotificationRecord {
    let nid = "mrmode_dcr_" # now.toText() # "_" # notifIdRef.value.toText();
    notifIdRef.value += 1;
    {
      id                = nid;
      recipientId       = zsmId.toText();
      senderId          = "system";
      notificationType  = #mrModeDcrSubmitted;
      title             = "Acting MR DCR Submitted";
      body              = rsmName # " (Acting MR) has submitted their DCR for " #
                          territoryName # " on " # date # ".";
      isRead            = false;
      relatedEntityId   = null;
      relatedEntityType = ?"dcr";
      createdAt         = now;
    }
  };

  // ── MrModeContext helpers ─────────────────────────────────────────────────

  /// Build an MrModeContext for tagging submissions made in MR mode.
  public func buildMrModeContext(
    mrTerritoryHqId     : Text,
    submitterEmployeeId : Types.UserId,
  ) : Types.MrModeContext {
    {
      roleContext          = "RSM_ACTING_MR";
      mrTerritoryHqId;
      submitterEmployeeId = submitterEmployeeId.toText();
    }
  };

  /// Encode an MrModeContext as a compact Text tag for embedding in notes/remarks fields.
  /// Format: "[MR_MODE|hq=<hqId>|emp=<empId>]"
  public func encodeMrModeContextTag(ctx : Types.MrModeContext) : Text {
    "[MR_MODE|hq=" # ctx.mrTerritoryHqId # "|emp=" # ctx.submitterEmployeeId # "]"
  };

  /// Decode an MrModeContext from an encoded tag string.
  /// Returns null if the text does not contain a valid MR_MODE tag.
  public func decodeMrModeContextTag(tag : Text) : ?Types.MrModeContext {
    if (not containsSubstring(tag, "[MR_MODE|")) { return null };
    let hqId  = extractField(tag, "hq=");
    let empId = extractField(tag, "emp=");
    switch (hqId, empId) {
      case (?hq, ?emp) {
        ?{
          roleContext          = "RSM_ACTING_MR";
          mrTerritoryHqId     = hq;
          submitterEmployeeId = emp;
        }
      };
      case _ { null };
    }
  };

  // ── Private text helpers ─────────────────────────────────────────────────

  private func containsSubstring(haystack : Text, needle : Text) : Bool {
    let hChars = haystack.toArray();
    let nChars = needle.toArray();
    let hLen   = hChars.size();
    let nLen   = nChars.size();
    if (nLen == 0) { return true };
    if (nLen > hLen) { return false };
    var i = 0;
    while (i + nLen <= hLen) {
      var match = true;
      var j = 0;
      while (j < nLen) {
        if (hChars[i + j] != nChars[j]) { match := false };
        j += 1;
      };
      if (match) { return true };
      i += 1;
    };
    false
  };

  private func extractField(text : Text, key : Text) : ?Text {
    let chars  = text.toArray();
    let kChars = key.toArray();
    let tLen   = chars.size();
    let kLen   = kChars.size();
    if (kLen == 0 or tLen < kLen) { return null };
    var i = 0;
    var keyStart : ?Nat = null;
    label findKey while (i + kLen <= tLen) {
      var match = true;
      var j = 0;
      while (j < kLen) {
        if (chars[i + j] != kChars[j]) { match := false };
        j += 1;
      };
      if (match) { keyStart := ?(i + kLen); break findKey };
      i += 1;
    };
    switch (keyStart) {
      case null { null };
      case (?start) {
        var end = start;
        while (end < tLen and chars[end] != '|' and chars[end] != ']') {
          end += 1;
        };
        if (end == start) { null }
        else {
          var val = "";
          var k = start;
          while (k < end) {
            val := val # chars[k].toText();
            k += 1;
          };
          ?val
        }
      };
    }
  };
};
