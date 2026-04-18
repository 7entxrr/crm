"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      className={
        className ??
        "inline-flex h-11 w-full items-center justify-center rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white shadow-sm shadow-rose-500/25 transition-colors hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-200"
      }
      type="button"
      onClick={async () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("clearlands_admin_session");
        }
        router.replace("/login");
      }}
    >
      Logout
    </button>
  );
}
