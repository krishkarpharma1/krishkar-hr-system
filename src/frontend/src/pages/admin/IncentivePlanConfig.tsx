import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role, TargetPeriod } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { IncentiveType } from "../../types";
import type { IncentivePlan, IncentiveSlab } from "../../types";

const PERIOD_LABELS: Record<TargetPeriod, string> = {
  Monthly: "Monthly",
  Quarterly: "Quarterly",
  HalfYearly: "Half-Yearly",
  Yearly: "Yearly",
};

const MONTH_NAMES = [
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

const FIELD_ROLES = [Role.MR, Role.ASM, Role.RSM, Role.ZSM];
const CURRENT_YEAR = new Date().getFullYear();

function emptySlabs(): IncentiveSlab[] {
  return [
    {
      minAchievementPct: 0,
      maxAchievementPct: 79,
      incentiveType: IncentiveType.PercentOfTarget,
      value: 0,
    },
    {
      minAchievementPct: 80,
      maxAchievementPct: 89,
      incentiveType: IncentiveType.PercentOfTarget,
      value: 3,
    },
    {
      minAchievementPct: 90,
      maxAchievementPct: 99,
      incentiveType: IncentiveType.PercentOfTarget,
      value: 5,
    },
    {
      minAchievementPct: 100,
      maxAchievementPct: 999,
      incentiveType: IncentiveType.PercentOfTarget,
      value: 8,
    },
  ];
}

export default function IncentivePlanConfig({
  portalRole,
}: { portalRole?: Role }) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const role = portalRole ?? session?.role;

  const [selectedRole, setSelectedRole] = useState<Role>(Role.MR);
  const [selectedPeriod, setSelectedPeriod] = useState<TargetPeriod>(
    TargetPeriod.Monthly,
  );
  const [filterMonth, setFilterMonth] = useState<string>(
    String(new Date().getMonth() + 1),
  );
  const [filterYear, setFilterYear] = useState<string>(String(CURRENT_YEAR));
  const [plans, setPlans] = useState<IncentivePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [slabs, setSlabs] = useState<IncentiveSlab[]>(emptySlabs());
  const [showForm, setShowForm] = useState(false);
  const [newMonth, setNewMonth] = useState<string>(
    String(new Date().getMonth() + 1),
  );
  const [newYear, setNewYear] = useState<string>(String(CURRENT_YEAR));

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.listIncentivePlans(
        token,
        selectedRole,
        selectedPeriod,
      );
      setPlans(data);
    } catch {
      toast.error("Failed to load incentive plans");
    } finally {
      setLoading(false);
    }
  }, [token, selectedRole, selectedPeriod]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPlans = plans.filter((p) => {
    if (selectedPeriod !== TargetPeriod.Monthly) return true;
    return (
      Number(p.month) === Number(filterMonth) &&
      Number(p.year) === Number(filterYear)
    );
  });

  function updateSlab(
    idx: number,
    field: keyof IncentiveSlab,
    value: string | number,
  ) {
    setSlabs((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  }
  function addSlab() {
    setSlabs((prev) => [
      ...prev,
      {
        minAchievementPct: 0,
        maxAchievementPct: 100,
        incentiveType: IncentiveType.PercentOfTarget,
        value: 0,
      },
    ]);
  }
  function removeSlab(idx: number) {
    setSlabs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (slabs.length === 0) {
      toast.error("Add at least one slab");
      return;
    }
    if (!newMonth || !newYear) {
      toast.error("Select month and year");
      return;
    }
    setSaving(true);
    try {
      const result = await api.createIncentivePlan(token, {
        role: selectedRole,
        period: selectedPeriod,
        month: BigInt(newMonth),
        year: BigInt(newYear),
        slabs: slabs.map((s) => ({
          ...s,
          incentiveType: IncentiveType.PercentOfTarget,
        })),
      });
      if (result.__kind__ === "err") {
        toast.error(result.err);
        return;
      }
      toast.success(
        `Incentive plan created for ${MONTH_NAMES[Number(newMonth) - 1]} ${newYear}`,
      );
      setShowForm(false);
      setSlabs(emptySlabs());
      await load();
    } catch {
      toast.error("Failed to create plan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(plan: IncentivePlan) {
    if (!confirm("Deactivate this incentive plan?")) return;
    try {
      const result = await api.deactivateIncentivePlan(token, plan.id);
      if (result.__kind__ === "err") {
        toast.error(result.err);
        return;
      }
      toast.success("Plan deactivated");
      await load();
    } catch {
      toast.error("Failed to deactivate");
    }
  }

  async function handleCalculateTargets() {
    const month = Number(filterMonth);
    const year = Number(filterYear);
    if (!month || !year) {
      toast.error("Select month and year to calculate");
      return;
    }
    setCalculating(true);
    try {
      const result = await api.calculateBottomUpIncentiveTargets(
        token,
        BigInt(year),
        BigInt(month),
      );
      if (result.__kind__ === "err") {
        toast.error(result.err);
        return;
      }
      toast.success(
        `Target aggregation completed for ${MONTH_NAMES[month - 1]} ${year}. ${result.ok} targets updated.`,
      );
    } catch (e) {
      toast.error(String(e) || "Calculation failed");
    } finally {
      setCalculating(false);
    }
  }

  function isLegacy(plan: IncentivePlan) {
    return plan.slabs.some(
      (s) => s.incentiveType !== IncentiveType.PercentOfTarget,
    );
  }

  return (
    <PortalLayout portalRole={role ?? Role.Admin}>
      <PageHeader
        title="Incentive Plan Configuration"
        subtitle="Configure role-wise and period-wise incentive slabs (% of monthly sales target)"
        actions={
          <Button
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            data-ocid="btn-add-plan"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {showForm ? "Cancel" : "New Plan"}
          </Button>
        }
      />
      <PageContent>
        {/* Filter bar */}
        <SectionCard title="Filter Plans">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as Role)}
              >
                <SelectTrigger className="w-36" data-ocid="select-plan-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period</Label>
              <Select
                value={selectedPeriod}
                onValueChange={(v) => setSelectedPeriod(v as TargetPeriod)}
              >
                <SelectTrigger className="w-40" data-ocid="select-plan-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TargetPeriod).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPeriod === TargetPeriod.Monthly && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Month</Label>
                  <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger
                      className="w-36"
                      data-ocid="filter-plan-month"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((m, i) => (
                        <SelectItem key={String(i + 1)} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Year</Label>
                  <Input
                    type="number"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="w-24"
                    min="2020"
                    max="2099"
                    data-ocid="filter-plan-year"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-end gap-1.5"
                  onClick={handleCalculateTargets}
                  disabled={calculating}
                  data-ocid="btn-calculate-targets"
                >
                  <Calculator className="w-4 h-4" />
                  {calculating ? "Calculating…" : "Calculate Bottom-Up Targets"}
                </Button>
              </>
            )}
          </div>
        </SectionCard>

        {/* New Plan form */}
        {showForm && (
          <SectionCard
            title={`New Plan — ${selectedRole} / ${PERIOD_LABELS[selectedPeriod]}`}
          >
            <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-primary font-body font-medium mb-1">
                Incentive = Achievement Slab % × Monthly Sales Target
              </p>
              <p className="text-xs text-muted-foreground">
                Example: 5% slab on ₹1,00,000 target ={" "}
                <strong className="text-foreground">₹5,000 incentive</strong>
              </p>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Month <span className="text-destructive">*</span>
                </Label>
                <Select value={newMonth} onValueChange={setNewMonth}>
                  <SelectTrigger className="w-40" data-ocid="new-plan-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={String(i + 1)} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Year <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  className="w-24"
                  min="2020"
                  max="2099"
                  data-ocid="new-plan-year"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    {[
                      "Min Achievement %",
                      "Max Achievement %",
                      "% of Monthly Sales Target",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs uppercase tracking-wider font-display text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {slabs.map((slab, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          max="999"
                          value={slab.minAchievementPct}
                          onChange={(e) =>
                            updateSlab(
                              idx,
                              "minAchievementPct",
                              Number(e.target.value),
                            )
                          }
                          className="h-8 w-20"
                          data-ocid={`slab-min-${idx}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          max="999"
                          value={slab.maxAchievementPct}
                          onChange={(e) =>
                            updateSlab(
                              idx,
                              "maxAchievementPct",
                              Number(e.target.value),
                            )
                          }
                          className="h-8 w-20"
                          data-ocid={`slab-max-${idx}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={slab.value}
                            onChange={(e) =>
                              updateSlab(idx, "value", Number(e.target.value))
                            }
                            className="h-8 w-24"
                            data-ocid={`slab-value-${idx}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            % of target
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeSlab(idx)}
                          className="text-destructive hover:text-destructive/80"
                          aria-label="Remove slab"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSlab}
                data-ocid="btn-add-slab"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Slab
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={saving}
                data-ocid="btn-save-plan"
              >
                {saving ? "Saving…" : "Create Plan"}
              </Button>
            </div>
          </SectionCard>
        )}

        {/* Plans list */}
        <SectionCard
          title={`Plans — ${selectedRole} / ${PERIOD_LABELS[selectedPeriod]}${selectedPeriod === TargetPeriod.Monthly ? ` / ${MONTH_NAMES[Number(filterMonth) - 1]} ${filterYear}` : ""}`}
        >
          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : filteredPlans.length === 0 ? (
            <div
              className="py-10 text-center text-muted-foreground text-sm"
              data-ocid="no-plans"
            >
              No incentive plans found for the selected filters
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPlans.map((plan) => {
                const legacy = isLegacy(plan);
                return (
                  <div
                    key={String(plan.id)}
                    className="border border-border rounded-lg overflow-hidden"
                    data-ocid={`plan-${plan.id}`}
                  >
                    <div className="bg-muted/30 px-4 py-2.5 flex items-center justify-between border-b border-border">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
                          {plan.role}
                        </Badge>
                        <Badge className="text-xs bg-accent/10 text-accent border-accent/30">
                          {PERIOD_LABELS[plan.period]}
                        </Badge>
                        {plan.month && Number(plan.month) > 0 && (
                          <Badge className="text-xs bg-muted/60 text-foreground border-border">
                            {MONTH_NAMES[Number(plan.month) - 1]}{" "}
                            {String(plan.year)}
                          </Badge>
                        )}
                        <Badge
                          className={`text-xs ${plan.isActive ? "bg-green-100 text-green-700 border-green-300" : "bg-muted text-muted-foreground border-border"}`}
                        >
                          {plan.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {legacy && (
                          <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                            Legacy (fixed ₹)
                          </Badge>
                        )}
                        {!legacy && (
                          <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                            % of Sales Target
                          </Badge>
                        )}
                      </div>
                      {plan.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => handleDeactivate(plan)}
                          data-ocid={`btn-deactivate-plan-${plan.id}`}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                    {!legacy && (
                      <div className="px-4 py-2 bg-primary/5 text-xs text-primary border-b border-border font-body">
                        Formula: Incentive = <strong>Slab %</strong> × Monthly
                        Sales Target
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[400px]">
                        <thead>
                          <tr className="border-b border-border bg-muted/10">
                            {[
                              "Min %",
                              "Max %",
                              legacy ? "Value" : "% of Sales Target",
                              "Example (₹1L target)",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-4 py-2 text-left text-xs text-muted-foreground font-display"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {plan.slabs.map((slab, i) => (
                            <tr key={i} className="hover:bg-muted/10">
                              <td className="px-4 py-2 font-mono text-sm">
                                {slab.minAchievementPct}%
                              </td>
                              <td className="px-4 py-2 font-mono text-sm">
                                {slab.maxAchievementPct >= 999
                                  ? "100%+"
                                  : `${slab.maxAchievementPct}%`}
                              </td>
                              <td className="px-4 py-2 font-mono font-semibold text-foreground">
                                {legacy
                                  ? slab.incentiveType === "Fixed"
                                    ? `₹${slab.value.toLocaleString("en-IN")}`
                                    : `${slab.value}%`
                                  : `${slab.value}%`}
                              </td>
                              <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                                {legacy
                                  ? "—"
                                  : `₹${((slab.value / 100) * 100000).toLocaleString("en-IN")}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </PageContent>
    </PortalLayout>
  );
}
