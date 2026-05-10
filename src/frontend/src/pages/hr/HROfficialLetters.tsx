import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Award,
  Briefcase,
  Download,
  FileText,
  Mail,
  Printer,
  RefreshCw,
  Trash2,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
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
import type { AuthSession } from "../../store/authStore";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";
import { downloadOfficialLetterPdf } from "../../utils/officialLetterPdf";

// ── Types ────────────────────────────────────────────────────────────────────

type OfficialLetterExtended = OfficialLetterView & {
  letterType?: string;
  recipientDesignation?: string;
  recipientHQ?: string;
};

type LetterKind =
  | "appointment"
  | "confirmation"
  | "custom"
  | "experience"
  | "increment"
  | "promotion"
  | "showCause"
  | "termination"
  | "transfer"
  | "warning";

const TODAY = new Date().toISOString().split("T")[0];
const COMPANY_EMAIL = "krishkarpharma@gmail.com";

// ── Letter kind metadata ────────────────────────────────────────────────────

const LETTER_KINDS: {
  kind: LetterKind;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  {
    kind: "appointment",
    label: "Appointment Letter",
    icon: Briefcase,
    desc: "New employee appointment letter",
  },
  {
    kind: "confirmation",
    label: "Confirmation Letter",
    icon: UserCheck,
    desc: "Confirm employment after probation period",
  },
  {
    kind: "transfer",
    label: "Transfer Letter",
    icon: RefreshCw,
    desc: "Transfer to a new posting / location",
  },
  {
    kind: "promotion",
    label: "Promotion Letter",
    icon: TrendingUp,
    desc: "Announce promotion to a new designation",
  },
  {
    kind: "increment",
    label: "Increment Letter",
    icon: Award,
    desc: "Salary increment notification with details",
  },
  {
    kind: "warning",
    label: "Warning Letter",
    icon: UserMinus,
    desc: "Formal warning with reason and consequences",
  },
  {
    kind: "termination",
    label: "Termination Letter",
    icon: UserPlus,
    desc: "Termination / separation notice with key dates",
  },
  {
    kind: "experience",
    label: "Experience Letter",
    icon: FileText,
    desc: "Employee experience / service letter",
  },
  {
    kind: "showCause",
    label: "Show Cause Notice",
    icon: AlertTriangle,
    desc: "Show cause notice for disciplinary matters",
  },
  {
    kind: "custom",
    label: "Custom Letter",
    icon: FileText,
    desc: "Free-form official letter with any subject",
  },
];

// ── INR formatter ─────────────────────────────────────────────────────────────

function formatINR(val: string): string {
  const num = Number.parseFloat(val.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(num)) return val;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function calcIncrement(current: string, revised: string): string {
  const c = Number.parseFloat(current.replace(/[^0-9.]/g, ""));
  const r = Number.parseFloat(revised.replace(/[^0-9.]/g, ""));
  if (!Number.isNaN(c) && !Number.isNaN(r) && r > c)
    return formatINR(String(r - c));
  return "";
}

// ── Letter body generators ────────────────────────────────────────────────────

function buildConfirmationBody(fields: ConfirmationFields): string {
  const lines = [
    `Dear ${fields.recipientName},`,
    "",
    `We are pleased to inform you that upon satisfactory completion of your probation period, which ended on ${formatDate(fields.probationEndDate) || fields.probationEndDate}, your employment with the company has been confirmed effective ${formatDate(fields.confirmationDate) || fields.confirmationDate}.`,
    "",
    `${fields.revisedDesignation ? `Your designation is updated to ${fields.revisedDesignation}.` : ""}`.trim(),
    `${fields.revisedSalary ? `Your revised gross salary will be ${formatINR(fields.revisedSalary)} per month with effect from the confirmation date.` : ""}`.trim(),
    "",
    "You are requested to continue performing your duties with the same sincerity, dedication, and commitment. We look forward to your continued contribution to the growth of the organisation.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ]
    .filter((l, i, arr) => !(l === "" && arr[i + 1] === ""))
    .filter((l) => l !== "".trim() || l === "")
    .join("\n");
  return lines;
}

function buildTransferBody(fields: TransferFields): string {
  return [
    `Dear ${fields.recipientName},`,
    "",
    `This is to inform you that you have been transferred from ${fields.currentPosting} to ${fields.newPosting}. Your new HQ will be ${fields.newHQ}.`,
    "",
    `The transfer is effective from ${formatDate(fields.effectiveDate) || fields.effectiveDate}. You are requested to report to your new posting on or before the effective date.`,
    "",
    "Please complete all necessary handover formalities and hand over charge of your current posting in an orderly manner before your departure.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ].join("\n");
}

function buildPromotionBody(fields: PromotionFields): string {
  return [
    `Dear ${fields.recipientName},`,
    "",
    `We are pleased to inform you that in recognition of your dedicated service and outstanding performance, you are hereby promoted from ${fields.currentDesignation} to ${fields.newDesignation} effective ${formatDate(fields.effectiveDate) || fields.effectiveDate}.`,
    "",
    `${fields.newGrade ? `Your new grade will be ${fields.newGrade}.` : ""}`.trim(),
    `${fields.promotedSalary ? `Your revised gross salary will be ${formatINR(fields.promotedSalary)} per month with effect from the above date.` : ""}`.trim(),
    "",
    "We congratulate you on this achievement and look forward to your continued contribution to the success of the organisation.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ]
    .filter((l, i, arr) => !(l === "" && arr[i + 1] === ""))
    .join("\n");
}

function buildIncrementBody(fields: IncrementFields): string {
  const incrementAmt = calcIncrement(fields.currentSalary, fields.newSalary);
  return [
    `Dear ${fields.recipientName},`,
    "",
    `We are pleased to inform you that your gross salary has been revised as follows with effect from ${formatDate(fields.effectiveDate) || fields.effectiveDate}:`,
    "",
    `  Current Salary : ${formatINR(fields.currentSalary)}`,
    `  Revised Salary : ${formatINR(fields.newSalary)}`,
    `  Increment Amount : ${incrementAmt || formatINR(fields.incrementAmount)}`,
    "",
    "This increment is in appreciation of your dedication and contribution to the organisation. We trust that you will continue to maintain the same level of performance.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ].join("\n");
}

function buildWarningBody(fields: WarningFields): string {
  return [
    `Dear ${fields.recipientName},`,
    "",
    "This is a formal warning letter issued to you regarding the following:",
    "",
    "Reason for Warning:",
    fields.warningReason,
    "",
    "Disciplinary Action / Consequences:",
    fields.disciplinaryAction,
    "",
    "You are advised to correct your behaviour / conduct immediately. Please note that any further repetition of the above may lead to strict disciplinary action including termination of employment.",
    "",
    "You are requested to acknowledge receipt of this letter.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ].join("\n");
}

function buildTerminationBody(fields: TerminationFields): string {
  return [
    `Dear ${fields.recipientName},`,
    "",
    `This is to inform you that your employment with the company has been terminated / your services are being separated effective ${formatDate(fields.terminationDate) || fields.terminationDate}.`,
    "",
    `Your last working day with the company will be ${formatDate(fields.lastWorkingDay) || fields.lastWorkingDay}.`,
    "",
    `${fields.finalSettlementRef ? `Your final settlement reference is: ${fields.finalSettlementRef}.` : "Your full and final settlement will be processed in due course as per company policy."}`,
    "",
    "Please ensure that all company property, documents, and access credentials are returned on or before your last working day.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ].join("\n");
}

// ── Field types ───────────────────────────────────────────────────────────────

interface ConfirmationFields {
  recipientName: string;
  date: string;
  probationEndDate: string;
  confirmationDate: string;
  revisedDesignation: string;
  revisedSalary: string;
}
interface TransferFields {
  recipientName: string;
  date: string;
  currentPosting: string;
  newPosting: string;
  newHQ: string;
  effectiveDate: string;
}
interface PromotionFields {
  recipientName: string;
  date: string;
  currentDesignation: string;
  newDesignation: string;
  newGrade: string;
  effectiveDate: string;
  promotedSalary: string;
}
interface IncrementFields {
  recipientName: string;
  date: string;
  currentSalary: string;
  newSalary: string;
  incrementAmount: string;
  effectiveDate: string;
}
interface WarningFields {
  recipientName: string;
  date: string;
  warningReason: string;
  disciplinaryAction: string;
}
interface TerminationFields {
  recipientName: string;
  date: string;
  terminationDate: string;
  lastWorkingDay: string;
  finalSettlementRef: string;
}
interface AppointmentFields {
  recipientName: string;
  date: string;
  designation: string;
  department: string;
  joiningDate: string;
  ctc: string;
}
interface ExperienceFields {
  recipientName: string;
  date: string;
  designation: string;
  joiningDate: string;
  lastWorkingDay: string;
  tenure: string;
}
interface ShowCauseFields {
  recipientName: string;
  date: string;
  reason: string;
  responseDeadline: string;
}
interface CustomFields {
  recipientName: string;
  date: string;
  subject: string;
  body: string;
}

function emptyConfirmation(): ConfirmationFields {
  return {
    recipientName: "",
    date: TODAY,
    probationEndDate: "",
    confirmationDate: "",
    revisedDesignation: "",
    revisedSalary: "",
  };
}
function emptyTransfer(): TransferFields {
  return {
    recipientName: "",
    date: TODAY,
    currentPosting: "",
    newPosting: "",
    newHQ: "",
    effectiveDate: "",
  };
}
function emptyPromotion(): PromotionFields {
  return {
    recipientName: "",
    date: TODAY,
    currentDesignation: "",
    newDesignation: "",
    newGrade: "",
    effectiveDate: "",
    promotedSalary: "",
  };
}
function emptyIncrement(): IncrementFields {
  return {
    recipientName: "",
    date: TODAY,
    currentSalary: "",
    newSalary: "",
    incrementAmount: "",
    effectiveDate: "",
  };
}
function emptyWarning(): WarningFields {
  return {
    recipientName: "",
    date: TODAY,
    warningReason: "",
    disciplinaryAction: "",
  };
}
function emptyTermination(): TerminationFields {
  return {
    recipientName: "",
    date: TODAY,
    terminationDate: "",
    lastWorkingDay: "",
    finalSettlementRef: "",
  };
}
function emptyAppointment(): AppointmentFields {
  return {
    recipientName: "",
    date: TODAY,
    designation: "",
    department: "",
    joiningDate: "",
    ctc: "",
  };
}
function emptyExperience(): ExperienceFields {
  return {
    recipientName: "",
    date: TODAY,
    designation: "",
    joiningDate: "",
    lastWorkingDay: "",
    tenure: "",
  };
}
function emptyShowCause(): ShowCauseFields {
  return {
    recipientName: "",
    date: TODAY,
    reason: "",
    responseDeadline: "",
  };
}
function emptyCustom(): CustomFields {
  return { recipientName: "", date: TODAY, subject: "", body: "" };
}

function buildAppointmentBody(fields: AppointmentFields): string {
  return [
    `Dear ${fields.recipientName},`,
    "",
    `We are pleased to offer you the position of ${fields.designation}${fields.department ? ` in the ${fields.department} Department` : ""} at Krishkar Pharmaceuticals.`,
    "",
    `Your date of joining will be ${formatDate(fields.joiningDate) || fields.joiningDate}. Please report to the HR department on your joining date with all required documents.`,
    "",
    `${fields.ctc ? `Your Cost to Company (CTC) will be ${formatINR(fields.ctc)} per annum, subject to deductions as per company policy.` : ""}`.trim(),
    "",
    "This appointment is subject to verification of your educational qualifications, prior employment records, and satisfactory performance during the probation period as per company norms.",
    "",
    "We welcome you to the Krishkar Pharmaceuticals family and look forward to your valuable contribution.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ]
    .filter((l, i, arr) => !(l === "" && arr[i + 1] === ""))
    .join("\n");
}

function buildExperienceBody(fields: ExperienceFields): string {
  return [
    "To Whomsoever It May Concern,",
    "",
    `This is to certify that ${fields.recipientName} was employed with Krishkar Pharmaceuticals as ${fields.designation || "an employee"}.`,
    "",
    `Period of Service: ${formatDate(fields.joiningDate) || fields.joiningDate} to ${formatDate(fields.lastWorkingDay) || fields.lastWorkingDay}${fields.tenure ? ` (${fields.tenure})` : ""}.`,
    "",
    "During the tenure of their service, their conduct and performance were found to be satisfactory. They are known to be sincere, hardworking, and dedicated.",
    "",
    "We wish them all the best in their future endeavours.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ].join("\n");
}

function buildShowCauseBody(fields: ShowCauseFields): string {
  return [
    `Dear ${fields.recipientName},`,
    "",
    "This Show Cause Notice is being issued to you in connection with the following:",
    "",
    "Reason / Charges:",
    fields.reason,
    "",
    `You are hereby directed to submit your written explanation / show cause reply on or before ${formatDate(fields.responseDeadline) || fields.responseDeadline || "[date to be specified]"}. Failure to respond within the stipulated time will result in ex-parte disciplinary action being taken against you.`,
    "",
    "Please note that this notice is without prejudice to any further action the management may decide to take in this matter.",
    "",
    "Thanking you,",
    "",
    "For Krishkar Pharmaceuticals",
  ].join("\n");
}

// ── Email helpers ─────────────────────────────────────────────────────────────

function inferLetterTypeEnum(subject: string): LetterType {
  const s = subject.toLowerCase();
  if (s.includes("appointment")) return LetterType.appointmentLetter;
  if (s.includes("warning")) return LetterType.warningLetter;
  if (s.includes("experience") || s.includes("reliev"))
    return LetterType.experienceLetter;
  if (s.includes("show cause")) return LetterType.showCauseNotice;
  if (s.includes("terminat")) return LetterType.terminationLetter;
  if (s.includes("promot")) return LetterType.promotionLetter;
  if (s.includes("transfer")) return LetterType.transferLetter;
  if (s.includes("increment") || s.includes("salary"))
    return LetterType.incrementLetter;
  if (s.includes("confirm")) return LetterType.confirmationLetter;
  return LetterType.appointmentLetter;
}

function inferLetterType(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("confirmation")) return "Confirmation Letter";
  if (s.includes("transfer")) return "Transfer Letter";
  if (s.includes("promotion")) return "Promotion Letter";
  if (s.includes("increment")) return "Increment Letter";
  if (s.includes("warning")) return "Warning Letter";
  if (s.includes("termination")) return "Termination Letter";
  if (s.includes("appointment")) return "Appointment Letter";
  if (s.includes("experience")) return "Experience Letter";
  if (s.includes("show cause")) return "Show Cause Notice";
  return "Official Letter";
}

function buildSubject(letter: OfficialLetterExtended): string {
  const name = letter.recipientName;
  const date = formatDate(letter.date);
  const ref = letter.letterRefNumber
    ? ` - Ref No: ${letter.letterRefNumber}`
    : "";
  const lt = letter.letterType ?? inferLetterType(letter.subject);
  return `${lt} - ${name}${ref} - ${date}`;
}

function buildEmailBody(
  letter: OfficialLetterExtended,
  senderName: string,
  senderDesig: string,
  companyName: string,
): string {
  const lt = letter.letterType ?? inferLetterType(letter.subject);
  return `Dear ${letter.recipientName},\n\nPlease find your ${lt} attached to this email for your reference. The letter has been generated in PDF format with the company letterhead. For any queries, please contact HR.\n\nRegards,\n${senderName}\n${senderDesig}\n${companyName}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HROfficialLetters() {
  const { session } = useAuthStore();
  const portalRole = Role.HRManager;

  const [tab, setTab] = useState<"list" | "compose">("list");
  const [selectedKind, setSelectedKind] = useState<LetterKind | null>(null);

  // letter list
  const [letters, setLetters] = useState<OfficialLetterExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [emailingId, setEmailingId] = useState<bigint | null>(null);
  const [downloadingId, setDownloadingId] = useState<bigint | null>(null);
  const [recipientMissingEmail, setRecipientMissingEmail] = useState<
    bigint | null
  >(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<bigint | null>(null);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);

  // structured forms
  const [appointmentForm, setAppointmentForm] = useState<AppointmentFields>(
    emptyAppointment(),
  );
  const [confirmationForm, setConfirmationForm] = useState<ConfirmationFields>(
    emptyConfirmation(),
  );
  const [transferForm, setTransferForm] = useState<TransferFields>(
    emptyTransfer(),
  );
  const [promotionForm, setPromotionForm] = useState<PromotionFields>(
    emptyPromotion(),
  );
  const [incrementForm, setIncrementForm] = useState<IncrementFields>(
    emptyIncrement(),
  );
  const [warningForm, setWarningForm] = useState<WarningFields>(emptyWarning());
  const [terminationForm, setTerminationForm] = useState<TerminationFields>(
    emptyTermination(),
  );
  const [experienceForm, setExperienceForm] = useState<ExperienceFields>(
    emptyExperience(),
  );
  const [showCauseForm, setShowCauseForm] = useState<ShowCauseFields>(
    emptyShowCause(),
  );
  const [customForm, setCustomForm] = useState<CustomFields>(emptyCustom());
  const [saving, setSaving] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const fetchLetters = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await api.listAllOfficialLetters(session.token);
      setLetters(
        (data as OfficialLetterExtended[]).sort(
          (a, b) => Number(b.createdAt) - Number(a.createdAt),
        ),
      );
    } catch {
      toast.error("Failed to load letters");
    }
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token) return;
    setLoading(true);
    Promise.all([
      fetchLetters(),
      api.getCompanyProfile(session.token).then((p) => setCompany(p)),
    ]).finally(() => setLoading(false));
  }, [session?.token, fetchLetters]);

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function saveStructuredLetter(opts: {
    kind: LetterKind;
    recipientName: string;
    date: string;
    subject: string;
    body: string;
    letterType: string;
  }) {
    if (!session?.token) return;
    setSaving(true);
    try {
      const createRes = await api.createOfficialLetter(session.token, {
        recipientName: opts.recipientName,
        subject: opts.subject,
        body: opts.body,
        date: opts.date,
        status: LetterStatus.draft,
        letterType: inferLetterTypeEnum(opts.subject),
      });
      if (createRes.__kind__ !== "ok") {
        toast.error(createRes.err || "Save failed");
        return;
      }
      // Finalize immediately
      await fetchLetters();
      const updated = await api.listAllOfficialLetters(session.token);
      const newest = (updated as OfficialLetterExtended[]).sort(
        (a, b) => Number(b.createdAt) - Number(a.createdAt),
      )[0];
      if (newest) {
        const res: MutationResult = await api.finalizeOfficialLetter(
          session.token,
          newest.id,
        );
        if (res.__kind__ === "ok") {
          toast.success("Letter saved as Final");
          setTab("list");
          setSelectedKind(null);
          await fetchLetters();
        } else {
          toast.error(res.err || "Finalize failed");
        }
      }
    } catch {
      toast.error("Failed to save letter");
    } finally {
      setSaving(false);
    }
  }

  // ── Submit handlers per kind ───────────────────────────────────────────────

  const handleAppointmentSave = async () => {
    const f = appointmentForm;
    if (!f.recipientName.trim() || !f.designation.trim() || !f.joiningDate) {
      toast.error("Employee Name, Designation, and Joining Date are required");
      return;
    }
    await saveStructuredLetter({
      kind: "appointment",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Appointment Letter - ${f.recipientName} - ${f.designation}`,
      body: buildAppointmentBody(f),
      letterType: "Appointment Letter",
    });
    setAppointmentForm(emptyAppointment());
  };

  const handleConfirmationSave = async () => {
    const f = confirmationForm;
    if (!f.recipientName.trim() || !f.probationEndDate || !f.confirmationDate) {
      toast.error(
        "Recipient Name, Probation End Date, and Confirmation Date are required",
      );
      return;
    }
    await saveStructuredLetter({
      kind: "confirmation",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Confirmation of Employment - ${f.recipientName}`,
      body: buildConfirmationBody(f),
      letterType: "Confirmation Letter",
    });
    setConfirmationForm(emptyConfirmation());
  };

  const handleTransferSave = async () => {
    const f = transferForm;
    if (
      !f.recipientName.trim() ||
      !f.currentPosting.trim() ||
      !f.newPosting.trim() ||
      !f.effectiveDate
    ) {
      toast.error(
        "Recipient Name, Current Posting, New Posting, and Effective Date are required",
      );
      return;
    }
    await saveStructuredLetter({
      kind: "transfer",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Transfer Letter - ${f.recipientName} - ${f.currentPosting} to ${f.newPosting}`,
      body: buildTransferBody(f),
      letterType: "Transfer Letter",
    });
    setTransferForm(emptyTransfer());
  };

  const handlePromotionSave = async () => {
    const f = promotionForm;
    if (
      !f.recipientName.trim() ||
      !f.currentDesignation.trim() ||
      !f.newDesignation.trim() ||
      !f.effectiveDate
    ) {
      toast.error(
        "Recipient Name, Current and New Designation, and Effective Date are required",
      );
      return;
    }
    await saveStructuredLetter({
      kind: "promotion",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Promotion Letter - ${f.recipientName} - ${f.newDesignation}`,
      body: buildPromotionBody(f),
      letterType: "Promotion Letter",
    });
    setPromotionForm(emptyPromotion());
  };

  const handleIncrementSave = async () => {
    const f = incrementForm;
    if (
      !f.recipientName.trim() ||
      !f.currentSalary.trim() ||
      !f.newSalary.trim() ||
      !f.effectiveDate
    ) {
      toast.error(
        "Recipient Name, Current Salary, New Salary, and Effective Date are required",
      );
      return;
    }
    await saveStructuredLetter({
      kind: "increment",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Salary Increment Letter - ${f.recipientName}`,
      body: buildIncrementBody(f),
      letterType: "Increment Letter",
    });
    setIncrementForm(emptyIncrement());
  };

  const handleWarningSave = async () => {
    const f = warningForm;
    if (!f.recipientName.trim() || !f.warningReason.trim()) {
      toast.error("Recipient Name and Warning Reason are required");
      return;
    }
    await saveStructuredLetter({
      kind: "warning",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Warning Letter - ${f.recipientName}`,
      body: buildWarningBody(f),
      letterType: "Warning Letter",
    });
    setWarningForm(emptyWarning());
  };

  const handleTerminationSave = async () => {
    const f = terminationForm;
    if (!f.recipientName.trim() || !f.terminationDate || !f.lastWorkingDay) {
      toast.error(
        "Recipient Name, Termination Date, and Last Working Day are required",
      );
      return;
    }
    await saveStructuredLetter({
      kind: "termination",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Termination Letter - ${f.recipientName}`,
      body: buildTerminationBody(f),
      letterType: "Termination Letter",
    });
    setTerminationForm(emptyTermination());
  };

  const handleExperienceSave = async () => {
    const f = experienceForm;
    if (
      !f.recipientName.trim() ||
      !f.designation.trim() ||
      !f.joiningDate ||
      !f.lastWorkingDay
    ) {
      toast.error(
        "Employee Name, Designation, Joining Date, and Last Working Day are required",
      );
      return;
    }
    await saveStructuredLetter({
      kind: "experience",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Experience Letter - ${f.recipientName}`,
      body: buildExperienceBody(f),
      letterType: "Experience Letter",
    });
    setExperienceForm(emptyExperience());
  };

  const handleShowCauseSave = async () => {
    const f = showCauseForm;
    if (!f.recipientName.trim() || !f.reason.trim()) {
      toast.error("Employee Name and Reason are required");
      return;
    }
    await saveStructuredLetter({
      kind: "showCause",
      recipientName: f.recipientName,
      date: f.date,
      subject: `Show Cause Notice - ${f.recipientName}`,
      body: buildShowCauseBody(f),
      letterType: "Show Cause Notice",
    });
    setShowCauseForm(emptyShowCause());
  };

  const handleCustomSave = async (status: LetterStatus) => {
    const f = customForm;
    if (!f.recipientName.trim() || !f.subject.trim() || !f.body.trim()) {
      toast.error("Recipient Name, Subject, and Body are required");
      return;
    }
    if (!session?.token) return;
    setSaving(true);
    try {
      const createRes = await api.createOfficialLetter(session.token, {
        recipientName: f.recipientName,
        subject: f.subject,
        body: f.body,
        date: f.date,
        status: LetterStatus.draft,
        letterType: inferLetterTypeEnum(f.subject),
      });
      if (createRes.__kind__ !== "ok") {
        toast.error(createRes.err || "Save failed");
        return;
      }
      if (status === LetterStatus.final_) {
        await fetchLetters();
        const updated = await api.listAllOfficialLetters(session.token);
        const newest = (updated as OfficialLetterExtended[]).sort(
          (a, b) => Number(b.createdAt) - Number(a.createdAt),
        )[0];
        if (newest) await api.finalizeOfficialLetter(session.token, newest.id);
      }
      toast.success(
        status === LetterStatus.draft
          ? "Saved as draft"
          : "Letter saved as Final",
      );
      setCustomForm(emptyCustom());
      setTab("list");
      setSelectedKind(null);
      await fetchLetters();
    } catch {
      toast.error("Failed to save letter");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: bigint) => {
    if (!session?.token) return;
    setDeletingId(id);
    try {
      const res = await api.deleteOfficialLetter(session.token, id);
      if (res.__kind__ === "ok") {
        toast.success("Letter deleted");
        setLetters((prev) => prev.filter((l) => l.id !== id));
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

  // ── Download PDF ──────────────────────────────────────────────────────────

  const handleDownloadPdf = async (letter: OfficialLetterExtended) => {
    if (!session?.token) return;
    setDownloadingId(letter.id);
    try {
      const letterType = letter.letterType ?? inferLetterType(letter.subject);
      const sess = session as AuthSession & { designation?: string };
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
          designation: sess.designation ?? String(portalRole),
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

  // ── Send via Email ────────────────────────────────────────────────────────

  const handleSendViaEmail = async (letter: OfficialLetterExtended) => {
    if (!session?.token) return;
    setEmailingId(letter.id);
    setRecipientMissingEmail(null);
    try {
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
        /* silently ignore */
      }

      if (!recipientEmail) setRecipientMissingEmail(letter.id);

      const toEmail = recipientEmail ?? COMPANY_EMAIL;
      const ccEmails: string[] = [COMPANY_EMAIL];

      if (recipientEmail) {
        try {
          const recipientUser = allUsers.find(
            (u) => u.email?.trim() === recipientEmail,
          );
          if (recipientUser?.reportsTo) {
            const manager = await api.getUser(
              session.token,
              recipientUser.reportsTo,
            );
            if (manager?.email?.trim()) ccEmails.push(manager.email.trim());
          }
        } catch {
          /* silently ignore */
        }
      }

      const subject = buildSubject(letter);
      const sess = session as AuthSession & { designation?: string };
      const body = buildEmailBody(
        letter,
        session.name,
        sess.designation ?? String(portalRole),
        company?.companyName ?? "Krishkar Pharmaceuticals",
      );

      await handleDownloadPdf(letter);

      const ccParam = ccEmails.filter(Boolean).join(",");
      const mailto = `mailto:${encodeURIComponent(toEmail)}?${ccParam ? `cc=${encodeURIComponent(ccParam)}&` : ""}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;

      toast.info(
        "Your email app has opened with all recipients and subject pre-filled. Please attach the downloaded PDF of this letter before sending.",
        { duration: 8000 },
      );
    } catch {
      toast.error("Failed to open email. Please try again.");
    } finally {
      setEmailingId(null);
    }
  };

  // ── Print ────────────────────────────────────────────────────────────────

  const handlePrint = (letter: OfficialLetterExtended) => {
    const co = company;
    const name = co?.companyName ?? "Krishkar Pharmaceuticals";
    const address = co?.address ?? "";
    const contact = co?.contactNumber ?? "";
    const logoHtml = co?.logoUrl
      ? `<img src="${co.logoUrl}" alt="Logo" style="height:80px;object-fit:contain;margin-bottom:8px;" />`
      : "";
    const bodyHtml = letter.body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>${letter.subject}</title><style>@page{size:A4;margin:2cm}body{font-family:Arial,sans-serif;font-size:13px;color:#111}.header{border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px}.co-name{font-size:20px;font-weight:bold}.meta{font-size:11px;color:#555}.body-section{line-height:1.7}</style></head><body><div class="header">${logoHtml ? `<div>${logoHtml}</div>` : ""}<div class="co-name">${name}</div>${address ? `<div class="meta">${address}</div>` : ""}${contact ? `<div class="meta">${contact}</div>` : ""}</div><div style="text-align:right">Date: ${letter.date}</div><div>To: <strong>${letter.recipientName}</strong></div><div style="font-weight:bold;margin:12px 0">Subject: ${letter.subject}</div><div class="body-section">${bodyHtml}</div></body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Popup blocked");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Official Letters"
        subtitle="Create, manage, and send standard SFA letters on company letterhead"
      />
      <PageContent>
        {/* Tabs */}
        <div
          className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit mb-6"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "list"}
            onClick={() => setTab("list")}
            data-ocid="letters-list-tab"
            className={`px-4 py-1.5 rounded-md text-sm font-display font-medium transition-colors ${
              tab === "list"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Letters
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "compose"}
            onClick={() => {
              setTab("compose");
              setSelectedKind(null);
            }}
            data-ocid="letters-compose-tab"
            className={`px-4 py-1.5 rounded-md text-sm font-display font-medium transition-colors ${
              tab === "compose"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            New Letter
          </button>
        </div>

        {tab === "list" && (
          <LetterList
            letters={letters}
            loading={loading}
            confirmDeleteId={confirmDeleteId}
            deletingId={deletingId}
            downloadingId={downloadingId}
            emailingId={emailingId}
            recipientMissingEmail={recipientMissingEmail}
            onDownloadPdf={handleDownloadPdf}
            onSendViaEmail={handleSendViaEmail}
            onPrint={handlePrint}
            onConfirmDelete={setConfirmDeleteId}
            onDelete={handleDelete}
            onCancelDelete={() => setConfirmDeleteId(null)}
          />
        )}

        {tab === "compose" && !selectedKind && (
          <LetterTypeSelector onSelect={setSelectedKind} />
        )}

        {tab === "compose" && selectedKind && (
          <div ref={formRef}>
            <button
              type="button"
              onClick={() => setSelectedKind(null)}
              className="text-xs text-muted-foreground hover:text-foreground underline mb-4 inline-block"
            >
              ← Back to letter types
            </button>
            {selectedKind === "appointment" && (
              <AppointmentForm
                form={appointmentForm}
                setForm={setAppointmentForm}
                saving={saving}
                onSave={handleAppointmentSave}
                company={company}
              />
            )}
            {selectedKind === "confirmation" && (
              <ConfirmationForm
                form={confirmationForm}
                setForm={setConfirmationForm}
                saving={saving}
                onSave={handleConfirmationSave}
                company={company}
              />
            )}
            {selectedKind === "transfer" && (
              <TransferForm
                form={transferForm}
                setForm={setTransferForm}
                saving={saving}
                onSave={handleTransferSave}
                company={company}
              />
            )}
            {selectedKind === "promotion" && (
              <PromotionForm
                form={promotionForm}
                setForm={setPromotionForm}
                saving={saving}
                onSave={handlePromotionSave}
                company={company}
              />
            )}
            {selectedKind === "increment" && (
              <IncrementForm
                form={incrementForm}
                setForm={setIncrementForm}
                saving={saving}
                onSave={handleIncrementSave}
                company={company}
              />
            )}
            {selectedKind === "warning" && (
              <WarningForm
                form={warningForm}
                setForm={setWarningForm}
                saving={saving}
                onSave={handleWarningSave}
                company={company}
              />
            )}
            {selectedKind === "termination" && (
              <TerminationForm
                form={terminationForm}
                setForm={setTerminationForm}
                saving={saving}
                onSave={handleTerminationSave}
                company={company}
              />
            )}
            {selectedKind === "experience" && (
              <ExperienceForm
                form={experienceForm}
                setForm={setExperienceForm}
                saving={saving}
                onSave={handleExperienceSave}
                company={company}
              />
            )}
            {selectedKind === "showCause" && (
              <ShowCauseForm
                form={showCauseForm}
                setForm={setShowCauseForm}
                saving={saving}
                onSave={handleShowCauseSave}
                company={company}
              />
            )}
            {selectedKind === "custom" && (
              <CustomForm
                form={customForm}
                setForm={setCustomForm}
                saving={saving}
                onSave={handleCustomSave}
                company={company}
              />
            )}
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}

// ── Letter Type Selector ───────────────────────────────────────────────────────

function LetterTypeSelector({
  onSelect,
}: { onSelect: (k: LetterKind) => void }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Select the type of official letter to create:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {LETTER_KINDS.map(({ kind, label, icon: Icon, desc }) => (
          <button
            key={kind}
            type="button"
            data-ocid={`letter-type-${kind}`}
            onClick={() => onSelect(kind)}
            className="flex items-start gap-3 p-4 bg-card border border-border rounded-lg hover:border-primary hover:shadow-sm text-left transition-all group"
          >
            <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-display font-semibold text-foreground">
                {label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {desc}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Shared form header ──────────────────────────────────────────────────────

function CompanyBrand({ company }: { company: CompanyProfile | null }) {
  if (!company) return null;
  return (
    <div className="bg-muted/30 border border-border rounded-md px-4 py-3 flex items-center gap-3 mb-4">
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
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-display">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function DateField({
  id,
  label,
  required,
  value,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field id={id} label={label} required={required}>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function LetterFormShell({
  title,
  company,
  saving,
  onSave,
  saveLabelOverride,
  onSaveDraft,
  children,
}: {
  title: string;
  company: CompanyProfile | null;
  saving: boolean;
  onSave: () => void;
  saveLabelOverride?: string;
  onSaveDraft?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
        <CompanyBrand company={company} />
        {children}
        <div className="flex flex-wrap gap-2 pt-1">
          {onSaveDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveDraft}
              disabled={saving}
              data-ocid="save-draft-btn"
            >
              {saving ? "Saving…" : "Save as Draft"}
            </Button>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
            data-ocid="save-final-btn"
          >
            {saving ? "Saving…" : (saveLabelOverride ?? "Save as Final Letter")}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        💡 After saving, use the <strong>Download PDF</strong> and{" "}
        <strong>Send via Email</strong> buttons on the letter to generate the
        PDF with company letterhead and send it.
      </p>
    </div>
  );
}

// ── Confirmation Form ─────────────────────────────────────────────────────────

function ConfirmationForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: ConfirmationFields;
  setForm: React.Dispatch<React.SetStateAction<ConfirmationFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Confirmation Letter"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="cf-name" label="Employee Name" required>
          <Input
            id="cf-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="confirmation-recipient-input"
          />
        </Field>
        <DateField
          id="cf-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
        <DateField
          id="cf-probation"
          label="Probation End Date"
          required
          value={form.probationEndDate}
          onChange={(v) => setForm((f) => ({ ...f, probationEndDate: v }))}
        />
        <DateField
          id="cf-confirm"
          label="Confirmation Date"
          required
          value={form.confirmationDate}
          onChange={(v) => setForm((f) => ({ ...f, confirmationDate: v }))}
        />
        <Field id="cf-desig" label="Revised Designation (optional)">
          <Input
            id="cf-desig"
            placeholder="Medical Representative"
            value={form.revisedDesignation}
            onChange={(e) =>
              setForm((f) => ({ ...f, revisedDesignation: e.target.value }))
            }
            data-ocid="confirmation-designation-input"
          />
        </Field>
        <Field id="cf-salary" label="Revised Salary in INR (optional)">
          <Input
            id="cf-salary"
            placeholder="₹ 25,000"
            value={form.revisedSalary}
            onChange={(e) =>
              setForm((f) => ({ ...f, revisedSalary: e.target.value }))
            }
            data-ocid="confirmation-salary-input"
          />
        </Field>
      </FormGrid>
    </LetterFormShell>
  );
}

// ── Transfer Form ─────────────────────────────────────────────────────────────

function TransferForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: TransferFields;
  setForm: React.Dispatch<React.SetStateAction<TransferFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Transfer Letter"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="tf-name" label="Employee Name" required>
          <Input
            id="tf-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="transfer-recipient-input"
          />
        </Field>
        <DateField
          id="tf-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
        <Field id="tf-current" label="Current Posting / Location" required>
          <Input
            id="tf-current"
            placeholder="Mumbai HQ"
            value={form.currentPosting}
            onChange={(e) =>
              setForm((f) => ({ ...f, currentPosting: e.target.value }))
            }
            data-ocid="transfer-current-input"
          />
        </Field>
        <Field id="tf-new" label="New Posting / Location" required>
          <Input
            id="tf-new"
            placeholder="Pune Region"
            value={form.newPosting}
            onChange={(e) =>
              setForm((f) => ({ ...f, newPosting: e.target.value }))
            }
            data-ocid="transfer-new-input"
          />
        </Field>
        <Field id="tf-hq" label="New HQ">
          <Input
            id="tf-hq"
            placeholder="Pune"
            value={form.newHQ}
            onChange={(e) => setForm((f) => ({ ...f, newHQ: e.target.value }))}
            data-ocid="transfer-hq-input"
          />
        </Field>
        <DateField
          id="tf-effective"
          label="Effective Date"
          required
          value={form.effectiveDate}
          onChange={(v) => setForm((f) => ({ ...f, effectiveDate: v }))}
        />
      </FormGrid>
    </LetterFormShell>
  );
}

// ── Promotion Form ────────────────────────────────────────────────────────────

function PromotionForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: PromotionFields;
  setForm: React.Dispatch<React.SetStateAction<PromotionFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Promotion Letter"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="pf-name" label="Employee Name" required>
          <Input
            id="pf-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="promotion-recipient-input"
          />
        </Field>
        <DateField
          id="pf-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
        <Field id="pf-cur-desig" label="Current Designation" required>
          <Input
            id="pf-cur-desig"
            placeholder="Medical Representative"
            value={form.currentDesignation}
            onChange={(e) =>
              setForm((f) => ({ ...f, currentDesignation: e.target.value }))
            }
            data-ocid="promotion-current-desig-input"
          />
        </Field>
        <Field id="pf-new-desig" label="New Designation" required>
          <Input
            id="pf-new-desig"
            placeholder="Senior MR"
            value={form.newDesignation}
            onChange={(e) =>
              setForm((f) => ({ ...f, newDesignation: e.target.value }))
            }
            data-ocid="promotion-new-desig-input"
          />
        </Field>
        <Field id="pf-grade" label="New Grade (optional)">
          <Input
            id="pf-grade"
            placeholder="Grade B"
            value={form.newGrade}
            onChange={(e) =>
              setForm((f) => ({ ...f, newGrade: e.target.value }))
            }
            data-ocid="promotion-grade-input"
          />
        </Field>
        <DateField
          id="pf-effective"
          label="Effective Date"
          required
          value={form.effectiveDate}
          onChange={(v) => setForm((f) => ({ ...f, effectiveDate: v }))}
        />
        <Field id="pf-salary" label="Promoted Salary in INR (optional)">
          <Input
            id="pf-salary"
            placeholder="₹ 35,000"
            value={form.promotedSalary}
            onChange={(e) =>
              setForm((f) => ({ ...f, promotedSalary: e.target.value }))
            }
            data-ocid="promotion-salary-input"
          />
        </Field>
      </FormGrid>
    </LetterFormShell>
  );
}

// ── Increment Form ────────────────────────────────────────────────────────────

function IncrementForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: IncrementFields;
  setForm: React.Dispatch<React.SetStateAction<IncrementFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  const computedIncrement = calcIncrement(form.currentSalary, form.newSalary);
  return (
    <LetterFormShell
      title="Increment Letter"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="if-name" label="Employee Name" required>
          <Input
            id="if-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="increment-recipient-input"
          />
        </Field>
        <DateField
          id="if-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
        <Field id="if-cur" label="Current Salary (INR)" required>
          <Input
            id="if-cur"
            placeholder="₹ 25,000"
            value={form.currentSalary}
            onChange={(e) =>
              setForm((f) => ({ ...f, currentSalary: e.target.value }))
            }
            data-ocid="increment-current-salary-input"
          />
        </Field>
        <Field id="if-new" label="New Salary (INR)" required>
          <Input
            id="if-new"
            placeholder="₹ 28,000"
            value={form.newSalary}
            onChange={(e) =>
              setForm((f) => ({ ...f, newSalary: e.target.value }))
            }
            data-ocid="increment-new-salary-input"
          />
        </Field>
        <Field id="if-inc" label="Increment Amount (auto-calculated)">
          <Input
            id="if-inc"
            placeholder="₹ 3,000"
            value={computedIncrement || form.incrementAmount}
            onChange={(e) =>
              setForm((f) => ({ ...f, incrementAmount: e.target.value }))
            }
            data-ocid="increment-amount-input"
            className={computedIncrement ? "bg-muted/50 text-foreground" : ""}
          />
          {computedIncrement && (
            <p className="text-xs text-muted-foreground">
              Auto-calculated: {computedIncrement}
            </p>
          )}
        </Field>
        <DateField
          id="if-effective"
          label="Effective Date"
          required
          value={form.effectiveDate}
          onChange={(v) => setForm((f) => ({ ...f, effectiveDate: v }))}
        />
      </FormGrid>
    </LetterFormShell>
  );
}

// ── Warning Form ──────────────────────────────────────────────────────────────

function WarningForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: WarningFields;
  setForm: React.Dispatch<React.SetStateAction<WarningFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Warning Letter"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="wf-name" label="Employee Name" required>
          <Input
            id="wf-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="warning-recipient-input"
          />
        </Field>
        <DateField
          id="wf-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
      </FormGrid>
      <Field id="wf-reason" label="Warning Reason" required>
        <Textarea
          id="wf-reason"
          placeholder="Describe the reason for issuing this warning..."
          rows={4}
          value={form.warningReason}
          onChange={(e) =>
            setForm((f) => ({ ...f, warningReason: e.target.value }))
          }
          data-ocid="warning-reason-input"
          className="resize-y"
        />
      </Field>
      <Field id="wf-action" label="Disciplinary Action Details" required>
        <Textarea
          id="wf-action"
          placeholder="State the consequences and actions to be taken..."
          rows={4}
          value={form.disciplinaryAction}
          onChange={(e) =>
            setForm((f) => ({ ...f, disciplinaryAction: e.target.value }))
          }
          data-ocid="warning-action-input"
          className="resize-y"
        />
      </Field>
    </LetterFormShell>
  );
}

// ── Termination Form ──────────────────────────────────────────────────────────

function TerminationForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: TerminationFields;
  setForm: React.Dispatch<React.SetStateAction<TerminationFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Termination Letter"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="term-name" label="Employee Name" required>
          <Input
            id="term-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="termination-recipient-input"
          />
        </Field>
        <DateField
          id="term-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
        <DateField
          id="term-tdate"
          label="Termination / Resignation Date"
          required
          value={form.terminationDate}
          onChange={(v) => setForm((f) => ({ ...f, terminationDate: v }))}
        />
        <DateField
          id="term-lwd"
          label="Last Working Day"
          required
          value={form.lastWorkingDay}
          onChange={(v) => setForm((f) => ({ ...f, lastWorkingDay: v }))}
        />
        <div className="sm:col-span-2">
          <Field id="term-ref" label="Final Settlement Reference (optional)">
            <Input
              id="term-ref"
              placeholder="F&F Ref: HR/2026/FNF/001"
              value={form.finalSettlementRef}
              onChange={(e) =>
                setForm((f) => ({ ...f, finalSettlementRef: e.target.value }))
              }
              data-ocid="termination-settlement-input"
            />
          </Field>
        </div>
      </FormGrid>
    </LetterFormShell>
  );
}

// ── Custom Letter Form ────────────────────────────────────────────────────────

function CustomForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: CustomFields;
  setForm: React.Dispatch<React.SetStateAction<CustomFields>>;
  saving: boolean;
  onSave: (status: LetterStatus) => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Custom Letter"
      company={company}
      saving={saving}
      onSave={() => onSave(LetterStatus.final_)}
      saveLabelOverride="Save as Final"
      onSaveDraft={() => onSave(LetterStatus.draft)}
    >
      <FormGrid>
        <Field id="cust-name" label="Recipient Name" required>
          <Input
            id="cust-name"
            placeholder="Dr. Rajesh Kumar"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="custom-letter-recipient-input"
          />
        </Field>
        <DateField
          id="cust-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
      </FormGrid>
      <Field id="cust-subject" label="Subject" required>
        <Input
          id="cust-subject"
          placeholder="Appointment Confirmation"
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          data-ocid="custom-letter-subject-input"
        />
      </Field>
      <Field id="cust-body" label="Letter Body" required>
        <Textarea
          id="cust-body"
          placeholder="Dear Sir/Madam,&#10;&#10;With reference to the above subject..."
          rows={12}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          className="font-body text-sm leading-relaxed resize-y"
          data-ocid="custom-letter-body-input"
        />
        <p className="text-xs text-muted-foreground">
          Line breaks are preserved in the printed letter.
        </p>
      </Field>
    </LetterFormShell>
  );
}

// ── Appointment Form ───────────────────────────────────────────────────

function AppointmentForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: AppointmentFields;
  setForm: React.Dispatch<React.SetStateAction<AppointmentFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Appointment Letter"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="ap-name" label="Employee Name" required>
          <Input
            id="ap-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="appointment-recipient-input"
          />
        </Field>
        <DateField
          id="ap-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
        <Field id="ap-desig" label="Designation" required>
          <Input
            id="ap-desig"
            placeholder="Medical Representative"
            value={form.designation}
            onChange={(e) =>
              setForm((f) => ({ ...f, designation: e.target.value }))
            }
            data-ocid="appointment-designation-input"
          />
        </Field>
        <Field id="ap-dept" label="Department">
          <Input
            id="ap-dept"
            placeholder="Sales & Marketing"
            value={form.department}
            onChange={(e) =>
              setForm((f) => ({ ...f, department: e.target.value }))
            }
            data-ocid="appointment-department-input"
          />
        </Field>
        <DateField
          id="ap-joining"
          label="Date of Joining"
          required
          value={form.joiningDate}
          onChange={(v) => setForm((f) => ({ ...f, joiningDate: v }))}
        />
        <Field id="ap-ctc" label="CTC per Annum in INR (optional)">
          <Input
            id="ap-ctc"
            placeholder="₹ 3,00,000"
            value={form.ctc}
            onChange={(e) => setForm((f) => ({ ...f, ctc: e.target.value }))}
            data-ocid="appointment-ctc-input"
          />
        </Field>
      </FormGrid>
    </LetterFormShell>
  );
}

// ── Experience Form ───────────────────────────────────────────────────

function ExperienceForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: ExperienceFields;
  setForm: React.Dispatch<React.SetStateAction<ExperienceFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Experience Letter"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="ex-name" label="Employee Name" required>
          <Input
            id="ex-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="experience-recipient-input"
          />
        </Field>
        <DateField
          id="ex-date"
          label="Letter Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
        <Field id="ex-desig" label="Designation" required>
          <Input
            id="ex-desig"
            placeholder="Medical Representative"
            value={form.designation}
            onChange={(e) =>
              setForm((f) => ({ ...f, designation: e.target.value }))
            }
            data-ocid="experience-designation-input"
          />
        </Field>
        <Field id="ex-tenure" label="Total Tenure (optional)">
          <Input
            id="ex-tenure"
            placeholder="2 years 3 months"
            value={form.tenure}
            onChange={(e) => setForm((f) => ({ ...f, tenure: e.target.value }))}
            data-ocid="experience-tenure-input"
          />
        </Field>
        <DateField
          id="ex-joining"
          label="Date of Joining"
          required
          value={form.joiningDate}
          onChange={(v) => setForm((f) => ({ ...f, joiningDate: v }))}
        />
        <DateField
          id="ex-lwd"
          label="Last Working Day"
          required
          value={form.lastWorkingDay}
          onChange={(v) => setForm((f) => ({ ...f, lastWorkingDay: v }))}
        />
      </FormGrid>
    </LetterFormShell>
  );
}

// ── Show Cause Form ──────────────────────────────────────────────────

function ShowCauseForm({
  form,
  setForm,
  saving,
  onSave,
  company,
}: {
  form: ShowCauseFields;
  setForm: React.Dispatch<React.SetStateAction<ShowCauseFields>>;
  saving: boolean;
  onSave: () => void;
  company: CompanyProfile | null;
}) {
  return (
    <LetterFormShell
      title="Show Cause Notice"
      company={company}
      saving={saving}
      onSave={onSave}
    >
      <FormGrid>
        <Field id="sc-name" label="Employee Name" required>
          <Input
            id="sc-name"
            placeholder="Ramesh Sharma"
            value={form.recipientName}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipientName: e.target.value }))
            }
            data-ocid="showcause-recipient-input"
          />
        </Field>
        <DateField
          id="sc-date"
          label="Notice Date"
          required
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
        />
        <DateField
          id="sc-deadline"
          label="Response Deadline"
          value={form.responseDeadline}
          onChange={(v) => setForm((f) => ({ ...f, responseDeadline: v }))}
        />
      </FormGrid>
      <Field id="sc-reason" label="Reason / Charges" required>
        <Textarea
          id="sc-reason"
          placeholder="Describe the reason or charges for which show cause is being issued..."
          rows={5}
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          className="font-body text-sm leading-relaxed resize-y"
          data-ocid="showcause-reason-input"
        />
      </Field>
    </LetterFormShell>
  );
}

// ── Letter List ───────────────────────────────────────────────────────────────

interface LetterListProps {
  letters: OfficialLetterExtended[];
  loading: boolean;
  confirmDeleteId: bigint | null;
  deletingId: bigint | null;
  downloadingId: bigint | null;
  emailingId: bigint | null;
  recipientMissingEmail: bigint | null;
  onDownloadPdf: (l: OfficialLetterExtended) => void;
  onSendViaEmail: (l: OfficialLetterExtended) => void;
  onPrint: (l: OfficialLetterExtended) => void;
  onConfirmDelete: (id: bigint) => void;
  onDelete: (id: bigint) => void;
  onCancelDelete: () => void;
}

function LetterList({
  letters,
  loading,
  confirmDeleteId,
  deletingId,
  downloadingId,
  emailingId,
  recipientMissingEmail,
  onDownloadPdf,
  onSendViaEmail,
  onPrint,
  onConfirmDelete,
  onDelete,
  onCancelDelete,
}: LetterListProps) {
  return (
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
            Click &quot;New Letter&quot; to compose your first official letter.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {letters.map((letter) => (
            <LetterRow
              key={String(letter.id)}
              letter={letter}
              confirmDeleteId={confirmDeleteId}
              deletingId={deletingId}
              downloadingId={downloadingId}
              emailingId={emailingId}
              recipientMissingEmail={recipientMissingEmail}
              onPrint={onPrint}
              onDownloadPdf={onDownloadPdf}
              onSendViaEmail={onSendViaEmail}
              onConfirmDelete={onConfirmDelete}
              onDelete={onDelete}
              onCancelDelete={onCancelDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Letter Row ─────────────────────────────────────────────────────────────────

interface LetterRowProps {
  letter: OfficialLetterExtended;
  confirmDeleteId: bigint | null;
  deletingId: bigint | null;
  downloadingId: bigint | null;
  emailingId: bigint | null;
  recipientMissingEmail: bigint | null;
  onPrint: (l: OfficialLetterExtended) => void;
  onDownloadPdf: (l: OfficialLetterExtended) => void;
  onSendViaEmail: (l: OfficialLetterExtended) => void;
  onConfirmDelete: (id: bigint) => void;
  onDelete: (id: bigint) => void;
  onCancelDelete: () => void;
}

function LetterRow({
  letter,
  confirmDeleteId,
  deletingId,
  downloadingId,
  emailingId,
  recipientMissingEmail,
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

  const letterTypeBadge = letter.letterType ?? inferLetterType(letter.subject);

  return (
    <div
      data-ocid={`letter-row-${String(letter.id)}`}
      className="px-4 py-3 flex flex-col gap-2 hover:bg-muted/20 transition-colors"
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
            <Badge variant="outline" className="text-xs shrink-0">
              {letterTypeBadge}
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

        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            aria-label="Print"
            data-ocid={`print-letter-${String(letter.id)}`}
            onClick={() => onPrint(letter)}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
            title="Print with company letterhead"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="Download PDF"
            data-ocid={`download-pdf-${String(letter.id)}`}
            onClick={() => onDownloadPdf(letter)}
            disabled={isDownloading}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary disabled:opacity-50"
            title="Download PDF with company letterhead"
          >
            {isDownloading ? (
              <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Send via Email"
            data-ocid={`send-email-${String(letter.id)}`}
            onClick={() => onSendViaEmail(letter)}
            disabled={isEmailing}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary disabled:opacity-50"
            title="Tap to send this letter as PDF via email. Your email app will open — please attach the PDF before sending."
          >
            {isEmailing ? (
              <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
          </button>
          {isConfirmingDelete ? (
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
          )}
        </div>
      </div>

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

      {letter.emailLogs && letter.emailLogs.length > 0 && (
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
