module {
  // ── Admin Message ─────────────────────────────────────────────────────────

  /// A message created by Admin or HR to be shown as a popup to all users
  /// on their first login of each day.
  public type AdminMessage = {
    id             : Text;             // UUID-style unique ID
    title          : Text;
    content        : Text;
    attachmentUrls : [Text];           // object-storage URLs for images/videos/documents
    isActive       : Bool;
    createdAt      : Int;              // nanoseconds from Time.now()
    createdBy      : Text;             // userId (as Text) of creator
    scheduledDate  : ?Text;            // optional "YYYY-MM-DD" to show on a specific date only
    dismissedBy    : [DismissalRecord]; // per-user daily dismissal records
  };

  /// Tracks that a specific user dismissed the message on a specific date
  public type DismissalRecord = {
    userId : Text;   // user ID as Text
    date   : Text;   // "YYYY-MM-DD"
  };

  /// Input for creating a new admin message
  public type CreateAdminMessageInput = {
    title          : Text;
    content        : Text;
    attachmentUrls : [Text];
    scheduledDate  : ?Text;
  };

  /// Input for updating an existing admin message
  public type UpdateAdminMessageInput = {
    id             : Text;
    title          : ?Text;
    content        : ?Text;
    attachmentUrls : ?[Text];
    isActive       : ?Bool;
    scheduledDate  : ?Text;
  };

  /// Public/shared view of AdminMessage (immutable fields, no `var`)
  public type AdminMessageInfo = {
    id             : Text;
    title          : Text;
    content        : Text;
    attachmentUrls : [Text];
    isActive       : Bool;
    createdAt      : Int;
    createdBy      : Text;
    scheduledDate  : ?Text;
  };

  public type MutationResult = {
    #ok;
    #err : Text;
  };
};
