import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { colors } from "../theme";

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
  busy: boolean;
  online: boolean;
}

type Lang = "en-US" | "ta-IN";

export function SearchBar({ value, onChange, onSubmit, busy, online }: Props) {
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<Lang>("en-US");

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (ev) => {
    const text = ev.results[0]?.transcript ?? "";
    onChange(text);
    if (ev.isFinal && text.trim()) onSubmit(text);
  });
  useSpeechRecognitionEvent("error", (ev) => {
    setListening(false);
    if (ev.error === "aborted" || ev.error === "no-speech") return;
    if (ev.error === "language-not-supported" || ev.error === "service-not-allowed") {
      Alert.alert(
        "Voice not available",
        online
          ? "This phone cannot recognise this language. Try typing instead."
          : "Offline voice needs the language pack. On Android: Settings → Google → Voice → Offline speech recognition → download English (and Tamil).",
      );
      return;
    }
    Alert.alert("Voice", ev.message || ev.error);
  });

  async function toggleMic() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Microphone", "Please allow microphone and speech recognition in Settings.");
      return;
    }
    onChange("");
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
      // Without internet, ask for the phone's built-in (offline) recogniser.
      requiresOnDeviceRecognition: !online && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
    });
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={() => value.trim() && onSubmit(value)}
          placeholder={listening ? "Listening…" : "Type a word, sentence, or தமிழ்"}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          multiline={false}
          clearButtonMode="while-editing"
        />
        {busy ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : (
          <Pressable
            onPress={toggleMic}
            style={[styles.mic, listening && styles.micOn]}
            accessibilityLabel={listening ? "Stop listening" : "Speak"}
          >
            <Text style={styles.micIcon}>{listening ? "■" : "🎤"}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.langRow}>
        <Text style={styles.langLabel}>Voice:</Text>
        {(["en-US", "ta-IN"] as Lang[]).map((l) => (
          <Pressable key={l} onPress={() => setLang(l)} style={[styles.lang, lang === l && styles.langOn]}>
            <Text style={[styles.langText, lang === l && styles.langTextOn]}>{l === "en-US" ? "English" : "தமிழ்"}</Text>
          </Pressable>
        ))}
      </View>
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
