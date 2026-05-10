import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  Edit2,
  FileText,
  Mail,
  PlusCircle,
  Printer,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend";
import { LetterStatus, LetterType } from "../../backend.d";
import type {
  CompanyProfile,
  MutationResult,
  OfficialLetterView,
  UserInfo,
} from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";
import { downloadOfficialLetterPdf } from "../../utils/officialLetterPdf";

// ── Types ────────────────────────────────────────────────────────────────────

interface LetterFormState {
  recipientName: string;
  subject: string;
  body: string;
  date: string;
}

// Extended letter type — OfficialLetterView already includes emailLogs and letterRefNumber.
// Additional UI-only fields added for display purposes.
type OfficialLetterExtended = OfficialLetterView & {
  letterType?: string;
  recipientDesignation?: string;
  recipientHQ?: string;
};

const TODAY = new Date().toISOString().split("T")[0];
const COMPANY_EMAIL = "krishkarpharma@gmail.com";

function emptyForm(): LetterFormState {
  return { recipientName: "", subject: "", body: "", date: TODAY };
}

// ── Letter type inference ─────────────────────────────────────────────────────

function inferLetterTypeEnum(subject: string): LetterType {
  const s = subject.toLowerCase();
  if (s.includes("appointment")) return LetterType.appointmentLetter;
  if (s.includes("leave") && s.includes("approv"))
    return LetterType.confirmationLetter;
  if (s.includes("warning")) return LetterType.warningLetter;
  if (s.includes("experience") || s.includes("reliev"))
    return LetterType.experienceLetter;
  if (s.includes("show cause")) return LetterType.showCauseNotice;
  if (s.includes("terminat")) return LetterType.terminationLetter;
  if (s.includes("promot")) return LetterType.promotionLetter;
  if (s.includes("transfer")) return LetterType.transferLetter;
  if (s.includes("increment") || s.includes("salary"))
    return LetterType.incrementLetter;
  return LetterType.appointmentLetter;
}

function inferLetterType(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("appointment")) return "Appointment";
  if (s.includes("leave") && s.includes("approv")) return "Leave Approval";
  if (s.includes("leave") && s.includes("reject")) return "Leave Rejection";
  if (s.includes("warning")) return "Warning";
  if (s.includes("experience")) return "Experience";
  if (s.includes("show cause")) return "Show Cause";
  return "Official Letter";
}

// ── Email subject/body builders ───────────────────────────────────────────────

function buildOfficialLetterEmailSubject(
  letter: OfficialLetterExtended,
): string {
  const recipientName = letter.recipientName;
  const date = formatDate(letter.date);
  const letterType = letter.letterType ?? inferLetterType(letter.subject);
  const refNo = letter.letterRefNumber;
  const refSuffix = refNo ? ` - Ref No: ${refNo}` : "";

  const lt = letterType.toLowerCase();
  if (lt.includes("appointment"))
    return `Appointment Letter - ${recipientName}${refSuffix} - ${date}`;
  if (lt.includes("leave") && lt.includes("approv"))
    return `Leave Approval - ${recipientName}${refSuffix} - ${date}`;
  if (lt.includes("leave") && lt.includes("reject"))
    return `Leave Rejection - ${recipientName}${refSuffix} - ${date}`;
  if (lt.includes("warning"))
    return `Warning Letter - ${recipientName}${refSuffix} - ${date}`;
  if (lt.includes("experience"))
    return `Experience Letter - ${recipientName}${refSuffix} - ${date}`;
  if (lt.includes("show cause"))
    return `Show Cause Notice - ${recipientName}${refSuffix} - ${date}`;
  return `Official Letter - ${letterType} - ${recipientName}${refSuffix} - ${date}`;
}

function buildOfficialLetterEmailBody(
  letter: OfficialLetterExtended,
  senderName: string,
  senderDesignation: string,
  companyName: string,
): string {
  const letterType = letter.letterType ?? inferLetterType(letter.subject);
  return `Dear ${letter.recipientName},\n\nPlease find your ${letterType} attached to this email for your reference. The letter has been generated in PDF format with the company letterhead. For any queries, please contact HR.\n\nRegards,\n${senderName}\n${senderDesignation}\n${companyName}`;
}

// ── Print utility ────────────────────────────────────────────────────────────

function buildLetterheadHtml(
  form: LetterFormState,
  company: CompanyProfile | null,
): string {
  const logoHtml = company?.logoUrl
    ? `<img src="${company.logoUrl}" alt="Company Logo" style="height:80px;object-fit:contain;margin-bottom:8px;" />`
    : "";
  const name = company?.companyName ?? "Krishkar Pharmaceuticals";
  const address = company?.address ?? "";
  const contact = company?.contactNumber ?? "";

  const bodyHtml = form.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  const contactLine = [contact ? `Tel: ${contact}` : ""]
    .filter(Boolean)
    .join(" | ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Official Letter - ${form.subject}</title>
  <style>
    @page { size: A4; margin: 0.5cm 2cm 0cm 2cm; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 0; padding-bottom: 48px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .branded-footer { position: fixed; bottom: 0; left: 0; right: 0; background: #00BCD4; color: #ffffff; font-weight: bold; font-size: 12px; text-align: center; padding: 9px 16px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    @media print { .branded-footer { background: #00BCD4 !important; color: #ffffff !important; } }
    .header { border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 14px; }
    .company-name { font-size: 20px; font-weight: bold; margin: 4px 0; }
    .company-meta { font-size: 11px; color: #555; margin: 2px 0; }
    .letter-meta { margin-bottom: 20px; }
    .date-line { text-align: right; font-size: 13px; margin-bottom: 14px; }
    .to-line { margin-bottom: 4px; font-size: 13px; }
    .subject-line { font-weight: bold; font-size: 13px; margin-bottom: 16px; }
    .body-section { line-height: 1.7; font-size: 13px; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="branded-footer">Krishkar Pharmaceuticals : Empowering Health</div>
  <div class="header">
    ${logoHtml ? `<div style="flex-shrink:0;">${logoHtml}</div>` : ""}
    <div>
      <div class="company-name">${name}</div>
      ${address ? `<div class="company-meta">${address}</div>` : ""}
      ${contactLine ? `<div class="company-meta">${contactLine}</div>` : ""}
    </div>
  </div>
  <div class="letter-meta">
    <div class="date-line">Date: ${form.date}</div>
    <div class="to-line">To: <strong>${form.recipientName || "—"}</strong></div>
    <div class="subject-line">Subject: ${form.subject || "—"}</div>
  </div>
  <div class="body-section">${bodyHtml}</div>
</body>
</html>`;
}

function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    toast.error("Popup blocked — please allow popups for this site.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  portalRole: Role;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OfficialLetters({ portalRole }: Props) {
  const { session } = useAuthStore();
  const [letters, setLetters] = useState<OfficialLetterExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<LetterFormState>(emptyForm);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<bigint | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [emailingId, setEmailingId] = useState<bigint | null>(null);
  const [downloadingId, setDownloadingId] = useState<bigint | null>(null);
  const [recipientMissingEmail, setRecipientMissingEmail] = useState<
    bigint | null
  >(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Check if we're in HR or Admin portal
  const isHrOrAdmin =
    String(portalRole) === "HRManager" || String(portalRole) === "Admin";

  const fetchLetters = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = isHrOrAdmin
        ? await api.listAllOfficialLetters(session.token)
        : await api.getMyOfficialLetters(session.token);
      setLetters(
        (data as OfficialLetterExtended[]).sort(
          (a, b) => Number(b.createdAt) - Number(a.createdAt),
        ),
      );
    } catch {
      toast.error("Failed to load letters");
    }
  }, [session?.token, isHrOrAdmin]);

  useEffect(() => {
    if (!session?.token) return;
    setLoading(true);
    Promise.all([
      fetchLetters(),
      api.getCompanyProfile(session.token).then((p) => setCompany(p)),
    ]).finally(() => setLoading(false));
  }, [session?.token, fetchLetters]);

  const handleEdit = (letter: OfficialLetterExtended) => {
    setEditingId(letter.id);
    setForm({
      recipientName: letter.recipientName,
      subject: letter.subject,
      body: letter.body,
      date: letter.date,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const validate = () => {
    if (!form.recipientName.trim()) {
      toast.error("Recipient name is required");
      return false;
    }
    if (!form.date) {
      toast.error("Date is required");
      return false;
    }
    if (!form.subject.trim()) {
      toast.error("Subject is required");
      return false;
    }
    if (!form.body.trim()) {
      toast.error("Letter body is required");
      return false;
    }
    return true;
  };

  const save = async (status: LetterStatus) => {
    if (!validate() || !session?.token) return;
    setSaving(true);
    try {
      let res: MutationResult;
      if (editingId !== null) {
        if (status === LetterStatus.final_) {
          const updateRes = await api.updateOfficialLetter(
            session.token,
            editingId,
            {
              recipientName: form.recipientName,
              subject: form.subject,
              body: form.body,
              date: form.date,
              status: LetterStatus.draft,
            },
          );
          if (updateRes.__kind__ !== "ok") {
            toast.error(updateRes.err || "Save failed");
            return;
          }
          res = await api.finalizeOfficialLetter(session.token, editingId);
        } else {
          res = await api.updateOfficialLetter(session.token, editingId, {
            recipientName: form.recipientName,
            subject: form.subject,
            body: form.body,
            date: form.date,
            status,
          });
        }
      } else {
        const createRes = await api.createOfficialLetter(session.token, {
          recipientName: form.recipientName,
          subject: form.subject,
          body: form.body,
          date: form.date,
          status: LetterStatus.draft,
          letterType: inferLetterTypeEnum(form.subject),
        });
        if (createRes.__kind__ !== "ok") {
          toast.error(createRes.err || "Save failed");
          return;
        }
        if (status === LetterStatus.final_) {
          await fetchLetters();
          const updated = await api.getMyOfficialLetters(session.token);
          const newest = updated.sort(
            (a, b) => Number(b.createdAt) - Number(a.createdAt),
          )[0];
          if (newest) {
            res = await api.finalizeOfficialLetter(session.token, newest.id);
          } else {
            res = createRes;
          }
        } else {
          res = createRes;
        }
      }
      if (res.__kind__ === "ok") {
        toast.success(
          status === LetterStatus.draft
            ? "Saved as draft"
            : "Saved as final letter",
        );
        setForm(emptyForm());
        setEditingId(null);
        await fetchLetters();
      } else {
        toast.error(res.err || "Save failed");
      }
    } catch {
      toast.error("Failed to save letter");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: bigint) => {
    if (!session?.token) return;
    setDeletingId(id);
    try {
      const res = await api.deleteOfficialLetter(session.token, id);
      if (res.__kind__ === "ok") {
        toast.success("Letter deleted");
        setLetters((prev) => prev.filter((l) => l.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setForm(emptyForm());
        }
      } else {
        toast.error(res.err || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete letter");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handlePrint = (letter: OfficialLetterExtended) => {
    const html = buildLetterheadHtml(
      {
        recipientName: letter.recipientName,
        subject: letter.subject,
        body: letter.body,
        date: letter.date,
      },
      company,
    );
    openPrintWindow(html);
  };

  const handlePreview = () => {
    const html = buildLetterheadHtml(form, company);
    openPrintWindow(html);
  };

  // ── Download PDF ─────────────────────────────────────────────────────────────

  const handleDownloadPdf = async (letter: OfficialLetterExtended) => {
    if (!session?.token) return;
    setDownloadingId(letter.id);
    try {
      const letterType = letter.letterType ?? inferLetterType(letter.subject);
      await downloadOfficialLetterPdf({
        companyProfile: {
          logoUrl: company?.logoUrl ?? "",
          companyName: company?.companyName ?? "Krishkar Pharmaceuticals",
          address: company?.address ?? "",
          contactNumber: company?.contactNumber ?? "",
          emailId: company?.emailId ?? "",
          website: company?.website ?? "",
        },
        letter: {
          recipientName: letter.recipientName,
          recipientDesignation: letter.recipientDesignation ?? "",
          recipientHQ: letter.recipientHQ,
          subject: letter.subject,
          body: letter.body,
          date: formatDate(letter.date) || letter.date,
          letterType,
          letterRefNumber: letter.letterRefNumber,
        },
        generatedBy: {
          name: session.name,
          designation:
            (session as AuthSession & { designation?: string }).designation ??
            String(portalRole),
          role: String(portalRole),
        },
        generatedAt: formatDateTime(new Date()),
      });
    } catch {
      toast.error("PDF generation failed. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Send via Email ────────────────────────────────────────────────────────────

  const handleSendViaEmail = async (letter: OfficialLetterExtended) => {
    if (!session?.token) return;
    setEmailingId(letter.id);
    setRecipientMissingEmail(null);

    try {
      // 1. Try to resolve recipient email from employee list
      let recipientEmail: string | null = null;
      let allUsers: UserInfo[] = [];

      try {
        allUsers = await api.listAllUsers(session.token);
        const match = allUsers.find(
          (u) =>
            u.name.toLowerCase().trim() ===
            letter.recipientName.toLowerCase().trim(),
        );
        recipientEmail = match?.email?.trim() || null;
      } catch {
        // Silently ignore — fall back to company email
      }

      if (!recipientEmail) {
        setRecipientMissingEmail(letter.id);
      }

      const toEmail = recipientEmail ?? COMPANY_EMAIL;

      // 2. Build CC list
      const ccEmails: string[] = [COMPANY_EMAIL];

      if (recipientEmail) {
        // Add recipient's reporting manager
        try {
          const recipientUser = allUsers.find(
            (u) => u.email?.trim() === recipientEmail,
          );
          if (recipientUser?.reportsTo) {
            const manager = await api.getUser(
              session.token,
              recipientUser.reportsTo,
            );
            if (manager?.email?.trim()) {
              ccEmails.push(manager.email.trim());
            }
          }
        } catch {
          // Silently ignore
        }
      }

      // Add HR email if sender is not HR
      if (String(portalRole) !== "HRManager") {
        try {
          const hrUsers = await api.listUsersByRole(
            session.token,
            "HRManager" as Role,
          );
          const hrEmail = hrUsers[0]?.email?.trim();
          if (hrEmail && !ccEmails.includes(hrEmail)) {
            ccEmails.push(hrEmail);
          }
        } catch {
          // Silently ignore
        }
      }

      // For non-HR/Admin portals (self-service): use own email in To, CC company + HR
      const isSelfService = !isHrOrAdmin;
      const finalTo = isSelfService
        ? ((session as AuthSession & { email?: string }).email ?? COMPANY_EMAIL)
        : toEmail;
      const finalCc = isSelfService
        ? [COMPANY_EMAIL, ...ccEmails.filter((e) => e !== COMPANY_EMAIL)]
        : ccEmails.filter((e) => e !== finalTo);

      // 3. Build subject & body
      const subject = buildOfficialLetterEmailSubject(letter);
      const body = buildOfficialLetterEmailBody(
        letter,
        session.name,
        (session as AuthSession & { designation?: string }).designation ??
          String(portalRole),
        company?.companyName ?? "Krishkar Pharmaceuticals",
      );

      // 4. Download PDF first so user can attach it
      await handleDownloadPdf(letter);

      // 5. Build & open mailto
      const ccParam = finalCc.filter(Boolean).join(",");
      const mailto = `mailto:${encodeURIComponent(finalTo)}?${ccParam ? `cc=${encodeURIComponent(ccParam)}&` : ""}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.location.href = mailto;

      // 6. Show instructional toast
      toast.info(
        "Your email app has opened with all recipients and subject pre-filled. Please attach the downloaded PDF of this letter before sending.",
        { duration: 8000 },
      );

      // 7. Log email initiation (best-effort, backend may not have this method yet)
      try {
        const backendActor = api as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >;
        if (typeof backendActor.addOfficialLetterEmailLog === "function") {
          await backendActor.addOfficialLetterEmailLog(
            session.token,
            letter.id,
            {
              letterRef: letter.letterRefNumber ?? "",
              initiatedAt: Date.now(),
              initiatedBy: session.name,
              initiatedByRole: String(portalRole),
              action: "Email initiated. PDF generated and download triggered.",
            },
          );
        }
      } catch {
        // Silently ignore — logging is best-effort
      }
    } catch {
      toast.error("Failed to open email. Please try again.");
    } finally {
      setEmailingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Official Letters"
        subtitle="Create, manage, print, and send official company letters on company letterhead"
      />
      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel — Letter List */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">
                {isHrOrAdmin ? "All Letters" : "Your Letters"}
              </h2>
              {isHrOrAdmin && (
                <Button
                  size="sm"
                  onClick={handleNew}
                  className="gap-1.5"
                  data-ocid="new-letter-btn"
                >
                  <PlusCircle className="w-4 h-4" />
                  New Letter
                </Button>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {loading ? (
                <div className="divide-y divide-border">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="px-4 py-4 flex gap-3 animate-pulse">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : letters.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-16 text-center px-4"
                  data-ocid="letters-empty-state"
                >
                  <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-display font-medium text-foreground">
                    No letters yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isHrOrAdmin
                      ? 'Click "New Letter" to create your first official letter.'
                      : "No official letters have been issued for you yet."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {letters.map((letter) => (
                    <LetterRow
                      key={String(letter.id)}
                      letter={letter}
                      editingId={editingId}
                      confirmDeleteId={confirmDeleteId}
                      deletingId={deletingId}
                      downloadingId={downloadingId}
                      emailingId={emailingId}
                      recipientMissingEmail={recipientMissingEmail}
                      isHrOrAdmin={isHrOrAdmin}
                      onEdit={handleEdit}
                      onPrint={handlePrint}
                      onDownloadPdf={handleDownloadPdf}
                      onSendViaEmail={handleSendViaEmail}
                      onConfirmDelete={setConfirmDeleteId}
                      onDelete={handleDelete}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel — Letter Form (HR/Admin only) or Info panel */}
          <div ref={formRef} className="flex flex-col gap-4">
            {isHrOrAdmin ? (
              <>
                <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">
                  {editingId !== null ? "Edit Letter" : "Compose Letter"}
                </h2>

                <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
                  {/* Company Branding Preview */}
                  {company && (
                    <div className="bg-muted/30 border border-border rounded-md px-4 py-3 flex items-center gap-3">
                      {company.logoUrl && (
                        <img
                          src={company.logoUrl}
                          alt="Logo"
                          className="h-10 w-auto object-contain shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-display font-bold text-foreground truncate">
                          {company.companyName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {company.address}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="recipient-name"
                        className="text-xs font-display"
                      >
                        Recipient Name{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="recipient-name"
                        placeholder="Dr. Rajesh Kumar"
                        value={form.recipientName}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            recipientName: e.target.value,
                          }))
                        }
                        data-ocid="letter-recipient-input"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="letter-date"
                        className="text-xs font-display"
                      >
                        Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="letter-date"
                        type="date"
                        value={form.date}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, date: e.target.value }))
                        }
                        data-ocid="letter-date-input"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="letter-subject"
                      className="text-xs font-display"
                    >
                      Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="letter-subject"
                      placeholder="Appointment Confirmation"
                      value={form.subject}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, subject: e.target.value }))
                      }
                      data-ocid="letter-subject-input"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="letter-body"
                      className="text-xs font-display"
                    >
                      Letter Body <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="letter-body"
                      placeholder="Dear Sir/Madam,&#10;&#10;With reference to the above subject..."
                      value={form.body}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, body: e.target.value }))
                      }
                      rows={12}
                      className="font-body text-sm leading-relaxed resize-y"
                      data-ocid="letter-body-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Line breaks are preserved in the printed letter.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreview}
                      disabled={!form.subject && !form.body}
                      className="gap-1.5"
                      data-ocid="preview-letter-btn"
                      title="Preview and print the letter with company letterhead"
                    >
                      <Printer className="w-4 h-4" />
                      Preview / Print
                    </Button>

                    <div className="flex-1" />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => save(LetterStatus.draft)}
                      disabled={saving}
                      className="gap-1.5"
                      data-ocid="save-draft-btn"
                    >
                      {saving ? "Saving…" : "Save as Draft"}
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => save(LetterStatus.final_)}
                      disabled={saving}
                      className="gap-1.5"
                      data-ocid="save-final-btn"
                    >
                      {saving ? "Saving…" : "Save as Final"}
                    </Button>
                  </div>

                  {editingId !== null && (
                    <button
                      type="button"
                      onClick={handleNew}
                      className="text-xs text-muted-foreground hover:text-foreground underline text-left"
                    >
                      Cancel editing — start new letter instead
                    </button>
                  )}
                </div>

                {/* Print / PDF tip */}
                <div className="bg-muted/30 border border-border rounded-md px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">
                      💡 Send via Email:
                    </strong>{" "}
                    Use the <Mail className="w-3 h-3 inline" /> button on any
                    letter to open your email app with all recipients
                    pre-filled. The PDF will download automatically — attach it
                    before sending.
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-display font-semibold text-foreground">
                    Your Official Letters
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Official letters issued to you by HR or Admin appear in the
                  list. You can print, download as PDF, or send yourself a copy
                  via email using the action buttons on each letter.
                </p>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}

// ── AuthSession type augmentation for optional fields ─────────────────────────
type AuthSession = import("../../store/authStore").AuthSession & {
  email?: string;
  designation?: string;
};

// ── Letter Row Component ───────────────────────────────────────────────────────

interface LetterRowProps {
  letter: OfficialLetterExtended;
  editingId: bigint | null;
  confirmDeleteId: bigint | null;
  deletingId: bigint | null;
  downloadingId: bigint | null;
  emailingId: bigint | null;
  recipientMissingEmail: bigint | null;
  isHrOrAdmin: boolean;
  onEdit: (l: OfficialLetterExtended) => void;
  onPrint: (l: OfficialLetterExtended) => void;
  onDownloadPdf: (l: OfficialLetterExtended) => void;
  onSendViaEmail: (l: OfficialLetterExtended) => void;
  onConfirmDelete: (id: bigint) => void;
  onDelete: (id: bigint) => void;
  onCancelDelete: () => void;
}

function LetterRow({
  letter,
  editingId,
  confirmDeleteId,
  deletingId,
  downloadingId,
  emailingId,
  recipientMissingEmail,
  isHrOrAdmin,
  onEdit,
  onPrint,
  onDownloadPdf,
  onSendViaEmail,
  onConfirmDelete,
  onDelete,
  onCancelDelete,
}: LetterRowProps) {
  const isConfirmingDelete = confirmDeleteId === letter.id;
  const isDeleting = deletingId === letter.id;
  const isDownloading = downloadingId === letter.id;
  const isEmailing = emailingId === letter.id;
  const isMissingEmail = recipientMissingEmail === letter.id;

  return (
    <div
      data-ocid={`letter-row-${String(letter.id)}`}
      className={`px-4 py-3 flex flex-col gap-2 hover:bg-muted/20 transition-colors ${editingId === letter.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-body font-medium text-foreground truncate">
              {letter.subject}
            </span>
            <Badge
              variant={
                letter.status === LetterStatus.final_ ? "default" : "secondary"
              }
              className="text-xs shrink-0"
            >
              {letter.status === LetterStatus.final_ ? "Final" : "Draft"}
            </Badge>
            {letter.letterRefNumber && (
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {letter.letterRefNumber}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            To: {letter.recipientName} &bull; {formatDate(letter.date)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {isHrOrAdmin && (
            <button
              type="button"
              aria-label="Edit letter"
              data-ocid={`edit-letter-${String(letter.id)}`}
              onClick={() => onEdit(letter)}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Edit letter"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Print */}
          <button
            type="button"
            aria-label="Print letter"
            data-ocid={`print-letter-${String(letter.id)}`}
            onClick={() => onPrint(letter)}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
            title="Print letter with company letterhead"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Download PDF */}
          <button
            type="button"
            aria-label="Download PDF"
            data-ocid={`download-pdf-${String(letter.id)}`}
            onClick={() => onDownloadPdf(letter)}
            disabled={isDownloading}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary disabled:opacity-50"
            title="Download this official letter as a PDF with company letterhead"
          >
            {isDownloading ? (
              <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Send via Email */}
          <button
            type="button"
            aria-label="Send via Email"
            data-ocid={`send-email-${String(letter.id)}`}
            onClick={() => onSendViaEmail(letter)}
            disabled={isEmailing}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary disabled:opacity-50"
            title="Tap to send this official letter as a PDF to the recipient. Your email app will open with all recipients and subject pre-filled. Please attach the PDF before sending."
          >
            {isEmailing ? (
              <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Delete (HR/Admin only) */}
          {isHrOrAdmin &&
            (isConfirmingDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-ocid={`confirm-delete-letter-${String(letter.id)}`}
                  onClick={() => onDelete(letter.id)}
                  disabled={isDeleting}
                  className="text-xs px-2 py-1 rounded bg-destructive text-white hover:bg-destructive/90 transition-colors"
                >
                  {isDeleting ? "…" : "Confirm"}
                </button>
                <button
                  type="button"
                  data-ocid={`cancel-delete-letter-${String(letter.id)}`}
                  onClick={onCancelDelete}
                  className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Delete letter"
                data-ocid={`delete-letter-${String(letter.id)}`}
                onClick={() => onConfirmDelete(letter.id)}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                title="Delete letter"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ))}
        </div>
      </div>

      {/* Missing email warning */}
      {isMissingEmail && (
        <p
          className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1"
          data-ocid={`recipient-email-missing-${String(letter.id)}`}
        >
          Recipient email not found in profile. The letter will be sent to the
          company email. Please update the employee&apos;s email address in
          their profile.
        </p>
      )}

      {/* Email History (HR/Admin only) */}
      {isHrOrAdmin && letter.emailLogs && letter.emailLogs.length > 0 && (
        <div className="mt-1 pt-2 border-t border-border/50">
          <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Email History
          </p>
          <div className="flex flex-col gap-0.5">
            {letter.emailLogs.map((log) => (
              <p
                key={`${log.initiatedBy}-${String(log.initiatedAt)}`}
                className="text-xs text-muted-foreground"
                data-ocid={`email-log-${String(letter.id)}-${String(log.initiatedAt)}`}
              >
                {log.initiatedBy} &bull; {log.initiatedByRole} &bull;{" "}
                {formatDateTime(
                  typeof log.initiatedAt === "bigint"
                    ? log.initiatedAt
                    : Number(log.initiatedAt),
                )}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
