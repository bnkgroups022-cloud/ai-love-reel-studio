import "server-only";
import { env } from "@/lib/env";
import { supabaseAdmin } from "./server";

// Private bucket access. Files are only ever shared through short-lived signed URLs.

export interface Storage {
  upload(path: string, data: Buffer, contentType: string): Promise<void>;
  /** Returns null when the object does not exist (e.g. expired or deleted). */
  signedUrl(path: string, expiresInSeconds: number, downloadName?: string): Promise<string | null>;
  signedUrls(paths: string[], expiresInSeconds: number): Promise<Map<string, string>>;
  download(path: string): Promise<Buffer>;
  list(prefix: string): Promise<string[]>;
  remove(paths: string[]): Promise<void>;
}

export const storage: Storage = {
  async upload(path, data, contentType) {
    const { error } = await supabaseAdmin().storage.from(env().storageBucket).upload(path, data, { contentType, upsert: true });
    if (error) throw new Error(`Could not save file to storage: ${error.message}`);
  },

  async signedUrl(path, expiresInSeconds, downloadName) {
    const { data, error } = await supabaseAdmin()
      .storage.from(env().storageBucket)
      .createSignedUrl(path, expiresInSeconds, downloadName ? { download: downloadName } : undefined);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  },

  async signedUrls(paths, expiresInSeconds) {
    const out = new Map<string, string>();
    if (paths.length === 0) return out;
    const { data, error } = await supabaseAdmin().storage.from(env().storageBucket).createSignedUrls(paths, expiresInSeconds);
    if (error || !data) return out;
    for (const item of data) {
      if (item.path && item.signedUrl && !item.error) out.set(item.path, item.signedUrl);
    }
    return out;
  },

  async download(path) {
    const { data, error } = await supabaseAdmin().storage.from(env().storageBucket).download(path);
    if (error || !data) throw new Error(`Could not read file from storage: ${error?.message ?? "not found"}`);
    return Buffer.from(await data.arrayBuffer());
  },

  async list(prefix) {
    const bucket = supabaseAdmin().storage.from(env().storageBucket);
    const out: string[] = [];
    const walk = async (dir: string) => {
      const { data, error } = await bucket.list(dir, { limit: 1000 });
      if (error) throw new Error(`Could not list storage: ${error.message}`);
      for (const entry of data ?? []) {
        const full = dir ? `${dir}/${entry.name}` : entry.name;
        // Folders have no id in Supabase Storage listings.
        if (entry.id === null) await walk(full);
        else out.push(full);
      }
    };
    await walk(prefix.replace(/\/$/, ""));
    return out;
  },

  async remove(paths) {
    if (paths.length === 0) return;
    const { error } = await supabaseAdmin().storage.from(env().storageBucket).remove(paths);
    if (error) throw new Error(`Could not delete files from storage: ${error.message}`);
  },
};
