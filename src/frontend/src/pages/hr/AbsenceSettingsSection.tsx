import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Save,
  Settings2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "../../store/authStore";

interface AbsenceSettings {
  consecutiveAbsenceThreshold: bigint;
  absenceCheckEnabled: boolean;
  warningNotificationsEnabled: boolean;
  excludeLongTermLeave: boolean;
}

export default function AbsenceSettingsSection() {
  const { session } = useAuthStore();
  const [settings, setSettings] = useState<AbsenceSettings>({
    consecutiveAbsenceThreshold: 3n,
    absenceCheckEnabled: true,
    warningNotificationsEnabled: true,
    excludeLongTermLeave: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      const a = await import("../../backend");
      const { createActorWithConfig } = await import(
        "@caffeineai/core-infrastructure"
      );
      const actor = await createActorWithConfig(a.createActor);
      const data = await actor.getAbsenceSettings(session.token);
      setSettings({
        consecutiveAbsenceThreshold: data.consecutiveAbsenceThreshold,
        absenceCheckEnabled: data.absenceCheckEnabled,
        warningNotificationsEnabled: data.warningNotificationsEnabled,
        excludeLongTermLeave: data.excludeLongTermLeave,
      });
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!session?.token) return;
    setSaving(true);
    try {
      const a = await import("../../backend");
      const { createActorWithConfig } = await import(
        "@caffeineai/core-infrastructure"
      );
      const actor = await createActorWithConfig(a.createActor);
      const res = await actor.updateAbsenceSettings(settings, session.token);
      if (res.__kind__ === "ok") toast.success("Absence settings saved");
      else toast.error(res.err);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    if (!session?.token) return;
    setRunning(true);
    setRunResult(null);
    try {
      const a = await import("../../backend");
      const { createActorWithConfig } = await import(
        "@caffeineai/core-infrastructure"
      );
      const actor = await createActorWithConfig(a.createActor);
      const res = await actor.executeAbsenceCheckNow(session.token);
      if (res.__kind__ === "ok") {
        setRunResult(res.ok || "Absence check completed successfully.");
        toast.success("Absence check completed");
      } else {
        toast.error(res.err);
      }
    } catch {
      toast.error("Failed to run absence check");
    } finally {
      setRunning(false);
    }
  };

  const threshold = Number(settings.consecutiveAbsenceThreshold);

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden"
      data-ocid="absence-settings.section"
    >
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
          Absence Auto-Inactivation Settings
        </h3>
      </div>
      {loading ? (
        <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {/* Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Consecutive Absent Days Before Inactivation
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={threshold}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      consecutiveAbsenceThreshold: BigInt(
                        Math.max(
                          1,
                          Math.min(30, Number.parseInt(e.target.value) || 3),
                        ),
                      ),
                    }))
                  }
                  className="h-9 w-24"
                  data-ocid="absence-settings.threshold_input"
                />
                <span className="text-sm text-muted-foreground">
                  days (default: 3)
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-inactivate after{" "}
                <strong className="text-foreground">{threshold}</strong>{" "}
                consecutive absent days (1–30).
              </p>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Daily Absence Check
                </p>
                <p className="text-xs text-muted-foreground">
                  Enable the automated daily job that checks for consecutive
                  absences
                </p>
              </div>
              <Switch
                checked={settings.absenceCheckEnabled}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, absenceCheckEnabled: v }))
                }
                data-ocid="absence-settings.check_toggle"
              />
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Progressive Warning Notifications
                </p>
                <p className="text-xs text-muted-foreground">
                  Notify manager after Day 1 and Day 2 of consecutive absence
                </p>
              </div>
              <Switch
                checked={settings.warningNotificationsEnabled}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, warningNotificationsEnabled: v }))
                }
                data-ocid="absence-settings.warnings_toggle"
              />
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Exclude Employees on Approved Leave
                </p>
                <p className="text-xs text-muted-foreground">
                  Skip employees who have an approved leave covering the absent
                  days
                </p>
              </div>
              <Switch
                checked={settings.excludeLongTermLeave}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, excludeLongTermLeave: v }))
                }
                data-ocid="absence-settings.exclude_leave_toggle"
              />
            </div>
          </div>

          {/* Run result */}
          {runResult && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{runResult}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              data-ocid="absence-settings.save_button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {saving ? "Saving…" : "Save Settings"}
            </Button>
            <Button
              variant="outline"
              onClick={handleRunNow}
              disabled={running}
              size="sm"
              data-ocid="absence-settings.run_now_button"
            >
              {running ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Play className="w-4 h-4 mr-1.5" />
              )}
              {running ? "Running…" : "Run Absence Check Now"}
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Daily check runs at 6:00 PM automatically
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
