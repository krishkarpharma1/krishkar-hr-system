import { Download, X } from "lucide-react";
import { usePwaInstall } from "../hooks/usePwaInstall";

export function PwaInstallBanner() {
  const { canInstall, promptInstall, dismissInstall } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border text-foreground shadow-md"
      role="banner"
      aria-label="Install app banner"
      data-ocid="pwa-install-banner"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Download className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold font-display leading-tight text-foreground truncate">
            Install Krishkar HR
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            Add to home screen for faster access
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={promptInstall}
          className="min-h-[36px] px-4 py-1.5 text-sm font-semibold font-body bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-ocid="pwa-install-btn"
          aria-label="Install app"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismissInstall}
          className="touch-target flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-ocid="pwa-dismiss-btn"
          aria-label="Dismiss install prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
