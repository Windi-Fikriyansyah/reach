import { redirect } from "next/navigation";

// Auth is enforced by proxy.ts: signed-out users hitting /dashboard are sent to /login.
export default function Home() {
  redirect("/dashboard");
}
