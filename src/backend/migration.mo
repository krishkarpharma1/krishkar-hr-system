import DcrTypes  "./types/dcr";
import TPTypes   "./types/travel-plan";
import PEAWTypes "./types/payroll-expenses-advances-workingstyle";
import List      "mo:core/List";
import Map       "mo:core/Map";

module {

  // ── Old DCR status (with V80 variants) ────────────────────────────────────
  type OldDcrStatus = {
    #Draft;
    #Submitted;
    #Late;
    #Approved;
    #Rejected;
    #autoSubmitted;
    #autoCheckoutSubmitted;
    #unlockedForEdit;
    #resubmitted;
    #noActivity;
  };

  type OldDcrRecord = {
    id                       : Nat;
    mrId                     : Nat;
    date                     : Text;
    var workingType          : DcrTypes.DcrWorkingType;
    var totalDoctorsVisited  : Nat;
    var totalChemistsVisited : Nat;
    var totalStockistsVisited: Nat;
    var stationCovered       : Text;
    var areaCovered          : Text;
    var remarks              : Text;
    var gpsLocation          : ?DcrTypes.GpsCoord;
    var status               : OldDcrStatus;
    isLate                   : Bool;
    var submittedAt          : ?Int;
    var approvedBy           : ?Nat;
    var approvedAt           : ?Int;
    var approverRemark       : Text;
    createdAt                : Int;
  };

  // ── Old DcrSettings (with V80 extra fields) ───────────────────────────────
  type OldAutoSubmissionScope = { #allMrs; #selectedTeams : [Nat]; #selectedTerritories : [Nat] };
  type OldAutoCheckoutScope   = { #allFieldEmployees; #selectedRoles : [Text]; #selectedTeams : [Nat]; #selectedTerritories : [Nat] };
  type OldDcrSettings = {
    var dailyDeadlineHour                 : Nat;
    var dailyDeadlineMinute               : Nat;
    var isEnabled                         : Bool;
    var enableAutoFillOnCheckout          : Bool;
    var enableAutoSubmissionAfterDeadline : Bool;
    var submissionCutoffHour              : Nat;
    var submissionCutoffMinute            : Nat;
    var autoCheckoutHour                  : Nat;
    var autoCheckoutMinute                : Nat;
    var autoSubmissionScope               : OldAutoSubmissionScope;
    var notifyAsmOnAutoSubmit             : Bool;
    var allowMrEditAutoSubmitted          : Bool;
    var enableAutoCheckout                : Bool;
    var autoCheckoutScope                 : OldAutoCheckoutScope;
    var notifyManagerOnAutoCheckout       : Bool;
    var notifyHrOnAutoCheckout            : Bool;
    var enableOtherStationInDcrEntry      : Bool;
  };

  // ── Old TravelPlanRecord (with V81 station fields) ────────────────────────
  type OldTravelPlanRecord = {
    id                        : Nat;
    userId                    : Nat;
    var date                  : Text;
    var plannedStation        : Text;
    var notes                 : Text;
    var status                : TPTypes.TravelPlanStatus;
    createdAt                 : Int;
    var updatedAt             : Int;
    var primaryStation        : Text;
    var additionalStations    : [Text];
  };

  // ── Old WorkingStyleRecord (with V81 station fields) ──────────────────────
  type OldWorkingStyleRecord = {
    id               : Text;
    employeeId       : Text;
    date             : Int;
    workingMode      : PEAWTypes.WorkingStyleMode;
    workingWithUserId: ?Text;
    workingWithName  : ?Text;
    stationSource    : PEAWTypes.WorkingStationSource;
    otherStationName : ?Text;
    submittedAt      : Int;
    workingType      : ?Text;
    additionalArea   : ?Text;
    selectedStation        : Text;
    additionalStationsList : [Text];
    isResubmission         : Bool;
    resubmissionTimestamp  : ?Int;
    resubmissionAuditEntries : [Text];
  };

  // ── Old DcrEditRequest (V80) ─────────────────────────────────────────────────
  type OldDcrEditRequest = {
    requestId   : Nat;
    dcrId       : Nat;
    mrId        : Nat;
    reason      : Text;
    requestedAt : Int;
    status      : { #pending; #approved; #rejected };
    reviewedBy  : ?Nat;
    reviewedAt  : ?Int;
    reviewNote  : ?Text;
  };

  // ── Old DcrAuditEntry (V80) ─────────────────────────────────────────────────
  type OldDcrAuditEntry = {
    entryId                : Nat;
    dcrId                  : ?Nat;
    mrId                   : Nat;
    eventType              : Text;
    triggerEvent           : Text;
    dataSourcesUsed        : [Text];
    mrReviewedBeforeSubmit : Bool;
    autoFillTimestamp      : ?Int;
    submissionTimestamp    : ?Int;
    actorId                : ?Nat;
    notes                  : Text;
  };

  // ── Old AttendanceCorrectionRequest (V80) ─────────────────────────────────
  type OldCorrectionStatus = { #pending; #approved; #rejected };
  type OldAttendanceCorrectionRequest = {
    requestId            : Nat;
    employeeId           : Nat;
    date                 : Text;
    autoCheckoutDate     : Text;
    claimedCheckoutTime  : Text;
    reason               : Text;
    supportingEvidence   : ?Text;
    submittedAt          : Int;
    status               : OldCorrectionStatus;
    reviewedBy           : ?Nat;
    reviewedAt           : ?Int;
    reviewNote           : ?Text;
  };

  // ── Old Distributor (V82) ──────────────────────────────────────────────────
  type OldDistributorStatus = { #active; #inactive };
  type OldDistributor = {
    id            : Text;   // DistributorId = Text
    var name      : Text;
    var areaCode  : Text;
    var address   : Text;
    var contactPerson : Text;
    var phone     : Text;
    var email     : Text;
    var territory : Text;
    var creditLimit  : Nat;
    var paymentTerms : Text;
    var status    : OldDistributorStatus;
    createdAt     : Int;
    var updatedAt : Int;
  };

  // ── Old EDetailingProduct (V82) ────────────────────────────────────────────
  type OldEDetailingProduct = {
    productId        : Text;
    var name         : Text;
    var category     : Text;
    var composition  : Text;
    var mrp          : Nat;
    var packSize     : Text;
    var description  : Text;
    var contentVersion   : Nat;
    var publishedAt  : Int;
    var isCurrentVersion : Bool;
  };
  type OldDownloadRecord = {
    recordId     : Nat;
    productId    : Text;
    mrId         : Nat;
    downloadedAt : Int;
  };

  // ── Old SampleReturn (V82) ───────────────────────────────────────────────────
  type OldReturnStatus = { #pending; #approved; #rejected };
  type OldSampleReturn = {
    returnId         : Text;
    issueId          : Text;
    doctorId         : Text;
    productId        : Text;
    batchNumber      : Text;
    quantityReturned : Nat;
    reason           : Text;
    notes            : Text;
    gpsLat           : Float;
    gpsLng           : Float;
    returnDate       : Int;
    var status       : OldReturnStatus;
    var approvedBy   : Text;
    var approvedAt   : Int;
  };

  // ── Old VisitFrequencyConfig (V82) ──────────────────────────────────────────
  type OldVisitFrequencyConfig = { tierA : Nat; tierB : Nat; tierC : Nat };
  type OldDoctorTier = { #a; #b; #c };
  type OldDoctorTierAssignment = {
    doctorId  : Nat;
    tier      : OldDoctorTier;
    updatedAt : Int;
    updatedBy : Nat;
  };

  // ── Old BulkMtpAuditEntry (V77) ────────────────────────────────────────────
  type OldBulkMtpAuditEntry = {
    id             : Nat;
    uploaderUserId : Nat;
    uploaderName   : Text;
    targetUserId   : Nat;
    targetUserName : Text;
    month          : Nat;
    year           : Nat;
    rowsSaved      : Nat;
    rowsSkipped    : Nat;
    lateSubmission : Bool;
    timestamp      : Int;
  };

  // ── Old MtpSettingsState (V81) ─────────────────────────────────────────────
  type OldMtpSettingsState = {
    var enableStationSelectionInMtp     : Bool;
    var stationSelectionMandatory       : Bool;
    var enableAdditionalStationInMtp    : Bool;
    var allowMultipleAdditionalStations : Bool;
    var requireApprovalForResubmission  : Bool;
    var enableOtherStationInDcrEntry    : Bool;
  };

  // ── Input (old actor stable state) ────────────────────────────────────────
  public type OldActor = {
    // V80-added DCR fields
    dcrAuditLog              : List.List<OldDcrAuditEntry>;
    dcrEditRequests          : List.List<OldDcrEditRequest>;
    dcrSettings              : OldDcrSettings;
    dcrs                     : List.List<OldDcrRecord>;
    nextDcrAuditId           : { var value : Nat };
    nextDcrEditReqId         : { var value : Nat };
    // V80 attendance correction
    attendanceCorrectionRequests : List.List<OldAttendanceCorrectionRequest>;
    nextCorrectionId             : { var value : Nat };
    // V81 travel plan
    travelPlans              : List.List<OldTravelPlanRecord>;
    // V81 working style
    workingStyleRecords      : List.List<OldWorkingStyleRecord>;
    // V77 MTP bulk upload
    mtpBulkAuditLog          : List.List<OldBulkMtpAuditEntry>;
    nextBulkAuditId          : { var val : Nat };
    // V81 MTP settings
    mtpSettings              : OldMtpSettingsState;
    mtpDeadlineDay           : Nat;
    // V82 distributors (DistributorId = Text)
    distributors             : Map.Map<Text, OldDistributor>;
    // V82 e-detailing
    edCatalog                : List.List<OldEDetailingProduct>;
    edDownloads              : List.List<OldDownloadRecord>;
    nextDownloadId           : { var val : Nat };
    // V82 visit frequency
    vfConfig                 : { var value : OldVisitFrequencyConfig };
    doctorTierMap            : Map.Map<Nat, OldDoctorTierAssignment>;
    // V82 sample returns
    sampleReturns            : List.List<OldSampleReturn>;
    nextSampleReturnId       : { var val : Nat };
  };

  // ── Output (new actor stable state) ──────────────────────────────────────
  public type NewActor = {
    dcrSettings         : DcrTypes.DcrSettings;
    dcrs                : List.List<DcrTypes.DcrRecord>;
    travelPlans         : List.List<TPTypes.TravelPlanRecord>;
    workingStyleRecords : List.List<PEAWTypes.WorkingStyleRecord>;
  };

  // ── Status mapper: coerce old V80 status variants to V76 set ─────────────
  func mapDcrStatus(old : OldDcrStatus) : DcrTypes.DcrStatus {
    switch (old) {
      case (#Draft)                 { #Draft };
      case (#Submitted)             { #Submitted };
      case (#Late)                  { #Late };
      case (#Approved)              { #Approved };
      case (#Rejected)              { #Rejected };
      // V80-only statuses: map to nearest V76 equivalent
      case (#autoSubmitted)         { #Submitted };
      case (#autoCheckoutSubmitted) { #Submitted };
      case (#unlockedForEdit)       { #Draft };
      case (#resubmitted)           { #Submitted };
      case (#noActivity)            { #Draft };
    }
  };

  // ── Migration function ────────────────────────────────────────────────────
  public func run(old : OldActor) : NewActor {
    // Migrate dcrSettings: keep the 3 V76 fields, drop V80 extras
    let newDcrSettings : DcrTypes.DcrSettings = {
      var dailyDeadlineHour   = old.dcrSettings.dailyDeadlineHour;
      var dailyDeadlineMinute = old.dcrSettings.dailyDeadlineMinute;
      var isEnabled           = old.dcrSettings.isEnabled;
    };

    // Migrate dcrs: map V80 status variants to V76
    let newDcrs = List.empty<DcrTypes.DcrRecord>();
    old.dcrs.forEach(func(r : OldDcrRecord) {
      let newStatus = mapDcrStatus(r.status);
      newDcrs.add({
        id                       = r.id;
        mrId                     = r.mrId;
        date                     = r.date;
        var workingType          = r.workingType;
        var totalDoctorsVisited  = r.totalDoctorsVisited;
        var totalChemistsVisited = r.totalChemistsVisited;
        var totalStockistsVisited = r.totalStockistsVisited;
        var stationCovered       = r.stationCovered;
        var areaCovered          = r.areaCovered;
        var remarks              = r.remarks;
        var gpsLocation          = r.gpsLocation;
        var status               = newStatus;
        isLate                   = r.isLate;
        var submittedAt          = r.submittedAt;
        var approvedBy           = r.approvedBy;
        var approvedAt           = r.approvedAt;
        var approverRemark       = r.approverRemark;
        createdAt                = r.createdAt;
      });
    });

    // Migrate travelPlans: drop V81 station fields
    let newTravelPlans = List.empty<TPTypes.TravelPlanRecord>();
    old.travelPlans.forEach(func(r : OldTravelPlanRecord) {
      newTravelPlans.add({
        id                 = r.id;
        userId             = r.userId;
        var date           = r.date;
        var plannedStation = r.plannedStation;
        var notes          = r.notes;
        var status         = r.status;
        createdAt          = r.createdAt;
        var updatedAt      = r.updatedAt;
      });
    });

    // Migrate workingStyleRecords: drop V81 station fields
    let newWSRecords = List.empty<PEAWTypes.WorkingStyleRecord>();
    old.workingStyleRecords.forEach(func(r : OldWorkingStyleRecord) {
      newWSRecords.add({
        id               = r.id;
        employeeId       = r.employeeId;
        date             = r.date;
        workingMode      = r.workingMode;
        workingWithUserId = r.workingWithUserId;
        workingWithName  = r.workingWithName;
        stationSource    = r.stationSource;
        otherStationName = r.otherStationName;
        submittedAt      = r.submittedAt;
        workingType      = r.workingType;
        additionalArea   = r.additionalArea;
      });
    });

    {
      dcrSettings         = newDcrSettings;
      dcrs                = newDcrs;
      travelPlans         = newTravelPlans;
      workingStyleRecords = newWSRecords;
    }
  };
};
