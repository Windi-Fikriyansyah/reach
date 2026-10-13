"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Rocket,
  Play,
  Plus,
  Search,
  Trash2,
  Pause,
  Copy,
  Check,
  Database,
  X,
  Users,
  MessageSquare,
  ThumbsUp,
  Send,
  Sliders,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { serif } from "@/lib/fonts";
import type { Campaign } from "@/app/api/campaigns/route";

interface CampaignsClientProps {
  initialCampaigns: Campaign[];
  initialTableMissing?: boolean;
}

const SQL_SCHEMA_CAMPAIGNS = `-- Jalankan di Supabase Dashboard -> SQL Editor:
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('Facebook', 'Instagram')),
    type TEXT NOT NULL DEFAULT 'Group Members Outreach',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'draft')),
    target_audience TEXT DEFAULT 'Public Group',
    daily_limit INTEGER DEFAULT 50,
    total_leads INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    message_template TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);`;

export default function CampaignsClient({
  initialCampaigns,
  initialTableMissing = false,
}: CampaignsClientProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [tableMissing, setTableMissing] = useState(initialTableMissing);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"All" | "Facebook" | "Instagram">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "active" | "paused">("All");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Form State untuk Campaign Baru
  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState<"Facebook" | "Instagram">("Facebook");
  const [formType, setFormType] = useState("Group Members Outreach");
  const [formTarget, setFormTarget] = useState("");
  const [formDailyLimit, setFormDailyLimit] = useState(30);
  const [formTemplate, setFormTemplate] = useState(
    "Halo {first_name}, salam kenal! Saya melihat profil Anda dan ingin terhubung."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Muat data dari localStorage jika tabel Supabase belum ada
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLocal = localStorage.getItem("reachowl_local_campaigns");
      if (savedLocal && initialCampaigns.length === 0) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCampaigns(parsed);
          }
        } catch {}
      }
    }
  }, [initialCampaigns]);

  // Refresh campaigns dari API
  const fetchCampaigns = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/campaigns", { cache: "no-store" });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.campaigns)) {
        if (data.campaigns.length > 0) {
          setCampaigns(data.campaigns);
        } else {
          // Cek fallback localStorage
          const savedLocal = localStorage.getItem("reachowl_local_campaigns");
          if (savedLocal) {
            try {
              const parsed = JSON.parse(savedLocal);
              if (Array.isArray(parsed)) setCampaigns(parsed);
            } catch {}
          }
        }
        setTableMissing(Boolean(data.tableMissing));
      }
    } catch {
      // Ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: formName.trim(),
          platform: formPlatform,
          type: formType,
          targetAudience: formTarget.trim() || "Target Audience",
          dailyLimit: formDailyLimit,
          messageTemplate: formTemplate,
        }),
      });

      const data = await res.json();
      if (data && data.campaign) {
        const updated = [data.campaign, ...campaigns];
        setCampaigns(updated);
        // Simpan juga ke localStorage sebagai cadangan instan
        if (typeof window !== "undefined") {
          localStorage.setItem("reachowl_local_campaigns", JSON.stringify(updated));
        }
        setShowCreateModal(false);
        // Reset form
        setFormName("");
        setFormTarget("");
      }
    } catch (err) {
      console.error("Gagal membuat campaign:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (campaign: Campaign) => {
    const nextStatus = campaign.status === "active" ? "paused" : "active";
    const updated = campaigns.map((c) =>
      c.id === campaign.id ? { ...c, status: nextStatus as "active" | "paused" } : c
    );
    setCampaigns(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("reachowl_local_campaigns", JSON.stringify(updated));
    }

    try {
      await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggleStatus",
          id: campaign.id,
          status: campaign.status,
        }),
      });
    } catch {
      // Ignore
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus campaign ini?")) return;

    const updated = campaigns.filter((c) => c.id !== id);
    setCampaigns(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("reachowl_local_campaigns", JSON.stringify(updated));
    }

    try {
      await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id,
        }),
      });
    } catch {
      // Ignore
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_CAMPAIGNS);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Filter Data
  const filteredCampaigns = campaigns.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.targetAudience.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPlatform = platformFilter === "All" || c.platform === platformFilter;
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    return matchSearch && matchPlatform && matchStatus;
  });

  const totalLeads = campaigns.reduce((acc, curr) => acc + (curr.totalLeads || 0), 0);
  const totalSent = campaigns.reduce((acc, curr) => acc + (curr.messagesSent || 0), 0);
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink/10 pb-6">
        <div>
          <h1 className={`${serif.className} text-4xl sm:text-5xl tracking-tight text-ink`}>
            Campaigns
          </h1>
          <p className="mt-1 font-mono text-xs text-ink/50 uppercase tracking-wider">
            Otomatisasi & Penjangkauan Tertarget Facebook & Instagram
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fetchCampaigns}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-ink/20 bg-white px-3.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/campaigns/create"
            className="inline-flex h-9 items-center gap-2 rounded-[3px] bg-ink px-4 text-xs font-semibold text-paper shadow-sm transition-all hover:bg-ink/90 hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4 text-accent" />
            <span>Create Campaign 🚀</span>
          </Link>
        </div>
      </div>

      {/* Banner Panduan jika tabel Supabase belum dibuat */}
      {tableMissing && (
        <div className="rounded-[4px] border-l-4 border-amber-600 bg-amber-50 p-5 text-amber-950">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                <Database className="h-4 w-4" />
                <span>Tabel Supabase 'campaigns' Belum Dibuat</span>
              </div>
              <p className="text-xs text-amber-900/80 leading-relaxed max-w-3xl">
                Jalankan script SQL di bawah ini di <strong>Supabase Dashboard ➔ SQL Editor</strong> untuk menyimpan campaign secara cloud permanen.
                Campaign yang Anda buat saat ini tetap aktif dan tersimpan di penyimpanan lokal browser.
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
              {SQL_SCHEMA_CAMPAIGNS}
            </pre>
          </div>
        </div>
      )}

      {/* Ringkasan Stats Bar (Hanya tampil jika ada campaign) */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-[4px] border border-ink/10 bg-white shadow-2xs">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Total Campaigns</p>
            <p className="text-2xl font-bold text-ink mt-1">{campaigns.length}</p>
          </div>
          <div className="p-4 rounded-[4px] border border-ink/10 bg-white shadow-2xs">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Active</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="p-4 rounded-[4px] border border-ink/10 bg-white shadow-2xs">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Total Leads</p>
            <p className="text-2xl font-bold text-ink mt-1">{totalLeads}</p>
          </div>
          <div className="p-4 rounded-[4px] border border-ink/10 bg-white shadow-2xs">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Messages Sent</p>
            <p className="text-2xl font-bold text-[#E2683C] mt-1">{totalSent}</p>
          </div>
        </div>
      )}

      {/* Filter & Search Bar (Hanya tampil jika ada data) */}
      {campaigns.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-[4px] border border-ink/10 shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/40" />
            <input
              type="text"
              placeholder="Cari campaign atau audience..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-[3px] border border-ink/15 bg-[#FAF9F5] focus:outline-none focus:border-ink"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* Filter Platform */}
            <div className="flex items-center rounded-[3px] border border-ink/15 p-0.5 bg-[#FAF9F5] text-xs font-medium">
              {(["All", "Facebook", "Instagram"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatformFilter(p)}
                  className={`px-2.5 py-1 rounded-[2px] transition-colors ${
                    platformFilter === p ? "bg-white text-ink shadow-2xs font-semibold" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Filter Status */}
            <div className="flex items-center rounded-[3px] border border-ink/15 p-0.5 bg-[#FAF9F5] text-xs font-medium">
              {(["All", "active", "paused"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-[2px] capitalize transition-colors ${
                    statusFilter === s ? "bg-white text-ink shadow-2xs font-semibold" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EMPTY STATE SESUAI GAMBAR PENGGUNA (Jika belum ada campaign)             */}
      {/* ========================================================================= */}
      {campaigns.length === 0 ? (
        <div className="relative overflow-hidden rounded-[8px] border border-[#E9DFCE] bg-gradient-to-b from-[#FFFDF9] via-[#FAF3E5] to-[#F5ECE0] p-10 sm:p-16 text-center shadow-sm">
          {/* Background Decorative Rings */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#E2683C]/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />

          {/* Center Illustration Area */}
          <div className="relative mx-auto flex flex-col items-center justify-center max-w-2xl">
            {/* Vector Illustration & Floating Reaction Badges */}
            <div className="relative mb-6 h-56 w-72 sm:w-80 flex items-center justify-center">
              {/* Circular Soft Glow */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-[#F8D8A7]/70 to-[#FCE8C3]/50 blur-xl" />

              {/* Floating Social Reaction Badge 1: Chat Message (Top Left) */}
              <div className="absolute top-4 left-6 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBA741] text-white shadow-md transform -rotate-6 transition-transform hover:scale-110">
                <MessageSquare className="h-5 w-5 fill-white" />
              </div>

              {/* Floating Social Reaction Badge 2: User Profile (Top Right) */}
              <div className="absolute top-8 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBA741] text-white shadow-md transform rotate-6 transition-transform hover:scale-110">
                <Users className="h-5 w-5 fill-white" />
              </div>

              {/* Floating Social Reaction Badge 3: Thumbs Up (Mid Left) */}
              <div className="absolute bottom-16 left-2 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-[#EBA741]/80 text-white shadow-md transform -rotate-12 transition-transform hover:scale-110">
                <ThumbsUp className="h-4 w-4 fill-white" />
              </div>

              {/* SVG Rocket Illustration */}
              <svg
                viewBox="0 0 200 200"
                className="relative z-0 h-44 w-44 drop-shadow-lg"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Smoke Puffs */}
                <circle cx="100" cy="165" r="22" fill="#EADBC8" fillOpacity="0.8" />
                <circle cx="80" cy="170" r="16" fill="#F0E3D3" fillOpacity="0.9" />
                <circle cx="120" cy="170" r="16" fill="#F0E3D3" fillOpacity="0.9" />

                {/* Fire / Flame Jet */}
                <path
                  d="M93 140 C85 155, 96 175, 100 180 C104 175, 115 155, 107 140 Z"
                  fill="#FF5722"
                />
                <path
                  d="M96 140 C92 150, 98 165, 100 168 C102 165, 108 150, 104 140 Z"
                  fill="#FFEB3B"
                />

                {/* Rocket Body */}
                <path
                  d="M100 25 C82 50, 80 110, 84 135 L116 135 C120 110, 118 50, 100 25 Z"
                  fill="#F59E0B"
                />
                {/* Nose Cone */}
                <path
                  d="M100 25 C92 40, 88 55, 87 65 L113 65 C112 55, 108 40, 100 25 Z"
                  fill="#D97706"
                />
                {/* Left Fin */}
                <path d="M84 110 L68 135 L84 133 Z" fill="#D97706" />
                {/* Right Fin */}
                <path d="M116 110 L132 135 L116 133 Z" fill="#D97706" />

                {/* Rocket Window / Porthole */}
                <circle cx="100" cy="85" r="12" fill="#FFFFFF" />
                <circle cx="100" cy="85" r="8" fill="#38BDF8" />
                <circle cx="98" cy="83" r="3" fill="#FFFFFF" />

                {/* Stripe Lines */}
                <rect x="85" y="112" width="30" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.7" />
                <rect x="86" y="120" width="28" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.7" />
              </svg>

              {/* Translucent Play Button on Rocket (like thumbnail in user image) */}
              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                className="group absolute z-20 flex h-16 w-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-[2px] transition-all hover:scale-110 hover:bg-black/60 shadow-lg"
                aria-label="Tonton tutorial kampanye"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-sm transition-transform group-hover:scale-105">
                  <Play className="h-5 w-5 fill-zinc-900 ml-0.5" />
                </div>
              </button>
            </div>

            {/* Headline Sesuai Gambar */}
            <h2 className="text-xl sm:text-2xl font-bold text-[#1B1A17] tracking-tight max-w-xl leading-snug">
              Oh! You are new here? Let's create your first campaign. You don't have any campaigns.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-ink/65 max-w-lg leading-relaxed">
              Jangkau calon pelanggan secara otomatis dari grup Facebook, pengikut Instagram, atau komentator postingan tanpa ribet.
            </p>

            {/* Action Buttons Sesuai Gambar */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {/* Tombol Utama: Create your first campaign 🚀 */}
              <Link
                href="/campaigns/create"
                className="inline-flex h-11 items-center gap-2 rounded-[5px] bg-[#2E2E2E] px-6 text-xs sm:text-sm font-semibold text-white shadow-md transition-all hover:bg-black hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Create your first campaign</span>
                <span className="text-base">🚀</span>
              </Link>

              {/* Tombol YouTube Merah Sesuai Gambar */}
              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                className="inline-flex h-11 w-12 items-center justify-center rounded-[5px] bg-[#E52D27] text-white shadow-md transition-all hover:bg-[#C9221D] hover:scale-105 active:scale-95"
                title="Tonton Tutorial YouTube ReachOwl"
                aria-label="Tonton Tutorial YouTube"
              >
                <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        /* Jika filter atau pencarian tidak menemukan hasil */
        <div className="py-16 text-center border border-dashed border-ink/15 rounded-[4px] bg-white">
          <p className="text-sm font-semibold text-ink">Tidak ada campaign yang cocok dengan pencarian Anda</p>
          <p className="text-xs text-ink/50 mt-1">Coba sesuaikan kata kunci atau ubah filter platform.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setPlatformFilter("All");
              setStatusFilter("All");
            }}
            className="mt-4 text-xs font-semibold text-accent hover:underline"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        /* ========================================================================= */
        /* DAFTAR CARD CAMPAIGN (Ketika Data Sudah Ditambahkan)                      */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((camp) => {
            const isFb = camp.platform === "Facebook";
            const replyRate =
              camp.messagesSent > 0
                ? Math.round((camp.repliedCount / camp.messagesSent) * 100)
                : 0;

            return (
              <div
                key={camp.id}
                className="flex flex-col justify-between rounded-[4px] border border-ink/15 bg-white shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-ink/10 bg-[#FAFAFA]">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {/* Platform Badge */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-[3px] px-2.5 py-0.5 text-[11px] font-semibold text-white ${
                          isFb ? "bg-[#1877F2]" : "bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF]"
                        }`}
                      >
                        {isFb ? "Facebook" : "Instagram"}
                      </span>
                      <span className="font-mono text-[10px] text-ink/50 bg-ink/5 px-1.5 py-0.5 rounded">
                        {camp.type}
                      </span>
                    </div>

                    {/* Status Pill */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(camp)}
                      className={`inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[10px] font-mono font-semibold transition-colors ${
                        camp.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                      }`}
                      title="Klik untuk mengubah status"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          camp.status === "active" ? "bg-emerald-600 animate-pulse" : "bg-amber-500"
                        }`}
                      />
                      <span className="capitalize">{camp.status}</span>
                    </button>
                  </div>

                  {/* Campaign Name */}
                  <h3 className="font-bold text-base text-ink line-clamp-1 leading-snug tracking-tight">
                    {camp.name}
                  </h3>

                  {/* Target Audience Source */}
                  <p className="text-xs text-ink/60 mt-1 line-clamp-1 font-mono text-[11px]">
                    🎯 {camp.targetAudience}
                  </p>
                </div>

                {/* Card Body - Metrik & Performa */}
                <div className="p-5 space-y-4">
                  {/* Grid 3 Kolom Metrik */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-[3px] bg-[#FAF9F5] p-2 border border-ink/5">
                      <p className="font-mono text-[10px] uppercase text-ink/40">Leads</p>
                      <p className="text-sm font-bold text-ink mt-0.5">{camp.totalLeads}</p>
                    </div>
                    <div className="rounded-[3px] bg-[#FAF9F5] p-2 border border-ink/5">
                      <p className="font-mono text-[10px] uppercase text-ink/40">Sent</p>
                      <p className="text-sm font-bold text-ink mt-0.5">{camp.messagesSent}</p>
                    </div>
                    <div className="rounded-[3px] bg-[#FAF9F5] p-2 border border-ink/5">
                      <p className="font-mono text-[10px] uppercase text-ink/40">Reply Rate</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{replyRate}%</p>
                    </div>
                  </div>

                  {/* Daily Limit Progress */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] font-mono mb-1 text-ink/60">
                      <span>Daily Limit:</span>
                      <span className="font-semibold text-ink">
                        {camp.messagesSent} / {camp.dailyLimit} msgs
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((camp.messagesSent / (camp.dailyLimit || 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Cuplikan Pesan */}
                  {camp.messageTemplate && (
                    <div className="rounded-[3px] bg-paper/60 p-2.5 text-[11px] text-ink/75 border border-ink/5 line-clamp-2 italic">
                      "{camp.messageTemplate}"
                    </div>
                  )}
                </div>

                {/* Card Footer - Action Buttons */}
                <div className="p-4 border-t border-ink/10 bg-[#FAF9F5] flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-ink/40">
                    {new Date(camp.createdAt).toLocaleDateString("id-ID", {
                      dateStyle: "medium",
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(camp)}
                      className="p-1.5 rounded-[3px] border border-ink/15 bg-white text-ink/70 hover:text-ink hover:border-ink transition-colors"
                      title={camp.status === "active" ? "Pause Campaign" : "Resume Campaign"}
                    >
                      {camp.status === "active" ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCampaign(camp.id)}
                      className="p-1.5 rounded-[3px] border border-ink/15 bg-white text-red-600 hover:border-red-600 transition-colors"
                      title="Hapus Campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE CAMPAIGN                                                    */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[6px] border border-ink/20 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-ink/10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-accent/10 text-accent font-bold">
                  🚀
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">Create New Campaign</h3>
                  <p className="text-xs text-ink/50 font-mono">ReachOwl Automation Engine</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-[3px] p-1 text-ink/40 hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="mt-5 space-y-4 text-xs">
              {/* Campaign Name */}
              <div>
                <label className="block font-semibold text-ink mb-1">Nama Campaign *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Agency Owners - FB Group Outreach"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-[3px] border border-ink/20 bg-[#FAF9F5] focus:outline-none focus:border-ink text-xs font-medium"
                />
              </div>

              {/* Platform Selector Cards */}
              <div>
                <label className="block font-semibold text-ink mb-1.5">Pilih Platform *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormPlatform("Facebook");
                      setFormType("Group Members Outreach");
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-[4px] border text-left transition-all ${
                      formPlatform === "Facebook"
                        ? "border-[#1877F2] bg-[#1877F2]/5 ring-1 ring-[#1877F2]"
                        : "border-ink/15 hover:border-ink/40 bg-white"
                    }`}
                  >
                    <div className="h-7 w-7 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-bold text-xs">
                      f
                    </div>
                    <div>
                      <p className="font-bold text-ink text-xs">Facebook</p>
                      <p className="text-[10px] text-ink/50">Groups, Posts, Profile</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormPlatform("Instagram");
                      setFormType("Followers Outreach");
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-[4px] border text-left transition-all ${
                      formPlatform === "Instagram"
                        ? "border-[#DD2A7B] bg-[#DD2A7B]/5 ring-1 ring-[#DD2A7B]"
                        : "border-ink/15 hover:border-ink/40 bg-white"
                    }`}
                  >
                    <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center text-white font-bold text-xs">
                      IG
                    </div>
                    <div>
                      <p className="font-bold text-ink text-xs">Instagram</p>
                      <p className="text-[10px] text-ink/50">Followers, Hashtags</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Campaign Type Dropdown */}
              <div>
                <label className="block font-semibold text-ink mb-1">Tipe Campaign</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 rounded-[3px] border border-ink/20 bg-[#FAF9F5] focus:outline-none focus:border-ink text-xs"
                >
                  {formPlatform === "Facebook" ? (
                    <>
                      <option value="Group Members Outreach">Member Grup Facebook Tertarget</option>
                      <option value="Post Commenters & Likers">Reaksi & Komentator Postingan</option>
                      <option value="Profile Friends Outreach">Teman Profil Personal</option>
                    </>
                  ) : (
                    <>
                      <option value="Followers Outreach">Pengikut Akun Kompetitor</option>
                      <option value="Hashtag Posters">Penulis Postingan dengan Hashtag</option>
                      <option value="Post Commenters">Komentator Postingan Tertentu</option>
                    </>
                  )}
                </select>
              </div>

              {/* Target Audience URL / Source */}
              <div>
                <label className="block font-semibold text-ink mb-1">
                  Sumber / URL Target {formPlatform === "Facebook" ? "Grup / Post" : "Akun / Hashtag"}
                </label>
                <input
                  type="text"
                  placeholder={
                    formPlatform === "Facebook"
                      ? "https://www.facebook.com/groups/digitalmarketing..."
                      : "@nama_kompetitor atau #bisnisonline"
                  }
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-[3px] border border-ink/20 bg-[#FAF9F5] focus:outline-none focus:border-ink text-xs font-mono"
                />
              </div>

              {/* Daily Limit Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-ink">Batas Pesan Per Hari (Safety Limit)</label>
                  <span className="font-mono font-bold text-accent">{formDailyLimit} pesan/hari</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={formDailyLimit}
                  onChange={(e) => setFormDailyLimit(Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
                <p className="text-[10px] text-ink/40 mt-0.5">
                  ReachOwl menjaga keamanan akun dengan warmup otomatis & interval acak (30-60 detik).
                </p>
              </div>

              {/* Message Template Textarea */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-ink">Template Pesan Pembuka</label>
                  <span className="text-[10px] text-ink/40 font-mono">Variabel: {"{first_name}"}</span>
                </div>
                <textarea
                  rows={3}
                  value={formTemplate}
                  onChange={(e) => setFormTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-[3px] border border-ink/20 bg-[#FAF9F5] focus:outline-none focus:border-ink text-xs font-mono"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-ink/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-[3px] border border-ink/20 bg-white font-medium text-ink hover:bg-ink/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formName.trim()}
                  className="px-5 py-2 rounded-[3px] bg-ink font-semibold text-paper shadow-sm hover:bg-ink/90 disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "Luncurkan Campaign 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIDEO TUTORIAL & PANDUAN CAMPAIGN                                  */}
      {/* ========================================================================= */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-[6px] border border-ink/20 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 bg-[#1B1A17] text-white">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-[#E52D27] flex items-center justify-center">
                  <Play className="h-3 w-3 fill-white ml-0.5" />
                </div>
                <h3 className="text-sm font-bold">Panduan Meluncurkan Campaign ReachOwl</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="text-white/60 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video Container Area */}
            <div className="relative aspect-video w-full bg-zinc-950 flex flex-col items-center justify-center text-center p-8 text-white">
              <div className="h-16 w-16 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center text-accent mb-4 animate-pulse">
                <Rocket className="h-8 w-8" />
              </div>
              <h4 className="text-lg font-bold">Otomatisasi Outreach Tanpa Risiko Banned</h4>
              <p className="text-xs text-white/70 max-w-md mt-2 leading-relaxed">
                ReachOwl menggunakan headless Chrome bridge lokal dengan IP & cookie Anda sendiri. Setiap pesan dikirim dengan jeda manusiawi (30-60 detik) sehingga platform mendeteksinya sebagai interaksi organik biasa.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowVideoModal(false);
                    setShowCreateModal(true);
                  }}
                  className="px-5 py-2 rounded-[3px] bg-accent text-white font-semibold text-xs shadow-sm hover:bg-accent/90"
                >
                  Mulai Buat Campaign Sekarang 🚀
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#FAF9F5] border-t border-ink/10 flex items-center justify-between text-xs text-ink/70">
              <span>💡 Tip: Pastikan akun Facebook/Instagram sudah terhubung di menu Browsers.</span>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="font-semibold text-ink hover:underline"
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
