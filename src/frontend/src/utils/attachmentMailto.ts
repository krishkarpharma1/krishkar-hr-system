/**
 * attachmentMailto.ts
 * Builds mailto: URLs for the Attachment button feature.
 * Resolves CC recipients from the logged-in user's reporting chain.
 */

import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { formatDate } from "./dateFormatter";

const COMPANY_EMAIL = "krishkarpharma@gmail.com";

export interface AttachmentMailtoParams {
  /** Always krishkarpharma@gmail.com */
  toEmail?: string;
  /** Resolved higher-authority emails to CC */
  ccEmails: string[];
  /**
   * Section key determines the subject format.
   * Known keys: 'tadaClaim' | 'leaveApplication' | 'expenseClaim' |
   *             'doctorCallEntry' | 'dcrSubmission' | 'officialLetter'
   */
  section: string;
  /**
   * Context values used in subject / body.
   * Common keys: employeeName, designation, hq, leaveType, date, monthYear,
   *              doctorName, reportType, sectionName
   */
  context: Record<string, string>;
}

// ── Subject builder ────────────────────────────────────────────────────────────

function buildSubject(section: string, ctx: Record<string, string>): string {
  const name = ctx.employeeName ?? ctx.name ?? "";
  const date = ctx.date ?? formatDate(new Date().toISOString().slice(0, 10));

  switch (section) {
    case "tadaClaim":
      return `TA/DA Claim - ${name} - ${ctx.monthYear ?? date}`;
    case "leaveApplication":
      return `Leave Application - ${name} - ${ctx.leaveType ?? "Leave"} - ${date}`;
    case "expenseClaim":
      return `Expense Claim - ${name} - ${ctx.monthYear ?? date}`;
    case "doctorCallEntry":
      return `Doctor Call Document - ${name} - ${ctx.doctorName ?? ""} - ${date}`;
    case "dcrSubmission":
      return `DCR Attachment - ${name} - ${date}`;
    case "officialLetter":
      return `Document Submission - ${name} - ${ctx.reportType ?? "Official Letter"} - ${date}`;
    case "suggestions":
      return `Portal Document - ${name} - Suggestions - ${date}`;
    default:
      return `Portal Document - ${name} - ${ctx.sectionName ?? section} - ${date}`;
  }
}

// ── Body builder ──────────────────────────────────────────────────────────────

function buildBody(ctx: Record<string, string>): string {
  const name = ctx.employeeName ?? ctx.name ?? "";
  const designation = ctx.designation ?? "";
  const hq = ctx.hq ?? "";
  const date = ctx.date ?? formatDate(new Date().toISOString().slice(0, 10));

  return `Dear Team,\n\nPlease find the attached document for the above reference.\n\nEmployee Name: ${name}\nDesignation: ${designation}\nHQ: ${hq}\nDate: ${date}\n\nRegards,\n${name}`;
}

// ── Core builder function ──────────────────────────────────────────────────────

export function buildAttachmentMailto(params: AttachmentMailtoParams): string {
  const to = params.toEmail ?? COMPANY_EMAIL;
  const ccList = params.ccEmails.filter(Boolean);

  const subject = buildSubject(params.section, params.context);
  const body = buildBody(params.context);

  const parts: string[] = [`mailto:${encodeURIComponent(to)}`];
  const queryParams: string[] = [];

  if (ccList.length > 0) {
    queryParams.push(`cc=${encodeURIComponent(ccList.join(","))}`);
  }
  queryParams.push(`subject=${encodeURIComponent(subject)}`);
  queryParams.push(`body=${encodeURIComponent(body)}`);

  return `${parts[0]}?${queryParams.join("&")}`;
}

// ── React hook ────────────────────────────────────────────────────────────────

interface UseAttachmentMailtoReturn {
  buildMailto: (
    section: string,
    context: Record<string, string>,
  ) => Promise<string>;
  loading: boolean;
}

/**
 * useAttachmentMailto — resolves the reporting chain CC list dynamically and
 * returns a function that builds a ready-to-use mailto: URL.
 */
export function useAttachmentMailto(): UseAttachmentMailtoReturn {
  const session = useAuthStore((s) => s.session);
  const [loading, setLoading] = useState(false);

  const buildMailto = useCallback(
    async (
      section: string,
      context: Record<string, string>,
    ): Promise<string> => {
      let ccEmails: string[] = [];

      if (session) {
        setLoading(true);
        try {
          // 1. Get reporting chain (userId + name + role)
          const chain = await api.getEmployeeReportingChain(
            session.token,
            session.userId,
          );

          // 2. Fetch each user to get their email — collect valid ones only
          const emailResults = await Promise.allSettled(
            chain.map((entry) => api.getUser(session.token, entry.userId)),
          );

          ccEmails = emailResults
            .map((r) => {
              if (r.status !== "fulfilled") return null;
              const user = r.value as { email?: string } | null | undefined;
              return user?.email?.trim() || null;
            })
            .filter((e): e is string => !!e);
        } catch {
          // Silently ignore — no CCs added
          ccEmails = [];
        } finally {
          setLoading(false);
        }
      }

      return buildAttachmentMailto({
        toEmail: COMPANY_EMAIL,
        ccEmails,
        section,
        context,
      });
    },
    [session],
  );

  return { buildMailto, loading };
}
