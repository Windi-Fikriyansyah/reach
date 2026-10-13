"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await createClient().auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      id="logout-button"
      onClick={handleLogout}
      disabled={loading}
      className="h-9 rounded-[3px] border border-ink/20 px-3 text-sm text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:opacity-60"
    >
      {loading ? "Keluar…" : "Keluar"}
    </button>
  );
}
