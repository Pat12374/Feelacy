import { Resend } from "resend";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { isProduction } from "@/lib/security/env";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || "WineTreff <onboarding@resend.dev>";
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function writeDevOutbox(input: SendEmailInput): Promise<void> {
  const dir = path.join(process.cwd(), "tmp", "email-outbox");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${stamp}-${input.to.replace(/[^a-z0-9@._-]/gi, "_")}.html`);
  const body = `<!-- to: ${input.to} -->\n<!-- subject: ${input.subject} -->\n${input.html}`;
  await writeFile(file, body, "utf8");
  console.info(`[email:dev] Saved outbox message → ${file}`);
  console.info(`[email:dev] To: ${input.to} | Subject: ${input.subject}`);
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string }> {
  if (isEmailConfigured()) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: emailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("[email] Resend error:", error);
      if (isProduction()) throw new Error("Failed to send email");
      await writeDevOutbox(input);
      return { ok: false };
    }
    return { ok: true, id: data?.id };
  }

  if (isProduction()) {
    throw new Error("RESEND_API_KEY is required to send email in production");
  }

  // Local/dev fallback so registration still “works” without Resend
  await writeDevOutbox(input);
  return { ok: true, id: "dev-outbox" };
}

export function welcomeEmail(input: { name: string; email: string }) {
  const name = input.name.trim() || "there";
  const url = appUrl();
  const subject = "Welcome to WineTreff — registration confirmed";
  const text = [
    `Hi ${name},`,
    ``,
    `Welcome to WineTreff. Your account has been registered successfully.`,
    ``,
    `You can sign in any time at ${url}/login`,
    `Browse bottles at ${url}/search`,
    ``,
    `Buyers never pay WineTreff marketplace commissions — only the listed price, shipping, and applicable taxes.`,
    ``,
    `Cheers,`,
    `The WineTreff team`,
  ].join("\n");

  const html = `
  <div style="font-family:Georgia,serif;background:#f3efe6;padding:32px;color:#14110f;">
    <div style="max-width:560px;margin:0 auto;background:#fffdf8;border:1px solid rgba(20,17,15,0.12);border-radius:16px;padding:28px;">
      <p style="margin:0;font-size:28px;color:#1f3d32;">WineTreff</p>
      <h1 style="margin:20px 0 12px;font-size:24px;">Registration confirmed</h1>
      <p style="line-height:1.55;color:#2c261f;">Hi ${escapeHtml(name)},</p>
      <p style="line-height:1.55;color:#2c261f;">
        Welcome to WineTreff. Your account has been registered successfully.
        You’re ready to explore fixed-price wines, spirits, and rare bottles.
      </p>
      <p style="margin:24px 0;">
        <a href="${url}/search" style="display:inline-block;background:#1f3d32;color:#f3efe6;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;">
          Browse bottles
        </a>
      </p>
      <p style="line-height:1.55;color:#2c261f;font-size:14px;">
        Buyers never pay WineTreff marketplace commissions — only the listed price, shipping, and applicable taxes.
      </p>
      <p style="margin-top:28px;color:#2c261f;">Cheers,<br/>The WineTreff team</p>
    </div>
  </div>`.trim();

  return { subject, text, html };
}

export function passwordResetEmail(input: {
  name: string;
  email: string;
  resetUrl: string;
}) {
  const name = input.name.trim() || "there";
  const subject = "Reset your WineTreff password";
  const text = [
    `Hi ${name},`,
    ``,
    `We received a request to reset your WineTreff password.`,
    `Open this link within 1 hour to choose a new password:`,
    input.resetUrl,
    ``,
    `If you did not request this, you can ignore this email.`,
    ``,
    `— WineTreff`,
  ].join("\n");

  const html = `
  <div style="font-family:Georgia,serif;background:#f3efe6;padding:32px;color:#14110f;">
    <div style="max-width:560px;margin:0 auto;background:#fffdf8;border:1px solid rgba(20,17,15,0.12);border-radius:16px;padding:28px;">
      <p style="margin:0;font-size:28px;color:#1f3d32;">WineTreff</p>
      <h1 style="margin:20px 0 12px;font-size:24px;">Reset your password</h1>
      <p style="line-height:1.55;color:#2c261f;">Hi ${escapeHtml(name)},</p>
      <p style="line-height:1.55;color:#2c261f;">
        We received a request to reset your WineTreff password. This link expires in 1 hour.
      </p>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#1f3d32;color:#f3efe6;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;">
          Choose a new password
        </a>
      </p>
      <p style="line-height:1.55;color:#2c261f;font-size:14px;">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  </div>`.trim();

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { appUrl };
