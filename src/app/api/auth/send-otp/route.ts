import crypto from "crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function normalizeEmail(raw: unknown) {
  return String(raw ?? "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function otpDocId(email: string) {
  return crypto.createHash("sha256").update(email).digest("hex").slice(0, 32);
}

function computeOtpHash(email: string, otp: string, secret: string) {
  return crypto
    .createHash("sha256")
    .update(`${email}|${otp}|${secret}`)
    .digest("hex");
}

function makeOtp() {
  const n = crypto.randomInt(100000, 1000000);
  return String(n);
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST ?? "";
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure = String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true";
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const from = process.env.SMTP_FROM ?? user;
  return { host, port, secure, user, pass, from };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatExpiryText(expiresInMin: number) {
  return expiresInMin === 1 ? "1 minute" : `${expiresInMin} minutes`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown };
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, message: "Invalid email." }, { status: 400 });
    }

    const otpSecret = process.env.OTP_SECRET ?? "";
    if (!otpSecret) {
      return NextResponse.json(
        { ok: false, message: "Server OTP is not configured." },
        { status: 500 },
      );
    }

    const smtp = getSmtpConfig();
    if (!smtp.host || !smtp.user || !smtp.pass || !smtp.from) {
      return NextResponse.json(
        { ok: false, message: "Server email is not configured." },
        { status: 500 },
      );
    }

    const adminQuery = query(collection(db, "admin"), where("email", "==", email));
    const adminSnap = await getDocs(adminQuery);
    const adminDoc = adminSnap.docs[0];
    const adminData = adminDoc
      ? (adminDoc.data() as { twoFactorEnabled?: boolean })
      : null;
    if (!adminDoc || !adminData?.twoFactorEnabled) {
      return NextResponse.json({ ok: true });
    }

    const otpId = otpDocId(email);
    const otpRef = doc(db, "admin_otp", otpId);
    const existingSnap = await getDoc(otpRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data() as { lastSentAtMillis?: number } | null;
      const last = existing?.lastSentAtMillis ?? 0;
      const now = Date.now();
      if (last && now - last < 60_000) {
        return NextResponse.json(
          { ok: false, message: "Please wait before requesting another OTP." },
          { status: 429 },
        );
      }
    }

    const otp = makeOtp();
    const now = Date.now();
    const expiresInMin = 10;
    const expiresAtMillis = now + expiresInMin * 60 * 1000;
    const otpHash = computeOtpHash(email, otp, otpSecret);

    await setDoc(
      otpRef,
      {
        email,
        otpHash,
        createdAtMillis: now,
        expiresAtMillis,
        lastSentAtMillis: now,
        attempts: 0,
      },
      { merge: true },
    );

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const safeEmail = escapeHtml(email);
    const safeOtp = escapeHtml(otp);
    const expiryText = escapeHtml(formatExpiryText(expiresInMin));

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Evohus OTP</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fb;">
    <div style="padding:28px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:560px;margin:0 auto;">
        <tr>
          <td style="padding:0 0 14px 0;">
            <div style="display:inline-block;padding:10px 14px;border-radius:14px;background:#0b1220;color:#ffffff;font:600 12px/1.2 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
              EVOHUS
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid rgba(15,23,42,0.08);border-radius:18px;overflow:hidden;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
            <div style="padding:22px 22px 0 22px;">
              <div style="font:700 18px/1.3 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#0f172a;">
                Your login verification code
              </div>
              <div style="margin-top:8px;font:500 13px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#475569;">
                We received a request to sign in to your <b>Evohus Admin</b> account. To continue, please enter the one-time verification code below.
                This code will expire in <b>${expiryText}</b> for your security.
              </div>
              <div style="margin-top:10px;font:500 12px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#64748b;">
                If you are signing in, you can safely ignore this message after entering the code. If you did not request this, your password may be compromised — we recommend changing it immediately.
              </div>
            </div>

            <div style="padding:18px 22px 0 22px;">
              <div style="background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(59,130,246,0.10));border:1px solid rgba(15,23,42,0.06);border-radius:16px;padding:14px 14px;">
                <div style="font:700 11px/1.2 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">
                  Verification code
                </div>
                <div style="margin-top:10px;font:800 28px/1.1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,monospace;letter-spacing:0.18em;color:#0f172a;">
                  ${safeOtp}
                </div>
              </div>
              <div style="margin-top:12px;font:500 12px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#64748b;">
                Requested for: <span style="color:#0f172a;font-weight:700;">${safeEmail}</span>
              </div>
            </div>

            <div style="padding:18px 22px 22px 22px;">
              <div style="border-top:1px solid rgba(15,23,42,0.06);margin-top:12px;padding-top:14px;font:500 12px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#64748b;">
                Security tips:
                <ul style="margin:10px 0 0 18px;padding:0;color:#64748b;">
                  <li style="margin:0 0 6px 0;">Never share this code with anyone, including Evohus support.</li>
                  <li style="margin:0 0 6px 0;">Evohus will never ask you for your OTP over phone, WhatsApp, or email.</li>
                  <li style="margin:0;">If you did not request this code, ignore this email and consider changing your password.</li>
                </ul>
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 4px 0 4px;font:500 11px/1.6 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#94a3b8;text-align:center;">
            © ${new Date().getFullYear()} Evohus. This message was sent automatically.
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;

    await transporter.sendMail({
      from: smtp.from,
      to: email,
      subject: "Evohus Admin OTP",
      text: `Your OTP is ${otp}. It expires in ${expiresInMin} minutes.`,
      html,
    });

    return NextResponse.json({ ok: true, expiresInSec: expiresInMin * 60 });
  } catch (err) {
    const e = err as {
      message?: string;
      code?: string;
      response?: string;
      responseCode?: number;
      command?: string;
    };
    const parts = [
      e.code ? `code=${e.code}` : "",
      e.responseCode ? `smtp=${e.responseCode}` : "",
      e.command ? `cmd=${e.command}` : "",
    ].filter(Boolean);
    const message = `${e.message ?? "Failed to send OTP."}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    console.error("[send-otp] error:", { message, code: e.code, response: e.response, responseCode: e.responseCode, command: e.command });
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
