import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (u, opts) => fetch(u, { ...opts, cache: "no-store" }),
    },
  });
}

export type Campaign = {
  id: string;
  name: string;
  platform: "Facebook" | "Instagram";
  type: string;
  status: "active" | "paused" | "completed" | "draft";
  targetAudience: string;
  dailyLimit: number;
  totalLeads: number;
  messagesSent: number;
  repliedCount: number;
  messageTemplate?: string;
  createdAt: string;
  updatedAt: string;
};

function mapRowToCampaign(row: any): Campaign {
  return {
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
  };
}

export async function GET() {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      const isMissing = error.code === "PGRST205" || error.message.includes("schema cache");
      return NextResponse.json({
        success: !isMissing,
        tableMissing: isMissing,
        campaigns: [],
        error: error.message,
      });
    }

    const campaigns = (data || []).map(mapRowToCampaign);

    return NextResponse.json({
      success: true,
      tableMissing: false,
      campaigns,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      tableMissing: false,
      campaigns: [],
      error: err instanceof Error ? err.message : "Terjadi kesalahan server",
    });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // 1. Buat Campaign baru
    if (body.action === "create") {
      const newCampaignData = {
        name: body.name || "Campaign Tanpa Judul",
        platform: body.platform || "Facebook",
        type: body.type || "Group Members Outreach",
        status: body.status || "active",
        target_audience: body.targetAudience || "Public Audience",
        daily_limit: Number(body.dailyLimit) || 50,
        total_leads: Number(body.totalLeads) || 0,
        messages_sent: 0,
        replied_count: 0,
        message_template: body.messageTemplate || "",
      };

      const { data, error } = await supabase
        .from("campaigns")
        .insert(newCampaignData)
        .select()
        .single();

      if (error) {
        const isMissing = error.code === "PGRST205" || error.message.includes("schema cache");
        // Jika tabel belum dibuat di Supabase, kembalikan objek dengan id acak agar client bisa fallback ke state/storage
        if (isMissing) {
          const fallbackCampaign: Campaign = {
            id: crypto.randomUUID(),
            name: newCampaignData.name,
            platform: newCampaignData.platform as "Facebook" | "Instagram",
            type: newCampaignData.type,
            status: newCampaignData.status as "active" | "paused",
            targetAudience: newCampaignData.target_audience,
            dailyLimit: newCampaignData.daily_limit,
            totalLeads: newCampaignData.total_leads,
            messagesSent: 0,
            repliedCount: 0,
            messageTemplate: newCampaignData.message_template,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return NextResponse.json({
            success: true,
            tableMissing: true,
            campaign: fallbackCampaign,
            warning: "Tabel campaigns belum ada di Supabase, disimpan ke sesi lokal.",
          });
        }
        throw error;
      }

      return NextResponse.json({
        success: true,
        tableMissing: false,
        campaign: mapRowToCampaign(data),
      });
    }

    // 2. Toggle Status (Active <-> Paused)
    if (body.action === "toggleStatus" && body.id) {
      const nextStatus = body.status === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("campaigns")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", body.id);

      if (error) {
        const isMissing = error.code === "PGRST205" || error.message.includes("schema cache");
        return NextResponse.json({
          success: true,
          tableMissing: isMissing,
          nextStatus,
        });
      }

      return NextResponse.json({
        success: true,
        tableMissing: false,
        nextStatus,
      });
    }

    // 3. Hapus Campaign
    if (body.action === "delete" && body.id) {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", body.id);

      return NextResponse.json({
        success: true,
        tableMissing: Boolean(error && error.code === "PGRST205"),
        deletedId: body.id,
      });
    }

    return NextResponse.json({ success: false, error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal memproses permintaan" },
      { status: 500 }
    );
  }
}
