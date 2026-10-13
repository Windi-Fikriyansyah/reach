import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  lastSignInAt: string | null;
};

/**
 * Data Access Layer: single place to read the signed-in user.
 * Reads cookies, so callers must render inside a <Suspense> boundary
 * (required by cacheComponents). Deduped per request via React cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Supabase validates token expiry with Date.now(); opt into request time first.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return {
    id: user.id,
    email: user.email ?? "",
    lastSignInAt: user.last_sign_in_at ?? null,
  };
});
