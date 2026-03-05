import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

export function isConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getClient() {
  if (!supabase && isConfigured()) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

// ─── KIDS ──────────────────────────────────────────────────────────
export async function loadKids() {
  const { data, error } = await getClient().from("kids").select("*").order("id");
  if (error) throw error;
  return data;
}

export async function upsertKid(kid) {
  const { error } = await getClient().from("kids").upsert({
    id: kid.id, name: kid.name, age: kid.age, emoji: kid.emoji, color: kid.color,
  });
  if (error) throw error;
}

export async function seedKids(kids) {
  const rows = kids.map(k => ({ id: k.id, name: k.name, age: k.age, emoji: k.emoji, color: k.color }));
  const { error } = await getClient().from("kids").upsert(rows);
  if (error) throw error;
}

// ─── LOGS ──────────────────────────────────────────────────────────
export async function loadLogs() {
  const { data, error } = await getClient().from("logs").select("*").order("ts", { ascending: false });
  if (error) throw error;
  // Map snake_case to camelCase
  return data.map(l => ({ id: l.id, kidId: l.kid_id, type: l.type, label: l.label, emoji: l.emoji, weight: l.weight, ts: l.ts }));
}

export async function insertLog(log) {
  const { error } = await getClient().from("logs").insert({
    id: String(log.id), kid_id: log.kidId, type: log.type,
    label: log.label, emoji: log.emoji, weight: log.weight, ts: log.ts,
  });
  if (error) throw error;
}

export async function deleteLog(id) {
  const { error } = await getClient().from("logs").delete().eq("id", String(id));
  if (error) throw error;
}

export async function deleteLogsByIds(ids) {
  const { error } = await getClient().from("logs").delete().in("id", ids.map(String));
  if (error) throw error;
}

// ─── CUSTOM GOOD DEEDS ────────────────────────────────────────────
export async function loadCustomGoodDeeds() {
  const { data, error } = await getClient().from("custom_good_deeds").select("*").order("id");
  if (error) throw error;
  return data;
}

export async function insertCustomGoodDeed(deed) {
  const { data, error } = await getClient().from("custom_good_deeds").insert({ label: deed.label, emoji: deed.emoji }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCustomGoodDeed(id) {
  const { error } = await getClient().from("custom_good_deeds").delete().eq("id", id);
  if (error) throw error;
}

// ─── CUSTOM BAD DEEDS ─────────────────────────────────────────────
export async function loadCustomBadDeeds() {
  const { data, error } = await getClient().from("custom_bad_deeds").select("*").order("id");
  if (error) throw error;
  return data;
}

export async function insertCustomBadDeed(deed) {
  const { data, error } = await getClient().from("custom_bad_deeds").insert({ label: deed.label, emoji: deed.emoji }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCustomBadDeed(id) {
  const { error } = await getClient().from("custom_bad_deeds").delete().eq("id", id);
  if (error) throw error;
}

// ─── REALTIME ──────────────────────────────────────────────────────
export function subscribeToAll({ onKids, onLogs, onCustomGoodDeeds, onCustomBadDeeds }) {
  const client = getClient();
  if (!client) return null;
  const channel = client
    .channel("all_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "kids" }, () => onKids?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "logs" }, () => onLogs?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "custom_good_deeds" }, () => onCustomGoodDeeds?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "custom_bad_deeds" }, () => onCustomBadDeeds?.())
    .subscribe();
  return channel;
}

// ─── UTILS ─────────────────────────────────────────────────────────
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
