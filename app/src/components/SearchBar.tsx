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
  const voice = useVoice({ online, onPartial: onChange, onFinal: onSubmit });

  function toggleMic() {
    if (voice.listening) return voice.stop();
    onChange("");
    voice.start(lang);
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={() => value.trim() && onSubmit(value)}
          placeholder={voice.listening ? "Listening…" : "Type a word, sentence, or தமிழ்"}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {busy ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : (
          <Pressable
            onPress={toggleMic}
            style={[styles.mic, voice.listening && styles.micOn]}
            accessibilityLabel={voice.listening ? "Stop listening" : "Speak"}
          >
            <Text style={styles.micIcon}>{voice.listening ? "■" : "🎤"}</Text>
          </Pressable>
        )}
      </View>
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
  input: { flex: 1, fontSize: 18, paddingVertical: 14, color: colors.ink },
  spinner: { width: 46, height: 46 },
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
