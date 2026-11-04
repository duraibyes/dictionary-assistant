// Decides where an answer comes from: offline dictionary first, saved AI answers next,
// and a new AI call only when it is really needed (and the phone is online).
import type { SQLiteDatabase } from "expo-sqlite";
import { askAi } from "./api";
import { findWord, getCachedAi, putCachedAi, searchTamil, shortMeaning, type DictRow } from "./dictionary";
import type { Settings } from "./settings";
import type { AiResult, Entry, Kind } from "./types";

const TAMIL = /[஀-௿]/;

export function isTamil(text: string) {
  return TAMIL.test(text);
}

function wordsOf(text: string) {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

function emptyEntry(query: string, kind: Kind): Entry {
  return {
    query,
    kind,
    headword: query,
    ipa: "",
    pronunciationTa: "",
    tamil: [],
    senses: [],
    explanationTa: "",
    betterEnglish: "",
    examples: [],
    fromDictionary: false,
    fromAi: false,
  };
}

function fromDict(query: string, row: DictRow): Entry {
  return {
    ...emptyEntry(query, row.word.includes(" ") ? "phrase" : "word"),
    headword: row.word,
    ipa: row.ipa,
    pronunciationTa: row.pronTa,
    tamil: row.tamil,
    senses: row.senses,
    examples: row.examples.map((en) => ({ en, ta: "" })),
    fromDictionary: true,
  };
}

/** Fold an AI answer into an entry. Offline data stays; the AI fills gaps and adds Tamil example translations. */
export function mergeAi(entry: Entry, ai: AiResult): Entry {
  const e: Entry = { ...entry, fromAi: true, aiError: undefined };
  e.kind = entry.fromDictionary ? entry.kind : ai.kind;
  if (!entry.fromDictionary) e.headword = ai.headword || entry.headword;
  e.ipa = entry.ipa || ai.ipa;
  e.pronunciationTa = entry.pronunciationTa || ai.pronunciation_ta;
  e.explanationTa = ai.explanation_ta;
  if (ai.meanings_ta.length) {
    // AI meanings are short and modern; show them first, keep the dictionary's long list after.
    e.tamil = [{ pos: ai.pos, ta: ai.meanings_ta }, ...entry.tamil];
  }
  if (ai.kind === "sentence" || ai.kind === "tamil_to_english") {
    e.betterEnglish = ai.definition_en;
  } else if (ai.definition_en && !entry.senses.length) {
    e.senses = [{ pos: ai.pos, def: ai.definition_en }];
  }
  if (ai.examples.length) e.examples = ai.examples;
  return e;
}

/** Does this offline entry have gaps worth one AI call? */
function needsAi(e: Entry) {
  return !e.tamil.length || e.examples.length < 3;
}

export interface LookupOptions {
  db: SQLiteDatabase;
  settings: Settings;
  online: boolean;
  /** true when the user tapped "Ask AI" — skip the "do we need it" check. */
  forceAi?: boolean;
}

/**
 * Returns the first answer as fast as possible, and calls `onUpdate` again if an AI answer arrives later.
 */
export async function lookup(query: string, opts: LookupOptions, onUpdate: (e: Entry) => void): Promise<Entry> {
  const q = query.trim();
  const { db, settings, online, forceAi } = opts;

  // 1. Something we already asked the AI about: free and instant, works offline.
  const cached = await getCachedAi(q);

  // 2. Tamil input → English.
  if (isTamil(q)) {
    let entry = emptyEntry(q, "tamil_to_english");
    entry.candidates = await searchTamil(db, q);
    if (cached) return mergeAi(entry, cached);
    if (!online) return entry;
    return withAi(entry, q, opts, onUpdate, entry.candidates.length ? "" : undefined);
  }

  const words = wordsOf(q);

  // 3. A word or phrase found in the offline dictionary.
  const row = words.length <= 4 ? await findWord(db, q) : null;
  if (row) {
    let entry = fromDict(q, row);
    if (cached) return mergeAi(entry, cached);
    if (online && (forceAi || (settings.autoAi && needsAi(entry)))) {
      onUpdate(entry); // show the offline answer right away
      return withAi(entry, row.word, opts, onUpdate, `dictionary headword: ${row.word}`);
    }
    return entry;
  }

  // 4. A sentence, or a word the dictionary does not know.
  const kind: Kind = words.length >= 4 ? "sentence" : words.length > 1 ? "phrase" : "word";
  let entry = emptyEntry(q, kind);
  if (words.length > 1) {
    const breakdown = [];
    for (const w of words.slice(0, 25)) breakdown.push({ word: w, ta: await shortMeaning(db, w) });
    entry.breakdown = breakdown;
  }
  if (cached) return mergeAi(entry, cached);
  if (!online) return entry;
  if (entry.breakdown) onUpdate(entry);
  return withAi(entry, q, opts, onUpdate);
}

async function withAi(
  entry: Entry,
  askFor: string,
  opts: LookupOptions,
  onUpdate: (e: Entry) => void,
  hint?: string,
): Promise<Entry> {
  try {
    const ai = await askAi(opts.settings, askFor, hint || undefined);
    await putCachedAi(entry.query, ai);
    if (askFor !== entry.query) await putCachedAi(askFor, ai);
    const merged = mergeAi(entry, ai);
    onUpdate(merged);
    return merged;
  } catch (e) {
    const failed = { ...entry, aiError: (e as Error).message };
    onUpdate(failed);
    return failed;
  }
}
