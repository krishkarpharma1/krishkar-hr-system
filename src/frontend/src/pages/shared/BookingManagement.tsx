import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { IntendedUse } from "../../backend";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { BookingRequestInfo, ProductInfo } from "../../types";
import { BookingStatus } from "../../types";

const STATUS_BADGE: Record<
  BookingStatus,
  { className: string; label: string }
> = {
  [BookingStatus.Pending]: {
    className: "bg-yellow-100 text-yellow-700 border-yellow-300",
    label: "Pending",
  },
  [BookingStatus.Approved]: {
    className: "bg-green-100 text-green-700 border-green-300",
    label: "Approved",
  },
  [BookingStatus.Rejected]: {
    className: "bg-destructive/10 text-destructive border-destructive/30",
    label: "Rejected",
  },
};

interface SelectedItem {
  name: string;
  quantity: string;
  use: IntendedUse;
}

interface BookingFormData {
  selectedItems: SelectedItem[];
  targetDate: string;
  notes: string;
}

const EMPTY_FORM: BookingFormData = {
  selectedItems: [],
  targetDate: "",
  notes: "",
};

function BookingFormModal({
  open,
  onClose,
  onSubmit,
  submitting,
  title,
  products,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (items: SelectedItem[], targetDate: string, notes: string) => void;
  submitting: boolean;
  title: string;
  products: ProductInfo[];
}) {
  const [form, setForm] = useState<BookingFormData>(EMPTY_FORM);
  const [samplePick, setSamplePick] = useState("none");
  const [giftPick, setGiftPick] = useState("none");

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setSamplePick("none");
      setGiftPick("none");
    }
  }, [open]);

  if (!open) return null;

  const activeProducts = products.filter((p) => p.isActive);

  function addSample(name: string) {
    if (!name || name === "none") return;
    if (
      form.selectedItems.some(
        (i) => i.name === name && i.use === IntendedUse.Sample,
      )
    ) {
      setSamplePick("none");
      return;
    }
    setForm((f) => ({
      ...f,
      selectedItems: [
        ...f.selectedItems,
        { name, quantity: "1", use: IntendedUse.Sample },
      ],
    }));
    setSamplePick("none");
  }

  function addGift(name: string) {
    if (!name || name === "none") return;
    if (
      form.selectedItems.some(
        (i) => i.name === name && i.use === IntendedUse.Gift,
      )
    ) {
      setGiftPick("none");
      return;
    }
    setForm((f) => ({
      ...f,
      selectedItems: [
        ...f.selectedItems,
        { name, quantity: "1", use: IntendedUse.Gift },
      ],
    }));
    setGiftPick("none");
  }

  function updateQty(idx: number, qty: string) {
    setForm((f) => ({
      ...f,
      selectedItems: f.selectedItems.map((item, i) =>
        i === idx ? { ...item, quantity: qty } : item,
      ),
    }));
  }

  function removeItem(idx: number) {
    setForm((f) => ({
      ...f,
      selectedItems: f.selectedItems.filter((_, i) => i !== idx),
    }));
  }

  const isValid =
    form.selectedItems.length > 0 &&
    form.selectedItems.every(
      (i) => i.quantity.trim() && Number(i.quantity) > 0,
    ) &&
    form.targetDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h3 className="font-display font-semibold text-foreground text-base">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {/* Sample Articles */}
          <div>
            <Label className="text-sm font-body mb-1.5 block font-semibold">
              Add Sample Articles
            </Label>
            <Select value={samplePick} onValueChange={addSample}>
              <SelectTrigger data-ocid="booking-sample-pick">
                <SelectValue placeholder="Select a sample article…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select sample article —</SelectItem>
                {activeProducts.map((p) => (
                  <SelectItem key={p.id.toString()} value={p.name}>
                    {p.name}
                    {p.category ? ` (${p.category})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gift Articles */}
          <div>
            <Label className="text-sm font-body mb-1.5 block font-semibold">
              Add Gift Articles
            </Label>
            <Select value={giftPick} onValueChange={addGift}>
              <SelectTrigger data-ocid="booking-gift-pick">
                <SelectValue placeholder="Select a gift article…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select gift article —</SelectItem>
                {activeProducts.map((p) => (
                  <SelectItem key={`gift-${p.id.toString()}`} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Items with Quantities */}
          {form.selectedItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-body font-semibold">
                Selected Items <span className="text-destructive">*</span>
              </Label>
              <div className="bg-muted/30 border border-border rounded-md divide-y divide-border">
                {form.selectedItems.map((item, idx) => (
                  <div
                    key={`${item.use}-${item.name}-${idx}`}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                        item.use === IntendedUse.Sample
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-accent/10 text-accent border border-accent/20"
                      }`}
                    >
                      {item.use}
                    </span>
                    <span className="flex-1 text-sm text-foreground font-body truncate min-w-0">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label className="text-xs text-muted-foreground sr-only">
                        Qty
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQty(idx, e.target.value)}
                        className="w-20 h-7 text-sm"
                        placeholder="Qty"
                        data-ocid={`booking-item-qty-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.selectedItems.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              Select at least one sample or gift article above.
            </p>
          )}

          <div>
            <Label className="text-sm font-body mb-1 block">
              Target Date <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={form.targetDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, targetDate: e.target.value }))
              }
              data-ocid="booking-target-date"
            />
          </div>
          <div>
            <Label className="text-sm font-body mb-1 block">
              Notes (optional)
            </Label>
            <Textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Purpose, additional details..."
              className="min-h-[80px]"
              data-ocid="booking-notes"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-3 justify-end sticky bottom-0 bg-card">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!isValid || submitting}
            onClick={() =>
              onSubmit(form.selectedItems, form.targetDate, form.notes)
            }
            data-ocid="booking-submit-btn"
          >
            {submitting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Submit Request
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BookingManagement() {
  const { session } = useAuthStore();
  const [bookings, setBookings] = useState<BookingRequestInfo[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitTarget, setResubmitTarget] =
    useState<BookingRequestInfo | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [data, prods] = await Promise.all([
        api.listMyBookingRequests(session.token),
        api.listProducts(),
      ]);
      setBookings(data);
      setProducts(prods);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  /** Submit one booking request per selected item */
  const handleSubmit = async (
    items: SelectedItem[],
    targetDate: string,
    notes: string,
  ) => {
    if (!session) return;
    setSubmitting(true);
    try {
      let anyFailed = false;
      for (const item of items) {
        const res = await api.createBookingRequest(
          session.token,
          item.name,
          BigInt(item.quantity),
          item.use,
          targetDate,
          notes.trim(),
        );
        if (res.__kind__ !== "ok") {
          showToast(`Failed: ${res.err}`, false);
          anyFailed = true;
          break;
        }
      }
      if (!anyFailed) {
        showToast(
          `${items.length} booking request${items.length > 1 ? "s" : ""} submitted successfully`,
          true,
        );
        setShowForm(false);
        await load();
      }
    } catch {
      showToast("Failed to submit booking request", false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    if (!session || !resubmitTarget) return;
    setSubmitting(true);
    try {
      const res = await api.resubmitBookingRequest(
        session.token,
        resubmitTarget.id,
      );
      if (res.__kind__ === "ok") {
        showToast("Booking request resubmitted", true);
        setResubmitTarget(null);
        await load();
      } else {
        showToast(res.err, false);
      }
    } catch {
      showToast("Failed to resubmit request", false);
    } finally {
      setSubmitting(false);
    }
  };

  const pending = bookings.filter((b) => b.status === BookingStatus.Pending);
  const approved = bookings.filter((b) => b.status === BookingStatus.Approved);
  const rejected = bookings.filter((b) => b.status === BookingStatus.Rejected);

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border shadow-lg text-sm font-body flex items-center gap-2 ${
            toast.ok
              ? "bg-green-50 border-green-300 text-green-700"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {toast.ok ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {/* New booking modal */}
      <BookingFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        title="New Booking Request"
        products={products}
      />

      {/* Resubmit confirm dialog */}
      {resubmitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-sm shadow-lg p-5 space-y-4">
            <h3 className="font-display font-semibold text-foreground">
              Re-submit Booking
            </h3>
            <p className="text-sm text-muted-foreground">
              Re-submit request for{" "}
              <span className="font-semibold text-foreground">
                {resubmitTarget.itemName}
              </span>
              ?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setResubmitTarget(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResubmit}
                disabled={submitting}
                data-ocid="booking-resubmit-confirm-btn"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                Re-submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-semibold text-foreground text-base">
            Booking Requests
          </h2>
          <p className="text-xs text-muted-foreground font-body">
            Request samples or gift articles for your field visits
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowForm(true)}
          data-ocid="new-booking-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Booking Request
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: "Pending",
            count: pending.length,
            cls: "bg-yellow-100 text-yellow-700 border-yellow-300",
          },
          {
            label: "Approved",
            count: approved.length,
            cls: "bg-green-100 text-green-700 border-green-300",
          },
          {
            label: "Rejected",
            count: rejected.length,
            cls: "bg-destructive/10 text-destructive border-destructive/30",
          },
        ].map((s) => (
          <span
            key={s.label}
            className={`text-xs px-3 py-1 rounded-full border font-body ${s.cls}`}
          >
            {s.label}: {s.count}
          </span>
        ))}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
            My Booking Requests
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm font-body">
            Loading...
          </div>
        ) : bookings.length === 0 ? (
          <div
            className="p-10 text-center text-muted-foreground font-body flex flex-col items-center gap-3"
            data-ocid="booking-empty-state"
          >
            <Package className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">No booking requests yet</p>
            <p className="text-xs">
              Submit your first request for sample or gift articles
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              className="mt-1"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Booking Request
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                    Use
                  </th>
                  <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                    Target Date
                  </th>
                  <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    Submitted
                  </th>
                  <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                    Details / Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((b) => {
                  const badge = STATUS_BADGE[b.status as BookingStatus];
                  return (
                    <tr
                      key={String(b.id)}
                      className="hover:bg-muted/10"
                      data-ocid="booking-row"
                    >
                      <td className="px-4 py-3 font-body text-foreground font-medium max-w-[160px] truncate">
                        {b.itemName}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-foreground text-xs">
                        {String(b.quantity)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded border font-body ${
                            b.intendedUse === "Sample"
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-accent/10 text-accent border-accent/30"
                          }`}
                        >
                          {b.intendedUse}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {b.targetDate}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded border font-display ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap hidden sm:table-cell">
                        {new Date(
                          Number(b.createdAt) / 1_000_000,
                        ).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px]">
                        {b.status === BookingStatus.Rejected ? (
                          <div className="space-y-1.5">
                            {b.rejectionReason && (
                              <p className="text-destructive text-xs truncate">
                                ✕ {b.rejectionReason}
                              </p>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2.5 text-xs"
                              onClick={() => setResubmitTarget(b)}
                              data-ocid="booking-resubmit-btn"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Re-submit
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 truncate block max-w-[180px]">
                            {b.notes || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
