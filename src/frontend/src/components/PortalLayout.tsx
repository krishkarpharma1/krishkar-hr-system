import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Download, Menu } from "lucide-react";
import { useState } from "react";
import type { Role } from "../backend.d";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { ScrollButtons } from "./ScrollButtons";
import { Sidebar } from "./Sidebar";

interface PortalLayoutProps {
  portalRole: Role;
  children: React.ReactNode;
  className?: string;
}

export function PortalLayout({
  portalRole,
  children,
  className,
}: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { canInstall, promptInstall } = usePwaInstall();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        role={portalRole}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        canInstallPwa={canInstall}
        onInstallPwa={promptInstall}
      />

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close navigation"
          className="md:hidden fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
        />
      )}

      <main
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden",
          className,
        )}
      >
        {/* Mobile header bar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border flex-shrink-0 shadow-sm">
          <button
            type="button"
            aria-label="Open navigation menu"
            data-ocid="hamburger-menu-btn"
            className="touch-target flex items-center justify-center rounded-lg hover:bg-muted/60 active:bg-muted transition-colors -ml-1 text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <img
              src="/assets/krishkar_logo.png"
              alt="Krishkar Pharmaceuticals"
              className="h-10 w-auto object-contain flex-shrink-0"
            />
            <span className="font-display font-semibold text-sm text-foreground truncate">
              Krishkar Pharma
            </span>
          </div>
          {/* Desktop Install button in mobile header */}
          {canInstall && (
            <button
              type="button"
              onClick={promptInstall}
              title="Add this app to your home screen for quick access"
              aria-label="Install app"
              data-ocid="pwa-install-header-btn"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/25 rounded-lg hover:bg-primary/20 active:bg-primary/30 transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
          )}
        </div>

        {children}
      </main>
      <Toaster richColors position="top-right" />
      <ScrollButtons />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="bg-card border-b border-border px-4 md:px-6 py-3 md:py-4 flex-shrink-0 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-semibold text-base md:text-xl text-foreground tracking-tight leading-snug">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 font-body leading-snug line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end mt-0.5">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
}: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 md:p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-display leading-tight">
          {label}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        )}
      </div>
      <p className="font-display font-bold text-lg md:text-2xl text-foreground leading-tight">
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            "text-xs font-body",
            trendUp ? "text-accent" : "text-destructive",
          )}
        >
          {trend}
        </p>
      )}
    </div>
  );
}

interface DataTableProps<T> {
  columns: { key: string; label: string; className?: string }[];
  data: T[];
  getKey: (item: T) => string;
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  maxHeight?: string;
}

export function DataTable<T>({
  columns,
  data,
  getKey,
  renderRow,
  emptyMessage = "No records found",
  loading,
  maxHeight = "60vh",
}: DataTableProps<T>) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
      <div
        className="overflow-x-auto overflow-y-auto scrollbar-thin"
        style={{ maxHeight }}
      >
        <table className="w-full text-sm font-body min-w-[480px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/50 border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 md:px-4 py-2.5 md:py-3 text-left text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap",
                    col.className,
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              (["s0", "s1", "s2", "s3"] as const).map((skKey) => (
                <tr
                  key={skKey}
                  className="border-b border-border last:border-0"
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 md:px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-lg">∅</span>
                    </div>
                    <span className="text-sm">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={getKey(item)}
                  className="border-b border-border last:border-0 hover:bg-muted/20 active:bg-muted/30 transition-colors"
                  data-ocid={`table-row-${getKey(item)}`}
                >
                  {renderRow(item, index)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PageContent({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-scroll-container="true"
      className={cn(
        "flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Responsive stat grid: 1 col on xs, 2 on sm, configurable on md+ */
export function StatGrid({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Reusable form field wrapper: label stacks above input on all screens */
export function FormField({
  label,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground font-body leading-tight"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

/** Section card with consistent padding and border */
export function SectionCard({
  title,
  children,
  className,
  headerActions,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg shadow-sm overflow-hidden",
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 md:py-4 border-b border-border bg-muted/30">
          <h2 className="font-display font-semibold text-sm md:text-base text-foreground">
            {title}
          </h2>
          {headerActions && (
            <div className="flex items-center gap-2">{headerActions}</div>
          )}
        </div>
      )}
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}
