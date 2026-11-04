// The single prompt every provider receives. The model must answer with JSON only.

export type Kind = "word" | "phrase" | "sentence" | "tamil_to_english";

export interface Example {
  en: string;
  ta: string;
}

export interface LookupResult {
  kind: Kind;
  query: string;
  /** The English word / phrase / sentence being explained. */
  headword: string;
  ipa: string;
  /** How to say the English in Tamil letters, e.g. "வெர்டிக்ட்". */
  pronunciation_ta: string;
  pos: string;
  meanings_ta: string[];
  definition_en: string;
  /** Short Tamil explanation: when / how to use it, or a correction. */
  explanation_ta: string;
  examples: Example[];
}

export const SYSTEM_PROMPT = `You are an English–Tamil dictionary assistant for a Tamil speaker learning English.
Reply with ONE JSON object only — no markdown, no code fences, no text before or after.

Decide "kind":
- "word": a single English word
- "phrase": an English phrase or idiom (2–5 words)
- "sentence": a full English sentence
- "tamil_to_english": the input is in Tamil (Tamil script or Tamil written in English letters, e.g. "naan veetuku poren") and the user wants it in English

JSON shape (all keys required, use "" or [] when not applicable):
{
  "kind": "word" | "phrase" | "sentence" | "tamil_to_english",
  "query": the user's input exactly,
  "headword": the English word/phrase/sentence (for tamil_to_english: the natural English translation),
  "ipa": IPA pronunciation of headword (only for word/phrase, else ""),
  "pronunciation_ta": how to pronounce the headword written in Tamil letters (e.g. verdict -> "வெர்டிக்ட்"),
  "pos": part of speech in English (e.g. "noun", "verb"; "" for sentences),
  "meanings_ta": 1–5 short Tamil meanings, most common first (for sentences: one natural Tamil translation),
  "definition_en": a simple English definition (for sentences: a corrected/more natural English version, or "" if already fine),
  "explanation_ta": 1–2 short Tamil sentences on when/how it is used,
  "examples": exactly 3 objects {"en": simple everyday English sentence using the headword, "ta": its Tamil translation}
}

Keep English examples short (under 15 words) and natural. Use everyday spoken Tamil, not overly literary Tamil.`;

export function userPrompt(query: string, hint?: string): string {
  let p = `Input: ${query}`;
  if (hint) p += `\nHint: ${hint}`;
  return p;
}

/** Pull the first JSON object out of a model reply and coerce it to LookupResult. */
export function parseResult(raw: string, query: string): LookupResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON in model reply");
  const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strArr = (v: unknown) =>
    Array.isArray(v) ? v.map(str).filter(Boolean) : typeof v === "string" && v ? [v] : [];
  const kinds: Kind[] = ["word", "phrase", "sentence", "tamil_to_english"];
  const kind = kinds.includes(obj.kind as Kind) ? (obj.kind as Kind) : "word";

  const examples: Example[] = Array.isArray(obj.examples)
    ? obj.examples
        .map((e) =>
          typeof e === "string"
            ? { en: e.trim(), ta: "" }
            : { en: str((e as Example)?.en), ta: str((e as Example)?.ta) },
        )
        .filter((e) => e.en)
        .slice(0, 3)
    : [];

  const result: LookupResult = {
    kind,
    query,
    headword: str(obj.headword) || query,
    ipa: str(obj.ipa),
    pronunciation_ta: str(obj.pronunciation_ta),
    pos: str(obj.pos),
    meanings_ta: strArr(obj.meanings_ta).slice(0, 5),
    definition_en: str(obj.definition_en),
    explanation_ta: str(obj.explanation_ta),
    examples,
  };
  if (!result.meanings_ta.length && !result.examples.length && !result.definition_en) {
    throw new Error("model reply had no usable content");
  }
  return result;
}
