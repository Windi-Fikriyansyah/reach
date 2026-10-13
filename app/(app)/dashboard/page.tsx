import { Suspense } from "react";
import type { Metadata } from "next";
import { serif } from "@/lib/fonts";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard — ReachOwl",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-ink/10 py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink/50">{label}</dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

async function AccountDetails() {
  const user = await getCurrentUser();
  return (
    <dl>
      <Row label="Email">{user.email}</Row>
      <Row label="User ID">
        <span className="font-mono text-xs text-ink/70">{user.id}</span>
      </Row>
      <Row label="Terakhir masuk">{formatDate(user.lastSignInAt)} WIB</Row>
    </dl>
  );
}

function AccountSkeleton() {
  return (
    <div className="space-y-px">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-t border-ink/10 py-5">
          <div className="h-3 w-1/2 rounded-sm bg-ink/10" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="border-b border-ink pb-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink/50">Ringkasan</p>
        <h1 className={`${serif.className} mt-2 text-5xl tracking-tight`}>Dashboard</h1>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className={`${serif.className} mb-4 text-2xl`}>
            Akun
          </h2>
          <Suspense fallback={<AccountSkeleton />}>
            <AccountDetails />
          </Suspense>
        </section>

        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className={`${serif.className} mb-4 text-2xl`}>
            Aktivitas
          </h2>
          <div className="rounded-[3px] border border-dashed border-ink/25 px-6 py-10 text-center">
            <p className="text-sm text-ink/60">Belum ada aktivitas untuk ditampilkan.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
