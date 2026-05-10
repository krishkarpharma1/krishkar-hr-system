import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  reloading: boolean;
}

function isChunkError(error: Error): boolean {
  const msg = error.message ?? "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("ChunkLoadError") ||
    msg.includes("Loading chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("Unable to preload CSS") ||
    error.name === "ChunkLoadError"
  );
}

/**
 * Error boundary that catches stale-chunk errors after redeployment
 * and automatically reloads the page once to fetch the latest bundles.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, reloading: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    if (isChunkError(error)) {
      return { hasError: true, reloading: true };
    }
    return { hasError: true, reloading: false };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (isChunkError(error)) {
      // Auto-reload after a short delay to let the user see the message
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-display font-semibold text-foreground">
                {this.state.reloading
                  ? "Refreshing page…"
                  : "Page failed to load"}
              </p>
              <p className="text-sm text-muted-foreground font-body mt-1">
                {this.state.reloading
                  ? "Loading the latest version. Please wait."
                  : "An error occurred while loading this page."}
              </p>
            </div>
            {!this.state.reloading && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Refresh Page
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
