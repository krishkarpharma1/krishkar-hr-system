import * as XLSX from "xlsx";

export type ColumnDef = {
  key: string;
  label: string;
  type: "text" | "date" | "datetime" | "number" | "percent";
};

export type ExportActor = {
  userId: string;
  userName: string;
  role: string;
};

// IST offset: UTC+5:30
export const toIST = (date: Date): Date =>
  new Date(date.getTime() + 5.5 * 60 * 60 * 1000);

const _MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

const toDateObj = (val: unknown): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date(val);
  if (typeof val === "string") {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export const formatDate = (val: unknown): string => {
  const d = toDateObj(val);
  if (!d) return "";
  const ist = toIST(d);
  return `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}/${ist.getUTCFullYear()}`;
};

export const formatDateTime = (val: unknown): string => {
  const d = toDateObj(val);
  if (!d) return "";
  const ist = toIST(d);
  return `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}/${ist.getUTCFullYear()} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
};

const formatCellValue = (
  val: unknown,
  type: ColumnDef["type"],
): string | number => {
  if (val === null || val === undefined) return "";
  switch (type) {
    case "date":
      return formatDate(val);
    case "datetime":
      return formatDateTime(val);
    case "number":
      return typeof val === "number" ? val : Number(val) || 0;
    case "percent":
      return typeof val === "number" ? `${val.toFixed(1)}%` : `${val}%`;
    default:
      return String(val);
  }
};

const makeTitleRowStyle = (): XLSX.CellObject["s"] => ({
  font: { bold: true, sz: 14, color: { rgb: "1E3A5F" } },
  alignment: { horizontal: "left", vertical: "center" },
});

const makeSubtitleRowStyle = (): XLSX.CellObject["s"] => ({
  font: { sz: 10, color: { rgb: "666666" } },
  alignment: { horizontal: "left", vertical: "center" },
});

const makeHeaderCellStyle = (): XLSX.CellObject["s"] => ({
  font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "1E3A5F" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
});

const makeDataCellStyle = (
  rowIndex: number,
  type: ColumnDef["type"],
): XLSX.CellObject["s"] => ({
  fill: { fgColor: { rgb: rowIndex % 2 === 0 ? "FFFFFF" : "F8FAFC" } },
  alignment: {
    horizontal: type === "number" || type === "percent" ? "right" : "left",
    vertical: "center",
  },
});

const makeFooterCellStyle = (): XLSX.CellObject["s"] => ({
  font: { bold: true, sz: 11 },
  fill: { fgColor: { rgb: "F1F5F9" } },
  alignment: { horizontal: "left", vertical: "center" },
});

const getISTNow = () => toIST(new Date());

const buildFileName = (reportName: string): string => {
  const now = getISTNow();
  const dd = pad(now.getUTCDate());
  const mm = pad(now.getUTCMonth() + 1);
  const yyyy = now.getUTCFullYear();
  const hh = pad(now.getUTCHours());
  const min = pad(now.getUTCMinutes());
  const safe = reportName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  return `${safe}_${dd}-${mm}-${yyyy}_${hh}-${min}.xlsx`;
};

const buildExportDateLabel = (): string => {
  const now = getISTNow();
  const day = pad(now.getUTCDate());
  const month = MONTHS_LONG[now.getUTCMonth()];
  const year = now.getUTCFullYear();
  const hh = pad(now.getUTCHours());
  const mm = pad(now.getUTCMinutes());
  return `${day} ${month} ${year} ${hh}:${mm}`;
};

export const exportToExcel = (params: {
  reportName: string;
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  activeFilters: string;
  companyName: string;
}): void => {
  const { reportName, columns, data, activeFilters, companyName } = params;
  const numCols = columns.length;

  // ── AOA rows ─────────────────────────────────────────────────────────────
  // Row 0: title
  const titleText = `${reportName} — ${companyName}`;
  const titleRow: unknown[] = [titleText, ...Array(numCols - 1).fill(null)];

  // Row 1: subtitle
  const filterLabel = activeFilters?.trim() ? activeFilters : "All Data";
  const subtitleText = `Exported on: ${buildExportDateLabel()} IST | Filters: ${filterLabel}`;
  const subtitleRow: unknown[] = [
    subtitleText,
    ...Array(numCols - 1).fill(null),
  ];

  // Row 2: blank
  const blankRow: unknown[] = Array(numCols).fill(null);

  // Row 3: header labels
  const headerRow: unknown[] = columns.map((c) => c.label);

  // Rows 4+: data
  const dataRows: unknown[][] = data.map((rec) =>
    columns.map((c) => formatCellValue(rec[c.key], c.type)),
  );

  // Last row: footer
  const footerRow: unknown[] = [
    `Total Records: ${data.length}`,
    ...Array(numCols - 1).fill(null),
  ];

  const aoa: unknown[][] = [
    titleRow,
    subtitleRow,
    blankRow,
    headerRow,
    ...dataRows,
    footerRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Column widths ────────────────────────────────────────────────────────
  const colWidths = columns.map((c) => {
    const maxDataLen = data.reduce((acc, row) => {
      const v = formatCellValue(row[c.key], c.type);
      return Math.max(acc, String(v).length);
    }, c.label.length);
    return { wch: Math.max(15, maxDataLen + 2) };
  });
  ws["!cols"] = colWidths;

  // ── Merges for title (row 0) and subtitle (row 1) ────────────────────────
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
  ];

  // ── Cell styles ──────────────────────────────────────────────────────────
  const encode = XLSX.utils.encode_cell;

  // Title cell (R0C0)
  const titleCell = ws[encode({ r: 0, c: 0 })];
  if (titleCell) titleCell.s = makeTitleRowStyle();

  // Subtitle cell (R1C0)
  const subtitleCell = ws[encode({ r: 1, c: 0 })];
  if (subtitleCell) subtitleCell.s = makeSubtitleRowStyle();

  // Header row (R3)
  for (let c = 0; c < numCols; c++) {
    const cell = ws[encode({ r: 3, c })];
    if (cell) cell.s = makeHeaderCellStyle();
  }

  // Data rows (R4 … R4+data.length-1)
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < numCols; c++) {
      const cell = ws[encode({ r: 4 + r, c })];
      if (cell) cell.s = makeDataCellStyle(r, columns[c].type);
    }
  }

  // Footer row
  const footerRowIdx = 4 + data.length;
  const footerCell = ws[encode({ r: footerRowIdx, c: 0 })];
  if (footerCell) footerCell.s = makeFooterCellStyle();

  // ── Build workbook ───────────────────────────────────────────────────────
  const sheetName = reportName.slice(0, 31);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, buildFileName(reportName));
};

// Fire-and-forget audit log — silent, never blocks export
export const logExportToAuditTrail = (
  actor: ExportActor,
  exportType: string,
  filters: string,
  rowCount: number,
): void => {
  console.log("[ExportAudit]", {
    actor,
    exportType,
    filters,
    rowCount,
    timestamp: new Date().toISOString(),
  });
};
