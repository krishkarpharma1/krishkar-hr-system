import { Card } from "@/components/ui/card";
import type React from "react";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: number;
  icon?: React.ReactNode;
}

interface RecentActivityFeedProps {
  activities: ActivityItem[];
  title?: string;
  maxItems?: number;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  // Format as DD-MM-YYYY HH:MM
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

function getTypeColor(type: string): string {
  switch (type) {
    case "doctor_call":
      return "bg-sky-100 text-sky-600";
    case "chemist_visit":
      return "bg-green-100 text-green-600";
    case "stockist_visit":
      return "bg-purple-100 text-purple-600";
    case "dcr":
      return "bg-orange-100 text-orange-600";
    case "leave":
      return "bg-yellow-100 text-yellow-700";
    case "attendance":
      return "bg-teal-100 text-teal-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function RecentActivityFeed({
  activities,
  title = "Recent Activity",
  maxItems = 7,
}: RecentActivityFeedProps) {
  const displayItems = activities.slice(0, maxItems);

  return (
    <Card className="p-4 bg-card border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {displayItems.length === 0 ? (
        <p
          className="text-xs text-muted-foreground text-center py-3"
          data-ocid="activity_feed.empty_state"
        >
          No recent activity
        </p>
      ) : (
        <div
          className="space-y-0 overflow-y-auto max-h-72"
          data-ocid="activity_feed.list"
        >
          {displayItems.map((item, idx) => {
            const colorClass = getTypeColor(item.type);
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 py-2.5 border-b border-border last:border-0"
                data-ocid={`activity_feed.item.${idx + 1}`}
              >
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${colorClass}`}
                >
                  {item.icon ?? item.type[0].toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug break-words">
                    {item.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateTime(item.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
