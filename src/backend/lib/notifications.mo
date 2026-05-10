import NotifTypes "../types/notifications";
import AuthTypes  "../types/auth-users";
import FieldTypes "../types/field-ops";
import CommonTypes "../types/common";
import Map  "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";

module {

  // ── Helpers ────────────────────────────────────────────────────────────────

  /// Convert a Role variant to short text for cascade comparison
  func roleToText(r : CommonTypes.Role) : Text {
    switch (r) {
      case (#Admin)     "admin";
      case (#HRManager) "hr";
      case (#ZSM)       "zsm";
      case (#RSM)       "rsm";
      case (#ASM)       "asm";
      case (#MR)        "mr";
    }
  };

  /// Parse "HH:MM" into hour:Nat. Returns 0 on parse failure.
  func parseHour(t : Text) : Nat {
    let parts = t.split(#char ':');
    var h : Nat = 0;
    var first = true;
    for (p in parts) {
      if (first) {
        switch (p.toNat()) {
          case (?n) { h := n };
          case null {};
        };
        first := false;
      };
    };
    h
  };

  /// Check whether the current time falls in a quiet window.
  /// If start <= end (e.g. 22:00–23:59) it is a same-night window.
  /// If start > end (e.g. 22:00–07:00) it wraps midnight.
  func isQuietHour(
    settings : NotifTypes.NotificationSettings,
    nowNs    : Int,
  ) : Bool {
    if (not settings.quietHoursEnabled) { return false };
    let nowSecs : Int = nowNs / 1_000_000_000;
    let secondsInDay : Int = nowSecs % 86400;
    let currentHour : Nat = (secondsInDay / 3600).toNat();
    let startH = parseHour(settings.quietHoursStart);
    let endH   = parseHour(settings.quietHoursEnd);
    if (startH <= endH) {
      currentHour >= startH and currentHour < endH
    } else {
      // wraps midnight: quiet from startH to midnight, or from 0 to endH
      currentHour >= startH or currentHour < endH
    }
  };

  // ── Core factory ──────────────────────────────────────────────────────────

  /// Build a NotificationRecord. Does not store it — caller must add to map.
  public func createNotification(
    id                : Text,
    recipientId       : Text,
    senderId          : Text,
    notifType         : NotifTypes.NotificationType,
    title             : Text,
    body              : Text,
    relatedEntityId   : ?Text,
    relatedEntityType : ?Text,
  ) : NotifTypes.NotificationRecord {
    {
      id;
      recipientId;
      senderId;
      notificationType  = notifType;
      title;
      body;
      isRead            = false;
      relatedEntityId;
      relatedEntityType;
      createdAt         = Time.now();
    }
  };

  // ── Read helpers ──────────────────────────────────────────────────────────

  /// Count unread notifications for a recipient.
  public func getUnreadCount(
    recipientId       : Text,
    notificationsMap  : Map.Map<Text, NotifTypes.NotificationRecord>,
  ) : Nat {
    var count : Nat = 0;
    for ((_, n) in notificationsMap.entries()) {
      if (n.recipientId == recipientId and not n.isRead) {
        count += 1;
      };
    };
    count
  };

  /// Return up to 50 most-recent notifications for a recipient, newest first.
  public func getNotificationsForUser(
    recipientId      : Text,
    notificationsMap : Map.Map<Text, NotifTypes.NotificationRecord>,
  ) : [NotifTypes.NotificationRecord] {
    let all : List.List<NotifTypes.NotificationRecord> = List.empty();
    for ((_, n) in notificationsMap.entries()) {
      if (n.recipientId == recipientId) {
        all.add(n);
      };
    };
    // Sort newest first by createdAt (descending)
    let sorted = all.toArray().sort(func(a : NotifTypes.NotificationRecord, b : NotifTypes.NotificationRecord) : { #less; #equal; #greater } {
      if (b.createdAt > a.createdAt) { #less }
      else if (b.createdAt < a.createdAt) { #greater }
      else { #equal }
    });
    if (sorted.size() <= 50) { sorted }
    else { sorted.sliceToArray(0, 50) }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  /// Mark specific notification IDs as read for a recipient.
  public func markAsRead(
    notificationIds  : [Text],
    recipientId      : Text,
    notificationsMap : Map.Map<Text, NotifTypes.NotificationRecord>,
  ) : CommonTypes.MutationResult {
    for (nid in notificationIds.values()) {
      switch (notificationsMap.get(nid)) {
        case (?n) {
          if (n.recipientId == recipientId) {
            notificationsMap.add(nid, { n with isRead = true });
          };
        };
        case null {};
      };
    };
    #ok
  };

  /// Mark all notifications for a recipient as read.
  public func markAllAsRead(
    recipientId      : Text,
    notificationsMap : Map.Map<Text, NotifTypes.NotificationRecord>,
  ) : CommonTypes.MutationResult {
    let toUpdate : List.List<Text> = List.empty();
    for ((k, n) in notificationsMap.entries()) {
      if (n.recipientId == recipientId and not n.isRead) {
        toUpdate.add(k);
      };
    };
    for (k in toUpdate.values()) {
      switch (notificationsMap.get(k)) {
        case (?n) { notificationsMap.add(k, { n with isRead = true }) };
        case null {};
      };
    };
    #ok
  };

  /// Remove all notifications for a recipient.
  public func clearNotifications(
    recipientId      : Text,
    notificationsMap : Map.Map<Text, NotifTypes.NotificationRecord>,
  ) : CommonTypes.MutationResult {
    let toRemove : List.List<Text> = List.empty();
    for ((k, n) in notificationsMap.entries()) {
      if (n.recipientId == recipientId) {
        toRemove.add(k);
      };
    };
    for (k in toRemove.values()) {
      notificationsMap.remove(k);
    };
    #ok
  };

  // ── Doctor Call notification trigger ─────────────────────────────────────

  /// Build a unique notification ID from timestamp + recipientId + suffix
  func makeId(recipientId : Text, suffix : Text) : Text {
    Time.now().toText() # "_" # recipientId # "_" # suffix
  };

  /// Collect the chain of manager user IDs to notify, based on cascade level.
  /// Walks reportsTo starting from the MR's immediate manager (ASM).
  /// Returns list of (userId, role) pairs in ascending hierarchy order.
  func collectManagers(
    mrUser       : AuthTypes.UserRecord,
    users        : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    cascadeLevel : Text,
  ) : [(AuthTypes.UserId, Text)] {
    let result : List.List<(AuthTypes.UserId, Text)> = List.empty();
    // Level 0 = ASM (immediate manager of MR)
    // Level 1 = RSM (ASM's manager)
    // Level 2 = ZSM (RSM's manager)
    // Level 3 = HRManager/Admin (ZSM's manager)
    let maxLevels : Nat = switch (cascadeLevel) {
      case "asm_only"      { 1 };
      case "asm_rsm"       { 2 };
      case "asm_rsm_zsm"   { 3 };
      case "all_levels"    { 4 };
      case _               { 1 }; // default: ASM only
    };
    var currentId : ?AuthTypes.UserId = mrUser.reportsTo;
    var level : Nat = 0;
    label walkUp loop {
      if (level >= maxLevels) { break walkUp };
      switch (currentId) {
        case null { break walkUp };
        case (?mid) {
          switch (users.get(mid)) {
            case null { break walkUp };
            case (?mgr) {
              result.add((mgr.id, roleToText(mgr.role)));
              currentId := mgr.reportsTo;
              level += 1;
            };
          };
        };
      };
    };
    result.toArray()
  };

  /// Core trigger: creates notification records for a single doctor call submission.
  /// Handles batching (if enabled and threshold met) and quiet hours.
  /// Returns the list of new NotificationRecords created (caller must store them).
  public func triggerDoctorCallNotification(
    callReport       : FieldTypes.CallReport,
    mrUser           : AuthTypes.UserRecord,
    doctorName       : Text,
    users            : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    settings         : NotifTypes.NotificationSettings,
    notificationsMap : Map.Map<Text, NotifTypes.NotificationRecord>,
    pendingBatches   : Map.Map<Text, NotifTypes.PendingBatch>,
  ) : [NotifTypes.NotificationRecord] {
    if (not settings.doctorCallNotificationsEnabled) { return [] };

    let nowNs = Time.now();
    if (isQuietHour(settings, nowNs)) { return [] };

    let mrIdText   = mrUser.id.toText();
    let reportId   = callReport.id.toText();
    let managers   = collectManagers(mrUser, users, settings.cascadeLevel);

    if (managers.size() == 0) { return [] };

    // ── Batch detection ──────────────────────────────────────────────────────
    let created : List.List<NotifTypes.NotificationRecord> = List.empty();

    if (settings.batchingEnabled) {
      let windowNs : Int = settings.batchWindowSeconds.toInt() * 1_000_000_000;

      // Upsert the pending batch entry for this MR
      let updatedBatch : NotifTypes.PendingBatch = switch (pendingBatches.get(mrIdText)) {
        case null {
          {
            mrId        = mrIdText;
            mrName      = mrUser.name;
            callIds     = [reportId];
            firstCallAt = nowNs;
            lastCallAt  = nowNs;
          }
        };
        case (?existing) {
          // Expire old batch if outside window
          if (nowNs - existing.firstCallAt > windowNs) {
            // Start fresh
            {
              mrId        = mrIdText;
              mrName      = mrUser.name;
              callIds     = [reportId];
              firstCallAt = nowNs;
              lastCallAt  = nowNs;
            }
          } else {
            {
              existing with
              callIds    = existing.callIds.concat([reportId]);
              lastCallAt = nowNs;
            }
          }
        };
      };
      pendingBatches.add(mrIdText, updatedBatch);

      let callCount = updatedBatch.callIds.size();

      if (callCount >= settings.batchMinCount) {
        // Send a batch notification to each manager in the cascade
        // (but only once — on exactly hitting the threshold, or every subsequent call)
        let isExactThreshold = callCount == settings.batchMinCount;
        if (isExactThreshold) {
          let firstTimeText  = isoMinute(updatedBatch.firstCallAt);
          let lastTimeText   = isoMinute(updatedBatch.lastCallAt);
          for ((mgrId, _) in managers.values()) {
            let recipText = mgrId.toText();
            let n = createNotification(
              makeId(recipText, "batch_" # callCount.toText()),
              recipText,
              mrIdText,
              #doctorCallBatch,
              "Multiple Doctor Calls Submitted",
              mrUser.name # " submitted " # callCount.toText() # " Doctor Calls between " # firstTimeText # " and " # lastTimeText # ". Tap to review.",
              ?mrIdText,
              ?"doctorCall",
            );
            notificationsMap.add(n.id, n);
            created.add(n);
          };
        };
        // For calls beyond threshold: update the batch notification body
        if (callCount > settings.batchMinCount) {
          for ((mgrId, _) in managers.values()) {
            let recipText    = mgrId.toText();
            let firstTimeText = isoMinute(updatedBatch.firstCallAt);
            let lastTimeText  = isoMinute(updatedBatch.lastCallAt);
            // Find and update the existing batch notification for this recipient
            for ((k, n) in notificationsMap.entries()) {
              if (
                n.recipientId == recipText and
                n.senderId    == mrIdText and
                n.notificationType == #doctorCallBatch and
                not n.isRead
              ) {
                let updated = {
                  n with
                  body = mrUser.name # " submitted " # callCount.toText() # " Doctor Calls between " # firstTimeText # " and " # lastTimeText # ". Tap to review.";
                };
                notificationsMap.add(k, updated);
              };
            };
          };
        };
        // Return empty — we handled it above (no individual notification)
        return created.toArray();
      };
    };

    // ── Individual notification ──────────────────────────────────────────────
    let station = switch (callReport.workingStation) {
      case (?s) { s };
      case null { callReport.stationType };
    };

    let bodyText = mrUser.name # " submitted a Doctor Call for Dr. " # doctorName # " at " # station # " on " # callReport.date;

    for ((mgrId, _) in managers.values()) {
      let recipText = mgrId.toText();
      let n = createNotification(
        makeId(recipText, reportId),
        recipText,
        mrIdText,
        #doctorCallSubmitted,
        "New Doctor Call Submitted",
        bodyText,
        ?reportId,
        ?"doctorCall",
      );
      notificationsMap.add(n.id, n);
      created.add(n);
    };

    created.toArray()
  };

  // ── Time formatting helpers ────────────────────────────────────────────────

  /// Format nanosecond timestamp as "HH:MM AM/PM" for notification body text.
  func isoMinute(ns : Int) : Text {
    let secs        : Int = ns / 1_000_000_000;
    let secondsInDay : Int = secs % 86400;
    let h           : Int = secondsInDay / 3600;
    let m           : Int = (secondsInDay % 3600) / 60;
    let ampm        = if (h < 12) "AM" else "PM";
    let h12         : Int = if (h == 0) 12 else if (h > 12) h - 12 else h;
    let ms = if (m < 10) "0" # m.toText() else m.toText();
    h12.toText() # ":" # ms # " " # ampm
  };

};
