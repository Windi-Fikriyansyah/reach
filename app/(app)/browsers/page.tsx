import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import BrowsersClient, { type SocialAccount } from "./browsers-client";


export const metadata: Metadata = {
  title: "Browsers — ReachOwl",
  description: "Pengelolaan profil browser dan akun sosial terhubung langsung dari Supabase",
};

async function getInitialData(): Promise<{ accounts: SocialAccount[]; tableMissing: boolean }> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        auth: { persistSession: false },
        global: {
          fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
        },
      }
    );

    const { data, error } = await supabase
      .from("browser_social_accounts")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      const isMissing = error.code === "PGRST205" || error.message.includes("schema cache");
      return { accounts: [], tableMissing: isMissing };
    }

    const accounts: SocialAccount[] = (data || []).map((row: any) => {
      let avatar = row.avatar_url;
      if (!avatar || avatar.includes("unsplash.com") || avatar.includes("graph.facebook.com")) {
        if (row.platform === "Facebook" && row.account_id) {
          avatar = `/api/avatar-proxy?fbId=${row.account_id}`;
        } else {
          avatar = null;
        }
      }

      return {
        id: row.id,
        name: row.name || `Akun ${row.platform}`,
        platform: row.platform,
        avatarUrl: avatar,
      lastLoggedIn: row.last_logged_in,
      isConnected: Boolean(row.is_connected),
      isPrimary: Boolean(row.is_primary),
      accountId: row.account_id,
        intervalWarmup: {
          minIntervalSeconds: row.min_interval_seconds ?? 30,
          maxIntervalSeconds: row.max_interval_seconds ?? 60,
          warmupActive: row.warmup_active ?? true,
        },
      };
    });

    return { accounts, tableMissing: false };
  } catch {
    return { accounts: [], tableMissing: false };
  }
}

const defaultUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

async function BrowsersDataLoader() {
  await connection();
  const { accounts, tableMissing } = await getInitialData();

  return (
    <BrowsersClient
      initialAccounts={accounts}
      initialTableMissing={tableMissing}
      userAgentStr={defaultUserAgent}
    />
  );
}

export default function BrowsersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-10 w-48 bg-ink/10 rounded-sm animate-pulse" />
          <div className="h-64 bg-white border border-ink/10 rounded-[4px] animate-pulse" />
        </div>
      }
    >
      <BrowsersDataLoader />
    </Suspense>
  );
}
