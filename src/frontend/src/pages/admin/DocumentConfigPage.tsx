import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Eye,
  FileText,
  LayoutTemplate,
  Save,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

const inputClass =
  "w-full border border-input bg-background text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors placeholder:text-muted-foreground disabled:opacity-60";

const labelClass =
  "block text-sm font-display font-medium text-foreground mb-1";

interface ConfigState {
  companyName: string;
  address: string;
  contactNumber: string;
  emailId: string;
  website: string;
  logoUrl: string | null;
  confidentialityNotice: string;
  footerTagline: string;
}

const DEFAULT_STATE: ConfigState = {
  companyName: "",
  address: "",
  contactNumber: "",
  emailId: "",
  website: "",
  logoUrl: null,
  confidentialityNotice:
    "This document is confidential and intended for internal use only.",
  footerTagline: "Powered by Krishkar Pharmaceuticals",
};

function FieldGroup({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-muted-foreground mt-1 font-body">{hint}</p>
      )}
    </div>
  );
}

export default function DocumentConfigPage() {
  const { session } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigState>(DEFAULT_STATE);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Load existing profile
  useEffect(() => {
    if (!session?.token) return;
    api
      .getCompanyProfile(session.token)
      .then((profile) => {
        if (profile) {
          setConfig({
            companyName: profile.companyName ?? "",
            address: profile.address ?? "",
            contactNumber: profile.contactNumber ?? "",
            emailId: profile.emailId ?? "",
            website: profile.website ?? "",
            logoUrl: profile.logoUrl ?? null,
            confidentialityNotice:
              "This document is confidential and intended for internal use only.",
            footerTagline: `Powered by ${profile.companyName ?? "Krishkar Pharmaceuticals"}`,
          });
          setLogoPreview(profile.logoUrl ?? null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.token]);

  function update(field: keyof ConfigState, value: string | null) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 400;
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL("image/jpeg", 0.75);
          update("logoUrl", compressed);
          setLogoPreview(compressed);
        } else {
          update("logoUrl", dataUrl);
          setLogoPreview(dataUrl);
        }
      };
      img.onerror = () => {
        update("logoUrl", dataUrl);
        setLogoPreview(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!session?.token) return;
    if (!config.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!config.address.trim()) {
      toast.error("Address is required");
      return;
    }
    if (!config.contactNumber.trim()) {
      toast.error("Contact number is required");
      return;
    }
    const logoTooLarge =
      config.logoUrl?.startsWith("data:") === true &&
      config.logoUrl.length > 1_500_000;
    if (logoTooLarge) {
      toast.error(
        "Logo image is too large. Please use an image smaller than 1 MB.",
      );
      return;
    }

    setSaving(true);
    try {
      const result = await api.setCompanyProfile(session.token, {
        companyName: config.companyName.trim(),
        address: config.address.trim(),
        contactNumber: config.contactNumber.trim(),
        emailId: config.emailId.trim() || undefined,
        website: config.website.trim() || undefined,
        logoUrl: config.logoUrl ?? undefined,
      });
      if (result.__kind__ === "ok") {
        toast.success(
          "Document configuration saved — all future exports will use these settings.",
        );
      } else {
        toast.error(`Save failed: ${result.err ?? "Unknown error"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("size") ||
        msg.toLowerCase().includes("too large")
      ) {
        toast.error(
          "Image is too large to save. Please upload a smaller logo (under 500 KB).",
        );
      } else {
        toast.error(`Save failed: ${msg || "Please try again."}`);
      }
    } finally {
      setSaving(false);
    }
  }

  // Derived preview data
  const previewName = config.companyName || "Company Name";
  const now = new Date();
  const previewDate = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Document Header & Footer Config"
        subtitle="Configure company branding used on all exported PDFs and official letters"
      />
      <PageContent>
        <div className="max-w-3xl space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
            <LayoutTemplate className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground font-body">
              These settings control the header and footer that appear on
              <strong> every page</strong> of every exported report (PDF) and
              official letter. Changes take effect immediately on the next
              export.
            </p>
          </div>

          {/* ── HEADER SECTION ── */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-display font-semibold text-foreground">
                Header Configuration
              </h3>
              <span className="text-xs text-muted-foreground font-body ml-1">
                — appears at the top of every page
              </span>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Logo upload */}
              <div>
                <p className={labelClass}>Company Logo</p>
                <div className="flex items-start gap-5">
                  <div className="w-[120px] h-[72px] border border-border rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="max-h-[72px] max-w-[120px] object-contain"
                      />
                    ) : (
                      <Building2 className="w-8 h-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                      data-ocid="doc-config.logo-file-input"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                      data-ocid="doc-config.logo-upload-btn"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Logo
                    </Button>
                    {logoPreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                        onClick={() => {
                          update("logoUrl", null);
                          setLogoPreview(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        data-ocid="doc-config.logo-remove-btn"
                      >
                        Remove
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground font-body">
                      PNG, JPG or GIF. Max 2 MB. Will be scaled to max-height:
                      56px in the PDF.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-9 rounded-md" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <FieldGroup
                      label="Company Name *"
                      htmlFor="dc-company-name"
                    >
                      <input
                        id="dc-company-name"
                        type="text"
                        value={config.companyName}
                        onChange={(e) => update("companyName", e.target.value)}
                        placeholder="e.g. Krishkar Pharmaceuticals Pvt. Ltd."
                        className={inputClass}
                        data-ocid="doc-config.company-name-input"
                      />
                    </FieldGroup>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldGroup label="Address *" htmlFor="dc-address">
                      <textarea
                        id="dc-address"
                        value={config.address}
                        onChange={(e) => update("address", e.target.value)}
                        placeholder="Full company address including city, state and PIN code"
                        rows={2}
                        className={`${inputClass} resize-none`}
                        data-ocid="doc-config.address-input"
                      />
                    </FieldGroup>
                  </div>
                  <FieldGroup label="Contact Number *" htmlFor="dc-phone">
                    <input
                      id="dc-phone"
                      type="tel"
                      value={config.contactNumber}
                      onChange={(e) => update("contactNumber", e.target.value)}
                      placeholder="+91 98765 43210"
                      className={inputClass}
                      data-ocid="doc-config.phone-input"
                    />
                  </FieldGroup>
                  <FieldGroup label="Email" htmlFor="dc-email">
                    <input
                      id="dc-email"
                      type="email"
                      value={config.emailId}
                      onChange={(e) => update("emailId", e.target.value)}
                      placeholder="info@company.com"
                      className={inputClass}
                      data-ocid="doc-config.email-input"
                    />
                  </FieldGroup>
                  <div className="sm:col-span-2">
                    <FieldGroup label="Website" htmlFor="dc-website">
                      <input
                        id="dc-website"
                        type="url"
                        value={config.website}
                        onChange={(e) => update("website", e.target.value)}
                        placeholder="https://www.company.com"
                        className={inputClass}
                        data-ocid="doc-config.website-input"
                      />
                    </FieldGroup>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── FOOTER SECTION ── */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-display font-semibold text-foreground">
                Footer Configuration
              </h3>
              <span className="text-xs text-muted-foreground font-body ml-1">
                — appears at the bottom of every page
              </span>
            </div>

            <div className="px-6 py-5 space-y-4">
              <FieldGroup
                label="Confidentiality Notice"
                htmlFor="dc-confidentiality"
                hint="This text appears in the footer on every exported page."
              >
                <textarea
                  id="dc-confidentiality"
                  value={config.confidentialityNotice}
                  onChange={(e) =>
                    update("confidentialityNotice", e.target.value)
                  }
                  rows={2}
                  className={`${inputClass} resize-none`}
                  data-ocid="doc-config.confidentiality-input"
                />
              </FieldGroup>
              <FieldGroup
                label="Footer Tagline / Powered-by Text"
                htmlFor="dc-tagline"
                hint="Shown below the confidentiality notice in small print."
              >
                <input
                  id="dc-tagline"
                  type="text"
                  value={config.footerTagline}
                  onChange={(e) => update("footerTagline", e.target.value)}
                  placeholder={`Powered by ${previewName}`}
                  className={inputClass}
                  data-ocid="doc-config.tagline-input"
                />
              </FieldGroup>
              <p className="text-xs text-muted-foreground font-body bg-muted/30 rounded px-3 py-2">
                The footer also automatically includes: Page X of Y &middot;
                Generated On (DD-MM-YYYY HH:MM) &middot; Generated By (name
                &amp; role) — these are populated dynamically at export time.
              </p>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={loading || saving}
              className="gap-2"
              data-ocid="doc-config.save-btn"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Configuration"}
            </Button>
          </div>

          {/* ── LIVE PREVIEW ── */}
          {!loading && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-display font-semibold text-foreground">
                  Live Preview
                </h3>
                <span className="text-xs text-muted-foreground font-body ml-1">
                  — approximate appearance on exported documents
                </span>
              </div>
              <div className="p-5">
                {/* Header preview */}
                <div className="border border-border rounded-lg overflow-hidden mb-4">
                  <div className="bg-white px-4 pt-3 pb-1 border-b-2 border-sky-400">
                    <div className="flex items-start gap-3 mb-2">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-[50px] max-w-[130px] object-contain flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 flex items-center justify-center bg-primary/10 border border-primary/20 rounded flex-shrink-0">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-base text-sky-700 leading-tight">
                          {config.companyName || "Company Name"}
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                          {config.address || "Company Address"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {config.contactNumber &&
                            `Tel: ${config.contactNumber}`}
                          {config.emailId && ` | Email: ${config.emailId}`}
                          {config.website && ` | Web: ${config.website}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 pb-1">
                      <span className="text-sm font-bold text-slate-700">
                        Monthly Doctor Call Report
                      </span>
                      <span className="text-[10px] text-muted-foreground italic">
                        Period: April 2026
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Dr. Ramesh Kumar — MR · Mumbai East HQ
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto italic">
                        Ref No: HR/2026/00123
                      </span>
                    </div>
                  </div>

                  {/* Page body placeholder */}
                  <div className="bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground italic">
                    ← Report content renders here →
                  </div>

                  {/* Footer preview */}
                  <div className="bg-sky-50 px-4 pt-0.5 pb-2 border-t-2 border-sky-400">
                    <div className="flex items-center justify-between gap-4 text-[9px] text-muted-foreground">
                      <span className="leading-tight">
                        Generated On: {previewDate}
                        <br />
                        Generated By: John Admin (Admin)
                      </span>
                      <span className="flex-1 text-center italic leading-tight">
                        {config.confidentialityNotice ||
                          "This document is confidential and intended for internal use only."}
                      </span>
                      <span className="font-bold text-slate-500">
                        Page 1 of 3
                      </span>
                    </div>
                    <p className="text-[8px] text-slate-400 italic text-center mt-0.5">
                      {config.footerTagline ||
                        `Powered by ${config.companyName || "Company Name"}`}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground font-body">
                  This preview shows approximate rendering. The actual PDF may
                  differ slightly based on the print driver. Portrait A4 with
                  1.5cm side margins is the default.
                </p>
              </div>
            </div>
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
