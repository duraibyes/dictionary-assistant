// Offline lookups against the bundled dictionary (read-only) and the answer cache (writable).
import type { SQLiteDatabase } from "expo-sqlite";
import * as SQLite from "expo-sqlite";
import type { AiResult, Example, Sense, TamilGroup } from "./types";

export interface DictRow {
  word: string;
  tamil: TamilGroup[];
  senses: Sense[];
  examples: string[];
  ipa: string;
  pronTa: string;
}

const parse = <T,>(s: string | null, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

/** Surface forms → dictionary forms to try: "running" → run, "studies" → study, "went" stays. */
export function lemmaCandidates(word: string): string[] {
  const w = word.toLowerCase().trim();
  const out = [w];
  const add = (x: string) => x.length > 1 && !out.includes(x) && out.push(x);
  if (w.endsWith("'s")) add(w.slice(0, -2));
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  if (w.endsWith("es")) add(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss")) add(w.slice(0, -1));
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) add(w.slice(0, -3)); // stopped → stop
  }
  if (w.endsWith("ing")) {
    add(w.slice(0, -3));
    add(w.slice(0, -3) + "e");
    if (w.length > 5 && w[w.length - 4] === w[w.length - 5]) add(w.slice(0, -4)); // running → run
  }
  if (w.endsWith("er")) add(w.slice(0, -2));
  if (w.endsWith("est")) add(w.slice(0, -3));
  if (w.endsWith("ly")) add(w.slice(0, -2));
  if (w.endsWith("ily")) add(w.slice(0, -3) + "y");
  return out;
}

export async function findWord(db: SQLiteDatabase, text: string): Promise<DictRow | null> {
  const clean = text.toLowerCase().replace(/[^a-z' -]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const candidates = clean.includes(" ") ? [clean] : lemmaCandidates(clean);
  for (const c of candidates) {
    const r = await db.getFirstAsync<{
      word: string;
      tamil: string | null;
      senses: string | null;
      examples: string | null;
      ipa: string | null;
      pron_ta: string | null;
    }>("SELECT word, tamil, senses, examples, ipa, pron_ta FROM words WHERE word = ?", c);
    if (r) {
      return {
        word: r.word,
        tamil: parse<TamilGroup[]>(r.tamil, []),
        senses: parse<Sense[]>(r.senses, []),
        examples: parse<string[]>(r.examples, []),
        ipa: r.ipa ?? "",
        pronTa: r.pron_ta ?? "",
      };
    }
  }
  return null;
}

/** Short Tamil meaning for one word, used in the offline sentence breakdown. */
export async function shortMeaning(db: SQLiteDatabase, word: string): Promise<string> {
  const row = await findWord(db, word);
  if (!row) return "";
  return row.tamil.flatMap((g) => g.ta).slice(0, 3).join(", ");
}

/** Tamil → English offline: exact match first, then words whose Tamil meaning starts with the text. */
export async function searchTamil(db: SQLiteDatabase, text: string, limit = 12) {
  const t = text.trim();
  const rows = await db.getAllAsync<{ word: string; term: string }>(
    `SELECT word, term FROM ta_index WHERE term >= ? AND term < ? ORDER BY (term = ?) DESC, rank, length(term) LIMIT ?`,
    t,
    t + "￿",
    t,
    limit,
  );
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.word) && seen.add(r.word)).map((r) => ({ word: r.word, ta: r.term }));
}

// ---------------------------------------------------------------- answer cache (AI results + history)

let cacheDb: SQLiteDatabase | null = null;

async function cache(): Promise<SQLiteDatabase> {
  if (cacheDb) return cacheDb;
  const db = await SQLite.openDatabaseAsync("cache.db");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ai_cache (key TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS history (query TEXT PRIMARY KEY NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `);
  cacheDb = db;
  return db;
}

export const cacheKey = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim();

export async function getCachedAi(query: string): Promise<AiResult | null> {
  const db = await cache();
  const r = await db.getFirstAsync<{ json: string }>("SELECT json FROM ai_cache WHERE key = ?", cacheKey(query));
  return r ? parse<AiResult | null>(r.json, null) : null;
}

export async function putCachedAi(query: string, result: AiResult): Promise<void> {
  const db = await cache();
  await db.runAsync(
    "INSERT OR REPLACE INTO ai_cache (key, json, at) VALUES (?, ?, ?)",
    cacheKey(query),
    JSON.stringify(result),
    Date.now(),
  );
}

export async function addHistory(query: string): Promise<void> {
  const db = await cache();
  await db.runAsync("INSERT OR REPLACE INTO history (query, at) VALUES (?, ?)", query.trim(), Date.now());
  await db.runAsync("DELETE FROM history WHERE query NOT IN (SELECT query FROM history ORDER BY at DESC LIMIT 50)");
}

export async function getHistory(limit = 20): Promise<string[]> {
  const db = await cache();
  const rows = await db.getAllAsync<{ query: string }>("SELECT query FROM history ORDER BY at DESC LIMIT ?", limit);
  return rows.map((r) => r.query);
}

export async function clearHistory(): Promise<void> {
  const db = await cache();
  await db.runAsync("DELETE FROM history");
}

/** Small JSON store (e.g. the current Teacher conversation). */
export async function getJson<T>(key: string, fallback: T): Promise<T> {
  const db = await cache();
  const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
  return r ? parse<T>(r.value, fallback) : fallback;
}

export async function setJson(key: string, value: unknown): Promise<void> {
  const db = await cache();
  await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", key, JSON.stringify(value));
}

export type { Example };
