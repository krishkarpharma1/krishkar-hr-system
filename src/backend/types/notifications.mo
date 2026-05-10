module {

  // ── Notification record ───────────────────────────────────────────────────

  /// The type of event that generated this notification
  public type NotificationType = {
    #doctorCallSubmitted;
    #doctorCallBatch;
    #absenceWarningDay1;
    #absenceWarningDay2;
    #autoInactivated;
    #reactivated;
    #birthday;
    #dcrReminder;         // DCR not submitted by deadline
    #mtpReminder;         // MTP not submitted before monthly deadline
    #mrModeAssigned;      // RSM assigned as Acting MR for a territory
    #mrModeDcrSubmitted;  // RSM (Acting MR) submitted a DCR — notifies ZSM
  };

  /// A single in-app notification stored in the backend inbox
  public type NotificationRecord = {
    id                : Text;
    recipientId       : Text;   // stringified UserId of the manager receiving this
    senderId          : Text;   // stringified UserId of MR or "system"
    notificationType  : NotificationType;
    title             : Text;
    body              : Text;
    isRead            : Bool;
    relatedEntityId   : ?Text;  // callReport id or employee id for deep linking
    relatedEntityType : ?Text;  // "doctorCall" | "employee"
    createdAt         : Int;    // nanoseconds
  };

  // ── Notification settings (Admin-configurable) ─────────────────────────────

  /// Global notification configuration managed by Admin
  public type NotificationSettings = {
    doctorCallNotificationsEnabled : Bool;   // default true
    cascadeLevel                   : Text;   // "asm_only" | "asm_rsm" | "asm_rsm_zsm" | "all_levels"
    batchingEnabled                : Bool;   // default true
    batchWindowSeconds             : Nat;    // default 300 (5 minutes)
    batchMinCount                  : Nat;    // default 3 — batch if 3+ calls in window
    quietHoursEnabled              : Bool;   // default false
    quietHoursStart                : Text;   // default "22:00" (24-hr)
    quietHoursEnd                  : Text;   // default "07:00" (24-hr)
  };

  // ── Pending batch (for batching detection) ────────────────────────────────

  /// Tracks recent calls from one MR for batch-notification logic
  public type PendingBatch = {
    mrId        : Text;
    mrName      : Text;
    callIds     : [Text];
    firstCallAt : Int;   // nanoseconds
    lastCallAt  : Int;   // nanoseconds
  };

  /// SFA-specific reminder settings (DCR and MTP deadline reminders)
  public type SfaReminderSettings = {
    dcrReminderHour               : Nat;   // hour in 24h format to send DCR reminder (default 21)
    dcrReminderEnabled            : Bool;  // enable/disable DCR reminder (default true)
    mtpDeadlineDay                : Nat;   // day of month for MTP submission deadline (default 25)
    mtpReminderDaysBeforeDeadline : Nat;   // days before deadline to send reminder (default 3)
    mtpReminderEnabled            : Bool;  // enable/disable MTP reminder (default true)
  };
};
