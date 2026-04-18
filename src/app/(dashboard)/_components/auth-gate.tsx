"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserAnalytics } from "@/lib/firebase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const redirectTo = useMemo(() => {
    if (!pathname) return "/login";
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `/login?next=${encodeURIComponent(path)}`;
  }, [pathname]);

  useEffect(() => {
    void getBrowserAnalytics();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const raw = window.localStorage.getItem("evohus_admin_session");
      setSignedIn(Boolean(raw));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!signedIn) router.replace(redirectTo);
  }, [ready, signedIn, router, redirectTo]);

  if (!ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!signedIn) return null;
  return children;
}
