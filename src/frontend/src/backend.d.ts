import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface BulkImportChemistInput {
    area: string;
    name: string;
    address: string;
    shopName: string;
    contactPhone: string;
}
export interface GpsActivityEntry {
    id: bigint;
    lat: number;
    lng: number;
    source: string;
    userId: UserId;
    capturedAt: Timestamp;
    accuracy?: number;
}
export interface SystemAlert {
    alertType: string;
    createdAt: bigint;
    alertId: bigint;
    message: string;
    severity: string;
}
export interface BookingRequestInfo {
    id: BookingId;
    status: BookingStatus;
    userName: string;
    userRole: string;
    userId: UserId;
    createdAt: Timestamp;
    rejectionReason?: string;
    reviewedAt?: Timestamp;
    reviewedBy?: UserId;
    updatedAt: Timestamp;
    targetDate: string;
    notes?: string;
    itemName: string;
    quantity: bigint;
    intendedUse: BookingIntendedUse;
}
export interface AbsenceInactivationLogView {
    hq: string;
    id: string;
    employeeCode: string;
    inactivatedAt: bigint;
    employeeName: string;
    source: string;
    reactivatedAt?: bigint;
    reactivatedBy?: string;
    role: string;
    isReactivated: boolean;
    absentDates: Array<string>;
    employeeId: string;
}
export interface EmployeeDeletionAuditEntry {
    dataArchivedSummary: string;
    deletedEmployeeName: string;
    deletedEmployeeId: string;
    deletedByUserId: string;
    deletedAt: bigint;
}
export interface CreateBottomUpTargetInput {
    period: TargetPeriod;
    userId: UserId;
    year: bigint;
    description?: string;
    targetAmount: bigint;
}
export interface MrDailyActivityRow {
    chemistVisitsToday: bigint;
    mrId: UserId;
    checkInTime?: bigint;
    mrName: string;
    checkInStatus: boolean;
    stockistVisitsToday: bigint;
    lastGpsTime?: bigint;
    dcrStatusToday: string;
    doctorCallsToday: bigint;
    lastGpsLat?: number;
    lastGpsLng?: number;
}
export interface CallReportInfo {
    id: ReportId;
    gps: GpsCoord;
    status: ReportStatus;
    workType: WorkType;
    samplesDistributed: Array<SampleDistributed>;
    daAmount: bigint;
    date: string;
    mrId: UserId;
    createdAt: Timestamp;
    reviewNote: string;
    workingStation?: string;
    reviewedAt?: Timestamp;
    reviewedBy?: UserId;
    updatedAt: Timestamp;
    doctorsVisited: Array<DoctorVisitEntry>;
    endLocation: GpsCoord;
    workingWithUserName?: string;
    workingMode?: WorkingMode;
    workingStationSource?: WorkingStationSource__1;
    workingWithUserId?: UserId;
    stationType: string;
    remarks: string;
    startLocation: GpsCoord;
}
export interface RepairResult {
    repairedTypes: Array<string>;
    updatedReport: HealthCheckReport;
    fixedCounts: Array<[string, bigint]>;
}
export type AbsenceResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface SalesTarget {
    id: SalesTargetId;
    month: bigint;
    userId: UserId;
    createdAt: Timestamp;
    year: bigint;
    description: string;
    targetAmount: number;
}
export type EmployeeId = bigint;
export interface ZoneRecord {
    id: LocationId;
    code: string;
    name: string;
    createdAt: Timestamp;
    isActive: boolean;
}
export interface BonusEntry {
    bonusType: string;
    amount: number;
    remarks?: string;
}
export interface StockistCallInput {
    productsDiscussed: Array<ProductEnquired>;
    station: string;
    area: string;
    date: string;
    stockistId: bigint;
    gpsLocation: GpsCoord;
    orderQty: string;
    stockistName: string;
    remarks: string;
}
export interface AssignAdditionalChargeInput {
    additionalArea?: string;
    additionalHqId?: bigint;
    additionalRole?: Role;
    additionalAreaId?: bigint;
    additionalHqAssignments?: Array<AdditionalHqAssignment>;
    effectiveTo: Timestamp;
    employeeId: UserId;
    chargeType: ChargeType;
    remarks?: string;
    effectiveFrom: Timestamp;
}
export interface PricelistProductInfo {
    id: PricelistProductId;
    mrp: number;
    ptr: number;
    pts: number;
    name: string;
    createdAt: Timestamp;
    srNo: bigint;
    updatedAt: Timestamp;
    composition: string;
}
export interface ChemistCallInfo {
    id: bigint;
    productsEnquired: Array<ProductEnquired>;
    station: string;
    area: string;
    date: string;
    mrId: UserId;
    createdAt: Timestamp;
    gpsLocation: GpsCoord;
    chemistId: bigint;
    chemistName: string;
    orderNoted: string;
    remarks: string;
}
export interface ExpenseSheetFilter {
    month?: bigint;
    paymentStatus?: PaymentStatus;
    year?: bigint;
    employeeId?: string;
}
export interface AdminKpis {
    totalActiveUsers: bigint;
    chemistVisitsToday: bigint;
    doctorCallsThisMonth: bigint;
    autoInactivatedPending: bigint;
    totalPendingApprovals: bigint;
    attendanceRateToday: number;
    doctorCallsToday: bigint;
    chemistVisitsThisMonth: bigint;
    systemAlertCount: bigint;
    usersByRole: Array<[string, bigint]>;
}
export type ChemistId = bigint;
export interface BulkSetMonthlyTargetsInput {
    month: bigint;
    rows: Array<BulkTargetRow>;
    year: bigint;
}
export type BusinessReportId = bigint;
export interface SaleProductEntry {
    mrp: number;
    ptr: number;
    pts: number;
    productId: bigint;
    productName: string;
    quantitySold: bigint;
    netSaleValue: number;
}
export type UserId = bigint;
export interface TerritoryCoverage {
    territory: string;
    totalDoctors: bigint;
    visitedThisMonth: bigint;
}
export interface SampleAllocationInput {
    month: bigint;
    mrId: UserId;
    year: bigint;
    productId: bigint;
    productName: string;
    allocatedQty: bigint;
    remarks: string;
}
export interface UpdateGiftArticleInput {
    name?: string;
    description?: string;
    isActive?: boolean;
    category?: string;
}
export interface BulkTargetRow {
    chemistTarget?: bigint;
    newDoctorsTarget?: bigint;
    userId: UserId;
    stockistTarget?: bigint;
    targetAmount: number;
    doctorCallTarget?: bigint;
    remarks?: string;
}
export type LoginResult = {
    __kind__: "ok";
    ok: Session;
} | {
    __kind__: "err";
    err: string;
};
export interface ApplyLeaveInput {
    attachmentUrl?: string;
    toDate: string;
    gpsLocation?: GpsCoord;
    numDays: bigint;
    notes?: string;
    fromDate: string;
    leaveType: LeaveType;
    reason: string;
}
export interface BulkGiftArticleImportError {
    row: bigint;
    name: string;
    reason: string;
}
export interface UpdateCompanyProfileInput {
    emailId?: string;
    website?: string;
    logoUrl?: string;
    address?: string;
    companyName?: string;
    contactNumber?: string;
}
export interface WorkingStyleRecord {
    id: string;
    additionalArea?: string;
    date: bigint;
    submittedAt: bigint;
    otherStationName?: string;
    workingWithName?: string;
    employeeId: string;
    workingMode: WorkingStyleMode;
    stationSource: WorkingStationSource;
    workingType?: string;
    workingWithUserId?: string;
}
export interface StateRecord {
    id: LocationId;
    name: string;
    createdAt: Timestamp;
    isActive: boolean;
    zoneId: LocationId;
}
export interface ReactivationLogEntry {
    employeeCode: string;
    employeeName: string;
    reactivatedByName: string;
    reactivatedAt: Timestamp;
    reactivatedBy: UserId;
    employeeId: UserId;
    needsReview: boolean;
}
export interface DayCallSummary {
    productsDiscussed: Array<string>;
    samplesGiven: Array<SampleItem>;
    station: string;
    date: string;
    giftsGiven: Array<GiftItem>;
    workingMode: string;
    doctorCount: bigint;
    doctorNames: Array<string>;
}
export interface CreateHQInput {
    name: string;
    territoryId: LocationId;
}
export interface BulkAddResult {
    added: bigint;
    errors: Array<string>;
}
export interface BulkStationImportRowResult {
    status: Variant_ok_error;
    rowIndex: bigint;
    stationName: string;
    hqName: string;
    errorReason?: string;
}
export interface UpdateSuggestionStatusInput {
    remark?: string;
    status: string;
    suggestionId: bigint;
}
export interface CrmExportRow {
    status: string;
    doctorId: bigint;
    userName: string;
    month: string;
    requestId: bigint;
    userId: string;
    salesTarget: number;
    doctorName: string;
    crmAmount: number;
    products: Array<string>;
}
export interface GiftGivenDetail {
    articleName: string;
    articleId: GiftArticleId;
    quantity: bigint;
}
export interface InvalidHqEmployee {
    primaryHqId?: LocationId;
    userId: UserId;
    name: string;
    role: string;
    expectedLevel: LocationLevel;
    employeeId: string;
    reason: string;
}
export interface AttendanceCorrectionInput {
    date: string;
    employeeId: bigint;
    newStatus: AttendanceStatus;
    reason: string;
}
export interface IncentiveSlab {
    value: number;
    maxAchievementPct: number;
    incentiveType: IncentiveType;
    minAchievementPct: number;
}
export interface AreaRecord {
    id: LocationId;
    hqId: LocationId;
    name: string;
    createdAt: Timestamp;
    isActive: boolean;
}
export interface DcrApprovalInput {
    remark: string;
    status: DcrStatus;
    dcrId: bigint;
}
export interface MonthlyVisitData {
    visitPercentage: number;
    mrId: bigint;
    mrName: string;
    doctorsVisited: bigint;
    totalDoctors: bigint;
    monthYear: string;
}
export interface CompanyHoliday {
    id: bigint;
    holidayType: HolidayType;
    date: bigint;
    name: string;
    createdAt: bigint;
    createdBy: string;
    isActive: boolean;
    applicableTo: HolidayApplicableTo;
    remarks?: string;
}
export interface CrmDoctorSaleFilter {
    doctorId?: bigint;
    submittedBy?: UserId;
    toDate?: Timestamp;
    fromDate?: Timestamp;
    areaId?: bigint;
}
export interface TargetRevision {
    revisedAt: Timestamp;
    revisedBy: UserId;
    newAmount: number;
    previousAmount: number;
    remarks?: string;
}
export interface SecondarySaleRecord {
    id: SecondarySaleId;
    totalNetSaleValue: number;
    hqId: bigint;
    createdAt: Timestamp;
    submittedBy: UserId;
    stockistId: bigint;
    areaId: bigint;
    products: Array<SaleProductEntry>;
    saleDate: Timestamp;
}
export interface ChemistOrderInfo {
    id: OrderId;
    status: OrderStatus;
    totalValue: bigint;
    date: string;
    mrId: UserId;
    createdAt: Timestamp;
    gpsLocation?: GpsCoord;
    chemistId: ChemistId;
    items: Array<OrderItem>;
    remarks: string;
}
export interface CreateUserInput {
    territory: string;
    reportsTo?: UserId;
    primaryHqId?: LocationId;
    salary: SalaryComponents;
    username: string;
    hqIds?: Array<bigint>;
    joinDate: string;
    dateOfBirth?: string;
    password: string;
    name: string;
    designation: string;
    role: Role;
    stateIds?: Array<bigint>;
    hqAssignments?: Array<HqAssignment>;
    email: string;
    employeeId: string;
    areaIds?: Array<bigint>;
    phone: string;
    department: string;
    zoneIds?: Array<bigint>;
    territoryIds?: Array<bigint>;
}
export interface CreateSalesTargetInput {
    month: bigint;
    year: bigint;
    description: string;
    targetAmount: number;
}
export interface TargetVsActual {
    territory?: string;
    month: bigint;
    area?: string;
    userId: UserId;
    name: string;
    role: Role;
    year: bigint;
    actualAmount: number;
    employeeId: string;
    targetAmount: number;
    achievementPct: number;
    remainingTarget: number;
}
export type SalesTargetId = bigint;
export interface SetMonthlyTargetInput {
    month: bigint;
    chemistTarget?: bigint;
    newDoctorsTarget?: bigint;
    userId: UserId;
    year: bigint;
    stockistTarget?: bigint;
    targetAmount: number;
    productTargets?: Array<ProductTarget>;
    doctorCallTarget?: bigint;
    remarks?: string;
}
export interface GpsActivityFilter {
    dateTo?: string;
    userId?: UserId;
    role?: Role;
    dateFrom?: string;
}
export interface IncentiveBonusSheet {
    id: string;
    bonusEntries: Array<BonusEntry>;
    paymentStatus: PaymentStatus;
    generatedAt: bigint;
    quarter: bigint;
    year: bigint;
    totalBonusAmount: number;
    totalIncentiveAmount: number;
    markedPaidBy?: string;
    monthlyBreakdown: Array<IncentiveMonthEntry>;
    employeeId: string;
    totalAmount: number;
    paymentDate?: bigint;
}
export interface CreateCrmDoctorSaleRequest {
    doctorId: bigint;
    products: Array<DoctorSaleProductEntry>;
    saleDate: Timestamp;
}
export interface DcrReminderStatus {
    deadlineHour: bigint;
    checkedIn: boolean;
    dcrSubmitted: boolean;
}
export interface StockistRecord {
    id: StockistId;
    emailId?: string;
    drugLicenseNumber?: string;
    gstNumber?: string;
    hqId: bigint;
    name: string;
    createdAt: Timestamp;
    createdBy: UserId;
    mobileNumber: string;
    isActive: boolean;
    address: string;
    areaId: bigint;
    proprietorName: string;
    remarks?: string;
}
export type DoctorQualification = {
    __kind__: "DM";
    DM: null;
} | {
    __kind__: "MD";
    MD: null;
} | {
    __kind__: "MS";
    MS: null;
} | {
    __kind__: "BDS";
    BDS: null;
} | {
    __kind__: "DNB";
    DNB: null;
} | {
    __kind__: "MCh";
    MCh: null;
} | {
    __kind__: "MDS";
    MDS: null;
} | {
    __kind__: "MBBSdgo";
    MBBSdgo: null;
} | {
    __kind__: "MBBSdnb";
    MBBSdnb: null;
} | {
    __kind__: "MBBSent";
    MBBSent: null;
} | {
    __kind__: "BAMS";
    BAMS: null;
} | {
    __kind__: "BHMS";
    BHMS: null;
} | {
    __kind__: "MBBS";
    MBBS: null;
} | {
    __kind__: "MBBSortho";
    MBBSortho: null;
} | {
    __kind__: "Other";
    Other: string;
} | {
    __kind__: "MBBSmd";
    MBBSmd: null;
} | {
    __kind__: "MBBSms";
    MBBSms: null;
};
export interface LeaveApplication {
    id: bigint;
    attachmentUrl?: string;
    status: LeaveStatus;
    appliedAt: Timestamp;
    approvedBy?: EmployeeId;
    approverId?: EmployeeId;
    approverRemark?: string;
    toDate: string;
    gpsLocation?: GpsCoord;
    updatedAt: Timestamp;
    employeeId: EmployeeId;
    numDays: bigint;
    notes?: string;
    fromDate: string;
    leaveType: LeaveType;
    reason: string;
}
export type ProductId = bigint;
export interface ReportingChainEntry {
    userId: UserId;
    name: string;
    role: string;
}
export interface CreateLetterInput {
    status: LetterStatus;
    employeeName?: string;
    subject: string;
    body: string;
    date: string;
    letterType: LetterType;
    employeeId?: bigint;
    details?: LetterDetails;
    recipientName: string;
}
export interface LetterDetails {
    promotionEffectiveDate?: string;
    confirmationDate?: string;
    currentPosting?: string;
    revisedSalary?: bigint;
    incrementEffectiveDate?: string;
    newPosting?: string;
    warningReason?: string;
    incrementAmount?: bigint;
    finalSettlementRef?: string;
    newHQ?: string;
    revisedDesignation?: string;
    promotedSalary?: bigint;
    resignationDate?: string;
    lastWorkingDay?: string;
    newGrade?: string;
    currentDesignation?: string;
    probationEndDate?: string;
    transferEffectiveDate?: string;
    newSalary?: bigint;
    newDesignation?: string;
    disciplinaryAction?: string;
    currentSalary?: bigint;
}
export interface UpdateStationInput {
    isActive?: boolean;
    stationName?: string;
}
export interface UpdateLetterInput {
    status?: LetterStatus;
    subject?: string;
    body?: string;
    date?: string;
    details?: LetterDetails;
    recipientName?: string;
}
export interface ExpenseSheet {
    id: string;
    lineItems: Array<ExpenseLineItem>;
    month: bigint;
    paymentStatus: PaymentStatus;
    generatedAt: bigint;
    year: bigint;
    markedPaidBy?: string;
    employeeId: string;
    totalAmount: number;
    paymentDate?: bigint;
}
export type CrmDoctorSaleId = bigint;
export interface HealthAnomaly {
    anomalyType: string;
    description: string;
    affectedIds: Array<string>;
}
export interface ChemistCallInput {
    productsEnquired: Array<ProductEnquired>;
    station: string;
    area: string;
    date: string;
    gpsLocation: GpsCoord;
    chemistId: bigint;
    chemistName: string;
    orderNoted: string;
    remarks: string;
}
export interface CreateChemistInput {
    territory: string;
    area: string;
    name: string;
    address: string;
    shopName: string;
    contactPhone: string;
}
export interface CreateAreaInput {
    hqId: LocationId;
    name: string;
}
export interface BulkStationImportResult {
    skipped: bigint;
    totalRows: bigint;
    saved: bigint;
    rowResults: Array<BulkStationImportRowResult>;
    uploadedAt: bigint;
    uploadedBy: string;
}
export interface ProductCommitment {
    productId: ProductId;
    productName: string;
    expectedQuantity: bigint;
}
export interface CreateTerritoryInput {
    stateId: LocationId;
    name: string;
}
export interface AttendanceRecord {
    id: bigint;
    status: AttendanceStatus;
    date: string;
    checkInTime?: string;
    recordedAt: Timestamp;
    employeeId: EmployeeId;
    correctionAt?: Timestamp;
    correctedBy?: string;
    correctionRemark?: string;
    checkInGps?: GpsCoord;
    holidayId?: bigint;
    leaveApplicationId?: bigint;
}
export interface SampleAllocationInfo {
    id: bigint;
    month: bigint;
    mrId: UserId;
    year: bigint;
    productId: bigint;
    productName: string;
    usedQty: bigint;
    allocatedQty: bigint;
    allocatedAt: Timestamp;
    allocatedBy: UserId;
    remarks: string;
}
export interface CreateIncentivePlanInput {
    month: bigint;
    period: TargetPeriod;
    role: Role;
    year: bigint;
    slabs: Array<IncentiveSlab>;
}
export interface CreateBusinessReportInput {
    doctorId: DoctorId;
    month: bigint;
    year: bigint;
    prescriptionCount: bigint;
    reportNotes?: string;
    linkedCrmRequestId?: CrmRequestId;
    doctorName: string;
    actualSales: number;
}
export interface SubmitSuggestionInput {
    attachmentUrl?: string;
    subject: string;
    description: string;
    submissionType: string;
    priority: string;
}
export interface BulkUploadResult {
    errors: Array<string>;
    failed: bigint;
    succeeded: bigint;
}
export interface StockistFilter {
    hqId?: bigint;
    isActive?: boolean;
    areaId?: bigint;
    nameSearch?: string;
}
export interface GpsOverrideEntry {
    id: bigint;
    active: boolean;
    grantedBy: UserId;
    overrideDate?: string;
    employeeId: UserId;
    timestamp: bigint;
    reason: string;
}
export interface BusinessReportInfo {
    id: BusinessReportId;
    doctorId: DoctorId;
    month: bigint;
    userId: UserId;
    createdAt: Timestamp;
    year: bigint;
    prescriptionCount: bigint;
    reportNotes?: string;
    linkedCrmRequestId?: CrmRequestId;
    doctorName: string;
    actualSales: number;
}
export interface MonthlyTargetFilter {
    territory?: string;
    month?: bigint;
    area?: string;
    userId?: UserId;
    role?: Role;
    year?: bigint;
}
export interface ZsmKpis {
    pendingApprovals: bigint;
    zoneDoctorCallsTarget: bigint;
    mrsNotCheckedInToday: bigint;
    mtpAdherenceRate: number;
    zoneChemistVisits: bigint;
    zoneDcrRate: number;
    totalMrsInZone: bigint;
    zoneDoctorCallsCount: bigint;
}
export interface UpdateLeaveStatusInput {
    remark?: string;
    status: LeaveStatus;
    leaveId: string;
    approverId: EmployeeId;
}
export interface IncentiveBonusSheetFilter {
    paymentStatus?: PaymentStatus;
    quarter?: bigint;
    year?: bigint;
    employeeId?: string;
}
export interface DoctorSaleProductEntry {
    saleValue: number;
    productId: bigint;
    productName: string;
    quantity: bigint;
    remarks?: string;
}
export interface CreateAdvanceInput {
    installmentStartYear: bigint;
    employeeId: string;
    advanceAmount: number;
    advanceDate: bigint;
    installmentStartMonth: bigint;
    totalInstallments: bigint;
    remarks?: string;
    reason: string;
}
export interface IncentiveFilter {
    status?: IncentiveCalculationStatus;
    month?: bigint;
    period?: TargetPeriod;
    userId?: UserId;
    role?: Role;
    year?: bigint;
}
export type SecondarySaleId = bigint;
export interface SampleDistributed {
    productId: ProductId;
    quantity: bigint;
}
export interface AdditionalCharge {
    id: string;
    additionalArea?: string;
    additionalHqId?: bigint;
    additionalRole?: Role;
    additionalAreaId?: bigint;
    additionalHqAssignments: Array<AdditionalHqAssignment>;
    assignedAt: Timestamp;
    assignedBy: UserId;
    effectiveTo: Timestamp;
    updatedAt: Timestamp;
    employeeId: UserId;
    chargeType: ChargeType;
    remarks?: string;
    effectiveFrom: Timestamp;
}
export interface BulkImportDoctorInput {
    station: string;
    area: string;
    name: string;
    specialization: string;
    qualification: string;
    contactPhone: string;
}
export interface TargetAdjustmentLog {
    id: bigint;
    month?: bigint;
    changedAt: Timestamp;
    changedBy: UserId;
    period: TargetPeriod;
    userId: UserId;
    role: Role;
    year: bigint;
    newValue: number;
    previousValue: number;
    reason?: string;
}
export interface DcrSettingsInfo {
    isEnabled: boolean;
    dailyDeadlineMinute: bigint;
    dailyDeadlineHour: bigint;
}
export interface BulkDeleteResult {
    deleted: bigint;
    failed: bigint;
}
export interface SuggestionFilter {
    status?: string;
    employeeName?: string;
    submittedByRole?: string;
    toDate?: bigint;
    fromDate?: bigint;
    submissionType?: string;
    priority?: string;
}
export type Timestamp = bigint;
export interface LocationHierarchyPath {
    level: LocationLevel;
    stationId?: LocationId;
    locationId: LocationId;
    zoneName?: string;
    areaName?: string;
    areaId?: LocationId;
    locationName: string;
    regionId?: LocationId;
    regionName?: string;
    stationName?: string;
    zoneId?: LocationId;
}
export interface BulkStockistInput {
    drugLicenseNumber?: string;
    gstNumber?: string;
    name: string;
    mobileNumber: string;
    address: string;
    areaId: bigint;
    proprietorName: string;
    remarks?: string;
}
export interface MonthlySummary {
    payableDays: bigint;
    month: bigint;
    halfDays: bigint;
    holidays: bigint;
    presentDays: bigint;
    year: bigint;
    employeeId: EmployeeId;
    weeklyOffs: bigint;
    absentDays: bigint;
    leaveDays: bigint;
}
export interface ChemistInfo {
    id: ChemistId;
    territory: string;
    area: string;
    name: string;
    createdAt: Timestamp;
    createdBy: UserId;
    isActive: boolean;
    address: string;
    shopName: string;
    contactPhone: string;
}
export interface SalesDashboardSummary {
    totalActualSales: number;
    overallProgressPercent: number;
    totalCrmSpent: number;
    doctorBreakdown: Array<SalesTrackingData>;
}
export type ReportId = bigint;
export interface UpdateStockistRequest {
    id: StockistId;
    emailId?: string;
    drugLicenseNumber?: string;
    gstNumber?: string;
    name?: string;
    mobileNumber?: string;
    isActive?: boolean;
    address?: string;
    areaId?: bigint;
    proprietorName?: string;
    remarks?: string;
}
export interface ProductVisitDetail {
    detailsDiscussed: string;
    productId: ProductId;
    productName: string;
}
export interface RepairLog {
    fixedCount: bigint;
    repairType: string;
    triggeredBy: string;
    timestamp: bigint;
    details: string;
}
export interface UpdateAdvanceInput {
    installmentAmount?: number;
    totalInstallments?: bigint;
    remarks?: string;
}
export interface AttendanceCheckIn {
    status: CheckInStatus;
    gpsCoord: GpsCoord;
    wasAutoCheckedOut: boolean;
    userId: UserId;
    date: string;
    distance: number;
    recordedAt: Timestamp;
    matchedLocation?: string;
    checkOutTime?: Timestamp;
    checkOutGps?: GpsCoord;
}
export interface ProductInfo {
    id: ProductId;
    packSize: string;
    name: string;
    createdAt: Timestamp;
    division: string;
    productCode: string;
    description: string;
    isActive: boolean;
    category: ProductCategory;
    mrpPaise: bigint;
}
export type BookingId = bigint;
export interface OnLeaveEmployee {
    leaveId: bigint;
    approvedByName: string;
    employeeName: string;
    approvedAt?: bigint;
    role: string;
    toDate: string;
    employeeId: string;
    fromDate: string;
    leaveType: string;
    reason: string;
}
export interface UpdateUserInput {
    territory?: string;
    reportsTo?: UserId | null;
    status?: UserStatus;
    primaryHqId?: LocationId;
    salary?: SalaryComponents;
    hqIds?: Array<bigint>;
    joinDate?: string;
    dateOfBirth?: string;
    name?: string;
    designation?: string;
    role?: Role;
    stateIds?: Array<bigint>;
    hqAssignments?: Array<HqAssignment>;
    newPassword?: string;
    email?: string;
    areaIds?: Array<bigint>;
    phone?: string;
    department?: string;
    zoneIds?: Array<bigint>;
    territoryIds?: Array<bigint>;
}
export interface UpdateHolidayInput {
    id: bigint;
    holidayType?: HolidayType;
    date?: bigint;
    name?: string;
    isActive?: boolean;
    applicableTo?: HolidayApplicableTo;
    remarks?: string;
}
export interface CrmDoctorSaleRecord {
    id: CrmDoctorSaleId;
    doctorId: bigint;
    createdAt: Timestamp;
    submittedBy: UserId;
    areaId: bigint;
    products: Array<DoctorSaleProductEntry>;
    totalSaleValue: number;
    saleDate: Timestamp;
}
export interface IncentiveMonthEntry {
    month: bigint;
    year: bigint;
    incentiveAmount: number;
    achievementPct: number;
    slabApplied: string;
}
export interface OverrideBottomUpTargetInput {
    newAmount: bigint;
    targetId: bigint;
    overrideReason: string;
}
export interface CreateCrmRequestInput {
    doctorId: DoctorId;
    requestNotes?: string;
    productCommitments: Array<ProductCommitment>;
    doctorName: string;
    crmAmount: number;
    salesTargetId?: SalesTargetId;
}
export interface BulkImportResult {
    errors: Array<string>;
    failed: bigint;
    succeeded: bigint;
}
export interface ExpenseLineItem {
    expenseType: string;
    sourceCallReportId?: string;
    date: bigint;
    description?: string;
    amount: number;
}
export interface RoleLeaveQuota {
    plTotal: bigint;
    coTotal: bigint;
    unpaidTotal: bigint;
    casualTotal: bigint;
    role: Role;
    year: bigint;
    mlTotal: bigint;
    sickTotal: bigint;
    lwpTotal: bigint;
}
export interface CreateSecondarySaleRequest {
    stockistId: bigint;
    products: Array<SaleProductEntry>;
    saleDate: Timestamp;
}
export interface IncentivePlan {
    id: bigint;
    month: bigint;
    period: TargetPeriod;
    createdAt: Timestamp;
    createdBy: UserId;
    role: Role;
    year: bigint;
    isActive: boolean;
    slabs: Array<IncentiveSlab>;
    updatedAt: Timestamp;
}
export interface TerritoryRecord {
    id: LocationId;
    stateId: LocationId;
    name: string;
    createdAt: Timestamp;
    isActive: boolean;
}
export interface CoverageRow {
    station: string;
    period: string;
    area: string;
    mrId: UserId;
    mrName: string;
    chemistVisits: bigint;
    stockistVisits: bigint;
}
export interface DaReportRow {
    userName: string;
    daAmount: number;
    userId: string;
    date: string;
    role: string;
    stationType: string;
}
export type OrderId = bigint;
export interface MrGroupEntry {
    mrId: UserId;
    mrName: string;
}
export interface PerformanceRow {
    territory?: string;
    projectedAchievement: number;
    area?: string;
    userId: UserId;
    name: string;
    role: Role;
    performanceStatus: PerformanceStatus;
    employeeId: string;
    targetAmount: number;
    achievementPct: number;
    remainingTarget: number;
    actualSales: number;
}
export interface CreateGiftArticleInput {
    name: string;
    description: string;
    category: string;
}
export interface HolidayExportRow {
    holidayType: string;
    date: bigint;
    dayOfWeek: string;
    name: string;
    srNo: bigint;
    applicableTo: string;
}
export interface DaHistoryRow {
    daAmount: bigint;
    date: string;
    doctorCount: bigint;
    stationType: string;
}
export interface AsmMrGroup {
    mrs: Array<MrGroupEntry>;
    asmId: UserId;
    asmName: string;
}
export interface ExpenseClaimSummaryRow {
    totalClaimed: number;
    byType: Array<[string, number]>;
    doctorCallsInPeriod: bigint;
    chemistVisitsInPeriod: bigint;
    mrId: UserId;
    mrName: string;
    stockistVisitsInPeriod: bigint;
}
export interface NotificationRecord {
    id: string;
    title: string;
    relatedEntityType?: string;
    body: string;
    notificationType: NotificationType;
    createdAt: bigint;
    isRead: boolean;
    relatedEntityId?: string;
    recipientId: string;
    senderId: string;
}
export interface DoctorInfo {
    id: DoctorId;
    territory: string;
    station: string;
    dateOfBirth?: string;
    area: string;
    hqId: bigint;
    name: string;
    createdAt: Timestamp;
    createdBy: UserId;
    visitFrequencyTarget: bigint;
    isActive: boolean;
    email: string;
    address: string;
    specialization: string;
    category: string;
    areaId: bigint;
    assignedMRId: bigint;
    clinicName: string;
    isCoreDoctor: boolean;
    qualification: DoctorQualification;
    contactPhone: string;
}
export interface DoctorVisitExportRow {
    doctorId: bigint;
    userName: string;
    samplesDistributed: Array<string>;
    productsDiscussed: Array<string>;
    daAmount: bigint;
    userId: string;
    date: string;
    role: string;
    giftArticles: Array<string>;
    reportId: bigint;
}
export interface DcrSummaryRow {
    totalStockists: bigint;
    status: DcrStatus;
    date: string;
    mrId: UserId;
    isLate: boolean;
    mrName: string;
    totalDoctors: bigint;
    totalChemists: bigint;
}
export interface IncentiveCalculation {
    id: bigint;
    status: IncentiveCalculationStatus;
    month?: bigint;
    period: TargetPeriod;
    userId: UserId;
    approvedBy?: UserId;
    role: Role;
    year: bigint;
    calculatedAt: Timestamp;
    incentiveAmount: number;
    actualAmount: number;
    targetAmount: number;
    aggregatedTarget: number;
    notes?: string;
    achievementPct: number;
    adjustedAmount?: number;
    slabApplied: string;
}
export interface MrMonthlySummary {
    month: string;
    totalOrders: bigint;
    totalOrderValue: bigint;
    totalCalls: bigint;
    mrId: UserId;
    uniqueDoctors: bigint;
}
export interface LeaveExportRow {
    remark?: string;
    status: string;
    appliedAt: string;
    leaveId: string;
    employeeName: string;
    role: string;
    toDate: string;
    approverName?: string;
    employeeId: string;
    numDays: bigint;
    fromDate: string;
    leaveType: string;
    reason: string;
}
export interface MonthlyTarget {
    id: string;
    month: bigint;
    chemistTarget: bigint;
    newDoctorsTarget: bigint;
    userId: UserId;
    revisionHistory: Array<TargetRevision>;
    createdAt: Timestamp;
    createdBy: UserId;
    role: Role;
    year: bigint;
    updatedAt: Timestamp;
    updatedBy: UserId;
    stockistTarget: bigint;
    targetAmount: number;
    productTargets: Array<ProductTarget>;
    doctorCallTarget: bigint;
    remarks?: string;
}
export interface JfwInput {
    date: string;
    mrId: UserId;
    stationVisited: string;
    rating: JfwRating;
    areaVisited: string;
    observations: string;
    doctorsJointlyVisited: Array<DoctorVisited>;
}
export interface DoctorVisitDetail {
    doctorId: DoctorId;
    samplesGiven: Array<SampleGivenDetail>;
    station: string;
    giftsGiven: Array<GiftGivenDetail>;
    specialization: string;
    category: string;
    doctorName: string;
    products: Array<ProductVisitDetail>;
    remarks: string;
}
export interface HQRecord {
    id: LocationId;
    name: string;
    createdAt: Timestamp;
    territoryId: LocationId;
    isActive: boolean;
}
export interface EmpIdConfig {
    padWidth: bigint;
    startingNumber: bigint;
    roleKey: string;
    prefix: string;
}
export interface DataCleanupLog {
    id: bigint;
    status: string;
    recordsDeleted: Array<[string, bigint]>;
    adminUsername: string;
    timestamp: bigint;
    reason: string;
}
export interface HqAssignment {
    hqId: LocationId;
    stationIds: Array<LocationId>;
    areaIds: Array<LocationId>;
    exStationIds: Array<LocationId>;
}
export interface TaDaExpense {
    id: bigint;
    status: ExpenseStatus;
    dailyAllowance: bigint;
    miscNarration?: string;
    totalClaimAmount?: bigint;
    submittedByRole: string;
    date: string;
    approvedBy?: EmployeeId;
    toLocation?: string;
    modeOfTransport?: string;
    lodgingExpense?: bigint;
    submittedAt: Timestamp;
    travelAmount: bigint;
    gradeName?: string;
    gpsLocation?: GpsCoord;
    updatedAt: Timestamp;
    fromLocation?: string;
    distanceKm: bigint;
    miscExpense?: bigint;
    employeeId: EmployeeId;
    totalAmount: bigint;
    stationType: StationType;
    purpose: string;
}
export type StockistId = bigint;
export interface JfwInfo {
    id: bigint;
    mrAcknowledged: boolean;
    date: string;
    mrId: UserId;
    createdAt: Timestamp;
    mrName: string;
    managerId: UserId;
    stationVisited: string;
    rating: JfwRating;
    areaVisited: string;
    observations: string;
    mrAcknowledgedAt?: Timestamp;
    doctorsJointlyVisited: Array<DoctorVisited>;
}
export interface JfwSummaryRow {
    period: string;
    mrId: UserId;
    mrName: string;
    jfwCount: bigint;
    managerId: UserId;
    avgRating: number;
    managerName: string;
}
export interface ExportFilter {
    month?: string;
    endDate?: string;
    userId?: string;
    role?: string;
    startDate?: string;
}
export interface DaConfig {
    exStationRate: bigint;
    role: string;
    outStationRate: bigint;
    hqRate: bigint;
}
export interface UpdateAdditionalChargeInput {
    additionalHqAssignments?: Array<AdditionalHqAssignment>;
    effectiveTo?: Timestamp;
    chargeId: string;
    remarks?: string;
    effectiveFrom?: Timestamp;
}
export interface CrmRequestInfo {
    id: CrmRequestId;
    status: CrmStatus;
    doctorId: DoctorId;
    requestNotes?: string;
    userId: UserId;
    approvedAt?: Timestamp;
    approvedBy?: UserId;
    createdAt: Timestamp;
    rejectionReason?: string;
    productCommitments: Array<ProductCommitment>;
    updatedAt: Timestamp;
    doctorName: string;
    crmAmount: number;
    salesTargetId?: SalesTargetId;
}
export interface CreateProductInput {
    packSize: string;
    name: string;
    division: string;
    productCode: string;
    description: string;
    category: ProductCategory;
    mrpPaise: bigint;
}
export interface CallReportExportRow {
    status: string;
    userName: string;
    daAmount: bigint;
    userId: string;
    date: string;
    role: string;
    doctorCount: bigint;
    stationType: string;
    reportId: bigint;
}
export interface GiftArticleInfo {
    id: GiftArticleId;
    name: string;
    createdAt: Timestamp;
    createdBy: UserId;
    description: string;
    isActive: boolean;
    category: string;
}
export interface BulkGiftArticleImportResult {
    created: bigint;
    skipped: bigint;
    errors: Array<BulkGiftArticleImportError>;
    totalRows: bigint;
}
export interface AssignProductsInput {
    doctorId: DoctorId;
    productIds: Array<ProductId>;
    sampleIds: Array<ProductId>;
}
export interface RsmKpis {
    regionChemistVisits: bigint;
    pendingApprovals: bigint;
    regionDcrRate: number;
    mrsNotCheckedInToday: bigint;
    mtpAdherenceRate: number;
    regionDoctorCallsCount: bigint;
    regionDoctorCallsTarget: bigint;
    totalMrsInRegion: bigint;
    directMrCount: bigint;
}
export interface TargetAdjustmentFilter {
    changedBy?: UserId;
    endDate?: string;
    period?: TargetPeriod;
    userId?: UserId;
    role?: Role;
    year?: bigint;
    startDate?: string;
}
export interface CreateStationInput {
    hqId: LocationId;
    stationName: string;
}
export interface TaDaGrade {
    daHqRate: bigint;
    taPerKmRate: bigint;
    daExStationRate: bigint;
    lodgingEntitlement: bigint;
    gradeName: string;
    daOutStationRate: bigint;
    mealAllowance: bigint;
}
export interface UpdateStateInput {
    name?: string;
    zoneId?: LocationId;
}
export interface TravelPlanExportRow {
    status: string;
    userName: string;
    plannedStation: string;
    planId: bigint;
    userId: string;
    date: string;
    role: string;
    notes: string;
}
export interface ProductEnquired {
    enquiryType: string;
    productId: bigint;
    productName: string;
}
export interface UserWithPrimaryHq {
    primaryHqId?: LocationId;
    userId: UserId;
    name: string;
    role: string;
    employeeId: string;
    hqName: string;
}
export interface SalesTrackingData {
    doctorId: DoctorId;
    crmSpent: number;
    projectedEndTarget: number;
    salesProgressPercent: number;
    dailyAvgSales: number;
    doctorName: string;
    actualSales: number;
}
export interface CreateAdminMessageInput {
    title: string;
    content: string;
    scheduledDate?: string;
    attachmentUrls: Array<string>;
}
export type EmployeeDeletionResult = {
    __kind__: "ok";
    ok: {
        employeeId: string;
        archivedAt: bigint;
    };
} | {
    __kind__: "err";
    err: {
        code: string;
        message: string;
    };
};
export interface BulkUploadRecord {
    id: bigint;
    skippedRows: bigint;
    errors: Array<string>;
    totalRows: bigint;
    savedRows: bigint;
    uploadType: string;
    uploadedAt: bigint;
    uploadedBy: bigint;
}
export interface GiftItem {
    itemName: string;
    quantity: bigint;
}
export type GiftArticleId = bigint;
export interface CreateStockistRequest {
    emailId?: string;
    drugLicenseNumber?: string;
    gstNumber?: string;
    name: string;
    mobileNumber: string;
    address: string;
    areaId: bigint;
    proprietorName: string;
    remarks?: string;
}
export interface SampleUsageInput {
    doctorId: bigint;
    productId: bigint;
    productName: string;
    qtyUsed: bigint;
    doctorName: string;
}
export type TravelPlanId = bigint;
export interface SecondarySaleFilter {
    submittedBy?: UserId;
    stockistId?: bigint;
    toDate?: Timestamp;
    fromDate?: Timestamp;
    areaId?: bigint;
}
export interface UpdateTerritoryInput {
    stateId?: LocationId;
    name?: string;
}
export type DoctorId = bigint;
export interface PendingApprovalCounts {
    rsmLevelLeavePending: bigint;
    dcrPending: bigint;
    leavePending: bigint;
    tadaPending: bigint;
    rsmLevelTadaPending: bigint;
    mtpPending: bigint;
}
export interface NotificationSettings {
    batchMinCount: bigint;
    cascadeLevel: string;
    quietHoursEnabled: boolean;
    doctorCallNotificationsEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    batchWindowSeconds: bigint;
    batchingEnabled: boolean;
}
export interface EmailInitiationLog {
    action: string;
    letterRef: string;
    initiatedByRole: string;
    initiatedAt: bigint;
    initiatedBy: string;
}
export interface MissedVisitAlert {
    doctorId: bigint;
    area: string;
    mrId: bigint;
    lastVisitDate: bigint;
    mrName: string;
    daysSinceLastVisit: bigint;
    doctorName: string;
}
export interface SubmitWorkingStyleInput {
    additionalArea?: string;
    token: string;
    date: bigint;
    otherStationName?: string;
    employeeId: string;
    workingMode: WorkingStyleMode;
    stationSource: WorkingStationSource;
    workingType?: string;
    workingWithUserId?: string;
}
export interface LocationRecord {
    lat: number;
    lng: number;
    userId: UserId;
    employeeId: string;
    timestamp: Timestamp;
}
export interface EmployeeDocument {
    id: bigint;
    documentType: DocumentType;
    fileName: string;
    employeeId: EmployeeId;
    storageUrl: string;
    uploadedAt: Timestamp;
    uploadedBy: EmployeeId;
}
export interface UpdateAdminMessageInput {
    id: string;
    title?: string;
    content?: string;
    scheduledDate?: string;
    isActive?: boolean;
    attachmentUrls?: Array<string>;
}
export interface SampleGivenDetail {
    productId: ProductId;
    productName: string;
    quantity: bigint;
}
export interface AdditionalHqAssignment {
    hqId: bigint;
    areaIds: Array<bigint>;
}
export interface UserLocationAllotment {
    hqIds: Array<bigint>;
    userId: UserId;
    name: string;
    role: Role;
    stateIds: Array<bigint>;
    hqAssignments: Array<HqAssignment>;
    employeeId: string;
    areaIds: Array<bigint>;
    zoneIds: Array<bigint>;
    territoryIds: Array<bigint>;
}
export interface HqHierarchyBlock {
    stationNames: Array<string>;
    hqId: LocationId;
    areaNames: Array<string>;
    hqName: string;
}
export interface GiftArticleDistributedV2 {
    giftArticleName: string;
    giftArticleId: GiftArticleId;
    quantity: bigint;
}
export interface OfficialLetterView {
    id: bigint;
    status: LetterStatus;
    letterRefNumber?: string;
    employeeName?: string;
    subject: string;
    body: string;
    date: string;
    createdAt: bigint;
    createdBy: bigint;
    letterType: LetterType;
    updatedAt: bigint;
    employeeId?: bigint;
    details: LetterDetails;
    emailLogs: Array<EmailInitiationLog>;
    issuedAt: bigint;
    issuedBy: bigint;
    recipientName: string;
}
export interface DcrInput {
    totalChemistsVisited: bigint;
    totalDoctorsVisited: bigint;
    date: string;
    totalStockistsVisited: bigint;
    gpsLocation?: GpsCoord;
    workingType: DcrWorkingType;
    stationCovered: string;
    areaCovered: string;
    remarks: string;
}
export interface BottomUpTarget {
    id: bigint;
    period: TargetPeriod;
    calculationStatus: CalculationStatus;
    userId: UserId;
    createdAt: Timestamp;
    createdBy: UserId;
    role: Role;
    year: bigint;
    targetAmount: bigint;
    lastModifiedAt: Timestamp;
    lastModifiedBy: UserId;
    isOverridden: boolean;
    overrideReason?: string;
}
export interface AdditionalChargeFilter {
    area?: string;
    hqId?: bigint;
    role?: Role;
    toDate?: Timestamp;
    employeeId?: UserId;
    fromDate?: Timestamp;
    areaId?: bigint;
    chargeType?: ChargeType;
    activeOnly: boolean;
}
export interface UpdateHQInput {
    name?: string;
    territoryId?: LocationId;
}
export interface UpdatePricelistProductInput {
    mrp?: number;
    ptr?: number;
    pts?: number;
    name?: string;
    composition?: string;
}
export interface MissedDoctorInfo {
    doctorId: bigint;
    visitCount: bigint;
    doctorName: string;
}
export interface MRCallSummary {
    totalDoctorVisits: bigint;
    totalSamplesGiven: bigint;
    totalDaysWorked: bigint;
}
export interface Session {
    token: string;
    expiresAt: Timestamp;
    userId: UserId;
    name: string;
    role: Role;
    employeeId: string;
}
export interface MRMissedSummary {
    totalMissed: bigint;
    visited0: bigint;
    visited1: bigint;
    mrId: bigint;
    visited2Plus: bigint;
    mrName: string;
    totalAllotted: bigint;
}
export interface DoctorVisited {
    doctorId: bigint;
    station: string;
    doctorName: string;
}
export interface CreateOrderInput {
    totalValue: bigint;
    date: string;
    gpsLocation?: GpsCoord;
    chemistId: ChemistId;
    items: Array<OrderItem>;
    remarks: string;
}
export type PasswordResetResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface DoctorVisitEntry {
    gps?: GpsCoord;
    doctorId: DoctorId;
    samplesDistributed: Array<SampleDistributed>;
    productIds: Array<ProductId>;
    submittedByRole?: string;
    submittedViaMRCharge?: boolean;
    notes: string;
    giftArticles: Array<GiftArticleDistributedV2>;
    detailsPerProduct: Array<[ProductId, string]>;
}
export interface BulkStationImportInput {
    stationName: string;
    hqName: string;
}
export interface TaggedCallEntry {
    samplesDistributed: Array<SampleDistributed>;
    primaryRole: string;
    employeeName: string;
    date: string;
    doctorsVisited: Array<DoctorVisitEntry>;
    employeeId: bigint;
}
export type CrmRequestId = bigint;
export interface CompanyProfile {
    emailId?: string;
    website?: string;
    updatedAt: bigint;
    logoUrl?: string;
    address: string;
    companyName: string;
    contactNumber: string;
}
export interface DoctorProductAssignment {
    doctorId: DoctorId;
    productIds: Array<ProductId>;
    mrId: UserId;
    sampleIds: Array<ProductId>;
    updatedAt: Timestamp;
}
export interface AsmKpis {
    pendingLeaveCount: bigint;
    mrsPendingMtpApproval: bigint;
    teamChemistVisits: bigint;
    teamDoctorCallsCount: bigint;
    teamDoctorCallsTarget: bigint;
    pendingTadaCount: bigint;
    teamDcrExpected: bigint;
    mrsNotCheckedInToday: bigint;
    totalMrs: bigint;
    teamDcrOnTimeCount: bigint;
}
export interface AdditionalAreaInfo {
    hqId: bigint;
    areaId: bigint;
}
export type DashboardAggregates = {
    __kind__: "hr";
    hr: HrKpis;
} | {
    __kind__: "mr";
    mr: MrKpis;
} | {
    __kind__: "asm";
    asm: AsmKpis;
} | {
    __kind__: "rsm";
    rsm: RsmKpis;
} | {
    __kind__: "zsm";
    zsm: ZsmKpis;
} | {
    __kind__: "admin";
    admin: AdminKpis;
};
export interface ProductTarget {
    productId: string;
    productName: string;
    targetQty: number;
}
export interface CreateDoctorInput {
    territory: string;
    station: string;
    dateOfBirth?: string;
    area: string;
    name: string;
    specialization: string;
    qualification: DoctorQualification;
    contactPhone: string;
}
export interface EnrichedTrailEvent {
    activityType: string;
    coord: GpsCoord;
    doctorCalls: Array<TrailDoctorCall>;
}
export interface EmployeeAdvance {
    id: string;
    status: AdvanceStatus;
    installmentStartYear: bigint;
    firstDeductionYear: bigint;
    isPaused: boolean;
    createdAt: bigint;
    createdBy: string;
    installmentAmount: number;
    employeeId: string;
    advanceAmount: number;
    advanceDate: bigint;
    installmentStartMonth: bigint;
    firstDeductionMonth: bigint;
    cancelRemark?: string;
    installmentsCompleted: bigint;
    totalInstallments: bigint;
    remarks?: string;
    amountRecovered: number;
    reason: string;
}
export interface AddPricelistProductInput {
    mrp: number;
    ptr: number;
    pts: number;
    name: string;
    composition: string;
}
export interface BottomUpTargetSummaryRow {
    territory: string;
    status: string;
    employeeName: string;
    overrideNotes: string;
    area: string;
    level: string;
    quarterly: bigint;
    monthly: bigint;
    halfYearly: bigint;
    yearly: bigint;
}
export interface UpdateIncentivePlanInput {
    planId: bigint;
    isActive?: boolean;
    slabs?: Array<IncentiveSlab>;
}
export type PricelistProductId = bigint;
export type HolidayApplicableTo = {
    __kind__: "SpecificRoles";
    SpecificRoles: Array<Role>;
} | {
    __kind__: "SpecificTerritories";
    SpecificTerritories: Array<string>;
} | {
    __kind__: "AllEmployees";
    AllEmployees: null;
};
export interface LeaveFilter {
    status?: LeaveStatus;
    month?: bigint;
    userId?: EmployeeId;
    role?: Role;
    year?: bigint;
    leaveType?: LeaveType;
}
export interface CreateZoneInput {
    code: string;
    name: string;
}
export interface TargetHierarchyNode {
    territory?: string;
    status: CalculationStatus;
    area?: string;
    userId: UserId;
    name: string;
    role: Role;
    children: Array<TargetHierarchyNode>;
    quarterly: bigint;
    monthly: bigint;
    halfYearly: bigint;
    yearly: bigint;
    isOverridden: boolean;
    overrideReason?: string;
}
export interface PrimaryHqInfo {
    id: LocationId;
    name: string;
    level: LocationLevel;
}
export interface MrKpis {
    newDoctorsTarget: bigint;
    chemistVisitsTarget: bigint;
    sampleBalanceCount: bigint;
    chemistVisitsCount: bigint;
    mtpAdherenceRate: number;
    stockistVisitsTarget: bigint;
    newDoctorsAdded: bigint;
    stockistVisitsCount: bigint;
    dcrSubmissionRate: number;
    doctorCallsCount: bigint;
    doctorCallsTarget: bigint;
}
export interface AddSuggestionReplyInput {
    suggestionId: bigint;
    reply: string;
}
export type LocationId = bigint;
export type MutationResult = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: string;
};
export interface CreateStateInput {
    name: string;
    zoneId: LocationId;
}
export interface SfaReminderSettings {
    mtpReminderDaysBeforeDeadline: bigint;
    dcrReminderEnabled: boolean;
    mtpDeadlineDay: bigint;
    dcrReminderHour: bigint;
    mtpReminderEnabled: boolean;
}
export interface OrderItem {
    scheme: string;
    productId: ProductId;
    productName: string;
    quantity: bigint;
    unitPrice: bigint;
}
export interface HqHierarchyEmployee {
    territory: string;
    status: string;
    employeeCode: string;
    employeeName: string;
    userId: UserId;
    role: string;
    mobileNumber: string;
    hqAssignments: Array<HqHierarchyBlock>;
    primaryHqName: string;
    reportingManagerName: string;
    reportingManagerId?: UserId;
}
export interface UserInfo {
    id: UserId;
    territory: string;
    reportsTo?: UserId;
    status: UserStatus;
    primaryHqId?: LocationId;
    salary: SalaryComponents;
    username: string;
    hqIds: Array<bigint>;
    joinDate: string;
    dateOfBirth?: string;
    name: string;
    designation: string;
    createdAt: Timestamp;
    role: Role;
    stateIds: Array<bigint>;
    hqAssignments: Array<HqAssignment>;
    email: string;
    employeeId: string;
    areaIds: Array<bigint>;
    phone: string;
    department: string;
    zoneIds: Array<bigint>;
    territoryIds: Array<bigint>;
    migrationDone: boolean;
}
export interface TaDaTotals {
    taTotal: bigint;
    daTotal: bigint;
}
export interface GpsTrailRecord {
    userId: UserId;
    date: string;
    coords: Array<GpsCoord>;
}
export interface UpdateAreaInput {
    hqId?: LocationId;
    name?: string;
}
export interface PerformanceRecord {
    id: bigint;
    month: bigint;
    year: bigint;
    callsMade: bigint;
    recordedAt: Timestamp;
    recordedBy: EmployeeId;
    totalSales: bigint;
    doctorsVisited: bigint;
    employeeId: EmployeeId;
    remarks: string;
    chemistOrders: bigint;
}
export interface HealthCheckReport {
    anomalies: Array<HealthAnomaly>;
    timestamp: bigint;
    passed: boolean;
    anomalyCount: bigint;
}
export interface ConsolidatedMonthData {
    totalMRs: bigint;
    avgVisitPercentage: number;
    monthYear: string;
}
export interface StockistCallInfo {
    id: bigint;
    productsDiscussed: Array<ProductEnquired>;
    station: string;
    area: string;
    date: string;
    mrId: UserId;
    createdAt: Timestamp;
    stockistId: bigint;
    gpsLocation: GpsCoord;
    orderQty: string;
    stockistName: string;
    remarks: string;
}
export interface BulkImportDoctorResult {
    errors: Array<string>;
    failed: bigint;
    newDoctorIds: Array<[DoctorId, string]>;
    succeeded: bigint;
}
export interface SampleBalanceView {
    month: bigint;
    year: bigint;
    productCode: string;
    productId: bigint;
    productName: string;
    usedQty: bigint;
    allocatedQty: bigint;
    remainingQty: bigint;
}
export interface StationRecord {
    hqId: LocationId;
    createdAt: Timestamp;
    isActive: boolean;
    updatedAt: Timestamp;
    stationId: LocationId;
    stationName: string;
}
export interface SuggestionSubmission {
    id: bigint;
    attachmentUrl?: string;
    closingRemark?: string;
    status: string;
    hrReplyByName?: string;
    subject: string;
    submittedByName: string;
    submittedByRole: string;
    submittedAt: bigint;
    description: string;
    isReadByEmployee: boolean;
    hrReplyAt?: bigint;
    submissionType: string;
    submittedByUserId: string;
    priority: string;
    statusUpdatedAt?: bigint;
    submittedByEmployeeId: string;
    isReadByHR: boolean;
    hrReply?: string;
}
export interface CreateReportInput {
    gps: GpsCoord;
    workType: WorkType;
    samplesDistributed: Array<SampleDistributed>;
    date: string;
    workingStation?: string;
    doctorsVisited: Array<DoctorVisitEntry>;
    endLocation: GpsCoord;
    workingWithUserName?: string;
    workingMode?: WorkingMode;
    workingStationSource?: WorkingStationSource__1;
    workingWithUserId?: UserId;
    stationType: string;
    remarks: string;
    startLocation: GpsCoord;
}
export interface RoleHierarchyConfig {
    roleOrder: Array<Role>;
}
export interface UpdateZoneInput {
    code?: string;
    name?: string;
}
export interface PerformanceFilter {
    month?: bigint;
    period: TargetPeriod;
    year: bigint;
    managerId: UserId;
    drillDownFrom?: UserId;
}
export interface TrailDoctorCall {
    station: string;
    doctorSpecialization: string;
    doctorName: string;
}
export interface SampleItem {
    productName: string;
    quantity: bigint;
}
export interface PayrollRecord {
    id: bigint;
    hra: bigint;
    advanceRecovery: bigint;
    payableDays: bigint;
    month: bigint;
    isApproved: boolean;
    year: bigint;
    basicPay: bigint;
    grossPay: bigint;
    netPay: bigint;
    processedAt: Timestamp;
    processedBy: EmployeeId;
    employeeId: EmployeeId;
    daAllowance: bigint;
    esiDeduction: bigint;
    taAllowance: bigint;
    pfDeduction: bigint;
}
export interface SalaryComponents {
    ta: number;
    hra: bigint;
    pfPercent: bigint;
    esiPercent: bigint;
    basic: bigint;
}
export interface HrKpis {
    totalEmployees: bigint;
    lateCheckInsToday: bigint;
    totalActiveEmployees: bigint;
    autoInactivatedPending: bigint;
    employeesOnLeaveToday: bigint;
    upcomingBirthdaysCount: bigint;
    pendingTadaClaims: bigint;
    pendingLeaveApplications: bigint;
}
export interface TravelPlanInfo {
    id: TravelPlanId;
    status: TravelPlanStatus;
    plannedStation: string;
    userId: UserId;
    date: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    notes: string;
}
export interface DcrInfo {
    id: bigint;
    status: DcrStatus;
    totalChemistsVisited: bigint;
    totalDoctorsVisited: bigint;
    date: string;
    approvedAt?: Timestamp;
    approvedBy?: UserId;
    mrId: UserId;
    createdAt: Timestamp;
    totalStockistsVisited: bigint;
    approverRemark: string;
    submittedAt?: Timestamp;
    isLate: boolean;
    gpsLocation?: GpsCoord;
    workingType: DcrWorkingType;
    stationCovered: string;
    areaCovered: string;
    remarks: string;
}
export interface CreateTravelPlanInput {
    plannedStation: string;
    date: string;
    notes: string;
}
export interface CreateHolidayInput {
    holidayType: HolidayType;
    date: bigint;
    name: string;
    applicableTo: HolidayApplicableTo;
    remarks?: string;
}
export interface ApproveIncentiveInput {
    calculationId: bigint;
    notes?: string;
    adjustedAmount?: number;
}
export interface AdminMessageInfo {
    id: string;
    title: string;
    content: string;
    scheduledDate?: string;
    createdAt: bigint;
    createdBy: string;
    isActive: boolean;
    attachmentUrls: Array<string>;
}
export interface CallReportDetail {
    date: string;
    mrId: UserId;
    submittedAt: Timestamp;
    mrName: string;
    reportId: ReportId;
    doctorVisits: Array<DoctorVisitDetail>;
}
export interface GpsCoord {
    lat: number;
    lng: number;
    timestamp: bigint;
}
export enum AdvanceStatus {
    Active = "Active",
    Cancelled = "Cancelled",
    FullyRecovered = "FullyRecovered"
}
export enum AttendanceStatus {
    onLeave = "onLeave",
    halfDay = "halfDay",
    present = "present",
    weeklyOff = "weeklyOff",
    onLeaveLWP = "onLeaveLWP",
    onLeaveUPL = "onLeaveUPL",
    absent = "absent",
    onLeaveCL = "onLeaveCL",
    onLeaveCO = "onLeaveCO",
    onLeaveML = "onLeaveML",
    onLeavePL = "onLeavePL",
    onLeaveSL = "onLeaveSL",
    companyHoliday = "companyHoliday"
}
export enum CalculationStatus {
    ManuallyOverridden = "ManuallyOverridden",
    AutoCalculated = "AutoCalculated"
}
export enum ChargeType {
    Area = "Area",
    Role = "Role"
}
export enum CheckInStatus {
    unmatched = "unmatched",
    matched = "matched"
}
export enum CrmStatus {
    Approved = "Approved",
    Rejected = "Rejected",
    Pending = "Pending"
}
export enum DaRate {
    rate250 = "rate250",
    rate300 = "rate300"
}
export enum DcrStatus {
    Late = "Late",
    Approved = "Approved",
    Draft = "Draft",
    Rejected = "Rejected",
    Submitted = "Submitted"
}
export enum DcrWorkingType {
    Leave = "Leave",
    OfficeWork = "OfficeWork",
    FieldWork = "FieldWork",
    Holiday = "Holiday",
    SickLeave = "SickLeave",
    Training = "Training"
}
export enum DocumentType {
    other = "other",
    agreement = "agreement",
    idProof = "idProof",
    offerLetter = "offerLetter"
}
export enum ExpenseStatus {
    pending = "pending",
    approved = "approved",
    rejected = "rejected"
}
export enum GpsAccuracyCategory {
    verified = "verified",
    none = "none",
    lowAccuracy = "lowAccuracy"
}
export enum HolidayType {
    RegionalHoliday = "RegionalHoliday",
    FestivalHoliday = "FestivalHoliday",
    OptionalHoliday = "OptionalHoliday",
    NationalHoliday = "NationalHoliday"
}
export enum IncentiveCalculationStatus {
    HRApproved = "HRApproved",
    Calculated = "Calculated",
    PaidOnSlip = "PaidOnSlip"
}
export enum IncentiveType {
    PercentOfSalary = "PercentOfSalary",
    Fixed = "Fixed",
    PercentOfTarget = "PercentOfTarget"
}
export enum IntendedUse {
    Gift = "Gift",
    Sample = "Sample"
}
export enum JfwRating {
    Good = "Good",
    Average = "Average",
    Poor = "Poor",
    Excellent = "Excellent"
}
export enum LeaveType {
    co = "co",
    ml = "ml",
    pl = "pl",
    lwp = "lwp",
    sick = "sick",
    unpaid = "unpaid",
    casual = "casual"
}
export enum LetterStatus {
    final_ = "final",
    draft = "draft"
}
export enum LetterType {
    terminationLetter = "terminationLetter",
    warningLetter = "warningLetter",
    experienceLetter = "experienceLetter",
    promotionLetter = "promotionLetter",
    incrementLetter = "incrementLetter",
    showCauseNotice = "showCauseNotice",
    confirmationLetter = "confirmationLetter",
    transferLetter = "transferLetter",
    appointmentLetter = "appointmentLetter"
}
export enum LocationLevel {
    Station = "Station",
    Area = "Area",
    Region = "Region",
    Zone = "Zone"
}
export enum NotificationType {
    reactivated = "reactivated",
    mtpReminder = "mtpReminder",
    doctorCallSubmitted = "doctorCallSubmitted",
    birthday = "birthday",
    absenceWarningDay1 = "absenceWarningDay1",
    absenceWarningDay2 = "absenceWarningDay2",
    dcrReminder = "dcrReminder",
    doctorCallBatch = "doctorCallBatch",
    mrModeAssigned = "mrModeAssigned",
    mrModeDcrSubmitted = "mrModeDcrSubmitted",
    autoInactivated = "autoInactivated"
}
export enum OrderStatus {
    Dispatched = "Dispatched",
    Delivered = "Delivered",
    Confirmed = "Confirmed",
    Cancelled = "Cancelled",
    Pending = "Pending"
}
export enum PaymentStatus {
    Paid = "Paid",
    DueForPayment = "DueForPayment",
    Pending = "Pending"
}
export enum PerformanceStatus {
    OnTrack = "OnTrack",
    SlightlyBehind = "SlightlyBehind",
    SignificantlyBehind = "SignificantlyBehind"
}
export enum ProductCategory {
    Syrup = "Syrup",
    Capsule = "Capsule",
    Injection = "Injection",
    Tablet = "Tablet",
    Ointment = "Ointment",
    Other = "Other"
}
export enum ReportStatus {
    Approved = "Approved",
    Draft = "Draft",
    Rejected = "Rejected",
    Submitted = "Submitted"
}
export enum Role {
    MR = "MR",
    ASM = "ASM",
    RSM = "RSM",
    ZSM = "ZSM",
    HRManager = "HRManager",
    Admin = "Admin"
}
export enum StationType {
    HQ = "HQ",
    Local = "Local",
    ExHQ = "ExHQ",
    Outstation = "Outstation"
}
export enum TargetPeriod {
    Quarterly = "Quarterly",
    Monthly = "Monthly",
    HalfYearly = "HalfYearly",
    Yearly = "Yearly"
}
export enum TravelPlanStatus {
    Draft = "Draft",
    Submitted = "Submitted"
}
export enum UserStatus {
    Inactive = "Inactive",
    Active = "Active"
}
export enum Variant_ok_error {
    ok = "ok",
    error = "error"
}
export enum WorkType {
    Leave = "Leave",
    Holiday = "Holiday",
    Field = "Field",
    Office = "Office"
}
export enum WorkingMode {
    WorkingAlone = "WorkingAlone",
    WorkingWith = "WorkingWith"
}
export enum WorkingStationSource {
    AsPerPlan = "AsPerPlan",
    OtherStation = "OtherStation"
}
export enum WorkingStationSource__1 {
    OtherStation = "OtherStation",
    AsPerTP = "AsPerTP"
}
export interface backendInterface {
    acknowledgeJfw(token: string, jfwId: bigint): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addArea(token: string, input: CreateAreaInput): Promise<MutationResult>;
    addBonusEntry(sheetId: string, entry: BonusEntry): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addChemist(mrId: UserId, input: CreateChemistInput): Promise<ChemistId>;
    addCompanyHoliday(token: string, input: CreateHolidayInput): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addDoctor(mrId: UserId, input: CreateDoctorInput): Promise<DoctorId>;
    addDocument(token: string, employeeId: bigint, documentType: DocumentType, fileName: string, storageUrl: string): Promise<MutationResult>;
    addGpsOverride(token: string, employeeId: UserId, reason: string, overrideDate: string | null): Promise<{
        __kind__: "ok";
        ok: GpsOverrideEntry;
    } | {
        __kind__: "err";
        err: string;
    }>;
    addHQ(token: string, input: CreateHQInput): Promise<MutationResult>;
    addOfficialLetterEmailLog(token: string, letterId: bigint, logEntry: EmailInitiationLog): Promise<MutationResult>;
    addPricelistProduct(token: string, input: AddPricelistProductInput): Promise<MutationResult>;
    addProduct(input: CreateProductInput): Promise<ProductId>;
    addRegion(token: string, name: string, zoneId: LocationId): Promise<MutationResult>;
    addState(token: string, input: CreateStateInput): Promise<MutationResult>;
    addSuggestionReply(token: string, input: AddSuggestionReplyInput): Promise<MutationResult>;
    addTerritory(token: string, input: CreateTerritoryInput): Promise<MutationResult>;
    addTerritoryToStation(token: string, name: string, stationId: LocationId): Promise<MutationResult>;
    addZone(token: string, input: CreateZoneInput): Promise<MutationResult>;
    adminSeed(): Promise<MutationResult>;
    allocateSamplesToMR(token: string, input: SampleAllocationInput): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    applyLeaveV2(token: string, input: ApplyLeaveInput): Promise<{
        __kind__: "ok";
        ok: LeaveApplication;
    } | {
        __kind__: "err";
        err: string;
    }>;
    approveBookingRequest(token: string, id: BookingId): Promise<MutationResult>;
    approveCrmRequest(token: string, id: CrmRequestId): Promise<MutationResult>;
    approveDcr(token: string, input: DcrApprovalInput): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    approveExpense(token: string, expenseId: bigint, approve: boolean): Promise<MutationResult>;
    approveIncentiveCalculation(token: string, input: ApproveIncentiveInput): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    assignAdditionalCharge(token: string, input: AssignAdditionalChargeInput): Promise<{
        __kind__: "ok";
        ok: AdditionalCharge;
    } | {
        __kind__: "err";
        err: string;
    }>;
    assignProductsToDoctor(mrId: UserId, input: AssignProductsInput): Promise<void>;
    bulkAddPricelistProducts(token: string, inputs: Array<AddPricelistProductInput>): Promise<BulkAddResult>;
    bulkAssignEmployeeIds(token: string): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    bulkImportChemists(token: string, mrId: UserId, items: Array<BulkImportChemistInput>, areaName: string): Promise<BulkImportResult>;
    bulkImportDoctors(token: string, mrId: UserId, items: Array<BulkImportDoctorInput>): Promise<BulkImportDoctorResult>;
    bulkImportGiftArticles(token: string, rows: Array<CreateGiftArticleInput>): Promise<BulkGiftArticleImportResult>;
    bulkImportStations(token: string, rows: Array<BulkStationImportInput>): Promise<BulkStationImportResult>;
    bulkMigrateUids(token: string): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    bulkSetMonthlyTargets(token: string, input: BulkSetMonthlyTargetsInput): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    bulkUploadStockists(token: string, items: Array<BulkStockistInput>): Promise<{
        __kind__: "ok";
        ok: BulkUploadResult;
    } | {
        __kind__: "err";
        err: string;
    }>;
    calculateBottomUpIncentiveTargets(token: string, year: bigint, month: bigint): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    cancelAdvance(id: string, remark: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    captureGpsBackground(token: string, lat: number, lng: number, accuracy: number | null): Promise<MutationResult>;
    checkDcrPending(token: string, mrId: bigint, date: string): Promise<boolean>;
    checkExpenseFieldActivity(token: string, expenseDate: string): Promise<boolean>;
    checkGpsOverride(token: string, date: string): Promise<boolean>;
    checkInAttendance(token: string, coord: GpsCoord, date: string): Promise<{
        __kind__: "ok";
        ok: AttendanceCheckIn;
    } | {
        __kind__: "err";
        err: string;
    } | {
        __kind__: "alreadyCheckedIn";
        alreadyCheckedIn: AttendanceCheckIn;
    }>;
    checkOutAttendance(token: string, coord: GpsCoord | null, date: string): Promise<{
        __kind__: "ok";
        ok: AttendanceCheckIn;
    } | {
        __kind__: "err";
        err: string;
    } | {
        __kind__: "notCheckedIn";
        notCheckedIn: null;
    } | {
        __kind__: "alreadyCheckedOut";
        alreadyCheckedOut: null;
    }>;
    cleanTrialData(token: string, confirmationPhrase: string, reason: string): Promise<{
        __kind__: "ok";
        ok: DataCleanupLog;
    } | {
        __kind__: "err";
        err: string;
    }>;
    clearMyNotifications(token: string): Promise<MutationResult>;
    clearPrimaryHq(token: string, userId: UserId): Promise<MutationResult>;
    correctAttendance(token: string, input: AttendanceCorrectionInput): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createAdminMessage(token: string, input: CreateAdminMessageInput): Promise<{
        __kind__: "ok";
        ok: AdminMessageInfo;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createAdvance(input: CreateAdvanceInput): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createBookingRequest(token: string, itemName: string, qty: bigint, intendedUse: IntendedUse, targetDate: string, notes: string | null): Promise<MutationResult>;
    createBusinessReport(token: string, input: CreateBusinessReportInput): Promise<{
        __kind__: "ok";
        ok: BusinessReportId;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createCallReport(mrId: UserId, input: CreateReportInput): Promise<ReportId>;
    createCrmDoctorSale(token: string, req: CreateCrmDoctorSaleRequest): Promise<{
        __kind__: "ok";
        ok: CrmDoctorSaleRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createCrmRequest(token: string, input: CreateCrmRequestInput): Promise<{
        __kind__: "ok";
        ok: CrmRequestId;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createDcrReminder(token: string, mrId: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createGiftArticle(token: string, input: CreateGiftArticleInput): Promise<{
        __kind__: "ok";
        ok: GiftArticleInfo;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createGiftArticleMaster(token: string, input: CreateGiftArticleInput): Promise<{
        __kind__: "ok";
        ok: GiftArticleInfo;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createIncentivePlan(token: string, input: CreateIncentivePlanInput): Promise<{
        __kind__: "ok";
        ok: IncentivePlan;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createMtpReminder(token: string, mrId: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createOfficialLetter(token: string, input: CreateLetterInput): Promise<MutationResult>;
    createSalesTarget(token: string, input: CreateSalesTargetInput): Promise<{
        __kind__: "ok";
        ok: SalesTargetId;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createSecondarySale(token: string, req: CreateSecondarySaleRequest): Promise<{
        __kind__: "ok";
        ok: SecondarySaleRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createStation(token: string, input: CreateStationInput): Promise<MutationResult>;
    createStockist(token: string, req: CreateStockistRequest): Promise<{
        __kind__: "ok";
        ok: StockistRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createTravelPlan(token: string, input: CreateTravelPlanInput): Promise<{
        __kind__: "ok";
        ok: TravelPlanId;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createUser(token: string, input: CreateUserInput): Promise<MutationResult>;
    deactivateAdminMessage(token: string, messageId: string): Promise<MutationResult>;
    deactivateArea(token: string, id: LocationId): Promise<MutationResult>;
    deactivateCompanyHoliday(token: string, id: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deactivateHQ(token: string, id: LocationId): Promise<MutationResult>;
    deactivateIncentivePlan(token: string, planId: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deactivateProduct(productId: ProductId): Promise<MutationResult>;
    deactivateState(token: string, id: LocationId): Promise<MutationResult>;
    deactivateStockist(token: string, stockistId: StockistId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deactivateTerritory(token: string, id: LocationId): Promise<MutationResult>;
    deactivateUser(token: string, userId: UserId): Promise<MutationResult>;
    deactivateZone(token: string, id: LocationId): Promise<MutationResult>;
    deleteAdminMessage(token: string, messageId: string): Promise<MutationResult>;
    deleteCompanyHoliday(token: string, id: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteDoctor(token: string, doctorId: bigint): Promise<boolean>;
    deleteDoctors(token: string, doctorIds: Array<bigint>): Promise<BulkDeleteResult>;
    deleteDocument(token: string, documentId: bigint): Promise<MutationResult>;
    deleteEmployee(sessionToken: string, employeeId: string): Promise<EmployeeDeletionResult>;
    deleteGiftArticle(token: string, id: GiftArticleId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteGiftArticleMaster(token: string, id: GiftArticleId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteOfficialLetter(token: string, id: bigint): Promise<MutationResult>;
    deletePricelistProduct(token: string, id: PricelistProductId): Promise<MutationResult>;
    deleteRegion(token: string, id: LocationId): Promise<MutationResult>;
    deleteStation(token: string, stationId: LocationId): Promise<boolean>;
    deleteTaDaGrade(token: string, gradeName: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteTerritoryUnderStation(token: string, territoryId: LocationId): Promise<MutationResult>;
    deleteZone(token: string, id: LocationId): Promise<MutationResult>;
    dismissMissedVisitAlert(token: string, mrId: bigint, doctorId: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    doRunAbsenceCheck(): Promise<void>;
    executeAbsenceCheckNow(token: string): Promise<AbsenceResult>;
    exportCallReports(token: string, filter: ExportFilter): Promise<Array<CallReportExportRow>>;
    exportCrmDoctorSales(token: string, filter: CrmDoctorSaleFilter): Promise<Array<CrmDoctorSaleRecord>>;
    exportCrmSalesReport(token: string, filter: ExportFilter): Promise<Array<CrmExportRow>>;
    exportDaReport(token: string, filter: ExportFilter): Promise<Array<DaReportRow>>;
    exportDoctorVisitReports(token: string, filter: ExportFilter): Promise<Array<DoctorVisitExportRow>>;
    exportIncentiveReport(token: string, filter: IncentiveFilter): Promise<Array<IncentiveCalculation>>;
    exportMonthlyTargets(token: string, filter: MonthlyTargetFilter): Promise<Array<MonthlyTarget>>;
    exportSecondarySales(token: string, filter: SecondarySaleFilter): Promise<Array<SecondarySaleRecord>>;
    exportTargetAdjustmentLogs(token: string, filter: TargetAdjustmentFilter): Promise<Array<TargetAdjustmentLog>>;
    exportTravelPlans(token: string, filter: ExportFilter): Promise<Array<TravelPlanExportRow>>;
    finalizeOfficialLetter(token: string, id: bigint): Promise<MutationResult>;
    generateExpenseSheet(employeeId: string, month: bigint, year: bigint, lineItems: Array<ExpenseLineItem>): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    generateIncentiveBonusSheet(employeeId: string, quarter: bigint, year: bigint, monthlyEntries: Array<IncentiveMonthEntry>, bonusEntries: Array<BonusEntry>): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    generateLetterRefNumber(token: string): Promise<string | null>;
    getAbsenceInactivationLog(token: string): Promise<Array<AbsenceInactivationLogView>>;
    getAbsenceSettings(token: string): Promise<{
        excludeLongTermLeave: boolean;
        consecutiveAbsenceThreshold: bigint;
        absenceCheckEnabled: boolean;
        warningNotificationsEnabled: boolean;
    }>;
    getActiveAdditionalAreas(token: string, employeeId: UserId): Promise<Array<AdditionalAreaInfo>>;
    getActiveAdminMessage(token: string, today: string): Promise<AdminMessageInfo | null>;
    getActiveChargeAreaForEmployee(token: string, employeeId: UserId): Promise<[bigint, bigint] | null>;
    getActiveChargesForEmployee(token: string, employeeId: UserId): Promise<Array<AdditionalCharge>>;
    getActiveHQsByTerritory(token: string, territoryId: LocationId): Promise<Array<HQRecord>>;
    getActiveHolidays(token: string): Promise<Array<CompanyHoliday>>;
    getAdminEmail(token: string): Promise<string | null>;
    getAdvancesByEmployee(employeeId: string): Promise<Array<EmployeeAdvance>>;
    getAllActiveHQs(token: string): Promise<Array<HQRecord>>;
    getAllActiveStates(token: string): Promise<Array<StateRecord>>;
    getAllActiveTerritories(token: string): Promise<Array<TerritoryRecord>>;
    getAllActiveZones(token: string): Promise<Array<ZoneRecord>>;
    getAllAdvances(): Promise<Array<EmployeeAdvance>>;
    getAllAllocations(token: string, month: bigint, year: bigint): Promise<{
        __kind__: "ok";
        ok: Array<SampleAllocationInfo>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAllChargesForEmployee(token: string, employeeId: UserId): Promise<Array<AdditionalCharge>>;
    getAllExpenseSheets(filter: ExpenseSheetFilter): Promise<Array<ExpenseSheet>>;
    getAllHQs(token: string): Promise<Array<HQRecord>>;
    getAllIncentiveBonusSheets(filter: IncentiveBonusSheetFilter): Promise<Array<IncentiveBonusSheet>>;
    getAllIncentiveCalculations(token: string, filter: IncentiveFilter): Promise<Array<IncentiveCalculation>>;
    getAllJfws(token: string, fromDate: string, toDate: string): Promise<Array<JfwInfo>>;
    getAllLeaves(token: string, filter: LeaveFilter): Promise<{
        __kind__: "ok";
        ok: Array<LeaveApplication>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAllLocations(token: string): Promise<Array<LocationRecord>>;
    getAllStates(token: string): Promise<Array<StateRecord>>;
    getAllSubmissions(token: string, filter: SuggestionFilter | null): Promise<Array<SuggestionSubmission>>;
    getAllTerritories(token: string): Promise<Array<TerritoryRecord>>;
    getAllTrailsForUser(token: string, userId: UserId): Promise<Array<GpsTrailRecord>>;
    getAllWorkingStyleRecords(from: bigint, to: bigint): Promise<Array<WorkingStyleRecord>>;
    getAllZones(token: string): Promise<Array<ZoneRecord>>;
    getAllocationsForMR(token: string, mrId: bigint, month: bigint, year: bigint): Promise<{
        __kind__: "ok";
        ok: Array<SampleAllocationInfo>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getApprovedTaDaForMonth(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<TaDaTotals>;
    getAreasByRegion(token: string, regionId: LocationId): Promise<Array<TerritoryRecord>>;
    getAttendanceSummaryForEmployee(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<{
        holidays: bigint;
        present: bigint;
        absent: bigint;
        leaves: bigint;
        weeklyOffs: bigint;
    }>;
    getAuthorityChainEmails(token: string): Promise<Array<string>>;
    getBirthdayCalendar(month: bigint, year: bigint, token: string): Promise<Array<{
        hq: string;
        month: bigint;
        userId: string;
        name: string;
        role: string;
        dayOfMonth: bigint;
    }>>;
    getBirthdaysForHierarchy(token: string): Promise<Array<{
        hq: string;
        userId: string;
        name: string;
        role: string;
        employeeId: string;
    }>>;
    getBirthdaysToday(token: string): Promise<Array<{
        hq: string;
        userId: string;
        name: string;
        role: string;
        employeeId: string;
    }>>;
    getBulkUploadHistory(token: string, uploadType: string): Promise<Array<BulkUploadRecord>>;
    getCallReport(reportId: ReportId): Promise<CallReportInfo | null>;
    getCheckInsByDate(token: string, date: string): Promise<Array<AttendanceCheckIn>>;
    getChemist(chemistId: ChemistId): Promise<ChemistInfo | null>;
    getChemistCall(token: string, callId: bigint): Promise<ChemistCallInfo | null>;
    getChemistOrder(orderId: OrderId): Promise<ChemistOrderInfo | null>;
    getChemistStockistCoverage(token: string, mrIds: Array<bigint>, fromDate: string, toDate: string): Promise<{
        stockistCoverage: Array<CoverageRow>;
        chemistCoverage: Array<CoverageRow>;
    }>;
    getCompanyHolidays(token: string): Promise<Array<CompanyHoliday>>;
    getCompanyProfile(token: string): Promise<CompanyProfile | null>;
    getConsolidatedVisitTrend(token: string, managerId: bigint, months: bigint): Promise<{
        __kind__: "ok";
        ok: Array<ConsolidatedMonthData>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getCrmDoctorSalesByEmployee(token: string, employeeId: UserId): Promise<Array<CrmDoctorSaleRecord>>;
    getCrmRequest(token: string, id: CrmRequestId): Promise<CrmRequestInfo | null>;
    getDaConfigs(): Promise<Array<DaConfig>>;
    getDailyCallCounts(token: string, mrId: bigint, date: string): Promise<{
        chemistCount: bigint;
        stockistCount: bigint;
    }>;
    getDashboardAggregates(token: string, fromDate: string, toDate: string): Promise<DashboardAggregates | null>;
    getDataCleanupHistory(token: string): Promise<{
        __kind__: "ok";
        ok: Array<DataCleanupLog>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getDcrById(token: string, dcrId: bigint): Promise<DcrInfo | null>;
    getDcrReminderStatus(token: string, date: string): Promise<DcrReminderStatus>;
    getDcrSettings(token: string): Promise<DcrSettingsInfo>;
    getDcrSummary(token: string, mrIds: Array<bigint>, fromDate: string, toDate: string): Promise<Array<DcrSummaryRow>>;
    getDcrUnsubmittedMRs(token: string, date: string): Promise<{
        __kind__: "ok";
        ok: Array<bigint>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getDeletedEmployeesLog(sessionToken: string): Promise<{
        __kind__: "ok";
        ok: Array<EmployeeDeletionAuditEntry>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getDoctor(doctorId: DoctorId): Promise<DoctorInfo | null>;
    getDoctorAssignment(mrId: UserId, doctorId: DoctorId): Promise<DoctorProductAssignment | null>;
    getDoctorBirthdaysToday(token: string): Promise<Array<{
        doctorId: string;
        station: string;
        area: string;
        name: string;
        specialization: string;
    }>>;
    getDoctorCallGpsLocation(session: string, reportId: UserId): Promise<{
        __kind__: "ok";
        ok: {
            lat: number;
            lng: number;
            submittedAt: bigint;
            mrName: string;
            timestamp: bigint;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    getDoctorVisitHistory(doctorId: DoctorId, limit: bigint): Promise<Array<CallReportInfo>>;
    getDoctorVisitTrend(token: string, managerId: bigint, months: bigint): Promise<{
        __kind__: "ok";
        ok: Array<MonthlyVisitData>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getDoctorsByMRHQAndArea(token: string, mrUserId: bigint): Promise<{
        __kind__: "ok";
        ok: Array<DoctorInfo>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getDoctorsForStation(token: string, mrUserId: bigint, stationName: string): Promise<{
        __kind__: "ok";
        ok: Array<DoctorInfo>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getEarnedLeaveBalance(token: string, empId: bigint | null, year: bigint): Promise<{
        __kind__: "ok";
        ok: {
            balance: bigint;
            used: bigint;
            accrued: bigint;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    getEffectiveRoles(token: string, employeeId: UserId): Promise<Array<Role>>;
    getEmployeeDaHistory(token: string, employeeId: UserId, month: bigint, year: bigint): Promise<Array<DaHistoryRow>>;
    getEmployeeDcrDaForMonth(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<bigint>;
    getEmployeeDocuments(token: string, employeeId: bigint): Promise<Array<EmployeeDocument>>;
    getEmployeeInactivationHistory(token: string, employeeId: string): Promise<Array<AbsenceInactivationLogView>>;
    getEmployeeMonthlyAttendance(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<Array<AttendanceRecord>>;
    getEmployeePerformance(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<PerformanceRecord | null>;
    getEmployeeReportingChain(token: string, userId: UserId): Promise<Array<ReportingChainEntry>>;
    getEmployeeTargetVsActual(token: string, userId: UserId, month: bigint, year: bigint): Promise<TargetVsActual>;
    getEmployeesByHq(token: string, hqId: LocationId): Promise<Array<UserWithPrimaryHq>>;
    getEmployeesForTrailSelector(session: string): Promise<{
        __kind__: "ok";
        ok: Array<{
            userId: UserId;
            name: string;
            role: string;
        }>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getEnrichedLiveLocations(token: string): Promise<{
        __kind__: "ok";
        ok: Array<{
            lat: number;
            lng: number;
            userId: UserId;
            name: string;
            role: string;
            lastReportedAt: bigint;
        }>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getExpenseClaimSummary(token: string, fromDate: string, toDate: string): Promise<Array<ExpenseClaimSummaryRow>>;
    getExpenseSheet(employeeId: string, month: bigint, year: bigint): Promise<ExpenseSheet | null>;
    getExpiringCharges(token: string, daysAhead: bigint): Promise<Array<AdditionalCharge>>;
    getGiftArticleMonthlyUsage(token: string, month: bigint, year: bigint): Promise<Array<[GiftArticleId, bigint]>>;
    getGpsAccuracyCategory(accuracy: number | null): Promise<GpsAccuracyCategory>;
    getGpsActivityLog(token: string, filter: GpsActivityFilter): Promise<Array<GpsActivityEntry>>;
    getGpsActivityLogGrouped(token: string, filterUserId: UserId | null, date: string): Promise<Array<[string, Array<GpsActivityEntry>]>>;
    getGpsEnforcementEnabled(): Promise<boolean>;
    getGpsTrail(token: string, userId: UserId, date: string): Promise<Array<GpsCoord>>;
    getHealthCheckHistory(token: string, limit: bigint): Promise<Array<HealthCheckReport>>;
    getHigherAuthoritiesForMe(token: string): Promise<Array<{
        userName: string;
        userId: bigint;
        role: Role;
    }>>;
    getHolidaysForExport(token: string): Promise<Array<HolidayExportRow>>;
    getHqDaRate(): Promise<bigint>;
    getInactiveUsers(token: string): Promise<Array<UserInfo>>;
    getIncentiveBonusSheet(employeeId: string, quarter: bigint, year: bigint): Promise<IncentiveBonusSheet | null>;
    getInvalidHqEmployees(token: string): Promise<Array<InvalidHqEmployee>>;
    getInvalidRoleEmployees(token: string): Promise<Array<{
        id: UserId;
        rawRole: string;
        name: string;
        employeeId: string;
    }>>;
    getJfw(token: string, jfwId: bigint): Promise<JfwInfo | null>;
    getJfwSummary(token: string, fromDate: string, toDate: string): Promise<Array<JfwSummaryRow>>;
    getLatestHealthCheck(token: string): Promise<HealthCheckReport | null>;
    getLeaveBalance(token: string): Promise<{
        __kind__: "ok";
        ok: {
            co: bigint;
            ml: bigint;
            pl: bigint;
            lwp: bigint;
            sick: bigint;
            unpaid: bigint;
            casual: bigint;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    getLeaveExportRows(token: string, filter: LeaveFilter): Promise<{
        __kind__: "ok";
        ok: Array<LeaveExportRow>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getLocation(token: string, userId: UserId): Promise<LocationRecord | null>;
    getLocationHierarchy(token: string, locationId: LocationId): Promise<LocationHierarchyPath | null>;
    getLocationTrailForEmployee(requestorSession: string, targetUserId: UserId, date: string): Promise<{
        __kind__: "ok";
        ok: GpsTrailRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getLocationsByLevel(token: string, level: LocationLevel): Promise<Array<PrimaryHqInfo>>;
    getLocationsForRole(token: string, role: Role): Promise<Array<PrimaryHqInfo>>;
    getMRCallDetails(token: string, mrUserId: UserId, fromDate: bigint, toDate: bigint): Promise<{
        __kind__: "ok";
        ok: Array<DayCallSummary>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMRCallSummary(token: string, mrUserId: UserId, fromDate: bigint, toDate: bigint): Promise<{
        __kind__: "ok";
        ok: MRCallSummary;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMRKpiSummary(token: string, mrId: UserId, month: bigint, year: bigint): Promise<{
        newDoctors: bigint;
        stockistPct: number;
        target?: MonthlyTarget;
        chemistVisits: bigint;
        newDoctorsPct: number;
        doctorCalls: bigint;
        doctorCallPct: number;
        chemistPct: number;
        stockistVisits: bigint;
    }>;
    getMRMissedVisitSummary(token: string, month: bigint, year: bigint): Promise<{
        __kind__: "ok";
        ok: Array<MRMissedSummary>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMRPortalEntries(token: string, fromDate: bigint, toDate: bigint): Promise<{
        __kind__: "ok";
        ok: Array<TaggedCallEntry>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMissedDoctorsForMR(token: string, mrUserId: UserId, month: bigint, year: bigint): Promise<{
        __kind__: "ok";
        ok: Array<MissedDoctorInfo>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMissedVisitAlerts(token: string, managerId: bigint): Promise<{
        __kind__: "ok";
        ok: Array<MissedVisitAlert>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMissedVisitAlertsAll(token: string): Promise<{
        __kind__: "ok";
        ok: Array<MissedVisitAlert>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMonthlyAttendance(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<Array<AttendanceRecord>>;
    getMonthlySummary(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<MonthlySummary>;
    getMonthlyTarget(token: string, userId: UserId, month: bigint, year: bigint): Promise<MonthlyTarget | null>;
    getMrMonthlySummary(mrId: UserId, month: string): Promise<MrMonthlySummary>;
    getMrsGroupedByAsmForManager(token: string): Promise<{
        __kind__: "ok";
        ok: Array<AsmMrGroup>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMtpUnsubmittedMRs(token: string, month: bigint, year: bigint): Promise<{
        __kind__: "ok";
        ok: Array<bigint>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMtpVsActualData(token: string, mrId: bigint, month: bigint, year: bigint): Promise<Array<[string, string, string]>>;
    getMyAdvances(): Promise<Array<EmployeeAdvance>>;
    getMyBalance(token: string, month: bigint, year: bigint): Promise<Array<SampleBalanceView>>;
    getMyCheckIns(token: string): Promise<Array<AttendanceCheckIn>>;
    getMyDaHistory(token: string, month: bigint, year: bigint): Promise<Array<DaHistoryRow>>;
    getMyDcr(token: string, date: string): Promise<DcrInfo | null>;
    getMyExpenseSheet(month: bigint, year: bigint): Promise<ExpenseSheet | null>;
    getMyExpenses(token: string): Promise<Array<TaDaExpense>>;
    getMyIncentiveBonusSheet(quarter: bigint, year: bigint): Promise<IncentiveBonusSheet | null>;
    getMyIncentives(token: string, filter: IncentiveFilter): Promise<Array<IncentiveCalculation>>;
    getMyLeaves(token: string): Promise<{
        __kind__: "ok";
        ok: Array<LeaveApplication>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getMyMonthlyAttendance(token: string, month: bigint, year: bigint): Promise<Array<AttendanceRecord>>;
    getMyMonthlyTarget(token: string, month: bigint, year: bigint): Promise<MonthlyTarget | null>;
    getMyNotifications(token: string): Promise<Array<NotificationRecord>>;
    getMyOfficialLetters(token: string): Promise<Array<OfficialLetterView>>;
    getMyPayrollHistory(token: string): Promise<Array<PayrollRecord>>;
    getMyPayrollRecord(token: string, month: bigint, year: bigint): Promise<PayrollRecord | null>;
    getMyProjectedIncentive(token: string, period: TargetPeriod, year: bigint, month: bigint | null): Promise<IncentiveCalculation | null>;
    getMySalesDashboard(token: string, month: bigint, year: bigint, currentDay: bigint): Promise<SalesDashboardSummary>;
    getMyStationForDate(token: string, date: string): Promise<string | null>;
    getMySubmissions(token: string): Promise<Array<SuggestionSubmission>>;
    getMyTarget(token: string, period: TargetPeriod, year: bigint): Promise<BottomUpTarget | null>;
    getMyTargetVsActual(token: string, month: bigint, year: bigint): Promise<TargetVsActual>;
    getNewDoctorsThisMonth(token: string, mrId: UserId, month: bigint, year: bigint): Promise<bigint>;
    getNotificationSettings(token: string): Promise<NotificationSettings>;
    getOfficialLetter(token: string, id: bigint): Promise<OfficialLetterView | null>;
    getOfficialLettersByEmployee(token: string, employeeId: bigint): Promise<Array<OfficialLetterView>>;
    getOfficialLettersByType(token: string, letterType: LetterType): Promise<Array<OfficialLetterView>>;
    getOnLeaveEmployeesForUser(token: string): Promise<Array<OnLeaveEmployee>>;
    getOutStationDaRate(token: string, userId: UserId): Promise<bigint | null>;
    getPayrollRecord(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<PayrollRecord | null>;
    getPendingApprovalCounts(token: string): Promise<PendingApprovalCounts>;
    getPendingExpenses(token: string): Promise<Array<TaDaExpense>>;
    getPendingLeavesForManager(token: string): Promise<{
        __kind__: "ok";
        ok: Array<LeaveApplication>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getProduct(productId: ProductId): Promise<ProductInfo | null>;
    getReactivationLog(token: string): Promise<Array<ReactivationLogEntry>>;
    getRegionsByZone(token: string, zoneId: LocationId): Promise<Array<StateRecord>>;
    getRepairHistory(token: string, limit: bigint): Promise<Array<RepairLog>>;
    getReporteeLocations(token: string): Promise<Array<LocationRecord>>;
    getRoleHierarchyConfig(token: string): Promise<RoleHierarchyConfig>;
    getRoleLeaveQuota(token: string, role: Role, year: bigint): Promise<{
        __kind__: "ok";
        ok: RoleLeaveQuota;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getRsmDirectMrs(token: string): Promise<Array<UserInfo>>;
    getSalesDashboardForUser(token: string, userId: bigint, month: bigint, year: bigint, currentDay: bigint): Promise<SalesDashboardSummary>;
    getSecondarySalesByEmployee(token: string, employeeId: UserId): Promise<Array<SecondarySaleRecord>>;
    getSfaReminderSettings(token: string): Promise<{
        __kind__: "ok";
        ok: SfaReminderSettings;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getStationsByArea(token: string, areaId: LocationId): Promise<Array<HQRecord>>;
    getStationsByMR(token: string, mrUserId: bigint): Promise<{
        __kind__: "ok";
        ok: Array<string>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getStationsByMRHqAssignments(token: string, mrUserId: bigint): Promise<{
        __kind__: "ok";
        ok: Array<StationRecord>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getStockist(token: string, stockistId: StockistId): Promise<StockistRecord | null>;
    getStockistCall(token: string, callId: bigint): Promise<StockistCallInfo | null>;
    getSubordinatesInHierarchy(token: string, managerId: UserId): Promise<Array<UserId>>;
    getSummaryReport(token: string, filterTerritory: string | null, filterArea: string | null, filterRole: Role | null): Promise<Array<BottomUpTargetSummaryRow>>;
    getSystemAlerts(token: string): Promise<Array<SystemAlert>>;
    getTaDaGradeByName(token: string, gradeName: string): Promise<{
        __kind__: "ok";
        ok: TaDaGrade;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getTaDaGrades(token: string): Promise<{
        __kind__: "ok";
        ok: Array<TaDaGrade>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getTargetAdjustmentLogs(token: string, filter: TargetAdjustmentFilter): Promise<Array<TargetAdjustmentLog>>;
    getTargetAdjustmentLogsForUser(token: string, userId: UserId): Promise<Array<TargetAdjustmentLog>>;
    getTargetHierarchy(token: string): Promise<Array<TargetHierarchyNode>>;
    getTargetRevisionHistory(token: string, userId: UserId, month: bigint, year: bigint): Promise<Array<TargetRevision>>;
    getTargetVsActualPerformance(token: string, filter: PerformanceFilter): Promise<Array<PerformanceRow>>;
    getTeamDailyActivity(token: string, date: string): Promise<Array<MrDailyActivityRow>>;
    getTeamIncentives(token: string, filter: IncentiveFilter): Promise<Array<IncentiveCalculation>>;
    getTeamSampleBalances(token: string, mrIds: Array<bigint>, month: bigint, year: bigint): Promise<{
        __kind__: "ok";
        ok: Array<[bigint, Array<SampleBalanceView>]>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getTeamTargetVsActual(token: string, month: bigint, year: bigint): Promise<Array<TargetVsActual>>;
    getTeamWorkingStyleHistory(managerId: string, from: bigint, to: bigint): Promise<Array<WorkingStyleRecord>>;
    getTerritoriesByStation(token: string, stationId: LocationId): Promise<Array<AreaRecord>>;
    getTerritoryCoverage(territory: string, month: string): Promise<TerritoryCoverage>;
    getTodayWorkingStyle(employeeId: string): Promise<WorkingStyleRecord | null>;
    getTrailWithDoctorCalls(session: string, targetUserId: UserId, date: string): Promise<{
        __kind__: "ok";
        ok: Array<EnrichedTrailEvent>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getTravelPlan(token: string, id: TravelPlanId): Promise<TravelPlanInfo | null>;
    getUidCompanyPrefix(token: string): Promise<string>;
    getUnreadNotificationCount(token: string): Promise<bigint>;
    getUnreadReplyCount(token: string): Promise<bigint>;
    getUnreadSuggestionCount(token: string): Promise<bigint>;
    getUpcomingBirthdays(daysAhead: bigint, token: string): Promise<Array<{
        hq: string;
        userId: string;
        name: string;
        role: string;
        birthdayDate: string;
        daysUntilBirthday: bigint;
    }>>;
    getUser(token: string, userId: UserId): Promise<UserInfo | null>;
    getUserByEmployeeId(token: string, employeeId: string): Promise<UserInfo | null>;
    getUserByUID(token: string, uid: string): Promise<UserInfo | null>;
    getUserLocationAllotment(token: string, userId: UserId): Promise<UserLocationAllotment | null>;
    getUsersWithHigherRole(token: string, targetRole: Role): Promise<Array<UserInfo>>;
    getWeeklyTaDaSummaryByRole(from: bigint, to: bigint): Promise<Array<TaDaExpense>>;
    getWorkingStyleHistory(employeeId: string, from: bigint, to: bigint): Promise<Array<WorkingStyleRecord>>;
    getZones(token: string): Promise<Array<ZoneRecord>>;
    hasUserSeenMessageToday(token: string, messageId: string, today: string): Promise<boolean>;
    isHoliday(token: string, date: bigint): Promise<boolean>;
    listActiveAreasByHQ(token: string, hqId: LocationId): Promise<Array<AreaRecord>>;
    listActiveHQsByTerritory(token: string, territoryId: LocationId): Promise<Array<HQRecord>>;
    listActiveStatesByZone(token: string, zoneId: LocationId): Promise<Array<StateRecord>>;
    listActiveTerritories(token: string, stateId: LocationId): Promise<Array<TerritoryRecord>>;
    listActiveZones(token: string): Promise<Array<ZoneRecord>>;
    listAdminMessages(token: string): Promise<{
        __kind__: "ok";
        ok: Array<AdminMessageInfo>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listAllActiveAreas(token: string): Promise<Array<AreaRecord>>;
    listAllAdditionalCharges(token: string, filter: AdditionalChargeFilter): Promise<Array<AdditionalCharge>>;
    listAllAreas(token: string): Promise<Array<AreaRecord>>;
    listAllBookingRequests(token: string): Promise<Array<BookingRequestInfo>>;
    listAllBottomUpTargets(token: string): Promise<Array<BottomUpTarget>>;
    listAllBusinessReports(token: string, userId: bigint | null, month: bigint | null, year: bigint | null): Promise<Array<BusinessReportInfo>>;
    listAllCrmRequests(token: string, status: CrmStatus | null): Promise<Array<CrmRequestInfo>>;
    listAllGiftArticles(token: string): Promise<Array<GiftArticleInfo>>;
    listAllGiftArticlesMaster(token: string): Promise<Array<GiftArticleInfo>>;
    listAllMrSummaries(month: string): Promise<Array<MrMonthlySummary>>;
    listAllOfficialLetters(token: string): Promise<Array<OfficialLetterView>>;
    listAllStations(token: string): Promise<Array<StationRecord>>;
    listAllTravelPlans(token: string, userId: bigint | null, month: string | null): Promise<Array<TravelPlanInfo>>;
    listAllUsers(token: string): Promise<Array<UserInfo>>;
    listAllZones(): Promise<Array<ZoneRecord>>;
    listAreasByHQ(token: string, hqId: LocationId): Promise<Array<AreaRecord>>;
    listAreasByRegion(regionId: LocationId): Promise<Array<TerritoryRecord>>;
    listCallReportsByMr(token: string, mrId: UserId, fromDate: bigint, toDate: bigint): Promise<{
        __kind__: "ok";
        ok: Array<CallReportDetail>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listCallReportsMrIds(token: string): Promise<{
        __kind__: "ok";
        ok: Array<UserId>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listChemists(): Promise<Array<ChemistInfo>>;
    listChemistsByTerritory(territory: string): Promise<Array<ChemistInfo>>;
    listCrmDoctorSales(token: string, filter: CrmDoctorSaleFilter): Promise<Array<CrmDoctorSaleRecord>>;
    listDoctors(): Promise<Array<DoctorInfo>>;
    listDoctorsByTerritory(territory: string): Promise<Array<DoctorInfo>>;
    listEmpIdConfigs(token: string): Promise<Array<EmpIdConfig>>;
    listEmployeesForHqHierarchy(token: string): Promise<Array<HqHierarchyEmployee>>;
    listGiftArticles(token: string): Promise<Array<GiftArticleInfo>>;
    listGiftArticlesMaster(token: string): Promise<Array<GiftArticleInfo>>;
    listGpsOverrides(token: string): Promise<{
        __kind__: "ok";
        ok: Array<GpsOverrideEntry>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    listHQsByTerritory(token: string, territoryId: LocationId): Promise<Array<HQRecord>>;
    listIncentivePlans(token: string, role: Role | null, period: TargetPeriod | null): Promise<Array<IncentivePlan>>;
    listJfwsAboutMe(token: string): Promise<Array<JfwInfo>>;
    listJfwsForMR(token: string, mrId: bigint): Promise<Array<JfwInfo>>;
    listMonthlyTargets(token: string, filter: MonthlyTargetFilter): Promise<Array<MonthlyTarget>>;
    listMyAllocations(token: string, month: bigint, year: bigint): Promise<Array<SampleAllocationInfo>>;
    listMyBookingRequests(token: string): Promise<Array<BookingRequestInfo>>;
    listMyBusinessReports(token: string, month: bigint | null, year: bigint | null): Promise<Array<BusinessReportInfo>>;
    listMyCallReports(mrId: UserId): Promise<Array<CallReportInfo>>;
    listMyCallReportsByMonth(mrId: UserId, month: string): Promise<Array<CallReportInfo>>;
    listMyChemistCalls(token: string, fromDate: string, toDate: string): Promise<Array<ChemistCallInfo>>;
    listMyChemists(mrId: UserId): Promise<Array<ChemistInfo>>;
    listMyCrmRequests(token: string): Promise<Array<CrmRequestInfo>>;
    listMyDcrs(token: string, fromDate: string, toDate: string): Promise<Array<DcrInfo>>;
    listMyDoctorAssignments(mrId: UserId): Promise<Array<DoctorProductAssignment>>;
    listMyDoctors(mrId: UserId): Promise<Array<DoctorInfo>>;
    listMyJfws(token: string, fromDate: string, toDate: string): Promise<Array<JfwInfo>>;
    listMyOrders(mrId: UserId): Promise<Array<ChemistOrderInfo>>;
    listMySalesTargets(token: string): Promise<Array<SalesTarget>>;
    listMyStockistCalls(token: string, fromDate: string, toDate: string): Promise<Array<StockistCallInfo>>;
    listMyTravelPlans(token: string, month: string | null): Promise<Array<TravelPlanInfo>>;
    listOrdersByChemist(chemistId: ChemistId): Promise<Array<ChemistOrderInfo>>;
    listPricelistProducts(token: string): Promise<Array<PricelistProductInfo>>;
    listProducts(): Promise<Array<ProductInfo>>;
    listRegionsByZone(zoneId: LocationId): Promise<Array<StateRecord>>;
    listReportees(token: string, managerId: UserId): Promise<Array<UserInfo>>;
    listSecondarySales(token: string, filter: SecondarySaleFilter): Promise<Array<SecondarySaleRecord>>;
    listStatesByZone(token: string, zoneId: LocationId): Promise<Array<StateRecord>>;
    listStationBulkUploadHistory(token: string): Promise<Array<BulkStationImportResult>>;
    listStationsByArea(areaId: LocationId): Promise<Array<HQRecord>>;
    listStationsByHQ(token: string, hqId: LocationId): Promise<Array<StationRecord>>;
    listStockists(token: string, filter: StockistFilter): Promise<Array<StockistRecord>>;
    listStockistsByArea(token: string, areaId: bigint): Promise<Array<StockistRecord>>;
    listSubmittedReports(): Promise<Array<CallReportInfo>>;
    listTeamChemistCalls(token: string, mrIds: Array<bigint>, fromDate: string, toDate: string): Promise<Array<ChemistCallInfo>>;
    listTeamDcrs(token: string, mrIds: Array<bigint>, fromDate: string, toDate: string): Promise<Array<DcrInfo>>;
    listTeamStockistCalls(token: string, mrIds: Array<bigint>, fromDate: string, toDate: string): Promise<Array<StockistCallInfo>>;
    listTerritoriesByState(token: string, stateId: LocationId): Promise<Array<TerritoryRecord>>;
    listTerritoriesByStation(token: string, stationId: LocationId): Promise<Array<TerritoryRecord>>;
    listTerritoriesForStation(stationId: LocationId): Promise<Array<AreaRecord>>;
    listUsersAboveRole(token: string, targetRole: Role): Promise<Array<UserInfo>>;
    listUsersByRole(token: string, role: Role): Promise<Array<UserInfo>>;
    listUsersByTerritory(token: string, territory: string): Promise<Array<UserInfo>>;
    listUsersWithAllotments(token: string): Promise<Array<UserLocationAllotment>>;
    listZones(token: string): Promise<Array<ZoneRecord>>;
    login(username: string, password: string): Promise<LoginResult>;
    logout(token: string): Promise<void>;
    markAllNotificationsRead(token: string): Promise<MutationResult>;
    markExpenseSheetPaid(sheetId: string, paymentDate: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    markInactivationReactivated(token: string, logId: string, reactivatedBy: string): Promise<AbsenceResult>;
    markIncentiveBonusSheetPaid(sheetId: string, paymentDate: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    markIncentivePaidOnSlip(token: string, userId: UserId, period: TargetPeriod, year: bigint, month: bigint | null): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    markNotificationsRead(notificationIds: Array<string>, token: string): Promise<MutationResult>;
    markSuggestionsAsRead(token: string, ids: Array<bigint>): Promise<MutationResult>;
    overrideTarget(token: string, input: OverrideBottomUpTargetInput): Promise<MutationResult>;
    pauseAdvance(id: string, pause: boolean, remark: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    processMonthlyAdvanceDeductions(month: bigint, year: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    processPayroll(token: string, employeeId: bigint, month: bigint, year: bigint): Promise<MutationResult>;
    processPayrollFull(token: string, employeeId: bigint, month: bigint, year: bigint, basicPay: bigint, hra: bigint, taAllowance: bigint, daAllowance: bigint): Promise<MutationResult>;
    reactivateUser(token: string, userId: UserId): Promise<MutationResult>;
    recordAttendance(token: string, employeeId: bigint, date: string, status: AttendanceStatus): Promise<MutationResult>;
    recordGpsTrail(token: string, date: string, coord: GpsCoord): Promise<MutationResult>;
    recordMessageDismissal(token: string, messageId: string, today: string): Promise<MutationResult>;
    recordSamplesUsed(token: string, callReportId: bigint, usages: Array<SampleUsageInput>): Promise<{
        __kind__: "ok";
        ok: Array<bigint>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    refreshExpenseSheetStatus(): Promise<void>;
    refreshIncentiveBonusSheetStatus(): Promise<void>;
    rejectBookingRequest(token: string, id: BookingId, reason: string): Promise<MutationResult>;
    rejectCrmRequest(token: string, id: CrmRequestId, reason: string): Promise<MutationResult>;
    removeAdditionalCharge(token: string, chargeId: string): Promise<MutationResult>;
    resetUserPassword(token: string, userId: UserId): Promise<PasswordResetResult>;
    resubmitBookingRequest(token: string, id: BookingId): Promise<MutationResult>;
    reviewCallReport(reviewerId: UserId, reportId: ReportId, approved: boolean, note: string): Promise<MutationResult>;
    revokeGpsOverride(token: string, employeeId: UserId, overrideId: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    runAutoRepair(token: string, repairTypes: Array<string>): Promise<RepairResult>;
    runHealthCheckNow(token: string): Promise<HealthCheckReport>;
    saveEmpIdConfig(token: string, config: EmpIdConfig): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    seedAdminPassword(token: string): Promise<MutationResult>;
    setCompanyProfile(token: string, input: UpdateCompanyProfileInput): Promise<MutationResult>;
    setDaConfigs(token: string, configs: Array<DaConfig>): Promise<MutationResult>;
    setDoctorClassification(token: string, doctorId: bigint, isCoreDoctor: boolean, visitFrequencyTarget: bigint): Promise<MutationResult>;
    setGpsEnforcementEnabled(token: string, enabled: boolean): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setMonthlyTarget(token: string, input: SetMonthlyTargetInput): Promise<{
        __kind__: "ok";
        ok: MonthlyTarget;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setMrTarget(token: string, input: CreateBottomUpTargetInput): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setPrimaryHq(token: string, userId: UserId, hqId: LocationId): Promise<MutationResult>;
    setRoleHierarchyConfig(token: string, roleOrder: Array<Role>): Promise<MutationResult>;
    setRoleLeaveQuota(token: string, quota: RoleLeaveQuota): Promise<{
        __kind__: "ok";
        ok: RoleLeaveQuota;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setSfaReminderSettings(token: string, settings: SfaReminderSettings): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setTaDaGrade(token: string, grade: TaDaGrade): Promise<{
        __kind__: "ok";
        ok: TaDaGrade;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setUidCompanyPrefix(token: string, prefix: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    submitCallReport(token: string, reportId: ReportId): Promise<MutationResult>;
    submitChemistCall(token: string, input: ChemistCallInput): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    submitChemistOrder(mrId: UserId, input: CreateOrderInput): Promise<OrderId>;
    submitDcr(token: string, input: DcrInput): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    submitJfw(token: string, input: JfwInput): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    submitLocation(token: string, lat: number, lng: number): Promise<MutationResult>;
    submitStockistCall(token: string, input: StockistCallInput): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    submitSuggestion(token: string, input: SubmitSuggestionInput): Promise<MutationResult>;
    submitTaDaExpense(token: string, date: string, stationType: StationType, fromLocation: string | null, toLocation: string | null, distanceKm: bigint, daRate: DaRate, purpose: string, gpsLocation: GpsCoord | null): Promise<MutationResult>;
    submitTaDaExpenseV2(token: string, date: string, stationType: StationType, fromLocation: string | null, toLocation: string | null, distanceKm: bigint, daRate: DaRate, purpose: string, gpsLocation: GpsCoord | null, modeOfTransport: string | null, lodgingExpense: bigint | null, miscExpense: bigint | null, miscNarration: string | null, gradeName: string | null): Promise<{
        __kind__: "ok";
        ok: TaDaExpense;
    } | {
        __kind__: "err";
        err: string;
    }>;
    submitTravelPlan(token: string, id: TravelPlanId): Promise<MutationResult>;
    submitWorkingStyle(input: SubmitWorkingStyleInput): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    triggerAbsenceCheckNow(token: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    triggerDoctorCallNotification(callReportId: string, token: string): Promise<MutationResult>;
    triggerIncentiveCalculation(token: string, period: TargetPeriod, year: bigint, month: bigint | null): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    undoOverride(token: string, targetId: bigint): Promise<MutationResult>;
    updateAbsenceSettings(input: {
        excludeLongTermLeave: boolean;
        consecutiveAbsenceThreshold: bigint;
        absenceCheckEnabled: boolean;
        warningNotificationsEnabled: boolean;
    }, token: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateAdditionalCharge(token: string, input: UpdateAdditionalChargeInput): Promise<MutationResult>;
    updateAdminMessage(token: string, input: UpdateAdminMessageInput): Promise<{
        __kind__: "ok";
        ok: AdminMessageInfo;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateAdvance(id: string, input: UpdateAdvanceInput): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateArea(token: string, id: LocationId, input: UpdateAreaInput): Promise<MutationResult>;
    updateCompanyHoliday(token: string, input: UpdateHolidayInput): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateDcrSettings(token: string, deadlineHour: bigint, deadlineMinute: bigint, isEnabled: boolean): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateDoctor(doctorId: DoctorId, mrId: UserId, name: string | null, station: string | null, area: string | null, territory: string | null, specialization: string | null, contactPhone: string | null): Promise<MutationResult>;
    updateDoctorAdmin(token: string, doctorId: bigint, name: string | null, qualification: DoctorQualification | null, station: string | null, area: string | null, territory: string | null, specialization: string | null, contactPhone: string | null, category: string | null, email: string | null, clinicName: string | null, address: string | null, isActive: boolean | null, dateOfBirth: string | null): Promise<MutationResult>;
    updateEarnedLeaveAccrual(token: string, employeeId: bigint, year: bigint, month: bigint, annualLimit: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateGiftArticle(token: string, id: GiftArticleId, input: UpdateGiftArticleInput): Promise<{
        __kind__: "ok";
        ok: GiftArticleInfo;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateGiftArticleMaster(token: string, id: GiftArticleId, input: UpdateGiftArticleInput): Promise<{
        __kind__: "ok";
        ok: GiftArticleInfo;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateHQ(token: string, id: LocationId, input: UpdateHQInput): Promise<MutationResult>;
    updateIncentivePlan(token: string, input: UpdateIncentivePlanInput): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateLeaveStatus(token: string, input: UpdateLeaveStatusInput): Promise<{
        __kind__: "ok";
        ok: LeaveApplication;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateNotificationSettings(input: {
        batchMinCount: bigint;
        cascadeLevel: string;
        quietHoursEnabled: boolean;
        doctorCallNotificationsEnabled: boolean;
        quietHoursStart: string;
        quietHoursEnd: string;
        batchWindowSeconds: bigint;
        batchingEnabled: boolean;
    }, token: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateOfficialLetter(token: string, id: bigint, input: UpdateLetterInput): Promise<MutationResult>;
    updateOrderStatus(orderId: OrderId, status: OrderStatus): Promise<MutationResult>;
    updatePricelistProduct(token: string, id: PricelistProductId, input: UpdatePricelistProductInput): Promise<MutationResult>;
    updateProduct(productId: ProductId, name: string | null, category: ProductCategory | null, description: string | null, productCode: string | null, division: string | null, mrpPaise: bigint | null, packSize: string | null): Promise<MutationResult>;
    updateRegion(token: string, id: LocationId, name: string): Promise<MutationResult>;
    updateState(token: string, id: LocationId, input: UpdateStateInput): Promise<MutationResult>;
    updateStation(token: string, stationId: LocationId, input: UpdateStationInput): Promise<MutationResult>;
    updateStockist(token: string, req: UpdateStockistRequest): Promise<{
        __kind__: "ok";
        ok: StockistRecord;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateSuggestionStatus(token: string, input: UpdateSuggestionStatusInput): Promise<MutationResult>;
    updateTerritory(token: string, id: LocationId, input: UpdateTerritoryInput): Promise<MutationResult>;
    updateTerritoryUnderStation(token: string, territoryId: LocationId, name: string): Promise<MutationResult>;
    updateTravelPlan(token: string, id: TravelPlanId, input: CreateTravelPlanInput): Promise<MutationResult>;
    updateUser(token: string, userId: UserId, input: UpdateUserInput): Promise<MutationResult>;
    updateZone(token: string, id: LocationId, input: UpdateZoneInput): Promise<MutationResult>;
    upsertPerformance(token: string, employeeId: bigint, month: bigint, year: bigint, callsMade: bigint, doctorsVisited: bigint, chemistOrders: bigint, totalSales: bigint, remarks: string): Promise<MutationResult>;
    validateHqForRole(token: string, role: Role, hqId: LocationId): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    whoami(token: string): Promise<Session | null>;
}
