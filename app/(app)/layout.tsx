import { Suspense, type ReactNode } from "react";
import AppShell from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/lib/auth";

async function UserEmail() {
  const user = await getCurrentUser();
  return <span className="font-mono text-xs text-ink/60">{user.email}</span>;
}

/**
 * Layout for every signed-in page. Put new pages in app/(app)/<name>/page.tsx
 * and register them in lib/navigation.ts to show them in the sidebar.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      userSlot={
        <Suspense fallback={<span className="block h-3 w-40 rounded-sm bg-ink/10" />}>
          <UserEmail />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
