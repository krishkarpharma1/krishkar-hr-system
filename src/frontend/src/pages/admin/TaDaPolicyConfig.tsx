import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise } from "@/utils/currencyFormatter";
import {
  AlertTriangle,
  Edit2,
  IndianRupee,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import type { TaDaGrade } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

export type { TaDaGrade };

const EMPTY_FORM = {
  gradeName: "",
  daHqRate: "",
  daExStationRate: "",
  daOutStationRate: "",
  taPerKmRate: "",
  lodgingEntitlement: "",
  mealAllowance: "",
};

type FormState = typeof EMPTY_FORM;
type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(
  form: FormState,
  grades: TaDaGrade[],
  editingName: string | null,
): FormErrors {
  const errors: FormErrors = {};
  if (!form.gradeName.trim()) {
    errors.gradeName = "Grade name is required";
  } else if (
    grades.some(
      (g) =>
        g.gradeName.toLowerCase() === form.gradeName.trim().toLowerCase() &&
        g.gradeName !== editingName,
    )
  ) {
    errors.gradeName = "A grade with this name already exists";
  }
  if (
    form.daHqRate === "" ||
    Number(form.daHqRate) < 0 ||
    Number.isNaN(Number(form.daHqRate))
  ) {
    errors.daHqRate = "Enter a valid non-negative amount";
  }
  if (
    form.daExStationRate === "" ||
    Number(form.daExStationRate) < 0 ||
    Number.isNaN(Number(form.daExStationRate))
  ) {
    errors.daExStationRate = "Enter a valid non-negative amount";
  }
  if (
    form.daOutStationRate === "" ||
    Number(form.daOutStationRate) < 0 ||
    Number.isNaN(Number(form.daOutStationRate))
  ) {
    errors.daOutStationRate = "Enter a valid non-negative amount";
  }
  if (
    form.taPerKmRate === "" ||
    Number(form.taPerKmRate) < 0 ||
    Number.isNaN(Number(form.taPerKmRate))
  ) {
    errors.taPerKmRate = "Enter a valid non-negative amount";
  }
  if (
    form.lodgingEntitlement === "" ||
    Number(form.lodgingEntitlement) < 0 ||
    Number.isNaN(Number(form.lodgingEntitlement))
  ) {
    errors.lodgingEntitlement = "Enter a valid non-negative amount";
  }
  if (
    form.mealAllowance !== "" &&
    (Number(form.mealAllowance) < 0 || Number.isNaN(Number(form.mealAllowance)))
  ) {
    errors.mealAllowance = "Enter a valid non-negative amount";
  }
  return errors;
}

function formToGrade(form: FormState): TaDaGrade {
  return {
    gradeName: form.gradeName.trim(),
    daHqRate: BigInt(Math.round(Number(form.daHqRate) * 100)),
    daExStationRate: BigInt(Math.round(Number(form.daExStationRate) * 100)),
    daOutStationRate: BigInt(Math.round(Number(form.daOutStationRate) * 100)),
    taPerKmRate: BigInt(Math.round(Number(form.taPerKmRate) * 100)),
    lodgingEntitlement: BigInt(
      Math.round(Number(form.lodgingEntitlement) * 100),
    ),
    mealAllowance: BigInt(Math.round(Number(form.mealAllowance || "0") * 100)),
  };
}

function gradeToForm(grade: TaDaGrade): FormState {
  return {
    gradeName: grade.gradeName,
    daHqRate: String(Number(grade.daHqRate) / 100),
    daExStationRate: String(Number(grade.daExStationRate) / 100),
    daOutStationRate: String(Number(grade.daOutStationRate) / 100),
    taPerKmRate: String(Number(grade.taPerKmRate) / 100),
    lodgingEntitlement: String(Number(grade.lodgingEntitlement) / 100),
    mealAllowance: String(Number(grade.mealAllowance) / 100),
  };
}

export default function TaDaPolicyConfig() {
  const { session } = useAuthStore();
  const [grades, setGrades] = useState<TaDaGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  async function loadGrades() {
    setLoading(true);
    try {
      const result = await api.getTaDaGrades();
      if (result.__kind__ === "ok") {
        setGrades(result.ok as TaDaGrade[]);
      }
    } catch {
      toast.error("Failed to load TA/DA grades");
    } finally {
      setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadGrades is stable on mount
  useEffect(() => {
    loadGrades();
  }, []);

  function openAdd() {
    setEditingName(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  }

  function openEdit(grade: TaDaGrade) {
    setEditingName(grade.gradeName);
    setForm(gradeToForm(grade));
    setErrors({});
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingName(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSave() {
    if (!session?.token) return;
    const errs = validate(form, grades, editingName);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const grade = formToGrade(form);
      const result = await api.setTaDaGrade(session.token, grade);
      if (result.__kind__ === "ok") {
        toast.success(
          editingName
            ? `Grade "${grade.gradeName}" updated successfully`
            : `Grade "${grade.gradeName}" added successfully`,
        );
        closeForm();
        await loadGrades();
      } else {
        toast.error(`Failed to save: ${result.err}`);
      }
    } catch {
      toast.error("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(gradeName: string) {
    if (!session?.token) return;
    setDeletingName(gradeName);
    try {
      const result = await api.deleteTaDaGrade(session.token, gradeName);
      if (result.__kind__ === "ok") {
        toast.success(`Grade "${gradeName}" deleted`);
        await loadGrades();
      } else {
        toast.error(`Failed to delete: ${result.err}`);
      }
    } catch {
      toast.error("An error occurred while deleting");
    } finally {
      setDeletingName(null);
    }
  }

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="TA/DA Policy Configuration"
        subtitle="Define grade-based Travelling Allowance and Daily Allowance rates for field staff"
      />
      <PageContent>
        {/* Info banner */}
        <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-6">
          <IndianRupee className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground font-body">
            Configure TA/DA rates per grade or designation. These rates are used
            to auto-calculate allowances on TA/DA claim forms. All rates are
            entered in ₹ (rupees) and stored internally in paise.
          </p>
        </div>

        {/* Add button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-display font-semibold text-foreground">
            Configured Grades
          </h2>
          <Button
            type="button"
            onClick={openAdd}
            data-ocid="tada_policy.add_button"
            className="gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Add Grade
          </Button>
        </div>

        {/* Grade table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : grades.length === 0 && !showForm ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-16 bg-muted/30 border border-dashed border-border rounded-xl"
            data-ocid="tada_policy.empty_state"
          >
            <IndianRupee className="w-10 h-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground font-body text-center">
              No TA/DA grades configured.
              <br />
              Add a grade to get started.
            </p>
            <Button
              type="button"
              onClick={openAdd}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Grade
            </Button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Grade / Designation
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      DA - HQ Day
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      DA - Ex-Station
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      DA - Out-Station
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      TA / km
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Lodging / Night
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Meal Allowance
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {grades.map((grade, idx) => (
                    <tr
                      key={grade.gradeName}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`tada_policy.item.${idx + 1}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-display font-semibold text-sm text-foreground">
                          {grade.gradeName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {formatPaise(grade.daHqRate)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {formatPaise(grade.daExStationRate)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {formatPaise(grade.daOutStationRate)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {formatPaise(grade.taPerKmRate)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {formatPaise(grade.lodgingEntitlement)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {Number(grade.mealAllowance) > 0 ? (
                          formatPaise(grade.mealAllowance)
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                            onClick={() => openEdit(grade)}
                            data-ocid={`tada_policy.edit_button.${idx + 1}`}
                            aria-label={`Edit ${grade.gradeName}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(grade.gradeName)}
                            disabled={deletingName === grade.gradeName}
                            data-ocid={`tada_policy.delete_button.${idx + 1}`}
                            aria-label={`Delete ${grade.gradeName}`}
                          >
                            {deletingName === grade.gradeName ? (
                              <span className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add / Edit Form */}
        {showForm && (
          <div
            className="mt-6 bg-card border border-primary/20 rounded-xl shadow-sm"
            data-ocid="tada_policy.dialog"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-display font-semibold text-foreground">
                  {editingName ? `Edit Grade: ${editingName}` : "Add New Grade"}
                </h3>
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  Enter rates in ₹ per day / per km
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={closeForm}
                data-ocid="tada_policy.close_button"
                aria-label="Close form"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
              {/* Grade Name */}
              <div className="sm:col-span-2 lg:col-span-3">
                <Label
                  htmlFor="gradeName"
                  className="text-sm font-display font-medium text-foreground mb-1.5 block"
                >
                  Grade / Designation Name
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="gradeName"
                  value={form.gradeName}
                  onChange={(e) => handleChange("gradeName", e.target.value)}
                  placeholder="e.g. MR Grade 1, Senior MR, ASM"
                  className={errors.gradeName ? "border-destructive" : ""}
                  data-ocid="tada_policy.input"
                />
                {errors.gradeName && (
                  <p
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    data-ocid="tada_policy.field_error"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {errors.gradeName}
                  </p>
                )}
              </div>

              {/* DA - HQ Day */}
              <div>
                <Label
                  htmlFor="daHqRate"
                  className="text-sm font-display font-medium text-foreground mb-1.5 block"
                >
                  DA Rate - HQ Day (₹)
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="daHqRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.daHqRate}
                  onChange={(e) => handleChange("daHqRate", e.target.value)}
                  placeholder="0"
                  className={errors.daHqRate ? "border-destructive" : ""}
                />
                {errors.daHqRate && (
                  <p
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    data-ocid="tada_policy.field_error"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {errors.daHqRate}
                  </p>
                )}
              </div>

              {/* DA - Ex-Station */}
              <div>
                <Label
                  htmlFor="daExStationRate"
                  className="text-sm font-display font-medium text-foreground mb-1.5 block"
                >
                  DA Rate - Ex-Station Day (₹)
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="daExStationRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.daExStationRate}
                  onChange={(e) =>
                    handleChange("daExStationRate", e.target.value)
                  }
                  placeholder="0"
                  className={errors.daExStationRate ? "border-destructive" : ""}
                />
                {errors.daExStationRate && (
                  <p
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    data-ocid="tada_policy.field_error"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {errors.daExStationRate}
                  </p>
                )}
              </div>

              {/* DA - Out-Station */}
              <div>
                <Label
                  htmlFor="daOutStationRate"
                  className="text-sm font-display font-medium text-foreground mb-1.5 block"
                >
                  DA Rate - Out-Station Day (₹)
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="daOutStationRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.daOutStationRate}
                  onChange={(e) =>
                    handleChange("daOutStationRate", e.target.value)
                  }
                  placeholder="0"
                  className={
                    errors.daOutStationRate ? "border-destructive" : ""
                  }
                />
                {errors.daOutStationRate && (
                  <p
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    data-ocid="tada_policy.field_error"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {errors.daOutStationRate}
                  </p>
                )}
              </div>

              {/* TA per km */}
              <div>
                <Label
                  htmlFor="taPerKmRate"
                  className="text-sm font-display font-medium text-foreground mb-1.5 block"
                >
                  TA Rate per km (₹)
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="taPerKmRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.taPerKmRate}
                  onChange={(e) => handleChange("taPerKmRate", e.target.value)}
                  placeholder="0"
                  className={errors.taPerKmRate ? "border-destructive" : ""}
                />
                {errors.taPerKmRate && (
                  <p
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    data-ocid="tada_policy.field_error"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {errors.taPerKmRate}
                  </p>
                )}
              </div>

              {/* Lodging Entitlement */}
              <div>
                <Label
                  htmlFor="lodgingEntitlement"
                  className="text-sm font-display font-medium text-foreground mb-1.5 block"
                >
                  Lodging Entitlement per Night (₹)
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="lodgingEntitlement"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.lodgingEntitlement}
                  onChange={(e) =>
                    handleChange("lodgingEntitlement", e.target.value)
                  }
                  placeholder="0"
                  className={
                    errors.lodgingEntitlement ? "border-destructive" : ""
                  }
                />
                {errors.lodgingEntitlement && (
                  <p
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    data-ocid="tada_policy.field_error"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {errors.lodgingEntitlement}
                  </p>
                )}
              </div>

              {/* Meal Allowance (optional) */}
              <div>
                <Label
                  htmlFor="mealAllowance"
                  className="text-sm font-display font-medium text-foreground mb-1.5 block"
                >
                  Meal Allowance (₹)
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Optional
                  </Badge>
                </Label>
                <Input
                  id="mealAllowance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.mealAllowance}
                  onChange={(e) =>
                    handleChange("mealAllowance", e.target.value)
                  }
                  placeholder="0"
                  className={errors.mealAllowance ? "border-destructive" : ""}
                />
                {errors.mealAllowance && (
                  <p
                    className="text-xs text-destructive mt-1 flex items-center gap-1"
                    data-ocid="tada_policy.field_error"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {errors.mealAllowance}
                  </p>
                )}
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-muted/20">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                data-ocid="tada_policy.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                data-ocid="tada_policy.submit_button"
                className="gap-2 min-w-[100px]"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : null}
                {editingName ? "Update Grade" : "Save Grade"}
              </Button>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
