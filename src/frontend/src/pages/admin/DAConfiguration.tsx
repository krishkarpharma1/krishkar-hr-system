import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/currencyFormatter";
import { DollarSign, MapPin, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { getLocationPolicy, setLocationPolicy } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { DaConfig } from "../../types";

const DA_ROLES = ["MR", "ASM", "RSM", "ZSM"] as const;
type DaRole = (typeof DA_ROLES)[number];

const DEFAULT_RATES: Record<
  DaRole,
  { hqRate: number; exStationRate: number; outStationRate: number }
> = {
  MR: { hqRate: 250, exStationRate: 300, outStationRate: 500 },
  ASM: { hqRate: 250, exStationRate: 300, outStationRate: 500 },
  RSM: { hqRate: 250, exStationRate: 300, outStationRate: 1100 },
  ZSM: { hqRate: 250, exStationRate: 300, outStationRate: 1100 },
};

type RateRow = {
  hqRate: string;
  exStationRate: string;
  outStationRate: string;
};
type RateMap = Record<DaRole, RateRow>;

function toRateMap(configs: DaConfig[]): RateMap {
  const map: RateMap = {} as RateMap;
  for (const role of DA_ROLES) {
    const found = configs.find((c) => c.role === role);
    if (found) {
      map[role] = {
        hqRate: String(found.hqRate),
        exStationRate: String(found.exStationRate),
        outStationRate: String(found.outStationRate),
      };
    } else {
      const def = DEFAULT_RATES[role];
      map[role] = {
        hqRate: String(def.hqRate),
        exStationRate: String(def.exStationRate),
        outStationRate: String(def.outStationRate),
      };
    }
  }
  return map;
}

export default function DAConfiguration() {
  const { session } = useAuthStore();
  const [rates, setRates] = useState<RateMap>(toRateMap([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationPolicy, setLocationPolicyState] = useState<
    "mobile-only" | "all-devices"
  >(getLocationPolicy());

  useEffect(() => {
    api
      .getDaConfigs()
      .then((configs) => {
        setRates(toRateMap(configs));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleChange(role: DaRole, field: keyof RateRow, value: string) {
    setRates((prev) => ({
      ...prev,
      [role]: { ...prev[role], [field]: value },
    }));
  }

  async function handleSave() {
    if (!session?.token) return;
    setSaving(true);
    try {
      const configs: DaConfig[] = DA_ROLES.map((role) => ({
        role,
        hqRate: BigInt(Number(rates[role].hqRate) || 0),
        exStationRate: BigInt(Number(rates[role].exStationRate) || 0),
        outStationRate: BigInt(Number(rates[role].outStationRate) || 0),
      }));
      const result = await api.setDaConfigs(session.token, configs);
      if (result.__kind__ === "ok") {
        toast.success("DA rates saved successfully");
      } else {
        toast.error(`Failed to save: ${result.err}`);
      }
    } catch {
      toast.error("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full border border-input bg-background text-foreground rounded-md px-3 py-2 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors";

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="DA Rate Configuration"
        subtitle="Configure Daily Allowance rates by role and station type"
      />
      <PageContent>
        <div className="max-w-3xl">
          {/* Info banner */}
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6">
            <DollarSign className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground font-body">
              These rates are applied automatically when field staff submit
              Daily Call Reports. Changes take effect immediately for new report
              submissions.
            </p>
          </div>

          {/* Rate table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider w-24">
                      Role
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Head Quarter (₹)
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Ex Station (₹)
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Out Station (₹)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {DA_ROLES.map((role, idx) => (
                    <tr
                      key={role}
                      className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-display font-semibold bg-primary/10 text-primary border border-primary/20">
                          {role}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          data-ocid={`da-rate-${role.toLowerCase()}-hq`}
                          type="text"
                          inputMode="numeric"
                          value={loading ? "" : rates[role].hqRate}
                          onChange={(e) =>
                            handleChange(role, "hqRate", e.target.value)
                          }
                          disabled={loading}
                          placeholder="0"
                          className={inputClass}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          data-ocid={`da-rate-${role.toLowerCase()}-ex`}
                          type="text"
                          inputMode="numeric"
                          value={loading ? "" : rates[role].exStationRate}
                          onChange={(e) =>
                            handleChange(role, "exStationRate", e.target.value)
                          }
                          disabled={loading}
                          placeholder="0"
                          className={inputClass}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          data-ocid={`da-rate-${role.toLowerCase()}-out`}
                          type="text"
                          inputMode="numeric"
                          value={loading ? "" : rates[role].outStationRate}
                          onChange={(e) =>
                            handleChange(role, "outStationRate", e.target.value)
                          }
                          disabled={loading}
                          placeholder="0"
                          className={inputClass}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reference table */}
          <div className="bg-muted/30 border border-border rounded-lg px-4 py-3 mb-6">
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Default Reference Rates
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-body text-muted-foreground min-w-[400px]">
                <thead>
                  <tr>
                    <th className="text-left pr-4 pb-1 font-medium">Role</th>
                    <th className="text-right pr-4 pb-1 font-medium">HQ</th>
                    <th className="text-right pr-4 pb-1 font-medium">
                      Ex Station
                    </th>
                    <th className="text-right pb-1 font-medium">Out Station</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {DA_ROLES.map((role) => (
                    <tr key={role}>
                      <td className="pr-4 py-1">{role}</td>
                      <td className="pr-4 py-1 text-right font-mono">
                        {formatCurrency(DEFAULT_RATES[role].hqRate)}
                      </td>
                      <td className="pr-4 py-1 text-right font-mono">
                        {formatCurrency(DEFAULT_RATES[role].exStationRate)}
                      </td>
                      <td className="py-1 text-right font-mono">
                        {formatCurrency(DEFAULT_RATES[role].outStationRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              data-ocid="da-save-btn"
              onClick={handleSave}
              disabled={loading || saving}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save All Rates"}
            </Button>
          </div>

          {/* Location Enforcement Policy */}
          <div className="mt-8 bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
                Location Enforcement Policy
              </h3>
            </div>
            <div className="px-4 py-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Control when GPS/location is strictly required. On desktop
                computers, GPS is typically unavailable — this setting lets you
                decide whether to block submissions or allow fallback.
              </p>
              <div className="flex flex-col gap-3">
                {(
                  [
                    {
                      value: "mobile-only",
                      label: "Mobile Only (recommended)",
                      desc: "GPS is required on mobile devices. Desktop users can submit without precise GPS — an approximate location is used if available.",
                    },
                    {
                      value: "all-devices",
                      label: "All Devices",
                      desc: "GPS is required on all devices including desktops. Desktop users will be blocked if location cannot be obtained.",
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      locationPolicy === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted/30"
                    }`}
                    data-ocid={`location-policy-${opt.value}`}
                  >
                    <input
                      type="radio"
                      name="location-policy"
                      value={opt.value}
                      checked={locationPolicy === opt.value}
                      onChange={() => {
                        setLocationPolicyState(opt.value);
                        setLocationPolicy(opt.value);
                        toast.success(
                          `Location policy updated to: ${opt.label}`,
                        );
                      }}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Current setting:{" "}
                <span className="font-semibold text-foreground">
                  {locationPolicy === "mobile-only"
                    ? "Mobile Only"
                    : "All Devices"}
                </span>{" "}
                — saved immediately, no page reload required.
              </p>
            </div>
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
