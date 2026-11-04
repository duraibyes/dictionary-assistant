// Speech-to-text shared by the Dictionary and Teacher screens. Speech events are global,
// so a screen only reacts while it is the one that started listening.
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

export type VoiceLang = "en-US" | "ta-IN";

let owner: symbol | null = null;

export function useVoice(opts: { online: boolean; onPartial: (text: string) => void; onFinal: (text: string) => void }) {
  const me = useRef(Symbol("voice")).current;
  const [listening, setListening] = useState(false);
  const latest = useRef(opts);
  latest.current = opts;

  useSpeechRecognitionEvent("start", () => owner === me && setListening(true));
  useSpeechRecognitionEvent("end", () => {
    if (owner !== me) return;
    setListening(false);
    owner = null;
  });
  useSpeechRecognitionEvent("result", (ev) => {
    if (owner !== me) return;
    const text = ev.results[0]?.transcript ?? "";
    latest.current.onPartial(text);
    if (ev.isFinal && text.trim()) latest.current.onFinal(text);
  });
  useSpeechRecognitionEvent("error", (ev) => {
    if (owner !== me) return;
    setListening(false);
    owner = null;
    if (ev.error === "aborted" || ev.error === "no-speech") return;
    if (ev.error === "language-not-supported" || ev.error === "service-not-allowed") {
      Alert.alert(
        "Voice not available",
        latest.current.online
          ? "This phone cannot recognise this language. Try typing instead."
          : "Offline voice needs the language pack. On Android: Settings → Google → Voice → Offline speech recognition → download English (and Tamil).",
      );
      return;
    }
    Alert.alert("Voice", ev.message || ev.error);
  });

  async function start(lang: VoiceLang) {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Microphone", "Please allow microphone and speech recognition in Settings.");
      return;
    }
    owner = me;
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
      // Without internet, ask for the phone's built-in (offline) recogniser.
      requiresOnDeviceRecognition: !latest.current.online && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
    });
  }

  function stop() {
    ExpoSpeechRecognitionModule.stop();
  }

  return { listening, start, stop };
}
