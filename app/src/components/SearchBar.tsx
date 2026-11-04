import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useVoice, type VoiceLang } from "../useVoice";
import { colors } from "../theme";

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
  busy: boolean;
  online: boolean;
}

export function SearchBar({ value, onChange, onSubmit, busy, online }: Props) {
  const [lang, setLang] = useState<VoiceLang>("en-US");
  // Speech only fills the box; the search runs when the user taps 🔍 or the keyboard's search key.
  const voice = useVoice({ online, onText: onChange });

  function toggleMic() {
    if (voice.listening) return voice.stop();
    voice.start(lang, value);
  }

  function submit() {
    if (voice.listening) voice.cancel();
    if (value.trim()) onSubmit(value);
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={submit}
          placeholder={voice.listening ? "Listening… ■ அழுத்தி நிறுத்துங்கள்" : "Type a word, sentence, or தமிழ்"}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <Pressable
          onPress={toggleMic}
          style={[styles.mic, voice.listening && styles.micOn]}
          accessibilityLabel={voice.listening ? "Stop listening" : "Speak"}
        >
          <Text style={styles.micIcon}>{voice.listening ? "■" : "🎤"}</Text>
        </Pressable>
        {busy ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : (
          <Pressable
            onPress={submit}
            disabled={!value.trim()}
            style={[styles.go, !value.trim() && styles.goOff]}
            accessibilityLabel="Search"
          >
            <Text style={styles.goIcon}>🔍</Text>
          </Pressable>
        )}
      </View>
      {voice.listening && <Text style={styles.hint}>● பேசி முடித்ததும் ■ அழுத்துங்கள், பிறகு 🔍</Text>}
      <LangPicker lang={lang} onChange={setLang} />
    </View>
  );
}

export function LangPicker({ lang, onChange }: { lang: VoiceLang; onChange: (l: VoiceLang) => void }) {
  return (
    <View style={styles.langRow}>
      <Text style={styles.langLabel}>Voice:</Text>
      {(["en-US", "ta-IN"] as VoiceLang[]).map((l) => (
        <Pressable key={l} onPress={() => onChange(l)} style={[styles.lang, lang === l && styles.langOn]}>
          <Text style={[styles.langText, lang === l && styles.langTextOn]}>{l === "en-US" ? "English" : "தமிழ்"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingLeft: 16,
    paddingRight: 6,
  },
  input: { flex: 1, fontSize: 18, paddingVertical: 14, color: colors.ink, minWidth: 0 },
  spinner: { width: 42, height: 42 },
  go: {
    width: 42,
    height: 42,
    marginLeft: 6,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  goOff: { opacity: 0.35 },
  goIcon: { fontSize: 17 },
  hint: { color: colors.accent, fontSize: 13, fontWeight: "600", marginTop: 8 },
  mic: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  micOn: { backgroundColor: colors.accentSoft },
  micIcon: { fontSize: 20, color: colors.accent },
  langRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  langLabel: { color: colors.muted, fontSize: 13 },
  lang: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  langOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { fontSize: 13, color: colors.muted },
  langTextOn: { color: "#fff", fontWeight: "600" },
});
