export type Kind = "word" | "phrase" | "sentence" | "tamil_to_english";

export interface Example {
  en: string;
  ta: string;
}

export interface TamilGroup {
  pos: string;
  ta: string[];
}

export interface Sense {
  pos: string;
  def: string;
}

/** What the backend returns inside `result`. */
export interface AiResult {
  kind: Kind;
  query: string;
  headword: string;
  ipa: string;
  pronunciation_ta: string;
  pos: string;
  meanings_ta: string[];
  definition_en: string;
  explanation_ta: string;
  examples: Example[];
}

/** One answer shown on screen, built from the offline dictionary, the AI, or both. */
export interface Entry {
  query: string;
  kind: Kind;
  headword: string;
  ipa: string;
  pronunciationTa: string;
  tamil: TamilGroup[];
  senses: Sense[];
  explanationTa: string;
  /** English corrected/natural version for sentences. */
  betterEnglish: string;
  examples: Example[];
  /** Offline sentence help: meaning of each word. */
  breakdown?: { word: string; ta: string }[];
  /** Offline Tamil → English: candidate English words. */
  candidates?: { word: string; ta: string }[];
  fromDictionary: boolean;
  fromAi: boolean;
  /** Set when the AI could not be reached; the offline part is still shown. */
  aiError?: string;
}
