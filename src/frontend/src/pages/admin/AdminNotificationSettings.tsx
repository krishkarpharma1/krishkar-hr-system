import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlarmClock,
  Bell,
  CalendarClock,
  Clock,
  Layers,
  Loader2,
  Save,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { SfaReminderSettings } from "../../backend.d";
import type { NotificationSettings } from "../../backend.d";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

const CASCADE_OPTIONS = [
  { value: "asm_only", label: "ASM only" },
  { value: "asm_rsm", label: "ASM and RSM" },
  { value: "asm_rsm_zsm", label: "ASM + RSM + ZSM" },
  { value: "all_levels", label: "All levels (ASM, RSM, ZSM)" },
];

const DEFAULT_SETTINGS: NotificationSettings = {
  doctorCallNotificationsEnabled: true,
  cascadeLevel: "asm_only",
  batchingEnabled: false,
  batchWindowSeconds: BigInt(300),
  batchMinCount: BigInt(3),
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

const DEFAULT_SFA_SETTINGS: SfaReminderSettings = {
  dcrReminderEnabled: true,
  dcrReminderHour: BigInt(21),
  mtpReminderEnabled: true,
  mtpDeadlineDay: BigInt(25),
  mtpReminderDaysBeforeDeadline: BigInt(3),
};

export default function AdminNotificationSettings() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  const [settings, setSettings] =
    useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // SFA Reminder Settings
  const [sfaSettings, setSfaSettings] =
    useState<SfaReminderSettings>(DEFAULT_SFA_SETTINGS);
  const [sfaSaving, setSfaSaving] = useState(false);
  const [sfaSaved, setSfaSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.getNotificationSettings(token).catch(() => DEFAULT_SETTINGS),
      (
        api as unknown as Record<
          string,
          (t: string) => Promise<{ __kind__: string; ok?: SfaReminderSettings }>
        >
      )
        .getSfaReminderSettings?.(token)
        .catch(() => null),
    ])
      .then(([notifSettings, sfaResult]) => {
        setSettings(notifSettings);
        if (sfaResult && sfaResult.__kind__ === "ok" && sfaResult.ok) {
          setSfaSettings(sfaResult.ok);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSfaSave() {
    if (!token) return;
    setSfaSaving(true);
    setSfaSaved(false);
    try {
      const rawApi = api as unknown as Record<
        string,
        (t: string, s: SfaReminderSettings) => Promise<unknown>
      >;
      if (typeof rawApi.setSfaReminderSettings === "function") {
        await rawApi.setSfaReminderSettings(token, sfaSettings);
      }
      setSfaSaved(true);
      setTimeout(() => setSfaSaved(false), 3000);
    } catch {
      // silent
    } finally {
      setSfaSaving(false);
    }
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.updateNotificationSettings(
        {
          doctorCallNotificationsEnabled:
            settings.doctorCallNotificationsEnabled,
          cascadeLevel: settings.cascadeLevel,
          batchingEnabled: settings.batchingEnabled,
          batchWindowSeconds: settings.batchWindowSeconds,
          batchMinCount: settings.batchMinCount,
          quietHoursEnabled: settings.quietHoursEnabled,
          quietHoursStart: settings.quietHoursStart,
          quietHoursEnd: settings.quietHoursEnd,
        },
        token,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // toast from parent or silent
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center">
          <Bell className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h2 className="text-base font-display font-semibold text-foreground">
            Notification Settings
          </h2>
          <p className="text-xs text-muted-foreground">
            Control who receives Doctor Call and other field activity
            notifications
          </p>
        </div>
      </div>

      {/* Doctor Call Notifications */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold font-display text-foreground uppercase tracking-wide">
            Doctor Call Notifications
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-medium">Enable globally</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send notifications when MRs submit Doctor Calls
            </p>
          </div>
          <Switch
            checked={settings.doctorCallNotificationsEnabled}
            onCheckedChange={(v) =>
              setSettings((s) => ({ ...s, doctorCallNotificationsEnabled: v }))
            }
            data-ocid="notif-doctor-call-toggle"
          />
        </div>

        {settings.doctorCallNotificationsEnabled && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Cascade Level
            </Label>
            <p className="text-xs text-muted-foreground">
              Which levels above the MR receive the notification
            </p>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {CASCADE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({ ...s, cascadeLevel: opt.value }))
                  }
                  data-ocid={`notif-cascade-${opt.value}`}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    settings.cascadeLevel === opt.value
                      ? "bg-sky-50 border-sky-400 text-sky-700"
                      : "bg-background border-border text-foreground hover:bg-muted/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Batching */}
      {settings.doctorCallNotificationsEnabled && (
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">
                Batch Multiple Submissions
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Group rapid submissions into a single notification
              </p>
            </div>
            <Switch
              checked={settings.batchingEnabled}
              onCheckedChange={(v) =>
                setSettings((s) => ({ ...s, batchingEnabled: v }))
              }
              data-ocid="notif-batching-toggle"
            />
          </div>

          {settings.batchingEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Batch window (minutes)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={Number(settings.batchWindowSeconds) / 60}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      batchWindowSeconds: BigInt(
                        Math.max(1, Math.min(30, Number(e.target.value))) * 60,
                      ),
                    }))
                  }
                  data-ocid="notif-batch-window-input"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Minimum submissions to batch
                </Label>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={Number(settings.batchMinCount)}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      batchMinCount: BigInt(
                        Math.max(2, Math.min(10, Number(e.target.value))),
                      ),
                    }))
                  }
                  data-ocid="notif-batch-min-count-input"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Quiet Hours */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <Label className="text-sm font-medium">Quiet Hours</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suppress notifications during specified hours
              </p>
            </div>
          </div>
          <Switch
            checked={settings.quietHoursEnabled}
            onCheckedChange={(v) =>
              setSettings((s) => ({ ...s, quietHoursEnabled: v }))
            }
            data-ocid="notif-quiet-hours-toggle"
          />
        </div>

        {settings.quietHoursEnabled && (
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Start time
              </Label>
              <Input
                type="time"
                value={settings.quietHoursStart}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    quietHoursStart: e.target.value,
                  }))
                }
                data-ocid="notif-quiet-start-input"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">End time</Label>
              <Input
                type="time"
                value={settings.quietHoursEnd}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, quietHoursEnd: e.target.value }))
                }
                data-ocid="notif-quiet-end-input"
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}
      </section>

      {/* SFA Reminder Settings */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <AlarmClock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold font-display text-foreground uppercase tracking-wide">
            SFA Reminder Settings
          </span>
        </div>

        {/* DCR Daily Reminder */}
        <div className="space-y-3 pb-4 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                DCR Daily Reminder
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                MRs who have checked in but not submitted DCR will be reminded
              </p>
            </div>
            <Switch
              checked={sfaSettings.dcrReminderEnabled}
              onCheckedChange={(v) =>
                setSfaSettings((s) => ({ ...s, dcrReminderEnabled: v }))
              }
              data-ocid="sfa-dcr-reminder-toggle"
            />
          </div>
          {sfaSettings.dcrReminderEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Remind MRs at (hour, 24h)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={Number(sfaSettings.dcrReminderHour)}
                  onChange={(e) =>
                    setSfaSettings((s) => ({
                      ...s,
                      dcrReminderHour: BigInt(
                        Math.max(0, Math.min(23, Number(e.target.value))),
                      ),
                    }))
                  }
                  data-ocid="sfa-dcr-reminder-hour-input"
                  className="h-9 text-sm w-24"
                />
                <span className="text-xs text-muted-foreground">
                  {Number(sfaSettings.dcrReminderHour) < 12
                    ? `${Number(sfaSettings.dcrReminderHour)}:00 AM`
                    : Number(sfaSettings.dcrReminderHour) === 12
                      ? "12:00 PM"
                      : `${Number(sfaSettings.dcrReminderHour) - 12}:00 PM`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* MTP Monthly Reminder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                MTP Monthly Reminder
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                MRs who haven't submitted MTP for the upcoming month will be
                reminded
              </p>
            </div>
            <Switch
              checked={sfaSettings.mtpReminderEnabled}
              onCheckedChange={(v) =>
                setSfaSettings((s) => ({ ...s, mtpReminderEnabled: v }))
              }
              data-ocid="sfa-mtp-reminder-toggle"
            />
          </div>
          {sfaSettings.mtpReminderEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  MTP submission deadline (day of month)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={Number(sfaSettings.mtpDeadlineDay)}
                  onChange={(e) =>
                    setSfaSettings((s) => ({
                      ...s,
                      mtpDeadlineDay: BigInt(
                        Math.max(1, Math.min(28, Number(e.target.value))),
                      ),
                    }))
                  }
                  data-ocid="sfa-mtp-deadline-day-input"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Send reminder N days before deadline
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={Number(sfaSettings.mtpReminderDaysBeforeDeadline)}
                  onChange={(e) =>
                    setSfaSettings((s) => ({
                      ...s,
                      mtpReminderDaysBeforeDeadline: BigInt(
                        Math.max(1, Math.min(10, Number(e.target.value))),
                      ),
                    }))
                  }
                  data-ocid="sfa-mtp-reminder-days-input"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* SFA Save */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={handleSfaSave}
            disabled={sfaSaving}
            data-ocid="sfa-reminder-settings-save-btn"
            className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
          >
            {sfaSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save SFA Reminders
          </Button>
          {sfaSaved && (
            <span
              className="text-sm text-green-600 font-medium"
              data-ocid="sfa-reminder-settings-success-state"
            >
              ✓ SFA reminders saved
            </span>
          )}
        </div>
      </section>

      {/* Save (original notification settings) */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          data-ocid="notif-settings-save-btn"
          className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </Button>
        {saved && (
          <span
            className="text-sm text-green-600 font-medium"
            data-ocid="notif-settings-success-state"
          >
            ✓ Settings saved
          </span>
        )}
      </div>
    </div>
  );
}
