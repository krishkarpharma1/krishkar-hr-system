import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart2,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  GitBranch,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  PackageSearch,
  Receipt,
  Settings2,
  ShoppingCart,
  Stethoscope,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../backend.d";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { ROLE_LABELS } from "../types";
import { SuggestionsModal } from "./SuggestionsModal";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

const NAV_ITEMS: Record<Role, NavItem[]> = {
  Admin: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
    { label: "User Management", icon: Users, href: "/admin/users" },
    {
      label: "Role & Hierarchy",
      icon: GitBranch,
      href: "/admin/role-hierarchy",
    },
    {
      label: "Territory & HQ Master",
      icon: Layers,
      href: "/admin/location-master",
    },
    {
      label: "Product & Brand Master",
      icon: PackageSearch,
      href: "/admin/product-master",
    },
    { label: "Doctor Master", icon: Stethoscope, href: "/admin/doctor-master" },
    {
      label: "Chemist Master",
      icon: ShoppingCart,
      href: "/admin/station-master",
    },
    {
      label: "Stockist Master",
      icon: Building2,
      href: "/admin/stockist-master",
    },
    {
      label: "Leave Policy Config",
      icon: CalendarDays,
      href: "/admin/leave-quota",
    },
    {
      label: "TA/DA Policy Config",
      icon: Settings2,
      href: "/admin/tada-policy",
    },
    {
      label: "Expense Policy Config",
      icon: Receipt,
      href: "/admin/expense-policy",
    },
    {
      label: "Sample Policy Config",
      icon: Package,
      href: "/admin/sample-allocation",
    },
    {
      label: "Header & Footer Config",
      icon: FileText,
      href: "/admin/document-config",
    },
    {
      label: "MTP Settings",
      icon: Settings2,
      href: "/admin/mtp-settings",
    },
    {
      label: "Notifications",
      icon: Bell,
      href: "/admin/notification-settings",
    },
    {
      label: "Distributor Master",
      icon: Building2,
      href: "/admin/distributors",
    },
    { label: "Order Book", icon: FileText, href: "/admin/order-book" },
    {
      label: "E-Detailing Admin",
      icon: BookOpen,
      href: "/admin/edetailing-admin",
    },
    { label: "Product Catalog", icon: BookOpen, href: "/admin/edetailing" },
    { label: "System Reports", icon: BarChart2, href: "/admin/reports" },
  ],
  HRManager: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/hr" },
    { label: "Employee Master", icon: Users, href: "/hr/employees" },
    { label: "Attendance Management", icon: UserCheck, href: "/hr/attendance" },
    { label: "Leave Management", icon: CalendarDays, href: "/hr/leaves" },
    { label: "Official Letters", icon: Mail, href: "/hr/official-letters" },
    {
      label: "Transfer & Promotion",
      icon: TrendingUp,
      href: "/hr/performance",
    },
    { label: "Grievance", icon: MessageSquare, href: "/hr/suggestions" },
    { label: "Reports", icon: Download, href: "/hr/export" },
    { label: "Product Catalog", icon: BookOpen, href: "/hr/edetailing" },
    { label: "Notifications", icon: Bell, href: "/hr/messages" },
  ],
  MR: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/mr" },
    { label: "My Profile", icon: UserCheck, href: "/mr/my-attendance" },
    {
      label: "MTP (Monthly Tour Plan)",
      icon: CalendarRange,
      href: "/mr/travel-plans",
    },
    { label: "DCR (Daily Call Report)", icon: ClipboardList, href: "/mr/dcr" },
    { label: "Doctor Coverage", icon: Stethoscope, href: "/mr/doctors" },
    { label: "Chemist Coverage", icon: ShoppingCart, href: "/mr/chemist-call" },
    { label: "Stockist Coverage", icon: Package, href: "/mr/stockist-call" },
    {
      label: "Sample Inventory",
      icon: PackageSearch,
      href: "/mr/sfa/sample-balance",
    },
    {
      label: "Inputs / Promo Materials",
      icon: Tag,
      href: "/mr/my-reports",
    },
    { label: "Orders", icon: ShoppingCart, href: "/mr/orders" },
    { label: "Order Book", icon: FileText, href: "/mr/order-book" },
    { label: "Leave Application", icon: CalendarDays, href: "/mr/leave" },
    { label: "TA/DA Claim", icon: Receipt, href: "/mr/expenses" },
    { label: "Joint Field Work (JFW)", icon: Users, href: "/mr/jfw-reports" },
    { label: "Notifications", icon: Bell, href: "/mr/dashboard" },
    { label: "Product Catalog", icon: BookOpen, href: "/mr/edetailing" },
    { label: "Reports", icon: Download, href: "/mr/my-reports" },
  ],
  ASM: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/asm" },
    { label: "My Profile", icon: UserCheck, href: "/asm/my-attendance" },
    { label: "Team Overview", icon: Users, href: "/asm/reports" },
    { label: "MTP Approval", icon: CalendarRange, href: "/asm/mtp-approvals" },
    { label: "DCR Review", icon: ClipboardList, href: "/asm/dcr-approvals" },
    { label: "Coverage Reports", icon: Stethoscope, href: "/asm/call-reports" },
    { label: "JFW (Joint Field Work)", icon: Users, href: "/asm/jfw" },
    {
      label: "Leave Approval",
      icon: CalendarDays,
      href: "/asm/leave-approval",
    },
    { label: "TA/DA Approval", icon: Receipt, href: "/asm/expenses" },
    { label: "Expense Approval", icon: Wallet, href: "/asm/expenses" },
    {
      label: "Sample Audit",
      icon: PackageSearch,
      href: "/asm/sfa/sample-balance",
    },
    { label: "Performance Reports", icon: BarChart2, href: "/asm/performance" },
    { label: "Order Book", icon: FileText, href: "/asm/order-book" },
    { label: "Notifications", icon: Bell, href: "/asm" },
    { label: "Product Catalog", icon: BookOpen, href: "/asm/edetailing" },
    { label: "Reports", icon: Download, href: "/asm/my-reports" },
  ],
  RSM: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/rsm" },
    { label: "My Profile", icon: UserCheck, href: "/rsm/my-attendance" },
    { label: "Team Overview", icon: Users, href: "/rsm/reports" },
    { label: "MTP Approval", icon: CalendarRange, href: "/rsm/mtp-approvals" },
    { label: "DCR Review", icon: ClipboardList, href: "/rsm/dcr-approvals" },
    { label: "Coverage Reports", icon: Stethoscope, href: "/rsm/call-reports" },
    { label: "JFW (Joint Field Work)", icon: Users, href: "/rsm/jfw" },
    {
      label: "Leave Approval",
      icon: CalendarDays,
      href: "/rsm/leave-approval",
    },
    { label: "TA/DA Approval", icon: Receipt, href: "/rsm/expenses" },
    { label: "Expense Approval", icon: Wallet, href: "/rsm/expenses" },
    {
      label: "Sample Audit",
      icon: PackageSearch,
      href: "/rsm/sfa/sample-balance",
    },
    { label: "Performance Reports", icon: BarChart2, href: "/rsm/performance" },
    { label: "Order Book", icon: FileText, href: "/rsm/order-book" },
    { label: "Notifications", icon: Bell, href: "/rsm" },
    { label: "Product Catalog", icon: BookOpen, href: "/rsm/edetailing" },
    { label: "Reports", icon: Download, href: "/rsm/my-reports" },
  ],
  ZSM: [
    { label: "Dashboard", icon: LayoutDashboard, href: "/zsm" },
    { label: "My Profile", icon: UserCheck, href: "/zsm/my-attendance" },
    { label: "Team Overview", icon: Users, href: "/zsm/reports" },
    {
      label: "MTP Approval",
      icon: CalendarRange,
      href: "/zsm/sfa/mtp-vs-actual",
    },
    { label: "DCR Review", icon: ClipboardList, href: "/zsm/sfa/dcr-summary" },
    { label: "Coverage Reports", icon: Stethoscope, href: "/zsm/call-reports" },
    {
      label: "JFW (Joint Field Work)",
      icon: Users,
      href: "/zsm/sfa/jfw-summary",
    },
    {
      label: "Leave Approval",
      icon: CalendarDays,
      href: "/zsm/leave-approval",
    },
    { label: "TA/DA Approval", icon: Receipt, href: "/zsm/expenses" },
    { label: "Expense Approval", icon: Wallet, href: "/zsm/expenses" },
    {
      label: "Sample Audit",
      icon: PackageSearch,
      href: "/zsm/sfa/sample-balance",
    },
    { label: "Performance Reports", icon: BarChart2, href: "/zsm/performance" },
    { label: "Order Book", icon: FileText, href: "/zsm/order-book" },
    { label: "Notifications", icon: Bell, href: "/zsm/sfa/jfw-summary" },
    { label: "Product Catalog", icon: BookOpen, href: "/zsm/edetailing" },
    { label: "Reports", icon: Download, href: "/zsm/my-reports" },
  ],
};

interface SidebarProps {
  role: Role;
  mobileOpen?: boolean;
  onClose?: () => void;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
}

export function Sidebar({
  role,
  mobileOpen = false,
  onClose,
  canInstallPwa = false,
  onInstallPwa,
}: SidebarProps) {
  const session = useAuthStore((s) => s.session);
  const clearSession = useAuthStore((s) => s.clearSession);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isHRAdmin = role === "Admin" || role === "HRManager";

  // Poll unread count every 60s
  useEffect(() => {
    if (!session?.token) return;
    const fetchCount = async () => {
      try {
        const count = isHRAdmin
          ? await api.getUnreadSuggestionCount(session.token!)
          : await api.getUnreadReplyCount(session.token!);
        setUnreadCount(count);
      } catch {
        // ignore
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [session?.token, isHRAdmin]);

  const navItems = NAV_ITEMS[role] ?? [];

  const handleLogout = async () => {
    if (session?.token) {
      try {
        await api.logout(session.token);
      } catch {
        // ignore logout errors
      }
    }
    clearSession();
    window.location.href = "/";
  };

  const handleNavClick = () => {
    onClose?.();
  };

  const SidebarContent = ({ showClose = false }: { showClose?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo + role badge */}
      <div className="px-4 py-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs">
            <span className="text-primary-foreground font-display font-bold text-xs">
              KP
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-sm text-sidebar-foreground truncate leading-tight">
              Krishkar Pharma
            </p>
            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
              {ROLE_LABELS[role]}
            </p>
          </div>
          {showClose && (
            <button
              type="button"
              aria-label="Close navigation"
              data-ocid="sidebar-close-btn"
              className="touch-target flex items-center justify-center rounded-lg hover:bg-sidebar-accent active:bg-sidebar-accent/80 transition-colors text-muted-foreground -mr-1.5 flex-shrink-0"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-accent/40">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-display mb-1">
          Signed in as
        </p>
        <p className="font-body text-sm font-semibold text-sidebar-foreground truncate leading-snug">
          {session?.name}
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          {session?.employeeId}
        </p>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2"
        data-ocid="sidebar-nav"
      >
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-display px-2 pb-2">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              currentPath === item.href ||
              (item.href !== `/${role.toLowerCase()}` &&
                currentPath.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-body transition-smooth group",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent/80",
                  )}
                  data-ocid={`nav-${item.href.replace(/\//g, "-").slice(1)}`}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive
                        ? "text-primary-foreground"
                        : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
                    )}
                  />
                  <span className="truncate flex-1 leading-tight">
                    {item.label}
                  </span>
                  {isActive && (
                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-60" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Suggestions & Queries button */}
      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={() => setSuggestionsOpen(true)}
          title="Submit suggestions, queries, or complaints to HR"
          aria-label="Suggestions and Queries"
          data-ocid="suggestions.open_modal_button"
          className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-body text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent/80 transition-colors relative"
        >
          <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate flex-1 leading-tight text-left">
            Suggestions & Queries
          </span>
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Install App button — shown when PWA can be installed */}
      {canInstallPwa && (
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={onInstallPwa}
            title="Add this app to your home screen for quick access"
            aria-label="Install app"
            data-ocid="pwa-install-sidebar-btn"
            className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-body text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 active:bg-primary/20 transition-colors"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1 leading-tight text-left">
              Install App
            </span>
          </button>
        </div>
      )}

      {/* Logout */}
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full min-h-[44px] justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/15 font-body rounded-lg"
          data-ocid="logout-btn"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile drawer sidebar — slide in from left */}
      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-40 w-[280px] bg-sidebar border-r border-sidebar-border",
          "transform transition-transform duration-300 ease-in-out will-change-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Navigation drawer"
        aria-hidden={!mobileOpen}
      >
        <SidebarContent showClose />
      </aside>

      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex flex-col w-60 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Suggestions & Queries modal — portal so it works from any page */}
      <SuggestionsModal
        open={suggestionsOpen}
        onClose={() => {
          setSuggestionsOpen(false);
          setUnreadCount(0);
        }}
      />
    </>
  );
}
