import crypto from "crypto";
import { NextResponse } from "next/server";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function normalizeEmail(raw: unknown) {
  return String(raw ?? "").trim().toLowerCase();
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

export async function POST(req: Request) {
  try {
    const otpSecret = process.env.OTP_SECRET ?? "";
    if (!otpSecret) {
      return NextResponse.json(
        { ok: false, message: "Server OTP is not configured." },
        { status: 500 },
      );
    }

    const body = (await req.json()) as { email?: unknown; otp?: unknown };
    const email = normalizeEmail(body.email);
    const otp = String(body.otp ?? "").trim();
    if (!email || otp.length < 4) {
      return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
    }

    const otpId = otpDocId(email);
    const otpRef = doc(db, "admin_otp", otpId);
    const snap = await getDoc(otpRef);
    if (!snap.exists()) {
      return NextResponse.json({ ok: false, message: "OTP expired. Please resend." }, { status: 400 });
    }

    const data = snap.data() as {
      otpHash?: string;
      expiresAtMillis?: number;
      attempts?: number;
    };

    const attempts = data.attempts ?? 0;
    if (attempts >= 5) {
      return NextResponse.json(
        { ok: false, message: "Too many attempts. Please resend OTP." },
        { status: 429 },
      );
    }

    const now = Date.now();
    const expiresAt = data.expiresAtMillis ?? 0;
    if (expiresAt && now > expiresAt) {
      await deleteDoc(otpRef);
      return NextResponse.json({ ok: false, message: "OTP expired. Please resend." }, { status: 400 });
    }

    const expected = data.otpHash ?? "";
    const got = computeOtpHash(email, otp, otpSecret);
    if (!expected || expected !== got) {
      await setDoc(otpRef, { attempts: attempts + 1 }, { merge: true });
      return NextResponse.json({ ok: false, message: "Invalid OTP." }, { status: 400 });
    }

    await deleteDoc(otpRef);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to verify OTP.";
    console.error("[verify-otp] error:", message);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
