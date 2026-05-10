import CommonTypes "common";
import TravelPlanTypes "travel-plan";
import GAMTypes "gift-article-master";

module {
  public type UserId = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;
  public type GpsCoord = CommonTypes.GpsCoord;

  // Re-export travel plan types used in CallReport
  public type WorkingMode          = TravelPlanTypes.WorkingMode;
  public type WorkingStationSource = TravelPlanTypes.WorkingStationSource;

  // ── Gift Article Master re-exports ────────────────────────────────────────
  public type GiftArticleId           = GAMTypes.GiftArticleId;
  public type GiftArticleDistributedV2 = GAMTypes.GiftArticleDistributedV2;

  // ── IDs ──────────────────────────────────────────────────────────────────
  public type DoctorId  = Nat;
  public type ChemistId = Nat;
  public type OrderId   = Nat;
  public type ReportId  = Nat;
  public type ProductId = Nat;

  // ── Products / Samples catalog ───────────────────────────────────────────
  public type ProductCategory = {
    #Tablet;
    #Capsule;
    #Syrup;
    #Injection;
    #Ointment;
    #Other;
  };

  public type Product = {
    id              : ProductId;
    var name        : Text;
    var category    : ProductCategory;
    var description : Text;
    var isActive    : Bool;
    var productCode : Text;
    var division    : Text;
    var mrpPaise    : Nat;    // MRP in paise (e.g. 10000 = ₹100.00)
    var packSize    : Text;
    createdAt       : Timestamp;
  };

  public type ProductInfo = {
    id          : ProductId;
    name        : Text;
    category    : ProductCategory;
    description : Text;
    isActive    : Bool;
    productCode : Text;
    division    : Text;
    mrpPaise    : Nat;
    packSize    : Text;
    createdAt   : Timestamp;
  };

  // ── Doctor ───────────────────────────────────────────────────────────────
  public type DoctorQualification = {
    #MBBS;
    #MD;
    #MS;
    #BDS;
    #MDS;
    #BAMS;
    #BHMS;
    #DNB;
    #DM;
    #MCh;
    #MBBSdgo;    // MBBS DGO
    #MBBSdnb;    // MBBS DNB
    #MBBSmd;     // MBBS MD
    #MBBSms;     // MBBS MS
    #MBBSent;    // MBBS ENT
    #MBBSortho;  // MBBS ORTHO
    #Other : Text;
  };

  public type Doctor = {
    id               : DoctorId;
    var name         : Text;
    var qualification: DoctorQualification;
    var station      : Text;  // city / town
    var area         : Text;
    var territory    : Text;
    var specialization : Text;
    var contactPhone : Text;
     var isActive     : Bool;
     var category     : Text;  // "A" | "B" | "C" or custom
     var email        : Text;
     var clinicName   : Text;
     var address      : Text;
     var isCoreDoctor : Bool;  // Core vs Non-Core classification
     var visitFrequencyTarget : Nat;  // minimum monthly visit target; 0 = no target
     createdBy        : UserId;  // MR who added this doctor
    createdAt        : Timestamp;
  };

  public type DoctorInfo = {
    id             : DoctorId;
    name           : Text;
    qualification  : DoctorQualification;
    station        : Text;
    area           : Text;
    territory      : Text;
    specialization : Text;
    contactPhone   : Text;
    isActive       : Bool;
    createdBy      : UserId;
    createdAt      : Timestamp;
    // Extended fields for HQ+Area matched results (may be empty text when not resolved)
    clinicName     : Text;
    address        : Text;
    hqId           : Nat;
    areaId         : Nat;
    email          : Text;
    category       : Text;
    assignedMRId   : Nat;
    dateOfBirth    : ?Text;  // ISO date "YYYY-MM-DD"; null if not set
    isCoreDoctor   : Bool;
    visitFrequencyTarget : Nat;
  };

  /// Products/samples an MR should detail to a specific doctor
  public type DoctorProductAssignment = {
    doctorId    : DoctorId;
    mrId        : UserId;
    productIds  : [ProductId]; // products to detail
    sampleIds   : [ProductId]; // products to give as samples
    updatedAt   : Timestamp;
  };

  // ── Chemist ──────────────────────────────────────────────────────────────
  public type Chemist = {
    id               : ChemistId;
    var name         : Text;
    var shopName     : Text;
    var address      : Text;
    var area         : Text;
    var territory    : Text;
    var contactPhone : Text;
    var isActive     : Bool;
    createdBy        : UserId;
    createdAt        : Timestamp;
  };

  public type ChemistInfo = {
    id           : ChemistId;
    name         : Text;
    shopName     : Text;
    address      : Text;
    area         : Text;
    territory    : Text;
    contactPhone : Text;
    isActive     : Bool;
    createdBy    : UserId;
    createdAt    : Timestamp;
  };

  // ── Chemist Orders ───────────────────────────────────────────────────────
  public type OrderStatus = {
    #Pending;
    #Confirmed;
    #Dispatched;
    #Delivered;
    #Cancelled;
  };

  public type OrderItem = {
    productId : ProductId;
    productName : Text;
    quantity  : Nat;
    scheme    : Text;  // e.g. "10+1", "5% off"
    unitPrice : Nat;   // in paise
  };

  public type ChemistOrder = {
    id             : OrderId;
    chemistId      : ChemistId;
    mrId           : UserId;
    date           : Text;       // ISO date "YYYY-MM-DD"
    var items      : [OrderItem];
    var totalValue : Nat;        // in paise
    var status     : OrderStatus;
    var remarks    : Text;
    gpsLocation    : ?GpsCoord;  // GPS when order was submitted
    createdAt      : Timestamp;
  };

  public type ChemistOrderInfo = {
    id          : OrderId;
    chemistId   : ChemistId;
    mrId        : UserId;
    date        : Text;
    items       : [OrderItem];
    totalValue  : Nat;
    status      : OrderStatus;
    remarks     : Text;
    gpsLocation : ?GpsCoord;
    createdAt   : Timestamp;
  };

  // ── Daily Call Reports ───────────────────────────────────────────────────
  public type WorkType = {
    #Field;
    #Office;
    #Leave;
    #Holiday;
  };

  public type ReportStatus = {
    #Draft;
    #Submitted;
    #Approved;
    #Rejected;
  };

  /// Station type for DA calculation — selected by MR when filling the daily report
  public type StationType = {
    #HQ;
    #ExStation;
    #OutStation;
  };

  public type DoctorVisitEntry = {
    doctorId      : DoctorId;
    notes         : Text;
    gps           : ?GpsCoord;   // GPS at time of visit
    productIds    : [ProductId]; // products discussed/detailed during this visit (multi-select)
    /// Per-product details discussed — array of (productId, detailsText) tuples.
    /// Defaults to [] for older entries that did not capture per-product details.
    detailsPerProduct : [(ProductId, Text)];
    /// Gift articles distributed to this doctor during this visit (V2 — references master by ID).
    giftArticles  : [GiftArticleDistributedV2];
    /// Samples given to this specific doctor during this visit.
    /// Defaults to [] for older entries.
    samplesDistributed : [SampleDistributed];
    // ── MR Portal tagging (optional — null on regular MR entries) ───────────
    submittedByRole     : ?Text; // primary role of submitter, e.g. "ASM", when via MR Portal
    submittedViaMRCharge : ?Bool; // true when submitted via MR Portal button
  };

  public type SampleDistributed = {
    productId : ProductId;
    quantity  : Nat;
  };

  /// Gift article distributed to a doctor during a visit — V2 uses master ID reference.
  /// Kept as a legacy alias pointing to the V2 type so existing consumers compile.
  public type GiftArticleDistributed = GiftArticleDistributedV2;

  public type CallReport = {
    id              : ReportId;
    mrId            : UserId;
    date            : Text;         // ISO date "YYYY-MM-DD"
    gps             : GpsCoord;     // location when report was submitted
    var doctorsVisited : [DoctorVisitEntry];
    var samplesDistributed : [SampleDistributed];
    var workType    : WorkType;
    var startLocation : GpsCoord;
    var endLocation   : GpsCoord;
    var remarks     : Text;
    var status      : ReportStatus;
    var reviewedBy  : ?UserId;      // ASM who approved/rejected
    var reviewNote  : Text;
    var reviewedAt  : ?Timestamp;
    var stationType : Text;         // "HQ" | "ExStation" | "OutStation"
    var daAmount    : Nat;          // calculated DA for the day (in paise), set on submit
    // ── Travel Plan / Working Mode fields ───────────────────────────────────
    var workingMode           : ?WorkingMode;          // #WorkingAlone | #WorkingWith
    var workingWithUserId     : ?UserId;               // selected higher authority's user ID
    var workingWithUserName   : ?Text;                 // display name of the authority
    var workingStation        : ?Text;                 // resolved station (from TP or manual)
    var workingStationSource  : ?WorkingStationSource; // #AsPerTP | #OtherStation
    createdAt       : Timestamp;
    var updatedAt   : Timestamp;
  };

  public type CallReportInfo = {
    id                 : ReportId;
    mrId               : UserId;
    date               : Text;
    gps                : GpsCoord;
    doctorsVisited     : [DoctorVisitEntry];
    samplesDistributed : [SampleDistributed];
    workType           : WorkType;
    startLocation      : GpsCoord;
    endLocation        : GpsCoord;
    remarks            : Text;
    status             : ReportStatus;
    reviewedBy         : ?UserId;
    reviewNote         : Text;
    reviewedAt         : ?Timestamp;
    stationType        : Text;
    daAmount           : Nat;
    // ── Travel Plan / Working Mode fields ───────────────────────────────────
    workingMode          : ?WorkingMode;
    workingWithUserId    : ?UserId;
    workingWithUserName  : ?Text;
    workingStation       : ?Text;
    workingStationSource : ?WorkingStationSource;
    createdAt          : Timestamp;
    updatedAt          : Timestamp;
  };

  // ── Report Details (daily report header — filled once per day) ───────────
  /// Represents the per-day Report Details section filled by a field employee.
  /// Doctor visits are stored separately and linked to this record by date + userId.
  public type ReportDetails = {
    id              : ReportId;
    userId          : UserId;
    date            : Text;          // ISO date "YYYY-MM-DD"
    var workType    : WorkType;
    var stationType : Text;          // "HQ" | "ExStation" | "OutStation"
    var workingStation : Text;       // resolved station name
    var workingMode : ?WorkingMode;  // #WorkingAlone | #WorkingWith
    var workingWith : ?Text;         // display name of authority worked with
    var daAmount    : Float;         // calculated DA for the day
    var gpsLat      : ?Float;
    var gpsLng      : ?Float;
    var remarks     : ?Text;
    createdAt       : Timestamp;
    var updatedAt   : Timestamp;
  };

  /// Public/shared view of ReportDetails (no mutable fields)
  public type ReportDetailsInfo = {
    id             : ReportId;
    userId         : UserId;
    date           : Text;
    workType       : WorkType;
    stationType    : Text;
    workingStation : Text;
    workingMode    : ?WorkingMode;
    workingWith    : ?Text;
    daAmount       : Float;
    gpsLat         : ?Float;
    gpsLng         : ?Float;
    remarks        : ?Text;
    createdAt      : Timestamp;
    updatedAt      : Timestamp;
  };

  /// Input for creating / upserting a daily ReportDetails record
  public type CreateReportDetailsInput = {
    date           : Text;
    workType       : WorkType;
    stationType    : Text;
    workingStation : Text;
    workingMode    : ?WorkingMode;
    workingWith    : ?Text;
    daAmount       : Float;
    gpsLat         : ?Float;
    gpsLng         : ?Float;
    remarks        : ?Text;
  };

  // ── DA Configuration ─────────────────────────────────────────────────────
  /// Per-role DA rate configuration, keyed by role name (e.g. "MR", "ASM", "RSM", "ZSM")
  public type DaConfig = {
    role           : Text;  // e.g. "MR", "ASM", "RSM", "ZSM"
    hqRate         : Nat;   // DA amount in paise for Head Quarter visits
    exStationRate  : Nat;   // DA amount in paise for Ex Station visits
    outStationRate : Nat;   // DA amount in paise for Out Station visits
  };

  // ── DA daily history row (returned by getMyDaHistory / getEmployeeDaHistory) ──
  /// Grade-based TA/DA configuration for pharma SFA compliance.
  /// Keyed by gradeName in the taDaGradeConfig map.
  public type TaDaGrade = {
    gradeName            : Text;  // e.g. "Grade-A", "Senior-MR", "Junior-MR"
    daHqRate             : Nat;   // DA for HQ day in paise
    daExStationRate      : Nat;   // DA for Ex-Station day in paise
    daOutStationRate     : Nat;   // DA for Out-Station day in paise
    taPerKmRate          : Nat;   // TA per km in paise (e.g. 275 = Rs 2.75/km)
    lodgingEntitlement   : Nat;   // Max lodging per night in paise (0 = not entitled)
    mealAllowance        : Nat;   // Meal allowance per day in paise (0 = not applicable)
  };

  public type DaHistoryRow = {
    date         : Text;  // ISO date "YYYY-MM-DD"
    doctorCount  : Nat;
    stationType  : Text;  // "HQ" | "ExStation" | "OutStation"
    daAmount     : Nat;   // in paise
  };

  // ── Analytics ────────────────────────────────────────────────────────────
  public type MrMonthlySummary = {
    mrId          : UserId;
    month         : Text;   // "YYYY-MM"
    totalCalls    : Nat;
    uniqueDoctors : Nat;
    totalOrders   : Nat;
    totalOrderValue : Nat;  // paise
  };

  public type TerritoryCoverage = {
    territory    : Text;
    totalDoctors : Nat;
    visitedThisMonth : Nat;
  };

  // ── Input types ──────────────────────────────────────────────────────────
  public type CreateProductInput = {
    name        : Text;
    category    : ProductCategory;
    description : Text;
    productCode : Text;
    division    : Text;
    mrpPaise    : Nat;
    packSize    : Text;
  };

  public type CreateDoctorInput = {
    name          : Text;
    qualification : DoctorQualification;
    station       : Text;
    area          : Text;
    territory     : Text;
    specialization : Text;
    contactPhone  : Text;
    dateOfBirth   : ?Text;  // ISO date "YYYY-MM-DD"; optional
  };

  public type CreateChemistInput = {
    name         : Text;
    shopName     : Text;
    address      : Text;
    area         : Text;
    territory    : Text;
    contactPhone : Text;
  };

  public type CreateOrderInput = {
    chemistId   : ChemistId;
    date        : Text;
    items       : [OrderItem];
    totalValue  : Nat;
    remarks     : Text;
    gpsLocation : ?GpsCoord;  // GPS when order is submitted
  };

  public type CreateReportInput = {
    date               : Text;
    gps                : GpsCoord;
    doctorsVisited     : [DoctorVisitEntry];
    samplesDistributed : [SampleDistributed];
    workType           : WorkType;
    startLocation      : GpsCoord;
    endLocation        : GpsCoord;
    remarks            : Text;
    stationType        : Text;  // "HQ" | "ExStation" | "OutStation"
    // ── Travel Plan / Working Mode fields ───────────────────────────────────
    workingMode          : ?WorkingMode;
    workingWithUserId    : ?UserId;
    workingWithUserName  : ?Text;
    workingStation       : ?Text;
    workingStationSource : ?WorkingStationSource;
  };

  public type AssignProductsInput = {
    doctorId   : DoctorId;
    productIds : [ProductId];
    sampleIds  : [ProductId];
  };

  public type MutationResult = CommonTypes.MutationResult;

  // ── Bulk import ──────────────────────────────────────────────────────────
  public type BulkImportDoctorInput = {
    name          : Text;
    qualification : Text;
    station       : Text;
    area          : Text;
    specialization : Text;
    contactPhone  : Text;
  };

  public type BulkImportChemistInput = {
    name         : Text;
    shopName     : Text;
    address      : Text;
    area         : Text;
    contactPhone : Text;
  };

  public type BulkImportResult = {
    succeeded : Nat;
    failed    : Nat;
    errors    : [Text];
  };

  /// Extended result from bulk doctor import — includes IDs and areas for later use
  public type BulkImportDoctorResult = {
    succeeded    : Nat;
    failed       : Nat;
    errors       : [Text];
    newDoctorIds : [(DoctorId, Text)];  // (doctorId, area) pairs
  };

  /// Re-export for convenient access in field-ops consumers
  public type ExportFilter = CommonTypes.ExportFilter;

  // ── MR Call Details Report (P3) ───────────────────────────────────────────

  public type SampleItem = {
    productName : Text;
    quantity    : Nat;
  };

  public type GiftItem = {
    itemName : Text;
    quantity : Nat;
  };

  /// One day's aggregated call summary for an MR
  public type DayCallSummary = {
    date             : Text;   // ISO date "YYYY-MM-DD"
    doctorCount      : Nat;
    doctorNames      : [Text];
    productsDiscussed : [Text];
    samplesGiven     : [SampleItem];
    giftsGiven       : [GiftItem];
    station          : Text;   // working station / area
    workingMode      : Text;   // "Solo", "With ASM", etc.
  };

  /// Summary totals across all days for an MR in a date range
  public type MRCallSummary = {
    totalDaysWorked   : Nat;
    totalDoctorVisits : Nat;
    totalSamplesGiven : Nat;
  };

  // ── Missed Doctor Visits (P4) ─────────────────────────────────────────────

  /// A doctor allotted to an MR who has been visited fewer than 2 times this month
  public type MissedDoctorInfo = {
    doctorId   : Nat;
    doctorName : Text;
    visitCount : Nat;
  };

  /// Per-MR summary for missed visit dashboard
  public type MRMissedSummary = {
    mrId         : Nat;
    mrName       : Text;
    totalAllotted : Nat;
    visited2Plus : Nat;
    visited0     : Nat;
    visited1     : Nat;
    totalMissed  : Nat;
  };

  // ── MR Portal Tagged Entries (P5) ─────────────────────────────────────────

  /// A call report entry submitted via MR Portal by a higher-authority employee
  public type TaggedCallEntry = {
    employeeId   : Nat;
    employeeName : Text;
    primaryRole  : Text;
    date         : Text;
    doctorsVisited     : [DoctorVisitEntry];
    samplesDistributed : [SampleDistributed];
  };

  // ── Missed Visit Alerts (20-day threshold) ────────────────────────────────

  /// An alert for a doctor under an MR that hasn't been visited in 20+ days
  public type MissedVisitAlert = {
    mrId             : Nat;
    mrName           : Text;
    doctorId         : Nat;
    doctorName       : Text;
    lastVisitDate    : Int;   // nanosecond timestamp of last visit; 0 = never visited
    daysSinceLastVisit : Int; // computed days; 999 if never visited
    area             : Text;
  };

  /// A dismissed alert record — per manager/user who dismissed
  public type DismissedAlert = {
    dismissedBy   : Nat;
    mrId          : Nat;
    doctorId      : Nat;
    dismissedDate : Int; // nanoseconds timestamp (day-level — only date matters)
  };

  // ── Doctor Visit Trend ────────────────────────────────────────────────────

  /// Visit percentage data for one MR in one calendar month
  public type MonthlyVisitData = {
    monthYear       : Text;   // "YYYY-MM"
    mrId            : Nat;
    mrName          : Text;
    visitPercentage : Float;
    doctorsVisited  : Nat;
    totalDoctors    : Nat;
  };

  /// Consolidated team average for one calendar month
  public type ConsolidatedMonthData = {
    monthYear          : Text;  // "YYYY-MM"
    avgVisitPercentage : Float;
    totalMRs           : Nat;
  };

  // ── Bulk Upload History ───────────────────────────────────────────────────

  /// A log entry for each bulk upload operation (doctors, chemists, stockists)
  public type BulkUploadRecord = {
    id          : Nat;
    uploadType  : Text;    // "doctors" | "chemists" | "stockists"
    uploadedBy  : Nat;
    uploadedAt  : Int;
    totalRows   : Nat;
    savedRows   : Nat;
    skippedRows : Nat;
    errors      : [Text];
  };

  // ── Bulk delete result ────────────────────────────────────────────────────

  public type BulkDeleteResult = {
    deleted : Nat;
    failed  : Nat;
  };

  // ── Call Reports Screen (detailed view with resolved names) ──────────────

  /// One product discussed in a doctor visit — with resolved name
  public type ProductVisitDetail = {
    productId        : ProductId;
    productName      : Text;
    detailsDiscussed : Text;
  };

  /// One sample given in a doctor visit — with resolved product name
  public type SampleGivenDetail = {
    productId   : ProductId;
    productName : Text;
    quantity    : Nat;
  };

  /// One gift given in a doctor visit — with resolved article name
  public type GiftGivenDetail = {
    articleId   : GiftArticleId;
    articleName : Text;
    quantity    : Nat;
  };

  /// Per-doctor visit within a call report, with all names resolved
  public type DoctorVisitDetail = {
    doctorId       : DoctorId;
    doctorName     : Text;
    specialization : Text;
    category       : Text;
    station        : Text;
    products       : [ProductVisitDetail];
    samplesGiven   : [SampleGivenDetail];
    giftsGiven     : [GiftGivenDetail];
    remarks        : Text;
  };

  /// Full call report detail returned by listCallReportsByMr — all names resolved
  public type CallReportDetail = {
    reportId     : ReportId;
    mrId         : UserId;
    mrName       : Text;
    date         : Text;          // ISO date "YYYY-MM-DD"
    submittedAt  : Timestamp;     // createdAt of the report
    doctorVisits : [DoctorVisitDetail];
  };

  // ── Audit log for doctor edit/delete ──────────────────────────────────────

  /// Action types tracked in the audit log
  public type AuditActionType = {
    #Edit;
    #Delete;
  };

  /// Audit trail for edit and delete of doctor records
  public type AllotmentAuditLog = {
    logId         : Nat;
    actionType    : AuditActionType;
    performedBy   : Nat;
    performedAt   : Int;
    doctorId      : ?Nat;
    doctorDetails : ?Text;
    mrId          : ?Nat;
    changes       : Text;
  };

  // ── Doctor Call Report (Last 30 Days) ─────────────────────────────────────

  public type DoctorCallReportEntry = {
    date             : Text;    // DD-MM-YYYY
    timeOfVisit      : ?Text;   // HH:MM
    doctorId         : Nat;
    doctorName       : Text;
    doctorSpeciality : Text;
    clinicHospitalName : Text;
    stationDayType   : Text;    // "HQ" | "Ex-Station" | "Out-Station"
    productsDetailed : [Text];  // brand names
    samplesGiven     : [{ productName : Text; quantity : Nat }];
    inputsGiven      : [{ itemName : Text; quantity : Nat }];
    gpsLocation      : ?Text;   // GPS-resolved address or area name
    dcrStatus        : Text;    // "Submitted" | "Auto-Submitted" | "Auto-Checkout Submitted" | "Draft" | "No Activity"
    employeeCode     : ?Text;   // populated in manager/HR/Admin views
  };

  public type DoctorCallReportSummary = {
    totalCalls             : Nat;
    totalUniqueDoctors     : Nat;
    totalProductsDetailed  : Nat;
    totalSamplesDistributed : Nat;
    totalInputsUsed        : Nat;
  };

  public type DoctorCallReportFilter = {
    mrId           : ?Nat;
    mrIds          : ?[Nat];
    fromDate       : Text;   // DD-MM-YYYY
    toDate         : Text;   // DD-MM-YYYY
    doctorNameSearch : ?Text;
    productFilter  : ?Text;
    dayTypeFilter  : ?Text;  // "HQ" | "Ex-Station" | "Out-Station"
    includeDrafts  : Bool;
    pageSize       : ?Nat;   // 25 or 50
    pageOffset     : ?Nat;
  };

  public type DoctorCallReportPage = {
    entries   : [DoctorCallReportEntry];
    summary   : DoctorCallReportSummary;
    totalRows : Nat;
    hasMore   : Bool;
  };

  public type MrDoctorCallReport = {
    mrId         : Nat;
    mrName       : Text;
    employeeCode : ?Text;
    report       : DoctorCallReportPage;
  };

  // ── MR grouped by ASM (for RSM/ZSM MR-Detail-Report dropdown) ────────

  /// One MR entry inside an ASM group
  public type MrGroupEntry = {
    mrId   : UserId;
    mrName : Text;
  };

  /// One ASM with all MRs who directly report to them
  public type AsmMrGroup = {
    asmId   : UserId;
    asmName : Text;
    mrs     : [MrGroupEntry];
  };
};
