import type { DcrSettingsInfo } from "../backend.d";

/** Typed fallback used when getDcrSettings backend call fails. */
export function getDcrSettingsFallback(): DcrSettingsInfo {
  return {
    dailyDeadlineHour: BigInt(21),
    dailyDeadlineMinute: BigInt(0),
    isEnabled: true,
  };
}
