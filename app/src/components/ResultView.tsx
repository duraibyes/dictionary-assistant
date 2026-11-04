import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import type { Entry, TamilGroup } from "../types";
import { colors, common } from "../theme";

interface Props {
  entry: Entry;
  online: boolean;
  aiBusy: boolean;
  onAskAi: () => void;
  onSearch: (text: string) => void;
}

const POS_TA: Record<string, string> = {
  noun: "பெயர்ச்சொல்",
  verb: "வினைச்சொல்",
  adjective: "பெயரடை",
  adverb: "வினையடை",
  preposition: "முன்னிடைச்சொல்",
  conjunction: "இணைப்புச்சொல்",
  pronoun: "பதிலிடுபெயர்",
  interjection: "வியப்பிடைச்சொல்",
};

function speak(text: string, slow = false) {
  Speech.stop();
  Speech.speak(text, { language: "en-US", rate: slow ? 0.55 : 0.95 });
}

function SpeakButtons({ text }: { text: string }) {
  return (
    <View style={styles.speakRow}>
      <Pressable style={styles.speak} onPress={() => speak(text)} accessibilityLabel="Play pronunciation">
        <Text style={styles.speakText}>🔊</Text>
      </Pressable>
      <Pressable style={styles.speak} onPress={() => speak(text, true)} accessibilityLabel="Play slowly">
        <Text style={styles.speakText}>🐢</Text>
      </Pressable>
    </View>
  );
}

function TamilMeanings({ groups }: { groups: TamilGroup[] }) {
  const [all, setAll] = useState(false);
  const LIMIT = 8;
  const total = groups.reduce((n, g) => n + g.ta.length, 0);
  let shown = 0;
  return (
    <View>
      {groups.map((g, i) => {
        if (!all && shown >= LIMIT) return null;
        const items = all ? g.ta : g.ta.slice(0, LIMIT - shown);
        shown += items.length;
        return (
          <View key={i} style={styles.group}>
            {g.pos ? <Text style={styles.pos}>{POS_TA[g.pos] ?? g.pos}</Text> : null}
            <Text style={styles.tamil}>{items.join(", ")}</Text>
          </View>
        );
      })}
      {total > LIMIT && (
        <Pressable onPress={() => setAll(!all)}>
          <Text style={styles.more}>{all ? "குறைவாகக் காட்டு" : `மேலும் ${total - LIMIT} அர்த்தங்கள்`}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ResultView({ entry, online, aiBusy, onAskAi, onSearch }: Props) {
  const isSentence = entry.kind === "sentence" || entry.kind === "tamil_to_english";
  const english = entry.kind === "tamil_to_english" ? entry.betterEnglish || entry.headword : entry.headword;
  const hasEnglishToSay = entry.kind !== "tamil_to_english" || entry.fromAi;

  return (
    <View>
      {/* Headword + pronunciation */}
      <View style={common.card}>
        <View style={styles.headRow}>
          <Text style={[styles.headword, isSentence && styles.headSentence]} selectable>
            {entry.kind === "tamil_to_english" ? entry.query : entry.headword}
          </Text>
          {hasEnglishToSay && entry.kind !== "tamil_to_english" && <SpeakButtons text={english} />}
        </View>
        {!!entry.pronunciationTa && <Text style={styles.pronTa}>{entry.pronunciationTa}</Text>}
        {!!entry.ipa && <Text style={styles.ipa}>{entry.ipa}</Text>}
        <View style={styles.sourceRow}>
          {entry.fromDictionary && <Text style={styles.source}>📘 Dictionary</Text>}
          {entry.fromAi && <Text style={styles.source}>✨ AI (saved)</Text>}
        </View>
      </View>

      {/* Tamil → English answer */}
      {entry.kind === "tamil_to_english" && entry.fromAi && (
        <View style={[common.card, styles.highlight]}>
          <Text style={common.label}>In English</Text>
          <View style={styles.headRow}>
            <Text style={styles.answer} selectable>
              {english}
            </Text>
            <SpeakButtons text={english} />
          </View>
          {!!entry.pronunciationTa && <Text style={styles.pronTa}>{entry.pronunciationTa}</Text>}
        </View>
      )}

      {/* Better English for sentences */}
      {entry.kind === "sentence" && !!entry.betterEnglish && (
        <View style={[common.card, styles.highlight]}>
          <Text style={common.label}>More natural English</Text>
          <View style={styles.headRow}>
            <Text style={styles.answer} selectable>
              {entry.betterEnglish}
            </Text>
            <SpeakButtons text={entry.betterEnglish} />
          </View>
        </View>
      )}

      {/* Tamil meaning */}
      {entry.tamil.length > 0 && (
        <View style={common.card}>
          <Text style={common.label}>{isSentence ? "தமிழில்" : "தமிழ் அர்த்தம்"}</Text>
          <TamilMeanings groups={entry.tamil} />
        </View>
      )}

      {!!entry.explanationTa && (
        <View style={common.card}>
          <Text style={common.label}>எப்போது பயன்படுத்துவது</Text>
          <Text style={styles.body}>{entry.explanationTa}</Text>
        </View>
      )}

      {/* English meaning */}
      {entry.senses.length > 0 && (
        <View style={common.card}>
          <Text style={common.label}>English meaning</Text>
          {entry.senses.map((s, i) => (
            <Text key={i} style={styles.sense}>
              <Text style={styles.sensePos}>{s.pos ? `${s.pos} · ` : ""}</Text>
              {s.def}
            </Text>
          ))}
        </View>
      )}

      {/* Examples */}
      {entry.examples.length > 0 && (
        <View style={common.card}>
          <Text style={common.label}>Example sentences</Text>
          {entry.examples.map((ex, i) => (
            <View key={i} style={[styles.example, i > 0 && styles.exampleBorder]}>
              <View style={styles.headRow}>
                <Text style={styles.exampleEn} selectable>
                  {i + 1}. {ex.en}
                </Text>
                <Pressable onPress={() => speak(ex.en)} hitSlop={8} accessibilityLabel="Play sentence">
                  <Text style={styles.speakText}>🔊</Text>
                </Pressable>
              </View>
              {!!ex.ta && <Text style={styles.exampleTa}>{ex.ta}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Offline: Tamil → English candidates */}
      {entry.candidates && entry.candidates.length > 0 && (
        <View style={common.card}>
          <Text style={common.label}>English words</Text>
          <View style={styles.chips}>
            {entry.candidates.map((c) => (
              <Pressable key={c.word} style={common.chip} onPress={() => onSearch(c.word)}>
                <Text style={common.chipText}>
                  {c.word} <Text style={styles.chipTa}>· {c.ta}</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Offline: word by word */}
      {entry.breakdown && !entry.fromAi && (
        <View style={common.card}>
          <Text style={common.label}>Word by word</Text>
          {entry.breakdown.map((b, i) => (
            <Pressable key={i} style={styles.breakRow} onPress={() => onSearch(b.word)}>
              <Text style={styles.breakWord}>{b.word}</Text>
              <Text style={styles.breakTa} numberOfLines={2}>
                {b.ta || "—"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Status / AI */}
      {!entry.fromAi && !entry.fromDictionary && !entry.candidates?.length && !entry.breakdown && (
        <Text style={styles.note}>
          {online ? "இந்த வார்த்தை dictionary-ல் இல்லை." : "இந்த வார்த்தை offline dictionary-ல் இல்லை. Internet வந்ததும் மீண்டும் தேடுங்கள்."}
        </Text>
      )}
      {!entry.fromAi && !online && (entry.breakdown || entry.kind === "tamil_to_english") && (
        <Text style={styles.note}>முழு மொழிபெயர்ப்புக்கு internet தேவை. இப்போது offline-ல் உள்ளதைக் காட்டுகிறேன்.</Text>
      )}
      {!!entry.aiError && <Text style={[styles.note, styles.error]}>AI: {entry.aiError}</Text>}
      {!entry.fromAi && online && (
        <Pressable style={styles.aiButton} onPress={onAskAi} disabled={aiBusy}>
          <Text style={styles.aiText}>{aiBusy ? "AI யோசிக்கிறது…" : "✨ AI-யிடம் விளக்கம் கேள்"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  headword: { flex: 1, fontSize: 32, fontWeight: "800", color: colors.ink },
  headSentence: { fontSize: 20, fontWeight: "600", lineHeight: 28 },
  pronTa: { fontSize: 22, color: colors.accent, marginTop: 6, fontWeight: "600" },
  ipa: { fontSize: 16, color: colors.muted, marginTop: 2 },
  sourceRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  source: { fontSize: 12, color: colors.muted },
  speakRow: { flexDirection: "row", gap: 6 },
  speak: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  speakText: { fontSize: 18 },
  highlight: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  answer: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.primary, lineHeight: 28 },
  group: { marginBottom: 8 },
  pos: { fontSize: 12, color: colors.primary, fontWeight: "700", marginBottom: 2 },
  tamil: { fontSize: 18, color: colors.ink, lineHeight: 28 },
  more: { color: colors.primary, fontWeight: "600", marginTop: 4 },
  body: { fontSize: 16, color: colors.ink, lineHeight: 25 },
  sense: { fontSize: 15, color: colors.ink, lineHeight: 22, marginBottom: 6 },
  sensePos: { color: colors.muted, fontStyle: "italic" },
  example: { paddingVertical: 8 },
  exampleBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  exampleEn: { flex: 1, fontSize: 16, color: colors.ink, lineHeight: 23 },
  exampleTa: { fontSize: 15, color: colors.muted, marginTop: 4, lineHeight: 23 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipTa: { color: colors.muted, fontWeight: "400" },
  breakRow: { flexDirection: "row", gap: 12, paddingVertical: 6 },
  breakWord: { width: 96, fontSize: 15, fontWeight: "700", color: colors.ink },
  breakTa: { flex: 1, fontSize: 15, color: colors.ink },
  note: { color: colors.muted, fontSize: 14, textAlign: "center", marginVertical: 8, lineHeight: 21 },
  error: { color: colors.danger },
  aiButton: {
    marginTop: 4,
    marginBottom: 24,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  aiText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
