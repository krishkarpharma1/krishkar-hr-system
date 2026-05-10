import { Button } from "@/components/ui/button";
import { Building2, Save, Upload } from "lucide-react";
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

export default function CompanyProfile() {
  const { session } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emailId, setEmailId] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;
    api
      .getCompanyProfile(session.token)
      .then((profile) => {
        if (profile) {
          setCompanyName(profile.companyName);
          setAddress(profile.address);
          setContactNumber(profile.contactNumber);
          setEmailId(profile.emailId ?? "");
          setWebsite(profile.website ?? "");
          setLogoUrl(profile.logoUrl ?? null);
          setLogoPreview(profile.logoUrl ?? null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.token]);

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
      // Compress the image via canvas to reduce data URL size
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
          setLogoUrl(compressed);
          setLogoPreview(compressed);
        } else {
          setLogoUrl(dataUrl);
          setLogoPreview(dataUrl);
        }
      };
      img.onerror = () => {
        setLogoUrl(dataUrl);
        setLogoPreview(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!session?.token) return;
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required");
      return;
    }
    if (!contactNumber.trim()) {
      toast.error("Contact number is required");
      return;
    }

    // Warn if logo data URL is too large (ICP canister message limit ~2MB)
    const logoTooLarge =
      logoUrl?.startsWith("data:") === true && logoUrl.length > 1_500_000;
    if (logoTooLarge) {
      toast.error(
        "Logo image is too large. Please use an image smaller than 1 MB.",
      );
      return;
    }

    setSaving(true);
    try {
      const result = await api.setCompanyProfile(session.token, {
        companyName: companyName.trim(),
        address: address.trim(),
        contactNumber: contactNumber.trim(),
        emailId: emailId.trim() || undefined,
        website: website.trim() || undefined,
        logoUrl: logoUrl ?? undefined,
      });
      if (result.__kind__ === "ok") {
        toast.success("Company profile saved successfully");
      } else {
        toast.error(
          `Save failed: ${result.err || "Unknown error from server"}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("size") ||
        msg.toLowerCase().includes("too large") ||
        msg.toLowerCase().includes("limit")
      ) {
        toast.error(
          "Image is too large to save. Please upload a smaller logo (under 500 KB).",
        );
      } else if (
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("session")
      ) {
        toast.error("Your session has expired. Please log in again.");
      } else {
        toast.error(`Save failed: ${msg || "Please try again."}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Company Profile"
        subtitle="Configure company branding for all reports and letter heads"
      />
      <PageContent>
        <div className="max-w-2xl">
          {/* Info banner */}
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6">
            <Building2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground font-body">
              This information appears automatically on all printed and exported
              reports — salary slips, DA reports, call reports, and official
              letters. Changes take effect immediately on the next print or
              export.
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Logo upload section */}
            <div className="px-6 py-5 border-b border-border">
              <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Company Logo
              </p>
              <div className="flex items-start gap-5">
                {/* Preview */}
                <div className="w-[120px] h-[80px] border border-border rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Company logo preview"
                      className="max-h-[80px] max-w-[120px] object-contain"
                    />
                  ) : (
                    <Building2 className="w-10 h-10 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                    data-ocid="logo-file-input"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                    data-ocid="logo-upload-btn"
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
                        setLogoUrl(null);
                        setLogoPreview(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      data-ocid="logo-remove-btn"
                    >
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or GIF. Max 2 MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Form fields */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Company Details
              </p>

              <div>
                <label className={labelClass} htmlFor="company-name">
                  Company Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={loading ? "" : companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. Krishkar Pharmaceuticals Pvt. Ltd."
                  className={inputClass}
                  data-ocid="company-name-input"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="company-address">
                  Address <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="company-address"
                  value={loading ? "" : address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={loading}
                  placeholder="Full company address including city, state and PIN code"
                  rows={3}
                  className={`${inputClass} resize-none`}
                  data-ocid="company-address-input"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="contact-number">
                  Contact Number <span className="text-destructive">*</span>
                </label>
                <input
                  id="contact-number"
                  type="tel"
                  value={loading ? "" : contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. +91 98765 43210"
                  className={inputClass}
                  data-ocid="contact-number-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="email-id">
                    Email ID{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="email-id"
                    type="email"
                    value={loading ? "" : emailId}
                    onChange={(e) => setEmailId(e.target.value)}
                    disabled={loading}
                    placeholder="info@company.com"
                    className={inputClass}
                    data-ocid="email-id-input"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="website">
                    Website{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="website"
                    type="url"
                    value={loading ? "" : website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={loading}
                    placeholder="https://www.company.com"
                    className={inputClass}
                    data-ocid="website-input"
                  />
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="px-6 py-4 bg-muted/20 border-t border-border flex justify-end">
              <Button
                onClick={handleSave}
                disabled={loading || saving}
                className="gap-2"
                data-ocid="company-profile-save-btn"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : "Save Company Profile"}
              </Button>
            </div>
          </div>

          {/* Preview */}
          {(companyName || logoPreview) && !loading && (
            <div className="mt-6">
              <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Report Header Preview
              </p>
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-start gap-4 pb-4 mb-4 border-b-2 border-border">
                  <div className="flex-shrink-0">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="h-[80px] max-w-[140px] object-contain"
                      />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center bg-primary/10 border border-primary/20 rounded-lg">
                        <Building2 className="w-8 h-8 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold text-lg text-foreground">
                      {companyName || "Company Name"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {address || "Company Address"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tel: {contactNumber || "Contact Number"}
                      {emailId && (
                        <span className="ml-3">Email: {emailId}</span>
                      )}
                      {website && <span className="ml-3">Web: {website}</span>}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  This header will appear on all printed reports and official
                  letters.
                </p>
              </div>
            </div>
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
