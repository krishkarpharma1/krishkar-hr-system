/**
 * ASMExpenses — standalone expense management page for ASM.
 * Shows both team expense approvals and ASM's own personal TA/DA form.
 */
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
import PersonalTaDaForm from "../shared/PersonalTaDaForm";

type ExpenseTab = "approvals" | "personal";

export default function ASMExpenses() {
  const { session } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ExpenseTab>("approvals");
  const [pendingExpenses, setPendingExpenses] = useState<TaDaExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const token = session?.token ?? "";

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getPendingExpenses(token)
      .then(setPendingExpenses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove(id: bigint, approved: boolean) {
    const res = await api.approveExpense(token, id, approved);
    if (res.__kind__ === "ok") {
      toast.success(approved ? "Expense approved" : "Expense rejected");
      setPendingExpenses((prev) => prev.filter((e) => e.id !== id));
    } else {
      toast.error(res.err);
    }
  }

  return (
    <PortalLayout portalRole={Role.ASM}>
      <PageHeader
        title="Expenses"
        subtitle="Team expense approvals and your own TA/DA claims"
        actions={
          <div className="flex gap-2">
            <Button
              variant={activeTab === "approvals" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("approvals")}
              data-ocid="asm-expenses-page.tab-approvals"
            >
              Team Approvals
            </Button>
            <Button
              variant={activeTab === "personal" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("personal")}
              data-ocid="asm-expenses-page.tab-personal"
            >
              My TA/DA
            </Button>
          </div>
        }
      />
      <PageContent>
        {activeTab === "approvals" && (
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
            data={pendingExpenses}
            getKey={(e) => String(e.id)}
            loading={loading}
            emptyMessage="No pending expense claims to approve"
            renderRow={(exp) => (
              <>
                <td className="px-4 py-3 text-sm text-foreground">
                  {exp.date}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[160px]">
                  {exp.fromLocation?.trim() && exp.toLocation?.trim()
                    ? `${exp.fromLocation} → ${exp.toLocation}`
                    : "HQ"}
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
                  ₹{Number(exp.totalAmount).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-accent border-accent/30 hover:bg-accent/10"
                      onClick={() => handleApprove(exp.id, true)}
                      data-ocid="asm-expenses-page.approve"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleApprove(exp.id, false)}
                      data-ocid="asm-expenses-page.reject"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </td>
              </>
            )}
          />
        )}

        {activeTab === "personal" && <PersonalTaDaForm roleLabel="ASM" />}
      </PageContent>
    </PortalLayout>
  );
}
