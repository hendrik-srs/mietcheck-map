import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client — uses the secret key and bypasses Row Level Security.
 * ONLY use server-side, in trusted contexts (background jobs, ingestion scripts,
 * admin API routes). Never expose this client or its key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing Supabase admin credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are set.",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
