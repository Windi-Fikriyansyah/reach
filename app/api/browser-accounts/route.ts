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

export type SocialAccount = {
  id: string;
  name: string;
  platform: "Facebook" | "Instagram";
  avatarUrl?: string;
  lastLoggedIn: string | null;
  isConnected: boolean;
  isPrimary: boolean;
  accountId?: string | null;
  intervalWarmup: {
    minIntervalSeconds: number;
    maxIntervalSeconds: number;
    warmupActive: boolean;
  };
};

function mapRowToAccount(row: any): SocialAccount {
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
}

export async function GET() {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("browser_social_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    const isTableMissing = error.code === "PGRST205" || error.message.includes("schema cache");
    return NextResponse.json({
      success: false,
      error: error.message,
      tableMissing: isTableMissing,
      accounts: [],
      totalConnected: 0,
      maxLimit: 5,
    });
  }

  const accounts = (data || []).map(mapRowToAccount);

  return NextResponse.json({
    success: true,
    accounts,
    totalConnected: accounts.filter((a) => a.isConnected).length,
    maxLimit: 5,
  });
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    // 1. Sinkronisasi dari Chrome Extension
    if (body.accounts && Array.isArray(body.accounts)) {
      for (const incoming of body.accounts) {
        if (!incoming.platform) continue;

        // Jalur sinkronisasi HANYA boleh menandai akun sebagai terhubung.
        // Status terputus hanya lewat webhook logout atau toggle manual,
        // agar scan saat cookie Facebook sedang dirotasi tidak menimpa status menjadi false.
        if (!incoming.isLoggedIn) continue;

        const { data: existing } = await supabase
          .from("browser_social_accounts")
          .select("id, name")
          .ilike("platform", incoming.platform)
          .limit(1);

        if (existing && existing.length > 0) {
          const updatePayload: any = {
            is_connected: Boolean(incoming.isLoggedIn),
            updated_at: new Date().toISOString(),
          };

          if (incoming.isLoggedIn) {
            updatePayload.last_logged_in = incoming.lastLoggedIn || new Date().toISOString();
            if (incoming.accountId) {
              updatePayload.account_id = incoming.accountId;
            }
            if (incoming.name && !incoming.name.startsWith("Akun ")) {
              updatePayload.name = incoming.name;
            }
            if (incoming.avatarUrl) {
              updatePayload.avatar_url = incoming.avatarUrl;
            }
          }

          await supabase
            .from("browser_social_accounts")
            .update(updatePayload)
            .eq("id", existing[0].id);
        } else {
          // Buat baris baru di Supabase jika belum ada
          await supabase.from("browser_social_accounts").insert({
            platform: incoming.platform,
            name: incoming.name || `Akun ${incoming.platform}`,
            avatar_url: incoming.avatarUrl || null,
            is_connected: Boolean(incoming.isLoggedIn),
            last_logged_in: incoming.isLoggedIn
              ? incoming.lastLoggedIn || new Date().toISOString()
              : null,
            account_id: incoming.accountId || null,
          });
        }
      }
    }

    // 2. Toggle Primary
    if (body.action === "togglePrimary" && body.id) {
      const { data: current } = await supabase
        .from("browser_social_accounts")
        .select("is_primary")
        .eq("id", body.id)
        .single();

      if (current) {
        await supabase
          .from("browser_social_accounts")
          .update({ is_primary: !current.is_primary, updated_at: new Date().toISOString() })
          .eq("id", body.id);
      }
    }

    // 3. Toggle Connection manual
    if (body.action === "toggleConnection" && body.id) {
      const { data: current } = await supabase
        .from("browser_social_accounts")
        .select("is_connected")
        .eq("id", body.id)
        .single();

      if (current) {
        const nextState = !current.is_connected;
        await supabase
          .from("browser_social_accounts")
          .update({
            is_connected: nextState,
            last_logged_in: nextState ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.id);
      }
    }

    // 4. Update Interval & Warmup
    if (body.action === "updateWarmup" && body.id && body.warmup) {
      await supabase
        .from("browser_social_accounts")
        .update({
          min_interval_seconds: body.warmup.minIntervalSeconds,
          max_interval_seconds: body.warmup.maxIntervalSeconds,
          warmup_active: body.warmup.warmupActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.id);
    }

    // Ambil state terbaru dari Supabase
    const { data: freshData } = await supabase
      .from("browser_social_accounts")
      .select("*")
      .order("created_at", { ascending: true });

    const accounts = (freshData || []).map(mapRowToAccount);

    return NextResponse.json({
      success: true,
      accounts,
      totalConnected: accounts.filter((a) => a.isConnected).length,
      maxLimit: 5,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan server" },
      { status: 400 }
    );
  }
}
