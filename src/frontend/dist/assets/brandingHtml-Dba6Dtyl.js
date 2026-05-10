function n(e){return e.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/&/g,"&amp;")}function u(){const e=new Date,i=String(e.getDate()).padStart(2,"0"),a=String(e.getMonth()+1).padStart(2,"0"),o=e.getFullYear(),t=String(e.getHours()).padStart(2,"0"),r=String(e.getMinutes()).padStart(2,"0");return`${i}-${a}-${o} ${t}:${r}`}function f(e){const i=e.companyProfile;return{name:e.companyName??(i==null?void 0:i.companyName)??"Krishkar Pharmaceuticals",logoUrl:e.companyLogoUrl??(i==null?void 0:i.logoUrl)??"",address:e.companyAddress??(i==null?void 0:i.address)??"",phone:e.companyPhone??(i==null?void 0:i.contactNumber)??"",email:e.companyEmail??(i==null?void 0:i.emailId)??"",website:e.companyWebsite??(i==null?void 0:i.website)??""}}function g(e,i){const a=i==="landscape"?"A4 landscape":"A4";return`
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif; font-size: 13px; color: #111;
    margin: 0;
    padding: 140px 0 80px 0;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  @page { size: ${a}; margin: 0 1.5cm; }
  @media print {
    @page { size: ${a}; margin: 0 1.5cm; }
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
  ${e?".pdf-watermark { display: block; }":".pdf-watermark { display: none; }"}
  `}function y(e){const i=f(e),a=n(i.name),o=i.address?n(i.address):"",t=i.phone?`Tel: ${n(i.phone)}`:"",r=i.email?`Email: ${n(i.email)}`:"",d=i.website?`Web: ${n(i.website)}`:"",l=[t,r,d].filter(Boolean).join("  &nbsp;|&nbsp;  "),c=e.docTitle?n(e.docTitle):"",s=e.period?n(e.period):"",p=e.employeeInfo?n(e.employeeInfo):"",m=e.refNo?n(e.refNo):"",h=!!(c||s||p||m);return`
<div class="pdf-header">
  <div class="pdf-header-top">
    ${i.logoUrl?`<div class="pdf-header-logo"><img src="${i.logoUrl}" alt="${a}" /></div>`:""}
    <div class="pdf-header-company">
      <h2>${a}</h2>
      ${o?`<p class="addr">${o}</p>`:""}
      ${l?`<p class="contact">${l}</p>`:""}
    </div>
  </div>
  <hr class="pdf-header-divider" />
  ${h?`
  <div class="pdf-header-meta">
    ${c?`<span class="meta-title">${c}</span>`:""}
    ${s?`<span class="meta-period">Period: ${s}</span>`:""}
    ${p?`<span class="meta-emp">${p}</span>`:""}
    ${m?`<span class="meta-refno">Ref No: ${m}</span>`:""}
  </div>`:""}
</div>`}function b(e){const i=f(e),a=u(),o=e.generatedBy?`${n(e.generatedBy)}${e.generatedByRole?` (${n(e.generatedByRole)})`:""}`:"",t=e.confidentialityNotice??"This document is confidential and intended for internal use only.",r=e.footerTagline??`Powered by ${n(i.name)}`;return`
<div class="pdf-footer">
  <hr class="pdf-footer-divider" />
  <div class="pdf-footer-inner">
    <div class="pdf-footer-left">
      Generated On: ${a}
      ${o?`<br/>Generated By: ${o}`:""}
    </div>
    <div class="pdf-footer-center">
      ${n(t)}
    </div>
    <div class="pdf-footer-right">
      <span class="pdf-pageno"></span>
    </div>
  </div>
  <div class="pdf-footer-tagline">${r}</div>
</div>`}function $(e){if(e.docType!=="letter")return"";const i=e.signatoryName??n(f(e).name),a=e.signatoryDesignation??"Authorized Signatory";return`
<div class="letter-signatory">
  <div class="letter-signatory-line"></div>
  <p style="margin:0;font-size:12px;font-weight:bold;">${n(i)}</p>
  <p style="margin:2px 0;font-size:11px;color:#555;">${n(a)}</p>
</div>`}function v(e,i,a,o,t,r){let d;e&&typeof e=="object"&&("docTitle"in e||"companyProfile"in e||"companyName"in e)?d=e:d={companyProfile:e,docTitle:i,period:a,employeeInfo:o,generatedBy:t,generatedByRole:r,docType:"report"};const l=f(d),c=d.orientation??"portrait";return`<style>
  ${g(l.logoUrl,c)}
</style>
${l.logoUrl?`<img class="pdf-watermark" src="${l.logoUrl}" alt="" aria-hidden="true" />`:""}
${y(d)}
${b(d)}
${d.docType==="letter"?$(d):""}`}function w(e,i,a,o){const t={companyProfile:a,docTitle:e,docType:(o==null?void 0:o.docType)??"report",period:o==null?void 0:o.period,employeeInfo:o==null?void 0:o.employeeInfo,generatedBy:o==null?void 0:o.generatedBy,generatedByRole:o==null?void 0:o.generatedByRole,refNo:o==null?void 0:o.refNo,orientation:o==null?void 0:o.orientation,confidentialityNotice:o==null?void 0:o.confidentialityNotice,footerTagline:o==null?void 0:o.footerTagline,companyName:o==null?void 0:o.companyName,companyLogoUrl:o==null?void 0:o.companyLogoUrl,companyAddress:o==null?void 0:o.companyAddress,companyPhone:o==null?void 0:o.companyPhone,companyEmail:o==null?void 0:o.companyEmail,companyWebsite:o==null?void 0:o.companyWebsite},r=f(t),d=t.orientation??"portrait",l=n(i);return`
<style id="pdf-report-print-css">
@media print {
  body > *:not(#pdf-report-print-root) { display: none !important; }
  #pdf-report-print-root { display: block !important; }
  ${g(r.logoUrl,d)}
}
</style>
<div id="pdf-report-print-root" style="display:none;">
  <div class="pdf-page-break">
    ${r.logoUrl?`<img class="pdf-watermark" src="${r.logoUrl}" alt="" aria-hidden="true" />`:""}
    ${y(t)}
    ${b(t)}
    <div class="pdf-body">
      ${l?`<p class="pdf-filter-summary">${l}</p>`:""}
      <!-- REPORT_CONTENT_PLACEHOLDER -->
    </div>
  </div>
</div>`}function k(e){if(!e)return[];const i=[e.contactNumber?`Tel: ${e.contactNumber}`:"",e.emailId?`Email: ${e.emailId}`:"",e.website?`Web: ${e.website}`:""].filter(Boolean).join("  |  ");return[{"":e.companyName},{"":e.address},{"":i},{"":""}]}export{v as a,k as b,w as c};
