"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  ThumbsUp,
  MessageSquare,
  Sparkles,
  Sliders,
  ShieldCheck,
  Clock,
  Eye,
  Rocket,
  Hash,
  HelpCircle,
  RotateCcw,
  AlertCircle,
  Search,
} from "lucide-react";
import { serif } from "@/lib/fonts";

function InstagramIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

type Step = 1 | 2 | 3 | 4;
type Platform = "Facebook" | "Instagram";

interface ProspectMethod {
  id: string;
  title: string;
  description: string;
  iconType: "group" | "reaction" | "comment" | "followers" | "hashtag";
  platform: Platform;
  recommended?: boolean;
}

const FB_METHODS: ProspectMethod[] = [
  {
    id: "fb_group_members",
    title: "Facebook Group Members",
    description: "Engage with people who joined a certain facebook group",
    iconType: "group",
    platform: "Facebook",
    recommended: true,
  },
  {
    id: "fb_post_reactions",
    title: "Facebook Post/AD Reactions",
    description: "People who reacted on a certain facebook post or AD.",
    iconType: "reaction",
    platform: "Facebook",
  },
  {
    id: "fb_post_comments",
    title: "Facebook Post/AD Comments",
    description: "Engage with People who comment on a certain facebook post or AD",
    iconType: "comment",
    platform: "Facebook",
  },
];

const IG_METHODS: ProspectMethod[] = [
  {
    id: "ig_followers",
    title: "Instagram Followers",
    description: "Engage with followers of your competitor or target account",
    iconType: "followers",
    platform: "Instagram",
    recommended: true,
  },
  {
    id: "ig_post_comments",
    title: "Instagram Post Comments",
    description: "People who commented on a specific reel, photo or AD post.",
    iconType: "comment",
    platform: "Instagram",
  },
  {
    id: "ig_hashtag_posters",
    title: "Instagram Hashtag Posters",
    description: "Engage with creators who posted using a target niche hashtag.",
    iconType: "hashtag",
    platform: "Instagram",
  },
];

export default function CreateCampaignClient() {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [platform, setPlatform] = useState<Platform>("Facebook");
  const [selectedMethod, setSelectedMethod] = useState<string>("fb_group_members");

  // Step 2 Form (Target Setup)
  const [targetUrl, setTargetUrl] = useState("");
  const [filterKeywords, setFilterKeywords] = useState("Owner, Founder, CEO, Manager, Marketing");
  const [maxLeadsToScrape, setMaxLeadsToScrape] = useState(150);

  // Step 3 Form (Message Sequence)
  const [messageTemplate, setMessageTemplate] = useState(
    "Halo {first_name}, salam kenal! Saya melihat profil Anda di grup dan tertarik untuk berdiskusi tentang strategi outreach otomatis."
  );
  const [enableFollowUp, setEnableFollowUp] = useState(true);
  const [followUpDelayDays, setFollowUpDelayDays] = useState(2);
  const [followUpMessage, setFollowUpMessage] = useState(
    "Hai {first_name}, hanya memastikan pesan kemarin sempat terbaca. Apakah Anda sedang fokus scaling leads bulan ini?"
  );

  // Step 4 Form (Campaign Settings)
  const [campaignName, setCampaignName] = useState("Digital Marketing Group - Outreach Q4");
  const [dailyLimit, setDailyLimit] = useState(35);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState(35);
  const [maxIntervalSeconds, setMaxIntervalSeconds] = useState(65);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extension status
  const [extensionReady, setExtensionReady] = useState(false);

  // Scraped Facebook Groups state (Tab 2)
  const [facebookGroups, setFacebookGroups] = useState<
    Array<{ id: string; name: string; url: string; image?: string | null; privacy?: string }>
  >([]);
  const [isScrapingGroups, setIsScrapingGroups] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSuccessMessage, setScrapeSuccessMessage] = useState<string | null>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ count: number; expected: number } | null>(null);
  const scrapeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoScannedRef = useRef(false);

  // Muat grup yang pernah di-scrape sebelumnya & pasang listener ekstensi
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("reachowl_scraped_fb_groups");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFacebookGroups(parsed);
          }
        } catch {}
      }
    }

    // Handshake Ping ke ekstensi
    window.postMessage({ type: "REACHOWL_PING" }, "*");
    const pingTimer1 = setTimeout(() => {
      window.postMessage({ type: "REACHOWL_PING" }, "*");
    }, 400);
    const pingTimer2 = setTimeout(() => {
      window.postMessage({ type: "REACHOWL_PING" }, "*");
    }, 1200);

    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      if (
        event.data.type === "REACHOWL_BRIDGE_READY" ||
        event.data.type === "REACHOWL_EXTENSION_READY" ||
        event.data.type === "REACHOWL_PONG"
      ) {
        setExtensionReady(true);
      }

      if (event.data.type === "REACHOWL_SCAN_PROGRESS_EVENT") {
        setScanProgress({
          count: event.data.count,
          expected: event.data.expected || 0,
        });
      }

      if (event.data.type === "REACHOWL_SCRAPE_FB_GROUPS_RESULT") {
        if (scrapeTimeoutRef.current) {
          clearTimeout(scrapeTimeoutRef.current);
          scrapeTimeoutRef.current = null;
        }
        setIsScrapingGroups(false);
        setScanProgress(null);
        if (event.data.success && Array.isArray(event.data.groups) && event.data.groups.length > 0) {
          setFacebookGroups(event.data.groups);
          setScrapeSuccessMessage(
            `Berhasil memindai ${event.data.groups.length} grup Facebook yang Anda ikuti (semua grup selesai diambil).`
          );
          setScrapeError(null);
          try {
            localStorage.setItem("reachowl_scraped_fb_groups", JSON.stringify(event.data.groups));
          } catch {}
        } else {
          setScrapeError(
            event.data.error || "Tidak ada grup yang ditemukan pada akun Facebook ini."
          );
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      clearTimeout(pingTimer1);
      clearTimeout(pingTimer2);
      if (scrapeTimeoutRef.current) clearTimeout(scrapeTimeoutRef.current);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleReloadFreshList = useCallback(() => {
    setIsScrapingGroups(true);
    setScrapeError(null);
    setScrapeSuccessMessage(null);
    setScanProgress(null);

    window.postMessage({ type: "REACHOWL_SCRAPE_FB_GROUPS" }, "*");

    // Pemindaian membuka halaman grup Facebook di tab latar belakang dan menggulir sampai habis
    if (scrapeTimeoutRef.current) clearTimeout(scrapeTimeoutRef.current);
    scrapeTimeoutRef.current = setTimeout(() => {
      setIsScrapingGroups(false);
      setScanProgress(null);
      setScrapeError(
        "Waktu pemindaian melebihi batas. Buka chrome://extensions, reload ReachOwl, lalu refresh (F5) halaman ini."
      );
    }, 180000);
  }, []);

  // Ambil daftar grup secara otomatis saat masuk ke Step 2 (Facebook Group Members)
  useEffect(() => {
    if (
      currentStep === 2 &&
      selectedMethod === "fb_group_members" &&
      extensionReady &&
      !hasAutoScannedRef.current
    ) {
      hasAutoScannedRef.current = true;
      handleReloadFreshList();
    }
  }, [currentStep, selectedMethod, extensionReady, handleReloadFreshList]);

  // Auto update method default when platform changes
  const handlePlatformChange = (newPlatform: Platform) => {
    setPlatform(newPlatform);
    if (newPlatform === "Facebook") {
      setSelectedMethod("fb_group_members");
      setTargetUrl("");
      setCampaignName("Facebook Group Outreach - Q4");
    } else {
      setSelectedMethod("ig_followers");
      setTargetUrl("@competitor_niche_account");
      setCampaignName("Instagram Followers Outreach - Q4");
    }
  };

  const currentMethodObj =
    platform === "Facebook"
      ? FB_METHODS.find((m) => m.id === selectedMethod) || FB_METHODS[0]
      : IG_METHODS.find((m) => m.id === selectedMethod) || IG_METHODS[0];

  // Klik card langsung memilih metode dan langsung loncat ke Step 2
  const handleSelectMethodAndProceed = (method: ProspectMethod) => {
    setSelectedMethod(method.id);
    if (method.id === "fb_group_members") {
      setTargetUrl("");
      setSelectedGroupId(null);
      setCampaignName("Facebook Group Outreach - Q4");
    } else if (method.id === "fb_post_reactions" || method.id === "fb_post_comments") {
      setTargetUrl("https://www.facebook.com/permalink.php?story_fbid=...");
      setCampaignName(`Facebook Post ${method.title.includes("Reactions") ? "Reactions" : "Comments"} Outreach`);
    } else if (method.id === "ig_followers") {
      setTargetUrl("@competitor_niche_account");
      setCampaignName("Instagram Followers Outreach - Q4");
    } else if (method.id === "ig_post_comments") {
      setTargetUrl("https://www.instagram.com/p/C3x...");
      setCampaignName("Instagram Post Comments Outreach");
    } else if (method.id === "ig_hashtag_posters") {
      setTargetUrl("#digitalmarketingindonesia");
      setCampaignName("Instagram Hashtag Outreach");
    }
    setCurrentStep(2);
  };

  // Submit Handler
  const handleLaunchCampaign = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        action: "create",
        name: campaignName.trim() || `${platform} Outreach Campaign`,
        platform: platform,
        type: currentMethodObj.title,
        targetAudience: targetUrl.trim(),
        dailyLimit: Number(dailyLimit) || 35,
        totalLeads: Number(maxLeadsToScrape) || 100,
        messageTemplate: messageTemplate.trim(),
      };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data && data.campaign) {
        // Simpan juga ke localStorage sebagai cadangan sinkronisasi instan
        if (typeof window !== "undefined") {
          const prev = JSON.parse(localStorage.getItem("reachowl_local_campaigns") || "[]");
          localStorage.setItem("reachowl_local_campaigns", JSON.stringify([data.campaign, ...prev]));
        }
      }

      // Alihkan kembali ke halaman utama /campaigns
      router.push("/campaigns");
    } catch (err) {
      console.error("Gagal meluncurkan campaign:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 text-xs font-medium text-ink/60 hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Campaigns</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-ink/40 uppercase tracking-wider">Mode</span>
          <span className="rounded-[3px] bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent uppercase">
            Wizard
          </span>
        </div>
      </div>

      {/* Main Campaign Builder Container Card */}
      <div className="rounded-[6px] border border-ink/15 bg-white shadow-xs overflow-hidden">
        {/* ========================================================================= */}
        {/* TOP WIZARD HEADER & STEPPER (Sesuai Desain Gambar Pengguna)                */}
        {/* ========================================================================= */}
        <div className="p-8 sm:p-10 text-center bg-[#FAFAFA] border-b border-ink/10">
          {/* Stepper Circles: 1, 2, 3, 4 */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6">
            {[1, 2, 3, 4].map((stepNum) => {
              const isActive = currentStep === stepNum;
              const isPast = currentStep > stepNum;

              return (
                <div key={stepNum} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isPast) setCurrentStep(stepNum as Step);
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-bold transition-all shadow-2xs ${
                      isActive
                        ? "bg-[#2D2D2D] text-white ring-4 ring-ink/10 scale-105"
                        : isPast
                        ? "bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700"
                        : "bg-ink/5 text-ink/40 border border-ink/10 cursor-not-allowed"
                    }`}
                  >
                    {isPast ? <Check className="h-4 w-4 stroke-[3]" /> : stepNum}
                  </button>

                  {stepNum < 4 && (
                    <div
                      className={`h-[2px] w-6 sm:w-10 ml-3 sm:ml-4 transition-colors ${
                        currentStep > stepNum ? "bg-emerald-500" : "bg-ink/10"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Platform Selector Switch (Facebook vs Instagram) */}
          <div className="inline-flex items-center p-1 rounded-[5px] bg-[#EDE8DF]/60 border border-ink/10 mb-5">
            <button
              type="button"
              onClick={() => handlePlatformChange("Facebook")}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-[4px] text-xs font-semibold transition-all ${
                platform === "Facebook"
                  ? "bg-[#1877F2] text-white shadow-xs"
                  : "text-ink/65 hover:text-ink"
              }`}
            >
              <div className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                f
              </div>
              <span>Facebook Campaign</span>
            </button>

            <button
              type="button"
              onClick={() => handlePlatformChange("Instagram")}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-[4px] text-xs font-semibold transition-all ${
                platform === "Instagram"
                  ? "bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white shadow-xs"
                  : "text-ink/65 hover:text-ink"
              }`}
            >
              <InstagramIcon className="h-3.5 w-3.5" />
              <span>Instagram Campaign</span>
            </button>
          </div>

          {/* Heading Sesuai Gambar */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                How do you want to add prospects?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-ink/60">
                To start off, choose how you want to add prospects to your campaign.
              </p>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                {selectedMethod === "fb_group_members" ? "Select the facebook group" : "Target Setup & Audience Source"}
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-ink/60">
                {selectedMethod === "fb_group_members"
                  ? "Select your facebook group to start extracting audience for your campaign."
                  : "Tentukan link sumber postingan/komentar dan kriteria prospek yang ingin dijangkau."}
              </p>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                Message Sequence & Follow-ups
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-ink/60">
                Tulis pesan pembuka personal dengan variabel cerdas untuk meningkatkan tingkat balasan.
              </p>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                Campaign Settings & Safety Limits
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-ink/60">
                Konfirmasi nama campaign, batas kecepatan kirim, dan aktifkan otomatisasi.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: PILIH METODE PROSPECT (SESUAI GAMBAR PENGGUNA)                    */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="p-8 sm:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(platform === "Facebook" ? FB_METHODS : IG_METHODS).map((method) => {
                const isSelected = selectedMethod === method.id;

                return (
                  <div
                    key={method.id}
                    onClick={() => handleSelectMethodAndProceed(method)}
                    className={`relative flex flex-col items-center justify-between rounded-[8px] p-8 text-center transition-all duration-200 cursor-pointer border group hover:-translate-y-1 ${
                      isSelected
                        ? "bg-[#FFF6E7] border-accent ring-2 ring-accent/60 shadow-md"
                        : "bg-[#FFF9EE] hover:bg-[#FFF3DD] border-[#F2E1C4] hover:border-accent/40 shadow-2xs"
                    }`}
                  >
                    {/* Badge Recommended jika ada */}
                    {method.recommended && (
                      <span className="absolute top-3 right-3 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[9px] font-bold text-accent uppercase tracking-wider">
                        Populer
                      </span>
                    )}

                    {/* Illustration Icon Container dengan FB / IG Logo Badge */}
                    <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
                      {/* Lingkaran Background Hangat */}
                      <div className="absolute inset-0 rounded-full bg-[#FCE8C3]/80 group-hover:scale-105 transition-transform" />

                      {/* Floating Platform Badge di Pojok Kiri Atas Icon (Sesuai Gambar) */}
                      <div
                        className={`absolute -top-1 left-1 z-10 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-white ${
                          platform === "Facebook"
                            ? "bg-[#1877F2]"
                            : "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]"
                        }`}
                      >
                        {platform === "Facebook" ? (
                          <span className="font-bold text-xs">f</span>
                        ) : (
                          <InstagramIcon className="h-3.5 w-3.5" />
                        )}
                      </div>

                      {/* Icon Tengah Berwarna Oranye-Emas Sesuai Screenshot */}
                      {method.iconType === "group" && (
                        <div className="relative z-0 text-[#EBA741]">
                          <Users className="h-12 w-12 stroke-[1.8] fill-[#F8D293]/50" />
                        </div>
                      )}

                      {method.iconType === "reaction" && (
                        <div className="relative z-0 text-[#EBA741]">
                          <ThumbsUp className="h-12 w-12 stroke-[1.8] fill-[#F8D293]/50" />
                        </div>
                      )}

                      {method.iconType === "comment" && (
                        <div className="relative z-0 text-[#EBA741]">
                          <MessageSquare className="h-12 w-12 stroke-[1.8] fill-[#F8D293]/50" />
                        </div>
                      )}

                      {method.iconType === "followers" && (
                        <div className="relative z-0 text-[#EBA741]">
                          <Users className="h-12 w-12 stroke-[1.8] fill-[#F8D293]/50" />
                        </div>
                      )}

                      {method.iconType === "hashtag" && (
                        <div className="relative z-0 text-[#EBA741]">
                          <Hash className="h-12 w-12 stroke-[1.8] text-[#EBA741]" />
                        </div>
                      )}
                    </div>

                    {/* Judul & Deskripsi Sesuai Gambar */}
                    <div>
                      <h3 className="font-bold text-base text-ink leading-snug group-hover:text-accent transition-colors">
                        {method.title}
                      </h3>
                      <p className="mt-2 text-xs text-ink/65 leading-relaxed">
                        {method.description}
                      </p>
                    </div>

                    {/* Select & Proceed Pill */}
                    <div className="mt-6 flex items-center justify-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-semibold transition-all ${
                          isSelected
                            ? "bg-accent text-white shadow-xs"
                            : "bg-ink/5 text-ink/60 group-hover:bg-accent group-hover:text-white"
                        }`}
                      >
                        <span>Pilih & Lanjut</span>
                        <ArrowRight className="h-3 w-3 stroke-[2.5]" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-10 pt-6 border-t border-ink/10 flex items-center justify-between">
              <Link
                href="/campaigns"
                className="px-4 py-2 text-xs font-semibold text-ink/60 hover:text-ink transition-colors"
              >
                Batal
              </Link>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-2 rounded-[4px] bg-[#2D2D2D] hover:bg-black px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Lanjut: Target Setup</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: TARGET SETUP & AUDIENCE URL                                       */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="p-8 sm:p-12 max-w-3xl mx-auto space-y-6">
            {selectedMethod === "fb_group_members" ? (
              /* ========================================================================= */
              /* TAMPILAN PERSIS SEPERTI GAMBAR REFERENSI PENGGUNA                         */
              /* ========================================================================= */
              <div className="rounded-[6px] border border-[#EADBCA] bg-[#FFFBF4] p-8 sm:p-10 space-y-6 shadow-2xs">
                {/* Banner Oranye / Amber Sesuai Gambar Referensi */}
                <div className="rounded-[4px] border border-amber-600/50 bg-[#FBBF24]/30 p-4 text-xs font-semibold text-amber-950 leading-relaxed shadow-2xs">
                  To proceed with this campaign, your primary account must be a member of the specified Facebook group.
                </div>

                {/* Link 'Reload fresh list from facebook' Sesuai Gambar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={isScrapingGroups}
                      onClick={handleReloadFreshList}
                      className="text-xs font-semibold text-ink underline hover:text-accent transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 text-ink/70 ${isScrapingGroups ? "animate-spin text-accent" : ""}`} />
                      <span>
                        {isScrapingGroups
                          ? scanProgress && scanProgress.count > 0
                            ? `Memindai... (${scanProgress.count}${scanProgress.expected > 0 ? ` / ${scanProgress.expected}` : ""} grup)`
                            : "Memindai seluruh grup dari Facebook..."
                          : "Reload fresh list from facebook"}
                      </span>
                    </button>

                    {extensionReady && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Extension Bridge Aktif
                      </span>
                    )}
                  </div>

                  {/* Feedback Hasil Scrape */}
                  {scrapeSuccessMessage && (
                    <div className="flex items-center gap-2 rounded-[3px] bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-medium">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{scrapeSuccessMessage}</span>
                    </div>
                  )}

                  {scrapeError && (
                    <div className="flex items-start gap-2 rounded-[4px] bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 font-semibold">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{scrapeError}</span>
                    </div>
                  )}

                  {!extensionReady && !isScrapingGroups && (
                    <div className="flex items-start gap-2 rounded-[4px] bg-ink/5 border border-ink/15 p-3 text-xs text-ink/70">
                      <AlertCircle className="h-4 w-4 text-ink/50 shrink-0 mt-0.5" />
                      <span>
                        Menunggu ekstensi ReachOwl… Jika tidak kunjung aktif, reload ekstensi di <b>chrome://extensions</b> lalu refresh (F5) halaman ini.
                      </span>
                    </div>
                  )}
                </div>

                {/* Select from the list (Dropdown / Search) Sesuai Gambar */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink flex items-center justify-between">
                    <span>Select from the list</span>
                    {facebookGroups.length > 0 && (
                      <span className="font-mono text-[11px] text-ink/50 font-normal">
                        ({facebookGroups.length} grup tersedia)
                      </span>
                    )}
                  </label>

                  {facebookGroups.length > 0 ? (
                    <div className="space-y-3">
                      {/* Search bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/40" />
                        <input
                          type="text"
                          placeholder="Cari atau filter grup Facebook..."
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-[3px] border border-ink/20 bg-white focus:outline-none focus:border-ink font-mono"
                        />
                      </div>

                      {/* List Cards Grup */}
                      <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border border-ink/10 rounded-[4px] p-2 bg-white">
                        {facebookGroups
                          .filter(
                            (g) =>
                              g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                              g.url.toLowerCase().includes(groupSearchQuery.toLowerCase())
                          )
                          .map((grp) => {
                            const isChosen = selectedGroupId === grp.id || targetUrl === grp.url;

                            return (
                              <div
                                key={grp.id}
                                onClick={() => {
                                  setSelectedGroupId(grp.id);
                                  setTargetUrl(grp.url);
                                  setCampaignName(`${grp.name} - Outreach`);
                                }}
                                className={`flex items-center justify-between p-2.5 rounded-[4px] border cursor-pointer transition-all ${
                                  isChosen
                                    ? "border-accent bg-[#FFF5E5] ring-1 ring-accent shadow-xs"
                                    : "border-ink/10 bg-white hover:border-ink/30"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {grp.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={grp.image}
                                      alt=""
                                      referrerPolicy="no-referrer"
                                      className="h-6 w-6 rounded-[4px] object-cover shrink-0"
                                    />
                                  ) : (
                                    <div className="h-6 w-6 rounded-full bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center text-xs font-bold shrink-0">
                                      f
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-ink truncate">{grp.name}</p>
                                    <p className="text-[10px] text-ink/50 font-mono truncate">{grp.url}</p>
                                  </div>
                                </div>

                                <div className="shrink-0 ml-3">
                                  <div
                                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                      isChosen
                                        ? "border-accent bg-accent text-white"
                                        : "border-ink/30 bg-white"
                                    }`}
                                  >
                                    {isChosen && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : (
                    /* Belum ada hasil scrape */
                    <div className="rounded-[4px] border border-dashed border-ink/20 bg-white/60 p-6 text-center">
                      {isScrapingGroups ? (
                        <div className="flex flex-col items-center gap-2">
                          <RotateCcw className="h-5 w-5 animate-spin text-accent" />
                          <p className="text-xs text-ink/80 font-bold">
                            {scanProgress && scanProgress.count > 0
                              ? scanProgress.expected > 0
                                ? `Sedang mengambil grup: ${scanProgress.count} dari ${scanProgress.expected} grup ditemukan...`
                                : `Sedang mengambil grup: ${scanProgress.count} grup ditemukan...`
                              : "Mengambil seluruh daftar grup dari akun Facebook Anda…"}
                          </p>
                          <p className="text-[11px] text-ink/50 max-w-md mx-auto">
                            Ekstensi sedang menggulir halaman Facebook hingga semua grup selesai diambil tanpa ada yang terlewat.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-ink/55">
                          Belum ada grup. Klik <b>&ldquo;Reload fresh list from facebook&rdquo;</b> untuk memuat semua grup.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Tombol Previous & Next Sesuai Gambar */}
                <div className="pt-6 border-t border-ink/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="rounded-[4px] border border-ink/20 bg-white px-5 py-2 text-xs font-semibold text-ink hover:border-ink transition-colors"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={!selectedGroupId || !targetUrl.trim()}
                    onClick={() => setCurrentStep(3)}
                    className="rounded-[4px] bg-[#6B6B6B] hover:bg-[#2E2E2E] px-7 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              /* Form Standar untuk metode selain Group Members */
              <div className="space-y-6">
                <div className="flex items-center gap-2 p-3 rounded-[4px] bg-[#FFF8EB] border border-[#F2DEBF] text-xs">
                  <span className="font-bold text-ink">Metode Terpilih:</span>
                  <span className="font-semibold text-accent">{currentMethodObj.title}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="ml-auto text-accent underline text-[11px]"
                  >
                    Ganti Metode
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink">
                    Target URL / Akun *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://www.facebook.com/permalink.php?story_fbid=..."
                    className="w-full px-3.5 py-2.5 rounded-[3px] border border-ink/20 bg-[#FAF9F5] focus:outline-none focus:border-ink font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink">
                    Filter Kata Kunci (Opsional)
                  </label>
                  <input
                    type="text"
                    value={filterKeywords}
                    onChange={(e) => setFilterKeywords(e.target.value)}
                    placeholder="CEO, Founder, Owner, Marketing"
                    className="w-full px-3.5 py-2.5 rounded-[3px] border border-ink/20 bg-[#FAF9F5] focus:outline-none focus:border-ink font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-ink">Jumlah Prospek yang Ingin Diekstrak</label>
                    <span className="font-mono font-bold text-accent">{maxLeadsToScrape} prospek</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="500"
                    step="10"
                    value={maxLeadsToScrape}
                    onChange={(e) => setMaxLeadsToScrape(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>

                <div className="pt-6 border-t border-ink/10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="rounded-[4px] border border-ink/20 bg-white px-5 py-2 text-xs font-semibold text-ink hover:border-ink"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="rounded-[4px] bg-[#2E2E2E] hover:bg-black px-6 py-2 text-xs font-semibold text-white shadow-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: MESSAGE SEQUENCE & SPINTAX TEMPLATES                              */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="p-8 sm:p-12 max-w-2xl mx-auto space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-ink">
                  Pesan Pembuka (Initial Outreach Message) *
                </label>
                <div className="flex items-center gap-1 text-[11px] font-mono text-ink/50">
                  <span>Variabel:</span>
                  <button
                    type="button"
                    onClick={() => setMessageTemplate((prev) => prev + " {first_name}")}
                    className="bg-ink/5 hover:bg-ink/10 px-1.5 py-0.5 rounded text-ink"
                  >
                    +{"{first_name}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageTemplate((prev) => prev + " {full_name}")}
                    className="bg-ink/5 hover:bg-ink/10 px-1.5 py-0.5 rounded text-ink"
                  >
                    +{"{full_name}"}
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                required
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[3px] border border-ink/20 bg-[#FAF9F5] focus:outline-none focus:border-ink font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Live Message Preview Box */}
            <div className="rounded-[6px] border border-ink/15 bg-paper/50 p-4 space-y-2">
              <p className="font-mono text-[10px] uppercase text-ink/40 tracking-wider flex items-center gap-1.5">
                <Eye className="h-3 w-3" />
                <span>Preview Tampilan di {platform} Messenger:</span>
              </p>
              <div className="flex items-start gap-2.5 bg-white p-3.5 rounded-[6px] border border-ink/10 shadow-2xs">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${
                    platform === "Facebook" ? "bg-[#1877F2]" : "bg-pink-600"
                  }`}
                >
                  f
                </div>
                <div className="text-xs text-ink leading-relaxed">
                  {messageTemplate.replace(/\{first_name\}/g, "Fikri").replace(/\{full_name\}/g, "Fikri Yansyah")}
                </div>
              </div>
            </div>

            {/* Follow-up Sequence Toggle */}
            <div className="rounded-[4px] border border-ink/10 p-4 space-y-3 bg-[#FAFAFA]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-ink">Kirim Pesan Follow-up Otomatis</p>
                  <p className="text-[11px] text-ink/50">Jika prospek belum membalas pesan pertama</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableFollowUp}
                  onChange={(e) => setEnableFollowUp(e.target.checked)}
                  className="h-4 w-4 accent-accent cursor-pointer"
                />
              </div>

              {enableFollowUp && (
                <div className="space-y-3 pt-2 border-t border-ink/10">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-ink/70">Kirim setelah:</span>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={followUpDelayDays}
                      onChange={(e) => setFollowUpDelayDays(Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded border border-ink/20 font-mono text-xs text-center"
                    />
                    <span className="text-ink/70">hari tanpa balasan</span>
                  </div>

                  <textarea
                    rows={2}
                    value={followUpMessage}
                    onChange={(e) => setFollowUpMessage(e.target.value)}
                    className="w-full px-3 py-2 rounded-[3px] border border-ink/20 bg-white font-mono text-xs"
                    placeholder="Pesan follow-up..."
                  />
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="pt-6 border-t border-ink/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-ink/70 hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Kembali</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="inline-flex items-center gap-2 rounded-[4px] bg-[#2D2D2D] hover:bg-black px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:scale-[1.02]"
              >
                <span>Lanjut: Pengaturan & Launch</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: SETTINGS, SAFETY & LAUNCH                                         */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="p-8 sm:p-12 max-w-2xl mx-auto space-y-6">
            {/* Campaign Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink">Nama Campaign *</label>
              <input
                type="text"
                required
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[3px] border border-ink/20 bg-[#FAF9F5] focus:outline-none focus:border-ink text-xs font-semibold"
              />
            </div>

            {/* Safety Limits Card */}
            <div className="rounded-[6px] border border-emerald-600/30 bg-emerald-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>ReachOwl Anti-Ban Safety Protection</span>
              </div>
              <p className="text-[11px] text-emerald-950/80 leading-relaxed">
                Pesan akan dikirim dari sesi browser Chrome lokal Anda dengan jeda acak manusiawi ({minIntervalSeconds} - {maxIntervalSeconds} detik per pesan) untuk memastikan akun Anda tetap aman 100%.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-white p-2.5 rounded border border-emerald-200">
                  <span className="block font-mono text-[10px] text-ink/40">Batas Pengiriman</span>
                  <span className="font-bold text-ink text-sm">{dailyLimit} pesan/hari</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-emerald-200">
                  <span className="block font-mono text-[10px] text-ink/40">Interval Jeda</span>
                  <span className="font-bold text-ink text-sm">{minIntervalSeconds}-{maxIntervalSeconds} detik acak</span>
                </div>
              </div>
            </div>

            {/* Ringkasan Konfigurasi */}
            <div className="rounded-[4px] border border-ink/10 bg-[#FAF9F5] p-4 text-xs space-y-2">
              <div className="flex justify-between text-ink/60">
                <span>Platform:</span>
                <span className="font-bold text-ink">{platform}</span>
              </div>
              <div className="flex justify-between text-ink/60">
                <span>Sumber Prospek:</span>
                <span className="font-bold text-ink">{currentMethodObj.title}</span>
              </div>
              <div className="flex justify-between text-ink/60">
                <span>Target URL:</span>
                <span className="font-mono text-ink line-clamp-1 max-w-xs">{targetUrl}</span>
              </div>
              <div className="flex justify-between text-ink/60">
                <span>Total Leads Sasaran:</span>
                <span className="font-bold text-accent">{maxLeadsToScrape} prospek</span>
              </div>
            </div>

            {/* Navigation & Launch Button */}
            <div className="pt-6 border-t border-ink/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-ink/70 hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Kembali</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || !campaignName.trim()}
                onClick={handleLaunchCampaign}
                className="inline-flex items-center gap-2 rounded-[4px] bg-[#2D2D2D] hover:bg-black px-7 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Rocket className="h-4 w-4 text-accent animate-pulse" />
                <span>{isSubmitting ? "Meluncurkan..." : "Luncurkan Campaign Sekarang 🚀"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
