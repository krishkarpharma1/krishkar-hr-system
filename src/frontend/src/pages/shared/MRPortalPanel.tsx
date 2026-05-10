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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Loader2, Plus, Stethoscope, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WorkType, WorkingMode, WorkingStationSource } from "../../backend";
import type { WorkingStationSource__1 } from "../../backend.d";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  AdditionalCharge,
  DoctorInfo,
  GpsCoord,
  ProductInfo,
} from "../../types";

const NULL_GPS: GpsCoord = { lat: 0, lng: 0, timestamp: BigInt(0) };

interface SampleRow {
  id: number;
  productId: bigint | null;
  quantity: string;
}
interface GiftRow {
  id: number;
  giftArticleId: bigint | null;
  giftArticleName: string;
  quantity: string;
}

interface Props {
  charge: AdditionalCharge;
  primaryRole: string;
  onClose: () => void;
}

export default function MRPortalPanel({ charge, primaryRole, onClose }: Props) {
  const { session } = useAuthStore();
  const userId = session?.userId ?? BigInt(0);

  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Doctor Call tab
  const [dcDoctorId, setDcDoctorId] = useState<string>("");
  const [dcProductIds, setDcProductIds] = useState<bigint[]>([]);
  const [dcSamples, setDcSamples] = useState<SampleRow[]>([]);
  const [dcGifts, setDcGifts] = useState<GiftRow[]>([]);
  const [dcNotes, setDcNotes] = useState("");
  const [savingDc, setSavingDc] = useState(false);

  // Sample Distribution tab
  const [sdDoctorId, setSdDoctorId] = useState<string>("");
  const [sdProductId, setSdProductId] = useState<string>("");
  const [sdQty, setSdQty] = useState("");
  const [sdDate, setSdDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingSd, setSavingSd] = useState(false);

  // Gift Distribution tab
  const [gdDoctorId, setGdDoctorId] = useState<string>("");
  const [gdGiftName, setGdGiftName] = useState("");
  const [gdQty, setGdQty] = useState("");
  const [gdDate, setGdDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingGd, setSavingGd] = useState(false);

  const panelRef = useRef<HTMLDialogElement>(null);

  // Check expiry
  const isExpired = Date.now() * 1_000_000 > Number(charge.effectiveTo);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.listDoctors(), api.listProducts()])
      .then(([docs, prods]) => {
        setDoctors(docs.filter((d) => d.isActive));
        setProducts(prods.filter((p) => p.isActive));
      })
      .finally(() => setLoading(false));
  }, []);

  // Trap focus inside panel
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();
  }, []);

  const filteredDoctors = doctors.filter((d) =>
    d.name.toLowerCase().includes(doctorSearch.toLowerCase()),
  );

  function toggleProduct(pid: bigint) {
    setDcProductIds((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid],
    );
  }

  async function handleSaveDoctorCall() {
    if (isExpired) {
      toast.error("Your MR charge has expired. No new entries allowed.");
      onClose();
      return;
    }
    if (!dcDoctorId) {
      toast.error("Please select a doctor.");
      return;
    }
    setSavingDc(true);
    try {
      const samples = dcSamples
        .filter((s) => s.productId !== null && s.quantity !== "")
        .map((s) => ({
          productId: s.productId!,
          quantity: BigInt(s.quantity),
        }));
      const visitEntry = {
        doctorId: BigInt(dcDoctorId),
        notes: dcNotes,
        gps: undefined,
        productIds: dcProductIds,
        detailsPerProduct: [] as Array<[bigint, string]>,
        samplesDistributed: samples,
        giftArticles: dcGifts
          .filter((g) => g.giftArticleId !== null && g.quantity !== "")
          .map((g) => ({
            giftArticleId: g.giftArticleId!,
            giftArticleName: g.giftArticleName,
            quantity: BigInt(g.quantity),
          })),
      };

      await api.createCallReport(userId, {
        date: new Date().toISOString().slice(0, 10),
        workType: WorkType.Field,
        gps: NULL_GPS,
        startLocation: NULL_GPS,
        endLocation: NULL_GPS,
        remarks: `[MR Portal — ${primaryRole} acting as MR] ${dcNotes}`,
        doctorsVisited: [visitEntry],
        samplesDistributed: samples,
        stationType: "Head Quarter",
        workingStation: undefined,
        workingStationSource:
          "OtherStation" as unknown as WorkingStationSource__1,
        workingMode: WorkingMode.WorkingAlone,
        workingWithUserId: undefined,
        workingWithUserName: undefined,
      });

      toast.success("Doctor visit saved via MR Portal");
      setDcDoctorId("");
      setDcProductIds([]);
      setDcSamples([]);
      setDcGifts([]);
      setDcNotes("");
    } catch {
      toast.error("Failed to save doctor visit.");
    } finally {
      setSavingDc(false);
    }
  }

  async function handleSaveSampleDist() {
    if (isExpired) {
      toast.error("Your MR charge has expired.");
      onClose();
      return;
    }
    if (!sdDoctorId || !sdProductId || !sdQty) {
      toast.error("Please fill all required fields.");
      return;
    }
    setSavingSd(true);
    try {
      await api.createCallReport(userId, {
        date: sdDate,
        workType: WorkType.Field,
        gps: NULL_GPS,
        startLocation: NULL_GPS,
        endLocation: NULL_GPS,
        remarks: `[MR Portal — Sample Distribution — ${primaryRole} acting as MR]`,
        doctorsVisited: [
          {
            doctorId: BigInt(sdDoctorId),
            notes: "Sample distribution via MR Portal",
            gps: undefined,
            productIds: [BigInt(sdProductId)],
            detailsPerProduct: [] as Array<[bigint, string]>,
            samplesDistributed: [
              { productId: BigInt(sdProductId), quantity: BigInt(sdQty) },
            ],
            giftArticles: [],
          },
        ],
        samplesDistributed: [
          { productId: BigInt(sdProductId), quantity: BigInt(sdQty) },
        ],
        stationType: "Head Quarter",
        workingStation: undefined,
        workingStationSource:
          "OtherStation" as unknown as WorkingStationSource__1,
        workingMode: WorkingMode.WorkingAlone,
        workingWithUserId: undefined,
        workingWithUserName: undefined,
      });
      toast.success("Sample distribution saved via MR Portal");
      setSdDoctorId("");
      setSdProductId("");
      setSdQty("");
      setSdDate(new Date().toISOString().slice(0, 10));
    } catch {
      toast.error("Failed to save sample distribution.");
    } finally {
      setSavingSd(false);
    }
  }

  async function handleSaveGiftDist() {
    if (isExpired) {
      toast.error("Your MR charge has expired.");
      onClose();
      return;
    }
    if (!gdDoctorId || !gdGiftName.trim() || !gdQty) {
      toast.error("Please fill all required fields.");
      return;
    }
    setSavingGd(true);
    try {
      await api.createCallReport(userId, {
        date: gdDate,
        workType: WorkType.Field,
        gps: NULL_GPS,
        startLocation: NULL_GPS,
        endLocation: NULL_GPS,
        remarks: `[MR Portal — Gift Distribution — ${primaryRole} acting as MR]`,
        doctorsVisited: [
          {
            doctorId: BigInt(gdDoctorId),
            notes: "Gift distribution via MR Portal",
            gps: undefined,
            productIds: [],
            detailsPerProduct: [] as Array<[bigint, string]>,
            samplesDistributed: [],
            giftArticles: [
              {
                giftArticleId: BigInt(0),
                giftArticleName: gdGiftName.trim(),
                quantity: BigInt(gdQty),
              },
            ],
          },
        ],
        samplesDistributed: [],
        stationType: "Head Quarter",
        workingStation: undefined,
        workingStationSource:
          "OtherStation" as unknown as WorkingStationSource__1,
        workingMode: WorkingMode.WorkingAlone,
        workingWithUserId: undefined,
        workingWithUserName: undefined,
      });
      toast.success("Gift distribution saved via MR Portal");
      setGdDoctorId("");
      setGdGiftName("");
      setGdQty("");
      setGdDate(new Date().toISOString().slice(0, 10));
    } catch {
      toast.error("Failed to save gift distribution.");
    } finally {
      setSavingGd(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm">
      <dialog
        ref={panelRef}
        open
        className="h-full w-full max-w-lg m-0 p-0 bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden relative"
        aria-label="MR Portal"
        data-ocid="mr-portal-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-amber-500 text-white flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-base">MR Portal</h2>
            <p className="text-xs text-amber-100">
              {primaryRole} acting as MR · Expires{" "}
              {new Date(
                Number(charge.effectiveTo) / 1_000_000,
              ).toLocaleDateString("en-IN")}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-amber-600"
            onClick={onClose}
            aria-label="Close MR Portal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {isExpired && (
          <div className="px-5 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm flex-shrink-0">
            ⚠ This MR charge has expired. Entries are no longer allowed.
          </div>
        )}

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="doctor-call" className="h-full">
            <TabsList className="w-full rounded-none border-b border-border bg-muted/30 h-auto p-0 flex-shrink-0">
              <TabsTrigger
                value="doctor-call"
                className="flex-1 rounded-none py-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary"
                data-ocid="mr-portal-tab-doctor-call"
              >
                <Stethoscope className="w-3.5 h-3.5 mr-1.5" />
                Doctor Call
              </TabsTrigger>
              <TabsTrigger
                value="sample-dist"
                className="flex-1 rounded-none py-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary"
                data-ocid="mr-portal-tab-samples"
              >
                Sample Dist.
              </TabsTrigger>
              <TabsTrigger
                value="gift-dist"
                className="flex-1 rounded-none py-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary"
                data-ocid="mr-portal-tab-gifts"
              >
                <Gift className="w-3.5 h-3.5 mr-1.5" />
                Gift Dist.
              </TabsTrigger>
            </TabsList>

            {/* DOCTOR CALL */}
            <TabsContent value="doctor-call" className="p-5 space-y-4 mt-0">
              {/* Doctor Search + Select */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">
                  Search Doctor
                </Label>
                <div className="relative mb-2">
                  <Input
                    placeholder="Type to search…"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="h-8 text-sm pr-8"
                    data-ocid="mr-portal-doctor-search"
                  />
                </div>
                <Select
                  value={dcDoctorId}
                  onValueChange={setDcDoctorId}
                  disabled={loading || isExpired}
                >
                  <SelectTrigger
                    className="h-9 text-sm"
                    data-ocid="mr-portal-doctor-select"
                  >
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {loading ? (
                      <SelectItem value="loading" disabled>
                        Loading…
                      </SelectItem>
                    ) : filteredDoctors.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No doctors found
                      </SelectItem>
                    ) : (
                      filteredDoctors.map((d) => (
                        <SelectItem key={String(d.id)} value={String(d.id)}>
                          {d.name} — {d.area || d.territory}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Products Discussed */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">
                  Products Discussed
                </Label>
                <div className="border border-border rounded-lg p-3 max-h-36 overflow-y-auto space-y-1">
                  {products.map((p) => (
                    <label
                      key={String(p.id)}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 px-1 py-0.5 rounded text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={dcProductIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="rounded"
                        disabled={isExpired}
                      />
                      <span className="text-foreground">{p.name}</span>
                    </label>
                  ))}
                  {products.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No products
                    </p>
                  )}
                </div>
              </div>

              {/* Samples */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium">Samples Given</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() =>
                      setDcSamples((p) => [
                        ...p,
                        { id: Date.now(), productId: null, quantity: "" },
                      ])
                    }
                    disabled={isExpired}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
                {dcSamples.map((s, si) => (
                  <div key={s.id} className="flex gap-2 mb-2">
                    <Select
                      value={s.productId ? String(s.productId) : ""}
                      onValueChange={(v) =>
                        setDcSamples((p) =>
                          p.map((r, i) =>
                            i === si ? { ...r, productId: BigInt(v) } : r,
                          ),
                        )
                      }
                      disabled={isExpired}
                    >
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={String(p.id)} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={s.quantity}
                      onChange={(e) =>
                        setDcSamples((p) =>
                          p.map((r, i) =>
                            i === si ? { ...r, quantity: e.target.value } : r,
                          ),
                        )
                      }
                      className="w-20 h-8 text-xs"
                      disabled={isExpired}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        setDcSamples((p) => p.filter((_, i) => i !== si))
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Gift Articles */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium">
                    Gift Articles Given
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() =>
                      setDcGifts((p) => [
                        ...p,
                        {
                          id: Date.now(),
                          giftArticleId: null,
                          giftArticleName: "",
                          quantity: "",
                        },
                      ])
                    }
                    disabled={isExpired}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
                {dcGifts.map((g, gi) => (
                  <div key={g.id} className="flex gap-2 mb-2">
                    <Input
                      placeholder="Gift article name"
                      value={g.giftArticleName}
                      onChange={(e) =>
                        setDcGifts((p) =>
                          p.map((r, i) =>
                            i === gi
                              ? { ...r, giftArticleName: e.target.value }
                              : r,
                          ),
                        )
                      }
                      className="flex-1 h-8 text-xs"
                      disabled={isExpired}
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={g.quantity}
                      onChange={(e) =>
                        setDcGifts((p) =>
                          p.map((r, i) =>
                            i === gi ? { ...r, quantity: e.target.value } : r,
                          ),
                        )
                      }
                      className="w-20 h-8 text-xs"
                      disabled={isExpired}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        setDcGifts((p) => p.filter((_, i) => i !== gi))
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-medium mb-1.5 block">
                  Notes
                </Label>
                <Input
                  placeholder="Optional notes…"
                  value={dcNotes}
                  onChange={(e) => setDcNotes(e.target.value)}
                  className="h-8 text-sm"
                  disabled={isExpired}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSaveDoctorCall}
                disabled={savingDc || isExpired || !dcDoctorId}
                data-ocid="mr-portal-save-doctor-call"
              >
                {savingDc && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Doctor Call
              </Button>
            </TabsContent>

            {/* SAMPLE DISTRIBUTION */}
            <TabsContent value="sample-dist" className="p-5 space-y-4 mt-0">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">
                  Doctor *
                </Label>
                <Input
                  placeholder="Search doctor…"
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="h-8 text-sm mb-2"
                />
                <Select
                  value={sdDoctorId}
                  onValueChange={setSdDoctorId}
                  disabled={loading || isExpired}
                >
                  <SelectTrigger
                    className="h-9 text-sm"
                    data-ocid="mr-portal-sd-doctor"
                  >
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map((d) => (
                      <SelectItem key={String(d.id)} value={String(d.id)}>
                        {d.name} — {d.area || d.territory}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">
                  Product / Sample *
                </Label>
                <Select
                  value={sdProductId}
                  onValueChange={setSdProductId}
                  disabled={loading || isExpired}
                >
                  <SelectTrigger
                    className="h-9 text-sm"
                    data-ocid="mr-portal-sd-product"
                  >
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={String(p.id)} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    Quantity *
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={sdQty}
                    onChange={(e) => setSdQty(e.target.value)}
                    className="h-9 text-sm"
                    disabled={isExpired}
                    data-ocid="mr-portal-sd-qty"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    Date *
                  </Label>
                  <Input
                    type="date"
                    value={sdDate}
                    onChange={(e) => setSdDate(e.target.value)}
                    className="h-9 text-sm"
                    disabled={isExpired}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSaveSampleDist}
                disabled={
                  savingSd || isExpired || !sdDoctorId || !sdProductId || !sdQty
                }
                data-ocid="mr-portal-save-sample-dist"
              >
                {savingSd && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Sample Distribution
              </Button>
            </TabsContent>

            {/* GIFT DISTRIBUTION */}
            <TabsContent value="gift-dist" className="p-5 space-y-4 mt-0">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">
                  Doctor *
                </Label>
                <Input
                  placeholder="Search doctor…"
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="h-8 text-sm mb-2"
                />
                <Select
                  value={gdDoctorId}
                  onValueChange={setGdDoctorId}
                  disabled={loading || isExpired}
                >
                  <SelectTrigger
                    className="h-9 text-sm"
                    data-ocid="mr-portal-gd-doctor"
                  >
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map((d) => (
                      <SelectItem key={String(d.id)} value={String(d.id)}>
                        {d.name} — {d.area || d.territory}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">
                  Gift Article Name *
                </Label>
                <Input
                  placeholder="e.g. Pen set, Notepad…"
                  value={gdGiftName}
                  onChange={(e) => setGdGiftName(e.target.value)}
                  className="h-9 text-sm"
                  disabled={isExpired}
                  data-ocid="mr-portal-gd-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    Quantity *
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={gdQty}
                    onChange={(e) => setGdQty(e.target.value)}
                    className="h-9 text-sm"
                    disabled={isExpired}
                    data-ocid="mr-portal-gd-qty"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">
                    Date *
                  </Label>
                  <Input
                    type="date"
                    value={gdDate}
                    onChange={(e) => setGdDate(e.target.value)}
                    className="h-9 text-sm"
                    disabled={isExpired}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSaveGiftDist}
                disabled={
                  savingGd ||
                  isExpired ||
                  !gdDoctorId ||
                  !gdGiftName.trim() ||
                  !gdQty
                }
                data-ocid="mr-portal-save-gift-dist"
              >
                {savingGd && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Gift Distribution
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </dialog>
    </div>
  );
}
