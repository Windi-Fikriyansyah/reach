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

export type FacebookGroupRecord = {
  id: string; // group_id (e.g. "12345678" or slug)
  name: string;
  url: string;
  image?: string | null;
  privacy?: string;
  members?: string | null;
};

// GET: Ambil daftar seluruh grup yang tersimpan di database
export async function GET() {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from("facebook_groups")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      const isMissing = error.code === "PGRST205" || error.message.includes("schema cache");
      return NextResponse.json({
        success: !isMissing,
        tableMissing: isMissing,
        groups: [],
        error: error.message,
      });
    }

    const groups: FacebookGroupRecord[] = (data || []).map((row) => ({
      id: row.group_id,
      name: row.name,
      url: row.url,
      image: row.image_url || null,
      privacy: row.privacy || "Public",
      members: row.members_count || null,
    }));

    return NextResponse.json({
      success: true,
      tableMissing: false,
      total: groups.length,
      groups,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      tableMissing: false,
      groups: [],
      error: err instanceof Error ? err.message : "Terjadi kesalahan server",
    });
  }
}

// POST: Simpan atau perbarui (upsert) grup hasil scrape ke database
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const rawGroups = Array.isArray(body.groups) ? body.groups : [];

    if (rawGroups.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "Tidak ada grup untuk disimpan",
      });
    }

    const now = new Date().toISOString();
    const rows = rawGroups
      .filter((g: any) => g && (g.id || g.group_id) && g.name)
      .map((g: any) => {
        const groupId = String(g.id || g.group_id).trim();
        return {
          group_id: groupId,
          name: String(g.name).trim(),
          url: g.url ? String(g.url).trim() : `https://www.facebook.com/groups/${groupId}`,
          image_url: g.image || g.image_url || null,
          privacy: g.privacy || "Public",
          members_count: g.members || g.members_count || null,
          last_scraped_at: now,
          updated_at: now,
        };
      });

    let { data, error } = await supabase
      .from("facebook_groups")
      .upsert(rows, { onConflict: "group_id" })
      .select("group_id, name");

    // Fallback jika database Supabase pengguna belum menambahkan kolom members_count
    if (error && (error.message?.includes("members_count") || error.code === "PGRST204")) {
      const fallbackRows = rows.map((row: Record<string, any>) => {
        const { members_count: _, ...rest } = row;
        return rest;
      });
      const retryResult = await supabase
        .from("facebook_groups")
        .upsert(fallbackRows, { onConflict: "group_id" })
        .select("group_id, name");
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      const isMissing = error.code === "PGRST205" || error.message.includes("schema cache");
      if (isMissing) {
        return NextResponse.json({
          success: true,
          tableMissing: true,
          count: rows.length,
          warning: "Tabel facebook_groups belum ada di database Supabase. Jalankan skrip di supabase/schema.sql untuk mengaktifkannya.",
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      tableMissing: false,
      savedCount: (data || []).length || rows.length,
      message: `Berhasil menyimpan ${rows.length} grup Facebook ke database`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal menyimpan grup ke database",
      },
      { status: 500 }
    );
  }
}
