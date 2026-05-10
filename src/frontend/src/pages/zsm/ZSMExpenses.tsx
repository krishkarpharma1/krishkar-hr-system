import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { TaDaExpense } from "../../types";

export default function ZSMExpenses() {
  const { session } = useAuthStore();
  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [loading, setLoading] = useState(false);

  const token = session?.token ?? "";

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getPendingExpenses(token)
      .then(setExpenses)
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove(expenseId: bigint, approved: boolean) {
    const res = await api.approveExpense(token, expenseId, approved);
    if (res.__kind__ === "ok") {
      toast.success(approved ? "Expense approved" : "Expense rejected");
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    } else {
      toast.error(res.err);
    }
  }

  return (
    <PortalLayout portalRole={Role.ZSM}>
      <PageHeader
        title="Expense Approvals"
        subtitle="Review and approve TA/DA expense claims from your zone"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLoading(true);
              api
                .getPendingExpenses(token)
                .then(setExpenses)
                .finally(() => setLoading(false));
            }}
            disabled={loading}
            data-ocid="btn-refresh-expenses"
          >
            {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />
      <PageContent>
        <DataTable<TaDaExpense>
          columns={[
            { key: "date", label: "Date" },
            { key: "route", label: "Route" },
            { key: "km", label: "Km", className: "text-right" },
            { key: "ta", label: "TA (₹)", className: "text-right" },
            { key: "da", label: "DA (₹)", className: "text-right" },
            { key: "total", label: "Total (₹)", className: "text-right" },
            { key: "actions", label: "Actions", className: "text-right" },
          ]}
          data={expenses}
          getKey={(item) => String(item.id)}
          loading={loading}
          emptyMessage="No pending expense claims"
          renderRow={(exp) => (
            <>
              <td className="px-4 py-3 text-sm text-foreground">{exp.date}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[160px]">
                {exp.fromLocation} → {exp.toLocation}
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                {String(exp.distanceKm)}
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                {String(exp.travelAmount)}
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                {String(exp.dailyAllowance)}
              </td>
              <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-foreground">
                ₹{String(exp.totalAmount)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    onClick={() => handleApprove(exp.id, true)}
                    data-ocid="btn-approve-expense"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleApprove(exp.id, false)}
                    data-ocid="btn-reject-expense"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </div>
              </td>
            </>
          )}
        />
      </PageContent>
    </PortalLayout>
  );
}
