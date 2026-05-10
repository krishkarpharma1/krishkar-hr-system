import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { Construction, Settings2 } from "lucide-react";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";

export default function ExpensePolicyConfig() {
  const navigate = useNavigate();
  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader title="Expense Policy Configuration" />
      <PageContent>
        <div
          className="flex flex-col items-center justify-center py-20 text-center px-4"
          data-ocid="expense-policy.empty_state"
        >
          <div className="p-4 rounded-full bg-primary/10 mb-5">
            <Construction className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-2">
            Expense Policy Configuration
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-1">
            Configure expense claim rules, per-diem limits, and allowable
            expense categories for all field force roles.
          </p>
          <p className="text-xs text-muted-foreground/70 mb-6 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Coming soon — this feature is under development.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "." })}
            data-ocid="expense-policy.back_button"
          >
            ← Back to Admin Dashboard
          </Button>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
