import List  "mo:core/List";
import Map   "mo:core/Map";
import Set   "mo:core/Set";
import Time  "mo:core/Time";
import Float "mo:core/Float";
import Nat   "mo:core/Nat";
import Types "../types/visit-frequency";
import FieldTypes "../types/field-ops";

/// Domain logic for Visit Frequency Planner (Plan vs Actual per doctor tier).
/// Receives state by reference — no owned state.
module {

  // ── Config management ──────────────────────────────────────────────────────

  /// Upsert system-wide visit frequency targets (Admin only).
  public func setVisitFrequencyTargets(
    config : { var value : Types.VisitFrequencyConfig },
    cfg    : Types.VisitFrequencyConfig,
  ) : () {
    config.value := cfg;
  };

  public func getVisitFrequencyTargets(
    config : { var value : Types.VisitFrequencyConfig },
  ) : Types.VisitFrequencyConfig {
    config.value;
  };

  // ── Tier assignment ────────────────────────────────────────────────────────

  /// Get tier assignment for a doctor. Returns #b if not explicitly set.
  public func getDoctorTierAssignment(
    tierMap  : Map.Map<Nat, Types.DoctorTierAssignment>,
    doctorId : Nat,
  ) : Types.DoctorTier {
    switch (tierMap.get(doctorId)) {
      case (?ta) ta.tier;
      case null  #b;  // default tier
    };
  };

  /// Set (upsert) the tier for a doctor.
  public func setDoctorTierAssignment(
    tierMap   : Map.Map<Nat, Types.DoctorTierAssignment>,
    doctorId  : Nat,
    tier      : Types.DoctorTier,
    updatedBy : Nat,
  ) : () {
    tierMap.add(doctorId, {
      doctorId;
      tier;
      updatedAt = Time.now();
      updatedBy;
    });
  };

  // ── Report ─────────────────────────────────────────────────────────────────

  /// Build the visit frequency compliance report for an MR for a given month/year.
  /// Planned visits come from MTP travel plan entries (expected doctor count);
  /// actual visits are counted from submitted call reports.
  public func getVisitFrequencyReport(
    tierMap     : Map.Map<Nat, Types.DoctorTierAssignment>,
    config      : { var value : Types.VisitFrequencyConfig },
    reports     : List.List<FieldTypes.CallReport>,
    doctors     : List.List<FieldTypes.Doctor>,
    mrId        : Nat,
    month       : Nat,
    year        : Nat,
  ) : Types.VisitFrequencyReport {
    let cfg = config.value;

    // Build pad2 helper
    let pad2 = func(n : Nat) : Text {
      let t = n.toText();
      if (t.size() < 2) "0" # t else t
    };
    let monthPrefix = year.toText() # "-" # pad2(month);

    // Count actual visits per doctor for this MR in month/year
    let actualVisits = Map.empty<Nat, Nat>();  // doctorId -> visit count
    for (r in reports.values()) {
      if (
        r.mrId == mrId and
        r.date.size() >= 7 and r.date.startsWith(#text monthPrefix) and
        (r.status == #Submitted or r.status == #Approved)
      ) {
        for (v in r.doctorsVisited.values()) {
          switch (actualVisits.get(v.doctorId)) {
            case (?cnt) actualVisits.add(v.doctorId, cnt + 1);
            case null   actualVisits.add(v.doctorId, 1);
          };
        };
      };
    };

    // Build per-doctor rows for all doctors assigned/created by this MR
    let rows = List.empty<Types.DoctorVisitFrequencyRow>();
    var totalActual  : Nat   = 0;
    var totalTarget  : Nat   = 0;

    for (d in doctors.values()) {
      if (d.isActive and d.createdBy == mrId) {
        let tier = getDoctorTierAssignment(tierMap, d.id);
        let target = switch (tier) {
          case (#a) cfg.tierA;
          case (#b) cfg.tierB;
          case (#c) cfg.tierC;
        };
        let actual = switch (actualVisits.get(d.id)) { case (?n) n; case null 0 };
        let compliance : Float = if (target == 0) 100.0
                                 else actual.toFloat() / target.toFloat() * 100.0;
        rows.add({
          doctorId      = d.id;
          doctorName    = d.name;
          tier;
          plannedVisits = actual; // we use actual as planned proxy; MTP integration TBD
          actualVisits  = actual;
          target;
          compliancePct = compliance;
        });
        totalActual += actual;
        totalTarget += target;
      };
    };

    let overallCompliance : Float = if (totalTarget == 0) 100.0
                                    else totalActual.toFloat() / totalTarget.toFloat() * 100.0;

    {
      mrId;
      month;
      year;
      rows = rows.toArray();
      overallCompliancePct = overallCompliance;
    };
  };
};
