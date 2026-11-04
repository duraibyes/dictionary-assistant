import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useNetInfo } from "@react-native-community/netinfo";
import { SearchBar } from "./src/components/SearchBar";
import { ResultView } from "./src/components/ResultView";
import { OfflineBadge } from "./src/components/OfflineBadge";
import { SettingsSheet } from "./src/components/SettingsSheet";
import { addHistory, getHistory } from "./src/dictionary";
import { lookup } from "./src/lookup";
import { defaults, loadSettings, saveSettings, type Settings } from "./src/settings";
import type { Entry } from "./src/types";
import { colors, common } from "./src/theme";

// Bump the file name whenever assets/dict.db is rebuilt, so phones copy the new version.
const DICT_DB = "dict-v1.db";

export default function App() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<Loading />}>
        <SQLiteProvider
          databaseName={DICT_DB}
          assetSource={{ assetId: require("./assets/dict.db") }}
          options={{ enableChangeListener: false }}
          useSuspense
        >
          <Main />
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

function Loading() {
  return (
    <View style={[styles.screen, styles.center]}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingText}>Dictionary தயாராகிறது…</Text>
    </View>
  );
}

function Main() {
  const db = useSQLiteContext();
  const net = useNetInfo();
  // Treat "unknown" (null) as online so the first launch is not blocked.
  const online = net.isConnected !== false && net.isInternetReachable !== false;

  const [settings, setSettings] = useState<Settings>(defaults);
  const [showSettings, setShowSettings] = useState(false);
  const [text, setText] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const requestId = useRef(0);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      if (!s.apiUrl || !s.appSecret) setShowSettings(true);
    });
    getHistory().then(setHistory);
  }, []);

  const search = useCallback(
    async (query: string, forceAi = false) => {
      const q = query.trim();
      if (!q) return;
      const id = ++requestId.current;
      setText(q);
      setBusy(!forceAi);
      setAiBusy(true);
      const update = (e: Entry) => id === requestId.current && setEntry(e);
      try {
        const result = await lookup(q, { db, settings, online, forceAi }, (e) => {
          update(e);
          setBusy(false);
        });
        update(result);
        await addHistory(q);
        setHistory(await getHistory());
      } catch (e) {
        update({
          query: q,
          kind: "word",
          headword: q,
          ipa: "",
          pronunciationTa: "",
          tamil: [],
          senses: [],
          explanationTa: "",
          betterEnglish: "",
          examples: [],
          fromDictionary: false,
          fromAi: false,
          aiError: (e as Error).message,
        });
      } finally {
        if (id === requestId.current) {
          setBusy(false);
          setAiBusy(false);
        }
      }
    },
    [db, settings, online],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              setEntry(null);
              setText("");
            }}
          >
            <Text style={styles.brand}>
              அகராதி <Text style={styles.brandSub}>Assistant</Text>
            </Text>
          </Pressable>
          <View style={styles.headerRight}>
            {!online && <OfflineBadge />}
            <Pressable onPress={() => setShowSettings(true)} hitSlop={10} accessibilityLabel="Settings">
              <Text style={styles.gear}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <SearchBar value={text} onChange={setText} onSubmit={(t) => search(t)} busy={busy} online={online} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {entry ? (
            <ResultView
              entry={entry}
              online={online}
              aiBusy={aiBusy}
              onAskAi={() => search(entry.query, true)}
              onSearch={(w) => search(w)}
            />
          ) : (
            <Home history={history} onPick={(q) => search(q)} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SettingsSheet
        visible={showSettings}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onSave={async (s) => {
          await saveSettings(s);
          setSettings(await loadSettings());
          setShowSettings(false);
        }}
        onHistoryCleared={() => setHistory([])}
      />
    </SafeAreaView>
  );
}

function Home({ history, onPick }: { history: string[]; onPick: (q: string) => void }) {
  return (
    <View>
      <View style={common.card}>
        <Text style={styles.hello}>எந்த வார்த்தையும் கேளுங்கள்</Text>
        <Text style={styles.helloSub}>
          English வார்த்தை, ஒரு sentence, அல்லது தமிழில் — type செய்யுங்கள் அல்லது 🎤 அழுத்திப் பேசுங்கள். தமிழ் அர்த்தம்,
          உச்சரிப்பு, 3 உதாரண sentences கிடைக்கும்.
        </Text>
      </View>
      {history.length > 0 ? (
        <View style={common.card}>
          <Text style={common.label}>Recent</Text>
          <View style={styles.chips}>
            {history.map((h) => (
              <Pressable key={h} style={common.chip} onPress={() => onPick(h)}>
                <Text style={common.chipText} numberOfLines={1}>
                  {h}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={common.card}>
          <Text style={common.label}>Try</Text>
          <View style={styles.chips}>
            {["verdict", "take off", "I am looking forward to it", "தீர்ப்பு"].map((h) => (
              <Pressable key={h} style={common.chip} onPress={() => onPick(h)}>
                <Text style={common.chipText}>{h}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.muted, fontSize: 15 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  brand: { fontSize: 24, fontWeight: "800", color: colors.primary },
  brandSub: { fontSize: 16, fontWeight: "600", color: colors.muted },
  gear: { fontSize: 22 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  hello: { fontSize: 20, fontWeight: "800", color: colors.ink },
  helloSub: { fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 23 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
