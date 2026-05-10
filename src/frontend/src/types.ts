export type {
  Role,
  UserInfo,
  Session,
  LeaveApplication,
  LeaveExportRow,
  AttendanceRecord,
  AttendanceCorrectionInput,
  MonthlySummary,
  PayrollRecord,
  TaDaExpense,
  PerformanceRecord,
  EmployeeDocument,
  CallReportInfo,
  DoctorInfo,
  ChemistInfo,
  ChemistOrderInfo,
  ProductInfo,
  LocationRecord,
  MrMonthlySummary,
  GpsCoord,
  SalaryComponents,
  CreateUserInput,
  UpdateUserInput,
  CreateDoctorInput,
  CreateChemistInput,
  CreateOrderInput,
  CreateReportInput,
  AssignProductsInput,
  CreateProductInput,
  OrderItem,
  DoctorVisitEntry,
  SampleDistributed,
  DoctorProductAssignment,
  TerritoryCoverage,
  MutationResult,
  LoginResult,
  GpsTrailRecord,
  AttendanceCheckIn,
  TaDaTotals,
  DaConfig,
  DaHistoryRow,
  TravelPlanInfo,
  RoleHierarchyConfig,
  CreateTravelPlanInput,
  TravelPlanId,
  CrmRequestInfo,
  SalesTarget,
  BusinessReportInfo,
  SalesDashboardSummary,
  SalesTrackingData,
  ProductCommitment,
  CreateCrmRequestInput,
  CreateSalesTargetInput,
  CreateBusinessReportInput,
  CrmRequestId,
  SalesTargetId,
  BusinessReportId,
  // Export row types (from bindgen)
  ExportFilter,
  CallReportExportRow,
  DoctorVisitExportRow,
  TravelPlanExportRow,
  DaReportRow,
  CrmExportRow,
  // Bottom-Up Target types (from bindgen)
  BottomUpTarget,
  CreateBottomUpTargetInput,
  OverrideBottomUpTargetInput,
  TargetHierarchyNode,
  BottomUpTargetSummaryRow,
  // Performance & Incentive types (from bindgen)
  PerformanceRow,
  PerformanceFilter,
  IncentiveCalculation,
  IncentiveFilter,
  IncentivePlan,
  IncentiveSlab,
  CreateIncentivePlanInput,
  UpdateIncentivePlanInput,
  ApproveIncentiveInput,
  // Target Adjustment History
  TargetAdjustmentLog,
  TargetAdjustmentFilter,
  // Employee ID
  EmpIdConfig,
  // Monthly Targets (new system, replaces bottom-up monthly level)
  MonthlyTarget,
  MonthlyTargetFilter,
  SetMonthlyTargetInput,
  BulkSetMonthlyTargetsInput,
  TargetRevision,
  TargetVsActual,
  // Additional Charges
  AdditionalCharge,
  AdditionalChargeFilter,
  AssignAdditionalChargeInput,
  UpdateAdditionalChargeInput,
  // Secondary Sale & CRM Doctor Sale
  SecondarySaleRecord,
  SecondarySaleFilter,
  CreateSecondarySaleRequest,
  CrmDoctorSaleRecord,
  CrmDoctorSaleFilter,
  CreateCrmDoctorSaleRequest,
  StockistRecord,
  StockistFilter,
  SaleProductEntry,
  DoctorSaleProductEntry,
  AdditionalAreaInfo,
  UserLocationAllotment,
  // Company Holiday
  CompanyHoliday,
  CreateHolidayInput,
  UpdateHolidayInput,
  HolidayExportRow,
  HolidayApplicableTo,
  // Employee Advances
  EmployeeAdvance,
  CreateAdvanceInput,
  UpdateAdvanceInput,
  // Expense Sheets
  ExpenseSheet,
  ExpenseLineItem,
  ExpenseSheetFilter,
  // Incentive & Bonus Sheets
  IncentiveBonusSheet,
  IncentiveMonthEntry,
  BonusEntry,
  IncentiveBonusSheetFilter,
  // Working Style
  WorkingStyleRecord,
  SubmitWorkingStyleInput,
  // HQ-wise Station Allotment
  HqAssignment,
  StationRecord,
  CreateStationInput,
  UpdateStationInput,
  AdditionalHqAssignment,
  // Bulk Station Import
  BulkStationImportInput,
  BulkStationImportRowResult,
  BulkStationImportResult,
} from "./backend.d";

export {
  AttendanceStatus,
  CheckInStatus,
  CrmStatus,
  DaRate,
  DocumentType,
  HolidayType,
  LeaveType,
  OrderStatus,
  ProductCategory,
  ReportStatus,
  TravelPlanStatus,
  UserStatus,
  WorkType,
  WorkingMode,
  WorkingStationSource,
  // Bottom-Up Target enums (from bindgen)
  TargetPeriod,
  CalculationStatus,
  // Performance & Incentive enums (from bindgen)
  PerformanceStatus,
  IncentiveCalculationStatus,
  IncentiveType,
  // Additional Charges enums (from bindgen)
  ChargeType,
  // Payment & Advance enums (from bindgen)
  AdvanceStatus,
  PaymentStatus,
} from "./backend.d";

// ── MTP Bulk Upload types ────────────────────────────────────────────────────────────

// LeaveStatus is missing from generated bindings — define locally to match DID
export enum LeaveStatus {
  pending = "pending",
  approved = "approved",
  rejected = "rejected",
}

// ChargeStatus — derived from effective dates; defined locally for UI display
export enum ChargeStatus {
  Active = "Active",
  Expired = "Expired",
  Pending = "Pending",
}

export type {
  UserId,
  EmployeeId,
  DoctorId,
  ChemistId,
  ProductId,
  OrderId,
  ReportId,
  Timestamp,
  GiftArticleDistributedV2,
  GiftArticleId,
  GiftArticleInfo,
} from "./backend.d";

// ── Booking Request types ──────────────────────────────────────────────────
// BookingStatus and BookingIntendedUse are referenced in backend.d.ts
// but not exported as enums — define them here.

export enum BookingStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
}

export type BookingIntendedUse = "Sample" | "Gift";

// Re-export BookingRequestInfo shape using local types
// (backend.d.ts has the interface but its referenced enums aren't exported)
export interface BookingRequestInfo {
  id: bigint;
  userId: bigint;
  userName: string;
  userRole: string;
  itemName: string;
  quantity: bigint;
  intendedUse: BookingIntendedUse;
  targetDate: string;
  notes?: string;
  status: BookingStatus;
  rejectionReason?: string;
  createdAt: bigint;
  updatedAt: bigint;
  reviewedAt?: bigint;
  reviewedBy?: bigint;
}

export interface AuthState {
  token: string | null;
  userId: bigint | null;
  role: import("./backend.d").Role | null;
  employeeId: string | null;
  name: string | null;
}

export const ROLE_PORTAL: Record<import("./backend.d").Role, string> = {
  Admin: "/admin",
  HRManager: "/hr",
  MR: "/mr",
  ASM: "/asm",
  RSM: "/rsm",
  ZSM: "/zsm",
};

export const ROLE_LABELS: Record<import("./backend.d").Role, string> = {
  Admin: "Administrator",
  HRManager: "HR Manager",
  MR: "Medical Representative",
  ASM: "Area Sales Manager",
  RSM: "Regional Sales Manager",
  ZSM: "Zonal Sales Manager",
};

// WorkingStyleMode — aliases WorkingMode (same values, separate type in backend)
export type WorkingStyleMode = import("./backend.d").WorkingMode;

// ── Travel Plan types ──────────────────────────────────────────────────────

export type WorkingModeType = "WorkingAlone" | "WorkingWith";
export type WorkingStationSourceType = "AsPerTP" | "OtherStation";

export interface HigherAuthority {
  userId: bigint;
  username: string;
  displayName: string;
  role: import("./backend.d").Role;
}

// ── SalarySlipExportRow — defined locally (not in bindgen yet) ─────────────

// ── Report Details & Doctor Visit types (frontend-only until backend ships) ──

export interface GiftArticleItem {
  itemName: string;
  quantity: number;
}

export interface ReportDetailsInfo {
  id: bigint;
  date: string;
  workType: string;
  stationType: string;
  workingStationSource: string;
  workingStation?: string;
  workingMode: string;
  workingWithUserId?: bigint;
  workingWithUserName?: string;
  remarks: string;
  daAmount: number;
  gpsLat: number;
  gpsLng: number;
  userId: bigint;
  createdAt: bigint;
}

export interface DoctorVisitInfo {
  id: bigint;
  reportDetailsId: bigint;
  doctorId: bigint;
  productIds: bigint[];
  samplesDistributed: { productId: bigint; quantity: bigint }[];
  giftArticles: GiftArticleItem[];
  notes: string;
  gpsLat: number;
  gpsLng: number;
  createdAt: bigint;
}

export interface SalarySlipExportRow {
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string;
  month: string;
  year: string;
  basicPay: string;
  hra: string;
  taAllowance: string;
  daAllowance: string;
  grossPay: string;
  pfDeduction: string;
  esiDeduction: string;
  totalDeductions: string;
  netPay: string;
  approved: string;
}

// ── Pricelist types ───────────────────────────────────────────────────────

export interface PricelistProductInfo {
  id: bigint;
  srNo: bigint;
  name: string;
  composition: string;
  mrp: number;
  pts: number;
  ptr: number;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface AddPricelistProductInput {
  name: string;
  composition: string;
  mrp: number;
  pts: number;
  ptr: number;
}

export interface UpdatePricelistProductInput {
  name?: string;
  composition?: string;
  mrp?: number;
  pts?: number;
  ptr?: number;
}

// ── Bottom-Up Target Labels ───────────────────────────────────────────────
// TargetPeriod is already re-exported above from backend.d; used here for the Record key.

export const TARGET_PERIOD_LABELS: Record<
  import("./backend.d").TargetPeriod,
  string
> = {
  Monthly: "Monthly",
  Quarterly: "Quarterly",
  HalfYearly: "Half-Yearly",
  Yearly: "Yearly",
};

// ── Attendance Summary ─────────────────────────────────────────────────────

export interface AttendanceSummary {
  present: number;
  absent: number;
  leaves: number;
  holidays: number;
  weeklyOffs: number;
}

export interface AttendanceCorrectionFormData {
  date: string;
  employeeId: bigint;
  newStatus: import("./backend.d").AttendanceStatus;
  reason: string;
}

// ── Suggestions & Queries ─────────────────────────────────────────────────

export type SuggestionType =
  | "Suggestion"
  | "Query"
  | "Complaint"
  | "Feedback"
  | "Other";
export type SuggestionPriority = "Normal" | "Urgent";
export type SuggestionStatus =
  | "Pending"
  | "Under Review"
  | "Resolved"
  | "Closed";

export interface SuggestionSubmission {
  id: number;
  submittedByUserId: string;
  submittedByName: string;
  submittedByRole: string;
  submittedByEmployeeId: string;
  submissionType: SuggestionType;
  subject: string;
  description: string;
  priority: SuggestionPriority;
  attachmentUrl?: string;
  status: SuggestionStatus;
  submittedAt: number;
  statusUpdatedAt?: number;
  hrReply?: string;
  hrReplyAt?: number;
  hrReplyByName?: string;
  closingRemark?: string;
  isReadByHR: boolean;
  isReadByEmployee: boolean;
}

export interface SubmitSuggestionInput {
  submissionType: SuggestionType;
  subject: string;
  description: string;
  priority: SuggestionPriority;
  attachmentUrl?: string;
}

export interface UpdateSuggestionStatusInput {
  id: number;
  status: SuggestionStatus;
  closingRemark?: string;
}

export interface AddSuggestionReplyInput {
  id: number;
  reply: string;
}

export interface SuggestionFilter {
  submissionType?: SuggestionType;
  role?: string;
  priority?: SuggestionPriority;
  status?: SuggestionStatus;
  fromDate?: number;
  toDate?: number;
  employeeName?: string;
}

// ── On-Leave Employee ─────────────────────────────────────────────────────

export interface OnLeaveEmployee {
  employeeId: string;
  employeeName: string;
  role: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  leaveId: number;
  reason: string;
  approvedByName: string;
  approvedAt?: number;
}

// ── DCR (Daily Call Report) types — re-exported from backend.d ─────────────
// DcrInfo, DcrStatus, DcrWorkingType, DcrInput, DcrApprovalInput, DcrSummaryRow,
// DcrSettingsInfo are all from backend.d.ts

export type {
  DcrInfo,
  DcrInput,
  DcrApprovalInput,
  DcrSummaryRow,
  DcrSettingsInfo,
} from "./backend.d";

/** Frontend-only context type used when encoding MR-mode submissions in notes. */
export interface MrModeContext {
  roleContext: "MR" | "RSM";
  mrTerritoryHqId: string;
  submitterEmployeeId: string;
}

// ── Phase 3 Dashboard types — re-exported from backend.d ──────────────────
// Generated by bindgen from the new dashboard-api endpoints.
// MrDailyActivityRow, PendingApprovalCounts, ExpenseClaimSummaryRow,
// DcrReminderStatus, StationInfo, SystemAlert, and all KPI types.

export type {
  MrDailyActivityRow,
  PendingApprovalCounts,
  ExpenseClaimSummaryRow,
  DcrReminderStatus,
  SystemAlert,
  DashboardAggregates,
  MrKpis,
  AsmKpis,
  RsmKpis,
  ZsmKpis,
  HrKpis,
  AdminKpis,
} from "./backend.d";
