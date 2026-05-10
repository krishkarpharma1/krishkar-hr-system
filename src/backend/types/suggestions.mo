module {
  /// A single suggestion, query, complaint, feedback, or other submission
  /// from any employee across all portals.
  public type SuggestionSubmission = {
    id                 : Nat;
    submittedByUserId  : Text;     // stringified UserId
    submittedByName    : Text;
    submittedByRole    : Text;     // "MR" | "ASM" | "RSM" | "ZSM" | "HRManager" | "Admin"
    submittedByEmployeeId : Text;
    submissionType     : Text;     // "Suggestion" | "Query" | "Complaint" | "Feedback" | "Other"
    subject            : Text;
    description        : Text;
    priority           : Text;     // "Normal" | "Urgent"
    attachmentUrl      : ?Text;
    status             : Text;     // "Pending" | "Under Review" | "Resolved" | "Closed"
    submittedAt        : Int;      // nanoseconds
    statusUpdatedAt    : ?Int;
    hrReply            : ?Text;
    hrReplyAt          : ?Int;
    hrReplyByName      : ?Text;
    closingRemark      : ?Text;
    isReadByHR         : Bool;     // false on submission; true once HR opens it
    isReadByEmployee   : Bool;     // false when HR replies/updates status; true once employee views it
  };

  /// Input record for submitting a new suggestion / query.
  public type SubmitSuggestionInput = {
    submissionType : Text;
    subject        : Text;
    description    : Text;
    priority       : Text;
    attachmentUrl  : ?Text;
  };

  /// Input record for HR/Admin updating the status of a submission.
  public type UpdateSuggestionStatusInput = {
    suggestionId   : Nat;
    status         : Text;   // "Under Review" | "Resolved" | "Closed"
    remark         : ?Text;  // closing remark (optional)
  };

  /// Input record for HR/Admin adding a written reply to a submission.
  public type AddSuggestionReplyInput = {
    suggestionId : Nat;
    reply        : Text;
  };

  /// Filter parameters for the HR/Admin management view.
  public type SuggestionFilter = {
    submittedByRole : ?Text;
    submissionType  : ?Text;
    priority        : ?Text;
    status          : ?Text;
    employeeName    : ?Text;
    fromDate        : ?Int;  // nanoseconds — inclusive lower bound on submittedAt
    toDate          : ?Int;  // nanoseconds — inclusive upper bound on submittedAt
  };

  /// Lightweight response type returned by getOnLeaveEmployeesForUser.
  /// All date fields are ISO strings ("YYYY-MM-DD") for easy frontend rendering.
  public type OnLeaveEmployee = {
    employeeId     : Text;
    employeeName   : Text;
    role           : Text;
    leaveType      : Text;   // "CL" | "SL" | "UPL"
    fromDate       : Text;
    toDate         : Text;
    leaveId        : Nat;
    reason         : Text;
    approvedByName : Text;
    approvedAt     : ?Int;
  };
};
