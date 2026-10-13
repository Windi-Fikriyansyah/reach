"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "block w-full h-11 rounded-[3px] border border-[#1B1A17]/20 bg-white px-3 text-[15px] text-[#1B1A17] placeholder:text-[#1B1A17]/30 outline-none transition-colors hover:border-[#1B1A17]/40 focus:border-[#1B1A17] focus:ring-[3px] focus:ring-[#E2683C]/25 disabled:opacity-50";

const labelClass = "block font-mono text-[11px] uppercase tracking-wider text-[#1B1A17]/60";

function safeRedirect(path: string | null) {
  // Only allow internal paths, block "//evil.com" style redirects
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  return path;
}

function translateError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "Email atau kata sandi salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (m.includes("fetch")) return "Tidak dapat terhubung ke server autentikasi.";
  return message;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirectTo"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const envMissing = !url || !key || url.includes("your-project") || key.includes("your-supabase");

  const busy = isPending || done;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(translateError(signInError.message));
          return;
        }

        setDone(true);
        router.replace(redirectTo);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? translateError(err.message) : "Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate={false} className="space-y-6">
      {envMissing && (
        <div className="border-l-2 border-[#C9A227] bg-[#C9A227]/10 px-4 py-3 text-[13px] leading-relaxed">
          Supabase belum dikonfigurasi. Isi{" "}
          <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
          <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di{" "}
          <code className="font-mono text-[12px]">.env.local</code>.
        </div>
      )}

      {error && (
        <div role="alert" className="border-l-2 border-[#B42318] bg-[#B42318]/[0.06] px-4 py-3 text-[13px] text-[#8A1C12]">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="nama@perusahaan.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className={labelClass}>
            Kata sandi
          </label>
          <button
            type="button"
            id="toggle-password"
            onClick={() => setShowPassword((v) => !v)}
            className="font-mono text-[11px] uppercase tracking-wider text-[#1B1A17]/50 underline-offset-4 hover:text-[#1B1A17] hover:underline"
          >
            {showPassword ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        id="login-submit"
        disabled={busy}
        className="group flex h-11 w-full items-center justify-between rounded-[3px] bg-[#1B1A17] px-4 text-[15px] text-[#F3F0E8] transition-colors hover:bg-[#2E2C27] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#E2683C]/40 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span>{done ? "Mengalihkan…" : isPending ? "Memeriksa…" : "Masuk"}</span>
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 group-disabled:translate-x-0">
          →
        </span>
      </button>
    </form>
  );
}
