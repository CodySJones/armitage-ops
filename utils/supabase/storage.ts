import { createClient } from "@supabase/supabase-js";

const BUCKET = "ops-photos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase storage env vars not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function uploadFile(file: File, storagePath: string): Promise<void> {
  const bytes = await file.arrayBuffer();
  const { error } = await adminClient()
    .storage.from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
  if (error) throw error;
}

export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function getSignedUrls(storagePaths: string[]): Promise<Record<string, string>> {
  if (!storagePaths.length) return {};
  const { data, error } = await adminClient()
    .storage.from(BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_TTL);
  if (error || !data) return {};
  return Object.fromEntries(
    data.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl!])
  );
}
