import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Layers, Sparkles } from "lucide-react";
import type { Role } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";

interface Phase2PlaceholderProps {
  portalRole: Role;
  featureName: string;
  description?: string;
  category?: string;
}

export default function Phase2Placeholder({
  portalRole,
  featureName,
  description,
  category = "SFA Module",
}: Phase2PlaceholderProps) {
  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title={featureName}
        subtitle={description ?? "Sales Force Automation — coming soon"}
      />
      <PageContent>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          {/* Decorative ring */}
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Layers className="w-8 h-8 text-primary" />
              </div>
            </div>
            <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </span>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary font-display tracking-wide">
              {category}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-2xl font-bold font-display text-foreground mb-3 leading-tight">
            {featureName}
          </h2>

          {/* Body text */}
          <p className="text-muted-foreground font-body max-w-md leading-relaxed mb-2">
            {description ??
              `Track and manage ${featureName.toLowerCase()} across your team with full SFA integration.`}
          </p>
          <p className="text-sm font-semibold text-primary font-body">
            This feature is coming in Phase 2 of the SFA rollout. Stay tuned for
            updates.
          </p>

          {/* Phase 2 timeline card */}
          <div className="mt-8 w-full max-w-sm bg-card border border-border rounded-xl p-5 text-left shadow-sm">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-display mb-3">
              Phase 2 includes
            </p>
            <ul className="space-y-2 text-sm font-body text-foreground">
              {PHASE2_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Back button */}
          <Button
            variant="outline"
            className="mt-8 gap-2"
            onClick={() => window.history.back()}
            data-ocid="phase2.back_button"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
      </PageContent>
    </PortalLayout>
  );
}

const PHASE2_FEATURES = [
  "DCR – Daily Call Report submission & approval",
  "Chemist & Stockist call entry and coverage reports",
  "Sample & Gift allocation tracking",
  "Joint Field Work (JFW) entry and summary",
  "MTP vs Actual comparison report",
  "Doctor-Product coverage analysis",
  "KPI target dashboards with SFA metrics",
];
