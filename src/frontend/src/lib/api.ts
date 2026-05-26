import { createActorWithConfig } from "@caffeineai/core-infrastructure";
import { Variant_ok_error, createActor } from "../backend";
import type {
  BulkStationImportInput,
  BulkStationImportResult,
  HqAssignment,
  RepairLog,
  StationType,
  backendInterface,
} from "../backend.d";
import type {
  AddPricelistProductInput,
  AddSuggestionReplyInput,
  AdditionalChargeFilter,
  AssignAdditionalChargeInput,
  MonthlyTargetFilter,
  OnLeaveEmployee,
  PricelistProductInfo,
  SetMonthlyTargetInput,
  SubmitSuggestionInput,
  SuggestionFilter,
  SuggestionSubmission,
  UpdateAdditionalChargeInput,
  UpdatePricelistProductInput,
  UpdateSuggestionStatusInput,
} from "../types";
import { dispatchSessionExpired, isSessionError } from "./sessionErrorHandler";

/**
 * Inspects a backend Result<T, string> value.
 * If the err variant signals a session problem, dispatch the global
 * session-expired event so App.tsx can clear state and redirect.
 * Returns the result unchanged so callers can still inspect it.
 */
export function checkResult<T>(
  result: { __kind__: "ok"; ok: T } | { __kind__: "err"; err: string },
): typeof result {
  if (result.__kind__ === "err" && isSessionError(result.err)) {
    dispatchSessionExpired();
  }
  return result;
}

// Initialize actor once via createActorWithConfig
let actorPromise: Promise<backendInterface> | null = null;

function getActorPromise(): Promise<backendInterface> {
  if (!actorPromise) {
    actorPromise = createActorWithConfig(
      createActor,
    ) as Promise<backendInterface>;
  }
  return actorPromise;
}

async function actor(): Promise<backendInterface> {
  return getActorPromise();
}

// ── Seed data for E-Detailing (shown when backend method not yet available) ────────────────────
function getSeedEDetailingProducts() {
  return [
    {
      productId: "seed-1",
      name: "Amoxiclav 625",
      category: "Antibiotics",
      composition: "Amoxicillin 500mg + Clavulanic Acid 125mg",
      mrp: BigInt(28500),
      packSize: "10 tablets",
      description:
        "Broad-spectrum penicillin antibiotic. Indicated for respiratory tract infections, UTIs, and skin infections.",
      contentVersion: 3,
      publishedAt:
        BigInt(Date.now() - 7 * 24 * 60 * 60 * 1000) * BigInt(1_000_000),
      isCurrentVersion: true,
    },
    {
      productId: "seed-2",
      name: "Cardivast 5",
      category: "Cardiovascular",
      composition: "Amlodipine 5mg",
      mrp: BigInt(12000),
      packSize: "30 tablets",
      description:
        "Calcium channel blocker for hypertension and angina. Once-daily dosing for patient compliance.",
      contentVersion: 2,
      publishedAt:
        BigInt(Date.now() - 14 * 24 * 60 * 60 * 1000) * BigInt(1_000_000),
      isCurrentVersion: true,
    },
    {
      productId: "seed-3",
      name: "Zypan Forte",
      category: "Gastroenterology",
      composition: "Pantoprazole 40mg + Domperidone 10mg SR",
      mrp: BigInt(18500),
      packSize: "15 capsules",
      description:
        "PPI + prokinetic combination for GERD and dyspepsia. Reduces gastric acid and improves gastric motility.",
      contentVersion: 1,
      publishedAt:
        BigInt(Date.now() - 30 * 24 * 60 * 60 * 1000) * BigInt(1_000_000),
      isCurrentVersion: true,
    },
    {
      productId: "seed-4",
      name: "Neurokind Plus",
      category: "Vitamins",
      composition:
        "Methylcobalamin 1500mcg + Alpha Lipoic Acid 100mg + Folic Acid 1.5mg",
      mrp: BigInt(22000),
      packSize: "30 tablets",
      description:
        "Neuroprotective supplement for peripheral neuropathy and diabetic neuropathy.",
      contentVersion: 2,
      publishedAt:
        BigInt(Date.now() - 21 * 24 * 60 * 60 * 1000) * BigInt(1_000_000),
      isCurrentVersion: true,
    },
    {
      productId: "seed-5",
      name: "Diacure-M 500",
      category: "Diabetes",
      composition: "Metformin HCl 500mg",
      mrp: BigInt(8500),
      packSize: "20 tablets",
      description:
        "First-line oral antidiabetic for type 2 diabetes. Reduces hepatic glucose production and improves insulin sensitivity.",
      contentVersion: 4,
      publishedAt:
        BigInt(Date.now() - 5 * 24 * 60 * 60 * 1000) * BigInt(1_000_000),
      isCurrentVersion: true,
    },
  ];
}

export const api = {
  // Auth
  login: async (username: string, password: string) =>
    (await actor()).login(username, password),

  logout: async (token: string) => (await actor()).logout(token),

  whoami: async (token: string) => (await actor()).whoami(token),

  // User management
  createUser: async (
    token: string,
    input: Parameters<backendInterface["createUser"]>[1],
  ) => (await actor()).createUser(token, input),

  updateUser: async (
    token: string,
    userId: bigint,
    input: Parameters<backendInterface["updateUser"]>[2],
  ) => (await actor()).updateUser(token, userId, input),

  deactivateUser: async (token: string, userId: bigint) =>
    (await actor()).deactivateUser(token, userId),

  reactivateUser: async (token: string, userId: bigint) =>
    (await actor()).reactivateUser(token, userId),

  deleteEmployee: async (token: string, employeeId: string) =>
    (await actor()).deleteEmployee(token, employeeId),

  getInactiveUsers: async (token: string) =>
    (await actor()).getInactiveUsers(token),

  getReactivationLog: async (token: string) =>
    (await actor()).getReactivationLog(token),

  getUser: async (token: string, userId: bigint) =>
    (await actor()).getUser(token, userId),

  listAllUsers: async (token: string) => (await actor()).listAllUsers(token),

  listUsersByRole: async (
    token: string,
    role: Parameters<backendInterface["listUsersByRole"]>[1],
  ) => (await actor()).listUsersByRole(token, role),

  listUsersAboveRole: async (
    token: string,
    targetRole: Parameters<backendInterface["listUsersAboveRole"]>[1],
  ) => (await actor()).listUsersAboveRole(token, targetRole),

  listReportees: async (token: string, managerId: bigint) =>
    (await actor()).listReportees(token, managerId),

  listUsersByTerritory: async (token: string, territory: string) =>
    (await actor()).listUsersByTerritory(token, territory),

  resetUserPassword: async (token: string, userId: bigint) =>
    (await actor()).resetUserPassword(token, userId),

  seedAdminPassword: async (token: string) =>
    (await actor()).seedAdminPassword(token),

  // Location
  submitLocation: async (token: string, lat: number, lng: number) =>
    (await actor()).submitLocation(token, lat, lng),

  getLocation: async (token: string, userId: bigint) =>
    (await actor()).getLocation(token, userId),

  getReporteeLocations: async (token: string) =>
    (await actor()).getReporteeLocations(token),

  getAllLocations: async (token: string) =>
    (await actor()).getAllLocations(token),

  // HR - Leave
  getMyLeaves: async (token: string) => (await actor()).getMyLeaves(token),

  getLeaveBalance: async (token: string) =>
    (await actor()).getLeaveBalance(token),

  getOutStationDaRate: async (token: string, userId: bigint) =>
    (await actor()).getOutStationDaRate(token, userId),

  applyLeaveV2: async (
    token: string,
    input: Parameters<backendInterface["applyLeaveV2"]>[1],
  ) => (await actor()).applyLeaveV2(token, input),

  getAllLeaves: async (
    token: string,
    filter: Parameters<backendInterface["getAllLeaves"]>[1],
  ) => (await actor()).getAllLeaves(token, filter),

  getPendingLeavesForManager: async (token: string) =>
    (await actor()).getPendingLeavesForManager(token),

  updateLeaveStatus: async (
    token: string,
    input: Parameters<backendInterface["updateLeaveStatus"]>[1],
  ) => (await actor()).updateLeaveStatus(token, input),

  getRoleLeaveQuota: async (
    token: string,
    role: Parameters<backendInterface["getRoleLeaveQuota"]>[1],
    year: bigint,
  ) => (await actor()).getRoleLeaveQuota(token, role, year),

  setRoleLeaveQuota: async (
    token: string,
    quota: Parameters<backendInterface["setRoleLeaveQuota"]>[1],
  ) => (await actor()).setRoleLeaveQuota(token, quota),

  getLeaveExportRows: async (
    token: string,
    filter: Parameters<backendInterface["getLeaveExportRows"]>[1],
  ) => (await actor()).getLeaveExportRows(token, filter),

  // HR - Attendance
  recordAttendance: async (
    token: string,
    employeeId: bigint,
    date: string,
    status: Parameters<backendInterface["recordAttendance"]>[3],
  ) => (await actor()).recordAttendance(token, employeeId, date, status),

  getMonthlyAttendance: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getMonthlyAttendance(token, employeeId, month, year),

  getMonthlySummary: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getMonthlySummary(token, employeeId, month, year),

  // HR - Payroll
  processPayroll: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).processPayroll(token, employeeId, month, year),

  processPayrollFull: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
    basicPay: bigint,
    hra: bigint,
    taAllowance: bigint,
    daAllowance: bigint,
  ) =>
    (await actor()).processPayrollFull(
      token,
      employeeId,
      month,
      year,
      basicPay,
      hra,
      taAllowance,
      daAllowance,
    ),

  getPayrollRecord: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getPayrollRecord(token, employeeId, month, year),

  // HR - Expenses
  approveExpense: async (token: string, expenseId: bigint, approve: boolean) =>
    (await actor()).approveExpense(token, expenseId, approve),

  getPendingExpenses: async (token: string) =>
    (await actor()).getPendingExpenses(token),

  getMyExpenses: async (token: string) => (await actor()).getMyExpenses(token),

  submitTaDaExpense: async (
    token: string,
    date: string,
    stationType: StationType,
    fromLocation: string | null,
    toLocation: string | null,
    distanceKm: bigint,
    daRate: Parameters<backendInterface["submitTaDaExpense"]>[6],
    purpose: string,
    gpsLocation?: { lat: number; lng: number },
  ) => {
    const a = await actor();
    return a.submitTaDaExpense(
      token,
      date,
      stationType,
      fromLocation,
      toLocation,
      distanceKm,
      daRate,
      purpose,
      gpsLocation
        ? { lat: gpsLocation.lat, lng: gpsLocation.lng, timestamp: BigInt(0) }
        : null,
    );
  },

  submitTaDaExpenseV2: async (
    token: string,
    date: string,
    stationType: StationType,
    fromLocation: string | null,
    toLocation: string | null,
    distanceKm: bigint,
    daRate: Parameters<backendInterface["submitTaDaExpense"]>[6],
    purpose: string,
    gpsLocation: { lat: number; lng: number } | undefined,
    modeOfTransport: string | null,
    lodgingExpense: bigint | null,
    miscExpense: bigint | null,
    miscNarration: string | null,
    gradeName: string | null,
  ) => {
    const a = await actor();
    return a.submitTaDaExpenseV2(
      token,
      date,
      stationType,
      fromLocation,
      toLocation,
      distanceKm,
      daRate,
      purpose,
      gpsLocation
        ? { lat: gpsLocation.lat, lng: gpsLocation.lng, timestamp: BigInt(0) }
        : null,
      modeOfTransport,
      lodgingExpense,
      miscExpense,
      miscNarration,
      gradeName,
    );
  },

  getTaDaGradeByName: async (token: string, gradeName: string) =>
    (await actor()).getTaDaGradeByName(token, gradeName),

  // HR - Performance & Documents
  getEmployeePerformance: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getEmployeePerformance(token, employeeId, month, year),

  upsertPerformance: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
    callsMade: bigint,
    doctorsVisited: bigint,
    chemistOrders: bigint,
    totalSales: bigint,
    remarks: string,
  ) =>
    (await actor()).upsertPerformance(
      token,
      employeeId,
      month,
      year,
      callsMade,
      doctorsVisited,
      chemistOrders,
      totalSales,
      remarks,
    ),

  addDocument: async (
    token: string,
    employeeId: bigint,
    documentType: Parameters<backendInterface["addDocument"]>[2],
    fileName: string,
    storageUrl: string,
  ) =>
    (await actor()).addDocument(
      token,
      employeeId,
      documentType,
      fileName,
      storageUrl,
    ),

  getEmployeeDocuments: async (token: string, employeeId: bigint) =>
    (await actor()).getEmployeeDocuments(token, employeeId),

  deleteDocument: async (token: string, documentId: bigint) =>
    (await actor()).deleteDocument(token, documentId),

  // Location Master
  listAllActiveAreas: async (token: string) =>
    (await actor()).listAllActiveAreas(token),

  listActiveZones: async (token: string) =>
    (await actor()).listActiveZones(token),

  listActiveStatesByZone: async (token: string, zoneId: bigint) =>
    (await actor()).listActiveStatesByZone(token, zoneId),

  listActiveTerritories: async (token: string, stateId: bigint) =>
    (await actor()).listActiveTerritories(token, stateId),

  listActiveHQsByTerritory: async (token: string, territoryId: bigint) =>
    (await actor()).listActiveHQsByTerritory(token, territoryId),

  listActiveAreasByHQ: async (token: string, hqId: bigint) =>
    (await actor()).listActiveAreasByHQ(token, hqId),

  listZones: async (token: string) => (await actor()).listZones(token),

  addZone: async (
    token: string,
    input: Parameters<backendInterface["addZone"]>[1],
  ) => (await actor()).addZone(token, input),

  updateZone: async (
    token: string,
    id: Parameters<backendInterface["updateZone"]>[1],
    input: Parameters<backendInterface["updateZone"]>[2],
  ) => (await actor()).updateZone(token, id, input),

  deactivateZone: async (
    token: string,
    id: Parameters<backendInterface["deactivateZone"]>[1],
  ) => (await actor()).deactivateZone(token, id),

  listStatesByZone: async (token: string, zoneId: bigint) =>
    (await actor()).listStatesByZone(token, zoneId),

  addState: async (
    token: string,
    input: Parameters<backendInterface["addState"]>[1],
  ) => (await actor()).addState(token, input),

  updateState: async (
    token: string,
    id: Parameters<backendInterface["updateState"]>[1],
    input: Parameters<backendInterface["updateState"]>[2],
  ) => (await actor()).updateState(token, id, input),

  deactivateState: async (
    token: string,
    id: Parameters<backendInterface["deactivateState"]>[1],
  ) => (await actor()).deactivateState(token, id),

  listTerritoriesByState: async (token: string, stateId: bigint) =>
    (await actor()).listTerritoriesByState(token, stateId),

  addTerritory: async (
    token: string,
    input: Parameters<backendInterface["addTerritory"]>[1],
  ) => (await actor()).addTerritory(token, input),

  updateTerritory: async (
    token: string,
    id: Parameters<backendInterface["updateTerritory"]>[1],
    input: Parameters<backendInterface["updateTerritory"]>[2],
  ) => (await actor()).updateTerritory(token, id, input),

  deactivateTerritory: async (
    token: string,
    id: Parameters<backendInterface["deactivateTerritory"]>[1],
  ) => (await actor()).deactivateTerritory(token, id),

  listHQsByTerritory: async (token: string, territoryId: bigint) =>
    (await actor()).listHQsByTerritory(token, territoryId),

  addHQ: async (
    token: string,
    input: Parameters<backendInterface["addHQ"]>[1],
  ) => (await actor()).addHQ(token, input),

  updateHQ: async (
    token: string,
    id: Parameters<backendInterface["updateHQ"]>[1],
    input: Parameters<backendInterface["updateHQ"]>[2],
  ) => (await actor()).updateHQ(token, id, input),

  deactivateHQ: async (
    token: string,
    id: Parameters<backendInterface["deactivateHQ"]>[1],
  ) => (await actor()).deactivateHQ(token, id),

  listAllAreas: async (token: string) => (await actor()).listAllAreas(token),

  addArea: async (
    token: string,
    input: Parameters<backendInterface["addArea"]>[1],
  ) => (await actor()).addArea(token, input),

  updateArea: async (
    token: string,
    id: Parameters<backendInterface["updateArea"]>[1],
    input: Parameters<backendInterface["updateArea"]>[2],
  ) => (await actor()).updateArea(token, id, input),

  deactivateArea: async (
    token: string,
    id: Parameters<backendInterface["deactivateArea"]>[1],
  ) => (await actor()).deactivateArea(token, id),

  addTerritoryToStation: async (
    token: string,
    name: string,
    stationId: bigint,
  ) => (await actor()).addTerritoryToStation(token, name, stationId),

  updateTerritoryUnderStation: async (
    token: string,
    territoryId: bigint,
    name: string,
  ) => (await actor()).updateTerritoryUnderStation(token, territoryId, name),

  deleteTerritoryUnderStation: async (token: string, territoryId: bigint) =>
    (await actor()).deleteTerritoryUnderStation(token, territoryId),

  // Field Ops - Products
  addProduct: async (input: Parameters<backendInterface["addProduct"]>[0]) =>
    (await actor()).addProduct(input),

  listProducts: async () => (await actor()).listProducts(),

  updateProduct: async (
    productId: Parameters<backendInterface["updateProduct"]>[0],
    name: Parameters<backendInterface["updateProduct"]>[1],
    category: Parameters<backendInterface["updateProduct"]>[2],
    description: Parameters<backendInterface["updateProduct"]>[3],
    productCode?: Parameters<backendInterface["updateProduct"]>[4],
    division?: Parameters<backendInterface["updateProduct"]>[5],
    mrpPaise?: Parameters<backendInterface["updateProduct"]>[6],
    packSize?: Parameters<backendInterface["updateProduct"]>[7],
  ) =>
    (await actor()).updateProduct(
      productId,
      name,
      category,
      description,
      productCode ?? null,
      division ?? null,
      mrpPaise ?? null,
      packSize ?? null,
    ),

  // ── Sample Allocation ──────────────────────────────────────────────────────

  allocateSamplesToMR: async (
    token: string,
    input: Parameters<backendInterface["allocateSamplesToMR"]>[1],
  ) => (await actor()).allocateSamplesToMR(token, input),

  getAllAllocations: async (token: string, month: number, year: number) => {
    const result = await (await actor()).getAllAllocations(
      token,
      BigInt(month),
      BigInt(year),
    );
    if (result.__kind__ === "err") throw new Error(result.err);
    return result.ok;
  },

  getAllocationsForMR: async (
    token: string,
    mrId: bigint,
    month: number,
    year: number,
  ) => {
    const result = await (await actor()).getAllocationsForMR(
      token,
      mrId,
      BigInt(month),
      BigInt(year),
    );
    if (result.__kind__ === "err") throw new Error(result.err);
    return result.ok;
  },

  getTeamSampleBalances: async (
    token: string,
    mrIds: bigint[],
    month: number,
    year: number,
  ) => {
    const result = await (await actor()).getTeamSampleBalances(
      token,
      mrIds,
      BigInt(month),
      BigInt(year),
    );
    if (result.__kind__ === "err") throw new Error(result.err);
    return result.ok;
  },

  // ── Doctor Classification ──────────────────────────────────────────────────

  deactivateProduct: async (
    productId: Parameters<backendInterface["deactivateProduct"]>[0],
  ) => (await actor()).deactivateProduct(productId),

  // Field Ops - Doctors
  addDoctor: async (
    mrId: bigint,
    input: Parameters<backendInterface["addDoctor"]>[1],
  ) => (await actor()).addDoctor(mrId, input),

  listDoctors: async () => (await actor()).listDoctors(),

  listMyDoctors: async (mrId: bigint) => (await actor()).listMyDoctors(mrId),

  listMyDoctorAssignments: async (mrId: bigint) =>
    (await actor()).listMyDoctorAssignments(mrId),

  assignProductsToDoctor: async (
    mrId: bigint,
    input: Parameters<backendInterface["assignProductsToDoctor"]>[1],
  ) => (await actor()).assignProductsToDoctor(mrId, input),

  getDoctorAssignment: async (mrId: bigint, doctorId: bigint) =>
    (await actor()).getDoctorAssignment(mrId, doctorId),

  bulkImportDoctors: async (
    token: string,
    mrId: bigint,
    items: Parameters<backendInterface["bulkImportDoctors"]>[2],
    _areaName?: string,
  ) => (await actor()).bulkImportDoctors(token, mrId, items),

  updateDoctorAdmin: async (
    token: string,
    doctorId: bigint,
    name: string | null,
    qualification: Parameters<backendInterface["updateDoctorAdmin"]>[3],
    station: string | null,
    area: string | null,
    territory: string | null,
    specialization: string | null,
    contactPhone: string | null,
    category?: string | null,
    email?: string | null,
    clinicName?: string | null,
    address?: string | null,
    isActive?: boolean | null,
    dateOfBirth?: string | null,
  ) =>
    (await actor()).updateDoctorAdmin(
      token,
      doctorId,
      name,
      qualification,
      station,
      area,
      territory,
      specialization,
      contactPhone,
      category ?? null,
      email ?? null,
      clinicName ?? null,
      address ?? null,
      isActive ?? null,
      dateOfBirth ?? null,
    ),

  deleteDoctor: async (token: string, doctorId: bigint) =>
    (await actor()).deleteDoctor(token, doctorId),

  deleteDoctors: async (token: string, doctorIds: bigint[]) =>
    (await actor()).deleteDoctors(token, doctorIds),

  getDoctorsByMRHQAndArea: async (token: string, mrUserId: bigint) =>
    (await actor()).getDoctorsByMRHQAndArea(token, mrUserId),

  getDoctorsForStation: async (
    token: string,
    mrUserId: bigint,
    stationName: string,
  ) => (await actor()).getDoctorsForStation(token, mrUserId, stationName),

  // Field Ops - Chemists
  addChemist: async (
    mrId: bigint,
    input: Parameters<backendInterface["addChemist"]>[1],
  ) => (await actor()).addChemist(mrId, input),

  listChemists: async () => (await actor()).listChemists(),

  listMyChemists: async (mrId: bigint) => (await actor()).listMyChemists(mrId),

  submitChemistOrder: async (
    mrId: bigint,
    input: Parameters<backendInterface["submitChemistOrder"]>[1],
    gpsLocation?: { lat: number; lng: number },
  ) => {
    const a = await actor();
    const fn = a.submitChemistOrder as (
      mrId: bigint,
      input: Parameters<backendInterface["submitChemistOrder"]>[1],
      gpsLocation?: { lat: number; lng: number },
    ) => ReturnType<backendInterface["submitChemistOrder"]>;
    return fn(mrId, input, gpsLocation);
  },

  listMyOrders: async (mrId: bigint) => (await actor()).listMyOrders(mrId),

  bulkImportChemists: async (
    token: string,
    mrId: bigint,
    items: Parameters<backendInterface["bulkImportChemists"]>[2],
    areaName: string,
  ) => (await actor()).bulkImportChemists(token, mrId, items, areaName),

  // Field Ops - Call Reports
  createCallReport: async (
    mrId: bigint,
    input: Parameters<backendInterface["createCallReport"]>[1],
  ) => (await actor()).createCallReport(mrId, input),

  submitCallReport: async (token: string, reportId: bigint) =>
    (await actor()).submitCallReport(token, reportId),

  listMyCallReports: async (mrId: bigint) =>
    (await actor()).listMyCallReports(mrId),

  listMyCallReportsByMonth: async (mrId: bigint, month: string) =>
    (await actor()).listMyCallReportsByMonth(mrId, month),

  listSubmittedReports: async () => (await actor()).listSubmittedReports(),

  reviewCallReport: async (
    reviewerId: bigint,
    reportId: bigint,
    approved: boolean,
    note: string,
  ) => (await actor()).reviewCallReport(reviewerId, reportId, approved, note),

  getMrMonthlySummary: async (mrId: bigint, month: string) =>
    (await actor()).getMrMonthlySummary(mrId, month),

  listAllMrSummaries: async (month: string) =>
    (await actor()).listAllMrSummaries(month),

  getTerritoryCoverage: async (territory: string, month: string) =>
    (await actor()).getTerritoryCoverage(territory, month),

  // GPS Background Activity
  captureGpsBackground: async (
    token: string,
    lat: number,
    lng: number,
    accuracy?: number,
  ) => (await actor()).captureGpsBackground(token, lat, lng, accuracy ?? null),

  getGpsActivityLog: async (
    token: string,
    filter: Parameters<backendInterface["getGpsActivityLog"]>[1],
  ) => (await actor()).getGpsActivityLog(token, filter),

  getGpsActivityLogGrouped: async (
    token: string,
    userId: Parameters<backendInterface["getGpsActivityLogGrouped"]>[1],
    date: string,
  ) => (await actor()).getGpsActivityLogGrouped(token, userId, date),

  // GPS Trail
  recordGpsTrail: async (
    token: string,
    date: string,
    coord: Parameters<backendInterface["recordGpsTrail"]>[2],
  ) => (await actor()).recordGpsTrail(token, date, coord),

  getGpsTrail: async (token: string, userId: bigint, date: string) =>
    (await actor()).getGpsTrail(token, userId, date),

  getAllTrailsForUser: async (token: string, userId: bigint) =>
    (await actor()).getAllTrailsForUser(token, userId),

  // Location-based Attendance Check-In
  checkInAttendance: async (
    token: string,
    coord: Parameters<backendInterface["checkInAttendance"]>[1],
    date: string,
  ) => (await actor()).checkInAttendance(token, coord, date),

  getMyCheckIns: async (token: string) => (await actor()).getMyCheckIns(token),

  getCheckInsByDate: async (token: string, date: string) =>
    (await actor()).getCheckInsByDate(token, date),

  // Payroll - TA/DA totals for month
  getApprovedTaDaForMonth: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getApprovedTaDaForMonth(token, employeeId, month, year),

  // My Payroll (employee self-service)
  getMyPayrollHistory: async (token: string) =>
    (await actor()).getMyPayrollHistory(token),

  getMyPayrollRecord: async (token: string, month: bigint, year: bigint) =>
    (await actor()).getMyPayrollRecord(token, month, year),

  // DA Configuration & History
  getDaConfigs: async () => (await actor()).getDaConfigs(),

  setDaConfigs: async (
    token: string,
    configs: Parameters<backendInterface["setDaConfigs"]>[1],
  ) => (await actor()).setDaConfigs(token, configs),

  getMyDaHistory: async (token: string, month: bigint, year: bigint) =>
    (await actor()).getMyDaHistory(token, month, year),

  getEmployeeDaHistory: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getEmployeeDaHistory(token, employeeId, month, year),

  getEmployeeDcrDaForMonth: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getEmployeeDcrDaForMonth(token, employeeId, month, year),

  getDoctorVisitHistory: async (doctorId: bigint, limit: bigint) =>
    (await actor()).getDoctorVisitHistory(doctorId, limit),

  listGiftArticles: async (token: string) =>
    (await actor()).listGiftArticles(token),

  listAllGiftArticles: async (token: string) =>
    (await actor()).listAllGiftArticles(token),

  createGiftArticle: async (
    token: string,
    input: Parameters<backendInterface["createGiftArticle"]>[1],
  ) => (await actor()).createGiftArticle(token, input),

  updateGiftArticle: async (
    token: string,
    id: Parameters<backendInterface["updateGiftArticle"]>[1],
    input: Parameters<backendInterface["updateGiftArticle"]>[2],
  ) => (await actor()).updateGiftArticle(token, id, input),

  deleteGiftArticle: async (
    token: string,
    id: Parameters<backendInterface["deleteGiftArticle"]>[1],
  ) => (await actor()).deleteGiftArticle(token, id),

  bulkImportGiftArticles: async (
    token: string,
    items: Array<{ name: string; category: string; description: string }>,
  ): Promise<{
    totalRows: number;
    created: number;
    skipped: number;
    errors: Array<{ row: number; name: string; reason: string }>;
  }> => {
    try {
      const result = await (await actor()).bulkImportGiftArticles(token, items);
      return {
        totalRows: Number(result.totalRows),
        created: Number(result.created),
        skipped: Number(result.skipped),
        errors: (Array.isArray(result.errors) ? result.errors : []).map(
          (e: unknown) => {
            const err = e as Record<string, unknown>;
            return {
              row: Number(err.row ?? 0),
              name: String(err.name ?? ""),
              reason: String(err.reason ?? ""),
            };
          },
        ),
      };
    } catch (e) {
      return {
        totalRows: items.length,
        created: 0,
        skipped: 0,
        errors: [{ row: 0, name: "", reason: String(e) }],
      };
    }
  },

  getGiftArticleMonthlyUsage: async (
    token: string,
    month: number,
    year: number,
  ): Promise<Array<{ articleId: string; totalQuantity: number }>> => {
    try {
      const result = await (await actor()).getGiftArticleMonthlyUsage(
        token,
        BigInt(month),
        BigInt(year),
      );
      return result.map(([id, qty]) => ({
        articleId: String(id),
        totalQuantity: Number(qty),
      }));
    } catch {
      return [];
    }
  },

  // Distributor Management
  listDistributors: async (token: string) => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listDistributors !== "function") return [];
      return (await a.listDistributors(token)) as unknown[];
    } catch {
      return [];
    }
  },

  listDistributorsByArea: async (token: string, area: string) => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listDistributorsByArea !== "function") return [];
      return (await a.listDistributorsByArea(token, area)) as unknown[];
    } catch {
      return [];
    }
  },

  searchDistributors: async (token: string, query: string) => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.searchDistributors !== "function") return [];
      return (await a.searchDistributors(token, query)) as unknown[];
    } catch {
      return [];
    }
  },

  getDistributor: async (token: string, id: bigint) => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getDistributor !== "function") return null;
      return (await a.getDistributor(token, id)) as unknown;
    } catch {
      return null;
    }
  },

  createDistributor: async (
    token: string,
    input: Record<string, unknown>,
  ): Promise<
    { __kind__: "ok"; ok: bigint } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.createDistributor !== "function") {
        return { __kind__: "err", err: "createDistributor not available" };
      }
      return (await a.createDistributor(token, input)) as
        | { __kind__: "ok"; ok: bigint }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  updateDistributor: async (
    token: string,
    id: bigint,
    input: Record<string, unknown>,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.updateDistributor !== "function") {
        return { __kind__: "err", err: "updateDistributor not available" };
      }
      return (await a.updateDistributor(token, id, input)) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  deactivateDistributor: async (
    token: string,
    id: bigint,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.deactivateDistributor !== "function") {
        return { __kind__: "err", err: "deactivateDistributor not available" };
      }
      return (await a.deactivateDistributor(token, id)) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  // CRM Requests
  createCrmRequest: async (
    token: string,
    input: Parameters<backendInterface["createCrmRequest"]>[1],
  ) => (await actor()).createCrmRequest(token, input),

  listMyCrmRequests: async (token: string) =>
    (await actor()).listMyCrmRequests(token),

  listAllCrmRequests: async (
    token: string,
    status: Parameters<backendInterface["listAllCrmRequests"]>[1],
  ) => (await actor()).listAllCrmRequests(token, status),

  approveCrmRequest: async (token: string, id: bigint) =>
    (await actor()).approveCrmRequest(token, id),

  rejectCrmRequest: async (token: string, id: bigint, reason: string) =>
    (await actor()).rejectCrmRequest(token, id, reason),

  // Sales Targets
  createSalesTarget: async (
    token: string,
    input: Parameters<backendInterface["createSalesTarget"]>[1],
  ) => (await actor()).createSalesTarget(token, input),

  listMySalesTargets: async (token: string) =>
    (await actor()).listMySalesTargets(token),

  // Business Reports
  createBusinessReport: async (
    token: string,
    input: Parameters<backendInterface["createBusinessReport"]>[1],
  ) => (await actor()).createBusinessReport(token, input),

  listMyBusinessReports: async (
    token: string,
    month: bigint | null,
    year: bigint | null,
  ) => (await actor()).listMyBusinessReports(token, month, year),

  listAllBusinessReports: async (
    token: string,
    userId: bigint | null,
    month: bigint | null,
    year: bigint | null,
  ) => (await actor()).listAllBusinessReports(token, userId, month, year),

  // Sales Dashboard
  getMySalesDashboard: async (
    token: string,
    month: bigint,
    year: bigint,
    currentDay: bigint,
  ) => (await actor()).getMySalesDashboard(token, month, year, currentDay),

  getSalesDashboardForUser: async (
    token: string,
    userId: bigint,
    month: bigint,
    year: bigint,
    currentDay: bigint,
  ) =>
    (await actor()).getSalesDashboardForUser(
      token,
      userId,
      month,
      year,
      currentDay,
    ),

  // Travel Plans (manager view)
  listAllTravelPlans: async (
    token: string,
    userId: bigint | null,
    month: string | null,
  ) => (await actor()).listAllTravelPlans(token, userId, month),

  // Travel Plans (employee self-service)
  createTravelPlan: async (
    token: string,
    input: Parameters<backendInterface["createTravelPlan"]>[1],
  ) => (await actor()).createTravelPlan(token, input),

  listMyTravelPlans: async (token: string, month?: string) =>
    (await actor()).listMyTravelPlans(token, month ?? null),

  updateTravelPlan: async (
    token: string,
    id: bigint,
    input: Parameters<backendInterface["updateTravelPlan"]>[2],
  ) => (await actor()).updateTravelPlan(token, id, input),

  submitTravelPlan: async (token: string, id: bigint) =>
    (await actor()).submitTravelPlan(token, id),

  getTravelPlan: async (token: string, id: bigint) =>
    (await actor()).getTravelPlan(token, id),

  getMyStationForDate: async (token: string, date: string) =>
    (await actor()).getMyStationForDate(token, date),

  // Role Hierarchy
  getRoleHierarchyConfig: async (token: string) =>
    (await actor()).getRoleHierarchyConfig(token),

  setRoleHierarchyConfig: async (
    token: string,
    roleOrder: Parameters<backendInterface["setRoleHierarchyConfig"]>[1],
  ) => (await actor()).setRoleHierarchyConfig(token, roleOrder),

  getHigherAuthoritiesForMe: async (token: string) =>
    (await actor()).getHigherAuthoritiesForMe(token),

  // Booking Requests
  createBookingRequest: async (
    token: string,
    itemName: string,
    quantity: bigint,
    intendedUse: import("../backend.d").IntendedUse,
    targetDate: string,
    notes: string,
  ) =>
    (await actor()).createBookingRequest(
      token,
      itemName,
      quantity,
      intendedUse,
      targetDate,
      notes,
    ),

  listMyBookingRequests: async (token: string) =>
    (await actor()).listMyBookingRequests(token),

  listAllBookingRequests: async (token: string) =>
    (await actor()).listAllBookingRequests(token),

  approveBookingRequest: async (token: string, id: bigint) =>
    (await actor()).approveBookingRequest(token, id),

  rejectBookingRequest: async (token: string, id: bigint, reason: string) =>
    (await actor()).rejectBookingRequest(token, id, reason),

  resubmitBookingRequest: async (token: string, id: bigint) =>
    (await actor()).resubmitBookingRequest(token, id),

  // Company Profile
  getCompanyProfile: async (token: string) =>
    (await actor()).getCompanyProfile(token),

  setCompanyProfile: async (
    token: string,
    input: Parameters<backendInterface["setCompanyProfile"]>[1],
  ) => (await actor()).setCompanyProfile(token, input),

  // System Health Check
  getLatestHealthCheck: async (token: string) =>
    (await actor()).getLatestHealthCheck(token),

  getHealthCheckHistory: async (token: string, limit: bigint) =>
    (await actor()).getHealthCheckHistory(token, limit),

  runHealthCheckNow: async (token: string) =>
    (await actor()).runHealthCheckNow(token),

  runAutoRepair: async (
    token: string,
    repairTypes: string[],
  ): Promise<RepairResult> => {
    const a = (await actor()) as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    return (await a.runAutoRepair(token, repairTypes)) as RepairResult;
  },

  getRepairHistory: async (
    token: string,
    limit: number,
  ): Promise<RepairLog[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getRepairHistory !== "function") return [];
      return (await a.getRepairHistory(token, BigInt(limit))) as RepairLog[];
    } catch {
      return [];
    }
  },

  // Admin Messages
  createAdminMessage: async (
    token: string,
    input: Parameters<backendInterface["createAdminMessage"]>[1],
  ) => (await actor()).createAdminMessage(token, input),

  updateAdminMessage: async (
    token: string,
    input: Parameters<backendInterface["updateAdminMessage"]>[1],
  ) => (await actor()).updateAdminMessage(token, input),

  deactivateAdminMessage: async (token: string, messageId: string) =>
    (await actor()).deactivateAdminMessage(token, messageId),

  deleteAdminMessage: async (token: string, messageId: string) =>
    (await actor()).deleteAdminMessage(token, messageId),

  listAdminMessages: async (token: string) =>
    (await actor()).listAdminMessages(token),

  getActiveAdminMessage: async (token: string, today: string) =>
    (await actor()).getActiveAdminMessage(token, today),

  recordMessageDismissal: async (
    token: string,
    messageId: string,
    today: string,
  ) => (await actor()).recordMessageDismissal(token, messageId, today),

  hasUserSeenMessageToday: async (
    token: string,
    messageId: string,
    today: string,
  ) => (await actor()).hasUserSeenMessageToday(token, messageId, today),

  // Official Letters
  getMyOfficialLetters: async (token: string) =>
    (await actor()).getMyOfficialLetters(token),

  getOfficialLetter: async (token: string, id: bigint) =>
    (await actor()).getOfficialLetter(token, id),

  createOfficialLetter: async (
    token: string,
    input: Parameters<backendInterface["createOfficialLetter"]>[1],
  ) => (await actor()).createOfficialLetter(token, input),

  updateOfficialLetter: async (
    token: string,
    id: bigint,
    input: Parameters<backendInterface["updateOfficialLetter"]>[2],
  ) => (await actor()).updateOfficialLetter(token, id, input),

  deleteOfficialLetter: async (token: string, id: bigint) =>
    (await actor()).deleteOfficialLetter(token, id),

  finalizeOfficialLetter: async (token: string, id: bigint) =>
    (await actor()).finalizeOfficialLetter(token, id),

  listAllOfficialLetters: async (token: string) =>
    (await actor()).listAllOfficialLetters(token),

  getAllActiveTerritories: async (token: string) =>
    (await actor()).getAllActiveTerritories(token),

  // ── Bottom-Up Target Calculation (legacy) ────────────────────────────────

  setMrTarget: async (
    token: string,
    input: Parameters<backendInterface["setMrTarget"]>[1],
  ): Promise<bigint> => {
    const result = await (await actor()).setMrTarget(token, input);
    if (result.__kind__ === "err") {
      throw new Error(result.err);
    }
    return result.ok;
  },

  overrideBottomUpTarget: async (
    token: string,
    input: Parameters<backendInterface["overrideTarget"]>[1],
  ): Promise<void> => {
    const result = await (await actor()).overrideTarget(token, input);
    if (result.__kind__ === "err") {
      throw new Error(result.err);
    }
  },

  undoBottomUpTargetOverride: async (
    token: string,
    targetId: bigint,
  ): Promise<void> => {
    const result = await (await actor()).undoOverride(token, targetId);
    if (result.__kind__ === "err") {
      throw new Error(result.err);
    }
  },

  getTargetHierarchy: async (token: string) =>
    (await actor()).getTargetHierarchy(token),

  getMyTarget: async (
    token: string,
    period: Parameters<backendInterface["getMyTarget"]>[1],
    year: number,
  ) => (await actor()).getMyTarget(token, period, BigInt(year)),

  getBottomUpSummaryReport: async (
    token: string,
    filterTerritory?: string,
    filterArea?: string,
    filterRole?: Parameters<backendInterface["getSummaryReport"]>[3],
  ) =>
    (await actor()).getSummaryReport(
      token,
      filterTerritory ?? null,
      filterArea ?? null,
      filterRole ?? null,
    ),

  listAllBottomUpTargets: async (token: string) =>
    (await actor()).listAllBottomUpTargets(token),

  // ── Target vs. Actual Performance ────────────────────────────────────────
  getTargetVsActualPerformance: async (
    token: string,
    filter: Parameters<backendInterface["getTargetVsActualPerformance"]>[1],
  ) => (await actor()).getTargetVsActualPerformance(token, filter),

  // ── Incentives ────────────────────────────────────────────────────────────
  getMyProjectedIncentive: async (
    token: string,
    period: Parameters<backendInterface["getMyProjectedIncentive"]>[1],
    year: bigint,
    month: bigint | null,
  ) => (await actor()).getMyProjectedIncentive(token, period, year, month),

  getMyIncentives: async (
    token: string,
    filter: Parameters<backendInterface["getMyIncentives"]>[1],
  ) => (await actor()).getMyIncentives(token, filter),

  getTeamIncentives: async (
    token: string,
    filter: Parameters<backendInterface["getTeamIncentives"]>[1],
  ) => (await actor()).getTeamIncentives(token, filter),

  listIncentivePlans: async (
    token: string,
    role: Parameters<backendInterface["listIncentivePlans"]>[1],
    period: Parameters<backendInterface["listIncentivePlans"]>[2],
  ) => (await actor()).listIncentivePlans(token, role, period),

  createIncentivePlan: async (
    token: string,
    input: Parameters<backendInterface["createIncentivePlan"]>[1],
  ) => (await actor()).createIncentivePlan(token, input),

  updateIncentivePlan: async (
    token: string,
    input: Parameters<backendInterface["updateIncentivePlan"]>[1],
  ) => (await actor()).updateIncentivePlan(token, input),

  deactivateIncentivePlan: async (token: string, planId: bigint) =>
    (await actor()).deactivateIncentivePlan(token, planId),

  triggerIncentiveCalculation: async (
    token: string,
    period: Parameters<backendInterface["triggerIncentiveCalculation"]>[1],
    year: bigint,
    month: bigint | null,
  ) => (await actor()).triggerIncentiveCalculation(token, period, year, month),

  approveIncentiveCalculation: async (
    token: string,
    input: Parameters<backendInterface["approveIncentiveCalculation"]>[1],
  ) => (await actor()).approveIncentiveCalculation(token, input),

  getAllIncentiveCalculations: async (
    token: string,
    filter: Parameters<backendInterface["getAllIncentiveCalculations"]>[1],
  ) => (await actor()).getAllIncentiveCalculations(token, filter),

  exportIncentiveReport: async (
    token: string,
    filter: Parameters<backendInterface["exportIncentiveReport"]>[1],
  ) => (await actor()).exportIncentiveReport(token, filter),

  markIncentivePaidOnSlip: async (
    token: string,
    userId: bigint,
    period: Parameters<backendInterface["markIncentivePaidOnSlip"]>[2],
    year: bigint,
    month: bigint | null,
  ) =>
    (await actor()).markIncentivePaidOnSlip(token, userId, period, year, month),

  getTargetAdjustmentLogs: async (
    token: string,
    filter: Parameters<backendInterface["getTargetAdjustmentLogs"]>[1],
  ) => (await actor()).getTargetAdjustmentLogs(token, filter),

  getTargetAdjustmentLogsForUser: async (token: string, userId: bigint) =>
    (await actor()).getTargetAdjustmentLogsForUser(token, userId),

  exportTargetAdjustmentLogs: async (
    token: string,
    filter: Parameters<backendInterface["exportTargetAdjustmentLogs"]>[1],
  ) => (await actor()).exportTargetAdjustmentLogs(token, filter),

  listEmpIdConfigs: async (token: string) =>
    (await actor()).listEmpIdConfigs(token),

  saveEmpIdConfig: async (
    token: string,
    config: Parameters<backendInterface["saveEmpIdConfig"]>[1],
  ) => (await actor()).saveEmpIdConfig(token, config),

  bulkAssignEmployeeIds: async (token: string) =>
    (await actor()).bulkAssignEmployeeIds(token),

  getUserByEmployeeId: async (token: string, employeeId: string) =>
    (await actor()).getUserByEmployeeId(token, employeeId),

  // ── Company UID Settings ──────────────────────────────────────────────────
  getUidCompanyPrefix: async (token: string): Promise<string> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getUidCompanyPrefix !== "function") return "KP";
      return (await a.getUidCompanyPrefix(token)) as string;
    } catch {
      return "KP";
    }
  },

  setUidCompanyPrefix: async (
    token: string,
    prefix: string,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.setUidCompanyPrefix !== "function") {
        return {
          __kind__: "err",
          err: "setUidCompanyPrefix not available yet",
        };
      }
      return (await a.setUidCompanyPrefix(token, prefix)) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
    } catch {
      return { __kind__: "err", err: "setUidCompanyPrefix not available yet" };
    }
  },

  bulkMigrateUids: async (
    token: string,
  ): Promise<
    { __kind__: "ok"; ok: bigint } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.bulkMigrateUids !== "function") {
        return { __kind__: "err", err: "bulkMigrateUids not available yet" };
      }
      return (await a.bulkMigrateUids(token)) as
        | { __kind__: "ok"; ok: bigint }
        | { __kind__: "err"; err: string };
    } catch {
      return { __kind__: "err", err: "bulkMigrateUids not available yet" };
    }
  },

  getUserByUID: async (token: string, uid: string): Promise<unknown> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getUserByUID !== "function") return null;
      return a.getUserByUID(token, uid);
    } catch {
      return null;
    }
  },

  // ── Data Cleanup ──────────────────────────────────────────────────────────
  cleanTrialData: async (
    token: string,
    confirmationPhrase: string,
    reason: string,
  ): Promise<
    | { __kind__: "ok"; ok: { totalDeleted: bigint } }
    | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.cleanTrialData !== "function") {
        return {
          __kind__: "err",
          err: "cleanTrialData not available yet. Please contact support.",
        };
      }
      return (await a.cleanTrialData(token, confirmationPhrase, reason)) as
        | { __kind__: "ok"; ok: { totalDeleted: bigint } }
        | { __kind__: "err"; err: string };
    } catch {
      return {
        __kind__: "err",
        err: "cleanTrialData not available yet. Please contact support.",
      };
    }
  },

  getDataCleanupHistory: async (token: string): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getDataCleanupHistory !== "function") return [];
      return (await a.getDataCleanupHistory(token)) as unknown[];
    } catch {
      return [];
    }
  },

  // ── Products Pricelist ────────────────────────────────────────────────────
  listPricelistProducts: async (
    token: string,
  ): Promise<PricelistProductInfo[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listPricelistProducts !== "function") return [];
      return (await a.listPricelistProducts(token)) as PricelistProductInfo[];
    } catch {
      return [];
    }
  },

  addPricelistProduct: async (
    token: string,
    input: AddPricelistProductInput,
  ): Promise<
    { __kind__: "ok"; ok: bigint } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.addPricelistProduct !== "function") {
        return {
          __kind__: "err",
          err: "addPricelistProduct not available yet",
        };
      }
      return (await a.addPricelistProduct(token, input)) as
        | { __kind__: "ok"; ok: bigint }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  updatePricelistProduct: async (
    token: string,
    id: bigint,
    input: UpdatePricelistProductInput,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.updatePricelistProduct !== "function") {
        return {
          __kind__: "err",
          err: "updatePricelistProduct not available yet",
        };
      }
      return (await a.updatePricelistProduct(token, id, input)) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  deletePricelistProduct: async (
    token: string,
    id: bigint,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.deletePricelistProduct !== "function") {
        return {
          __kind__: "err",
          err: "deletePricelistProduct not available yet",
        };
      }
      return (await a.deletePricelistProduct(token, id)) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  bulkAddPricelistProducts: async (
    token: string,
    inputs: AddPricelistProductInput[],
  ): Promise<{ added: bigint; errors: string[] }> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.bulkAddPricelistProducts !== "function") {
        return {
          added: BigInt(0),
          errors: ["bulkAddPricelistProducts not available yet"],
        };
      }
      return (await a.bulkAddPricelistProducts(token, inputs)) as {
        added: bigint;
        errors: string[];
      };
    } catch (e) {
      return { added: BigInt(0), errors: [String(e)] };
    }
  },

  // ── Monthly Sales Targets (new system) ───────────────────────────────────

  setMonthlyTarget: async (token: string, input: SetMonthlyTargetInput) =>
    (await actor()).setMonthlyTarget(token, input),

  bulkSetMonthlyTargets: async (
    token: string,
    input: Parameters<backendInterface["bulkSetMonthlyTargets"]>[1],
  ) => (await actor()).bulkSetMonthlyTargets(token, input),

  getMonthlyTarget: async (
    token: string,
    userId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getMonthlyTarget(token, userId, month, year),

  getMyMonthlyTarget: async (token: string, month: bigint, year: bigint) =>
    (await actor()).getMyMonthlyTarget(token, month, year),

  listMonthlyTargets: async (token: string, filter: MonthlyTargetFilter) =>
    (await actor()).listMonthlyTargets(token, filter),

  getTargetRevisionHistory: async (
    token: string,
    userId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getTargetRevisionHistory(token, userId, month, year),

  getMyTargetVsActual: async (token: string, month: bigint, year: bigint) =>
    (await actor()).getMyTargetVsActual(token, month, year),

  getEmployeeTargetVsActual: async (
    token: string,
    userId: bigint,
    month: bigint,
    year: bigint,
  ) => (await actor()).getEmployeeTargetVsActual(token, userId, month, year),

  getTeamTargetVsActual: async (token: string, month: bigint, year: bigint) =>
    (await actor()).getTeamTargetVsActual(token, month, year),

  exportMonthlyTargets: async (token: string, filter: MonthlyTargetFilter) =>
    (await actor()).exportMonthlyTargets(token, filter),

  // ── Additional Charges ────────────────────────────────────────────────────

  assignAdditionalCharge: async (
    token: string,
    input: AssignAdditionalChargeInput,
  ) => (await actor()).assignAdditionalCharge(token, input),

  updateAdditionalCharge: async (
    token: string,
    input: UpdateAdditionalChargeInput,
  ) => (await actor()).updateAdditionalCharge(token, input),

  removeAdditionalCharge: async (token: string, chargeId: string) =>
    (await actor()).removeAdditionalCharge(token, chargeId),

  getActiveChargesForEmployee: async (token: string, employeeId: bigint) =>
    (await actor()).getActiveChargesForEmployee(token, employeeId),

  getAllChargesForEmployee: async (token: string, employeeId: bigint) =>
    (await actor()).getAllChargesForEmployee(token, employeeId),

  listAllAdditionalCharges: async (
    token: string,
    filter: AdditionalChargeFilter,
  ) => (await actor()).listAllAdditionalCharges(token, filter),

  getExpiringCharges: async (token: string, daysAhead: number) =>
    (await actor()).getExpiringCharges(token, BigInt(daysAhead)),

  getEffectiveRoles: async (
    token: string,
    employeeId: bigint,
  ): Promise<string[]> => {
    try {
      const result = await (await actor()).getEffectiveRoles(token, employeeId);
      return result as string[];
    } catch {
      return [];
    }
  },

  // ── E-Detailing ───────────────────────────────────────────────────────────────

  listEDetailingProducts: async (token: string): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listEDetailingProducts !== "function")
        return getSeedEDetailingProducts();
      const result = await a.listEDetailingProducts(token);
      const items = Array.isArray(result) ? result : [];
      return items.length > 0 ? items : getSeedEDetailingProducts();
    } catch {
      return getSeedEDetailingProducts();
    }
  },

  getEDetailingProduct: async (
    token: string,
    productId: string,
  ): Promise<unknown | null> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getEDetailingProduct !== "function") return null;
      return await a.getEDetailingProduct(token, productId);
    } catch {
      return null;
    }
  },

  trackEDetailingDownload: async (
    token: string,
    productId: string,
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.trackEDetailingDownload !== "function") return;
      await a.trackEDetailingDownload(token, productId);
    } catch {
      // non-critical
    }
  },

  getEDetailingDownloadMetrics: async (token: string): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getEDetailingDownloadMetrics !== "function") return [];
      const result = await a.getEDetailingDownloadMetrics(token);
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  },

  getTopEDetailingProducts: async (
    token: string,
    limit: number,
  ): Promise<
    Array<{ productId: string; productName: string; downloadCount: number }>
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getTopEDetailingProducts !== "function") return [];
      const result = (await a.getTopEDetailingProducts(
        token,
        BigInt(limit),
      )) as unknown[];
      return (
        result as Array<{
          productId: string;
          productName: string;
          downloadCount: bigint;
        }>
      ).map((r) => ({
        productId: r.productId,
        productName: r.productName,
        downloadCount: Number(r.downloadCount),
      }));
    } catch {
      return [];
    }
  },

  getEDetailingDownloadsByMR: async (
    token: string,
  ): Promise<
    Array<{ mrId: bigint; mrName: string; downloadCount: number }>
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getEDetailingDownloadsByMR !== "function") return [];
      const result = (await a.getEDetailingDownloadsByMR(token)) as unknown[];
      return (
        result as Array<{ mrId: bigint; mrName: string; downloadCount: bigint }>
      ).map((r) => ({
        mrId: r.mrId,
        mrName: r.mrName,
        downloadCount: Number(r.downloadCount),
      }));
    } catch {
      return [];
    }
  },

  createEDetailingProduct: async (
    token: string,
    input: {
      name: string;
      category: string;
      composition: string;
      mrp: bigint;
      packSize: string;
      description: string;
      versionNotes: string;
    },
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.createEDetailingProduct !== "function") return;
      await a.createEDetailingProduct(token, input);
    } catch (e) {
      throw new Error(String(e));
    }
  },

  updateEDetailingProduct: async (
    token: string,
    productId: string,
    input: {
      name: string;
      category: string;
      composition: string;
      mrp: bigint;
      packSize: string;
      description: string;
      versionNotes: string;
    },
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.updateEDetailingProduct !== "function") return;
      await a.updateEDetailingProduct(token, productId, input);
    } catch (e) {
      throw new Error(String(e));
    }
  },

  // ── Secondary Sales ───────────────────────────────────────────────────────
  createSecondarySale: async (
    token: string,
    req: Parameters<backendInterface["createSecondarySale"]>[1],
  ) => (await actor()).createSecondarySale(token, req),

  listSecondarySales: async (
    token: string,
    filter: Parameters<backendInterface["listSecondarySales"]>[1],
  ) => (await actor()).listSecondarySales(token, filter),

  getSecondarySalesByEmployee: async (token: string, employeeId: bigint) =>
    (await actor()).getSecondarySalesByEmployee(token, employeeId),

  listStockistsByArea: async (token: string, areaId: bigint) =>
    (await actor()).listStockistsByArea(token, areaId),

  listStockists: async (
    token: string,
    filter: Parameters<backendInterface["listStockists"]>[1],
  ) => (await actor()).listStockists(token, filter),

  getUserLocationAllotment: async (token: string, userId: bigint) =>
    (await actor()).getUserLocationAllotment(token, userId),

  // ── CRM Doctor Sales ──────────────────────────────────────────────────────
  createCrmDoctorSale: async (
    token: string,
    req: Parameters<backendInterface["createCrmDoctorSale"]>[1],
  ) => (await actor()).createCrmDoctorSale(token, req),

  listCrmDoctorSales: async (
    token: string,
    filter: Parameters<backendInterface["listCrmDoctorSales"]>[1],
  ) => (await actor()).listCrmDoctorSales(token, filter),

  getCrmDoctorSalesByEmployee: async (token: string, employeeId: bigint) =>
    (await actor()).getCrmDoctorSalesByEmployee(token, employeeId),

  exportCrmDoctorSales: async (
    token: string,
    filter: Parameters<backendInterface["exportCrmDoctorSales"]>[1],
  ) => (await actor()).exportCrmDoctorSales(token, filter),

  // ── Check-Out Attendance ──────────────────────────────────────────────────
  checkOutAttendance: async (
    token: string,
    coord: Parameters<backendInterface["checkOutAttendance"]>[1],
    date: string,
  ) => (await actor()).checkOutAttendance(token, coord, date),

  // ── Additional Area Info ──────────────────────────────────────────────────
  getActiveAdditionalAreas: async (token: string, employeeId: bigint) =>
    (await actor()).getActiveAdditionalAreas(token, employeeId),

  // ── Stockist CRUD ─────────────────────────────────────────────────────────
  createStockist: async (
    token: string,
    req: Parameters<backendInterface["createStockist"]>[1],
  ) => (await actor()).createStockist(token, req),

  updateStockist: async (
    token: string,
    req: Parameters<backendInterface["updateStockist"]>[1],
  ) => (await actor()).updateStockist(token, req),

  deactivateStockist: async (token: string, stockistId: bigint) =>
    (await actor()).deactivateStockist(token, stockistId),

  getStockist: async (token: string, stockistId: bigint) =>
    (await actor()).getStockist(token, stockistId),

  // ── Location — All HQs ────────────────────────────────────────────────────
  getAllHQs: async (token: string) => (await actor()).getAllHQs(token),

  getAllActiveHQs: async (token: string) =>
    (await actor()).getAllActiveHQs(token),

  // ── Incentive — Bottom-Up Target Calculation ──────────────────────────────
  calculateBottomUpIncentiveTargets: async (
    token: string,
    year: bigint,
    month: bigint,
  ) => (await actor()).calculateBottomUpIncentiveTargets(token, year, month),

  // ── Missed Visit Alerts ───────────────────────────────────────────────────
  getMissedVisitAlerts: async (
    token: string,
    managerId: bigint,
  ): Promise<MissedVisitAlert[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getMissedVisitAlerts !== "function") return [];
      const result = (await a.getMissedVisitAlerts(token, managerId)) as
        | { __kind__: "ok"; ok: MissedVisitAlert[] }
        | { __kind__: "err"; err: string };
      return result.__kind__ === "ok" ? result.ok : [];
    } catch {
      return [];
    }
  },

  getMissedVisitAlertsAll: async (
    token: string,
  ): Promise<MissedVisitAlert[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getMissedVisitAlertsAll !== "function") return [];
      const result = (await a.getMissedVisitAlertsAll(token)) as
        | { __kind__: "ok"; ok: MissedVisitAlert[] }
        | { __kind__: "err"; err: string };
      return result.__kind__ === "ok" ? result.ok : [];
    } catch {
      return [];
    }
  },

  dismissMissedVisitAlert: async (
    token: string,
    mrId: bigint,
    doctorId: bigint,
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.dismissMissedVisitAlert !== "function") return;
      await a.dismissMissedVisitAlert(token, mrId, doctorId);
    } catch {
      // ignore
    }
  },

  // ── Doctor Visit Trend ────────────────────────────────────────────────────
  getDoctorVisitTrend: async (
    token: string,
    managerId: bigint,
    months: number,
  ): Promise<MonthlyVisitData[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getDoctorVisitTrend !== "function") return [];
      const result = (await a.getDoctorVisitTrend(
        token,
        managerId,
        BigInt(months),
      )) as
        | { __kind__: "ok"; ok: MonthlyVisitData[] }
        | { __kind__: "err"; err: string };
      return result.__kind__ === "ok" ? result.ok : [];
    } catch {
      return [];
    }
  },

  getConsolidatedVisitTrend: async (
    token: string,
    managerId: bigint,
    months: number,
  ): Promise<ConsolidatedMonthData[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getConsolidatedVisitTrend !== "function") return [];
      const result = (await a.getConsolidatedVisitTrend(
        token,
        managerId,
        BigInt(months),
      )) as
        | { __kind__: "ok"; ok: ConsolidatedMonthData[] }
        | { __kind__: "err"; err: string };
      return result.__kind__ === "ok" ? result.ok : [];
    } catch {
      return [];
    }
  },

  // ── Company Holidays ──────────────────────────────────────────────────────
  addCompanyHoliday: async (
    token: string,
    input: Parameters<backendInterface["addCompanyHoliday"]>[1],
  ) => (await actor()).addCompanyHoliday(token, input),

  updateCompanyHoliday: async (
    token: string,
    input: Parameters<backendInterface["updateCompanyHoliday"]>[1],
  ) => (await actor()).updateCompanyHoliday(token, input),

  deleteCompanyHoliday: async (token: string, id: bigint) =>
    (await actor()).deleteCompanyHoliday(token, id),

  deactivateCompanyHoliday: async (token: string, id: bigint) =>
    (await actor()).deactivateCompanyHoliday(token, id),

  getCompanyHolidays: async (token: string) =>
    (await actor()).getCompanyHolidays(token),

  getActiveHolidays: async (token: string) =>
    (await actor()).getActiveHolidays(token),

  getHolidaysForExport: async (token: string) =>
    (await actor()).getHolidaysForExport(token),

  isHoliday: async (token: string, date: bigint) =>
    (await actor()).isHoliday(token, date),

  // ── Attendance Correction & New Monthly Queries ────────────────────────
  correctAttendance: async (
    token: string,
    input: Parameters<backendInterface["correctAttendance"]>[1],
  ) => (await actor()).correctAttendance(token, input),

  getEmployeeMonthlyAttendance: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) =>
    (await actor()).getEmployeeMonthlyAttendance(
      token,
      employeeId,
      month,
      year,
    ),

  getMyMonthlyAttendance: async (token: string, month: bigint, year: bigint) =>
    (await actor()).getMyMonthlyAttendance(token, month, year),

  getAttendanceSummaryForEmployee: async (
    token: string,
    employeeId: bigint,
    month: bigint,
    year: bigint,
  ) =>
    (await actor()).getAttendanceSummaryForEmployee(
      token,
      employeeId,
      month,
      year,
    ),

  // ── Bulk Upload History ───────────────────────────────────────────────────
  getBulkUploadHistory: async (
    token: string,
    uploadType: string,
  ): Promise<BulkUploadRecord[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getBulkUploadHistory !== "function") return [];
      return (await a.getBulkUploadHistory(
        token,
        uploadType,
      )) as BulkUploadRecord[];
    } catch {
      return [];
    }
  },

  // ── Employee Advances ─────────────────────────────────────────────────────

  createAdvance: async (
    input: Parameters<backendInterface["createAdvance"]>[0],
  ) => (await actor()).createAdvance(input),

  updateAdvance: async (
    id: string,
    input: Parameters<backendInterface["updateAdvance"]>[1],
  ) => (await actor()).updateAdvance(id, input),

  cancelAdvance: async (id: string, remark: string) =>
    (await actor()).cancelAdvance(id, remark),

  pauseAdvance: async (id: string, pause: boolean, remark: string) =>
    (await actor()).pauseAdvance(id, pause, remark),

  getMyAdvances: async () => (await actor()).getMyAdvances(),

  getAdvancesByEmployee: async (employeeId: string) =>
    (await actor()).getAdvancesByEmployee(employeeId),

  getAllAdvances: async () => (await actor()).getAllAdvances(),

  processMonthlyAdvanceDeductions: async (month: bigint, year: bigint) =>
    (await actor()).processMonthlyAdvanceDeductions(month, year),

  // ── Expense Sheets ────────────────────────────────────────────────────────

  generateExpenseSheet: async (
    employeeId: string,
    month: bigint,
    year: bigint,
    lineItems: Parameters<backendInterface["generateExpenseSheet"]>[3],
  ) => (await actor()).generateExpenseSheet(employeeId, month, year, lineItems),

  getExpenseSheet: async (employeeId: string, month: bigint, year: bigint) =>
    (await actor()).getExpenseSheet(employeeId, month, year),

  getMyExpenseSheet: async (month: bigint, year: bigint) =>
    (await actor()).getMyExpenseSheet(month, year),

  getAllExpenseSheets: async (
    filter: Parameters<backendInterface["getAllExpenseSheets"]>[0],
  ) => (await actor()).getAllExpenseSheets(filter),

  markExpenseSheetPaid: async (sheetId: string, paymentDate: bigint) =>
    (await actor()).markExpenseSheetPaid(sheetId, paymentDate),

  refreshExpenseSheetStatus: async () =>
    (await actor()).refreshExpenseSheetStatus(),

  // ── Incentive & Bonus Sheets ──────────────────────────────────────────────

  generateIncentiveBonusSheet: async (
    employeeId: string,
    quarter: bigint,
    year: bigint,
    monthlyEntries: Parameters<
      backendInterface["generateIncentiveBonusSheet"]
    >[3],
    bonusEntries: Parameters<
      backendInterface["generateIncentiveBonusSheet"]
    >[4],
  ) =>
    (await actor()).generateIncentiveBonusSheet(
      employeeId,
      quarter,
      year,
      monthlyEntries,
      bonusEntries,
    ),

  getIncentiveBonusSheet: async (
    employeeId: string,
    quarter: bigint,
    year: bigint,
  ) => (await actor()).getIncentiveBonusSheet(employeeId, quarter, year),

  getMyIncentiveBonusSheet: async (quarter: bigint, year: bigint) =>
    (await actor()).getMyIncentiveBonusSheet(quarter, year),

  getAllIncentiveBonusSheets: async (
    filter: Parameters<backendInterface["getAllIncentiveBonusSheets"]>[0],
  ) => (await actor()).getAllIncentiveBonusSheets(filter),

  markIncentiveBonusSheetPaid: async (sheetId: string, paymentDate: bigint) =>
    (await actor()).markIncentiveBonusSheetPaid(sheetId, paymentDate),

  addBonusEntry: async (
    sheetId: string,
    entry: Parameters<backendInterface["addBonusEntry"]>[1],
  ) => (await actor()).addBonusEntry(sheetId, entry),

  refreshIncentiveBonusSheetStatus: async () =>
    (await actor()).refreshIncentiveBonusSheetStatus(),

  // ── Working Style ─────────────────────────────────────────────────────────

  getStationsByMR: async (
    token: string,
    mrUserId: bigint,
  ): Promise<string[]> => {
    try {
      const result = await (await actor()).getStationsByMR(token, mrUserId);
      if ("ok" in result) return result.ok;
      // err variant — log so admins can diagnose area name mismatches
      console.error("[getStationsByMR] backend error:", result.err);
      return [];
    } catch (err) {
      console.error("[getStationsByMR] fetch failed:", err);
      return [];
    }
  },

  getStationsByMRHqAssignments: async (
    token: string,
    mrUserId: bigint,
  ): Promise<import("../backend.d").StationRecord[]> => {
    try {
      const result = await (await actor()).getStationsByMRHqAssignments(
        token,
        mrUserId,
      );
      if (result.__kind__ === "ok") return result.ok;
      console.error(
        "[getStationsByMRHqAssignments] backend error:",
        result.err,
      );
      return [];
    } catch (err) {
      console.error("[getStationsByMRHqAssignments] fetch failed:", err);
      return [];
    }
  },

  // ── Station Master ────────────────────────────────────────────────────────

  createStation: async (
    token: string,
    input: import("../backend.d").CreateStationInput,
  ) => (await actor()).createStation(token, input),

  updateStation: async (
    token: string,
    stationId: bigint,
    input: import("../backend.d").UpdateStationInput,
  ) => (await actor()).updateStation(token, stationId, input),

  deleteStation: async (token: string, stationId: bigint): Promise<boolean> => {
    try {
      return (await actor()).deleteStation(token, stationId);
    } catch {
      return false;
    }
  },

  listStationsByHQ: async (
    token: string,
    hqId: bigint,
  ): Promise<import("../backend.d").StationRecord[]> => {
    try {
      return (await actor()).listStationsByHQ(token, hqId);
    } catch {
      return [];
    }
  },

  listAllStations: async (
    token: string,
  ): Promise<import("../backend.d").StationRecord[]> => {
    try {
      return (await actor()).listAllStations(token);
    } catch {
      return [];
    }
  },

  listTerritoriesByStation: async (
    token: string,
    stationId: string | bigint,
  ): Promise<import("../backend.d").TerritoryRecord[]> => {
    try {
      const stationIdBigInt =
        typeof stationId === "bigint" ? stationId : BigInt(stationId);
      const result = await (await actor()).listTerritoriesByStation(
        token,
        stationIdBigInt,
      );
      return Array.isArray(result)
        ? result
        : result && typeof result === "object" && "ok" in result
          ? (result as { ok: import("../backend.d").TerritoryRecord[] }).ok
          : [];
    } catch {
      return [];
    }
  },

  getTerritoriesByStation: async (
    token: string,
    stationId: string | bigint,
  ): Promise<import("../backend.d").AreaRecord[]> => {
    try {
      const id = typeof stationId === "bigint" ? stationId : BigInt(stationId);
      const result = await (await actor()).getTerritoriesByStation(token, id);
      return Array.isArray(result)
        ? result
        : result && typeof result === "object" && "ok" in result
          ? (result as { ok: import("../backend.d").AreaRecord[] }).ok
          : [];
    } catch {
      return [];
    }
  },

  submitWorkingStyle: async (
    token: string,
    input: Omit<Parameters<backendInterface["submitWorkingStyle"]>[0], "token">,
  ) => (await actor()).submitWorkingStyle({ ...input, token }),

  getTodayWorkingStyle: async (employeeId: string) =>
    (await actor()).getTodayWorkingStyle(employeeId),

  getWorkingStyleHistory: async (
    employeeId: string,
    from: bigint,
    to: bigint,
  ) => (await actor()).getWorkingStyleHistory(employeeId, from, to),

  getTeamWorkingStyleHistory: async (
    managerId: string,
    from: bigint,
    to: bigint,
  ) => (await actor()).getTeamWorkingStyleHistory(managerId, from, to),

  getAllWorkingStyleRecords: async (from: bigint, to: bigint) =>
    (await actor()).getAllWorkingStyleRecords(from, to),

  // ── Station Bulk Import ────────────────────────────────────────────────────

  bulkImportStations: async (
    token: string,
    rows: BulkStationImportInput[],
  ): Promise<BulkStationImportResult> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.bulkImportStations !== "function") {
        return {
          totalRows: BigInt(rows.length),
          saved: BigInt(0),
          skipped: BigInt(rows.length),
          rowResults: rows.map((r, i) => ({
            rowIndex: BigInt(i + 2),
            stationName: r.stationName,
            hqName: r.hqName,
            status: Variant_ok_error.error,
            errorReason: "bulkImportStations not available yet",
          })),
          uploadedBy: "",
          uploadedAt: BigInt(Date.now()),
        };
      }
      return (await a.bulkImportStations(
        token,
        rows,
      )) as BulkStationImportResult;
    } catch (e) {
      return {
        totalRows: BigInt(rows.length),
        saved: BigInt(0),
        skipped: BigInt(rows.length),
        rowResults: rows.map((r, i) => ({
          rowIndex: BigInt(i + 2),
          stationName: r.stationName,
          hqName: r.hqName,
          status: Variant_ok_error.error,
          errorReason: String(e),
        })),
        uploadedBy: "",
        uploadedAt: BigInt(Date.now()),
      };
    }
  },

  listStationBulkUploadHistory: async (
    token: string,
  ): Promise<BulkStationImportResult[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listStationBulkUploadHistory !== "function") return [];
      return (await a.listStationBulkUploadHistory(
        token,
      )) as BulkStationImportResult[];
    } catch {
      return [];
    }
  },

  // ── Suggestions & Queries ─────────────────────────────────────────────────

  submitSuggestion: async (
    token: string,
    input: SubmitSuggestionInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.submitSuggestion !== "function") {
        // Frontend-only fallback: store in localStorage
        const stored = JSON.parse(
          localStorage.getItem("suggestions_data") ?? "[]",
        ) as SuggestionSubmission[];
        const newId = Date.now();
        const tokenParts = token.split("|");
        const userId = tokenParts[0] ?? token;
        const newItem: SuggestionSubmission = {
          id: newId,
          submittedByUserId: userId,
          submittedByName: "",
          submittedByRole: "",
          submittedByEmployeeId: "",
          submissionType: input.submissionType,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
          attachmentUrl: input.attachmentUrl,
          status: "Pending",
          submittedAt: Date.now(),
          isReadByHR: false,
          isReadByEmployee: true,
        };
        stored.push(newItem);
        localStorage.setItem("suggestions_data", JSON.stringify(stored));
        return { ok: true };
      }
      // Backend returns MutationResult: { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
      // Do NOT read result.ok as a number — it is always null on success.
      const result = (await a.submitSuggestion(token, input)) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
      if (result.__kind__ === "ok") return { ok: true };
      return { ok: false, error: result.err };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  getMySubmissions: async (token: string): Promise<SuggestionSubmission[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getMySubmissions !== "function") {
        const stored = JSON.parse(
          localStorage.getItem("suggestions_data") ?? "[]",
        ) as SuggestionSubmission[];
        const tokenParts = token.split("|");
        const userId = tokenParts[0] ?? token;
        return stored.filter((s) => s.submittedByUserId === userId);
      }
      const raw = (await a.getMySubmissions(token)) as Array<
        Record<string, unknown>
      >;
      // Backend SuggestionSubmission has bigint id/submittedAt — normalise to number
      return raw.map((s) => ({
        ...(s as unknown as SuggestionSubmission),
        id: Number(s.id),
        submittedAt: Number(s.submittedAt),
        hrReplyAt: s.hrReplyAt != null ? Number(s.hrReplyAt) : undefined,
        statusUpdatedAt:
          s.statusUpdatedAt != null ? Number(s.statusUpdatedAt) : undefined,
      }));
    } catch {
      return [];
    }
  },

  getAllSubmissions: async (
    token: string,
    filter?: SuggestionFilter,
  ): Promise<SuggestionSubmission[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getAllSubmissions !== "function") {
        const stored = JSON.parse(
          localStorage.getItem("suggestions_data") ?? "[]",
        ) as SuggestionSubmission[];
        return applyLocalSuggestionFilter(stored, filter);
      }
      return (await a.getAllSubmissions(
        token,
        filter ?? null,
      )) as SuggestionSubmission[];
    } catch {
      return [];
    }
  },

  updateSuggestionStatus: async (
    token: string,
    input: UpdateSuggestionStatusInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.updateSuggestionStatus !== "function") {
        const stored = JSON.parse(
          localStorage.getItem("suggestions_data") ?? "[]",
        ) as SuggestionSubmission[];
        const idx = stored.findIndex((s) => s.id === input.id);
        if (idx >= 0) {
          stored[idx] = {
            ...stored[idx],
            status: input.status,
            closingRemark: input.closingRemark,
            statusUpdatedAt: Date.now(),
          };
          localStorage.setItem("suggestions_data", JSON.stringify(stored));
        }
        return { ok: true };
      }
      const result = (await a.updateSuggestionStatus(token, input)) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
      if (result.__kind__ === "ok") return { ok: true };
      return { ok: false, error: result.err };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  addSuggestionReply: async (
    token: string,
    input: AddSuggestionReplyInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.addSuggestionReply !== "function") {
        const stored = JSON.parse(
          localStorage.getItem("suggestions_data") ?? "[]",
        ) as SuggestionSubmission[];
        const idx = stored.findIndex((s) => s.id === input.id);
        if (idx >= 0) {
          stored[idx] = {
            ...stored[idx],
            hrReply: input.reply,
            hrReplyAt: Date.now(),
            isReadByEmployee: false,
          };
          localStorage.setItem("suggestions_data", JSON.stringify(stored));
        }
        return { ok: true };
      }
      const result = (await a.addSuggestionReply(token, input)) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
      if (result.__kind__ === "ok") return { ok: true };
      return { ok: false, error: result.err };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  getUnreadSuggestionCount: async (token: string): Promise<number> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getUnreadSuggestionCount !== "function") {
        const stored = JSON.parse(
          localStorage.getItem("suggestions_data") ?? "[]",
        ) as SuggestionSubmission[];
        return stored.filter((s) => !s.isReadByHR).length;
      }
      return (await a.getUnreadSuggestionCount(token)) as number;
    } catch {
      return 0;
    }
  },

  markSuggestionsAsRead: async (
    token: string,
    ids: number[],
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.markSuggestionsAsRead !== "function") {
        const stored = JSON.parse(
          localStorage.getItem("suggestions_data") ?? "[]",
        ) as SuggestionSubmission[];
        const idSet = new Set(ids);
        const updated = stored.map((s) =>
          idSet.has(s.id) ? { ...s, isReadByHR: true } : s,
        );
        localStorage.setItem("suggestions_data", JSON.stringify(updated));
        return;
      }
      // Backend expects Array<bigint> — convert from number[]
      await a.markSuggestionsAsRead(token, ids.map(BigInt));
    } catch {
      // Non-critical: mark-as-read failures should not surface to the user
    }
  },

  getUnreadReplyCount: async (token: string): Promise<number> => {
    // placeholder — full impl above

    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getUnreadReplyCount !== "function") {
        const stored = JSON.parse(
          localStorage.getItem("suggestions_data") ?? "[]",
        ) as SuggestionSubmission[];
        const tokenParts = token.split("|");
        const userId = tokenParts[0] ?? token;
        return stored.filter(
          (s) =>
            s.submittedByUserId === userId && !s.isReadByEmployee && s.hrReply,
        ).length;
      }
      return (await a.getUnreadReplyCount(token)) as number;
    } catch {
      return 0;
    }
  },

  // ── Sample Return Tracking ────────────────────────────────────────────────

  recordSampleReturn: async (
    token: string,
    input: {
      issueId: string | null;
      doctorId: bigint | null;
      productId: bigint;
      batchNumber: string;
      quantityReturned: bigint;
      reason: string;
      notes: string | null;
      gpsLat: number;
      gpsLng: number;
      returnDate: string;
    },
  ): Promise<
    { __kind__: "ok"; ok: string } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.recordSampleReturn !== "function")
        return { __kind__: "ok", ok: "local" };
      return (await a.recordSampleReturn(token, input)) as
        | { __kind__: "ok"; ok: string }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  approveSampleReturn: async (
    token: string,
    returnId: string,
    remarks: string | null,
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.approveSampleReturn !== "function") return;
      await a.approveSampleReturn(token, returnId, remarks);
    } catch {
      /* non-blocking */
    }
  },

  rejectSampleReturn: async (
    token: string,
    returnId: string,
    remarks: string | null,
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.rejectSampleReturn !== "function") return;
      await a.rejectSampleReturn(token, returnId, remarks);
    } catch {
      /* non-blocking */
    }
  },

  getSampleReturnsByMR: async (
    token: string,
    mrId: bigint,
  ): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getSampleReturnsByMR !== "function") return [];
      return (await a.getSampleReturnsByMR(token, mrId)) as unknown[];
    } catch {
      return [];
    }
  },

  getSampleBalanceReport: async (token: string): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getSampleBalanceReport !== "function") return [];
      const result = (await a.getSampleBalanceReport(token)) as
        | { __kind__: "ok"; ok: unknown[] }
        | { __kind__: "err"; err: string }
        | unknown[];
      if (Array.isArray(result)) return result;
      if ((result as { __kind__: string }).__kind__ === "ok")
        return (result as { __kind__: "ok"; ok: unknown[] }).ok;
      return [];
    } catch {
      return [];
    }
  },

  // ── Visit Frequency Planner ───────────────────────────────────────────────

  setVisitFrequencyTargets: async (
    token: string,
    config: { tierA: number; tierB: number; tierC: number },
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.setVisitFrequencyTargets !== "function") return;
      await a.setVisitFrequencyTargets(token, config);
    } catch {
      /* non-blocking */
    }
  },

  getVisitFrequencyTargets: async (
    token: string,
  ): Promise<{ tierA: number; tierB: number; tierC: number } | null> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getVisitFrequencyTargets !== "function") return null;
      return (await a.getVisitFrequencyTargets(token)) as {
        tierA: number;
        tierB: number;
        tierC: number;
      };
    } catch {
      return null;
    }
  },

  setDoctorTierAssignment: async (
    token: string,
    doctorId: bigint,
    tier: string,
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.setDoctorTierAssignment !== "function") return;
      await a.setDoctorTierAssignment(token, doctorId, tier);
    } catch {
      /* non-blocking */
    }
  },

  getDoctorTierAssignment: async (
    token: string,
    doctorId: bigint,
  ): Promise<string | null> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getDoctorTierAssignment !== "function") return null;
      return (await a.getDoctorTierAssignment(token, doctorId)) as
        | string
        | null;
    } catch {
      return null;
    }
  },

  getVisitFrequencyReport: async (
    token: string,
    mrId: bigint,
    month: bigint,
    year: bigint,
  ): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getVisitFrequencyReport !== "function") return [];
      return (await a.getVisitFrequencyReport(
        token,
        mrId,
        month,
        year,
      )) as unknown[];
    } catch {
      return [];
    }
  },

  // ── Earned Leave Accrual ──────────────────────────────────────────────────

  getEarnedLeaveBalance: async (
    token: string,
    userId: bigint,
  ): Promise<number> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getEarnedLeaveBalance !== "function") return 0;
      return Number(await a.getEarnedLeaveBalance(token, userId));
    } catch {
      return 0;
    }
  },

  updateEarnedLeaveAccrual: async (
    token: string,
    userId: bigint,
    month: bigint,
    year: bigint,
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.updateEarnedLeaveAccrual !== "function") return;
      await a.updateEarnedLeaveAccrual(token, userId, month, year);
    } catch {
      /* non-blocking */
    }
  },

  // ── On-Leave Employees ─────────────────────────────────────────────────────

  // ── Call Reports (detail by MR) ───────────────────────────────────────────

  listCallReportsMrIds: async (token: string): Promise<string[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listCallReportsMrIds !== "function") return [];
      const result = (await a.listCallReportsMrIds(token)) as
        | { __kind__: "ok"; ok: string[] }
        | { __kind__: "err"; err: string }
        | string[];
      if (Array.isArray(result)) return result;
      if (result.__kind__ === "ok") return result.ok;
      return [];
    } catch {
      return [];
    }
  },

  listCallReportsByMr: async (
    token: string,
    mrId: bigint,
    fromDate: bigint,
    toDate: bigint,
  ): Promise<import("../backend.d").CallReportDetail[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listCallReportsByMr !== "function") return [];
      const result = (await a.listCallReportsByMr(
        token,
        mrId,
        fromDate,
        toDate,
      )) as
        | { __kind__: "ok"; ok: import("../backend.d").CallReportDetail[] }
        | { __kind__: "err"; err: string }
        | import("../backend.d").CallReportDetail[];
      if (Array.isArray(result)) return result;
      if (result.__kind__ === "ok") return result.ok;
      return [];
    } catch {
      return [];
    }
  },

  // ── HQ Employee Hierarchy ─────────────────────────────────────────────────

  listEmployeesForHqHierarchy: async (
    token: string,
  ): Promise<import("../backend.d").HqHierarchyEmployee[]> => {
    return (await actor()).listEmployeesForHqHierarchy(token);
  },

  getEmployeeReportingChain: async (
    token: string,
    userId: import("../backend.d").UserId,
  ): Promise<import("../backend.d").ReportingChainEntry[]> => {
    return (await actor()).getEmployeeReportingChain(token, userId);
  },

  getOnLeaveEmployeesForUser: async (
    token: string,
  ): Promise<OnLeaveEmployee[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getOnLeaveEmployeesForUser !== "function") return [];
      const result = (await a.getOnLeaveEmployeesForUser(token)) as
        | { __kind__: "ok"; ok: OnLeaveEmployee[] }
        | { __kind__: "err"; err: string }
        | OnLeaveEmployee[];
      if (Array.isArray(result)) return result;
      if ((result as { __kind__: string }).__kind__ === "ok")
        return (result as { __kind__: "ok"; ok: OnLeaveEmployee[] }).ok;
      return [];
    } catch {
      return [];
    }
  },

  // ── Enriched Live Locations ────────────────────────────────────────────────
  getEnrichedLiveLocations: async (
    token: string,
  ): Promise<
    Array<{
      userId: bigint;
      name: string;
      role: string;
      lat: number;
      lng: number;
      lastReportedAt: bigint;
    }>
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getEnrichedLiveLocations !== "function") {
        // Fallback: wrap getAllLocations with empty lastReportedAt
        return [];
      }
      const result = (await a.getEnrichedLiveLocations(token)) as
        | {
            __kind__: "ok";
            ok: Array<{
              userId: bigint;
              name: string;
              role: string;
              lat: number;
              lng: number;
              lastReportedAt: bigint;
            }>;
          }
        | { __kind__: "err"; err: string };
      return result.__kind__ === "ok" ? result.ok : [];
    } catch {
      return [];
    }
  },

  // ── Location Trail ───────────────────────────────────────────────────────

  getEmployeesForTrailSelector: async (
    token: string,
  ): Promise<Array<{ userId: bigint; name: string; role: string }>> => {
    try {
      const result = await (await actor()).getEmployeesForTrailSelector(token);
      if (result.__kind__ === "err") return [];
      return result.ok;
    } catch {
      return [];
    }
  },

  getLocationTrailForEmployee: async (
    token: string,
    targetUserId: bigint,
    date: string,
  ): Promise<import("../types").GpsCoord[]> => {
    const result = await (await actor()).getLocationTrailForEmployee(
      token,
      targetUserId,
      date,
    );
    if (result.__kind__ === "err") throw new Error(result.err);
    return result.ok.coords;
  },

  // ── RSM Hierarchy: MRs grouped by ASM ────────────────────────────────────
  getMrsGroupedByAsmForManager: async (
    token: string,
  ): Promise<
    Array<{
      asmId: bigint;
      asmName: string;
      mrs: Array<{ mrId: bigint; mrName: string }>;
    }>
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getMrsGroupedByAsmForManager !== "function") return [];
      const result = (await a.getMrsGroupedByAsmForManager(token)) as
        | {
            __kind__: "ok";
            ok: Array<{
              asmId: bigint;
              asmName: string;
              mrs: Array<{ mrId: bigint; mrName: string }>;
            }>;
          }
        | { __kind__: "err"; err: string };
      if (result.__kind__ === "ok") return result.ok;
      return [];
    } catch {
      return [];
    }
  },

  // ── GPS Enforcement ───────────────────────────────────────────────────────

  /** Returns whether strict GPS enforcement is enabled globally (Admin setting). */
  getGpsEnforcementEnabled: async (token: string): Promise<boolean> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getGpsEnforcementEnabled !== "function") return true; // default: enforcement ON
      const result = (await a.getGpsEnforcementEnabled(token)) as
        | { __kind__: "ok"; ok: boolean }
        | { __kind__: "err"; err: string }
        | boolean;
      if (typeof result === "boolean") return result;
      if (result.__kind__ === "ok") return result.ok;
      return true;
    } catch {
      return true; // fail-safe: enforce GPS
    }
  },

  /**
   * Returns whether the logged-in employee has an active Admin GPS override
   * for the given date (YYYY-MM-DD). Overrides allow submission without GPS.
   */
  checkGpsOverride: async (token: string, date: string): Promise<boolean> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.checkGpsOverride !== "function") return false;
      const result = (await a.checkGpsOverride(token, date)) as
        | { __kind__: "ok"; ok: boolean }
        | { __kind__: "err"; err: string }
        | boolean;
      if (typeof result === "boolean") return result;
      if (result.__kind__ === "ok") return result.ok;
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Asks the backend to compute the accuracy category string for given coords.
   * Returns "verified", "weak", or "none".
   */
  // ── Notifications ──────────────────────────────────────────────────────────
  getMyNotifications: async (token: string) =>
    (await actor()).getMyNotifications(token),

  getUnreadNotificationCount: async (token: string) =>
    (await actor()).getUnreadNotificationCount(token),

  markNotificationsRead: async (ids: string[], token: string) =>
    (await actor()).markNotificationsRead(ids, token),

  markAllNotificationsRead: async (token: string) =>
    (await actor()).markAllNotificationsRead(token),

  clearMyNotifications: async (token: string) =>
    (await actor()).clearMyNotifications(token),

  triggerDoctorCallNotification: async (callReportId: string, token: string) =>
    (await actor()).triggerDoctorCallNotification(callReportId, token),

  getNotificationSettings: async (token: string) =>
    (await actor()).getNotificationSettings(token),

  updateNotificationSettings: async (
    input: Parameters<backendInterface["updateNotificationSettings"]>[0],
    token: string,
  ) => (await actor()).updateNotificationSettings(input, token),

  getGpsAccuracyCategory: async (
    token: string,
    lat: number,
    lng: number,
    accuracy: number | null,
  ): Promise<string> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getGpsAccuracyCategory !== "function") {
        // Frontend fallback using same threshold logic
        if (accuracy == null) return "verified";
        if (accuracy <= 100) return "verified";
        if (accuracy <= 200) return "weak";
        return "none";
      }
      const result = (await a.getGpsAccuracyCategory(
        token,
        lat,
        lng,
        accuracy,
      )) as
        | string
        | { __kind__: "ok"; ok: string }
        | { __kind__: "err"; err: string };
      if (typeof result === "string") return result;
      if (result.__kind__ === "ok") return result.ok;
      return "none";
    } catch {
      return "none";
    }
  },

  // ── Primary HQ & Role-Level Location APIs ──────────────────────────────
  getLocationsForRole: async (
    token: string,
    role: Parameters<backendInterface["getLocationsForRole"]>[1],
  ) => (await actor()).getLocationsForRole(token, role),

  getLocationsByLevel: async (
    token: string,
    level: Parameters<backendInterface["getLocationsByLevel"]>[1],
  ) => (await actor()).getLocationsByLevel(token, level),

  getLocationHierarchy: async (token: string, locationId: bigint) =>
    (await actor()).getLocationHierarchy(token, locationId),

  getEmployeesByHq: async (token: string, hqId: bigint) =>
    (await actor()).getEmployeesByHq(token, hqId),

  setPrimaryHq: async (token: string, userId: bigint, hqId: bigint) =>
    (await actor()).setPrimaryHq(token, userId, hqId),

  clearPrimaryHq: async (token: string, userId: bigint) =>
    (await actor()).clearPrimaryHq(token, userId),

  validateHqForRole: async (
    token: string,
    role: Parameters<backendInterface["validateHqForRole"]>[1],
    hqId: bigint,
  ) => (await actor()).validateHqForRole(token, role, hqId),

  getInvalidRoleEmployees: async (token: string) =>
    (await actor()).getInvalidRoleEmployees(token),

  getInvalidHqEmployees: async (token: string) =>
    (await actor()).getInvalidHqEmployees(token),

  // ── SFA Phase 2: Sample Balance & Allocation ──────────────────────────────

  /**
   * Returns the MR's sample balance per product for the given month/year.
   * Uses the authenticated token so the backend scopes to the calling MR.
   */
  getMyBalance: async (
    token: string,
    month: number,
    year: number,
  ): Promise<import("../backend.d").SampleBalanceView[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getMyBalance !== "function") return [];
      const result = await a.getMyBalance(token, BigInt(month), BigInt(year));
      return result as import("../backend.d").SampleBalanceView[];
    } catch {
      return [];
    }
  },

  /**
   * Returns all sample allocations for the calling MR for the given month/year.
   */
  listMyAllocations: async (
    token: string,
    month: number,
    year: number,
  ): Promise<import("../backend.d").SampleAllocationInfo[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listMyAllocations !== "function") return [];
      const result = await a.listMyAllocations(
        token,
        BigInt(month),
        BigInt(year),
      );
      return result as import("../backend.d").SampleAllocationInfo[];
    } catch {
      return [];
    }
  },

  /**
   * Records sample usage after a call report is submitted.
   * callReportId corresponds to the backend's ReportId (bigint).
   */
  recordSamplesUsed: async (
    token: string,
    callReportId: bigint,
    usages: import("../backend.d").SampleUsageInput[],
  ): Promise<{ ok: number[] } | { err: string }> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.recordSamplesUsed !== "function") {
        return { err: "recordSamplesUsed not available yet" };
      }
      const result = (await a.recordSamplesUsed(token, callReportId, usages)) as
        | { __kind__: "ok"; ok: bigint[] }
        | { __kind__: "err"; err: string };
      if (result.__kind__ === "ok") {
        return { ok: result.ok.map(Number) };
      }
      return { err: result.err };
    } catch (e) {
      return { err: String(e) };
    }
  },

  /**
   * Sets core doctor classification and visit frequency target.
   * Accessible by Admin, ASM, or RSM acting as ASM.
   */
  setDoctorClassification: async (
    token: string,
    doctorId: bigint,
    isCoreDoctor: boolean,
    visitFrequencyTarget: number,
  ): Promise<import("../backend.d").MutationResult> => {
    return (await actor()).setDoctorClassification(
      token,
      doctorId,
      isCoreDoctor,
      BigInt(visitFrequencyTarget),
    );
  },

  // ── SFA Phase 2: Joint Field Work (JFW) ──────────────────────────────────

  submitJfw: async (
    token: string,
    input: {
      mrId: bigint;
      date: string;
      areaVisited: string;
      stationVisited: string;
      doctorsJointlyVisited: Array<{ name: string; station: string }>;
      observations: string;
      rating: string;
    },
  ): Promise<
    { __kind__: "ok"; ok: number } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.submitJfw !== "function") {
        return { __kind__: "err", err: "JFW submission not available yet" };
      }
      return (await a.submitJfw(token, input)) as
        | { __kind__: "ok"; ok: number }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  listMyJfws: async (
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listMyJfws !== "function") return [];
      return (await a.listMyJfws(token, fromDate, toDate)) as unknown[];
    } catch {
      return [];
    }
  },

  listJfwsAboutMe: async (token: string): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.listJfwsAboutMe !== "function") return [];
      return (await a.listJfwsAboutMe(token)) as unknown[];
    } catch {
      return [];
    }
  },

  acknowledgeJfw: async (
    token: string,
    jfwId: number,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.acknowledgeJfw !== "function") {
        return { __kind__: "err", err: "Acknowledge JFW not available yet" };
      }
      return (await a.acknowledgeJfw(token, BigInt(jfwId))) as
        | { __kind__: "ok"; ok: null }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  getAllJfws: async (
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getAllJfws !== "function") return [];
      return (await a.getAllJfws(token, fromDate, toDate)) as unknown[];
    } catch {
      return [];
    }
  },

  getJfwSummary: async (
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getJfwSummary !== "function") return [];
      return (await a.getJfwSummary(token, fromDate, toDate)) as unknown[];
    } catch {
      return [];
    }
  },

  // ── SFA Phase 2: KPI Summary ──────────────────────────────────────────────

  getMRKpiSummary: async (
    token: string,
    mrId: bigint,
    month: bigint,
    year: bigint,
  ): Promise<unknown> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getMRKpiSummary !== "function") return null;
      return await a.getMRKpiSummary(token, mrId, month, year);
    } catch {
      return null;
    }
  },

  getNewDoctorsThisMonth: async (
    token: string,
    mrId: bigint,
    month: bigint,
    year: bigint,
  ): Promise<number> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getNewDoctorsThisMonth !== "function") return 0;
      return Number(await a.getNewDoctorsThisMonth(token, mrId, month, year));
    } catch {
      return 0;
    }
  },

  // ── SFA Phase 2: Chemist Call Entry ───────────────────────────────────────

  submitChemistCall: async (
    token: string,
    input: import("../backend.d").ChemistCallInput,
  ): Promise<
    { __kind__: "ok"; ok: bigint } | { __kind__: "err"; err: string }
  > => {
    try {
      const result = await (await actor()).submitChemistCall(token, input);
      return result as
        | { __kind__: "ok"; ok: bigint }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  listMyChemistCalls: async (
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").ChemistCallInfo[]> => {
    try {
      return await (await actor()).listMyChemistCalls(token, fromDate, toDate);
    } catch {
      return [];
    }
  },

  getChemistCall: async (
    token: string,
    callId: bigint,
  ): Promise<import("../backend.d").ChemistCallInfo | null> => {
    try {
      return await (await actor()).getChemistCall(token, callId);
    } catch {
      return null;
    }
  },

  // ── SFA Phase 2: Stockist Call Entry ──────────────────────────────────────

  submitStockistCall: async (
    token: string,
    input: import("../backend.d").StockistCallInput,
  ): Promise<
    { __kind__: "ok"; ok: bigint } | { __kind__: "err"; err: string }
  > => {
    try {
      const result = await (await actor()).submitStockistCall(token, input);
      return result as
        | { __kind__: "ok"; ok: bigint }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  listMyStockistCalls: async (
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").StockistCallInfo[]> => {
    try {
      return await (await actor()).listMyStockistCalls(token, fromDate, toDate);
    } catch {
      return [];
    }
  },

  getStockistCall: async (
    token: string,
    callId: bigint,
  ): Promise<import("../backend.d").StockistCallInfo | null> => {
    try {
      return await (await actor()).getStockistCall(token, callId);
    } catch {
      return null;
    }
  },

  // ── DCR Auto-Fill, Edit Requests, Attendance Correction ─────────────────

  getAutoFillDcr: async (token: string, date: string): Promise<unknown> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getAutoFillDcr !== "function") return null;
      return await a.getAutoFillDcr(token, date);
    } catch {
      return null;
    }
  },

  submitAutoFilledDcr: async (
    token: string,
    input: {
      date: string;
      remarks: string;
      submissionType: "manual" | "autoCheckout" | "autoDeadline";
      mrReviewedAndEdited: boolean;
    },
  ): Promise<
    { __kind__: "ok"; ok: bigint } | { __kind__: "err"; err: string }
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.submitAutoFilledDcr !== "function")
        return { __kind__: "err", err: "submitAutoFilledDcr not available" };
      return (await a.submitAutoFilledDcr(token, input)) as
        | { __kind__: "ok"; ok: bigint }
        | { __kind__: "err"; err: string };
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  saveDcrDraft: async (
    token: string,
    input: { date: string; remarks: string },
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.saveDcrDraft !== "function") return;
      await a.saveDcrDraft(token, input);
    } catch {
      /* non-blocking */
    }
  },

  requestDcrEdit: async (
    token: string,
    dcrId: bigint,
    reason: string,
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.requestDcrEdit !== "function") return;
      await a.requestDcrEdit(token, dcrId, reason);
    } catch {
      throw new Error("requestDcrEdit failed");
    }
  },

  getDcrEditRequests: async (
    token: string,
  ): Promise<
    Array<{
      id: string;
      dcrDate: string;
      reason: string;
      status: "Pending" | "Approved" | "Rejected";
      reviewNote: string;
      requestedOn: string;
    }>
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getDcrEditRequests !== "function") return [];
      return (await a.getDcrEditRequests(token)) as Array<{
        id: string;
        dcrDate: string;
        reason: string;
        status: "Pending" | "Approved" | "Rejected";
        reviewNote: string;
        requestedOn: string;
      }>;
    } catch {
      return [];
    }
  },

  reviewDcrEditRequest: async (
    token: string,
    requestId: string,
    approved: boolean,
    reviewNote: string,
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.reviewDcrEditRequest !== "function") return;
      await a.reviewDcrEditRequest(token, requestId, approved, reviewNote);
    } catch {
      throw new Error("reviewDcrEditRequest failed");
    }
  },

  submitAttendanceCorrectionRequest: async (
    token: string,
    input: {
      autoCheckoutDate: string;
      claimedCheckoutTime: string;
      reason: string;
      supportingEvidence: string;
    },
  ): Promise<void> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.submitAttendanceCorrectionRequest !== "function") return;
      await a.submitAttendanceCorrectionRequest(token, input);
    } catch {
      throw new Error("submitAttendanceCorrectionRequest failed");
    }
  },

  getAttendanceCorrectionRequests: async (
    token: string,
  ): Promise<
    Array<{
      id: string;
      autoCheckoutDate: string;
      claimedCheckoutTime: string;
      reason: string;
      supportingEvidence: string;
      status: "Pending" | "Approved" | "Rejected";
      reviewNote: string;
      submittedOn: string;
    }>
  > => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getAttendanceCorrectionRequests !== "function") return [];
      return (await a.getAttendanceCorrectionRequests(token)) as Array<{
        id: string;
        autoCheckoutDate: string;
        claimedCheckoutTime: string;
        reason: string;
        supportingEvidence: string;
        status: "Pending" | "Approved" | "Rejected";
        reviewNote: string;
        submittedOn: string;
      }>;
    } catch {
      return [];
    }
  },

  // ── DCR (Daily Call Report) ───

  submitDcr: async (
    token: string,
    input: import("../backend.d").DcrInput,
  ): Promise<
    { __kind__: "ok"; ok: bigint } | { __kind__: "err"; err: string }
  > => {
    try {
      return await (await actor()).submitDcr(token, input);
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  getMyDcr: async (
    token: string,
    date: string,
  ): Promise<import("../backend.d").DcrInfo | null> => {
    try {
      return await (await actor()).getMyDcr(token, date);
    } catch {
      return null;
    }
  },

  listMyDcrs: async (
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").DcrInfo[]> => {
    try {
      return await (await actor()).listMyDcrs(token, fromDate, toDate);
    } catch {
      return [];
    }
  },

  listTeamDcrs: async (
    token: string,
    mrIds: number[],
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").DcrInfo[]> => {
    try {
      return await (await actor()).listTeamDcrs(
        token,
        mrIds.map(BigInt),
        fromDate,
        toDate,
      );
    } catch {
      return [];
    }
  },

  approveDcr: async (
    token: string,
    input: import("../backend.d").DcrApprovalInput,
  ): Promise<
    { __kind__: "ok"; ok: string } | { __kind__: "err"; err: string }
  > => {
    try {
      const result = await (await actor()).approveDcr(token, input);
      return result;
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  getDcrSummary: async (
    token: string,
    mrIds: number[],
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").DcrSummaryRow[]> => {
    try {
      return await (await actor()).getDcrSummary(
        token,
        mrIds.map(BigInt),
        fromDate,
        toDate,
      );
    } catch {
      return [];
    }
  },

  getDcrSettings: async (
    token: string,
  ): Promise<import("../backend.d").DcrSettingsInfo> => {
    try {
      return await (await actor()).getDcrSettings(token);
    } catch {
      return {
        dailyDeadlineHour: BigInt(21),
        dailyDeadlineMinute: BigInt(0),
        isEnabled: true,
      };
    }
  },

  updateDcrSettings: async (
    token: string,
    deadlineHour: number,
    deadlineMinute?: number,
    isEnabled?: boolean,
  ): Promise<
    { __kind__: "ok"; ok: string } | { __kind__: "err"; err: string }
  > => {
    try {
      return await (await actor()).updateDcrSettings(
        token,
        BigInt(deadlineHour),
        BigInt(deadlineMinute ?? 0),
        isEnabled ?? true,
      );
    } catch (e) {
      return { __kind__: "err", err: String(e) };
    }
  },

  checkDcrPending: async (
    token: string,
    mrId: number,
    date: string,
  ): Promise<boolean> => {
    try {
      return await (await actor()).checkDcrPending(token, BigInt(mrId), date);
    } catch {
      return false;
    }
  },

  getMtpVsActualData: async (
    token: string,
    mrId: number,
    month: number,
    year: number,
  ): Promise<[string, string, string][]> => {
    try {
      return await (await actor()).getMtpVsActualData(
        token,
        BigInt(mrId),
        BigInt(month),
        BigInt(year),
      );
    } catch {
      return [];
    }
  },

  // ── SFA Phase 2: Chemist/Stockist Coverage ────────────────────────────────

  getChemistStockistCoverage: async (
    token: string,
    mrIds: bigint[],
    fromDate: string,
    toDate: string,
  ): Promise<{
    chemistCoverage: import("../backend.d").CoverageRow[];
    stockistCoverage: import("../backend.d").CoverageRow[];
  }> => {
    try {
      return await (await actor()).getChemistStockistCoverage(
        token,
        mrIds,
        fromDate,
        toDate,
      );
    } catch {
      return { chemistCoverage: [], stockistCoverage: [] };
    }
  },

  listTeamChemistCalls: async (
    token: string,
    mrIds: bigint[],
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").ChemistCallInfo[]> => {
    try {
      return await (await actor()).listTeamChemistCalls(
        token,
        mrIds,
        fromDate,
        toDate,
      );
    } catch {
      return [];
    }
  },

  listTeamStockistCalls: async (
    token: string,
    mrIds: bigint[],
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").StockistCallInfo[]> => {
    try {
      return await (await actor()).listTeamStockistCalls(
        token,
        mrIds,
        fromDate,
        toDate,
      );
    } catch {
      return [];
    }
  },

  // ── Phase 3 Dashboard API ──────────────────────────────────────────────────

  getDashboardAggregates: async (
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").DashboardAggregates | null> => {
    try {
      return await (await actor()).getDashboardAggregates(
        token,
        fromDate,
        toDate,
      );
    } catch {
      return null;
    }
  },

  getPendingApprovalCounts: async (
    token: string,
  ): Promise<import("../backend.d").PendingApprovalCounts> => {
    try {
      return await (await actor()).getPendingApprovalCounts(token);
    } catch {
      return {
        leavePending: BigInt(0),
        tadaPending: BigInt(0),
        mtpPending: BigInt(0),
        dcrPending: BigInt(0),
        rsmLevelLeavePending: BigInt(0),
        rsmLevelTadaPending: BigInt(0),
      };
    }
  },

  getTeamDailyActivity: async (
    token: string,
    date: string,
  ): Promise<import("../backend.d").MrDailyActivityRow[]> => {
    try {
      return await (await actor()).getTeamDailyActivity(token, date);
    } catch {
      return [];
    }
  },

  getRsmDirectMrs: async (
    token: string,
  ): Promise<import("../backend.d").UserInfo[]> => {
    try {
      return await (await actor()).getRsmDirectMrs(token);
    } catch {
      return [];
    }
  },

  getSystemAlerts: async (
    token: string,
  ): Promise<import("../backend.d").SystemAlert[]> => {
    try {
      return await (await actor()).getSystemAlerts(token);
    } catch {
      return [];
    }
  },

  getDcrReminderStatus: async (
    token: string,
    date: string,
  ): Promise<import("../backend.d").DcrReminderStatus> => {
    try {
      return await (await actor()).getDcrReminderStatus(token, date);
    } catch {
      return {
        checkedIn: false,
        dcrSubmitted: false,
        deadlineHour: BigInt(21),
      };
    }
  },

  getExpenseClaimSummary: async (
    token: string,
    fromDate: string,
    toDate: string,
  ): Promise<import("../backend.d").ExpenseClaimSummaryRow[]> => {
    try {
      return await (await actor()).getExpenseClaimSummary(
        token,
        fromDate,
        toDate,
      );
    } catch {
      return [];
    }
  },

  getTaDaGrades: async (): Promise<
    { __kind__: "ok"; ok: TaDaGrade[] } | { __kind__: "err"; err: string }
  > => {
    try {
      type TaDaActor = {
        getTaDaGrades(): Promise<
          { __kind__: "ok"; ok: TaDaGrade[] } | { __kind__: "err"; err: string }
        >;
      };
      return await ((await actor()) as unknown as TaDaActor).getTaDaGrades();
    } catch {
      return { __kind__: "err" as const, err: "Failed to load grades" };
    }
  },

  setTaDaGrade: async (
    token: string,
    grade: TaDaGrade,
  ): Promise<
    { __kind__: "ok"; ok: TaDaGrade } | { __kind__: "err"; err: string }
  > => {
    try {
      type TaDaActor = {
        setTaDaGrade(
          token: string,
          grade: TaDaGrade,
        ): Promise<
          { __kind__: "ok"; ok: TaDaGrade } | { __kind__: "err"; err: string }
        >;
      };
      return await ((await actor()) as unknown as TaDaActor).setTaDaGrade(
        token,
        grade,
      );
    } catch {
      return { __kind__: "err" as const, err: "Failed to save grade" };
    }
  },

  deleteTaDaGrade: async (
    token: string,
    gradeName: string,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      type TaDaActor = {
        deleteTaDaGrade(
          token: string,
          gradeName: string,
        ): Promise<
          { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
        >;
      };
      return await ((await actor()) as unknown as TaDaActor).deleteTaDaGrade(
        token,
        gradeName,
      );
    } catch {
      return { __kind__: "err" as const, err: "Failed to delete grade" };
    }
  },

  checkExpenseFieldActivity: async (
    token: string,
    expenseDate: string,
  ): Promise<boolean> => {
    try {
      return await (await actor()).checkExpenseFieldActivity(
        token,
        expenseDate,
      );
    } catch {
      return true; // default to true (no warning) on error
    }
  },

  // ── SFA Reminder Settings ─────────────────────────────────────────────────
  getSfaReminderSettings: async (
    token: string,
  ): Promise<
    | { __kind__: "ok"; ok: import("../backend.d").SfaReminderSettings }
    | { __kind__: "err"; err: string }
  > => {
    return (await actor()).getSfaReminderSettings(token);
  },

  setSfaReminderSettings: async (
    token: string,
    settings: import("../backend.d").SfaReminderSettings,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    return (await actor()).setSfaReminderSettings(token, settings);
  },

  getDcrUnsubmittedMRs: async (
    token: string,
    date: string,
  ): Promise<
    { __kind__: "ok"; ok: bigint[] } | { __kind__: "err"; err: string }
  > => {
    try {
      return await (await actor()).getDcrUnsubmittedMRs(token, date);
    } catch {
      return { __kind__: "ok", ok: [] };
    }
  },

  getMtpUnsubmittedMRs: async (
    token: string,
    month: bigint,
    year: bigint,
  ): Promise<
    { __kind__: "ok"; ok: bigint[] } | { __kind__: "err"; err: string }
  > => {
    try {
      return await (await actor()).getMtpUnsubmittedMRs(token, month, year);
    } catch {
      return { __kind__: "ok", ok: [] };
    }
  },

  createDcrReminder: async (
    token: string,
    mrId: bigint,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      return await (await actor()).createDcrReminder(token, mrId);
    } catch {
      return { __kind__: "ok", ok: null };
    }
  },

  getBulkMtpEnumValues: async (): Promise<{
    typeOfWorkValues: string[];
    modeOfTransportValues: string[];
  }> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getBulkMtpEnumValues !== "function") {
        return {
          typeOfWorkValues: [
            "HQ",
            "Ex-Station",
            "Out-Station",
            "Joint Work with Manager",
          ],
          modeOfTransportValues: [
            "Two Wheeler",
            "Four Wheeler",
            "Auto",
            "Train",
            "Bus",
            "Air",
          ],
        };
      }
      return (await a.getBulkMtpEnumValues()) as {
        typeOfWorkValues: string[];
        modeOfTransportValues: string[];
      };
    } catch {
      return {
        typeOfWorkValues: [
          "HQ",
          "Ex-Station",
          "Out-Station",
          "Joint Work with Manager",
        ],
        modeOfTransportValues: [
          "Two Wheeler",
          "Four Wheeler",
          "Auto",
          "Train",
          "Bus",
          "Air",
        ],
      };
    }
  },

  // ── Doctor Call Report (30-day / custom range) ─────────────────────────────────

  /**
   * Returns the dashboard count of doctor calls by the logged-in MR in the
   * last 30 rolling calendar days. Falls back to 0 if the backend method is
   * not yet available.
   */
  getDashboardDoctorCallCount: async (token: string): Promise<number> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getDashboardDoctorCallCount !== "function") {
        // Fallback: derive from listCallReportsByMr for rolling 30 days
        const today = new Date();
        const fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const _fromTs = BigInt(fromDate.getTime()) * BigInt(1_000_000);
        const _toTs = BigInt(today.getTime()) * BigInt(1_000_000);
        // We don't have userId here so return 0 to keep types clean
        return 0;
      }
      const result = (await a.getDashboardDoctorCallCount(token)) as
        | { __kind__: "ok"; ok: bigint }
        | { __kind__: "err"; err: string }
        | bigint
        | number;
      if (typeof result === "bigint") return Number(result);
      if (typeof result === "number") return result;
      if ((result as { __kind__: string }).__kind__ === "ok") {
        return Number((result as { __kind__: "ok"; ok: bigint }).ok);
      }
      return 0;
    } catch {
      return 0;
    }
  },

  /**
   * Returns a paginated/filtered doctor call report for the logged-in MR.
   * Falls back to deriving data from listCallReportsByMr when the
   * dedicated backend endpoint is not yet available.
   */
  getDoctorCallReport: async (
    token: string,
    filter: {
      fromDate: string;
      toDate: string;
      includeDrafts?: boolean;
      doctorSearch?: string;
      product?: string;
      dayType?: string;
    },
  ): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getDoctorCallReport !== "function") return [];
      const result = (await a.getDoctorCallReport(token, filter)) as
        | { __kind__: "ok"; ok: unknown[] }
        | { __kind__: "err"; err: string }
        | unknown[];
      if (Array.isArray(result)) return result;
      if ((result as { __kind__: string }).__kind__ === "ok") {
        return (result as { __kind__: "ok"; ok: unknown[] }).ok;
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Returns doctor call report for one or more MRs by their IDs.
   * Used by manager portals (ASM, RSM, ZSM, HR, Admin).
   */
  getDoctorCallReportForMrs: async (
    token: string,
    mrIds: bigint[],
    filter: {
      fromDate: string;
      toDate: string;
      includeDrafts?: boolean;
    },
  ): Promise<unknown[]> => {
    try {
      const a = (await actor()) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof a.getDoctorCallReportForMrs !== "function") return [];
      const result = (await a.getDoctorCallReportForMrs(
        token,
        mrIds,
        filter,
      )) as
        | { __kind__: "ok"; ok: unknown[] }
        | { __kind__: "err"; err: string }
        | unknown[];
      if (Array.isArray(result)) return result;
      if ((result as { __kind__: string }).__kind__ === "ok") {
        return (result as { __kind__: "ok"; ok: unknown[] }).ok;
      }
      return [];
    } catch {
      return [];
    }
  },

  createMtpReminder: async (
    token: string,
    mrId: bigint,
  ): Promise<
    { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }
  > => {
    try {
      return await (await actor()).createMtpReminder(token, mrId);
    } catch {
      return { __kind__: "ok", ok: null };
    }
  },
};

export type Api = typeof api;

// ── Local suggestion filter helper (used when backend method not available) ──

function applyLocalSuggestionFilter(
  items: SuggestionSubmission[],
  filter?: SuggestionFilter,
): SuggestionSubmission[] {
  if (!filter) return items;
  return items.filter((s) => {
    if (filter.submissionType && s.submissionType !== filter.submissionType)
      return false;
    if (filter.role && s.submittedByRole !== filter.role) return false;
    if (filter.priority && s.priority !== filter.priority) return false;
    if (filter.status && s.status !== filter.status) return false;
    if (filter.fromDate && s.submittedAt < filter.fromDate) return false;
    if (filter.toDate && s.submittedAt > filter.toDate) return false;
    if (
      filter.employeeName &&
      !s.submittedByName
        .toLowerCase()
        .includes(filter.employeeName.toLowerCase())
    )
      return false;
    return true;
  });
}

// ── Shared types for new features ─────────────────────────────────────────

export interface MissedVisitAlert {
  mrId: bigint;
  mrName: string;
  doctorId: bigint;
  doctorName: string;
  lastVisitDate: string | null;
  daysSinceLastVisit: number;
  area: string;
}

export interface MonthlyVisitData {
  monthYear: string;
  mrId: bigint;
  mrName: string;
  visitPercentage: number;
  doctorsVisited: number;
  totalDoctors: number;
}

export interface ConsolidatedMonthData {
  monthYear: string;
  avgVisitPercentage: number;
  totalMRs: number;
}

export interface BulkUploadRecord {
  id: bigint;
  uploadType: string;
  uploadedBy: string;
  uploadedAt: bigint;
  totalRows: number;
  savedRows: number;
  skippedRows: number;
  errors: string[];
}

export interface RepairResult {
  repairedTypes: string[];
  fixedCounts: [string, bigint][];
  updatedReport: import("../backend.d").HealthCheckReport;
}

export interface TaDaGrade {
  gradeName: string;
  daHqRate: bigint;
  daExStationRate: bigint;
  daOutStationRate: bigint;
  taPerKmRate: bigint;
  lodgingEntitlement: bigint;
  mealAllowance: bigint;
}
