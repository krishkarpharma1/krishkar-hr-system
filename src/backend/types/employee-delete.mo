module {
  public type EmployeeDeletionResult = {
    #ok  : { employeeId : Text; archivedAt : Int };
    #err : { code : Text; message : Text };
  };
  public type EmployeeDeletionAuditEntry = {
    deletedEmployeeId    : Text;
    deletedEmployeeName  : Text;
    deletedByUserId      : Text;
    deletedAt            : Int;
    dataArchivedSummary  : Text;
  };
};
