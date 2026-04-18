"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AdminSession = { email?: string; name?: string } | null;

function readSession(): AdminSession {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("clearlands_admin_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export default function AdminIdentity() {
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");

  useEffect(() => {
    queueMicrotask(() => {
      const session = readSession();
      setEmail(session?.email ?? "");
      setName(session?.name ?? "");
    });
  }, []);

  useEffect(() => {
    if (!email) return;
    const q = query(collection(db, "admin"), where("email", "==", email));
    const unsubscribe = onSnapshot(q, (snap) => {
      const doc = snap.docs[0];
      const data = doc ? (doc.data() as { name?: string }) : null;
      if (data?.name) setName(data.name);
    });
    return unsubscribe;
  }, [email]);

  return (
    <div className="hidden leading-tight sm:block">
      <div className="text-sm font-semibold text-slate-900">
        {name || email || "Admin"}
      </div>
      <div className="text-xs text-slate-500">Administrator</div>
    </div>
  );
}
