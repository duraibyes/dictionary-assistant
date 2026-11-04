# அகராதி Assistant — English ↔ Tamil dictionary assistant

Ask about any English word or sentence (typed or spoken) and get the Tamil meaning, how to pronounce it
(in Tamil letters + IPA + audio), and 3 example sentences. Works offline; uses AI only when the offline
dictionary has gaps, and saves every AI answer on the phone so the same question is never paid for twice.

```
app/         Expo (React Native) app for Android + iOS
backend/     Next.js API on Vercel — holds the API keys, rotates between providers
data-build/  Script that builds app/assets/dict.db from open dictionary data
```

## How an answer is found

1. **Saved AI answers** on the phone (free, offline)
2. **Offline dictionary** bundled in the app — 68k English words, 52k with Tamil meanings, English
   definitions, example sentences, IPA and Tamil-letter pronunciation (free, offline)
3. **AI** through the backend — only when online and the dictionary is missing the Tamil meaning or
   3 examples, for sentences, or when you tap "AI-யிடம் விளக்கம் கேள்". Turn off "Auto AI help" in
   Settings to call the AI only when you tap the button.

Offline extras: Tamil → English word search, word-by-word meaning for sentences, voice input (needs the
phone's offline speech pack), text-to-speech.

Voice input keeps listening through pauses until you tap ■, only fills the text box, and nothing is sent
until you tap 🔍 (dictionary) or ➤ (teacher). Logic: `app/src/useVoice.ts`.

## English Teacher tab

Talk or type in English (or Tamil, or Tamil in English letters). Each message comes back with the
corrected sentence, each mistake explained in Tamil, up to 3 other natural ways to say it, and the
teacher's spoken reply with a question to keep you talking. Pick a situation to role-play (job
interview, office meeting, phone call, shopping, doctor, travel) or just chat. Needs internet;
the conversation is saved on the phone. Backend endpoint: `POST /api/chat`.

## Updates

Phones built with the `preview` profile get new app code over the air: every push to `main` runs
`app/.eas/workflows/publish-update.yml`, which publishes an update to the `preview` channel, and the
app shows "புதிய update தயார்" with a restart button. Only changes that add native modules need a new
build from expo.dev.

## Backend (Vercel)

Vercel project root directory: `backend`. Environment variables:

| Name | Value |
|---|---|
| `APP_SECRET` | any long random text; enter the same in the app's Settings |
| `GEMINI_API_KEYS` | Gemini keys, comma separated, free keys first |
| `OPENROUTER_API_KEYS` | OpenRouter keys, comma separated |
| `OPENAI_API_KEYS` | OpenAI keys, comma separated |
| `ANTHROPIC_API_KEYS` | Claude keys, comma separated |
| `PROVIDER_ORDER` | optional, default `gemini,openrouter,openai,anthropic` |
| `GEMINI_MODEL` / `OPENROUTER_MODEL` / `OPENAI_MODEL` / `ANTHROPIC_MODEL` | optional model overrides |

Defaults: `gemini-flash-latest`, `openrouter/free`, `gpt-5.4-mini`, `claude-haiku-5-5`.
A key that is rate-limited (429) rests for 1 minute; an invalid or out-of-credit key (401/402/403)
rests for 6 hours; the next key / provider is tried automatically.

Endpoints: `POST /api/lookup` (needs `x-app-secret`), `GET /api/ping` (checks the secret, no AI cost),
`GET /api/health` (shows key counts, never the keys).

## App

```bash
cd app
npm install
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android   # APK you can share
```

Voice input uses a native module, so the app runs as a development/preview build, not in Expo Go.
iPhone builds for other people need an Apple Developer account (TestFlight).

## Data licences

- English–Tamil meanings: [eng2tamildictionary](https://github.com/linuxkathirvel/eng2tamildictionary),
  GPL-3.0 (from the Tamil Nadu free-laptop dictionary / University of Madras lexicon)
- English definitions and examples: WordNet 3.1, Princeton University (WordNet licence)
- Pronunciation: CMU Pronouncing Dictionary (BSD)

Because the Tamil data is GPL-3.0, keep this repository's source available if you distribute the app.
