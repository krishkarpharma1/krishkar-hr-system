import type React from "react";

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}

interface QuickActionsBarProps {
  actions: QuickAction[];
}

export function QuickActionsBar({ actions }: QuickActionsBarProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
      data-ocid="quick_actions.bar"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="flex flex-wrap gap-2 sm:flex-nowrap min-w-max sm:min-w-0">
        {actions.map((action, idx) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={[
              "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium",
              "border transition-all duration-150 whitespace-nowrap flex-shrink-0",
              "min-h-[44px] active:scale-95",
              action.primary
                ? "bg-sky-500 text-white border-sky-500 hover:bg-sky-600 hover:border-sky-600 shadow-sm"
                : "bg-card text-sky-600 border-sky-200 hover:bg-sky-50 hover:border-sky-300",
            ].join(" ")}
            data-ocid={`quick_actions.button.${idx + 1}`}
          >
            <span className="flex-shrink-0 w-4 h-4">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
