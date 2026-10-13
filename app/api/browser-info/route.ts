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

// Deteksi IP publik riil pengguna
async function resolveClientIp(request: Request): Promise<string> {
  const forwarded = request.headers.get("x-forwarded-for");
  let ip = forwarded ? forwarded.split(",")[0].trim() : null;

  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    const realIp = request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip");
    if (realIp && realIp !== "::1" && realIp !== "127.0.0.1") {
      ip = realIp;
    }
  }

  // Jika di localhost / private network, coba ambil IP publik riil via resolver eksternal dengan timeout 1.5 detik
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch("https://api.ipify.org?format=json", {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          ip = data.ip;
        }
      }
    } catch {
      // Fallback aman jika offline
      ip = ip || "127.0.0.1";
    }
  }

  return ip || "127.0.0.1";
}

export async function GET(request: Request) {
  const ip = await resolveClientIp(request);
  const userAgent = request.headers.get("user-agent") || "";
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from("browser_profiles")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const profile = data[0];
      return NextResponse.json({
        success: true,
        ipAddress: ip || profile.ip_address,
        userAgent: userAgent || profile.user_agent,
        systemOs: profile.system_os,
        lastActive: profile.last_active || profile.updated_at,
        extensionInstalled: Boolean(profile.extension_installed),
        extensionVersion: profile.extension_version || null,
        tableExists: true,
      });
    }
  } catch {
    // Tabel belum dibuat di Supabase
  }

  // Fallback jika tabel belum ada di Supabase
  return NextResponse.json({
    success: true,
    ipAddress: ip,
    userAgent,
    lastActive: new Date().toISOString(),
    extensionInstalled: false,
    tableExists: false,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resolvedIp = await resolveClientIp(request);
    const ipAddress = body.ipAddress || resolvedIp;
    const userAgent = body.userAgent || request.headers.get("user-agent") || "";
    const systemOs = body.systemOs || "Windows";
    const extensionInstalled = Boolean(body.extensionInstalled);
    const extensionVersion = body.extensionVersion || "2.1.0";
    const lastActive = body.lastActive || new Date().toISOString();

    const supabase = getSupabase();

    // Cek apakah ada record yang sudah ada
    const { data: existing } = await supabase
      .from("browser_profiles")
      .select("id")
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("browser_profiles")
        .update({
          user_agent: userAgent,
          system_os: systemOs,
          ip_address: ipAddress,
          extension_installed: extensionInstalled,
          extension_version: extensionVersion,
          last_active: lastActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);
    } else {
      await supabase.from("browser_profiles").insert({
        user_agent: userAgent,
        system_os: systemOs,
        ip_address: ipAddress,
        extension_installed: extensionInstalled,
        extension_version: extensionVersion,
        last_active: lastActive,
      });
    }

    return NextResponse.json({
      success: true,
      ipAddress,
      lastActive,
      extensionInstalled,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Gagal menyimpan info browser" },
      { status: 200 }
    );
  }
}
