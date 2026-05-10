import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronDown, ChevronRight, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import ScrollableTable from "../../components/ScrollableTable";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import {
  CalculationStatus,
  TARGET_PERIOD_LABELS,
  TargetPeriod,
} from "../../types";
import type { BottomUpTarget, TargetHierarchyNode } from "../../types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRupee(amount: bigint | number): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

const PERIODS: TargetPeriod[] = [
  TargetPeriod.Monthly,
  TargetPeriod.Quarterly,
  TargetPeriod.HalfYearly,
  TargetPeriod.Yearly,
];

// ── Target Card ───────────────────────────────────────────────────────────────

interface TargetCardProps {
  period: TargetPeriod;
  target: BottomUpTarget | null | undefined;
  loading: boolean;
}

function TargetCard({ period, target, loading }: TargetCardProps) {
  const label = TARGET_PERIOD_LABELS[period];
  const isOverridden =
    target?.calculationStatus === CalculationStatus.ManuallyOverridden;

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2"
      data-ocid={`target-card-${period.toLowerCase()}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {loading ? (
          <Skeleton className="h-5 w-20" />
        ) : target ? (
          <Badge
            variant="outline"
            className={
              isOverridden
                ? "text-xs border-orange-400 text-orange-600 bg-orange-50"
                : "text-xs border-blue-300 text-blue-700 bg-blue-50"
            }
            title={
              isOverridden && target.overrideReason
                ? `Override reason: ${target.overrideReason}`
                : undefined
            }
          >
            {isOverridden ? "Overridden" : "Auto-Calculated"}
          </Badge>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-32 mt-1" />
      ) : target ? (
        <p className="text-2xl font-display font-bold text-foreground tabular-nums">
          {formatRupee(target.targetAmount)}
        </p>
      ) : (
        <p className="text-lg font-display text-muted-foreground">Not set</p>
      )}
      {!loading && target?.isOverridden && target.overrideReason && (
        <p className="text-xs text-orange-600 flex items-start gap-1 mt-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2">{target.overrideReason}</span>
        </p>
      )}
    </div>
  );
}

// ── Hierarchy Tree Row ────────────────────────────────────────────────────────

interface TreeRowProps {
  node: TargetHierarchyNode;
  depth: number;
}

function TreeRow({ node, depth }: TreeRowProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isOverridden = node.status === CalculationStatus.ManuallyOverridden;

  return (
    <>
      <tr
        className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
        data-ocid={`hierarchy-row-${String(node.userId)}`}
      >
        <td className="px-4 py-2.5">
          <div
            className="flex items-center gap-1 min-w-0"
            style={{ paddingLeft: `${depth * 18}px` }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded hover:bg-muted transition-colors"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-5 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {node.name}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <Badge variant="secondary" className="text-xs font-mono">
            {node.role}
          </Badge>
        </td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">
          {node.territory || "—"}
        </td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">
          {node.area || "—"}
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground tabular-nums">
          {formatRupee(node.monthly)}
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground tabular-nums">
          {formatRupee(node.quarterly)}
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground tabular-nums">
          {formatRupee(node.halfYearly)}
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground tabular-nums">
          {formatRupee(node.yearly)}
        </td>
        <td className="px-4 py-2.5">
          <Badge
            variant="outline"
            className={
              isOverridden
                ? "text-xs border-orange-400 text-orange-600 bg-orange-50 whitespace-nowrap"
                : "text-xs border-blue-300 text-blue-700 bg-blue-50 whitespace-nowrap"
            }
            title={
              isOverridden && node.overrideReason
                ? `Override: ${node.overrideReason}`
                : undefined
            }
          >
            {isOverridden ? "Overridden" : "Auto"}
          </Badge>
        </td>
      </tr>
      {expanded &&
        node.children.map((child) => (
          <TreeRow key={String(child.userId)} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface Props {
  portalRole?: Role;
}

export default function MyTargetDashboard({ portalRole }: Props) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";

  // Infer role from session if not provided via prop
  const effectiveRole =
    portalRole ?? (session?.role as Role | undefined) ?? Role.MR;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);

  const [targets, setTargets] = useState<
    Partial<Record<TargetPeriod, BottomUpTarget | null>>
  >({});
  const [hierarchy, setHierarchy] = useState<TargetHierarchyNode[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);

  const isManager = [Role.ASM, Role.RSM, Role.ZSM].includes(effectiveRole);

  // Fetch my targets for the selected year
  useEffect(() => {
    if (!token) return;
    setLoadingTargets(true);
    Promise.all(PERIODS.map((p) => api.getMyTarget(token, p, year))).then(
      (results) => {
        const map: Partial<Record<TargetPeriod, BottomUpTarget | null>> = {};
        PERIODS.forEach((p, i) => {
          map[p] = results[i];
        });
        setTargets(map);
        setLoadingTargets(false);
      },
    );
  }, [token, year]);

  // Fetch hierarchy for manager roles
  useEffect(() => {
    if (!token || !isManager) return;
    setLoadingHierarchy(true);
    api
      .getTargetHierarchy(token)
      .then(setHierarchy)
      .finally(() => setLoadingHierarchy(false));
  }, [token, isManager]);

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const pageTitle = "My Sales Targets";

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title={pageTitle}
        subtitle="Bottom-up target view — aggregated from MR level upward through the hierarchy"
        actions={
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger
              className="w-28 h-8 text-sm"
              data-ocid="year-selector"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <PageContent>
        {/* ── My Target Cards ── */}
        <div className="mb-6">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Target className="w-4 h-4" />
            My Target — {year}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PERIODS.map((p) => (
              <TargetCard
                key={p}
                period={p}
                target={targets[p]}
                loading={loadingTargets}
              />
            ))}
          </div>
        </div>

        {/* ── Team Hierarchy Table — managers only ── */}
        {isManager && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                {effectiveRole === Role.ZSM
                  ? "ZSM-wise Target Breakdown"
                  : "My Team Targets"}
              </h2>
              {loadingHierarchy && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Loading…
                </span>
              )}
            </div>
            <ScrollableTable>
              <table className="w-full text-sm font-body min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {[
                      { label: "Employee", align: "left" },
                      { label: "Role", align: "left" },
                      { label: "Territory", align: "left" },
                      { label: "Area", align: "left" },
                      { label: "Monthly", align: "right" },
                      { label: "Quarterly", align: "right" },
                      { label: "Half-Yearly", align: "right" },
                      { label: "Yearly", align: "right" },
                      { label: "Status", align: "left" },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-4 py-2.5 text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap text-${col.align}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingHierarchy ? (
                    [0, 1, 2, 3].map((i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0"
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                          <td key={j} className="px-4 py-2.5">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : hierarchy.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-muted-foreground text-sm"
                        data-ocid="hierarchy-empty-state"
                      >
                        No team target data found. Targets are assigned by
                        Admin/HR at MR level and aggregated upward.
                      </td>
                    </tr>
                  ) : (
                    hierarchy.map((node) => (
                      <TreeRow
                        key={String(node.userId)}
                        node={node}
                        depth={0}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
