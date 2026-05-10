import AMTypes  "../types/admin-messages";
import List     "mo:core/List";
import Time     "mo:core/Time";

module {
  public type AdminMessage      = AMTypes.AdminMessage;
  public type AdminMessageInfo  = AMTypes.AdminMessageInfo;
  public type DismissalRecord   = AMTypes.DismissalRecord;
  public type CreateAdminMessageInput = AMTypes.CreateAdminMessageInput;
  public type UpdateAdminMessageInput = AMTypes.UpdateAdminMessageInput;
  public type MutationResult    = AMTypes.MutationResult;

  // ── Helpers ────────────────────────────────────────────────────────────────

  /// Generate a simple string ID from a counter + timestamp
  func makeId(counter : Nat) : Text {
    "msg-" # counter.toText() # "-" # Time.now().toText()
  };

  /// Convert an AdminMessage to its shared/public view (no dismissedBy, no var)
  public func toInfo(msg : AdminMessage) : AdminMessageInfo {
    {
      id             = msg.id;
      title          = msg.title;
      content        = msg.content;
      attachmentUrls = msg.attachmentUrls;
      isActive       = msg.isActive;
      createdAt      = msg.createdAt;
      createdBy      = msg.createdBy;
      scheduledDate  = msg.scheduledDate;
    }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /// Create a new AdminMessage. Automatically deactivates any currently active message.
  /// Returns the created message.
  public func createMessage(
    messages  : List.List<AdminMessage>,
    nextId    : Nat,
    createdBy : Text,
    input     : CreateAdminMessageInput,
  ) : AdminMessage {
    // Deactivate any currently active message
    messages.mapInPlace(func(m : AdminMessage) : AdminMessage {
      if (m.isActive) { { m with isActive = false } } else { m }
    });
    let msg : AdminMessage = {
      id             = makeId(nextId);
      title          = input.title;
      content        = input.content;
      attachmentUrls = input.attachmentUrls;
      isActive       = true;
      createdAt      = Time.now();
      createdBy;
      scheduledDate  = input.scheduledDate;
      dismissedBy    = [];
    };
    messages.add(msg);
    msg
  };

  /// Get the currently active admin message.
  /// Returns the most recently created isActive = true message,
  /// filtered by scheduledDate if set.
  public func getActiveMessage(
    messages : List.List<AdminMessage>,
    today    : Text,
  ) : ?AdminMessageInfo {
    // Find the last active message (highest index = most recently created)
    var result : ?AdminMessage = null;
    messages.forEach(func(m : AdminMessage) {
      if (m.isActive) {
        let matchesDate = switch (m.scheduledDate) {
          case (?d)  d == today;
          case null  true;
        };
        if (matchesDate) {
          result := ?m
        }
      }
    });
    switch (result) {
      case (?m) ?toInfo(m);
      case null null;
    }
  };

  /// Get all messages (Admin/HR management view).
  public func getAllMessages(
    messages : List.List<AdminMessage>,
  ) : [AdminMessageInfo] {
    messages.map<AdminMessage, AdminMessageInfo>(func(m) { toInfo(m) }).toArray()
  };

  /// Update an existing message by ID.
  public func updateMessage(
    messages : List.List<AdminMessage>,
    input    : UpdateAdminMessageInput,
  ) : ?AdminMessageInfo {
    var result : ?AdminMessageInfo = null;
    messages.mapInPlace(func(m : AdminMessage) : AdminMessage {
      if (m.id == input.id) {
        let updated : AdminMessage = {
          m with
          title          = switch (input.title)          { case (?v) v;  case null m.title          };
          content        = switch (input.content)        { case (?v) v;  case null m.content        };
          attachmentUrls = switch (input.attachmentUrls) { case (?v) v;  case null m.attachmentUrls };
          isActive       = switch (input.isActive)       { case (?v) v;  case null m.isActive       };
          scheduledDate  = switch (input.scheduledDate)  { case (?v) ?v; case null m.scheduledDate  };
        };
        result := ?toInfo(updated);
        updated
      } else { m }
    });
    result
  };

  /// Deactivate a message (sets isActive = false).
  public func deactivateMessage(
    messages  : List.List<AdminMessage>,
    messageId : Text,
  ) : Bool {
    var found = false;
    messages.mapInPlace(func(m : AdminMessage) : AdminMessage {
      if (m.id == messageId) {
        found := true;
        { m with isActive = false }
      } else { m }
    });
    found
  };

  /// Delete a message by ID.
  public func deleteMessage(
    messages  : List.List<AdminMessage>,
    messageId : Text,
  ) : Bool {
    let before = messages.size();
    let remaining = messages.filter(func(m : AdminMessage) : Bool { m.id != messageId });
    messages.clear();
    messages.append(remaining);
    messages.size() < before
  };

  /// Record that a user dismissed the active message on a given date.
  /// Appends a DismissalRecord to the message's dismissedBy list.
  public func recordDismissal(
    messages  : List.List<AdminMessage>,
    messageId : Text,
    userId    : Text,
    date      : Text,
  ) : Bool {
    var found = false;
    messages.mapInPlace(func(m : AdminMessage) : AdminMessage {
      if (m.id == messageId) {
        found := true;
        let newRecord : DismissalRecord = { userId; date };
        { m with dismissedBy = m.dismissedBy.concat([newRecord]) }
      } else { m }
    });
    found
  };

  /// Check whether a user has already dismissed the given message today.
  public func hasUserSeenToday(
    messages  : List.List<AdminMessage>,
    messageId : Text,
    userId    : Text,
    today     : Text,
  ) : Bool {
    switch (messages.find(func(m : AdminMessage) : Bool { m.id == messageId })) {
      case null false;
      case (?m) {
        m.dismissedBy.any(func(r : DismissalRecord) : Bool {
          r.userId == userId and r.date == today
        })
      };
    }
  };
};
