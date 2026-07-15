import nodemailer from "nodemailer";
import type { FieldIssue } from "@shared/schema";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function canSendTransactionalEmail(): boolean {
  return getTransporter() !== null;
}

function getAdminEmail(): string | null {
  return process.env.ADMIN_EMAIL || null;
}

function getSenderEmail(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@breedlog.app";
}

export async function sendIssueNotification(issue: FieldIssue): Promise<boolean> {
  const adminEmail = getAdminEmail();
  const transporter = getTransporter();

  if (!transporter || !adminEmail) {
    console.warn("[Email] SMTP not configured. Issue notification not sent. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM, ADMIN_EMAIL env vars.");
    return false;
  }

  const severityEmoji: Record<string, string> = {
    low: "🟢",
    medium: "🟡",
    high: "🟠",
    blocking: "🔴",
  };
  const emoji = severityEmoji[issue.severity] || "⚪";

  const subject = `${emoji} [BreedLog Field Issue] ${issue.severity.toUpperCase()} — ${issue.title}`;

  const textBody = [
    `NEW FIELD TEST ISSUE REPORT`,
    `===========================`,
    ``,
    `Title: ${issue.title}`,
    `Severity: ${issue.severity.toUpperCase()}`,
    `Area: ${issue.area}`,
    `Status: ${issue.status}`,
    ``,
    `Description:`,
    issue.description,
    ``,
    `Device Type: ${issue.deviceType || "Not specified"}`,
    `App Mode: ${issue.appMode || "Unknown"}`,
    `Current Route: ${issue.currentRoute || "Not specified"}`,
    `App Version: ${issue.appVersion || "Unknown"}`,
    `Workspace: ${issue.inviteCodeRef || "Not specified"}`,
    `Contact: ${issue.contactName || "Anonymous"}`,
    ``,
    `Reported At: ${issue.createdAt.toISOString()}`,
    `Issue ID: #${issue.id}`,
    ``,
    `---`,
    `View in admin panel: /admin (Issues section)`,
    `BreedLog Field Test — STITCH WORX`,
  ].join("\n");

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; border-radius: 8px; padding: 24px; border: 1px solid #e0e0e0;">
    <h2 style="margin: 0 0 16px 0; color: #1f2a44;">
      ${emoji} New Field Issue Report
    </h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr>
        <td style="padding: 8px 0; color: #666; width: 140px; vertical-align: top;">Title</td>
        <td style="padding: 8px 0; font-weight: bold; color: #111;">${escapeHtml(issue.title)}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 8px; color: #666;">Severity</td>
        <td style="padding: 8px; font-weight: bold; color: ${severityColor(issue.severity)};">${issue.severity.toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Area</td>
        <td style="padding: 8px 0; color: #111;">${escapeHtml(issue.area)}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 8px; color: #666;">Device</td>
        <td style="padding: 8px; color: #111;">${escapeHtml(issue.deviceType || "Not specified")} / ${escapeHtml(issue.appMode || "Unknown")}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Route</td>
        <td style="padding: 8px 0; color: #111;">${escapeHtml(issue.currentRoute || "Not specified")}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 8px; color: #666;">Version</td>
        <td style="padding: 8px; color: #111;">${escapeHtml(issue.appVersion || "Unknown")}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Workspace</td>
        <td style="padding: 8px 0; color: #111;">${escapeHtml(issue.inviteCodeRef || "Not specified")}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 8px; color: #666;">Contact</td>
        <td style="padding: 8px; color: #111;">${escapeHtml(issue.contactName || "Anonymous")}</td>
      </tr>
    </table>

    <div style="background: #f4f4f4; border-left: 4px solid #1f2a44; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
      <p style="margin: 0; color: #333; font-size: 14px; white-space: pre-wrap;">${escapeHtml(issue.description)}</p>
    </div>

    <p style="color: #888; font-size: 12px; margin: 0;">
      Reported: ${issue.createdAt.toLocaleString()} &nbsp;|&nbsp; Issue #${issue.id}<br>
      <a href="/admin" style="color: #1f2a44;">View in Admin Panel → Issues</a>
    </p>
  </div>
  <p style="text-align: center; color: #aaa; font-size: 11px; margin-top: 16px;">
    BreedLog Field Test &mdash; STITCH WORX
  </p>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: getSenderEmail(),
      to: adminEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });
    console.log(`[Email] Issue notification sent for issue #${issue.id}`);
    return true;
  } catch (err: any) {
    console.error("[Email] Failed to send issue notification:", err.message);
    return false;
  }
}

export async function sendManagedAuthTokenEmail(params: {
  email: string;
  kind: "email_verification" | "password_recovery";
  token: string;
  expiresAt: Date;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP not configured. Managed auth email not sent.");
    return false;
  }

  const actionLabel = params.kind === "email_verification" ? "Verify your BreedLog email address" : "Reset your BreedLog password";
  const tokenLabel = params.kind === "email_verification" ? "Verification token" : "Recovery token";
  const subject = params.kind === "email_verification"
    ? "BreedLog email verification"
    : "BreedLog password recovery";

  const textBody = [
    actionLabel,
    "",
    `${tokenLabel}: ${params.token}`,
    `Expires at: ${params.expiresAt.toISOString()}`,
    "",
    "If you did not request this message, you can ignore it.",
    "BreedLog — STITCH WORX",
  ].join("\n");

  const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <h2 style="margin: 0 0 12px;">${escapeHtml(actionLabel)}</h2>
  <p style="margin: 0 0 16px;">Use the token below in BreedLog to continue.</p>
  <div style="padding: 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; font-family: Consolas, monospace; font-size: 16px;">
    ${escapeHtml(params.token)}
  </div>
  <p style="margin: 16px 0 0;">Expires at: ${escapeHtml(params.expiresAt.toISOString())}</p>
  <p style="margin: 16px 0 0; color: #64748b;">If you did not request this message, you can ignore it.</p>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: getSenderEmail(),
      to: params.email,
      subject,
      text: textBody,
      html: htmlBody,
    });
    return true;
  } catch (err: any) {
    console.error("[Email] Failed to send managed auth email:", err.message);
    return false;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function severityColor(severity: string): string {
  const colors: Record<string, string> = {
    low: "#22c55e",
    medium: "#f59e0b",
    high: "#f97316",
    blocking: "#ef4444",
  };
  return colors[severity] || "#666";
}
