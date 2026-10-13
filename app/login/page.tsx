import { Suspense } from "react";
import type { Metadata } from "next";
import OwlMark from "@/components/owl-mark";
import { serif } from "@/lib/fonts";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Masuk — ReachOwl",
  description: "Masuk ke ReachOwl. Akses hanya untuk akun yang terdaftar.",
};

export default function LoginPage() {
  return (
    <div className="flex-1 grid min-h-screen bg-paper text-ink lg:grid-cols-[1.05fr_1fr]">
      {/* Left — brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between bg-ink text-paper px-14 py-12">
        <div className="flex items-center gap-3">
          <OwlMark className="h-5 w-auto" />
          <span className="text-sm tracking-[0.18em] uppercase">ReachOwl</span>
        </div>

        <div className="max-w-md">
          <p className={`${serif.className} text-[3.4rem] leading-[1.02] tracking-tight`}>
            Melihat lebih jauh,
            <br />
            <em className="text-[#E2683C]">bahkan dalam gelap.</em>
          </p>
          <div className="mt-8 h-px w-16 bg-[#F3F0E8]/30" />
          <p className="mt-6 text-sm leading-relaxed text-[#F3F0E8]/60">
            Ruang kerja internal. Akun dibuat dan dikelola oleh administrator —
            tidak ada pendaftaran publik.
          </p>
        </div>

        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-[#F3F0E8]/40">
          <span>© 2026 ReachOwl</span>
          <span>Akses terbatas</span>
        </div>
      </aside>

      {/* Right — form */}
      <main className="flex flex-col px-6 py-10 sm:px-12 lg:px-16">
        <div className="flex items-center gap-3 lg:hidden">
          <OwlMark className="h-4 w-auto" />
          <span className="text-xs tracking-[0.18em] uppercase">ReachOwl</span>
        </div>

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-[380px]">
            <h1 className={`${serif.className} text-5xl tracking-tight`}>Masuk</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#1B1A17]/60">
              Gunakan email dan kata sandi yang diberikan administrator.
            </p>

            <div className="mt-10">
              <Suspense fallback={<div className="h-72" />}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>

        <p className="font-mono text-[11px] uppercase tracking-wider text-[#1B1A17]/40">
          Belum punya akun? Hubungi administrator.
        </p>
      </main>
    </div>
  );
}
