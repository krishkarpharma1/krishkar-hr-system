import type { CompanyProfile } from "../backend.d";

// ── Types ──────────────────────────────────────────────────────────────────

export type DocType = "report" | "letter";

export interface BrandingPdfOptions {
  // Company info (overrides companyProfile fields if provided)
  companyName?: string;
  companyLogoUrl?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  // Legacy: pass a CompanyProfile object directly
  companyProfile?: CompanyProfile | null;
  // Document metadata
  docTitle?: string;
  period?: string;
  employeeInfo?: string;
  generatedBy?: string;
  generatedByRole?: string;
  docType?: DocType;
  refNo?: string;
  isLastPage?: boolean;
  filterSummary?: string;
  // Signatory (for official letters)
  signatoryName?: string;
  signatoryDesignation?: string;
  // Layout / style
  orientation?: "portrait" | "landscape";
  // Footer customisation
  confidentialityNotice?: string;
  footerTagline?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;");
}

function formatNow(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

/** Merge legacy companyProfile fields + explicit overrides into a flat object */
function resolveCompanyFields(opts: BrandingPdfOptions) {
  const cp = opts.companyProfile;
  return {
    name: opts.companyName ?? cp?.companyName ?? "Krishkar Pharmaceuticals",
    logoUrl: opts.companyLogoUrl ?? cp?.logoUrl ?? "",
    address: opts.companyAddress ?? cp?.address ?? "",
    phone: opts.companyPhone ?? cp?.contactNumber ?? "",
    email: opts.companyEmail ?? cp?.emailId ?? "",
    website: opts.companyWebsite ?? cp?.website ?? "",
  };
}

// ── Core print CSS ─────────────────────────────────────────────────────────

function buildCorePrintCss(
  logoUrl: string,
  orientation: "portrait" | "landscape",
): string {
  const pageSize = orientation === "landscape" ? "A4 landscape" : "A4";
  // Header ~130px, footer ~65px
  return `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif; font-size: 13px; color: #111;
    margin: 0;
    padding: 140px 0 80px 0;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  @page { size: ${pageSize}; margin: 0 1.5cm; }
  @media print {
    @page { size: ${pageSize}; margin: 0 1.5cm; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    html { -webkit-print-color-adjust: exact; }
  }

  /* ── Fixed header (repeats every page) ── */
  .pdf-header {
    position: fixed; top: 0; left: -1.5cm; right: -1.5cm;
    width: calc(100% + 3cm);
    background: #fff;
    padding: 10px 1.5cm 0 1.5cm;
    z-index: 1000;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .pdf-header-top {
    display: flex; align-items: flex-start; gap: 14px;
  }
  .pdf-header-logo img {
    height: 56px; max-width: 150px; object-fit: contain; display: block;
  }
  .pdf-header-company {
    flex: 1; min-width: 0;
  }
  .pdf-header-company h2 {
    margin: 0 0 1px; font-size: 18px; font-weight: bold;
    color: #0369a1; font-family: Arial, sans-serif;
  }
  .pdf-header-company .addr {
    margin: 1px 0; font-size: 11px; color: #4b5563; font-family: Arial, sans-serif;
  }
  .pdf-header-company .contact {
    margin: 1px 0; font-size: 10px; color: #6b7280; font-family: Arial, sans-serif;
  }
  .pdf-header-divider {
    border: none; border-bottom: 2px solid #0EA5E9;
    margin: 7px 0 0 0;
  }
  .pdf-header-meta {
    padding: 5px 0 6px 0;
    display: flex; flex-wrap: wrap; align-items: baseline;
    gap: 4px 18px;
  }
  .pdf-header-meta .meta-title {
    font-size: 14px; font-weight: bold; color: #1e3a5f;
  }
  .pdf-header-meta .meta-period {
    font-size: 11px; color: #555; font-style: italic;
  }
  .pdf-header-meta .meta-emp {
    font-size: 11px; color: #555;
  }
  .pdf-header-meta .meta-refno {
    font-size: 10px; color: #777; margin-left: auto;
    font-style: italic;
  }

  /* ── Fixed footer (repeats every page) ── */
  .pdf-footer {
    position: fixed; bottom: 0; left: -1.5cm; right: -1.5cm;
    width: calc(100% + 3cm);
    background: #f0f9ff;
    padding: 0 1.5cm 4px 1.5cm;
    z-index: 1000;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .pdf-footer-divider {
    border: none; border-top: 1.5px solid #0EA5E9;
    margin: 0 0 4px 0;
  }
  .pdf-footer-inner {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px;
  }
  .pdf-footer-left { font-size: 9px; color: #555; line-height: 1.4; }
  .pdf-footer-center { font-size: 9px; color: #888; font-style: italic; text-align: center; flex: 1; line-height: 1.4; }
  .pdf-footer-right { font-size: 9px; color: #555; text-align: right; line-height: 1.4; }
  .pdf-footer-tagline {
    text-align: center; font-size: 8.5px; color: #94a3b8; margin-top: 2px;
    font-style: italic;
  }
  .pdf-pageno::after {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 9px; color: #444; font-weight: bold;
  }

  /* ── Content body ── */
  .pdf-body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
  .pdf-watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    max-width: 380px; width: 55%;
    opacity: 0.06; z-index: -1; pointer-events: none;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }

  /* ── Table styles ── */
  .pdf-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
  .pdf-table th {
    background: #e0f2fe !important; color: #0369a1;
    border: 1px solid #bae6fd; padding: 5px 7px;
    text-align: left; font-weight: bold;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .pdf-table td { border: 1px solid #ddd; padding: 4px 7px; vertical-align: top; word-break: break-word; }
  .pdf-table tr:nth-child(even) td { background: #f9fafb; }

  /* ── Official letter ── */
  .letter-body { font-size: 12.5px; line-height: 1.7; color: #111; }
  .letter-recipient { margin: 18px 0 8px; }
  .letter-subject { font-weight: bold; margin-bottom: 12px; }
  .letter-signatory { margin-top: 52px; page-break-inside: avoid; }
  .letter-signatory-line { border-top: 1.5px solid #1e3a5f; width: 220px; margin-bottom: 5px; }

  /* ── Utility ── */
  .pdf-section-title { font-size: 12px; font-weight: bold; color: #374151; margin: 10px 0 4px; }
  .pdf-filter-summary { font-size: 10px; color: #555; margin: 0 0 10px; font-style: italic; }
  .pdf-page-break { page-break-after: always; }
  .pdf-page-break:last-child { page-break-after: avoid; }
  ${logoUrl ? ".pdf-watermark { display: block; }" : ".pdf-watermark { display: none; }"}
  `;
}

// ── Header HTML ─────────────────────────────────────────────────────────────

function buildHeaderHtml(opts: BrandingPdfOptions): string {
  const c = resolveCompanyFields(opts);
  const name = esc(c.name);
  const address = c.address ? esc(c.address) : "";
  const phoneLine = c.phone ? `Tel: ${esc(c.phone)}` : "";
  const emailLine = c.email ? `Email: ${esc(c.email)}` : "";
  const websiteLine = c.website ? `Web: ${esc(c.website)}` : "";
  const contactLine = [phoneLine, emailLine, websiteLine]
    .filter(Boolean)
    .join("  &nbsp;|&nbsp;  ");

  const docTitle = opts.docTitle ? esc(opts.docTitle) : "";
  const period = opts.period ? esc(opts.period) : "";
  const employeeInfo = opts.employeeInfo ? esc(opts.employeeInfo) : "";
  const refNo = opts.refNo ? esc(opts.refNo) : "";

  const hasMeta = !!(docTitle || period || employeeInfo || refNo);

  return `
<div class="pdf-header">
  <div class="pdf-header-top">
    ${c.logoUrl ? `<div class="pdf-header-logo"><img src="${c.logoUrl}" alt="${name}" /></div>` : ""}
    <div class="pdf-header-company">
      <h2>${name}</h2>
      ${address ? `<p class="addr">${address}</p>` : ""}
      ${contactLine ? `<p class="contact">${contactLine}</p>` : ""}
    </div>
  </div>
  <hr class="pdf-header-divider" />
  ${
    hasMeta
      ? `
  <div class="pdf-header-meta">
    ${docTitle ? `<span class="meta-title">${docTitle}</span>` : ""}
    ${period ? `<span class="meta-period">Period: ${period}</span>` : ""}
    ${employeeInfo ? `<span class="meta-emp">${employeeInfo}</span>` : ""}
    ${refNo ? `<span class="meta-refno">Ref No: ${refNo}</span>` : ""}
  </div>`
      : ""
  }
</div>`;
}

// ── Footer HTML ─────────────────────────────────────────────────────────────

function buildFooterHtml(opts: BrandingPdfOptions): string {
  const c = resolveCompanyFields(opts);
  const genOn = formatNow();
  const genBy = opts.generatedBy
    ? `${esc(opts.generatedBy)}${opts.generatedByRole ? ` (${esc(opts.generatedByRole)})` : ""}`
    : "";
  const confidentiality =
    opts.confidentialityNotice ??
    "This document is confidential and intended for internal use only.";
  const tagline = opts.footerTagline ?? `Powered by ${esc(c.name)}`;

  return `
<div class="pdf-footer">
  <hr class="pdf-footer-divider" />
  <div class="pdf-footer-inner">
    <div class="pdf-footer-left">
      Generated On: ${genOn}
      ${genBy ? `<br/>Generated By: ${genBy}` : ""}
    </div>
    <div class="pdf-footer-center">
      ${esc(confidentiality)}
    </div>
    <div class="pdf-footer-right">
      <span class="pdf-pageno"></span>
    </div>
  </div>
  <div class="pdf-footer-tagline">${tagline}</div>
</div>`;
}

// ── Signatory block (letter last page) ─────────────────────────────────────

function buildSignatoryHtml(opts: BrandingPdfOptions): string {
  if (opts.docType !== "letter") return "";
  const name = opts.signatoryName ?? esc(resolveCompanyFields(opts).name);
  const designation = opts.signatoryDesignation ?? "Authorized Signatory";
  return `
<div class="letter-signatory">
  <div class="letter-signatory-line"></div>
  <p style="margin:0;font-size:12px;font-weight:bold;">${esc(name)}</p>
  <p style="margin:2px 0;font-size:11px;color:#555;">${esc(designation)}</p>
</div>`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Enhanced buildBrandingHtml — window.open pattern for letters and direct prints.
 *
 * Adds professional header (company logo, name, address, contact) and
 * footer (page X of Y, generated on/by, confidentiality) on every page.
 * For official letters, includes Ref No in header and Authorized Signatory
 * on the last page.
 *
 * Backwards compatible: still accepts (companyProfile) as first param.
 */
export function buildBrandingHtml(
  companyProfileOrOpts: CompanyProfile | null | BrandingPdfOptions,
  docTitle?: string,
  period?: string,
  employeeInfo?: string,
  generatedBy?: string,
  generatedByRole?: string,
): string {
  let opts: BrandingPdfOptions;

  // Detect if first arg is the new options object or the legacy CompanyProfile
  if (
    companyProfileOrOpts &&
    typeof companyProfileOrOpts === "object" &&
    ("docTitle" in companyProfileOrOpts ||
      "companyProfile" in companyProfileOrOpts ||
      "companyName" in companyProfileOrOpts)
  ) {
    opts = companyProfileOrOpts as BrandingPdfOptions;
  } else {
    opts = {
      companyProfile: companyProfileOrOpts as CompanyProfile | null,
      docTitle,
      period,
      employeeInfo,
      generatedBy,
      generatedByRole,
      docType: "report",
    };
  }

  const c = resolveCompanyFields(opts);
  const orientation = opts.orientation ?? "portrait";

  return `<style>
  ${buildCorePrintCss(c.logoUrl, orientation)}
</style>
${c.logoUrl ? `<img class="pdf-watermark" src="${c.logoUrl}" alt="" aria-hidden="true" />` : ""}
${buildHeaderHtml(opts)}
${buildFooterHtml(opts)}
${opts.docType === "letter" ? buildSignatoryHtml(opts) : ""}`;
}

/**
 * Enhanced buildPdfPrintCss — used inside #pdf-report-print-root pattern.
 *
 * Adds repeating header/footer on every page.
 * Backwards compatible: still accepts (reportTitle, filterSummary, companyProfile).
 */
export function buildPdfPrintCss(
  reportTitle: string,
  filterSummary: string,
  companyProfile?: CompanyProfile | null,
  extraOpts?: Pick<
    BrandingPdfOptions,
    | "period"
    | "employeeInfo"
    | "generatedBy"
    | "generatedByRole"
    | "docType"
    | "refNo"
    | "orientation"
    | "confidentialityNotice"
    | "footerTagline"
    | "companyName"
    | "companyLogoUrl"
    | "companyAddress"
    | "companyPhone"
    | "companyEmail"
    | "companyWebsite"
  >,
): string {
  const opts: BrandingPdfOptions = {
    companyProfile,
    docTitle: reportTitle,
    filterSummary,
    docType: extraOpts?.docType ?? "report",
    period: extraOpts?.period,
    employeeInfo: extraOpts?.employeeInfo,
    generatedBy: extraOpts?.generatedBy,
    generatedByRole: extraOpts?.generatedByRole,
    refNo: extraOpts?.refNo,
    orientation: extraOpts?.orientation,
    confidentialityNotice: extraOpts?.confidentialityNotice,
    footerTagline: extraOpts?.footerTagline,
    companyName: extraOpts?.companyName,
    companyLogoUrl: extraOpts?.companyLogoUrl,
    companyAddress: extraOpts?.companyAddress,
    companyPhone: extraOpts?.companyPhone,
    companyEmail: extraOpts?.companyEmail,
    companyWebsite: extraOpts?.companyWebsite,
  };

  const c = resolveCompanyFields(opts);
  const orientation = opts.orientation ?? "portrait";
  const safeFilter = esc(filterSummary);

  return `
<style id="pdf-report-print-css">
@media print {
  body > *:not(#pdf-report-print-root) { display: none !important; }
  #pdf-report-print-root { display: block !important; }
  ${buildCorePrintCss(c.logoUrl, orientation)}
}
</style>
<div id="pdf-report-print-root" style="display:none;">
  <div class="pdf-page-break">
    ${c.logoUrl ? `<img class="pdf-watermark" src="${c.logoUrl}" alt="" aria-hidden="true" />` : ""}
    ${buildHeaderHtml(opts)}
    ${buildFooterHtml(opts)}
    <div class="pdf-body">
      ${safeFilter ? `<p class="pdf-filter-summary">${safeFilter}</p>` : ""}
      <!-- REPORT_CONTENT_PLACEHOLDER -->
    </div>
  </div>
</div>`;
}

/**
 * Builds header rows to prepend to Excel exports.
 * Returns 4 rows: company name, address, contact, then a blank spacer.
 * Returns empty array if no profile configured.
 */
export function buildBrandingExcelRows(
  companyProfile: CompanyProfile | null,
): Record<string, string>[] {
  if (!companyProfile) return [];

  const contactLine = [
    companyProfile.contactNumber ? `Tel: ${companyProfile.contactNumber}` : "",
    companyProfile.emailId ? `Email: ${companyProfile.emailId}` : "",
    companyProfile.website ? `Web: ${companyProfile.website}` : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  return [
    { "": companyProfile.companyName },
    { "": companyProfile.address },
    { "": contactLine },
    { "": "" },
  ];
}
