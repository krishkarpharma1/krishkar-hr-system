import { FileSpreadsheet, Loader2 } from "lucide-react";

interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  isLoading?: boolean;
}

export function ExportButton({
  onClick,
  disabled = false,
  tooltip,
  isLoading = false,
}: ExportButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      title={tooltip}
      data-ocid="export.button"
      className={[
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1",
        isDisabled
          ? "cursor-not-allowed border-green-300 text-green-400 opacity-60"
          : "cursor-pointer border-green-600 text-green-700 hover:bg-green-50 active:bg-green-100",
      ].join(" ")}
      aria-label={tooltip ?? "Export to Excel"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
      )}
      <span>Export to Excel</span>
    </button>
  );
}
