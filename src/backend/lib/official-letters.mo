import OLTypes "../types/official-letters";
import CommonTypes "../types/common";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";

module {
  public type OfficialLetter     = OLTypes.OfficialLetter;
  public type OfficialLetterView = OLTypes.OfficialLetterView;
  public type CreateLetterInput  = OLTypes.CreateLetterInput;
  public type UpdateLetterInput  = OLTypes.UpdateLetterInput;
  public type EmailInitiationLog = OLTypes.EmailInitiationLog;
  public type LetterType         = OLTypes.LetterType;
  public type LetterDetails      = OLTypes.LetterDetails;
  public type MutationResult     = CommonTypes.MutationResult;

  // ── Internal helpers ───────────────────────────────────────────────────────

  /// Combine a stored OfficialLetter with its ref number and email logs into a view.
  func toView(
    letter   : OfficialLetter,
    refNums  : Map.Map<Nat, Text>,
    logMap   : Map.Map<Nat, [EmailInitiationLog]>,
  ) : OfficialLetterView {
    {
      id              = letter.id;
      letterType      = letter.letterType;
      employeeId      = letter.employeeId;
      employeeName    = letter.employeeName;
      issuedBy        = letter.issuedBy;
      issuedAt        = letter.issuedAt;
      createdBy       = letter.createdBy;
      recipientName   = letter.recipientName;
      subject         = letter.subject;
      body            = letter.body;
      date            = letter.date;
      status          = letter.status;
      details         = letter.details;
      createdAt       = letter.createdAt;
      updatedAt       = letter.updatedAt;
      letterRefNumber = refNums.get(letter.id);
      emailLogs       = switch (logMap.get(letter.id)) { case (?v) v; case null [] };
    }
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  /// Create a new official letter and append it to the list.
  /// If input.status is #final the letter is assigned a ref number immediately.
  public func createLetter(
    letters   : List.List<OfficialLetter>,
    refNums   : Map.Map<Nat, Text>,
    nextId    : { var value : Nat },
    input     : CreateLetterInput,
    userId    : Nat,
    now       : Int,
    refNumber : ?Text,   // pass a pre-generated ref when creating as Final
  ) : MutationResult {
    if (input.recipientName.size() == 0) {
      return #err("Required field missing: Recipient Name");
    };
    if (input.subject.size() == 0) {
      return #err("Required field missing: Subject");
    };
    if (input.body.size() == 0) {
      return #err("Required field missing: Body");
    };
    if (input.date.size() == 0) {
      return #err("Required field missing: Date");
    };

    let id = nextId.value;
    nextId.value += 1;

    let resolvedDetails : OLTypes.LetterDetails = switch (input.details) {
      case (?d) d;
      case null OLTypes.emptyDetails;
    };
    let letter : OfficialLetter = {
      id            = id;
      letterType    = input.letterType;
      employeeId    = input.employeeId;
      employeeName  = input.employeeName;
      issuedBy      = userId;
      issuedAt      = now;
      createdBy     = userId;
      recipientName = input.recipientName;
      subject       = input.subject;
      body          = input.body;
      date          = input.date;
      status        = input.status;
      details       = resolvedDetails;
      createdAt     = now;
      updatedAt     = now;
    };
    letters.add(letter);

    // Store ref number in the side-car map when creating as Final
    switch (input.status) {
      case (#final) {
        switch (refNumber) {
          case (?ref) { refNums.add(id, ref) };
          case null   {};
        };
      };
      case (#draft) {};
    };

    #ok
  };

  /// Update an existing letter by ID. Only the creator may update.
  public func updateLetter(
    letters  : List.List<OfficialLetter>,
    id       : Nat,
    input    : UpdateLetterInput,
    userId   : Nat,
    now      : Int,
  ) : MutationResult {
    switch (letters.findIndex(func(l : OfficialLetter) : Bool { l.id == id })) {
      case null { #err("Letter not found") };
      case (?idx) {
        let letter = letters.at(idx);
        if (letter.createdBy != userId) {
          return #err("Access denied: only the creator may edit this letter");
        };
        if (letter.status == #final) {
          return #err("Cannot edit a finalized letter");
        };

        let newRecipient = switch (input.recipientName) { case (?v) v; case null letter.recipientName };
        let newSubject   = switch (input.subject)       { case (?v) v; case null letter.subject };
        let newBody      = switch (input.body)           { case (?v) v; case null letter.body };
        let newDate      = switch (input.date)           { case (?v) v; case null letter.date };
        let newStatus    = switch (input.status)         { case (?v) v; case null letter.status };
        let newDetails   = switch (input.details)        { case (?v) v; case null letter.details };

        let updated : OfficialLetter = {
          letter with
          recipientName = newRecipient;
          subject       = newSubject;
          body          = newBody;
          date          = newDate;
          status        = newStatus;
          details       = newDetails;
          updatedAt     = now;
        };
        letters.put(idx, updated);
        #ok
      };
    }
  };

  /// Finalize a letter (set status to #final). Validates all required fields are non-empty.
  /// Assigns the provided refNumber to the side-car map if not already set.
  public func finalizeLetter(
    letters   : List.List<OfficialLetter>,
    refNums   : Map.Map<Nat, Text>,
    id        : Nat,
    userId    : Nat,
    now       : Int,
    refNumber : Text,   // caller must generate and pass the next ref number
  ) : MutationResult {
    switch (letters.findIndex(func(l : OfficialLetter) : Bool { l.id == id })) {
      case null { #err("Letter not found") };
      case (?idx) {
        let letter = letters.at(idx);
        if (letter.createdBy != userId) {
          return #err("Access denied: only the creator may finalize this letter");
        };
        if (letter.status == #final) {
          return #err("Letter is already finalized");
        };
        if (letter.recipientName.size() == 0) {
          return #err("Cannot finalize: Recipient Name is required");
        };
        if (letter.subject.size() == 0) {
          return #err("Cannot finalize: Subject is required");
        };
        if (letter.body.size() == 0) {
          return #err("Cannot finalize: Body is required");
        };
        if (letter.date.size() == 0) {
          return #err("Cannot finalize: Date is required");
        };

        // Only assign ref number if not already present
        switch (refNums.get(id)) {
          case null  { refNums.add(id, refNumber) };
          case (?_)  {};
        };

        let finalized : OfficialLetter = {
          letter with
          status    = #final;
          updatedAt = now;
        };
        letters.put(idx, finalized);
        #ok
      };
    }
  };

  /// Delete a letter by ID. Only the creator may delete.
  public func deleteLetter(
    letters : List.List<OfficialLetter>,
    refNums : Map.Map<Nat, Text>,
    logMap  : Map.Map<Nat, [EmailInitiationLog]>,
    id      : Nat,
    userId  : Nat,
  ) : MutationResult {
    switch (letters.findIndex(func(l : OfficialLetter) : Bool { l.id == id })) {
      case null { #err("Letter not found") };
      case (?idx) {
        let letter = letters.at(idx);
        if (letter.createdBy != userId) {
          return #err("Access denied: only the creator may delete this letter");
        };
        let remaining = letters.filter(func(l : OfficialLetter) : Bool { l.id != id });
        letters.clear();
        letters.append(remaining);
        // Clean up side-car maps
        refNums.remove(id);
        logMap.remove(id);
        #ok
      };
    }
  };

  /// Append an EmailInitiationLog entry to the specified letter's log map.
  public func addEmailLog(
    letters  : List.List<OfficialLetter>,
    logMap   : Map.Map<Nat, [EmailInitiationLog]>,
    id       : Nat,
    logEntry : EmailInitiationLog,
  ) : MutationResult {
    // Verify the letter exists
    let exists = letters.any(func(l : OfficialLetter) : Bool { l.id == id });
    if (not exists) { return #err("Letter not found") };

    let existing : [EmailInitiationLog] = switch (logMap.get(id)) {
      case (?arr) arr;
      case null   [];
    };
    // Append the new entry by creating a new array
    let appended : [EmailInitiationLog] = existing.concat([logEntry]);
    logMap.add(id, appended);
    #ok
  };

  // ── Reference number helper ────────────────────────────────────────────────

  /// Generate the next sequential letter reference number in the format
  /// HR/YYYY/NNNNN, e.g. "HR/2026/00123".
  public func buildRefNumber(year : Nat, seq : Nat) : Text {
    let seqText = seq.toText();
    let padded = if      (seq < 10)    "0000" # seqText
                 else if (seq < 100)   "000"  # seqText
                 else if (seq < 1000)  "00"   # seqText
                 else if (seq < 10000) "0"    # seqText
                 else                  seqText;
    "HR/" # year.toText() # "/" # padded
  };

  // ── Queries ────────────────────────────────────────────────────────────────

  /// Returns all letters created by the given user (as views).
  public func getMyLetters(
    letters : List.List<OfficialLetter>,
    refNums : Map.Map<Nat, Text>,
    logMap  : Map.Map<Nat, [EmailInitiationLog]>,
    userId  : Nat,
  ) : [OfficialLetterView] {
    letters
      .filter(func(l : OfficialLetter) : Bool { l.createdBy == userId })
      .map<OfficialLetter, OfficialLetterView>(func(l : OfficialLetter) : OfficialLetterView {
        toView(l, refNums, logMap)
      })
      .toArray()
  };

  /// Returns all letters (for Admin/HR listing).
  public func getAllLetters(
    letters : List.List<OfficialLetter>,
    refNums : Map.Map<Nat, Text>,
    logMap  : Map.Map<Nat, [EmailInitiationLog]>,
  ) : [OfficialLetterView] {
    letters
      .map<OfficialLetter, OfficialLetterView>(func(l : OfficialLetter) : OfficialLetterView {
        toView(l, refNums, logMap)
      })
      .toArray()
  };

  /// Returns all letters addressed to the given employee (by employeeId).
  public func getLettersByEmployee(
    letters    : List.List<OfficialLetter>,
    refNums    : Map.Map<Nat, Text>,
    logMap     : Map.Map<Nat, [EmailInitiationLog]>,
    employeeId : Nat,
  ) : [OfficialLetterView] {
    letters
      .filter(func(l : OfficialLetter) : Bool {
        switch (l.employeeId) { case (?eid) Nat.equal(eid, employeeId); case null false }
      })
      .map<OfficialLetter, OfficialLetterView>(func(l : OfficialLetter) : OfficialLetterView {
        toView(l, refNums, logMap)
      })
      .toArray()
  };

  /// Returns all letters of a given type.
  public func getLettersByType(
    letters    : List.List<OfficialLetter>,
    refNums    : Map.Map<Nat, Text>,
    logMap     : Map.Map<Nat, [EmailInitiationLog]>,
    letterType : LetterType,
  ) : [OfficialLetterView] {
    letters
      .filter(func(l : OfficialLetter) : Bool { l.letterType == letterType })
      .map<OfficialLetter, OfficialLetterView>(func(l : OfficialLetter) : OfficialLetterView {
        toView(l, refNums, logMap)
      })
      .toArray()
  };
};
