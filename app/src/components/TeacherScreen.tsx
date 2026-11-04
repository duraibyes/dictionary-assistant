// English Teacher: talk or type; every message is corrected and explained in Tamil,
// and the teacher replies (out loud) to keep the conversation going.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import * as Speech from "expo-speech";
import { askTeacher, type TutorTurn } from "../api";
import { getJson, setJson } from "../dictionary";
import type { Settings } from "../settings";
import { useVoice, type VoiceLang } from "../useVoice";
import { LangPicker } from "./SearchBar";
import { colors, common } from "../theme";

interface Item {
  id: string;
  role: "user" | "teacher";
  text: string;
  /** For learner messages: the teacher's feedback on it. */
  feedback?: TutorTurn;
  /** For teacher messages: Tamil translation. */
  ta?: string;
  error?: string;
}

interface Saved {
  topic: string;
  items: Item[];
}

const STORE_KEY = "teacher.v1";
const TOPICS = [
  { label: "💬 Free talk", value: "" },
  { label: "🙋 Introduce yourself", value: "Introducing yourself to a new friend" },
  { label: "💼 Job interview", value: "A job interview for a software / office job" },
  { label: "🏢 Office meeting", value: "Talking with your manager and team at the office" },
  { label: "📞 Phone call", value: "A phone call to customer care about a problem" },
  { label: "🛒 Shopping", value: "Buying things at a shop and asking the price" },
  { label: "🏥 Doctor", value: "Visiting a doctor and explaining how you feel" },
  { label: "✈️ Travel", value: "At the airport / railway station and hotel" },
];

const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function say(text: string) {
  Speech.stop();
  Speech.speak(text, { language: "en-US", rate: 0.92 });
}

interface Props {
  settings: Settings;
  online: boolean;
}

export function TeacherScreen({ settings, online }: Props) {
  const [topic, setTopic] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<VoiceLang>("en-US");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  const voice = useVoice({ online, onPartial: setText, onFinal: (t) => send(t) });

  useEffect(() => {
    getJson<Saved>(STORE_KEY, { topic: "", items: [] }).then((s) => {
      setTopic(s.topic);
      setItems(s.items);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) setJson(STORE_KEY, { topic, items: items.slice(-60) } satisfies Saved);
  }, [items, topic, loaded]);

  async function run(history: Item[]) {
    const userItem = history[history.length - 1];
    setBusy(true);
    try {
      const turn = await askTeacher(
        settings,
        history.filter((h) => !h.error).map((h) => ({ role: h.role, text: h.text })),
        topic || undefined,
      );
      const teacher: Item = { id: newId(), role: "teacher", text: turn.reply, ta: turn.reply_ta };
      setItems([...history.slice(0, -1), { ...userItem, feedback: turn, error: undefined }, teacher]);
      if (autoSpeak && turn.reply) say(turn.reply);
    } catch (e) {
      setItems([...history.slice(0, -1), { ...userItem, error: (e as Error).message }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function send(raw: string) {
    const t = raw.trim();
    if (!t || busy) return;
    if (!online) {
      Alert.alert("Offline", "Teacher-க்கு internet தேவை. Dictionary offline-லும் வேலை செய்யும்.");
      return;
    }
    setText("");
    const history = [...items, { id: newId(), role: "user" as const, text: t }];
    setItems(history);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    run(history);
  }

  function retry(id: string) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0 || busy) return;
    run(items.slice(0, idx + 1));
  }

  function pickTopic(value: string) {
    const apply = () => {
      Speech.stop();
      setTopic(value);
      setItems([]);
    };
    if (!items.length) return apply();
    Alert.alert("New conversation?", "இப்போதைய உரையாடல் அழிக்கப்படும்.", [
      { text: "Cancel", style: "cancel" },
      { text: "Start new", onPress: apply },
    ]);
  }

  const topicLabel = TOPICS.find((t) => t.value === topic)?.label ?? "💬 Free talk";

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <Text style={styles.topicNow} numberOfLines={1}>
          {topicLabel}
        </Text>
        <Pressable onPress={() => setAutoSpeak(!autoSpeak)} hitSlop={8}>
          <Text style={styles.toolBtn}>{autoSpeak ? "🔊 Auto" : "🔇 Muted"}</Text>
        </Pressable>
        {items.length > 0 && (
          <Pressable onPress={() => pickTopic(topic)} hitSlop={8}>
            <Text style={styles.toolBtn}>＋ New</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {items.length === 0 && (
          <View>
            <View style={common.card}>
              <Text style={styles.introTitle}>உங்கள் English Teacher 👩‍🏫</Text>
              <Text style={styles.introText}>
                English-ல் எதையாவது பேசுங்கள் அல்லது type செய்யுங்கள். தவறு இருந்தால் திருத்தி, ஏன் என்று தமிழில்
                சொல்வேன். அதையே சொல்ல வேறு வழிகளும் தருவேன், பிறகு உரையாடலைத் தொடர்வோம்.{"\n\n"}தமிழிலும் கேட்கலாம்:
                “naan office ku late ah vanthen nu eppadi solrathu?”
              </Text>
            </View>
            <View style={common.card}>
              <Text style={common.label}>Practice a situation</Text>
              <View style={styles.chips}>
                {TOPICS.map((t) => (
                  <Pressable
                    key={t.label}
                    style={[common.chip, t.value === topic && styles.chipOn]}
                    onPress={() => pickTopic(t.value)}
                  >
                    <Text style={[common.chipText, t.value === topic && styles.chipTextOn]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {items.map((item) =>
          item.role === "user" ? (
            <View key={item.id}>
              <View style={[styles.bubble, styles.userBubble]}>
                <Text style={styles.userText} selectable>
                  {item.text}
                </Text>
              </View>
              {item.feedback && <Feedback turn={item.feedback} original={item.text} />}
              {item.error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{item.error}</Text>
                  <Pressable onPress={() => retry(item.id)}>
                    <Text style={styles.retry}>மீண்டும் முயற்சி ↻</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <TeacherBubble key={item.id} item={item} />
          ),
        )}

        {busy && (
          <View style={[styles.bubble, styles.teacherBubble, styles.thinking]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Teacher யோசிக்கிறார்…</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputArea}>
        {!online && <Text style={styles.offline}>Offline — Teacher-க்கு internet தேவை</Text>}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={voice.listening ? "Listening…" : "English-ல் பேசுங்கள் / type செய்யுங்கள்…"}
            placeholderTextColor={colors.muted}
            multiline
            autoCorrect={false}
          />
          <Pressable
            style={[styles.round, voice.listening && styles.roundOn]}
            onPress={() => (voice.listening ? voice.stop() : (setText(""), voice.start(lang)))}
            accessibilityLabel={voice.listening ? "Stop listening" : "Speak"}
          >
            <Text style={styles.roundIcon}>{voice.listening ? "■" : "🎤"}</Text>
          </Pressable>
          <Pressable
            style={[styles.round, styles.send, (!text.trim() || busy) && styles.disabled]}
            onPress={() => send(text)}
            disabled={!text.trim() || busy}
            accessibilityLabel="Send"
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
        <LangPicker lang={lang} onChange={setLang} />
      </View>
    </View>
  );
}

function Feedback({ turn, original }: { turn: TutorTurn; original: string }) {
  const showCorrected =
    !!turn.corrected && turn.corrected.toLowerCase().replace(/[^a-z ]/g, "") !== original.toLowerCase().replace(/[^a-z ]/g, "");
  return (
    <View style={[styles.feedback, turn.is_correct ? styles.feedbackOk : styles.feedbackFix]}>
      {turn.is_correct && !showCorrected ? (
        <Text style={styles.okText}>✅ சரியாகச் சொன்னீர்கள்!</Text>
      ) : (
        <>
          <Text style={styles.fbLabel}>{turn.is_correct ? "In English" : "✏️ சரியான வடிவம்"}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.corrected} selectable>
              {turn.corrected}
            </Text>
            <Pressable onPress={() => say(turn.corrected)} hitSlop={8}>
              <Text style={styles.speaker}>🔊</Text>
            </Pressable>
          </View>
        </>
      )}

      {turn.mistakes.map((m, i) => (
        <View key={i} style={styles.mistake}>
          <Text style={styles.mistakeLine}>
            <Text style={styles.wrong}>{m.wrong}</Text>
            <Text style={styles.muted}> → </Text>
            <Text style={styles.right}>{m.right}</Text>
          </Text>
          {!!m.why_ta && <Text style={styles.why}>{m.why_ta}</Text>}
        </View>
      ))}

      {!!turn.meaning_ta && <Text style={styles.meaning}>தமிழில்: {turn.meaning_ta}</Text>}

      {turn.better_ways.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.fbLabel}>வேறு விதமாகச் சொல்ல</Text>
          {turn.better_ways.map((w, i) => (
            <Pressable key={i} style={styles.way} onPress={() => say(w)}>
              <Text style={styles.wayText}>🔊 {w}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!!turn.tip_ta && <Text style={styles.tip}>💡 {turn.tip_ta}</Text>}
    </View>
  );
}

function TeacherBubble({ item }: { item: Item }) {
  const [showTa, setShowTa] = useState(false);
  return (
    <View style={[styles.bubble, styles.teacherBubble]}>
      <View style={styles.rowBetween}>
        <Text style={styles.teacherText} selectable>
          {item.text}
        </Text>
        <Pressable onPress={() => say(item.text)} hitSlop={8}>
          <Text style={styles.speaker}>🔊</Text>
        </Pressable>
      </View>
      {!!item.ta && (
        <Pressable onPress={() => setShowTa(!showTa)}>
          <Text style={showTa ? styles.ta : styles.taToggle}>{showTa ? item.ta : "தமிழில் பார்க்க"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingBottom: 8 },
  topicNow: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.ink },
  toolBtn: { fontSize: 13, fontWeight: "600", color: colors.primary },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  introTitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  introText: { fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 23 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipOn: { backgroundColor: colors.primary },
  chipTextOn: { color: "#fff" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, maxWidth: "88%" },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  userText: { color: "#fff", fontSize: 16, lineHeight: 23 },
  teacherBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderBottomLeftRadius: 4,
  },
  teacherText: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 23 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8 },
  muted: { color: colors.muted },
  ta: { marginTop: 6, color: colors.muted, fontSize: 15, lineHeight: 22 },
  taToggle: { marginTop: 6, color: colors.primary, fontSize: 13, fontWeight: "600" },
  speaker: { fontSize: 17 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  feedback: { alignSelf: "flex-end", width: "92%", borderRadius: 14, padding: 12, marginBottom: 10 },
  feedbackOk: { backgroundColor: colors.primarySoft },
  feedbackFix: { backgroundColor: colors.accentSoft },
  okText: { color: colors.primary, fontWeight: "700", fontSize: 15 },
  fbLabel: { fontSize: 11, fontWeight: "800", color: colors.muted, letterSpacing: 0.5, marginBottom: 4 },
  corrected: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink, lineHeight: 23 },
  mistake: { marginTop: 8 },
  mistakeLine: { fontSize: 15 },
  wrong: { color: colors.danger, textDecorationLine: "line-through" },
  right: { color: colors.primary, fontWeight: "700" },
  why: { fontSize: 14, color: colors.ink, marginTop: 2, lineHeight: 21 },
  meaning: { marginTop: 8, fontSize: 14, color: colors.muted, lineHeight: 21 },
  way: { paddingVertical: 4 },
  wayText: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  tip: { marginTop: 8, fontSize: 14, color: colors.ink, lineHeight: 21 },
  errorBox: { alignSelf: "flex-end", alignItems: "flex-end", marginBottom: 10 },
  errorText: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.primary, fontWeight: "700", marginTop: 4 },
  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  offline: { color: colors.offline, fontSize: 13, textAlign: "center", marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: colors.ink,
  },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  roundOn: { backgroundColor: colors.accentSoft },
  roundIcon: { fontSize: 20, color: colors.accent },
  send: { backgroundColor: colors.primary },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "800" },
  disabled: { opacity: 0.4 },
});
