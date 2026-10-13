import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import CampaignsClient from "./campaigns-client";
import type { Campaign } from "@/app/api/campaigns/route";

export const metadata: Metadata = {
  title: "Campaigns — ReachOwl",
  description: "Kelola dan otomatisasi kampanye outreach Facebook & Instagram secara terarah",
};

async function getInitialCampaigns(): Promise<{ campaigns: Campaign[]; tableMissing: boolean }> {
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
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      const isMissing = error.code === "PGRST205" || error.message.includes("schema cache");
      return { campaigns: [], tableMissing: isMissing };
    }

    const campaigns: Campaign[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      platform: row.platform,
      type: row.type || "Group Members Outreach",
      status: row.status || "active",
      targetAudience: row.target_audience || "Public Audience",
      dailyLimit: row.daily_limit ?? 50,
      totalLeads: row.total_leads ?? 0,
      messagesSent: row.messages_sent ?? 0,
      repliedCount: row.replied_count ?? 0,
      messageTemplate: row.message_template || "",
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }));

    return { campaigns, tableMissing: false };
  } catch {
    return { campaigns: [], tableMissing: false };
  }
}

async function CampaignsDataLoader() {
  await connection();
  const { campaigns, tableMissing } = await getInitialCampaigns();

  return (
    <CampaignsClient
      initialCampaigns={campaigns}
      initialTableMissing={tableMissing}
    />
  );
}

export default function CampaignsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-10 w-48 bg-ink/10 rounded-sm animate-pulse" />
          <div className="h-72 bg-white border border-ink/10 rounded-[4px] animate-pulse" />
        </div>
      }
    >
      <CampaignsDataLoader />
    </Suspense>
  );
}
