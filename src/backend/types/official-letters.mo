module {
  /// All supported official letter types.
  public type LetterType = {
    #appointmentLetter;
    #experienceLetter;
    #showCauseNotice;
    #confirmationLetter;
    #transferLetter;
    #promotionLetter;
    #incrementLetter;
    #warningLetter;
    #terminationLetter;
  };

  /// Draft or finalized state of an official letter.
  public type LetterStatus = {
    #draft;
    #final;
  };

  /// A log entry recording when a "Send via Email" action was initiated for
  /// an official letter. Appended on every click — never mutated.
  public type EmailInitiationLog = {
    letterRef     : Text;   // Letter reference number at time of action
    initiatedAt   : Int;    // nanoseconds from Time.now()
    initiatedBy   : Text;   // Display name of the user who triggered the action
    initiatedByRole : Text; // Role label e.g. "HR Manager", "Admin"
    action        : Text;   // Free-text label e.g. "Email initiated", "PDF generated"
  };

  /// Letter-type-specific optional fields bundled into a single record so the
  /// core OfficialLetter type stays stable across upgrades.
  public type LetterDetails = {
    // Confirmation Letter
    probationEndDate    : ?Text;
    confirmationDate    : ?Text;
    revisedDesignation  : ?Text;
    revisedSalary       : ?Nat;
    // Transfer Letter
    currentPosting      : ?Text;
    newPosting          : ?Text;
    newHQ               : ?Text;
    transferEffectiveDate : ?Text;
    // Promotion Letter
    currentDesignation  : ?Text;
    newDesignation      : ?Text;
    newGrade            : ?Text;
    promotionEffectiveDate : ?Text;
    promotedSalary      : ?Nat;
    // Increment Letter
    currentSalary       : ?Nat;
    newSalary           : ?Nat;
    incrementAmount     : ?Nat;
    incrementEffectiveDate : ?Text;
    // Warning Letter
    warningReason       : ?Text;
    disciplinaryAction  : ?Text;
    // Termination Letter
    resignationDate     : ?Text;
    lastWorkingDay      : ?Text;
    finalSettlementRef  : ?Text;
  };

  /// Empty LetterDetails – use as default when no type-specific fields are set.
  public let emptyDetails : LetterDetails = {
    probationEndDate       = null;
    confirmationDate       = null;
    revisedDesignation     = null;
    revisedSalary          = null;
    currentPosting         = null;
    newPosting             = null;
    newHQ                  = null;
    transferEffectiveDate  = null;
    currentDesignation     = null;
    newDesignation         = null;
    newGrade               = null;
    promotionEffectiveDate = null;
    promotedSalary         = null;
    currentSalary          = null;
    newSalary              = null;
    incrementAmount        = null;
    incrementEffectiveDate = null;
    warningReason          = null;
    disciplinaryAction     = null;
    resignationDate        = null;
    lastWorkingDay         = null;
    finalSettlementRef     = null;
  };

  /// A company official letter rendered on the company letterhead.
  /// NOTE: letterRefNumber and emailLogs are stored in separate Maps in actor state
  /// (letterRefNumbers and letterEmailLogs) to preserve stable-type compatibility.
  /// The view type OfficialLetterView below combines them for API responses.
  public type OfficialLetter = {
    id            : Nat;
    letterType    : LetterType;  // NEW: type of the official letter
    employeeId    : ?Nat;        // NEW: target employee (null for generic letters)
    employeeName  : ?Text;       // NEW: denormalized for display
    issuedBy      : Nat;         // same as createdBy; kept for SFA API clarity
    issuedAt      : Int;         // same as createdAt
    createdBy     : Nat;   // UserId of creator (Admin or HR)
    recipientName : Text;
    subject       : Text;
    body          : Text;
    date          : Text;  // display date on the letter, e.g. "01 April 2026"
    status        : LetterStatus;
    details       : LetterDetails;  // NEW: type-specific optional fields
    createdAt     : Int;   // nanoseconds from Time.now()
    updatedAt     : Int;   // nanoseconds from Time.now()
  };

  /// Extended view of an official letter that includes email logs and ref number.
  /// Returned by API query endpoints by merging stable Maps at read time.
  public type OfficialLetterView = {
    id            : Nat;
    letterType    : LetterType;
    employeeId    : ?Nat;
    employeeName  : ?Text;
    issuedBy      : Nat;
    issuedAt      : Int;
    createdBy     : Nat;
    recipientName : Text;
    subject       : Text;
    body          : Text;
    date          : Text;
    status        : LetterStatus;
    details       : LetterDetails;
    createdAt     : Int;
    updatedAt     : Int;
    letterRefNumber : ?Text;
    emailLogs       : [EmailInitiationLog];
  };

  /// Input for creating a new official letter.
  public type CreateLetterInput = {
    letterType    : LetterType;
    employeeId    : ?Nat;
    employeeName  : ?Text;
    recipientName : Text;
    subject       : Text;
    body          : Text;
    date          : Text;  // DD-MM-YYYY
    status        : LetterStatus;
    details       : ?LetterDetails;  // pass null to use defaults
  };

  /// Input for updating an existing official letter (all fields optional).
  public type UpdateLetterInput = {
    recipientName : ?Text;
    subject       : ?Text;
    body          : ?Text;
    date          : ?Text;
    status        : ?LetterStatus;
    details       : ?LetterDetails;
  };
};
