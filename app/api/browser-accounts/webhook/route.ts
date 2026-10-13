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

/**
 * Webhook endpoint yang dipanggil oleh Ekstensi
 * ketika mendeteksi pengguna logout dari Facebook atau Instagram.
 */
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { event, platform } = body;

    if (event === "logout" && platform) {
      // Perbarui status akun di Supabase menjadi is_connected = false
      const { error } = await supabase
        .from("browser_social_accounts")
        .update({
          is_connected: false,
          updated_at: new Date().toISOString(),
        })
        .ilike("platform", platform);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Status koneksi ${platform} berhasil dinonaktifkan di Supabase (Logout Event).`,
        platform,
      });
    }

    return NextResponse.json({ success: false, error: "Event tidak dikenali" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan webhook" },
      { status: 500 }
    );
  }
}
