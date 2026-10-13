"use client";

import { useEffect, useState, useTransition } from "react";
import {
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Puzzle,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Globe,
  Sliders,
  X,
  Database,
  Copy,
  Check,
} from "lucide-react";
import { serif } from "@/lib/fonts";

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

interface BrowsersClientProps {
  initialAccounts: SocialAccount[];
  initialTableMissing?: boolean;
  userAgentStr: string;
}

const SQL_SCHEMA_SNIPPET = `-- Jalankan di Supabase Dashboard -> SQL Editor:
CREATE TABLE IF NOT EXISTS public.browser_social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Akun Pengguna',
    platform TEXT NOT NULL CHECK (platform IN ('Facebook', 'Instagram')),
    avatar_url TEXT,
    account_id TEXT,
    last_logged_in TIMESTAMPTZ,
    is_connected BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    min_interval_seconds INTEGER DEFAULT 30,
    max_interval_seconds INTEGER DEFAULT 60,
    warmup_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.browser_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_agent TEXT NOT NULL,
    browser_name TEXT DEFAULT 'Chrome',
    system_os TEXT DEFAULT 'Windows',
    ip_address TEXT,
    extension_installed BOOLEAN DEFAULT FALSE,
    extension_version TEXT DEFAULT '2.1.0',
    last_active TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.browser_social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all browser_social_accounts" ON public.browser_social_accounts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.browser_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all browser_profiles" ON public.browser_profiles FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.browser_social_accounts (name, platform, is_connected, is_primary)
VALUES 
  ('Akun Facebook', 'Facebook', false, false),
  ('Akun Instagram', 'Instagram', false, false);`;

export default function BrowsersClient({
  initialAccounts,
  initialTableMissing = false,
  userAgentStr,
}: BrowsersClientProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>(initialAccounts);
  const [tableMissing, setTableMissing] = useState(initialTableMissing);
  const [userAgent, setUserAgent] = useState(userAgentStr);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState<string>("Mendeteksi...");
  const [lastActive, setLastActive] = useState<string | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [selectedWarmupAccount, setSelectedWarmupAccount] = useState<SocialAccount | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectNotice, setConnectNotice] = useState<string | null>(null);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  // Deteksi sistem operasi dari user agent
  const getSystemOS = (ua: string) => {
    if (ua.includes("Win")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    return "Desktop System";
  };

  const systemOS = getSystemOS(userAgent);

  // Helper format tampilan Last active riil
  const formatLastActive = (dateStr: string | null) => {
    if (!dateStr) return "Baru saja";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Baru saja";
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 1) return "Baru saja";
      if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
      return (
        d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }) +
        " " +
        d.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return "Baru saja";
    }
  };

  // Ambil IP riil dan data profil browser dari server
  const fetchBrowserProfile = async () => {
    try {
      const res = await fetch("/api/browser-info", { cache: "no-store" });
      const data = await res.json();
      if (data && data.success) {
        if (data.ipAddress) setIpAddress(data.ipAddress);
        if (data.lastActive) setLastActive(data.lastActive);
        if (data.extensionInstalled) setExtensionDetected(true);
        if (data.extensionVersion) setExtensionVersion(data.extensionVersion);
      }
    } catch {
      setIpAddress("127.0.0.1");
    }
  };

  // Simpan data profil browser ke Supabase
  const saveBrowserProfile = async (extActive: boolean, version?: string) => {
    try {
      await fetch("/api/browser-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extensionInstalled: extActive,
          extensionVersion: version || "2.1.0",
          userAgent: typeof window !== "undefined" ? window.navigator.userAgent : userAgent,
          systemOs: getSystemOS(typeof window !== "undefined" ? window.navigator.userAgent : userAgent),
          lastActive: new Date().toISOString(),
        }),
      });
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.navigator?.userAgent) {
      setUserAgent(window.navigator.userAgent);
    }
    // Sinkronisasi data akun & info browser riil saat komponen dimount
    fetchAccounts();
    fetchBrowserProfile();

    // Kirim PING ke ekstensi untuk deteksi handshake instan
    window.postMessage({ type: "REACHOWL_PING" }, "*");
    const pingTimer1 = setTimeout(() => {
      window.postMessage({ type: "REACHOWL_PING" }, "*");
    }, 400);
    const pingTimer2 = setTimeout(() => {
      window.postMessage({ type: "REACHOWL_PING" }, "*");
    }, 1200);

    return () => {
      clearTimeout(pingTimer1);
      clearTimeout(pingTimer2);
    };
  }, []);

  // Ambil data terbaru langsung dari database Supabase melalui API
  const fetchAccounts = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/browser-accounts", { cache: "no-store" });
      const data = await res.json();
      if (data && data.accounts) {
        setAccounts(data.accounts);
        setTableMissing(Boolean(data.tableMissing));
      }
    } catch (err) {
      console.error("Gagal memperbarui data dari Supabase:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Komunikasi realtime dengan Headless Chrome Extension via window messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data) return;

      // 1. Ekstensi bridge terdeteksi aktif via Ping/Pong atau Ready broadcast
      if (
        event.data.type === "REACHOWL_BRIDGE_READY" ||
        event.data.type === "REACHOWL_EXTENSION_READY" ||
        event.data.type === "REACHOWL_PONG"
      ) {
        setExtensionDetected(true);
        setLastActive(new Date().toISOString());
        if (event.data.version) {
          setExtensionVersion(event.data.version);
        }
        saveBrowserProfile(true, event.data.version);
      }

      // 2. Menerima hasil pengecekan ON-DEMAND saat tombol Connect diklik
      if (event.data.type === "REACHOWL_ON_DEMAND_CHECK_RESULT") {
        setExtensionDetected(true);
        setLastActive(new Date().toISOString());
        if ((window as any).__reachowl_timer) {
          clearTimeout((window as any).__reachowl_timer);
        }

        const result = event.data.result;
        if (result && result.isLoggedIn) {
          setConnectNotice(`Sesi ${result.platform} terverifikasi! Menyimpan ke database Supabase...`);

          // Update state UI secara instan (optimistic)
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.platform.toLowerCase() === result.platform.toLowerCase()
                ? {
                    ...acc,
                    isConnected: true,
                    accountId: result.accountId || acc.accountId,
                    name: result.name || acc.name,
                    avatarUrl: result.avatarUrl || acc.avatarUrl,
                    lastLoggedIn: result.lastLoggedIn || new Date().toISOString(),
                  }
                : acc
            )
          );

          // Simpan status aktif ke Supabase
          try {
            const res = await fetch("/api/browser-accounts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accounts: [result] }),
            });
            const synced = await res.json();
            if (synced && synced.accounts) {
              setAccounts(synced.accounts);
            }
          } catch {
            fetchAccounts();
          } finally {
            setConnectingId(null);
            setTimeout(() => setConnectNotice(null), 3000);
          }
        } else if (result && !result.isLoggedIn) {
          // Akun belum login di browser: tampilkan pemberitahuan tanpa redirect paksa
          setConnectNotice(
            `Browser Anda belum login ke ${result.platform}. Silakan login ke ${result.platform} di browser terlebih dahulu.`
          );
          setConnectingId(null);
          setTimeout(() => setConnectNotice(null), 4000);
        }
      }

      // 3. Menerima sinyal WEBHOOK LOGOUT dari ekstensi saat user logout di FB / IG
      if (event.data.type === "REACHOWL_ACCOUNT_LOGGED_OUT_EVENT") {
        const loggedOutPlatform = event.data.platform;
        setConnectNotice(
          `Terdeteksi Logout pada ${loggedOutPlatform}. Status akun dinonaktifkan di Supabase.`
        );

        setAccounts((prev) =>
          prev.map((acc) =>
            acc.platform.toLowerCase() === loggedOutPlatform.toLowerCase()
              ? { ...acc, isConnected: false }
              : acc
          )
        );

        setTimeout(() => setConnectNotice(null), 4000);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleRefresh = () => {
    fetchAccounts();
    fetchBrowserProfile();
    window.postMessage({ type: "REACHOWL_PING" }, "*");
  };

  // Toggle Primary status langsung ke Supabase
  const handleTogglePrimary = async (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, isPrimary: !acc.isPrimary } : acc))
    );

    startTransition(async () => {
      const res = await fetch("/api/browser-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "togglePrimary", id }),
      });
      const data = await res.json();
      if (data && data.accounts) {
        setAccounts(data.accounts);
      }
    });
  };

  // Handler Tombol "Connect": HANYA dicek saat tombol ini diklik
  const handleConnectAccount = async (account: SocialAccount) => {
    if (account.isConnected) {
      // Jika sudah terhubung, klik untuk disconnect manual
      handleToggleConnection(account.id);
      return;
    }

    setConnectingId(account.id);
    setConnectNotice(`Mengecek sesi ${account.platform} di browser...`);

    // Kirim permintaan ON-DEMAND ke ekstensi untuk platform ini saja
    window.postMessage(
      {
        type: "REACHOWL_ON_DEMAND_CHECK_PLATFORM",
        platform: account.platform,
      },
      "*"
    );

    // Batas waktu jika ekstensi belum merespons
    const timer = setTimeout(() => {
      setConnectingId(null);
      setConnectNotice(
        `Ekstensi sedang memverifikasi atau belum merespons. Pastikan ekstensi aktif di chrome://extensions/`
      );
      setTimeout(() => setConnectNotice(null), 3000);
    }, 4000);

    (window as any).__reachowl_timer = timer;
  };

  // Toggle Connection status langsung ke Supabase
  const handleToggleConnection = async (id: string) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id
          ? {
              ...acc,
              isConnected: !acc.isConnected,
              lastLoggedIn: !acc.isConnected ? new Date().toISOString() : acc.lastLoggedIn,
            }
          : acc
      )
    );

    startTransition(async () => {
      const res = await fetch("/api/browser-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleConnection", id }),
      });
      const data = await res.json();
      if (data && data.accounts) {
        setAccounts(data.accounts);
      }
    });
  };

  // Simpan pengaturan Interval & Warmup ke Supabase
  const handleSaveWarmup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedWarmupAccount) return;

    const form = e.currentTarget;
    const minSec = parseInt(
      (form.elements.namedItem("minInterval") as HTMLInputElement).value,
      10
    );
    const maxSec = parseInt(
      (form.elements.namedItem("maxInterval") as HTMLInputElement).value,
      10
    );
    const active = (form.elements.namedItem("warmupActive") as HTMLInputElement).checked;

    const updatedWarmup = {
      minIntervalSeconds: minSec || 30,
      maxIntervalSeconds: maxSec || 60,
      warmupActive: active,
    };

    setSelectedWarmupAccount(null);

    const res = await fetch("/api/browser-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateWarmup",
        id: selectedWarmupAccount.id,
        warmup: updatedWarmup,
      }),
    });
    const data = await res.json();
    if (data && data.accounts) {
      setAccounts(data.accounts);
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const totalConnected = accounts.filter((a) => a.isConnected).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink/10 pb-6">
        <div>
          <h1 className={`${serif.className} text-4xl sm:text-5xl tracking-tight text-ink`}>
            Browsers
          </h1>
          <p className="mt-1 font-mono text-xs text-ink/50 uppercase tracking-wider">
            Data Terhubung Langsung dari Supabase Database
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Akun Limit Badge */}
          <div className="rounded-[4px] border border-[#E2683C]/30 bg-[#E2683C]/10 px-3.5 py-1.5 font-mono text-xs font-semibold text-[#E2683C]">
            {totalConnected} / 5 account(s)
          </div>

          {/* Tombol Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-ink/20 bg-white px-3.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {/* Tombol Status Ekstensi */}
          <button
            type="button"
            onClick={() => setShowExtensionModal(true)}
            className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-ink/20 bg-white px-3.5 text-xs font-medium text-ink transition-colors hover:border-ink"
          >
            <Puzzle className="h-3.5 w-3.5 text-[#E2683C]" />
            <span className="hidden sm:inline">Ekstensi:</span>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                extensionDetected ? "bg-emerald-600 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span>{extensionDetected ? "Aktif" : "Belum terpasang"}</span>
          </button>
        </div>
      </div>

      {/* Banner Panduan jika tabel Supabase belum dibuat */}
      {tableMissing && (
        <div className="rounded-[4px] border-l-4 border-amber-600 bg-amber-50 p-5 text-amber-950">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                <Database className="h-4 w-4" />
                <span>Tabel Supabase 'browser_social_accounts' Belum Dibuat</span>
              </div>
              <p className="text-xs text-amber-900/80 leading-relaxed max-w-3xl">
                Aplikasi telah dikonfigurasi untuk membaca langsung dari Supabase database Anda. 
                Jalankan script SQL di bawah ini di <strong>Supabase Dashboard ➔ SQL Editor</strong> untuk membuat tabel database dan mengisinya.
              </p>
            </div>
            <button
              type="button"
              onClick={copySqlToClipboard}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[3px] bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-800"
            >
              {copiedSql ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSql ? "Tersalin!" : "Salin SQL"}</span>
            </button>
          </div>
          <div className="mt-3">
            <pre className="max-h-36 overflow-y-auto rounded-[3px] bg-white/80 p-3 font-mono text-[11px] text-zinc-800 border border-amber-200">
              {SQL_SCHEMA_SNIPPET}
            </pre>
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="rounded-[4px] border border-ink/15 bg-white shadow-xs overflow-hidden">
        {/* Browser Info Header Row */}
        <div className="p-6 border-b border-ink/10 bg-[#FAFAFA]">
          <div className="grid grid-cols-1 md:grid-cols-[48px_1fr_200px_160px] gap-6 items-start">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-ink/15 bg-white text-ink/70 hover:border-ink hover:text-ink transition-colors"
              aria-label={isExpanded ? "Sembunyikan detail" : "Tampilkan detail"}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                Browser Info
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-ink/80 leading-relaxed break-all">
                  {userAgent}
                </span>
                <span className="rounded-[3px] bg-[#E2683C] px-2 py-0.5 text-[10px] font-semibold text-white tracking-wide uppercase">
                  Current
                </span>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                System
              </p>
              <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-ink/60" />
                <span>{systemOS}</span>
              </p>
              <p className="font-mono text-[11px] text-ink/50 mt-1">
                Last active: {formatLastActive(lastActive)}
              </p>
            </div>

            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink/50 mb-2">
                IP address
              </p>
              <p className="font-mono text-xs text-ink flex items-center gap-1.5 font-medium">
                <Globe className="h-3.5 w-3.5 text-ink/60" />
                <span>{ipAddress}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Linked Social Accounts Section */}
        {isExpanded && (
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-ink tracking-tight flex items-center gap-2">
                  <span>Linked social accounts</span>
                  <span className="font-mono text-[10px] font-normal text-ink/40 bg-ink/5 px-2 py-0.5 rounded">
                    Supabase Live
                  </span>
                </h2>
                <p className="text-xs text-ink/60 mt-1">
                  A browser belongs to a team and user and can host multiple connected accounts.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-[4px] border border-ink/15 bg-[#F9F8F5] px-3.5 py-2 text-xs text-ink/75">
                <HelpCircle className="h-4 w-4 shrink-0 text-ink/40" />
                <span>Primary mark is used for scanning the audience in your campaigns.</span>
              </div>
            </div>

            {/* Banner Feedback Koneksi */}
            {connectNotice && (
              <div className="mb-4 flex items-center gap-2 rounded-[3px] border-l-3 border-[#E2683C] bg-[#E2683C]/10 px-4 py-2.5 text-xs font-medium text-ink transition-all">
                <RotateCcw className="h-3.5 w-3.5 animate-spin text-[#E2683C]" />
                <span>{connectNotice}</span>
              </div>
            )}

            {/* Tabel Data Akun dari Supabase */}
            <div className="overflow-x-auto">
              {accounts.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-ink/15 rounded-[4px] bg-[#FAF9F5]">
                  <p className="text-sm font-medium text-ink/60">
                    {tableMissing
                      ? "Tabel database belum dibuat. Silakan jalankan script SQL di atas."
                      : "Belum ada akun di database Supabase. Akun akan tersimpan otomatis saat login via ekstensi."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-ink/10 text-ink/60 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Account</th>
                      <th className="py-3 px-4 font-semibold">Platform</th>
                      <th className="py-3 px-4 font-semibold">Last logged in</th>
                      <th className="py-3 px-4 font-semibold">Connection</th>
                      <th className="py-3 px-4 font-semibold">Primary</th>
                      <th className="py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5 text-sm">
                    {accounts.map((account) => {
                      return (
                        <tr key={account.id} className="hover:bg-paper/40 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {(() => {
                                const resolvedAvatar =
                                  account.avatarUrl && !account.avatarUrl.includes("graph.facebook.com")
                                    ? account.avatarUrl
                                    : account.platform === "Facebook" && account.accountId
                                    ? `/api/avatar-proxy?fbId=${account.accountId}`
                                    : account.avatarUrl;

                                if (resolvedAvatar && !avatarErrors[account.id]) {
                                  return (
                                    <img
                                      src={resolvedAvatar}
                                      alt={account.name}
                                      referrerPolicy="no-referrer"
                                      className="h-9 w-9 rounded-full object-cover border border-ink/10 bg-zinc-100 shadow-2xs"
                                      onError={() => {
                                        setAvatarErrors((prev) => ({ ...prev, [account.id]: true }));
                                      }}
                                    />
                                  );
                                }

                                return (
                                  <div
                                    className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs ${
                                      account.platform === "Facebook"
                                        ? "bg-[#1877F2]"
                                        : "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]"
                                    }`}
                                  >
                                    {account.name.charAt(0).toUpperCase()}
                                  </div>
                                );
                              })()}
                              <div>
                                <div className="font-semibold text-ink text-sm">
                                  {account.name}
                                </div>
                                {account.accountId && (
                                  <div className="font-mono text-[10px] text-ink/40">
                                    ID: {account.accountId}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 font-medium text-ink">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  account.platform === "Facebook"
                                    ? "bg-blue-600"
                                    : "bg-pink-600"
                                }`}
                              />
                              <span>{account.platform}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 font-mono text-xs text-ink/60">
                            {account.lastLoggedIn ? (
                              new Date(account.lastLoggedIn).toLocaleString("id-ID", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            ) : (
                              <span className="text-ink/30">—</span>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <button
                              type="button"
                              disabled={connectingId === account.id}
                              onClick={() => handleConnectAccount(account)}
                              className={`rounded-[4px] px-4 py-1.5 text-xs font-semibold tracking-wide transition-all shadow-2xs inline-flex items-center gap-1.5 ${
                                account.isConnected
                                  ? "bg-emerald-700 text-white hover:bg-emerald-800"
                                  : "bg-[#F59E0B] hover:bg-[#E2683C] text-white"
                              } ${connectingId === account.id ? "opacity-75 cursor-wait" : ""}`}
                            >
                              {connectingId === account.id && (
                                <RotateCcw className="h-3 w-3 animate-spin" />
                              )}
                              <span>
                                {account.isConnected
                                  ? "Connected"
                                  : connectingId === account.id
                                  ? "Memeriksa..."
                                  : "Connect"}
                              </span>
                            </button>
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                type="checkbox"
                                checked={account.isPrimary}
                                onChange={() => handleTogglePrimary(account.id)}
                                className="sr-only peer"
                              />
                              <div className="w-10 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2563EB]"></div>
                            </label>
                            <span className="text-xs text-ink/70 font-medium">Primary</span>
                            <HelpCircle className="h-3.5 w-3.5 text-ink/35 cursor-help" />
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedWarmupAccount(account)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/80 hover:text-ink transition-colors hover:underline underline-offset-4"
                          >
                            <Clock className="h-3.5 w-3.5 text-ink/60" />
                            <span>Interval &amp; Warmup</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Modal Interval & Warmup */}
    {selectedWarmupAccount && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
        <div className="w-full max-w-md rounded-[4px] border border-ink/20 bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-[#E2683C]" />
              <h3 className="font-bold text-ink">
                Interval &amp; Warmup — {selectedWarmupAccount.platform}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedWarmupAccount(null)}
              className="text-ink/40 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveWarmup} className="mt-4 space-y-4">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-ink/60 mb-1">
                Minimal Interval (detik)
              </label>
              <input
                name="minInterval"
                type="number"
                defaultValue={selectedWarmupAccount.intervalWarmup.minIntervalSeconds}
                min="5"
                max="300"
                required
                className="w-full rounded-[3px] border border-ink/20 px-3 py-2 text-sm text-ink outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-ink/60 mb-1">
                Maksimal Interval (detik)
              </label>
              <input
                name="maxInterval"
                type="number"
                defaultValue={selectedWarmupAccount.intervalWarmup.maxIntervalSeconds}
                min="10"
                max="600"
                required
                className="w-full rounded-[3px] border border-ink/20 px-3 py-2 text-sm text-ink outline-none focus:border-ink"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                id="warmupActive"
                name="warmupActive"
                type="checkbox"
                defaultChecked={selectedWarmupAccount.intervalWarmup.warmupActive}
                className="h-4 w-4 rounded border-ink/20 text-[#E2683C] focus:ring-[#E2683C]"
              />
              <label htmlFor="warmupActive" className="text-sm text-ink font-medium">
                Aktifkan Algoritma Warmup Akun Bertahap
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-ink/10">
              <button
                type="button"
                onClick={() => setSelectedWarmupAccount(null)}
                className="rounded-[3px] border border-ink/20 px-4 py-2 text-xs font-semibold text-ink hover:bg-zinc-100"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-[3px] bg-[#1B1A17] px-4 py-2 text-xs font-semibold text-[#F3F0E8] hover:bg-[#2E2C27]"
              >
                Simpan ke Supabase
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Modal Petunjuk Ekstensi */}
    {showExtensionModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
        <div className="w-full max-w-lg rounded-[4px] border border-ink/20 bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 pb-4">
            <div className="flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-[#E2683C]" />
              <h3 className="font-bold text-ink text-base">
                Ekstensi Chrome ReachOwl
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowExtensionModal(false)}
              className="text-ink/40 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-4 text-xs text-ink/80 leading-relaxed">
            <div className="rounded-[4px] bg-[#FAF9F5] border border-ink/10 p-3">
              <p className="font-semibold text-ink mb-1">Status Ekstensi:</p>
              {extensionDetected ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Ekstensi Aktif &amp; Terhubung dengan Tab Ini! {extensionVersion ? `(v${extensionVersion})` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Belum terdeteksi di tab browser ini (buka di Google Chrome atau Edge).
                </span>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-bold text-ink">Cara Memasang:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-ink/70">
                <li>Buka Chrome/Edge lalu buka <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-ink">chrome://extensions/</code></li>
                <li>Nyalakan sakelar <strong>Developer Mode</strong> di pojok kanan atas.</li>
                <li>Klik tombol <strong>Load unpacked</strong>.</li>
                <li>Pilih folder: <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono text-ink">D:\reachowlextension</code></li>
              </ol>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-ink/10">
            <button
              type="button"
              onClick={() => setShowExtensionModal(false)}
              className="rounded-[3px] bg-[#1B1A17] px-4 py-2 text-xs font-semibold text-[#F3F0E8] hover:bg-[#2E2C27]"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
