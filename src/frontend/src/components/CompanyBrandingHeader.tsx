import { Building2 } from "lucide-react";
import type { CompanyProfile } from "../backend.d";

interface CompanyBrandingHeaderProps {
  companyProfile: CompanyProfile | null;
  /** Size variant — "print" uses larger text for print/PDF templates */
  variant?: "default" | "print";
}

export function CompanyBrandingHeader({
  companyProfile,
  variant = "default",
}: CompanyBrandingHeaderProps) {
  if (!companyProfile) return null;

  const isPrint = variant === "print";

  return (
    <div
      className={`flex items-start gap-4 ${isPrint ? "pb-4 mb-4 border-b-2 border-border" : "pb-3 mb-3 border-b border-border"}`}
      data-ocid="company-branding-header"
    >
      {/* Logo */}
      <div className="flex-shrink-0">
        {companyProfile.logoUrl ? (
          <img
            src={companyProfile.logoUrl}
            alt={`${companyProfile.companyName} logo`}
            className={`object-contain ${isPrint ? "h-20 max-w-[160px]" : "h-16 max-w-[120px]"}`}
          />
        ) : (
          <div
            className={`flex items-center justify-center bg-primary/10 border border-primary/20 rounded-lg ${isPrint ? "w-20 h-20" : "w-14 h-14"}`}
          >
            <Building2
              className={`text-primary ${isPrint ? "w-10 h-10" : "w-7 h-7"}`}
            />
          </div>
        )}
      </div>

      {/* Company details */}
      <div className="min-w-0 flex-1">
        <h1
          className={`font-display font-bold text-foreground leading-tight ${isPrint ? "text-xl" : "text-lg"}`}
        >
          {companyProfile.companyName}
        </h1>
        <p
          className={`text-muted-foreground leading-snug mt-0.5 ${isPrint ? "text-sm" : "text-xs"}`}
        >
          {companyProfile.address || ""}
        </p>
        <p
          className={`text-muted-foreground mt-0.5 ${isPrint ? "text-sm" : "text-xs"}`}
        >
          {companyProfile.contactNumber && (
            <span>Tel: {companyProfile.contactNumber}</span>
          )}
          {companyProfile.emailId && (
            <span className="ml-3">Email: {companyProfile.emailId}</span>
          )}
          {companyProfile.website && (
            <span className="ml-3">Web: {companyProfile.website}</span>
          )}
        </p>
      </div>
    </div>
  );
}
