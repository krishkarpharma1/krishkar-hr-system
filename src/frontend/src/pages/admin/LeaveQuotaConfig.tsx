import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Info, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

const QUOTA_ROLES = ["MR", "ASM", "RSM", "ZSM", "HRManager", "Admin"] as const;

type QuotaRole = (typeof QUOTA_ROLES)[number];

const ROLE_LABELS: Record<QuotaRole, string> = {
  MR: "Medical Representative",
  ASM: "Area Sales Manager",
  RSM: "Regional Sales Manager",
  ZSM: "Zonal Sales Manager",
  HRManager: "HR Manager",
  Admin: "Administrator",
};

// Default reasonable quotas per role (days per year)
const DEFAULT_QUOTAS: Record<
  QuotaRole,
  {
    casual: number;
    sick: number;
    pl: number;
    ml: number;
    lwp: number;
    co: number;
    unpaid: number;
  }
> = {
  MR: { casual: 12, sick: 10, pl: 15, ml: 90, lwp: 18, co: 5, unpaid: 0 },
  ASM: { casual: 12, sick: 10, pl: 15, ml: 90, lwp: 18, co: 5, unpaid: 0 },
  RSM: { casual: 12, sick: 10, pl: 15, ml: 90, lwp: 18, co: 5, unpaid: 0 },
  ZSM: { casual: 12, sick: 10, pl: 15, ml: 90, lwp: 18, co: 5, unpaid: 0 },
  HRManager: {
    casual: 12,
    sick: 10,
    pl: 15,
    ml: 90,
    lwp: 18,
    co: 5,
    unpaid: 0,
  },
  Admin: { casual: 12, sick: 10, pl: 15, ml: 90, lwp: 18, co: 5, unpaid: 0 },
};

type QuotaRow = {
  casual: string;
  sick: string;
  pl: string;
  ml: string;
  lwp: string;
  co: string;
  unpaid: string;
};
type QuotaMap = Record<QuotaRole, QuotaRow>;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [
  String(CURRENT_YEAR),
  String(CURRENT_YEAR + 1),
  String(CURRENT_YEAR - 1),
];

function defaultQuotaMap(): QuotaMap {
  const map = {} as QuotaMap;
  for (const role of QUOTA_ROLES) {
    map[role] = {
      casual: String(DEFAULT_QUOTAS[role].casual),
      sick: String(DEFAULT_QUOTAS[role].sick),
      pl: String(DEFAULT_QUOTAS[role].pl),
      ml: String(DEFAULT_QUOTAS[role].ml),
      lwp: String(DEFAULT_QUOTAS[role].lwp),
      co: String(DEFAULT_QUOTAS[role].co),
      unpaid: String(DEFAULT_QUOTAS[role].unpaid),
    };
  }
  return map;
}

const inputClass =
  "w-full border border-input bg-background text-foreground rounded-md px-3 py-2 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors";

export default function LeaveQuotaConfig() {
  const { session } = useAuthStore();
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [quotas, setQuotas] = useState<QuotaMap>(defaultQuotaMap());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadQuotas = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    const map = defaultQuotaMap();
    await Promise.all(
      QUOTA_ROLES.map(async (role) => {
        try {
          const res = await api.getRoleLeaveQuota(
            session.token,
            role as (typeof Role)[keyof typeof Role],
            BigInt(selectedYear),
          );
          if (res.__kind__ === "ok") {
            map[role] = {
              casual: String(res.ok.casualTotal),
              sick: String(res.ok.sickTotal),
              pl: String(res.ok.plTotal ?? 0),
              ml: String(res.ok.mlTotal ?? 0),
              lwp: String(res.ok.lwpTotal ?? 0),
              co: String(res.ok.coTotal ?? 0),
              unpaid: String(res.ok.unpaidTotal ?? 0),
            };
          }
        } catch {
          // keep defaults for this role
        }
      }),
    );
    setQuotas(map);
    setLoading(false);
  }, [session?.token, selectedYear]);

  useEffect(() => {
    loadQuotas();
  }, [loadQuotas]);

  function handleChange(role: QuotaRole, field: keyof QuotaRow, value: string) {
    setQuotas((prev) => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
  }

  async function handleSave() {
    if (!session?.token) return;
    setSaving(true);
    let errors = 0;
    await Promise.all(
      QUOTA_ROLES.map(async (role) => {
        try {
          const res = await api.setRoleLeaveQuota(session.token, {
            role: role as (typeof Role)[keyof typeof Role],
            year: BigInt(selectedYear),
            casualTotal: BigInt(Number(quotas[role].casual) || 0),
            sickTotal: BigInt(Number(quotas[role].sick) || 0),
            plTotal: BigInt(Number(quotas[role].pl) || 0),
            mlTotal: BigInt(Number(quotas[role].ml) || 0),
            lwpTotal: BigInt(Number(quotas[role].lwp) || 0),
            coTotal: BigInt(Number(quotas[role].co) || 0),
            unpaidTotal: BigInt(Number(quotas[role].unpaid) || 0),
          });
          if (res.__kind__ === "err") {
            errors++;
          }
        } catch {
          errors++;
        }
      }),
    );
    setSaving(false);
    if (errors === 0) {
      toast.success(`Leave quotas saved for year ${selectedYear}`);
    } else {
      toast.error(`${errors} role(s) failed to save. Please try again.`);
    }
  }

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Leave Quota Configuration"
        subtitle="Set per-role leave entitlements for each leave type"
      />
      <PageContent>
        <div className="max-w-3xl">
          {/* Year selector */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="text-sm font-display font-medium text-foreground">
                Configure quotas for year:
              </span>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger
                className="w-[120px]"
                data-ocid="quota-year-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6">
            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground font-body">
              Changes apply to <strong>all existing and new users</strong> of
              each role for the selected year. Individual overrides are not
              supported — these are role-level defaults.
            </p>
          </div>

          {/* Quota table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider w-44">
                      Role
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      CL (days)
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      SL (days)
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      PL (days)
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      ML (days)
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      LWP (days)
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      CO (days)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {QUOTA_ROLES.map((role, idx) => (
                    <tr
                      key={role}
                      className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-display font-semibold bg-primary/10 text-primary border border-primary/20">
                            {role}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1 font-body">
                            {ROLE_LABELS[role]}
                          </p>
                        </div>
                      </td>
                      {(
                        ["casual", "sick", "pl", "ml", "lwp", "co"] as const
                      ).map((field) => (
                        <td key={field} className="px-3 py-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={loading ? "" : quotas[role][field]}
                            onChange={(e) =>
                              handleChange(role, field, e.target.value)
                            }
                            disabled={loading}
                            placeholder="0"
                            className={inputClass}
                            data-ocid={`quota-${role.toLowerCase()}-${field}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary row */}
          <div className="bg-muted/30 border border-border rounded-lg px-4 py-3 mb-6">
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Industry Standard Reference (days/year)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-body text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">
                  Casual Leave (CL):
                </span>{" "}
                12 days
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Sick Leave (SL):
                </span>{" "}
                10 days
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Privilege Leave (PL):
                </span>{" "}
                15 days
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Maternity Leave (ML):
                </span>{" "}
                90 days
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Leave Without Pay (LWP):
                </span>{" "}
                18 days
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Compensatory Off (CO):
                </span>{" "}
                5 days
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={loading || saving}
              className="gap-2"
              data-ocid="save-quota-btn"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : `Save All Quotas for ${selectedYear}`}
            </Button>
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
