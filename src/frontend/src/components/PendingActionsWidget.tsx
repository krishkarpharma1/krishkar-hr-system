import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export interface PendingActionItem {
  label: string;
  count: number;
  onClick: () => void;
  urgency: "high" | "medium" | "low";
}

interface PendingActionsWidgetProps {
  items: PendingActionItem[];
  title?: string;
}

const urgencyBadgeVariant = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

const urgencyBadgeClass = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-orange-100 text-orange-700 border-orange-200",
  low: "bg-muted text-muted-foreground",
} as const;

export function PendingActionsWidget({
  items,
  title = "Pending Actions",
}: PendingActionsWidgetProps) {
  const activeItems = items.filter((i) => i.count > 0);

  return (
    <Card className="p-4 bg-card border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {activeItems.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          No pending actions
        </p>
      ) : (
        <ul className="space-y-2" data-ocid="pending_actions.list">
          {activeItems.map((item, idx) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={item.onClick}
                className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent transition-colors min-h-[44px] active:opacity-80"
                data-ocid={`pending_actions.item.${idx + 1}`}
              >
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                  {item.label}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant={urgencyBadgeVariant[item.urgency]}
                    className={`text-xs font-bold min-w-[24px] text-center ${urgencyBadgeClass[item.urgency]}`}
                  >
                    {item.count}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
