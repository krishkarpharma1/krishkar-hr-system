import AuthLib    "../lib/auth-users";
import AuthTypes  "../types/auth-users";
import FieldTypes "../types/field-ops";
import DcrTypes   "../types/dcr";
import GpsTypes   "../types/gps-trail";
import Map        "mo:core/Map";
import List       "mo:core/List";
import Set        "mo:core/Set";
import Time       "mo:core/Time";

mixin (
  sessions  : Map.Map<Text, AuthTypes.Session>,
  users     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  reports   : List.List<FieldTypes.CallReport>,
  doctors   : List.List<FieldTypes.Doctor>,
  products  : List.List<FieldTypes.Product>,
  dcrs      : List.List<DcrTypes.DcrRecord>,
  checkIns  : List.List<GpsTypes.AttendanceCheckIn>,
  userDobMap : Map.Map<Text, Text>,
) {

  // ── Internal date helpers ──────────────────────────────────────────────────

  /// Convert ISO date "YYYY-MM-DD" to DD-MM-YYYY
  private func isoToDDMMYYYY(iso : Text) : Text {
    let chars = iso.toArray();
    if (chars.size() < 10) return iso;
    let yyyy = chars[0].toText() # chars[1].toText() # chars[2].toText() # chars[3].toText();
    let mm   = chars[5].toText() # chars[6].toText();
    let dd   = chars[8].toText() # chars[9].toText();
    dd # "-" # mm # "-" # yyyy
  };

  /// Convert DD-MM-YYYY to ISO "YYYY-MM-DD" for comparisons
  private func ddmmyyyyToISO(dd : Text) : Text {
    let chars = dd.toArray();
    if (chars.size() < 10) return dd;
    let d    = chars[0].toText() # chars[1].toText();
    let m    = chars[3].toText() # chars[4].toText();
    let yyyy = chars[6].toText() # chars[7].toText() # chars[8].toText() # chars[9].toText();
    yyyy # "-" # m # "-" # d
  };

  /// Derive ISO date "YYYY-MM-DD" from nanosecond timestamp (UTC, for IST add 5.5h)
  private func nsToISODate(ns : Int) : Text {
    // IST = UTC + 5 hours 30 minutes = UTC + 19800 seconds
    let secs   : Int = ns / 1_000_000_000 + 19800;
    let days   : Int = secs / 86400;
    let z      : Int = days + 719468;
    let era    : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe    : Int = z - era * 146097;
    let yoe    : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y      : Int = yoe + era * 400;
    let doy    : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp     : Int = (5 * doy + 2) / 153;
    let day    : Int = doy - (153 * mp + 2) / 5 + 1;
    let month  : Int = if (mp < 10) mp + 3 else mp - 9;
    let year   : Int = if (month <= 2) y + 1 else y;
    let mm = if (month < 10) "0" # month.toText() else month.toText();
    let dd = if (day   < 10) "0" # day.toText()   else day.toText();
    year.toText() # "-" # mm # "-" # dd
  };

  /// Extract HH:MM from nanosecond timestamp in IST
  private func nsToHHMM(ns : Int) : Text {
    let secs : Int = ns / 1_000_000_000 + 19800;
    let secondsInDay : Int = ((secs % 86400) + 86400) % 86400;
    let h = secondsInDay / 3600;
    let m = (secondsInDay % 3600) / 60;
    let hh = if (h < 10) "0" # h.toText() else h.toText();
    let mm = if (m < 10) "0" # m.toText() else m.toText();
    hh # ":" # mm
  };

  /// Resolve station/day-type for a given mrId+date from DCR (fallback to CallReport stationType)
  private func resolveStationDayType(
    mrId     : Nat,
    isoDate  : Text,
    report   : FieldTypes.CallReport,
  ) : Text {
    // First check DCR stationCovered for standard labels
    switch (dcrs.find(func(d : DcrTypes.DcrRecord) : Bool { d.mrId == mrId and d.date == isoDate })) {
      case (?dcr) {
        // Normalise to display labels
        switch (dcr.stationCovered) {
          case "ExStation"  "Ex-Station";
          case "HQ"         "HQ";
          case "OutStation" "Out-Station";
          case other        {
            if (other == "") normaliseStationType(report.stationType)
            else other
          };
        }
      };
      case null { normaliseStationType(report.stationType) };
    }
  };

  private func normaliseStationType(raw : Text) : Text {
    switch (raw) {
      case "ExStation"  "Ex-Station";
      case "OutStation" "Out-Station";
      case "HQ"         "HQ";
      case other        other;
    }
  };

  /// Resolve DCR status text for an mrId+date
  private func resolveDcrStatus(mrId : Nat, isoDate : Text, reportStatus : FieldTypes.ReportStatus) : Text {
    switch (dcrs.find(func(d : DcrTypes.DcrRecord) : Bool { d.mrId == mrId and d.date == isoDate })) {
      case (?dcr) {
        switch (dcr.status) {
          case (#Draft)                 { "Draft" };
          case (#Submitted)             { "Submitted" };
          case (#Late)                  { "Submitted" };
          case (#Approved)              { "Submitted" };
          case (#Rejected)              { "Submitted" };
          case (#autoSubmitted)         { "Auto-Submitted" };
          case (#autoCheckoutSubmitted) { "Auto-Checkout Submitted" };
          case (#unlockedForEdit)       { "Unlocked for Edit" };
          case (#resubmitted)           { "Resubmitted" };
          case (#noActivity)            { "No Activity" };
        }
      };
      case null {
        switch (reportStatus) {
          case (#Draft)     { "Draft" };
          case (#Submitted) { "Submitted" };
          case (#Approved)  { "Submitted" };
          case (#Rejected)  { "Submitted" };
        }
      };
    }
  };

  /// Resolve GPS location text from a CallReport (returns working station name or empty)
  private func resolveGpsText(report : FieldTypes.CallReport) : Text {
    switch (report.workingStation) {
      case (?s) s;
      case null  report.stationType;
    }
  };

  /// Resolve product name from product list
  private func resolveProductName(productId : Nat) : Text {
    switch (products.find(func(p : FieldTypes.Product) : Bool { p.id == productId })) {
      case (?p) p.name;
      case null "Product #" # productId.toText();
    }
  };

  // ── Hierarchy scope helpers ────────────────────────────────────────────────

  /// Check if callerMrId is within scope for the caller's role.
  /// Returns true if access is permitted.
  private func isInHierarchyScope(
    session : AuthTypes.Session,
    targetMrId : Nat,
  ) : Bool {
    switch (session.role) {
      case (#Admin)     { true };
      case (#HRManager) { true };
      case (#MR)        { session.userId == targetMrId };
      case _ {
        let reportees = AuthLib.allReporteeIds(users, session.userId);
        reportees.find(func(id : Nat) : Bool { id == targetMrId }) != null
      };
    }
  };

  /// Get all MR userIds accessible to the caller
  private func getAccessibleMrIds(session : AuthTypes.Session) : [Nat] {
    switch (session.role) {
      case (#Admin) {
        let result = List.empty<Nat>();
        for ((_, u) in users.entries()) {
          if (u.role == #MR and u.status == #Active) { result.add(u.id) };
        };
        result.toArray()
      };
      case (#HRManager) {
        let result = List.empty<Nat>();
        for ((_, u) in users.entries()) {
          if (u.role == #MR and u.status == #Active) { result.add(u.id) };
        };
        result.toArray()
      };
      case (#MR) { [session.userId] };
      case _ {
        let reportees = AuthLib.allReporteeIds(users, session.userId);
        let result = List.empty<Nat>();
        for (rid in reportees.values()) {
          switch (users.get(rid)) {
            case (?u) { if (u.role == #MR and u.status == #Active) { result.add(u.id) } };
            case null {};
          };
        };
        result.toArray()
      };
    }
  };

  // ── Core report builder ────────────────────────────────────────────────────

  /// Build DoctorCallReportPage for a single MR within a date range + filters.
  /// fromISO / toISO are "YYYY-MM-DD" strings.
  private func buildReportPage(
    mrId         : Nat,
    fromISO      : Text,
    toISO        : Text,
    filter       : FieldTypes.DoctorCallReportFilter,
    includeEmpCode : Bool,
  ) : FieldTypes.DoctorCallReportPage {
    // Collect all call reports for this MR in the date range
    let mrReports = reports.filter(func(r : FieldTypes.CallReport) : Bool {
      r.mrId == mrId and r.date >= fromISO and r.date <= toISO
    });

    // If includeDrafts=false, exclude entries whose DCR is still Draft
    let includeDrafts = filter.includeDrafts;

    // Build per-doctor-visit entries
    let entries = List.empty<FieldTypes.DoctorCallReportEntry>();
    let uniqueDoctorSet = Set.empty<Nat>();
    var totalProductsDetailed : Nat = 0;
    var totalSamples : Nat = 0;
    var totalInputs  : Nat = 0;

    for (r in mrReports.values()) {
      // Determine DCR status for this date
      let dcrStatus = resolveDcrStatus(mrId, r.date, r.status);

      // Skip drafts if not requested
      if (not includeDrafts and dcrStatus == "Draft") {
        // skip
      } else {
        let stationDayType = resolveStationDayType(mrId, r.date, r);

        // Day-type filter
        let dayTypeOk = switch (filter.dayTypeFilter) {
          case null true;
          case (?dt) {
            switch (dt) {
              case "HQ"         (stationDayType == "HQ");
              case "Ex-Station" (stationDayType == "Ex-Station");
              case "Out-Station" (stationDayType == "Out-Station");
              case _ true;
            }
          };
        };

        if (dayTypeOk) {
          // Get employee code if needed
          let empCode : ?Text = if (includeEmpCode) {
            switch (users.get(mrId)) {
              case (?u) ?u.employeeId;
              case null null;
            }
          } else { null };

          // Per-doctor visit entries
          for (visit in r.doctorsVisited.values()) {
            let doctor = doctors.find(func(d : FieldTypes.Doctor) : Bool { d.id == visit.doctorId });
            let doctorName = switch (doctor) {
              case (?d) d.name;
              case null "Doctor #" # visit.doctorId.toText();
            };
            let doctorSpeciality = switch (doctor) {
              case (?d) d.specialization;
              case null "";
            };
            let clinicName = switch (doctor) {
              case (?d) d.clinicName;
              case null "";
            };

            // Doctor name search filter
            let nameOk = switch (filter.doctorNameSearch) {
              case null true;
              case (?search) {
                doctorName.toLower().contains(#text (search.toLower()))
              };
            };

            // Products detailed in this visit
            let visitProducts = visit.productIds.map(func(pid) {
              resolveProductName(pid)
            });

            // Product filter
            let productOk = switch (filter.productFilter) {
              case null true;
              case (?pf) {
                visitProducts.find(func(pn : Text) : Bool {
                   pn.toLower().contains(#text (pf.toLower()))
                }) != null
              };
            };

            if (nameOk and productOk) {
              // Samples for this visit
              let visitSamples = visit.samplesDistributed.map(func(s) {
                { productName = resolveProductName(s.productId); quantity = s.quantity }
              });

              // Inputs (gift articles) for this visit
              let visitInputs = visit.giftArticles.map(func(g) {
                { itemName = g.giftArticleName; quantity = g.quantity }
              });

              // GPS location from visit or report
              let gpsText : ?Text = switch (visit.gps) {
                case (?_coord) ?resolveGpsText(r);
                case null      ?resolveGpsText(r);
              };

              uniqueDoctorSet.add(visit.doctorId);
              totalProductsDetailed += visitProducts.size();
              totalSamples += visitSamples.foldLeft(0, func(acc : Nat, s : { productName : Text; quantity : Nat }) : Nat { acc + s.quantity });
              totalInputs  += visitInputs.size();

              entries.add({
                date             = isoToDDMMYYYY(r.date);
                timeOfVisit      = ?nsToHHMM(r.createdAt);
                doctorId         = visit.doctorId;
                doctorName;
                doctorSpeciality;
                clinicHospitalName = clinicName;
                stationDayType;
                productsDetailed = visitProducts;
                samplesGiven     = visitSamples;
                inputsGiven      = visitInputs;
                gpsLocation      = gpsText;
                dcrStatus;
                employeeCode     = empCode;
              });
            };
          };
        };
      };
    };

    let allEntries = entries.toArray();
    let totalRows  = allEntries.size();

    // Pagination
    let pageSize   = switch (filter.pageSize)   { case (?n) n; case null totalRows };
    let pageOffset = switch (filter.pageOffset) { case (?n) n; case null 0 };
    let sliceStart : Int = pageOffset.toInt();
    let sliceEnd   : Int = (pageOffset + pageSize).toInt();
    let pagedEntries = allEntries.sliceToArray(sliceStart, sliceEnd);

    let summary : FieldTypes.DoctorCallReportSummary = {
      totalCalls              = totalRows;
      totalUniqueDoctors      = uniqueDoctorSet.size();
      totalProductsDetailed;
      totalSamplesDistributed = totalSamples;
      totalInputsUsed         = totalInputs;
    };

    {
      entries   = pagedEntries;
      summary;
      totalRows;
      hasMore   = (pageOffset + pageSize) < totalRows;
    }
  };

  // ── Date conversion helpers ────────────────────────────────────────────────

  /// Subtract 30 calendar days from today (IST) and return ISO date string
  private func thirtyDaysAgoISO() : Text {
    let now = Time.now();
    let ns30days : Int = 30 * 86400 * 1_000_000_000;
    nsToISODate(now - ns30days)
  };

  private func todayISO() : Text { nsToISODate(Time.now()) };

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Get doctor call report with filters and pagination.
  /// MR can only query their own data; managers are scoped to their hierarchy.
  public query func getDoctorCallReport(
    sessionToken : Text,
    filter       : FieldTypes.DoctorCallReportFilter,
  ) : async { #ok : FieldTypes.DoctorCallReportPage; #err : Text } {
    switch (AuthLib.peekSession(sessions, sessionToken, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        // Resolve target mrId
        let targetMrId = switch (filter.mrId) {
          case (?id) id;
          case null  session.userId;  // default to self for MR role
        };

        // Hierarchy scope enforcement
        if (not isInHierarchyScope(session, targetMrId)) {
          return #err("Access denied: MR is not within your hierarchy scope")
        };

        // Convert DD-MM-YYYY filter dates to ISO
        let fromISO = if (filter.fromDate == "") thirtyDaysAgoISO()
                      else ddmmyyyyToISO(filter.fromDate);
        let toISO   = if (filter.toDate == "")   todayISO()
                      else ddmmyyyyToISO(filter.toDate);

        let includeEmpCode = (session.role != #MR);
        #ok(buildReportPage(targetMrId, fromISO, toISO, filter, includeEmpCode))
      };
    }
  };

  /// Get doctor call reports for multiple MRs (grouped by MR).
  /// For HR/Admin: mrIds=[] means all accessible MRs.
  public query func getDoctorCallReportForMrs(
    sessionToken : Text,
    mrIds        : [Nat],
    filter       : FieldTypes.DoctorCallReportFilter,
  ) : async { #ok : [FieldTypes.MrDoctorCallReport]; #err : Text } {
    switch (AuthLib.peekSession(sessions, sessionToken, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        // Convert dates
        let fromISO = if (filter.fromDate == "") thirtyDaysAgoISO()
                      else ddmmyyyyToISO(filter.fromDate);
        let toISO   = if (filter.toDate == "")   todayISO()
                      else ddmmyyyyToISO(filter.toDate);

        // Resolve which MR IDs to query
        let targetIds : [Nat] = if (mrIds.size() == 0) {
          // Empty = all accessible MRs
          getAccessibleMrIds(session)
        } else {
          // Filter to only those within scope
          let acc = List.empty<Nat>();
          for (id in mrIds.values()) {
            if (isInHierarchyScope(session, id)) { acc.add(id) };
          };
          acc.toArray()
        };

        let result = List.empty<FieldTypes.MrDoctorCallReport>();
        for (mrId in targetIds.values()) {
          let mrName = switch (users.get(mrId)) {
            case (?u) u.name;
            case null "MR #" # mrId.toText();
          };
          let empCode : ?Text = switch (users.get(mrId)) {
            case (?u) ?u.employeeId;
            case null null;
          };
          let page = buildReportPage(mrId, fromISO, toISO, filter, true);
          result.add({ mrId; mrName; employeeCode = empCode; report = page });
        };
        #ok(result.toArray())
      };
    }
  };

  /// Fast count of doctor calls in the last 30 rolling days for the calling MR.
  /// Used for the MR dashboard card.
  public query func getDashboardDoctorCallCount(
    sessionToken : Text,
  ) : async { #ok : Nat; #err : Text } {
    switch (AuthLib.peekSession(sessions, sessionToken, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (session.role != #MR) return #err("MR role required");
        let fromISO = thirtyDaysAgoISO();
        let toISO   = todayISO();
        var count : Nat = 0;
        for (r in reports.values()) {
          if (r.mrId == session.userId and r.date >= fromISO and r.date <= toISO) {
            count += r.doctorsVisited.size();
          };
        };
        #ok(count)
      };
    }
  };

  /// DCR Submission Rate Report — Admin/HR only.
  /// For each MR and each day they checked in, shows DCR submission status.
  public query func getDcrSubmissionRateReport(
    sessionToken : Text,
    fromDate     : Text,   // DD-MM-YYYY
    toDate       : Text,   // DD-MM-YYYY
    mrIdsParam   : ?[Nat],
  ) : async { #ok : [DcrTypes.DcrSubmissionRateEntry]; #err : Text } {
    switch (AuthLib.peekSession(sessions, sessionToken, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) {};
          case _ { return #err("Admin or HR role required") };
        };

        let fromISO = ddmmyyyyToISO(fromDate);
        let toISO   = ddmmyyyyToISO(toDate);

        // Determine which MRs to include
        let targetMrIds : [Nat] = switch (mrIdsParam) {
          case (?ids) ids;
          case null {
            let acc = List.empty<Nat>();
            for ((_, u) in users.entries()) {
              if (u.role == #MR and u.status == #Active) { acc.add(u.id) };
            };
            acc.toArray()
          };
        };

        let result = List.empty<DcrTypes.DcrSubmissionRateEntry>();

        for (mrId in targetMrIds.values()) {
          let mrName = switch (users.get(mrId)) {
            case (?u) u.name;
            case null "MR #" # mrId.toText();
          };
          let empCode : ?Text = switch (users.get(mrId)) {
            case (?u) ?u.employeeId;
            case null null;
          };

          // For each day the MR checked in within the range
          for (ci in checkIns.values()) {
            if (ci.userId == mrId) {
              // ci.date is already ISO "YYYY-MM-DD" format
              let ciDateISO = if (ci.date.size() >= 10) {
                let arr = ci.date.toArray();
                arr[0].toText() # arr[1].toText() # arr[2].toText() # arr[3].toText() #
                "-" # arr[5].toText() # arr[6].toText() # "-" # arr[8].toText() # arr[9].toText()
              } else ci.date;

              if (ciDateISO >= fromISO and ciDateISO <= toISO) {
                // Count doctors visited via call reports on this date
                var doctorsVisited : Nat = 0;
                for (r in reports.values()) {
                  if (r.mrId == mrId and r.date == ciDateISO) {
                    doctorsVisited += r.doctorsVisited.size();
                  };
                };

                // Determine submission status from DCR
                let (submitted, submType, submTime) =
                  switch (dcrs.find(func(d : DcrTypes.DcrRecord) : Bool { d.mrId == mrId and d.date == ciDateISO })) {
                    case null { (false, "Not Submitted", null) };
                    case (?dcr) {
                      let t : ?Text = switch (dcr.submittedAt) {
                        case null null;
                        case (?ts) ?nsToHHMM(ts);
                      };
                      switch (dcr.status) {
                        case (#Draft)                 { (false, "Not Submitted", null) };
                        case (#Submitted)             { (true,  "Manual",               t) };
                        case (#Late)                  { (true,  "Manual",               t) };
                        case (#Approved)              { (true,  "Manual",               t) };
                        case (#Rejected)              { (true,  "Manual",               t) };
                        case (#autoSubmitted)         { (true,  "Auto-Submitted",        t) };
                        case (#autoCheckoutSubmitted) { (true,  "Auto-Checkout",         t) };
                        case (#unlockedForEdit)       { (true,  "Unlocked for Edit",     t) };
                        case (#resubmitted)           { (true,  "Resubmitted",           t) };
                        case (#noActivity)            { (false, "No Activity",           null) };
                      };
                    };
                  };

                result.add({
                  mrId;
                  mrName;
                  employeeCode   = empCode;
                  date           = isoToDDMMYYYY(ciDateISO);
                  submitted;
                  submissionType = submType;
                  submissionTime = submTime;
                  doctorsVisited;
                });
              };
            };
          };
        };
        #ok(result.toArray())
      };
    }
  };
};
