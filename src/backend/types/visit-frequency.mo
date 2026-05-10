module {
  public type DoctorTier = { #a; #b; #c };

  /// Monthly visit target per tier, Admin-configurable.
  public type VisitFrequencyTarget = {
    tier               : DoctorTier;
    monthlyVisitTarget : Nat;
  };

  /// System-wide visit frequency configuration (set by Admin).
  public type VisitFrequencyConfig = {
    tierA : Nat;   // monthly target for A-tier doctors
    tierB : Nat;   // monthly target for B-tier doctors
    tierC : Nat;   // monthly target for C-tier doctors
  };

  /// Per-doctor visit frequency compliance row.
  public type DoctorVisitFrequencyRow = {
    doctorId         : Nat;
    doctorName       : Text;
    tier             : DoctorTier;
    plannedVisits    : Nat;  // from MTP for the month
    actualVisits     : Nat;  // from submitted call reports
    target           : Nat;  // tier-based monthly target
    compliancePct    : Float; // actualVisits / target * 100
  };

  /// Full visit frequency report for one MR in one month.
  public type VisitFrequencyReport = {
    mrId    : Nat;
    month   : Nat;
    year    : Nat;
    rows    : [DoctorVisitFrequencyRow];
    overallCompliancePct : Float;
  };

  /// Doctor tier assignment record (stored separately from Doctor master).
  public type DoctorTierAssignment = {
    doctorId  : Nat;
    tier      : DoctorTier;
    updatedAt : Int;
    updatedBy : Nat;
  };
};
