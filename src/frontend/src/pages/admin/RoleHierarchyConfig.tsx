import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Info,
  RotateCcw,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { ROLE_LABELS } from "../../types";

const DEFAULT_ORDER: Role[] = [Role.MR, Role.ASM, Role.RSM, Role.ZSM];

const ROLE_BADGE_COLORS: Partial<Record<Role, string>> = {
  [Role.MR]: "bg-muted text-muted-foreground border-border",
  [Role.ASM]: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  [Role.RSM]: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  [Role.ZSM]: "bg-chart-3/20 text-chart-3 border-chart-3/30",
};

export default function RoleHierarchyConfig() {
  const { session } = useAuthStore();
  const [roleOrder, setRoleOrder] = useState<Role[]>(DEFAULT_ORDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session) return;
    api
      .getRoleHierarchyConfig(session.token)
      .then((cfg) => {
        if (cfg.roleOrder.length > 0) setRoleOrder(cfg.roleOrder);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    setRoleOrder((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index === roleOrder.length - 1) return;
    setRoleOrder((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleReset = () => {
    setRoleOrder([...DEFAULT_ORDER]);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const res = await api.setRoleHierarchyConfig(session.token, roleOrder);
      if (res.__kind__ === "ok") {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Role Hierarchy Configuration"
        subtitle="Configure the authority order used for 'Working With' selection"
      />
      <PageContent>
        <div className="max-w-2xl mx-auto">
          {/* Info panel */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 flex gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-display font-semibold text-foreground mb-1">
                How This Works
              </p>
              <p className="text-sm font-body text-muted-foreground">
                This order determines which higher authorities an employee can
                select in the "Working With" dropdown on their Daily Call
                Report. Employees can only select authorities ranked{" "}
                <strong>above</strong> their own role in this list. Drag the
                rows or use the arrows to reorder.
              </p>
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                Default order (lowest → highest): MR → ASM → RSM → ZSM
              </p>
            </div>
          </div>

          {/* Hierarchy list */}
          <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                Role Order (Low → High)
              </span>
              <span className="text-xs text-muted-foreground font-body">
                {roleOrder.length} roles configured
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm font-body">
                Loading configuration...
              </div>
            ) : (
              <ul
                className="divide-y divide-border"
                data-ocid="role-hierarchy-list"
              >
                {roleOrder.map((role, index) => (
                  <li
                    key={role}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/10 transition-colors"
                    data-ocid={`role-row-${role.toLowerCase()}`}
                  >
                    {/* Position badge */}
                    <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-semibold text-muted-foreground shrink-0">
                      {index + 1}
                    </span>

                    {/* Role info */}
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded border font-display font-medium ${ROLE_BADGE_COLORS[role] ?? "bg-muted text-muted-foreground border-border"}`}
                      >
                        {role}
                      </span>
                      <span className="text-sm font-body text-foreground truncate">
                        {ROLE_LABELS[role]}
                      </span>
                    </div>

                    {/* Rank label */}
                    <span className="text-xs text-muted-foreground font-body shrink-0">
                      {index === 0
                        ? "Lowest rank"
                        : index === roleOrder.length - 1
                          ? "Highest rank"
                          : `Rank ${index + 1}`}
                    </span>

                    {/* Controls */}
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={index === 0}
                        onClick={() => moveUp(index)}
                        aria-label={`Move ${role} up`}
                        data-ocid={`role-move-up-${role.toLowerCase()}`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        disabled={index === roleOrder.length - 1}
                        onClick={() => moveDown(index)}
                        aria-label={`Move ${role} down`}
                        data-ocid={`role-move-down-${role.toLowerCase()}`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Visual hierarchy preview */}
          <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6">
            <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-3">
              Current Hierarchy Preview
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {roleOrder.map((role, i) => (
                <div key={role} className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded border font-display font-medium ${ROLE_BADGE_COLORS[role] ?? "bg-muted text-muted-foreground border-border"}`}
                  >
                    {role}
                  </span>
                  {i < roleOrder.length - 1 && (
                    <span className="text-muted-foreground text-xs font-mono">
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-body">
              An MR working with "ASM" sees all roles from ASM onwards as
              selectable.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saving}
              className="flex-1 sm:flex-none"
              data-ocid="role-hierarchy-reset"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Default
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex-1 sm:flex-none"
              data-ocid="role-hierarchy-save"
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Configuration"}
                </>
              )}
            </Button>
          </div>

          {saved && (
            <div
              className="mt-4 bg-green-50 border border-green-300 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-green-700 font-body"
              data-ocid="role-hierarchy-saved-msg"
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              Role hierarchy saved. Employees will see the updated authority
              list on their next report.
            </div>
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
