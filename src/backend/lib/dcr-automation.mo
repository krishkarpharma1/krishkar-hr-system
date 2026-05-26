import DcrTypes   "../types/dcr";
import GpsTypes   "../types/gps-trail";
import FieldTypes "../types/field-ops";
import CCTypes    "../types/chemist-call";
import TPTypes    "../types/travel-plan";
import NotifTypes "../types/notifications";
import List       "mo:core/List";

/// Domain logic for DCR auto-fill, auto-submission, auto-checkout,
/// edit requests, and audit entries.
module {

  public type DcrRecord           = DcrTypes.DcrRecord;
  public type DcrStatus           = DcrTypes.DcrStatus;
  public type DcrAutoFillData     = DcrTypes.DcrAutoFillData;
  public type DcrDoctorVisitEntry = DcrTypes.DcrDoctorVisitEntry;
  public type DcrSampleEntry      = DcrTypes.DcrSampleEntry;
  public type DcrInputEntry       = DcrTypes.DcrInputEntry;
  public type DcrEditRequest      = DcrTypes.DcrEditRequest;
  public type DcrAuditEntry       = DcrTypes.DcrAuditEntry;

  // ── Timestamp helpers ──────────────────────────────────────────────────────────

  public func nsToHHMM(ns : Int) : Text {
    let secs         : Int = ns / 1_000_000_000;
    let secondsInDay : Int = secs % 86400;
    let h : Int = secondsInDay / 3600;
    let m : Int = (secondsInDay % 3600) / 60;
    let hh = if (h < 10) "0" # h.toText() else h.toText();
    let mm = if (m < 10) "0" # m.toText() else m.toText();
    hh # ":" # mm
  };

  public func hourFromNs(ns : Int) : Nat {
    let secs : Int = ns / 1_000_000_000;
    let h    : Int = (secs % 86400) / 3600;
    if (h < 0) 0 else h.toNat()
  };

  // ── Auto-fill compilation ──────────────────────────────────────────────────

  public func compileAutoFillData(
    mrId          : Nat,
    date          : Text,
    checkIns      : List.List<GpsTypes.AttendanceCheckIn>,
    reports       : List.List<FieldTypes.CallReport>,
    chemistCalls  : List.List<CCTypes.ChemistCallRecord>,
    stockistCalls : List.List<CCTypes.StockistCallRecord>,
    travelPlans   : List.List<TPTypes.TravelPlanRecord>,
    now           : Int,
  ) : DcrAutoFillData {

    let checkIn = checkIns.find(func(ci : GpsTypes.AttendanceCheckIn) : Bool {
      ci.userId == mrId and ci.date == date
    });

    let checkInTime : ?Text = switch (checkIn) {
      case (?ci) { ?nsToHHMM(ci.recordedAt) };
      case null  { null };
    };

    let checkOutTime : ?Text = switch (checkIn) {
      case (?ci) {
        switch (ci.checkOutTime) {
          case (?t) { ?nsToHHMM(t) };
          case null { null };
        }
      };
      case null { null };
    };

    let checkInLocation : ?Text = switch (checkIn) {
      case (?ci) { ci.matchedLocation };
      case null  { null };
    };

    let checkOutLocation : ?Text = switch (checkIn) {
      case (?ci) { ci.matchedLocation };
      case null  { null };
    };

    let mtp = travelPlans.find(func(tp : TPTypes.TravelPlanRecord) : Bool {
      tp.userId == mrId and tp.date == date
    });

    // Prefer primaryStation (Part A station selection) over plannedStation (legacy);
    // fall back to plannedStation, then default "HQ" if both are empty.
    let dayType : Text = switch (mtp) {
      case (?tp) {
        if (tp.primaryStation != "")  { tp.primaryStation  }
        else if (tp.plannedStation != "") { tp.plannedStation }
        else { "HQ" }
      };
      case null { "HQ" };
    };

    let areaBeatPlan : ?Text = switch (mtp) {
      case (?tp) { if (tp.notes == "") null else ?tp.notes };
      case null  { null };
    };

    let dataSourcesUsed = List.empty<Text>();
    switch (checkIn) { case (?_) { dataSourcesUsed.add("GPS Trail") }; case null {} };
    switch (mtp)     { case (?_) { dataSourcesUsed.add("MTP") };       case null {} };

    let dayReports = reports.filter(func(r : FieldTypes.CallReport) : Bool {
      r.mrId == mrId and r.date == date
    });

    let visitEntries = List.empty<DcrDoctorVisitEntry>();
    var hasDoctorCalls = false;

    for (r in dayReports.values()) {
      hasDoctorCalls := true;
      for (dv in r.doctorsVisited.values()) {
        let productsDetailed = List.empty<Text>();
        for (pid in dv.productIds.values()) {
          productsDetailed.add("Product#" # pid.toText());
        };
        let samplesGiven = List.empty<DcrSampleEntry>();
        for (s in dv.samplesDistributed.values()) {
          samplesGiven.add({ productName = "Product#" # s.productId.toText(); quantity = s.quantity });
        };
        let inputsGiven = List.empty<DcrInputEntry>();
        for (ga in dv.giftArticles.values()) {
          inputsGiven.add({ itemName = "Input#" # ga.giftArticleId.toText(); quantity = ga.quantity });
        };
        visitEntries.add({
          doctorId         = dv.doctorId;
          doctorName       = "Doctor#" # dv.doctorId.toText();
          timeOfVisit      = ?nsToHHMM(r.createdAt);
          productsDetailed = productsDetailed.toArray();
          samplesGiven     = samplesGiven.toArray();
          inputsGiven      = inputsGiven.toArray();
          location         = null;
        });
      };
    };

    if (hasDoctorCalls) { dataSourcesUsed.add("Doctor Call Entry") };

    let totalChemists : Nat = chemistCalls.filter(func(cc : CCTypes.ChemistCallRecord) : Bool {
      cc.mrId == mrId and cc.date == date
    }).size();

    let totalStockists : Nat = stockistCalls.filter(func(sc : CCTypes.StockistCallRecord) : Bool {
      sc.mrId == mrId and sc.date == date
    }).size();

    if (totalChemists > 0)  { dataSourcesUsed.add("Chemist Call Entry")  };
    if (totalStockists > 0) { dataSourcesUsed.add("Stockist Call Entry") };

    let totalDoctors = visitEntries.size();
    let defaultRemarks =
      "Auto-filled DCR for " # date #
      ". Doctors visited: " # totalDoctors.toText() #
      ", Chemists: " # totalChemists.toText() #
      ", Stockists: " # totalStockists.toText() #
      ". Station: " # dayType # ".";

    {
      date                  = date;
      checkInTime           = checkInTime;
      checkOutTime          = checkOutTime;
      checkInLocation       = checkInLocation;
      checkOutLocation      = checkOutLocation;
      dayType               = dayType;
      areaBeatPlan          = areaBeatPlan;
      doctorVisits          = visitEntries.toArray();
      totalDoctorsVisited   = totalDoctors;
      totalChemistsVisited  = totalChemists;
      totalStockistsVisited = totalStockists;
      distanceTravelled     = null;
      defaultRemarks        = defaultRemarks;
      autoFillTimestamp     = now;
      dataSourcesUsed       = dataSourcesUsed.toArray();
    }
  };

  // ── Audit entry factory ───────────────────────────────────────────────────

  public func createAuditEntry(
    nextId           : { var value : Nat },
    dcrId            : ?Nat,
    mrId             : Nat,
    eventType        : Text,
    triggerEvent     : Text,
    dataSourcesUsed  : [Text],
    mrReviewedBefore : Bool,
    autoFillTs       : ?Int,
    submissionTs     : ?Int,
    actorId          : ?Nat,
    notes            : Text,
  ) : DcrAuditEntry {
    let id = nextId.value;
    nextId.value += 1;
    {
      entryId                = id;
      dcrId                  = dcrId;
      mrId                   = mrId;
      eventType              = eventType;
      triggerEvent           = triggerEvent;
      dataSourcesUsed        = dataSourcesUsed;
      mrReviewedBeforeSubmit = mrReviewedBefore;
      autoFillTimestamp      = autoFillTs;
      submissionTimestamp    = submissionTs;
      actorId                = actorId;
      notes                  = notes;
    }
  };

  // ── Edit request operations ───────────────────────────────────────────────

  public func createEditRequest(
    editRequests : List.List<DcrEditRequest>,
    nextId       : { var value : Nat },
    dcrId        : Nat,
    mrId         : Nat,
    reason       : Text,
    now          : Int,
  ) : Nat {
    let id = nextId.value;
    nextId.value += 1;
    editRequests.add({
      requestId   = id;
      dcrId       = dcrId;
      mrId        = mrId;
      reason      = reason;
      requestedAt = now;
      status      = #pending;
      reviewedBy  = null;
      reviewedAt  = null;
      reviewNote  = null;
    });
    id
  };

  public func reviewEditRequest(
    editRequests : List.List<DcrEditRequest>,
    dcrs         : List.List<DcrRecord>,
    requestId    : Nat,
    reviewerId   : Nat,
    approved     : Bool,
    note         : ?Text,
    now          : Int,
  ) : { #ok; #err : Text } {
    switch (editRequests.find(func(r : DcrEditRequest) : Bool { r.requestId == requestId })) {
      case null { #err("Edit request not found") };
      case (?req) {
        if (req.status != #pending) return #err("Edit request is not in pending state");
        editRequests.mapInPlace(func(r : DcrEditRequest) : DcrEditRequest {
          if (r.requestId == requestId) {
            { r with
              status     = if (approved) #approved else #rejected;
              reviewedBy = ?reviewerId;
              reviewedAt = ?now;
              reviewNote = note;
            }
          } else { r }
        });
        if (approved) {
          switch (dcrs.find(func(d : DcrRecord) : Bool { d.id == req.dcrId })) {
            case (?dcr) { dcr.status := #unlockedForEdit };
            case null {};
          };
        };
        #ok
      };
    }
  };

  public func getEditRequestsForMr(
    editRequests : List.List<DcrEditRequest>,
    mrId         : Nat,
  ) : [DcrEditRequest] {
    editRequests.filter(func(r : DcrEditRequest) : Bool { r.mrId == mrId }).toArray()
  };

  public func getAllEditRequests(editRequests : List.List<DcrEditRequest>) : [DcrEditRequest] {
    editRequests.toArray()
  };

  // ── Auto-checkout helpers ───────────────────────────────────────────────────

  public func findUncheckedOutEmployees(
    checkIns  : List.List<GpsTypes.AttendanceCheckIn>,
    todayDate : Text,
  ) : [Nat] {
    let result = List.empty<Nat>();
    for (ci in checkIns.values()) {
      if (ci.date == todayDate and ci.checkOutTime == null) {
        result.add(ci.userId);
      };
    };
    result.toArray()
  };

  public func recordAutoCheckout(
    checkIns   : List.List<GpsTypes.AttendanceCheckIn>,
    userId     : Nat,
    date       : Text,
    checkOutTs : Int,
  ) : Bool {
    var found = false;
    checkIns.mapInPlace(func(ci : GpsTypes.AttendanceCheckIn) : GpsTypes.AttendanceCheckIn {
      if (ci.userId == userId and ci.date == date and ci.checkOutTime == null) {
        found := true;
        { ci with checkOutTime = ?checkOutTs; wasAutoCheckedOut = true }
      } else { ci }
    });
    found
  };

  // ── Missed-day DCR ───────────────────────────────────────────────────────

  public func createMissedDayDcr(
    dcrs      : List.List<DcrRecord>,
    nextDcrId : { var value : Nat },
    mrId      : Nat,
    date      : Text,
    now       : Int,
  ) : Nat {
    switch (dcrs.find(func(d : DcrRecord) : Bool { d.mrId == mrId and d.date == date })) {
      case (?_) { 0 };
      case null {
        let id = nextDcrId.value;
        nextDcrId.value += 1;
        dcrs.add({
          id                          = id;
          mrId                        = mrId;
          date                        = date;
          var workingType             = (#FieldWork : DcrTypes.DcrWorkingType);
          var totalDoctorsVisited     = 0;
          var totalChemistsVisited    = 0;
          var totalStockistsVisited   = 0;
          var stationCovered          = "";
          var areaCovered             = "";
          var remarks                 = "No Activity - Not Checked In";
          var gpsLocation             = (null : ?DcrTypes.GpsCoord);
          var status                  = (#noActivity : DcrTypes.DcrStatus);
          isLate                      = false;
          var submittedAt             = (null : ?Int);
          var approvedBy              = (null : ?Nat);
          var approvedAt              = (null : ?Int);
          var approverRemark          = "";
          createdAt                   = now;
        });
        id
      };
    }
  };

  // ── Submit DCR from auto-fill data ─────────────────────────────────────────

  public func submitFromAutoFill(
    dcrs           : List.List<DcrRecord>,
    nextDcrId      : { var value : Nat },
    mrId           : Nat,
    autoFill       : DcrAutoFillData,
    submissionType : Text,
    now            : Int,
  ) : Nat {
    let newStatus : DcrStatus = switch (submissionType) {
      case "autoCheckout" { #autoCheckoutSubmitted };
      case "autoSubmit"   { #autoSubmitted };
      case _              { #Submitted };
    };
    switch (dcrs.find(func(d : DcrRecord) : Bool { d.mrId == mrId and d.date == autoFill.date })) {
      case (?existing) {
        if (existing.status == #Draft or existing.status == #unlockedForEdit) {
          existing.totalDoctorsVisited   := autoFill.totalDoctorsVisited;
          existing.totalChemistsVisited  := autoFill.totalChemistsVisited;
          existing.totalStockistsVisited := autoFill.totalStockistsVisited;
          existing.stationCovered        := autoFill.dayType;
          existing.areaCovered           := switch (autoFill.areaBeatPlan) { case (?a) a; case null "" };
          existing.remarks               := autoFill.defaultRemarks;
          existing.status                := newStatus;
          existing.submittedAt           := ?now;
          existing.id
        } else { existing.id }
      };
      case null {
        let id = nextDcrId.value;
        nextDcrId.value += 1;
        dcrs.add({
          id                          = id;
          mrId                        = mrId;
          date                        = autoFill.date;
          var workingType             = (#FieldWork : DcrTypes.DcrWorkingType);
          var totalDoctorsVisited     = autoFill.totalDoctorsVisited;
          var totalChemistsVisited    = autoFill.totalChemistsVisited;
          var totalStockistsVisited   = autoFill.totalStockistsVisited;
          var stationCovered          = autoFill.dayType;
          var areaCovered             = switch (autoFill.areaBeatPlan) { case (?a) a; case null "" };
          var remarks                 = autoFill.defaultRemarks;
          var gpsLocation             = (null : ?DcrTypes.GpsCoord);
          var status                  = newStatus;
          isLate                      = false;
          var submittedAt             = (?now : ?Int);
          var approvedBy              = (null : ?Nat);
          var approvedAt              = (null : ?Int);
          var approverRemark          = "";
          createdAt                   = now;
        });
        id
      };
    }
  };

  // ── Notification helper ────────────────────────────────────────────────────────

  public func buildAutoSubmitNotification(
    notifId     : Text,
    recipientId : Text,
    senderId    : Text,
    title       : Text,
    body        : Text,
    dcrId       : Nat,
    now         : Int,
  ) : NotifTypes.NotificationRecord {
    {
      id                = notifId;
      recipientId       = recipientId;
      senderId          = senderId;
      notificationType  = #dcrReminder;
      title             = title;
      body              = body;
      isRead            = false;
      relatedEntityId   = ?dcrId.toText();
      relatedEntityType = ?"dcr";
      createdAt         = now;
    }
  };
};
