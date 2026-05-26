import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Role } from "./backend";
import { AdminMessagePopup } from "./components/AdminMessagePopup";
import { AppUpdatePopup } from "./components/AppUpdatePopup";
import { ChunkErrorBoundary } from "./components/ChunkErrorBoundary";
import { GpsGate } from "./components/GpsGate";
import { PwaInstallBanner } from "./components/PwaInstallBanner";
import ScrollToTop from "./components/ScrollToTop";
import { useBackgroundGpsCapture } from "./hooks/useGps";
import LoginPage from "./pages/LoginPage";
import { useAuthStore } from "./store/authStore";
import { ROLE_PORTAL } from "./types";

// Lazy portal pages (to be created in subsequent waves)
import { Suspense, lazy } from "react";
const AdminPortal = lazy(() => import("./pages/admin/AdminPortal"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const AdminGPSMap = lazy(() => import("./pages/admin/AdminGPSMap"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const ProductMaster = lazy(() => import("./pages/admin/ProductMaster"));
const AdminProductMasterPage = lazy(
  () => import("./pages/admin/ProductMasterPage"),
);
const AdminSampleAllocationPage = lazy(
  () => import("./pages/admin/SampleAllocationPage"),
);
const HRSampleAllocationPage = lazy(
  () => import("./pages/hr/SampleAllocationHR"),
);
const LocationMaster = lazy(() => import("./pages/admin/LocationMaster"));
const DAConfiguration = lazy(() => import("./pages/admin/DAConfiguration"));
const AdminTaDaPolicyConfig = lazy(
  () => import("./pages/admin/TaDaPolicyConfig"),
);
const AdminLeaveQuota = lazy(() => import("./pages/admin/LeaveQuotaConfig"));
const AdminRoleHierarchy = lazy(
  () => import("./pages/admin/RoleHierarchyConfig"),
);
const AdminMessageMgmt = lazy(
  () => import("./pages/admin/AdminMessageManagement"),
);
const AdminCompanyProfile = lazy(() => import("./pages/admin/CompanyProfile"));
const AdminDocumentConfig = lazy(
  () => import("./pages/admin/DocumentConfigPage"),
);
const AdminExpensePolicyConfig = lazy(
  () => import("./pages/admin/ExpensePolicyConfig"),
);
const AdminSalesTargetReport = lazy(
  () => import("./pages/admin/SalesTargetReport"),
);
const AdminAuditTrail = lazy(() => import("./pages/admin/AuditTrail"));
const AdminRecruitmentPipeline = lazy(
  () => import("./pages/admin/RecruitmentPipeline"),
);
const AdminAppraisalReport = lazy(
  () => import("./pages/admin/AppraisalReport"),
);
const AdminChemistMaster = lazy(() => import("./pages/admin/ChemistMaster"));
const AdminAttendanceReports = lazy(
  () => import("./pages/admin/AttendanceReports"),
);
const AdminBulkExport = lazy(() => import("./pages/admin/BulkExport"));
const AdminPayrollReports = lazy(() => import("./pages/admin/PayrollReports"));
const AdminDCRReport = lazy(() => import("./pages/admin/DCRReport"));
const AdminExpenseReports = lazy(() => import("./pages/admin/ExpenseReports"));

// Expense Claim Summary — ASM, RSM, Admin portals
const AdminExpenseClaimSummary = lazy(() =>
  import("./pages/shared/ExpenseClaimSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const ASMExpenseClaimSummary = lazy(() =>
  import("./pages/shared/ExpenseClaimSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMExpenseClaimSummary = lazy(() =>
  import("./pages/shared/ExpenseClaimSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const HRExpenseClaimSummary = lazy(() =>
  import("./pages/shared/ExpenseClaimSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const AdminOfficialLetters = lazy(() =>
  import("./pages/shared/OfficialLetters").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HROfficialLetters = lazy(() => import("./pages/hr/HROfficialLetters"));
const HRPortal = lazy(() => import("./pages/hr/HRPortal"));
const HREmployees = lazy(() => import("./pages/hr/EmployeeManagement"));
const HRLeaves = lazy(() => import("./pages/hr/LeaveManagement"));
const HRAttendance = lazy(() => import("./pages/hr/AttendanceTracking"));
const HRPayroll = lazy(() => import("./pages/hr/PayrollProcessing"));
const HRExpenseSheets = lazy(() => import("./pages/hr/ExpenseSheetManagement"));
const HRIncentiveBonusSheets = lazy(
  () => import("./pages/hr/IncentiveBonusSheetManagement"),
);
const HREmployeeAdvances = lazy(() => import("./pages/hr/EmployeeAdvances"));
const HRExpenses = lazy(() => import("./pages/hr/ExpenseManagement"));
const HRTaDaSummaryReport = lazy(() => import("./pages/hr/TaDaSummaryReport"));
const HRDocuments = lazy(() => import("./pages/hr/DocumentManagement"));
const HRPerformance = lazy(() => import("./pages/hr/PerformanceReports"));
const HRGpsTrail = lazy(() => import("./pages/hr/GpsTrailViewer"));
const HRCheckIn = lazy(() => import("./pages/hr/AttendanceCheckIn"));

const HRTravelPlans = lazy(() => import("./pages/hr/HRTravelPlans"));
const HRBookingApproval = lazy(() => import("./pages/hr/BookingApproval"));
const HRMessageMgmt = lazy(() => import("./pages/hr/HRMessageManagement"));
const MRBookingPage = lazy(() => import("./pages/mr/MRBookingPage"));
const MRChemistCallEntry = lazy(() => import("./pages/mr/ChemistCallEntry"));
const MRStockistCallEntry = lazy(() => import("./pages/mr/StockistCallEntry"));
const MRPortal = lazy(() => import("./pages/mr/MRPortal"));
const DailyCallReport = lazy(() => import("./pages/mr/DailyCallReport"));
const MRWorkingStyle = lazy(() => import("./pages/mr/WorkingStyle"));
const MRTravelPlan = lazy(() => import("./pages/mr/MRTravelPlan"));
const DoctorManagement = lazy(() => import("./pages/mr/DoctorManagement"));
const ChemistManagement = lazy(() => import("./pages/mr/ChemistManagement"));
const MRExpenses = lazy(() => import("./pages/mr/MRExpenses"));
const MRLeave = lazy(() => import("./pages/mr/MRLeave"));
const ASMLeave = lazy(() =>
  import("./pages/mr/MRLeave").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMLeave = lazy(() =>
  import("./pages/mr/MRLeave").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMLeave = lazy(() =>
  import("./pages/mr/MRLeave").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const ASMPortal = lazy(() => import("./pages/asm/ASMPortal"));
const RSMPortal = lazy(() => import("./pages/rsm/RSMPortal"));
const RSMBookingPage = lazy(() => import("./pages/rsm/RSMBookingPage"));
const RSMTravelPlans = lazy(() => import("./pages/rsm/RSMTravelPlans"));
const ZSMPortal = lazy(() => import("./pages/zsm/ZSMPortal"));
const ZSMBookingPage = lazy(() => import("./pages/zsm/ZSMBookingPage"));

// DCR Edit Request Review — Admin and ASM portals
const AdminDcrEditRequests = lazy(() =>
  import("./pages/shared/DcrEditRequestReview").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const ASMDcrEditRequests = lazy(() =>
  import("./pages/shared/DcrEditRequestReview").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);

// Attendance Correction Review — HR and Admin portals
const AdminAttendanceCorrections = lazy(() =>
  import("./pages/shared/AttendanceCorrectionReview").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRAttendanceCorrections = lazy(() =>
  import("./pages/shared/AttendanceCorrectionReview").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// GPS Settings — Admin only
const AdminGpsSettings = lazy(() => import("./pages/admin/AdminGpsSettings"));

// Station Master — Admin only
const AdminStationMaster = lazy(() => import("./pages/admin/StationMaster"));

// System Health — Admin only
const AdminSystemHealth = lazy(() => import("./pages/admin/SystemHealthPage"));

// Gift Article Master — Admin and HR
const AdminGiftArticleMaster = lazy(() =>
  import("./pages/admin/GiftArticleMaster").then((m) => ({
    default: () => <m.default portalRole="Admin" />,
  })),
);
const HRGiftArticleMaster = lazy(() =>
  import("./pages/admin/GiftArticleMaster").then((m) => ({
    default: () => <m.default portalRole="HRManager" />,
  })),
);

// Stockist Master — Admin and HR
const AdminStockistMaster = lazy(() => import("./pages/admin/StockistMaster"));
const HRStockistMaster = lazy(() => import("./pages/hr/StockistMasterHR"));

// Doctor Master — Admin and HR (with bulk upload and Excel template download)
const AdminDoctorMaster = lazy(() => import("./pages/admin/DoctorMaster"));
const HRDoctorMaster = lazy(() => import("./pages/hr/DoctorMasterHR"));

// Admin Leave Management (consolidated view including HR leaves)
const AdminLeaveManagement = lazy(
  () => import("./pages/admin/LeaveManagement"),
);

// Bottom-Up Target pages (legacy — kept for backward compat)
const BottomUpTargetsAdmin = lazy(
  () => import("./pages/admin/BottomUpTargetsAdmin"),
);
const BottomUpTargetsHR = lazy(() => import("./pages/hr/BottomUpTargetsHR"));
const MyTargetDashboard = lazy(
  () => import("./pages/shared/MyTargetDashboard"),
);

// Monthly Targets pages (replaces bottom-up)
const MonthlyTargetsAdmin = lazy(
  () => import("./pages/admin/MonthlyTargetsAdmin"),
);
const MonthlyTargetsHR = lazy(() => import("./pages/hr/MonthlyTargetsHR"));
const MyMonthlyTargets = lazy(() => import("./pages/mr/MyMonthlyTargets"));
const ASMMonthlyTargets = lazy(() => import("./pages/asm/ASMMonthlyTargets"));
const RSMMonthlyTargets = lazy(() => import("./pages/rsm/RSMMonthlyTargets"));
const ZSMMonthlyTargets = lazy(() => import("./pages/zsm/ZSMMonthlyTargets"));

// Additional Charges pages
const AdditionalChargesAdmin = lazy(
  () => import("./pages/admin/AdditionalChargesAdmin"),
);
const AdditionalChargesHR = lazy(
  () => import("./pages/hr/AdditionalChargesHR"),
);

// Additional Role Tab (shared — additional charge role view)
const AdditionalRoleTab = lazy(
  () => import("./pages/shared/AdditionalRoleTab"),
);

// Target vs. Actual Performance — role-scoped versions
const TargetVsActualASM = lazy(() =>
  import("./pages/shared/TargetVsActualPerformance").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const TargetVsActualRSM = lazy(() =>
  import("./pages/shared/TargetVsActualPerformance").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const TargetVsActualZSM = lazy(() =>
  import("./pages/shared/TargetVsActualPerformance").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const TargetVsActualAdmin = lazy(() =>
  import("./pages/shared/TargetVsActualPerformance").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const TargetVsActualHR = lazy(() =>
  import("./pages/shared/TargetVsActualPerformance").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// New admin/hr pages: Target History, Incentive Plans, Incentive Management, Employee ID Config
const AdminTargetHistory = lazy(() =>
  import("./pages/admin/TargetAdjustmentHistory").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRTargetHistory = lazy(() =>
  import("./pages/admin/TargetAdjustmentHistory").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const AdminIncentivePlans = lazy(() =>
  import("./pages/admin/IncentivePlanConfig").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRIncentivePlans = lazy(() =>
  import("./pages/admin/IncentivePlanConfig").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const AdminIncentiveManagement = lazy(() =>
  import("./pages/admin/IncentiveManagement").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRIncentiveManagement = lazy(() =>
  import("./pages/admin/IncentiveManagement").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const AdminEmployeeIdConfig = lazy(
  () => import("./pages/admin/EmployeeIdConfig"),
);
const AdminCleanTrialData = lazy(() => import("./pages/admin/CleanTrialData"));

const SampleLedgerMR = lazy(() =>
  import("./pages/shared/SampleLedger").then((m) => ({
    default: () => <m.default portalRole="MR" />,
  })),
);
const SampleLedgerAdmin = lazy(() =>
  import("./pages/shared/SampleLedger").then((m) => ({
    default: () => <m.default portalRole="Admin" />,
  })),
);
const SampleLedgerHR = lazy(() =>
  import("./pages/shared/SampleLedger").then((m) => ({
    default: () => <m.default portalRole="HRManager" />,
  })),
);
const SampleLedgerASM = lazy(() =>
  import("./pages/shared/SampleLedger").then((m) => ({
    default: () => <m.default portalRole="ASM" />,
  })),
);
const SampleLedgerRSM = lazy(() =>
  import("./pages/shared/SampleLedger").then((m) => ({
    default: () => <m.default portalRole="RSM" />,
  })),
);

const AdminDataCleanupHistory = lazy(() =>
  import("./pages/admin/DataCleanupHistory").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRDataCleanupHistory = lazy(() =>
  import("./pages/admin/DataCleanupHistory").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// Pricelist — Admin/HR get full backend-connected management, all others get read-only view
const AdminPricelist = lazy(() =>
  import("./pages/admin/ProductsPricelist").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRPricelist = lazy(() =>
  import("./pages/admin/ProductsPricelist").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const MRPricelist = lazy(() =>
  import("./pages/shared/PricelistView").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const ASMPricelist = lazy(() =>
  import("./pages/shared/PricelistView").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMPricelist = lazy(() =>
  import("./pages/shared/PricelistView").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMPricelist = lazy(() =>
  import("./pages/shared/PricelistView").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const mrSampleLedgerRoute = makePortalRoute(
  "/mr/sample-ledger",
  SampleLedgerMR as React.ComponentType,
  "MR",
);
const asmSampleLedgerRoute = makePortalRoute(
  "/asm/sample-ledger",
  SampleLedgerASM as React.ComponentType,
  "ASM",
);
const rsmSampleLedgerRoute = makePortalRoute(
  "/rsm/sample-ledger",
  SampleLedgerRSM as React.ComponentType,
  "RSM",
);
const adminSampleLedgerRoute = makePortalRoute(
  "/admin/sample-ledger",
  SampleLedgerAdmin as React.ComponentType,
  "Admin",
);
const hrSampleLedgerRoute = makePortalRoute(
  "/hr/sample-ledger",
  SampleLedgerHR as React.ComponentType,
  "HRManager",
);
// adminSampleReturnMgmt, visitFreq, mtpBulkUpload removed (V77-V82 rollback)
// Absence Audit Trail — HR and Admin
const HRAbsenceAuditTrail = lazy(() =>
  import("./pages/hr/AbsenceAuditTrailPage").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const AdminAbsenceAuditTrail = lazy(() =>
  import("./pages/hr/AbsenceAuditTrailPage").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);

// Secondary Sale & CRM Doctor Sale pages
const MRSecondarySale = lazy(() => import("./pages/mr/SecondarySale"));
const ASMSecondarySale = lazy(() => import("./pages/asm/SecondarySale"));

// JFW pages — ASM and RSM entry, MR acknowledgement
const ASMJfwEntry = lazy(() => import("./pages/asm/JfwEntry"));
const RSMJfwEntry = lazy(() => import("./pages/rsm/JfwEntry"));
const MRJfwAcknowledgement = lazy(
  () => import("./pages/mr/JfwAcknowledgement"),
);

// KPI Target Dashboard — MR self-view and manager team view
const MRKpiTargetDashboard = lazy(() =>
  import("./pages/shared/KpiTargetDashboard").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const ASMKpiTargetDashboard = lazy(() =>
  import("./pages/shared/KpiTargetDashboard").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMKpiTargetDashboard = lazy(() =>
  import("./pages/shared/KpiTargetDashboard").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);

// MR Call Details Report — per-portal wrappers
const MRCallDetailsReportMR = lazy(
  () => import("./pages/mr/MRCallDetailsReport"),
);
const MRCallDetailsReportASM = lazy(
  () => import("./pages/asm/MRCallDetailsReport"),
);
const MRCallDetailsReportRSM = lazy(() =>
  import("./pages/shared/MRCallDetailsReport").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const MRCallDetailsReportZSM = lazy(() =>
  import("./pages/shared/MRCallDetailsReport").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const MRCallDetailsReportHR = lazy(
  () => import("./pages/hr/MRCallDetailsReport"),
);
const MRCallDetailsReportAdmin = lazy(
  () => import("./pages/admin/MRCallDetailsReport"),
);

// DCR Submission Rate Report — HR and Admin
const HRDcrSubmissionRateReport = lazy(() =>
  import("./pages/shared/DcrSubmissionRateReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const AdminDcrSubmissionRateReport = lazy(() =>
  import("./pages/shared/DcrSubmissionRateReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);

// Secondary Sale Report & CRM Doctor Sale Report
const AdminSecondarySaleReport = lazy(() =>
  import("./pages/shared/SecondarySaleReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRSecondarySaleReport = lazy(() =>
  import("./pages/shared/SecondarySaleReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// Shared Attendance Check-In page (with single check-in + checkout enforcement)
const SharedAttendanceCheckIn = lazy(
  () => import("./pages/shared/AttendanceCheckIn"),
);

// Company Holiday Master — management pages for Admin and HR
const CompanyHolidayMasterAdmin = lazy(
  () => import("./pages/admin/CompanyHolidayMaster"),
);
const CompanyHolidayMasterHR = lazy(
  () => import("./pages/hr/CompanyHolidayMaster"),
);

// Company Holiday List — read-only view for all portals
const CompanyHolidayListMR = lazy(() =>
  import("./pages/shared/CompanyHolidayList").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const CompanyHolidayListASM = lazy(() =>
  import("./pages/shared/CompanyHolidayList").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const CompanyHolidayListRSM = lazy(() =>
  import("./pages/shared/CompanyHolidayList").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const CompanyHolidayListZSM = lazy(() =>
  import("./pages/shared/CompanyHolidayList").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

// My Attendance View — self-service for all non-admin roles
const MyAttendanceMR = lazy(() =>
  import("./pages/shared/MyAttendanceView").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const MyAttendanceASM = lazy(() =>
  import("./pages/shared/MyAttendanceView").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const MyAttendanceRSM = lazy(() =>
  import("./pages/shared/MyAttendanceView").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const MyAttendanceZSM = lazy(() =>
  import("./pages/shared/MyAttendanceView").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const MyAttendanceHR = lazy(() =>
  import("./pages/shared/MyAttendanceView").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// MR Portal Entries — Admin and HR
const AdminMRPortalEntries = lazy(() =>
  import("./pages/shared/MRPortalEntriesPage").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRMRPortalEntries = lazy(() =>
  import("./pages/shared/MRPortalEntriesPage").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// ASM Daily Call Report (with conditional Doctor Call tab for MR charge)
const ASMDailyCallReport = lazy(() => import("./pages/asm/DailyCallReport"));

// Shared role pages — locations, leave approval
const ASMLiveLocations = lazy(() =>
  import("./pages/shared/LiveLocationsPage").then((m) => ({
    default: () => (
      <m.default
        portalRole={Role.ASM}
        title="Live Locations"
        subtitle="Track your MRs' live GPS positions"
      />
    ),
  })),
);
const RSMLiveLocations = lazy(() =>
  import("./pages/shared/LiveLocationsPage").then((m) => ({
    default: () => (
      <m.default
        portalRole={Role.RSM}
        title="Live Locations"
        subtitle="Track regional field staff GPS positions"
      />
    ),
  })),
);
const ZSMLiveLocations = lazy(() =>
  import("./pages/shared/LiveLocationsPage").then((m) => ({
    default: () => (
      <m.default
        portalRole={Role.ZSM}
        title="Live Locations"
        subtitle="Track zonal field staff GPS positions"
      />
    ),
  })),
);

const ASMLeaveApproval = lazy(() =>
  import("./pages/shared/LeaveApprovalPage").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} title="Leave Approvals" />,
  })),
);
const RSMLeaveApproval = lazy(() =>
  import("./pages/shared/LeaveApprovalPage").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} title="Leave Approvals" />,
  })),
);
const ZSMLeaveApproval = lazy(() =>
  import("./pages/shared/LeaveApprovalPage").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} title="Leave Approvals" />,
  })),
);

const ASMReports = lazy(() => import("./pages/asm/ASMReports"));
const ASMExpenses = lazy(() => import("./pages/asm/ASMExpenses"));
const ASMPerformance = lazy(() => import("./pages/asm/ASMPerformance"));
const RSMReports = lazy(() => import("./pages/rsm/RSMReports"));
const RSMExpenses = lazy(() => import("./pages/rsm/RSMExpenses"));
const RSMPerformance = lazy(() => import("./pages/rsm/RSMPerformance"));
const RSMMissedDoctorVisits = lazy(
  () => import("./pages/rsm/RSMMissedDoctorVisits"),
);
const RSMAttendanceTracking = lazy(
  () => import("./pages/rsm/RSMAttendanceTracking"),
);
const RSMWorkingStyleReports = lazy(
  () => import("./pages/rsm/RSMWorkingStyleReports"),
);
const ASMWorkingStyleReports = lazy(
  () => import("./pages/asm/ASMWorkingStyleReports"),
);
const ZSMReports = lazy(() => import("./pages/zsm/ZSMReports"));
const ZSMExpenses = lazy(() => import("./pages/zsm/ZSMExpenses"));
const ZSMPerformance = lazy(() => import("./pages/zsm/ZSMPerformance"));

// My Expense Sheet — employee self-service (all roles except Admin)
const MRExpenseSheet = lazy(() =>
  import("./pages/shared/MyExpenseSheet").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const ASMExpenseSheet = lazy(() =>
  import("./pages/shared/MyExpenseSheet").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMExpenseSheet = lazy(() =>
  import("./pages/shared/MyExpenseSheet").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMExpenseSheet = lazy(() =>
  import("./pages/shared/MyExpenseSheet").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const HRExpenseSheet = lazy(() =>
  import("./pages/shared/MyExpenseSheet").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// My Incentive & Bonus Sheet — employee self-service (all roles except Admin)
const MRIncentiveBonusSheet = lazy(() =>
  import("./pages/shared/MyIncentiveBonusSheet").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const ASMIncentiveBonusSheet = lazy(() =>
  import("./pages/shared/MyIncentiveBonusSheet").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMIncentiveBonusSheet = lazy(() =>
  import("./pages/shared/MyIncentiveBonusSheet").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMIncentiveBonusSheet = lazy(() =>
  import("./pages/shared/MyIncentiveBonusSheet").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const HRIncentiveBonusSheet = lazy(() =>
  import("./pages/shared/MyIncentiveBonusSheet").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// My Advances — employee self-service (all roles except Admin)
const MRAdvances = lazy(() =>
  import("./pages/shared/MyAdvances").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const ASMAdvances = lazy(() =>
  import("./pages/shared/MyAdvances").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMAdvances = lazy(() =>
  import("./pages/shared/MyAdvances").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMAdvances = lazy(() =>
  import("./pages/shared/MyAdvances").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const HRAdvances = lazy(() =>
  import("./pages/shared/MyAdvances").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// Suggestions Management — HR and Admin
const HRSuggestionsManagement = lazy(() =>
  import("./pages/shared/SuggestionsManagement").then((m) => ({
    default: () => <m.default portalRole="HRManager" />,
  })),
);

// DCR submission (MR portal)
const MRDcrSubmission = lazy(() => import("./pages/mr/DcrSubmission"));

// DCR Approvals (ASM and RSM portals)
const ASMDcrApproval = lazy(() =>
  import("./pages/shared/DcrApproval").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMDcrApproval = lazy(() =>
  import("./pages/shared/DcrApproval").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);

// MTP Approvals (ASM, RSM portals)
const ASMMtpApproval = lazy(() =>
  import("./pages/shared/MtpApproval").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMMtpApproval = lazy(() =>
  import("./pages/shared/MtpApproval").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);

const AdminSuggestionsManagement = lazy(() =>
  import("./pages/shared/SuggestionsManagement").then((m) => ({
    default: () => <m.default portalRole="Admin" />,
  })),
);

// Call Reports page — all 7 portals
const MRCallReports = lazy(() =>
  import("./pages/shared/CallReportsPage").then((m) => ({
    default: () => <m.default userRole={Role.MR} />,
  })),
);
const ASMCallReports = lazy(() =>
  import("./pages/shared/CallReportsPage").then((m) => ({
    default: () => <m.default userRole={Role.ASM} />,
  })),
);
const RSMCallReports = lazy(() =>
  import("./pages/shared/CallReportsPage").then((m) => ({
    default: () => <m.default userRole={Role.RSM} />,
  })),
);
const ZSMCallReports = lazy(() =>
  import("./pages/shared/CallReportsPage").then((m) => ({
    default: () => <m.default userRole={Role.ZSM} />,
  })),
);

const HRCallReports = lazy(() =>
  import("./pages/shared/CallReportsPage").then((m) => ({
    default: () => <m.default userRole={Role.HRManager} />,
  })),
);
const AdminCallReports = lazy(() =>
  import("./pages/shared/CallReportsPage").then((m) => ({
    default: () => <m.default userRole={Role.Admin} />,
  })),
);

// HQ Employee Hierarchy — Admin, HR, ZSM, RSM, ASM, MR
const HqEmployeeHierarchy = lazy(
  () => import("./pages/shared/HqEmployeeHierarchyPage"),
);

// Location Trail — ASM, RSM, ZSM, HR, Admin
const ASMLocationTrail = lazy(() =>
  import("./pages/shared/LocationTrailPage").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMLocationTrail = lazy(() =>
  import("./pages/shared/LocationTrailPage").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMLocationTrail = lazy(() =>
  import("./pages/shared/LocationTrailPage").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const HRLocationTrail = lazy(() =>
  import("./pages/shared/LocationTrailPage").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const AdminLocationTrail = lazy(() =>
  import("./pages/shared/LocationTrailPage").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);

// Salary slips — employee self-service (not for HR/Admin)

const MRSalarySlips = lazy(() =>
  import("./pages/shared/MySalarySlips").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const ASMSalarySlips = lazy(() =>
  import("./pages/shared/MySalarySlips").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMSalarySlips = lazy(() =>
  import("./pages/shared/MySalarySlips").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMSalarySlips = lazy(() =>
  import("./pages/shared/MySalarySlips").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

// Export & Reports — role-scoped versions
const AdminExportReports = lazy(() =>
  import("./pages/shared/ExportReports").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const HRExportReports = lazy(() =>
  import("./pages/shared/ExportReports").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const MRExportReports = lazy(() =>
  import("./pages/shared/ExportReports").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const ASMExportReports = lazy(() =>
  import("./pages/shared/ExportReports").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMExportReports = lazy(() =>
  import("./pages/shared/ExportReports").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMExportReports = lazy(() =>
  import("./pages/shared/ExportReports").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

function getSession() {
  return useAuthStore.getState().session;
}

const rootRoute = createRootRoute();

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    const session = getSession();
    if (session) {
      throw redirect({ to: ROLE_PORTAL[session.role] });
    }
  },
  component: LoginPage,
});

function makePortalRoute(
  path: string,
  Component: React.ComponentType,
  allowedRole: string,
) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: () => {
      const session = getSession();
      if (!session) {
        throw redirect({ to: "/" });
      }
      if (session.role !== allowedRole) {
        throw redirect({ to: ROLE_PORTAL[session.role] });
      }
    },
    component: () => (
      <GpsGate>
        <ChunkErrorBoundary>
          <Suspense fallback={<PortalLoadingScreen />}>
            <Component />
          </Suspense>
        </ChunkErrorBoundary>
      </GpsGate>
    ),
  });
}

function PortalLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm font-body">
          Loading portal…
        </p>
      </div>
    </div>
  );
}

const adminRoute = makePortalRoute(
  "/admin",
  AdminPortal as React.ComponentType,
  "Admin",
);
const adminUsersRoute = makePortalRoute(
  "/admin/users",
  UserManagement as React.ComponentType,
  "Admin",
);
const adminLocationsRoute = makePortalRoute(
  "/admin/locations",
  AdminGPSMap as React.ComponentType,
  "Admin",
);
const adminReportsRoute = makePortalRoute(
  "/admin/reports",
  AdminReports as React.ComponentType,
  "Admin",
);
const adminProductsRoute = makePortalRoute(
  "/admin/products",
  ProductMaster as React.ComponentType,
  "Admin",
);
const adminProductMasterRoute = makePortalRoute(
  "/admin/product-master",
  AdminProductMasterPage as React.ComponentType,
  "Admin",
);
const adminSampleAllocationRoute = makePortalRoute(
  "/admin/sample-allocation",
  AdminSampleAllocationPage as React.ComponentType,
  "Admin",
);
const adminLocationMasterRoute = makePortalRoute(
  "/admin/location-master",
  LocationMaster as React.ComponentType,
  "Admin",
);
const adminDaConfigRoute = makePortalRoute(
  "/admin/da-config",
  DAConfiguration as React.ComponentType,
  "Admin",
);
const adminTaDaPolicyRoute = makePortalRoute(
  "/admin/tada-policy",
  AdminTaDaPolicyConfig as React.ComponentType,
  "Admin",
);
const adminLeaveQuotaRoute = makePortalRoute(
  "/admin/leave-quota",
  AdminLeaveQuota as React.ComponentType,
  "Admin",
);
const adminRoleHierarchyRoute = makePortalRoute(
  "/admin/role-hierarchy",
  AdminRoleHierarchy as React.ComponentType,
  "Admin",
);
const adminBookingRoute = makePortalRoute(
  "/admin/booking",
  HRBookingApproval as React.ComponentType,
  "Admin",
);
const adminExportRoute = makePortalRoute(
  "/admin/export",
  AdminExportReports as React.ComponentType,
  "Admin",
);
const adminMessagesRoute = makePortalRoute(
  "/admin/messages",
  AdminMessageMgmt as React.ComponentType,
  "Admin",
);
const adminCompanyProfileRoute = makePortalRoute(
  "/admin/company-profile",
  AdminCompanyProfile as React.ComponentType,
  "Admin",
);
const adminDocumentConfigRoute = makePortalRoute(
  "/admin/document-config",
  AdminDocumentConfig as React.ComponentType,
  "Admin",
);
const adminExpensePolicyRoute = makePortalRoute(
  "/admin/expense-policy",
  AdminExpensePolicyConfig as React.ComponentType,
  "Admin",
);

const adminExpenseClaimSummaryRoute = makePortalRoute(
  "/admin/expense-claim-summary",
  AdminExpenseClaimSummary as React.ComponentType,
  "Admin",
);
const adminSalesTargetRoute = makePortalRoute(
  "/admin/sales-target",
  AdminSalesTargetReport as React.ComponentType,
  "Admin",
);
const adminAuditTrailRoute = makePortalRoute(
  "/admin/audit-trail",
  AdminAuditTrail as React.ComponentType,
  "Admin",
);
const adminRecruitmentRoute = makePortalRoute(
  "/admin/recruitment",
  AdminRecruitmentPipeline as React.ComponentType,
  "Admin",
);
const adminAppraisalRoute = makePortalRoute(
  "/admin/appraisal",
  AdminAppraisalReport as React.ComponentType,
  "Admin",
);
const adminChemistMasterRoute = makePortalRoute(
  "/admin/chemist-master",
  AdminChemistMaster as React.ComponentType,
  "Admin",
);
const adminAttendanceReportsRoute = makePortalRoute(
  "/admin/attendance-reports",
  AdminAttendanceReports as React.ComponentType,
  "Admin",
);
const adminBulkExportRoute = makePortalRoute(
  "/admin/bulk-export",
  AdminBulkExport as React.ComponentType,
  "Admin",
);
const adminPayrollReportsRoute = makePortalRoute(
  "/admin/payroll-reports",
  AdminPayrollReports as React.ComponentType,
  "Admin",
);
const adminDCRReportRoute = makePortalRoute(
  "/admin/dcr-report",
  AdminDCRReport as React.ComponentType,
  "Admin",
);
const adminExpenseReportsRoute = makePortalRoute(
  "/admin/expense-reports",
  AdminExpenseReports as React.ComponentType,
  "Admin",
);
const asmExpenseClaimSummaryRoute = makePortalRoute(
  "/asm/expense-claim-summary",
  ASMExpenseClaimSummary as React.ComponentType,
  "ASM",
);
const rsmExpenseClaimSummaryRoute = makePortalRoute(
  "/rsm/expense-claim-summary",
  RSMExpenseClaimSummary as React.ComponentType,
  "RSM",
);
const hrExpenseClaimSummaryRoute = makePortalRoute(
  "/hr/expense-claim-summary",
  HRExpenseClaimSummary as React.ComponentType,
  "HRManager",
);
const hrRoute = makePortalRoute(
  "/hr",
  HRPortal as React.ComponentType,
  "HRManager",
);
const hrEmployeesRoute = makePortalRoute(
  "/hr/employees",
  HREmployees as React.ComponentType,
  "HRManager",
);
const hrLeavesRoute = makePortalRoute(
  "/hr/leaves",
  HRLeaves as React.ComponentType,
  "HRManager",
);
const hrAttendanceRoute = makePortalRoute(
  "/hr/attendance",
  HRAttendance as React.ComponentType,
  "HRManager",
);
const hrPayrollRoute = makePortalRoute(
  "/hr/payroll",
  HRPayroll as React.ComponentType,
  "HRManager",
);
const hrExpenseSheetsRoute = makePortalRoute(
  "/hr/expense-sheets",
  HRExpenseSheets as React.ComponentType,
  "HRManager",
);
const hrIncentiveBonusSheetsRoute = makePortalRoute(
  "/hr/incentive-bonus-sheets",
  HRIncentiveBonusSheets as React.ComponentType,
  "HRManager",
);
const hrEmployeeAdvancesRoute = makePortalRoute(
  "/hr/employee-advances",
  HREmployeeAdvances as React.ComponentType,
  "HRManager",
);
const hrExpensesRoute = makePortalRoute(
  "/hr/expenses",
  HRExpenses as React.ComponentType,
  "HRManager",
);
const hrTaDaSummaryRoute = makePortalRoute(
  "/hr/tada-summary",
  HRTaDaSummaryReport as React.ComponentType,
  "HRManager",
);
const hrDocumentsRoute = makePortalRoute(
  "/hr/documents",
  HRDocuments as React.ComponentType,
  "HRManager",
);
const hrPerformanceRoute = makePortalRoute(
  "/hr/performance",
  HRPerformance as React.ComponentType,
  "HRManager",
);
const hrGpsTrailRoute = makePortalRoute(
  "/hr/gps-trail",
  HRGpsTrail as React.ComponentType,
  "HRManager",
);
const hrCheckInRoute = makePortalRoute(
  "/hr/checkin",
  HRCheckIn as React.ComponentType,
  "HRManager",
);

const hrTravelPlansRoute = makePortalRoute(
  "/hr/travel-plans",
  HRTravelPlans as React.ComponentType,
  "HRManager",
);
const hrBookingRoute = makePortalRoute(
  "/hr/booking",
  HRBookingApproval as React.ComponentType,
  "HRManager",
);
const hrExportRoute = makePortalRoute(
  "/hr/export",
  HRExportReports as React.ComponentType,
  "HRManager",
);
const hrMessagesRoute = makePortalRoute(
  "/hr/messages",
  HRMessageMgmt as React.ComponentType,
  "HRManager",
);
const hrSampleAllocationRoute = makePortalRoute(
  "/hr/sample-allocation",
  HRSampleAllocationPage as React.ComponentType,
  "HRManager",
);
const adminOfficialLettersRoute = makePortalRoute(
  "/admin/official-letters",
  AdminOfficialLetters as React.ComponentType,
  "Admin",
);
const hrOfficialLettersRoute = makePortalRoute(
  "/hr/official-letters",
  HROfficialLetters as React.ComponentType,
  "HRManager",
);
const mrRoute = makePortalRoute("/mr", MRPortal as React.ComponentType, "MR");
const mrReportsRoute = makePortalRoute(
  "/mr/reports",
  DailyCallReport as React.ComponentType,
  "MR",
);
const mrTravelPlansRoute = makePortalRoute(
  "/mr/travel-plans",
  MRTravelPlan as React.ComponentType,
  "MR",
);
// Phase 2 SFA — DCR submission route (MR)
const mrDcrRoute = makePortalRoute(
  "/mr/dcr",
  MRDcrSubmission as React.ComponentType,
  "MR",
);
const mrDoctorsRoute = makePortalRoute(
  "/mr/doctors",
  DoctorManagement as React.ComponentType,
  "MR",
);
const mrChemistsRoute = makePortalRoute(
  "/mr/chemists",
  ChemistManagement as React.ComponentType,
  "MR",
);
const mrExpensesRoute = makePortalRoute(
  "/mr/expenses",
  MRExpenses as React.ComponentType,
  "MR",
);
const mrLeaveRoute = makePortalRoute(
  "/mr/leave",
  MRLeave as React.ComponentType,
  "MR",
);
const asmLeaveRoute = makePortalRoute(
  "/asm/leave",
  ASMLeave as React.ComponentType,
  "ASM",
);
const rsmLeaveRoute = makePortalRoute(
  "/rsm/leave",
  RSMLeave as React.ComponentType,
  "RSM",
);
const zsmLeaveRoute = makePortalRoute(
  "/zsm/leave",
  ZSMLeave as React.ComponentType,
  "ZSM",
);

const mrCheckInRoute = makePortalRoute(
  "/mr/checkin",
  SharedAttendanceCheckIn as React.ComponentType,
  "MR",
);
const mrWorkingStyleRoute = makePortalRoute(
  "/mr/working-style",
  MRWorkingStyle as React.ComponentType,
  "MR",
);
const mrSecondarySaleRoute = makePortalRoute(
  "/mr/secondary-sale",
  MRSecondarySale as React.ComponentType,
  "MR",
);
const mrChemistCallEntryRoute = makePortalRoute(
  "/mr/chemist-call",
  MRChemistCallEntry as React.ComponentType,
  "MR",
);
const mrStockistCallEntryRoute = makePortalRoute(
  "/mr/stockist-call",
  MRStockistCallEntry as React.ComponentType,
  "MR",
);

const mrJfwReportsRoute = makePortalRoute(
  "/mr/jfw-reports",
  MRJfwAcknowledgement as React.ComponentType,
  "MR",
);
const mrKpiRoute = makePortalRoute(
  "/mr/kpi",
  MRKpiTargetDashboard as React.ComponentType,
  "MR",
);
const mrSalarySlipsRoute = makePortalRoute(
  "/mr/salary-slips",
  MRSalarySlips as React.ComponentType,
  "MR",
);
const mrBookingRoute = makePortalRoute(
  "/mr/booking",
  MRBookingPage as React.ComponentType,
  "MR",
);
const mrExportRoute = makePortalRoute(
  "/mr/my-reports",
  MRExportReports as React.ComponentType,
  "MR",
);
const asmRoute = makePortalRoute(
  "/asm",
  ASMPortal as React.ComponentType,
  "ASM",
);
const asmCheckInRoute = makePortalRoute(
  "/asm/checkin",
  SharedAttendanceCheckIn as React.ComponentType,
  "ASM",
);
const asmSecondarySaleRoute = makePortalRoute(
  "/asm/secondary-sale",
  ASMSecondarySale as React.ComponentType,
  "ASM",
);

const asmDailyCallReportRoute = makePortalRoute(
  "/asm/daily-call-report",
  ASMDailyCallReport as React.ComponentType,
  "ASM",
);
const asmJfwRoute = makePortalRoute(
  "/asm/jfw",
  ASMJfwEntry as React.ComponentType,
  "ASM",
);
const asmKpiRoute = makePortalRoute(
  "/asm/kpi",
  ASMKpiTargetDashboard as React.ComponentType,
  "ASM",
);
// Phase 2 SFA — DCR & MTP approval routes (ASM)
const asmDcrApprovalRoute = makePortalRoute(
  "/asm/dcr-approvals",
  ASMDcrApproval as React.ComponentType,
  "ASM",
);
const asmMtpApprovalRoute = makePortalRoute(
  "/asm/mtp-approvals",
  ASMMtpApproval as React.ComponentType,
  "ASM",
);
const asmSalarySlipsRoute = makePortalRoute(
  "/asm/salary-slips",
  ASMSalarySlips as React.ComponentType,
  "ASM",
);
const asmExportRoute = makePortalRoute(
  "/asm/my-reports",
  ASMExportReports as React.ComponentType,
  "ASM",
);
const rsmRoute = makePortalRoute(
  "/rsm",
  RSMPortal as React.ComponentType,
  "RSM",
);
const rsmCheckInRoute = makePortalRoute(
  "/rsm/checkin",
  SharedAttendanceCheckIn as React.ComponentType,
  "RSM",
);
const rsmSalarySlipsRoute = makePortalRoute(
  "/rsm/salary-slips",
  RSMSalarySlips as React.ComponentType,
  "RSM",
);
const rsmExportRoute = makePortalRoute(
  "/rsm/my-reports",
  RSMExportReports as React.ComponentType,
  "RSM",
);
const rsmBookingRoute = makePortalRoute(
  "/rsm/booking",
  RSMBookingPage as React.ComponentType,
  "RSM",
);
const rsmTravelPlansRoute = makePortalRoute(
  "/rsm/travel-plans",
  RSMTravelPlans as React.ComponentType,
  "RSM",
);
const rsmJfwRoute = makePortalRoute(
  "/rsm/jfw",
  RSMJfwEntry as React.ComponentType,
  "RSM",
);
const rsmKpiRoute = makePortalRoute(
  "/rsm/kpi",
  RSMKpiTargetDashboard as React.ComponentType,
  "RSM",
);
// Phase 2 SFA — DCR & MTP approval routes (RSM)
const rsmDcrApprovalRoute = makePortalRoute(
  "/rsm/dcr-approvals",
  RSMDcrApproval as React.ComponentType,
  "RSM",
);
const rsmMtpApprovalRoute = makePortalRoute(
  "/rsm/mtp-approvals",
  RSMMtpApproval as React.ComponentType,
  "RSM",
);

// ── Phase 2 SFA Real Report Components ──────────────────────────────────────

const SampleBalanceReportPage = lazy(
  () => import("./pages/shared/SampleBalanceReport"),
);
const DoctorProductCoverageReportPage = lazy(
  () => import("./pages/shared/DoctorProductCoverageReport"),
);
const ChemistStockistCoverageReportPage = lazy(
  () => import("./pages/shared/ChemistStockistCoverageReport"),
);
const DcrSummaryReportPage = lazy(
  () => import("./pages/shared/DcrSummaryReport"),
);
const MtpVsActualReportPage = lazy(
  () => import("./pages/shared/MtpVsActualReport"),
);
const JfwSummaryReportPage = lazy(
  () => import("./pages/shared/JfwSummaryReport"),
);

// Role-scoped wrappers
const AdminSfaDoctorProductCoverage = lazy(() =>
  import("./pages/shared/DoctorProductCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const AdminSfaDcrSummary = lazy(() =>
  import("./pages/shared/DcrSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const AdminSfaMtpVsActual = lazy(() =>
  import("./pages/shared/MtpVsActualReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const AdminSfaChemistCoverage = lazy(() =>
  import("./pages/shared/ChemistStockistCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const AdminSfaSampleBalance = lazy(() =>
  import("./pages/shared/SampleBalanceReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);
const AdminSfaJfwSummary = lazy(() =>
  import("./pages/shared/JfwSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.Admin} />,
  })),
);

// HR SFA
const HRSfaDoctorProductCoverage = lazy(() =>
  import("./pages/shared/DoctorProductCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const HRSfaDcrSummary = lazy(() =>
  import("./pages/shared/DcrSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const HRSfaMtpVsActual = lazy(() =>
  import("./pages/shared/MtpVsActualReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const HRSfaChemistCoverage = lazy(() =>
  import("./pages/shared/ChemistStockistCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const HRSfaSampleBalance = lazy(() =>
  import("./pages/shared/SampleBalanceReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);
const HRSfaJfwSummary = lazy(() =>
  import("./pages/shared/JfwSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.HRManager} />,
  })),
);

// MR SFA
const MRSfaSampleBalance = lazy(() =>
  import("./pages/shared/SampleBalanceReport").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);

// ASM SFA
const ASMSfaDoctorProductCoverage = lazy(() =>
  import("./pages/shared/DoctorProductCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const ASMSfaDcrSummary = lazy(() =>
  import("./pages/shared/DcrSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const ASMSfaMtpVsActual = lazy(() =>
  import("./pages/shared/MtpVsActualReport").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const ASMSfaChemistCoverage = lazy(() =>
  import("./pages/shared/ChemistStockistCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const ASMSfaSampleBalance = lazy(() =>
  import("./pages/shared/SampleBalanceReport").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const ASMSfaJfwSummary = lazy(() =>
  import("./pages/shared/JfwSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);

// RSM SFA
const RSMSfaDoctorProductCoverage = lazy(() =>
  import("./pages/shared/DoctorProductCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const RSMSfaDcrSummary = lazy(() =>
  import("./pages/shared/DcrSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const RSMSfaMtpVsActual = lazy(() =>
  import("./pages/shared/MtpVsActualReport").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const RSMSfaChemistCoverage = lazy(() =>
  import("./pages/shared/ChemistStockistCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const RSMSfaSampleBalance = lazy(() =>
  import("./pages/shared/SampleBalanceReport").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const RSMSfaJfwSummary = lazy(() =>
  import("./pages/shared/JfwSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);

// ZSM SFA
const ZSMSfaDoctorProductCoverage = lazy(() =>
  import("./pages/shared/DoctorProductCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);
const ZSMSfaDcrSummary = lazy(() =>
  import("./pages/shared/DcrSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);
const ZSMSfaMtpVsActual = lazy(() =>
  import("./pages/shared/MtpVsActualReport").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);
const ZSMSfaChemistCoverage = lazy(() =>
  import("./pages/shared/ChemistStockistCoverageReport").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);
const ZSMSfaJfwSummary = lazy(() =>
  import("./pages/shared/JfwSummaryReport").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);
const ZSMSfaSampleBalance = lazy(() =>
  import("./pages/shared/SampleBalanceReport").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

// Suppress unused import warning — these are used as route components
void SampleBalanceReportPage;
void DoctorProductCoverageReportPage;
void ChemistStockistCoverageReportPage;
void DcrSummaryReportPage;
void MtpVsActualReportPage;
void JfwSummaryReportPage;

// Route definitions for all Phase 2 SFA placeholders
// Admin
const adminSfaDoctorProductCoverageRoute = makePortalRoute(
  "/admin/sfa/doctor-product-coverage",
  AdminSfaDoctorProductCoverage as React.ComponentType,
  "Admin",
);
const adminSfaDcrSummaryRoute = makePortalRoute(
  "/admin/sfa/dcr-summary",
  AdminSfaDcrSummary as React.ComponentType,
  "Admin",
);
const adminSfaMtpVsActualRoute = makePortalRoute(
  "/admin/sfa/mtp-vs-actual",
  AdminSfaMtpVsActual as React.ComponentType,
  "Admin",
);
const adminSfaChemistCoverageRoute = makePortalRoute(
  "/admin/sfa/chemist-coverage",
  AdminSfaChemistCoverage as React.ComponentType,
  "Admin",
);
const adminSfaSampleBalanceRoute = makePortalRoute(
  "/admin/sfa/sample-balance",
  AdminSfaSampleBalance as React.ComponentType,
  "Admin",
);
const adminSfaJfwSummaryRoute = makePortalRoute(
  "/admin/sfa/jfw-summary",
  AdminSfaJfwSummary as React.ComponentType,
  "Admin",
);
// HR
const hrSfaDoctorProductCoverageRoute = makePortalRoute(
  "/hr/sfa/doctor-product-coverage",
  HRSfaDoctorProductCoverage as React.ComponentType,
  "HRManager",
);
const hrSfaDcrSummaryRoute = makePortalRoute(
  "/hr/sfa/dcr-summary",
  HRSfaDcrSummary as React.ComponentType,
  "HRManager",
);
const hrSfaMtpVsActualRoute = makePortalRoute(
  "/hr/sfa/mtp-vs-actual",
  HRSfaMtpVsActual as React.ComponentType,
  "HRManager",
);
const hrSfaChemistCoverageRoute = makePortalRoute(
  "/hr/sfa/chemist-coverage",
  HRSfaChemistCoverage as React.ComponentType,
  "HRManager",
);
const hrSfaSampleBalanceRoute = makePortalRoute(
  "/hr/sfa/sample-balance",
  HRSfaSampleBalance as React.ComponentType,
  "HRManager",
);
const hrSfaJfwSummaryRoute = makePortalRoute(
  "/hr/sfa/jfw-summary",
  HRSfaJfwSummary as React.ComponentType,
  "HRManager",
);
// MR
const mrSfaSampleBalanceRoute = makePortalRoute(
  "/mr/sfa/sample-balance",
  MRSfaSampleBalance as React.ComponentType,
  "MR",
);
// ASM
const asmSfaDoctorProductCoverageRoute = makePortalRoute(
  "/asm/sfa/doctor-product-coverage",
  ASMSfaDoctorProductCoverage as React.ComponentType,
  "ASM",
);
const asmSfaDcrSummaryRoute = makePortalRoute(
  "/asm/sfa/dcr-summary",
  ASMSfaDcrSummary as React.ComponentType,
  "ASM",
);
const asmSfaMtpVsActualRoute = makePortalRoute(
  "/asm/sfa/mtp-vs-actual",
  ASMSfaMtpVsActual as React.ComponentType,
  "ASM",
);
const asmSfaChemistCoverageRoute = makePortalRoute(
  "/asm/sfa/chemist-coverage",
  ASMSfaChemistCoverage as React.ComponentType,
  "ASM",
);
const asmSfaSampleBalanceRoute = makePortalRoute(
  "/asm/sfa/sample-balance",
  ASMSfaSampleBalance as React.ComponentType,
  "ASM",
);
const asmSfaJfwSummaryRoute = makePortalRoute(
  "/asm/sfa/jfw-summary",
  ASMSfaJfwSummary as React.ComponentType,
  "ASM",
);
// RSM
const rsmSfaDoctorProductCoverageRoute = makePortalRoute(
  "/rsm/sfa/doctor-product-coverage",
  RSMSfaDoctorProductCoverage as React.ComponentType,
  "RSM",
);
const rsmSfaDcrSummaryRoute = makePortalRoute(
  "/rsm/sfa/dcr-summary",
  RSMSfaDcrSummary as React.ComponentType,
  "RSM",
);
const rsmSfaMtpVsActualRoute = makePortalRoute(
  "/rsm/sfa/mtp-vs-actual",
  RSMSfaMtpVsActual as React.ComponentType,
  "RSM",
);
const rsmSfaChemistCoverageRoute = makePortalRoute(
  "/rsm/sfa/chemist-coverage",
  RSMSfaChemistCoverage as React.ComponentType,
  "RSM",
);
const rsmSfaSampleBalanceRoute = makePortalRoute(
  "/rsm/sfa/sample-balance",
  RSMSfaSampleBalance as React.ComponentType,
  "RSM",
);
const rsmSfaJfwSummaryRoute = makePortalRoute(
  "/rsm/sfa/jfw-summary",
  RSMSfaJfwSummary as React.ComponentType,
  "RSM",
);
// ZSM
const zsmSfaDoctorProductCoverageRoute = makePortalRoute(
  "/zsm/sfa/doctor-product-coverage",
  ZSMSfaDoctorProductCoverage as React.ComponentType,
  "ZSM",
);
const zsmSfaDcrSummaryRoute = makePortalRoute(
  "/zsm/sfa/dcr-summary",
  ZSMSfaDcrSummary as React.ComponentType,
  "ZSM",
);
const zsmSfaMtpVsActualRoute = makePortalRoute(
  "/zsm/sfa/mtp-vs-actual",
  ZSMSfaMtpVsActual as React.ComponentType,
  "ZSM",
);
const zsmSfaChemistCoverageRoute = makePortalRoute(
  "/zsm/sfa/chemist-coverage",
  ZSMSfaChemistCoverage as React.ComponentType,
  "ZSM",
);
const zsmSfaJfwSummaryRoute = makePortalRoute(
  "/zsm/sfa/jfw-summary",
  ZSMSfaJfwSummary as React.ComponentType,
  "ZSM",
);
const zsmSfaSampleBalanceRoute = makePortalRoute(
  "/zsm/sfa/sample-balance",
  ZSMSfaSampleBalance as React.ComponentType,
  "ZSM",
);
const zsmRoute = makePortalRoute(
  "/zsm",
  ZSMPortal as React.ComponentType,
  "ZSM",
);
const zsmCheckInRoute = makePortalRoute(
  "/zsm/checkin",
  SharedAttendanceCheckIn as React.ComponentType,
  "ZSM",
);
const zsmSalarySlipsRoute = makePortalRoute(
  "/zsm/salary-slips",
  ZSMSalarySlips as React.ComponentType,
  "ZSM",
);
const zsmExportRoute = makePortalRoute(
  "/zsm/my-reports",
  ZSMExportReports as React.ComponentType,
  "ZSM",
);
const zsmBookingRoute = makePortalRoute(
  "/zsm/booking",
  ZSMBookingPage as React.ComponentType,
  "ZSM",
);

// ASM sub-pages
const asmLocationsRoute = makePortalRoute(
  "/asm/locations",
  ASMLiveLocations as React.ComponentType,
  "ASM",
);
const asmReportsRoute = makePortalRoute(
  "/asm/reports",
  ASMReports as React.ComponentType,
  "ASM",
);
const asmExpensesRoute = makePortalRoute(
  "/asm/expenses",
  ASMExpenses as React.ComponentType,
  "ASM",
);
const asmPerformanceRoute = makePortalRoute(
  "/asm/performance",
  ASMPerformance as React.ComponentType,
  "ASM",
);
const asmLeaveApprovalRoute = makePortalRoute(
  "/asm/leave-approval",
  ASMLeaveApproval as React.ComponentType,
  "ASM",
);

// RSM sub-pages
const rsmLocationsRoute = makePortalRoute(
  "/rsm/locations",
  RSMLiveLocations as React.ComponentType,
  "RSM",
);
const rsmReportsRoute = makePortalRoute(
  "/rsm/reports",
  RSMReports as React.ComponentType,
  "RSM",
);
const rsmExpensesRoute = makePortalRoute(
  "/rsm/expenses",
  RSMExpenses as React.ComponentType,
  "RSM",
);
const rsmPerformanceRoute = makePortalRoute(
  "/rsm/performance",
  RSMPerformance as React.ComponentType,
  "RSM",
);
const rsmLeaveApprovalRoute = makePortalRoute(
  "/rsm/leave-approval",
  RSMLeaveApproval as React.ComponentType,
  "RSM",
);

// ZSM sub-pages
const zsmLocationsRoute = makePortalRoute(
  "/zsm/locations",
  ZSMLiveLocations as React.ComponentType,
  "ZSM",
);
const zsmReportsRoute = makePortalRoute(
  "/zsm/reports",
  ZSMReports as React.ComponentType,
  "ZSM",
);
const zsmExpensesRoute = makePortalRoute(
  "/zsm/expenses",
  ZSMExpenses as React.ComponentType,
  "ZSM",
);
const zsmPerformanceRoute = makePortalRoute(
  "/zsm/performance",
  ZSMPerformance as React.ComponentType,
  "ZSM",
);
const zsmLeaveApprovalRoute = makePortalRoute(
  "/zsm/leave-approval",
  ZSMLeaveApproval as React.ComponentType,
  "ZSM",
);

// Bottom-Up Target routes (legacy — backward compat redirects to new monthly-targets)
const adminBottomUpTargetsRoute = makePortalRoute(
  "/admin/bottom-up-targets",
  BottomUpTargetsAdmin as React.ComponentType,
  "Admin",
);
const hrBottomUpTargetsRoute = makePortalRoute(
  "/hr/bottom-up-targets",
  BottomUpTargetsHR as React.ComponentType,
  "HRManager",
);

// Monthly Targets routes (new — replaces bottom-up)
const adminMonthlyTargetsRoute = makePortalRoute(
  "/admin/monthly-targets",
  MonthlyTargetsAdmin as React.ComponentType,
  "Admin",
);
const hrMonthlyTargetsRoute = makePortalRoute(
  "/hr/monthly-targets",
  MonthlyTargetsHR as React.ComponentType,
  "HRManager",
);
const mrMonthlyTargetsRoute = makePortalRoute(
  "/mr/monthly-targets",
  MyMonthlyTargets as React.ComponentType,
  "MR",
);
const asmMonthlyTargetsRoute = makePortalRoute(
  "/asm/monthly-targets",
  ASMMonthlyTargets as React.ComponentType,
  "ASM",
);
const rsmMonthlyTargetsRoute = makePortalRoute(
  "/rsm/monthly-targets",
  RSMMonthlyTargets as React.ComponentType,
  "RSM",
);
const zsmMonthlyTargetsRoute = makePortalRoute(
  "/zsm/monthly-targets",
  ZSMMonthlyTargets as React.ComponentType,
  "ZSM",
);

// Additional Charges routes
const adminAdditionalChargesRoute = makePortalRoute(
  "/admin/additional-charges",
  AdditionalChargesAdmin as React.ComponentType,
  "Admin",
);
const hrAdditionalChargesRoute = makePortalRoute(
  "/hr/additional-charges",
  AdditionalChargesHR as React.ComponentType,
  "HRManager",
);

// Additional Role Tab — authenticated, any role (no role restriction — portal guards own sidebar)
const additionalRoleTabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$role/additional-role-tab/$chargeRole",
  beforeLoad: () => {
    const session = getSession();
    if (!session) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <GpsGate>
      <ChunkErrorBoundary>
        <Suspense fallback={<PortalLoadingScreen />}>
          <AdditionalRoleTab />
        </Suspense>
      </ChunkErrorBoundary>
    </GpsGate>
  ),
});

// Target vs. Actual Performance routes
const asmTargetPerformanceRoute = makePortalRoute(
  "/asm/target-performance",
  TargetVsActualASM as React.ComponentType,
  "ASM",
);
const rsmTargetPerformanceRoute = makePortalRoute(
  "/rsm/target-performance",
  TargetVsActualRSM as React.ComponentType,
  "RSM",
);
const zsmTargetPerformanceRoute = makePortalRoute(
  "/zsm/target-performance",
  TargetVsActualZSM as React.ComponentType,
  "ZSM",
);

const adminTargetPerformanceRoute = makePortalRoute(
  "/admin/target-performance",
  TargetVsActualAdmin as React.ComponentType,
  "Admin",
);
const hrTargetPerformanceRoute = makePortalRoute(
  "/hr/target-performance",
  TargetVsActualHR as React.ComponentType,
  "HRManager",
);

// Stockist Master routes
const adminStationMasterRoute = makePortalRoute(
  "/admin/station-master",
  AdminStationMaster as React.ComponentType,
  "Admin",
);

// System Health route — Admin only
const adminSystemHealthRoute = makePortalRoute(
  "/admin/system-health",
  AdminSystemHealth as React.ComponentType,
  "Admin",
);

// DCR Edit Request Review routes
const adminDcrEditRequestsRoute = makePortalRoute(
  "/admin/dcr-edit-requests",
  AdminDcrEditRequests as React.ComponentType,
  "Admin",
);
const asmDcrEditRequestsRoute = makePortalRoute(
  "/asm/dcr-edit-requests",
  ASMDcrEditRequests as React.ComponentType,
  "ASM",
);

// Attendance Correction Review routes
const adminAttendanceCorrectionsRoute = makePortalRoute(
  "/admin/attendance-corrections",
  AdminAttendanceCorrections as React.ComponentType,
  "Admin",
);
const hrAttendanceCorrectionsRoute = makePortalRoute(
  "/hr/attendance-corrections",
  HRAttendanceCorrections as React.ComponentType,
  "HRManager",
);

// GPS Settings route — Admin only
const adminGpsSettingsRoute = makePortalRoute(
  "/admin/gps-settings",
  AdminGpsSettings as React.ComponentType,
  "Admin",
);

// Notification Settings route — Admin only
const AdminNotificationSettings = lazy(
  () => import("./pages/admin/AdminNotificationSettings"),
);
const adminNotificationSettingsRoute = makePortalRoute(
  "/admin/notification-settings",
  AdminNotificationSettings as React.ComponentType,
  "Admin",
);

// Suggestions Management routes
const hrSuggestionsRoute = makePortalRoute(
  "/hr/suggestions",
  HRSuggestionsManagement as React.ComponentType,
  "HRManager",
);
const adminSuggestionsRoute = makePortalRoute(
  "/admin/suggestions",
  AdminSuggestionsManagement as React.ComponentType,
  "Admin",
);

// HQ Employee Hierarchy routes
const adminHqHierarchyRoute = makePortalRoute(
  "/admin/hq-hierarchy",
  HqEmployeeHierarchy as React.ComponentType,
  "Admin",
);
const hrHqHierarchyRoute = makePortalRoute(
  "/hr/hq-hierarchy",
  HqEmployeeHierarchy as React.ComponentType,
  "HRManager",
);

const zsmHqHierarchyRoute = makePortalRoute(
  "/zsm/hq-hierarchy",
  HqEmployeeHierarchy as React.ComponentType,
  "ZSM",
);
const rsmHqHierarchyRoute = makePortalRoute(
  "/rsm/hq-hierarchy",
  HqEmployeeHierarchy as React.ComponentType,
  "RSM",
);
const asmHqHierarchyRoute = makePortalRoute(
  "/asm/hq-hierarchy",
  HqEmployeeHierarchy as React.ComponentType,
  "ASM",
);

// Location Trail routes — ASM, RSM, ZSM, HR, Admin
const asmLocationTrailRoute = makePortalRoute(
  "/asm/location-trail",
  ASMLocationTrail as React.ComponentType,
  "ASM",
);
const rsmLocationTrailRoute = makePortalRoute(
  "/rsm/location-trail",
  RSMLocationTrail as React.ComponentType,
  "RSM",
);
const zsmLocationTrailRoute = makePortalRoute(
  "/zsm/location-trail",
  ZSMLocationTrail as React.ComponentType,
  "ZSM",
);

const hrLocationTrailRoute = makePortalRoute(
  "/hr/location-trail",
  HRLocationTrail as React.ComponentType,
  "HRManager",
);
const adminLocationTrailRoute = makePortalRoute(
  "/admin/location-trail",
  AdminLocationTrail as React.ComponentType,
  "Admin",
);

// Gift Article Master routes
const adminGiftArticleMasterRoute = makePortalRoute(
  "/admin/gift-article-master",
  AdminGiftArticleMaster as React.ComponentType,
  "Admin",
);
const hrGiftArticleMasterRoute = makePortalRoute(
  "/hr/gift-article-master",
  HRGiftArticleMaster as React.ComponentType,
  "HRManager",
);

// Call Reports routes — all 7 portals
const mrCallReportsRoute = makePortalRoute(
  "/mr/call-reports",
  MRCallReports as React.ComponentType,
  "MR",
);
const asmCallReportsRoute = makePortalRoute(
  "/asm/call-reports",
  ASMCallReports as React.ComponentType,
  "ASM",
);
const rsmCallReportsRoute = makePortalRoute(
  "/rsm/call-reports",
  RSMCallReports as React.ComponentType,
  "RSM",
);
const zsmCallReportsRoute = makePortalRoute(
  "/zsm/call-reports",
  ZSMCallReports as React.ComponentType,
  "ZSM",
);

const hrCallReportsRoute = makePortalRoute(
  "/hr/call-reports",
  HRCallReports as React.ComponentType,
  "HRManager",
);
const adminCallReportsRoute = makePortalRoute(
  "/admin/call-reports",
  AdminCallReports as React.ComponentType,
  "Admin",
);
const adminStockistMasterRoute = makePortalRoute(
  "/admin/stockist-master",
  AdminStockistMaster as React.ComponentType,
  "Admin",
);
const hrStockistMasterRoute = makePortalRoute(
  "/hr/stockist-master",
  HRStockistMaster as React.ComponentType,
  "HRManager",
);

// Doctor Master routes (Admin and HR only — with bulk upload and Excel template)
const adminDoctorMasterRoute = makePortalRoute(
  "/admin/doctor-master",
  AdminDoctorMaster as React.ComponentType,
  "Admin",
);
const hrDoctorMasterRoute = makePortalRoute(
  "/hr/doctor-master",
  HRDoctorMaster as React.ComponentType,
  "HRManager",
);

// Admin Leave Management route
const adminLeaveManagementRoute = makePortalRoute(
  "/admin/leave-management",
  AdminLeaveManagement as React.ComponentType,
  "Admin",
);

// New feature routes: Target Adjustment History, Incentive Plans, Incentive Management, Employee ID Config
const adminTargetHistoryRoute = makePortalRoute(
  "/admin/targets/history",
  AdminTargetHistory as React.ComponentType,
  "Admin",
);
const hrTargetHistoryRoute = makePortalRoute(
  "/hr/targets/history",
  HRTargetHistory as React.ComponentType,
  "HRManager",
);
const adminIncentivePlansRoute = makePortalRoute(
  "/admin/incentive-plans",
  AdminIncentivePlans as React.ComponentType,
  "Admin",
);
const hrIncentivePlansRoute = makePortalRoute(
  "/hr/incentive-plans",
  HRIncentivePlans as React.ComponentType,
  "HRManager",
);
const adminIncentiveManagementRoute = makePortalRoute(
  "/admin/incentives",
  AdminIncentiveManagement as React.ComponentType,
  "Admin",
);
const hrIncentiveManagementRoute = makePortalRoute(
  "/hr/incentives",
  HRIncentiveManagement as React.ComponentType,
  "HRManager",
);
const adminEmployeeIdConfigRoute = makePortalRoute(
  "/admin/employee-id-config",
  AdminEmployeeIdConfig as React.ComponentType,
  "Admin",
);
const adminCleanTrialDataRoute = makePortalRoute(
  "/admin/clean-trial-data",
  AdminCleanTrialData as React.ComponentType,
  "Admin",
);

// Secondary Sale & CRM Doctor Sale report routes
const adminSecondarySaleReportRoute = makePortalRoute(
  "/admin/secondary-sale-report",
  AdminSecondarySaleReport as React.ComponentType,
  "Admin",
);
const hrSecondarySaleReportRoute = makePortalRoute(
  "/hr/secondary-sale-report",
  HRSecondarySaleReport as React.ComponentType,
  "HRManager",
);

const adminDataCleanupHistoryRoute = makePortalRoute(
  "/admin/data-cleanup-history",
  AdminDataCleanupHistory as React.ComponentType,
  "Admin",
);
const hrDataCleanupHistoryRoute = makePortalRoute(
  "/hr/data-cleanup-history",
  HRDataCleanupHistory as React.ComponentType,
  "HRManager",
);

// Pricelist routes
const adminPricelistRoute = makePortalRoute(
  "/admin/pricelist",
  AdminPricelist as React.ComponentType,
  "Admin",
);
const hrPricelistRoute = makePortalRoute(
  "/hr/pricelist",
  HRPricelist as React.ComponentType,
  "HRManager",
);
const mrPricelistRoute = makePortalRoute(
  "/mr/pricelist",
  MRPricelist as React.ComponentType,
  "MR",
);
const asmPricelistRoute = makePortalRoute(
  "/asm/pricelist",
  ASMPricelist as React.ComponentType,
  "ASM",
);
const rsmPricelistRoute = makePortalRoute(
  "/rsm/pricelist",
  RSMPricelist as React.ComponentType,
  "RSM",
);
const zsmPricelistRoute = makePortalRoute(
  "/zsm/pricelist",
  ZSMPricelist as React.ComponentType,
  "ZSM",
);

// Absence Audit Trail routes
const hrAbsenceAuditRoute = makePortalRoute(
  "/hr/absence-audit",
  HRAbsenceAuditTrail as React.ComponentType,
  "HRManager",
);
const adminAbsenceAuditRoute = makePortalRoute(
  "/admin/absence-audit",
  AdminAbsenceAuditTrail as React.ComponentType,
  "Admin",
);

// Birthday Calendar — shared across HR, Admin, RSM, ZSM
const HRBirthdayCalendar = lazy(() =>
  import("./pages/shared/BirthdayCalendarPage").then((m) => ({
    default: m.default,
  })),
);
const hrBirthdayCalendarRoute = makePortalRoute(
  "/hr/birthday-calendar",
  HRBirthdayCalendar as React.ComponentType,
  "HRManager",
);

const AdminBirthdayCalendar = lazy(() =>
  import("./pages/shared/BirthdayCalendarPage").then((m) => ({
    default: m.default,
  })),
);
const adminBirthdayCalendarRoute = makePortalRoute(
  "/admin/birthday-calendar",
  AdminBirthdayCalendar as React.ComponentType,
  "Admin",
);

// /targets — shared page; allow any authenticated role
const myTargetDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/targets",
  beforeLoad: () => {
    const session = getSession();
    if (!session) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <GpsGate>
      <ChunkErrorBoundary>
        <Suspense fallback={<PortalLoadingScreen />}>
          <MyTargetDashboard />
        </Suspense>
      </ChunkErrorBoundary>
    </GpsGate>
  ),
});

// Role-specific /role/targets routes
const MRMyTargets = lazy(() =>
  import("./pages/shared/MyTargetDashboard").then((m) => ({
    default: () => <m.default portalRole={Role.MR} />,
  })),
);
const ASMMyTargets = lazy(() =>
  import("./pages/shared/MyTargetDashboard").then((m) => ({
    default: () => <m.default portalRole={Role.ASM} />,
  })),
);
const RSMMyTargets = lazy(() =>
  import("./pages/shared/MyTargetDashboard").then((m) => ({
    default: () => <m.default portalRole={Role.RSM} />,
  })),
);
const ZSMMyTargets = lazy(() =>
  import("./pages/shared/MyTargetDashboard").then((m) => ({
    default: () => <m.default portalRole={Role.ZSM} />,
  })),
);

const mrMyTargetsRoute = makePortalRoute(
  "/mr/targets",
  MRMyTargets as React.ComponentType,
  "MR",
);
const asmMyTargetsRoute = makePortalRoute(
  "/asm/targets",
  ASMMyTargets as React.ComponentType,
  "ASM",
);
const rsmMyTargetsRoute = makePortalRoute(
  "/rsm/targets",
  RSMMyTargets as React.ComponentType,
  "RSM",
);
const zsmMyTargetsRoute = makePortalRoute(
  "/zsm/targets",
  ZSMMyTargets as React.ComponentType,
  "ZSM",
);

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: () => {
    const session = getSession();
    if (session) {
      window.location.href = ROLE_PORTAL[session.role];
    } else {
      window.location.href = "/";
    }
    return null;
  },
});

// MR Portal Entries routes
const adminMRPortalEntriesRoute = makePortalRoute(
  "/admin/mr-portal-entries",
  AdminMRPortalEntries as React.ComponentType,
  "Admin",
);
const hrMRPortalEntriesRoute = makePortalRoute(
  "/hr/mr-portal-entries",
  HRMRPortalEntries as React.ComponentType,
  "HRManager",
);

// MR Call Details Report routes
const mrCallDetailsRoute = makePortalRoute(
  "/mr/call-details",
  MRCallDetailsReportMR as React.ComponentType,
  "MR",
);
const asmMRCallDetailsRoute = makePortalRoute(
  "/asm/mr-call-details",
  MRCallDetailsReportASM as React.ComponentType,
  "ASM",
);
const rsmMRCallDetailsRoute = makePortalRoute(
  "/rsm/mr-call-details",
  MRCallDetailsReportRSM as React.ComponentType,
  "RSM",
);
const zsmMRCallDetailsRoute = makePortalRoute(
  "/zsm/mr-call-details",
  MRCallDetailsReportZSM as React.ComponentType,
  "ZSM",
);

const hrMRCallDetailsRoute = makePortalRoute(
  "/hr/mr-call-details",
  MRCallDetailsReportHR as React.ComponentType,
  "HRManager",
);
const adminMRCallDetailsRoute = makePortalRoute(
  "/admin/mr-call-details",
  MRCallDetailsReportAdmin as React.ComponentType,
  "Admin",
);

// Doctor Call Report 30 Days routes removed (V80 rollback)
// DCR Submission Rate Report routes
const hrDcrSubmissionRateRoute = makePortalRoute(
  "/hr/dcr-submission-rate",
  HRDcrSubmissionRateReport as React.ComponentType,
  "HRManager",
);
const adminDcrSubmissionRateRoute = makePortalRoute(
  "/admin/dcr-submission-rate",
  AdminDcrSubmissionRateReport as React.ComponentType,
  "Admin",
);

// Missed Doctor Visits routes removed (V80 rollback)
const rsmMissedDoctorVisitsRoute = makePortalRoute(
  "/rsm/missed-doctor-visits",
  RSMMissedDoctorVisits as React.ComponentType,
  "RSM",
);
const rsmAttendanceTrackingRoute = makePortalRoute(
  "/rsm/attendance-tracking",
  RSMAttendanceTracking as React.ComponentType,
  "RSM",
);
const rsmWorkingStyleReportsRoute = makePortalRoute(
  "/rsm/working-style-reports",
  RSMWorkingStyleReports as React.ComponentType,
  "RSM",
);
const asmWorkingStyleReportsRoute = makePortalRoute(
  "/asm/working-style-reports",
  ASMWorkingStyleReports as React.ComponentType,
  "ASM",
);

// Company Holiday List routes (read-only) — each role sees the list via their portal
const mrCompanyHolidaysRoute = makePortalRoute(
  "/mr/company-holidays",
  CompanyHolidayListMR as React.ComponentType,
  "MR",
);
const asmCompanyHolidaysRoute = makePortalRoute(
  "/asm/company-holidays",
  CompanyHolidayListASM as React.ComponentType,
  "ASM",
);
const rsmCompanyHolidaysRoute = makePortalRoute(
  "/rsm/company-holidays",
  CompanyHolidayListRSM as React.ComponentType,
  "RSM",
);
const zsmCompanyHolidaysRoute = makePortalRoute(
  "/zsm/company-holidays",
  CompanyHolidayListZSM as React.ComponentType,
  "ZSM",
);

const hrCompanyHolidaysRoute = makePortalRoute(
  "/hr/company-holidays",
  CompanyHolidayMasterHR as React.ComponentType,
  "HRManager",
);
const adminCompanyHolidaysRoute = makePortalRoute(
  "/admin/company-holidays",
  CompanyHolidayMasterAdmin as React.ComponentType,
  "Admin",
);

// Shared /company-holidays route — redirects to role-specific page
const companyHolidaysSharedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/company-holidays",
  beforeLoad: () => {
    const session = getSession();
    if (!session) throw redirect({ to: "/" });
    // redirect to role-specific path
    const rolePathMap: Record<string, string> = {
      MR: "/mr/company-holidays",
      ASM: "/asm/company-holidays",
      RSM: "/rsm/company-holidays",
      ZSM: "/zsm/company-holidays",
      HRManager: "/hr/company-holidays",
      Admin: "/admin/company-holidays",
    };
    throw redirect({ to: rolePathMap[session.role] ?? "/" });
  },
  component: () => null,
});

// My Attendance routes — all roles except Admin
const mrMyAttendanceRoute = makePortalRoute(
  "/mr/my-attendance",
  MyAttendanceMR as React.ComponentType,
  "MR",
);
const asmMyAttendanceRoute = makePortalRoute(
  "/asm/my-attendance",
  MyAttendanceASM as React.ComponentType,
  "ASM",
);
const rsmMyAttendanceRoute = makePortalRoute(
  "/rsm/my-attendance",
  MyAttendanceRSM as React.ComponentType,
  "RSM",
);
const zsmMyAttendanceRoute = makePortalRoute(
  "/zsm/my-attendance",
  MyAttendanceZSM as React.ComponentType,
  "ZSM",
);

const hrMyAttendanceRoute = makePortalRoute(
  "/hr/my-attendance",
  MyAttendanceHR as React.ComponentType,
  "HRManager",
);

// Shared /my-attendance route — redirects to role-specific page
const myAttendanceSharedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/my-attendance",
  beforeLoad: () => {
    const session = getSession();
    if (!session) throw redirect({ to: "/" });
    const rolePathMap: Record<string, string> = {
      MR: "/mr/my-attendance",
      ASM: "/asm/my-attendance",
      RSM: "/rsm/my-attendance",
      ZSM: "/zsm/my-attendance",
      HRManager: "/hr/my-attendance",
    };
    throw redirect({ to: rolePathMap[session.role] ?? "/" });
  },
  component: () => null,
});

// My Expense Sheet routes — all roles except Admin
const mrExpenseSheetRoute = makePortalRoute(
  "/mr/my-expense-sheet",
  MRExpenseSheet as React.ComponentType,
  "MR",
);
const asmExpenseSheetRoute = makePortalRoute(
  "/asm/my-expense-sheet",
  ASMExpenseSheet as React.ComponentType,
  "ASM",
);
const rsmExpenseSheetRoute = makePortalRoute(
  "/rsm/my-expense-sheet",
  RSMExpenseSheet as React.ComponentType,
  "RSM",
);
const zsmExpenseSheetRoute = makePortalRoute(
  "/zsm/my-expense-sheet",
  ZSMExpenseSheet as React.ComponentType,
  "ZSM",
);

const hrExpenseSheetRoute = makePortalRoute(
  "/hr/my-expense-sheet",
  HRExpenseSheet as React.ComponentType,
  "HRManager",
);

// My Incentive & Bonus Sheet routes — all roles except Admin
const mrIncentiveBonusSheetRoute = makePortalRoute(
  "/mr/my-incentive-bonus-sheet",
  MRIncentiveBonusSheet as React.ComponentType,
  "MR",
);
const asmIncentiveBonusSheetRoute = makePortalRoute(
  "/asm/my-incentive-bonus-sheet",
  ASMIncentiveBonusSheet as React.ComponentType,
  "ASM",
);
const rsmIncentiveBonusSheetRoute = makePortalRoute(
  "/rsm/my-incentive-bonus-sheet",
  RSMIncentiveBonusSheet as React.ComponentType,
  "RSM",
);
const zsmIncentiveBonusSheetRoute = makePortalRoute(
  "/zsm/my-incentive-bonus-sheet",
  ZSMIncentiveBonusSheet as React.ComponentType,
  "ZSM",
);

const hrIncentiveBonusSheetRoute = makePortalRoute(
  "/hr/my-incentive-bonus-sheet",
  HRIncentiveBonusSheet as React.ComponentType,
  "HRManager",
);

// My Advances routes — all roles except Admin
const mrAdvancesRoute = makePortalRoute(
  "/mr/my-advances",
  MRAdvances as React.ComponentType,
  "MR",
);
const asmAdvancesRoute = makePortalRoute(
  "/asm/my-advances",
  ASMAdvances as React.ComponentType,
  "ASM",
);
const rsmAdvancesRoute = makePortalRoute(
  "/rsm/my-advances",
  RSMAdvances as React.ComponentType,
  "RSM",
);
const zsmAdvancesRoute = makePortalRoute(
  "/zsm/my-advances",
  ZSMAdvances as React.ComponentType,
  "ZSM",
);

const hrAdvancesRoute = makePortalRoute(
  "/hr/my-advances",
  HRAdvances as React.ComponentType,
  "HRManager",
);

const routeTree = rootRoute.addChildren([
  loginRoute,
  adminRoute,
  adminUsersRoute,
  adminLocationsRoute,
  adminReportsRoute,
  adminProductsRoute,
  adminProductMasterRoute,
  adminSampleAllocationRoute,
  adminLocationMasterRoute,
  adminDaConfigRoute,
  adminLeaveQuotaRoute,
  adminRoleHierarchyRoute,
  adminBookingRoute,
  adminExportRoute,
  adminMessagesRoute,
  adminCompanyProfileRoute,
  hrRoute,
  hrEmployeesRoute,
  hrLeavesRoute,
  hrAttendanceRoute,
  hrPayrollRoute,
  hrExpenseSheetsRoute,
  hrIncentiveBonusSheetsRoute,
  hrEmployeeAdvancesRoute,
  hrExpensesRoute,
  hrTaDaSummaryRoute,
  hrDocumentsRoute,
  hrPerformanceRoute,
  hrGpsTrailRoute,
  hrCheckInRoute,

  hrTravelPlansRoute,
  hrBookingRoute,
  hrExportRoute,
  hrMessagesRoute,
  hrSampleAllocationRoute,
  adminOfficialLettersRoute,
  hrOfficialLettersRoute,
  mrRoute,
  mrReportsRoute,
  mrTravelPlansRoute,
  mrDcrRoute,
  mrDoctorsRoute,
  mrChemistsRoute,
  mrExpensesRoute,
  mrLeaveRoute,
  mrCheckInRoute,
  mrWorkingStyleRoute,
  mrSalarySlipsRoute,
  mrBookingRoute,
  mrExportRoute,
  mrSecondarySaleRoute,

  mrJfwReportsRoute,
  mrKpiRoute,
  mrChemistCallEntryRoute,
  mrStockistCallEntryRoute,
  asmRoute,
  asmCheckInRoute,
  asmSalarySlipsRoute,
  asmExportRoute,
  asmLocationsRoute,
  asmReportsRoute,
  asmExpensesRoute,
  asmPerformanceRoute,
  asmLeaveApprovalRoute,
  asmLeaveRoute,
  asmSecondarySaleRoute,

  asmDailyCallReportRoute,
  asmJfwRoute,
  asmKpiRoute,
  asmDcrApprovalRoute,
  asmMtpApprovalRoute,
  // Doctor Calls (30d) routes removed (V80 rollback)
  rsmRoute,
  rsmCheckInRoute,
  rsmSalarySlipsRoute,
  rsmExportRoute,
  rsmBookingRoute,
  rsmLocationsRoute,
  rsmReportsRoute,
  rsmExpensesRoute,
  rsmPerformanceRoute,
  rsmLeaveApprovalRoute,
  rsmLeaveRoute,
  rsmJfwRoute,
  rsmKpiRoute,
  rsmDcrApprovalRoute,
  rsmMtpApprovalRoute,
  zsmRoute,
  zsmCheckInRoute,
  zsmSalarySlipsRoute,
  zsmExportRoute,
  zsmBookingRoute,
  zsmLocationsRoute,
  zsmReportsRoute,
  zsmExpensesRoute,
  zsmPerformanceRoute,
  zsmLeaveApprovalRoute,
  zsmLeaveRoute,
  // Legacy bottom-up target routes (kept for backward compat)
  adminBottomUpTargetsRoute,
  hrBottomUpTargetsRoute,
  // Monthly Targets routes (new)
  adminMonthlyTargetsRoute,
  hrMonthlyTargetsRoute,
  mrMonthlyTargetsRoute,
  asmMonthlyTargetsRoute,
  rsmMonthlyTargetsRoute,
  zsmMonthlyTargetsRoute,
  // Additional Charges routes
  adminAdditionalChargesRoute,
  hrAdditionalChargesRoute,
  additionalRoleTabRoute,
  // Target vs. Actual Performance routes
  asmTargetPerformanceRoute,
  rsmTargetPerformanceRoute,
  zsmTargetPerformanceRoute,
  adminTargetPerformanceRoute,
  hrTargetPerformanceRoute,
  adminTargetHistoryRoute,
  hrTargetHistoryRoute,
  adminIncentivePlansRoute,
  hrIncentivePlansRoute,
  adminIncentiveManagementRoute,
  hrIncentiveManagementRoute,
  adminEmployeeIdConfigRoute,
  adminCleanTrialDataRoute,
  adminDataCleanupHistoryRoute,
  hrDataCleanupHistoryRoute,
  myTargetDashboardRoute,
  mrMyTargetsRoute,
  asmMyTargetsRoute,
  rsmMyTargetsRoute,
  zsmMyTargetsRoute,
  adminPricelistRoute,
  hrPricelistRoute,
  mrPricelistRoute,
  asmPricelistRoute,
  rsmPricelistRoute,
  zsmPricelistRoute,
  // Secondary Sale report routes
  adminSecondarySaleReportRoute,
  hrSecondarySaleReportRoute,
  // Stockist Master routes
  // MTP Bulk Upload routes removed (V77-V78 rollback)
  adminStationMasterRoute,
  adminStockistMasterRoute,
  hrStockistMasterRoute,
  // System Health — Admin only
  adminSystemHealthRoute,
  // GPS Settings — Admin only
  adminGpsSettingsRoute,
  // Notification Settings — Admin only
  adminNotificationSettingsRoute,
  // Suggestions Management routes
  hrSuggestionsRoute,
  adminSuggestionsRoute,
  // HQ Employee Hierarchy routes
  adminHqHierarchyRoute,
  hrHqHierarchyRoute,
  zsmHqHierarchyRoute,
  rsmHqHierarchyRoute,
  asmHqHierarchyRoute,
  // Location Trail routes
  asmLocationTrailRoute,
  rsmLocationTrailRoute,
  zsmLocationTrailRoute,
  hrLocationTrailRoute,
  adminLocationTrailRoute,
  // Gift Article Master routes
  adminGiftArticleMasterRoute,
  hrGiftArticleMasterRoute,
  // Call Reports routes — all 7 portals
  mrCallReportsRoute,
  asmCallReportsRoute,
  rsmCallReportsRoute,
  zsmCallReportsRoute,
  hrCallReportsRoute,
  adminCallReportsRoute,
  // Doctor Master routes (Admin and HR only)
  adminDoctorMasterRoute,
  hrDoctorMasterRoute,
  // Admin Leave Management route
  adminLeaveManagementRoute,
  // MR Portal Entries routes
  adminMRPortalEntriesRoute,
  hrMRPortalEntriesRoute,
  // MR Call Details Report routes
  mrCallDetailsRoute,
  asmMRCallDetailsRoute,
  rsmMRCallDetailsRoute,
  zsmMRCallDetailsRoute,
  hrMRCallDetailsRoute,
  adminMRCallDetailsRoute,
  // Doctor Call Report 30 Days removed (V80 rollback)
  // DCR Submission Rate Report routes
  hrDcrSubmissionRateRoute,
  adminDcrSubmissionRateRoute,
  // Missed Doctor Visits removed (V80 rollback)
  // RSM additional routes (attendance tracking, working style, missed visits)
  rsmMissedDoctorVisitsRoute,
  rsmAttendanceTrackingRoute,
  rsmWorkingStyleReportsRoute,
  // ASM working style reports
  asmWorkingStyleReportsRoute,
  // Company Holidays routes
  companyHolidaysSharedRoute,
  mrCompanyHolidaysRoute,
  asmCompanyHolidaysRoute,
  rsmCompanyHolidaysRoute,
  zsmCompanyHolidaysRoute,
  hrCompanyHolidaysRoute,
  adminCompanyHolidaysRoute,
  // My Attendance routes
  myAttendanceSharedRoute,
  mrMyAttendanceRoute,
  asmMyAttendanceRoute,
  rsmMyAttendanceRoute,
  zsmMyAttendanceRoute,
  hrMyAttendanceRoute,
  // My Expense Sheet routes
  mrExpenseSheetRoute,
  asmExpenseSheetRoute,
  rsmExpenseSheetRoute,
  zsmExpenseSheetRoute,
  hrExpenseSheetRoute,
  // My Incentive & Bonus Sheet routes
  mrIncentiveBonusSheetRoute,
  asmIncentiveBonusSheetRoute,
  rsmIncentiveBonusSheetRoute,
  zsmIncentiveBonusSheetRoute,
  hrIncentiveBonusSheetRoute,
  // My Advances routes
  mrAdvancesRoute,
  asmAdvancesRoute,
  rsmAdvancesRoute,
  zsmAdvancesRoute,
  hrAdvancesRoute,
  // Sample Return and Visit Freq routes removed (V82 rollback)
  mrSampleLedgerRoute,
  asmSampleLedgerRoute,
  rsmSampleLedgerRoute,
  adminSampleLedgerRoute,
  hrSampleLedgerRoute,
  // adminSampleReturnMgmt, visitFreq routes removed (V82 rollback)
  // Absence Audit Trail routes
  hrAbsenceAuditRoute,
  adminAbsenceAuditRoute,
  // Distributor, Order Management, Order Book removed (V82 rollback)
  // Birthday Calendar routes
  hrBirthdayCalendarRoute,
  adminBirthdayCalendarRoute,
  // RSM Travel Plans (MTP)
  rsmTravelPlansRoute,
  // Phase 2 SFA Placeholder routes — Admin
  adminSfaDoctorProductCoverageRoute,
  adminSfaDcrSummaryRoute,
  adminSfaMtpVsActualRoute,
  adminSfaChemistCoverageRoute,
  adminSfaSampleBalanceRoute,
  adminSfaJfwSummaryRoute,
  // Phase 2 SFA Placeholder routes — HR
  hrSfaDoctorProductCoverageRoute,
  hrSfaDcrSummaryRoute,
  hrSfaMtpVsActualRoute,
  hrSfaChemistCoverageRoute,
  hrSfaSampleBalanceRoute,
  hrSfaJfwSummaryRoute,
  // Phase 2 SFA Placeholder routes — MR
  mrSfaSampleBalanceRoute,
  // Phase 2 SFA Placeholder routes — ASM
  asmSfaDoctorProductCoverageRoute,
  asmSfaDcrSummaryRoute,
  asmSfaMtpVsActualRoute,
  asmSfaChemistCoverageRoute,
  asmSfaSampleBalanceRoute,
  asmSfaJfwSummaryRoute,
  // Phase 2 SFA Placeholder routes — RSM
  rsmSfaDoctorProductCoverageRoute,
  rsmSfaDcrSummaryRoute,
  rsmSfaMtpVsActualRoute,
  rsmSfaChemistCoverageRoute,
  rsmSfaSampleBalanceRoute,
  rsmSfaJfwSummaryRoute,
  // Phase 2 SFA Placeholder routes — ZSM
  zsmSfaDoctorProductCoverageRoute,
  zsmSfaDcrSummaryRoute,
  zsmSfaMtpVsActualRoute,
  zsmSfaChemistCoverageRoute,
  zsmSfaJfwSummaryRoute,
  zsmSfaSampleBalanceRoute,
  // DCR Settings, MTP Settings, E-Detailing routes removed (V80-V82 rollback)
  // DCR Edit Request Review routes
  adminDcrEditRequestsRoute,
  asmDcrEditRequestsRoute,
  // Attendance Correction Review routes
  adminAttendanceCorrectionsRoute,
  hrAttendanceCorrectionsRoute,
  // Document Config — Admin only
  adminTaDaPolicyRoute,
  adminDocumentConfigRoute,
  adminExpensePolicyRoute,
  // Expense Claim Summary routes
  adminExpenseClaimSummaryRoute,
  asmExpenseClaimSummaryRoute,
  rsmExpenseClaimSummaryRoute,
  hrExpenseClaimSummaryRoute,
  adminSalesTargetRoute,
  adminAuditTrailRoute,
  adminRecruitmentRoute,
  adminAppraisalRoute,
  adminPayrollReportsRoute,
  adminDCRReportRoute,
  adminExpenseReportsRoute,
  adminChemistMasterRoute,
  adminAttendanceReportsRoute,
  adminBulkExportRoute,
  notFoundRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  const clearSession = useAuthStore((s) => s.clearSession);

  // Start background GPS capture every 3 minutes when authenticated
  useBackgroundGpsCapture();

  useEffect(() => {
    function onSessionExpired() {
      clearSession();
      toast.error("Your session has expired. Please log in again.", {
        id: "session-expired",
        duration: 6000,
      });
      // Navigate to root; router's beforeLoad will redirect to login
      window.location.href = "/";
    }

    window.addEventListener("session-expired", onSessionExpired);
    return () => {
      window.removeEventListener("session-expired", onSessionExpired);
    };
  }, [clearSession]);

  return (
    <>
      <AdminMessagePopup />
      <AppUpdatePopup />
      <PwaInstallBanner />
      <RouterProvider router={router} />
      <ScrollToTop />
    </>
  );
}
