// Speech-to-text shared by the Dictionary and Teacher screens.
// Keeps listening through pauses until the user taps stop, and only fills the text box:
// nothing is sent until the user taps send/search.
// Speech events are global, so a screen only reacts while it is the one that started listening.
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

export type VoiceLang = "en-US" | "ta-IN";

let owner: symbol | null = null;

const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(" ");

export function useVoice(opts: { online: boolean; onText: (text: string) => void }) {
  const me = useRef(Symbol("voice")).current;
  const [listening, setListening] = useState(false);
  const latest = useRef(opts);
  latest.current = opts;
  /** Text already in the box when listening started, plus every finished speech segment. */
  const committed = useRef("");
  /** The segment being spoken right now (not final yet). Kept if the user stops mid-sentence. */
  const pending = useRef("");
  const finish = () => {
    if (pending.current) committed.current = join(committed.current, pending.current);
    pending.current = "";
    latest.current.onText(committed.current);
  };

  useSpeechRecognitionEvent("start", () => owner === me && setListening(true));
  useSpeechRecognitionEvent("end", () => {
    if (owner !== me) return;
    setListening(false);
    owner = null;
    finish();
  });
  useSpeechRecognitionEvent("result", (ev) => {
    if (owner !== me) return;
    const segment = ev.results[0]?.transcript ?? "";
    if (ev.isFinal) {
      // Android sends one final result per spoken segment; iOS sends one at the end. Both append once.
      committed.current = join(committed.current, segment);
      pending.current = "";
      latest.current.onText(committed.current);
    } else {
      pending.current = segment;
      latest.current.onText(join(committed.current, segment));
    }
  });
  useSpeechRecognitionEvent("error", (ev) => {
    if (owner !== me) return;
    setListening(false);
    owner = null;
    finish();
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

  /** Starts listening; whatever is already typed (`existing`) is kept and speech is added after it. */
  async function start(lang: VoiceLang, existing = "") {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Microphone", "Please allow microphone and speech recognition in Settings.");
      return;
    }
    committed.current = existing;
    pending.current = "";
    owner = me;
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      // Keep listening through pauses until the user taps stop.
      continuous: true,
      addsPunctuation: true,
      // Older Android (12 and below) has no continuous mode: wait up to 6s of silence before stopping.
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 6000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 6000,
        EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 15000,
      },
      // Without internet, ask for the phone's built-in (offline) recogniser.
      requiresOnDeviceRecognition: !latest.current.online && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
    });
  }

  function stop() {
    ExpoSpeechRecognitionModule.stop();
  }

  /** Stop without touching the text box again (used when the user sends while still listening). */
  function cancel() {
    if (owner === me) owner = null;
    setListening(false);
    pending.current = "";
    ExpoSpeechRecognitionModule.abort();
  }

  return { listening, start, stop, cancel };
}
