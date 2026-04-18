"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, KeyRound, Shield, UserCog } from "lucide-react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "../_components/ui";
import LogoutButton from "../_components/logout-button";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adminDocId, setAdminDocId] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [openPassword, setOpenPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("clearlands_admin_session");
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as { email?: string; name?: string } | null;
      queueMicrotask(() => {
        if (session?.email) setEmail(session.email);
        if (session?.name) {
          setName(session.name);
          setInitialName(session.name);
        }
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!email) return;
    const q = query(collection(db, "admin"), where("email", "==", email));
    const unsubscribe = onSnapshot(q, (snap) => {
      const doc = snap.docs[0];
      const data = doc
        ? (doc.data() as {
            name?: string;
            email?: string;
            password?: string;
            twoFactorEnabled?: boolean;
          })
        : null;
      setAdminDocId(doc?.id ?? null);
      if (data?.email) setEmail(data.email);
      if (data?.name) {
        setName(data.name);
        setInitialName(data.name);
      }
      setAdminPassword(data?.password ?? "");
      setTwoFactorEnabled(Boolean(data?.twoFactorEnabled));
    });
    return unsubscribe;
  }, [email]);

  const canSave = useMemo(() => {
    const trimmed = name.trim();
    return Boolean(email) && Boolean(trimmed) && trimmed !== initialName && !saving;
  }, [email, name, initialName, saving]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Settings</div>
        <div className="mt-1 text-sm text-slate-500">
          Manage your workspace preferences and security.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="text-sm font-semibold">Account</div>
            <div className="mt-1 text-xs text-slate-500">
              Profile details and access.
            </div>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Full Name
              </div>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                value={name}
                onChange={(e) => {
                  setSuccess(null);
                  setError(null);
                  setName(e.target.value);
                }}
              />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </div>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                defaultValue="Administrator"
                disabled
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </div>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                value={email}
                disabled
              />
            </div>
            {error ? (
              <div className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {success}
              </div>
            ) : null}
            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                disabled={saving}
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setName(initialName);
                }}
              >
                Cancel
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                disabled={!canSave}
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  setSaving(true);
                  try {
                    const trimmed = name.trim();
                    if (!adminDocId) {
                      setError("Admin profile not found.");
                      return;
                    }

                    await updateDoc(doc(db, "admin", adminDocId), { name: trimmed });

                    setInitialName(trimmed);
                    if (typeof window !== "undefined") {
                      const raw = window.localStorage.getItem("clearlands_admin_session");
                      const session = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
                      window.localStorage.setItem(
                        "clearlands_admin_session",
                        JSON.stringify({ ...session, email, name: trimmed }),
                      );
                    }
                    setSuccess("Saved");
                  } catch (err) {
                    const message =
                      err instanceof Error ? err.message : "Failed to save";
                    setError(message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">Security</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Password and access.
                  </div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Shield size={18} />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <button
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  type="button"
                  onClick={() => {
                    setPasswordError(null);
                    setPasswordSuccess(null);
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setOpenPassword(true);
                  }}
                >
                  Change Password
                  <KeyRound size={16} className="text-slate-500" />
                </button>

                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        Two-Factor Auth
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        If enabled, login requires OTP on email.
                      </div>
                    </div>
                    <button
                      type="button"
                      className={[
                        "h-6 w-11 rounded-full p-1 transition-colors",
                        twoFactorEnabled ? "bg-emerald-500" : "bg-slate-200",
                      ].join(" ")}
                      disabled={!adminDocId || saving}
                      onClick={async () => {
                        setError(null);
                        setSuccess(null);
                        if (!adminDocId) {
                          setError("Admin profile not found.");
                          return;
                        }
                        setSaving(true);
                        try {
                          const next = !twoFactorEnabled;
                          await updateDoc(doc(db, "admin", adminDocId), {
                            twoFactorEnabled: next,
                          });
                          setTwoFactorEnabled(next);
                          setSuccess(next ? "Two-factor enabled" : "Two-factor disabled");
                        } catch (err) {
                          const message =
                            err instanceof Error ? err.message : "Failed to update";
                          setError(message);
                        } finally {
                          setSaving(false);
                        }
                      }}
                      aria-label="Toggle two factor auth"
                    >
                      <div
                        className={[
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          twoFactorEnabled ? "translate-x-5" : "translate-x-0",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                </div>
                <LogoutButton />
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">Notifications</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Alerts and reminders.
                  </div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Bell size={18} />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { label: "Lead updates", on: true },
                  { label: "Task reminders", on: true },
                  { label: "Weekly summary", on: false },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-slate-800">
                      {row.label}
                    </div>
                    <div
                      className={[
                        "h-6 w-11 rounded-full p-1 transition-colors",
                        row.on ? "bg-emerald-500" : "bg-slate-200",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          row.on ? "translate-x-5" : "translate-x-0",
                        ].join(" ")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">Workspace</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Team and permissions.
                  </div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900/10 text-slate-700">
                  <UserCog size={18} />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Workspace Name
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    Clear Lands Admin
                  </div>
                </div>
                <button className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0b1220] px-4 text-sm font-semibold text-white hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-200">
                  Manage Roles
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {openPassword ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (passwordSaving) return;
              setOpenPassword(false);
            }}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold">Change Password</div>
                <div className="mt-1 text-xs text-slate-500">
                  Updates the admin password used for login.
                </div>
              </div>
              <button
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={() => {
                  if (passwordSaving) return;
                  setOpenPassword(false);
                }}
              >
                Close
              </button>
            </div>

            <form
              className="space-y-5 p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordError(null);
                setPasswordSuccess(null);
                if (!adminDocId) {
                  setPasswordError("Admin profile not found.");
                  return;
                }

                const oldTrim = oldPassword;
                const nextTrim = newPassword;
                if (!oldTrim || !nextTrim) {
                  setPasswordError("Please fill all fields.");
                  return;
                }
                if (oldTrim !== adminPassword) {
                  setPasswordError("Current password is incorrect.");
                  return;
                }
                if (nextTrim.length < 6) {
                  setPasswordError("New password must be at least 6 characters.");
                  return;
                }
                if (nextTrim !== confirmPassword) {
                  setPasswordError("New password and confirm password do not match.");
                  return;
                }
                if (nextTrim === oldTrim) {
                  setPasswordError("New password must be different.");
                  return;
                }

                setPasswordSaving(true);
                try {
                  await updateDoc(doc(db, "admin", adminDocId), {
                    password: nextTrim,
                  });
                  setAdminPassword(nextTrim);
                  setPasswordSuccess("Password updated successfully.");
                  setOldPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "Failed to update password";
                  setPasswordError(message);
                } finally {
                  setPasswordSaving(false);
                }
              }}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Current Password
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  New Password
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Confirm Password
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>

              {passwordError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {passwordError}
                </div>
              ) : null}
              {passwordSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {passwordSuccess}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  disabled={passwordSaving}
                  onClick={() => {
                    if (passwordSaving) return;
                    setOpenPassword(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={passwordSaving}
                >
                  {passwordSaving ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
