import { Badge } from "@/components/ui/badge";
import { CheckCircle, MapPin, XCircle } from "lucide-react";
import type { MrDailyActivityRow } from "../types";
import ScrollableTable from "./ScrollableTable";

interface MrActivityTableProps {
  rows: MrDailyActivityRow[];
  onViewMr?: (mrId: bigint) => void;
}

interface DcrBadgeProps {
  status: string;
}

function getDcrBadgeClass(status: string): string {
  switch (status) {
    case "Approved":
      return "bg-green-100 text-green-700 border-green-200";
    case "Submitted":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Late":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "NotSubmitted":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getDcrLabel(status: string): string {
  switch (status) {
    case "NotSubmitted":
      return "Not Submitted";
    default:
      return status;
  }
}

function DcrBadge({ status }: DcrBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`text-xs whitespace-nowrap ${getDcrBadgeClass(status)}`}
    >
      {getDcrLabel(status)}
    </Badge>
  );
}

function formatCheckInTime(ts?: bigint): string {
  if (!ts) return "";
  const d = new Date(Number(ts));
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function MrActivityTable({ rows, onViewMr }: MrActivityTableProps) {
  if (rows.length === 0) {
    return (
      <div
        className="text-center py-6 text-sm text-muted-foreground"
        data-ocid="mr_activity.empty_state"
      >
        No MR activity data for today.
      </div>
    );
  }

  return (
    <div data-ocid="mr_activity.table">
      {/* Mobile: stacked cards */}
      <div className="sm:hidden space-y-2">
        {rows.map((row, idx) => (
          <button
            key={String(row.mrId)}
            type="button"
            className="w-full text-left border border-border rounded-lg p-3 bg-card cursor-pointer hover:bg-accent transition-colors"
            onClick={() => onViewMr?.(row.mrId)}
            data-ocid={`mr_activity.item.${idx + 1}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-foreground truncate max-w-[60%]">
                {row.mrName}
              </span>
              <DcrBadge status={row.dcrStatusToday} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-0.5">
                {row.checkInStatus ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span>
                  {row.checkInTime ? formatCheckInTime(row.checkInTime) : "—"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base font-semibold text-foreground">
                  {String(row.doctorCallsToday)}
                </span>
                <span>Doctors</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-base font-semibold text-foreground">
                  {String(row.chemistVisitsToday)}
                </span>
                <span>Chemists</span>
              </div>
            </div>
            {row.lastGpsLat && row.lastGpsLng && (
              <div className="mt-2 flex items-center gap-1 text-xs text-sky-600">
                <MapPin className="h-3 w-3" />
                <span>GPS available</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block">
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">
                  MR Name
                </th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">
                  Check-In
                </th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">
                  Doctors
                </th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">
                  Chemists
                </th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">
                  Stockists
                </th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">
                  DCR Status
                </th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">
                  Location
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={String(row.mrId)}
                  className="border-b border-border hover:bg-accent/50 transition-colors"
                  data-ocid={`mr_activity.row.${idx + 1}`}
                >
                  <td className="py-2.5 px-3">
                    {onViewMr ? (
                      <button
                        type="button"
                        className="font-medium text-sky-600 hover:underline text-left"
                        onClick={() => onViewMr(row.mrId)}
                      >
                        {row.mrName}
                      </button>
                    ) : (
                      <span className="font-medium text-foreground">
                        {row.mrName}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {row.checkInStatus ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      {row.checkInTime && (
                        <span className="text-xs text-muted-foreground">
                          {formatCheckInTime(row.checkInTime)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-medium">
                    {String(row.doctorCallsToday)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-medium">
                    {String(row.chemistVisitsToday)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-medium">
                    {String(row.stockistVisitsToday)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <DcrBadge status={row.dcrStatusToday} />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {row.lastGpsLat && row.lastGpsLng ? (
                      <MapPin className="h-4 w-4 text-sky-500 mx-auto" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}
