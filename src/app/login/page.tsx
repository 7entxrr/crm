"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getBrowserAnalytics } from "@/lib/firebase";
import { db } from "@/lib/firebase";

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function friendlyError(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Network error. Please try again.",
    );
  }

  const text = await res.text();
  const data = (() => {
    try {
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return null;
    }
  })();

  if (!res.ok) {
    const msgFromJson =
      data && typeof data === "object" && "message" in data
        ? String((data as { message?: unknown }).message ?? "")
        : "";
    const msgFromText = !msgFromJson && text ? text.slice(0, 240) : "";
    const message =
      msgFromJson || msgFromText || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return (data ?? {}) as T;
}

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState<string>("");
  const [pendingName, setPendingName] = useState<string>("");

  useEffect(() => {
    void getBrowserAnalytics();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextParam = new URLSearchParams(window.location.search).get("next");
    if (!nextParam) return;
    try {
      const decoded = decodeURIComponent(nextParam);
      setNextPath(decoded.startsWith("/") ? decoded : "/");
    } catch {
      setNextPath("/");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("clearlands_admin_session");
    if (raw) router.replace(nextPath);
  }, [router, nextPath]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("clearlands_pending_otp");
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as { email?: string; name?: string; next?: string } | null;
      const pendingEmail = normalizeEmail(pending?.email ?? "");
      if (!pendingEmail) return;
      setEmail(pendingEmail);
      setOtpSentTo(pendingEmail);
      setPendingName(pending?.name ?? "");
      setAwaitingOtp(true);
    } catch {
      window.localStorage.removeItem("clearlands_pending_otp");
    }
  }, [router, nextPath]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-[#f4f6fb] to-slate-50 text-slate-900">
      <div className="grid min-h-screen w-full lg:grid-cols-[1fr_520px]">
        <div className="relative hidden overflow-hidden bg-[#0b1220] text-slate-200 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),rgba(255,255,255,0)_55%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.18),rgba(255,255,255,0)_55%)]" />
          <div className="relative flex h-full flex-col p-10">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <LogoMark />
              </div>
              <div className="text-sm font-semibold tracking-wide">
                Clear Lands
              </div>
            </div>

            <div className="mt-10 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100">
                Admin Dashboard
              </div>
              <div className="mt-6 text-4xl font-semibold tracking-tight text-white">
                Everything your team needs in one place
              </div>
              <div className="mt-4 text-sm text-slate-300">
                Secure access with admin login. Stay signed in on this device
                until you logout.
              </div>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
              {[
                { label: "Employees", value: "Directory + roles" },
                { label: "Leads", value: "Pipeline tracking" },
                { label: "Customer", value: "Engagement overview" },
                { label: "Analyse", value: "Insights + trends" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                >
                  <div className="text-sm font-semibold text-white">
                    {f.label}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">{f.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-10">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Today
                </div>
                <div className="mt-4 grid grid-cols-12 items-end gap-2">
                  {[10, 24, 16, 30, 22, 38, 26, 44, 32, 52, 40, 60].map((h, i) => (
                    <div
                      key={i}
                      className="col-span-1 rounded-lg bg-gradient-to-t from-emerald-500/35 to-blue-400/20"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="mt-4 text-sm font-semibold text-white">
                  +14.2% lead growth
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  Compared to last month
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:border-l lg:border-white/10">
          <div className="w-full max-w-md">
            <div className="mb-6 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0b1220] text-white">
                  <LogoMark />
                </div>
                <div className="text-sm font-semibold tracking-wide">
                  Clear Lands Admin
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.10)] sm:p-8">
              <div className="text-2xl font-semibold tracking-tight">Login</div>
              <div className="mt-1 text-sm text-slate-500">
                Enter your credentials to continue.
              </div>

              <form
                className="mt-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setSubmitting(true);
                  try {
                    const trimmedEmail = email.trim();
                    const normalized = normalizeEmail(trimmedEmail);
                    if (!normalized) {
                      setError("Enter email");
                      return;
                    }

                    if (awaitingOtp) {
                      const cleanOtp = otp.replace(/\s+/g, "");
                      if (cleanOtp.length < 4) {
                        setError("Enter OTP");
                        return;
                      }
                      await postJson<{ ok: boolean; message?: string }>("/api/auth/verify-otp", {
                        email: normalized,
                        otp: cleanOtp,
                      });
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(
                          "clearlands_admin_session",
                          JSON.stringify({
                            email: normalized,
                            name: pendingName,
                            createdAt: Date.now(),
                          }),
                        );
                        window.localStorage.removeItem("clearlands_pending_otp");
                      }
                      router.replace(nextPath);
                      return;
                    }

                    const trimmedPassword = password;
                    if (!trimmedPassword) {
                      setError("Enter password");
                      return;
                    }

                    const adminQuery = query(
                      collection(db, "admin"),
                      where("email", "==", normalized),
                    );
                    const adminSnap = await getDocs(adminQuery);
                    const adminDoc = adminSnap.docs[0];
                    const adminData = adminDoc
                      ? (adminDoc.data() as {
                          password?: string;
                          name?: string;
                          twoFactorEnabled?: boolean;
                        })
                      : null;
                    const adminPassword = adminData?.password ?? "";
                    if (!adminDoc || adminPassword !== trimmedPassword) {
                      setError("Invalid login details");
                      return;
                    }

                    const twoFactorEnabled = Boolean(adminData?.twoFactorEnabled);
                    if (twoFactorEnabled) {
                      await postJson<{ ok: boolean; expiresInSec?: number; message?: string }>(
                        "/api/auth/send-otp",
                        { email: normalized },
                      );
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(
                          "clearlands_pending_otp",
                          JSON.stringify({
                            email: normalized,
                            name: adminData?.name ?? "",
                            next: nextPath,
                            createdAt: Date.now(),
                          }),
                        );
                      }
                      setPendingName(adminData?.name ?? "");
                      setAwaitingOtp(true);
                      setOtpSentTo(normalized);
                      setPassword("");
                      setOtp("");
                      return;
                    }

                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(
                        "clearlands_admin_session",
                        JSON.stringify({
                          email: normalized,
                          name: adminData?.name ?? "",
                          createdAt: Date.now(),
                        }),
                      );
                    }

                    router.replace(nextPath);
                  } catch (err) {
                    setError(friendlyError(err));
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </div>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    disabled={awaitingOtp}
                    required
                  />
                </div>

                {!awaitingOtp ? (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Password
                    </div>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      OTP
                    </div>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                      placeholder="Enter 6 digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      inputMode="numeric"
                      required
                    />
                  </div>
                )}
                {awaitingOtp ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    Two-factor enabled. OTP sent to {otpSentTo}.
                    <div className="mt-1 text-xs font-semibold text-emerald-700/80">
                      Check inbox/spam. OTP expires in 10 minutes.
                    </div>
                  </div>
                ) : null}



                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {error}
                  </div>
                ) : null}

                <button
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Please wait..." : awaitingOtp ? "Verify OTP" : "Sign In"}
                </button>

                {awaitingOtp ? (
                  <button
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      setError(null);
                      setSubmitting(true);
                      try {
                        const normalized = normalizeEmail(email);
                        await postJson<{ ok: boolean; message?: string }>("/api/auth/send-otp", {
                          email: normalized,
                        });
                        setOtpSentTo(normalized);
                      } catch (err) {
                        setError(friendlyError(err));
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    Resend OTP
                  </button>
                ) : null}
              </form>

              <div className="mt-6 text-center text-xs text-slate-500">
                If you don’t have an account, create one in Firebase Auth users.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 12.3 12 5l8 7.3v8.7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8.7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 21V14a2.5 2.5 0 0 1 5 0v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
