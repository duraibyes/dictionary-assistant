// "English Teacher" mode: every message is checked, corrected and explained in Tamil,
// and the teacher keeps the conversation going.

import type { ChatMessage } from "./providers";

export interface Mistake {
  wrong: string;
  right: string;
  why_ta: string;
}

export interface TutorTurn {
  /** What the learner meant, in natural English (their sentence corrected, or the English for their Tamil). */
  corrected: string;
  /** true when the learner's English was already fine (or they wrote Tamil / asked a question). */
  is_correct: boolean;
  mistakes: Mistake[];
  /** Up to 3 other natural ways to say the same thing. */
  better_ways: string[];
  /** Tamil meaning of what the learner said / meant. */
  meaning_ta: string;
  /** The teacher's spoken reply in simple English, ending with a question to keep practising. */
  reply: string;
  reply_ta: string;
  /** One short tip in Tamil, or "". */
  tip_ta: string;
}

export function tutorSystem(topic?: string): string {
  const scene = topic
    ? `Role-play this situation with the learner and stay in it: "${topic}". You play the other person (e.g. interviewer, shopkeeper, colleague), but still correct their English.`
    : "Have a friendly everyday conversation about whatever the learner wants to talk about.";
  return `You are a kind, patient English teacher for a Tamil speaker who wants to speak English confidently.
${scene}

The learner may write or speak (voice-to-text, so ignore missing punctuation and capital letters) in:
- English → check it. Correct grammar, wrong words and unnatural phrasing. Do not nitpick punctuation or capitals.
- Tamil, or Tamil in English letters (e.g. "naan office ku late ah poiten") → give the natural English for it in "corrected", and treat is_correct as true.
- A question like "how do I say …", "is this correct?", "what is the difference between …" → answer it in "reply" and use "better_ways" for example sentences.

Reply with ONE JSON object only — no markdown, no code fences:
{
  "corrected": the learner's sentence in correct, natural English (same meaning, keep it close to what they said),
  "is_correct": true if their English had no real mistakes,
  "mistakes": [ { "wrong": exact wrong part, "right": fixed part, "why_ta": one short simple Tamil explanation } ] (max 4, [] if none),
  "better_ways": up to 3 other natural ways a native speaker would say it (short, everyday English),
  "meaning_ta": Tamil meaning of what they said,
  "reply": your reply as the teacher / role-play partner: 1–3 short simple English sentences, ending with ONE question that keeps them talking,
  "reply_ta": Tamil translation of your reply,
  "tip_ta": one short useful tip in Tamil related to their mistake, or ""
}
Use simple words (CEFR A2–B1). Everyday spoken Tamil, not literary Tamil. Be encouraging — praise briefly when they do well.`;
}

export function parseTutor(raw: string): TutorTurn {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON in model reply");
  const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const turn: TutorTurn = {
    corrected: str(o.corrected),
    is_correct: o.is_correct === true || o.is_correct === "true",
    mistakes: Array.isArray(o.mistakes)
      ? o.mistakes
          .map((m) => ({ wrong: str((m as Mistake)?.wrong), right: str((m as Mistake)?.right), why_ta: str((m as Mistake)?.why_ta) }))
          .filter((m) => m.wrong || m.right)
          .slice(0, 4)
      : [],
    better_ways: Array.isArray(o.better_ways) ? o.better_ways.map(str).filter(Boolean).slice(0, 3) : [],
    meaning_ta: str(o.meaning_ta),
    reply: str(o.reply),
    reply_ta: str(o.reply_ta),
    tip_ta: str(o.tip_ta),
  };
  if (!turn.reply && !turn.corrected) throw new Error("model reply had no usable content");
  if (turn.mistakes.length) turn.is_correct = false;
  return turn;
}

/**
 * The app sends the visible history (learner text + teacher replies). Past teacher turns are
 * re-sent as their JSON so the model keeps the same format. Only the last 12 turns are kept.
 */
export function toMessages(history: { role: "user" | "teacher"; text: string }[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const h of history.slice(-12)) {
    if (!h.text.trim()) continue;
    const role = h.role === "user" ? "user" : "assistant";
    const content = role === "user" ? h.text.slice(0, 600) : JSON.stringify({ reply: h.text.slice(0, 600) });
    if (!out.length && role === "assistant") continue; // providers want the user to speak first
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content += "\n" + content; // keep roles alternating
    else out.push({ role, content });
  }
  return out;
}
