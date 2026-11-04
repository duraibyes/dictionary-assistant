#!/usr/bin/env python3
"""Builds app/assets/dict.db — the offline English→Tamil dictionary bundled inside the app.

Sources (download them first, see data-build/README.md):
  --tamil     dictionary.json from github.com/linuxkathirvel/eng2tamildictionary (GPL-3.0)
  --wordnet   the dict/ folder of the npm package wordnet-db (WordNet 3.1, WordNet license)
  --cmudict   cmudict.dict from github.com/cmusphinx/cmudict (BSD)

Usage:
  python3 build_dict.py --tamil dictionary.json --wordnet wordnet-db/dict --cmudict cmudict.dict --out ../app/assets/dict.db
"""
import argparse
import json
import os
import re
import sqlite3
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pronounce import arpabet_to_ipa, arpabet_to_tamil  # noqa: E402

POS_TA = {"n": "பெயர்ச்சொல்", "v": "வினைச்சொல்", "a": "பெயரடை", "adj": "பெயரடை", "adv": "வினையடை",
          "prep": "முன்னிடைச்சொல்", "conj": "இணைப்புச்சொல்", "int": "வியப்பிடைச்சொல்", "pron": "பதிலிடுபெயர்"}
POS_EN = {"n": "noun", "v": "verb", "a": "adjective", "adj": "adjective", "adv": "adverb", "prep": "preposition",
          "conj": "conjunction", "int": "interjection", "pron": "pronoun"}
WN_POS = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}

MAX_MEANINGS_PER_GROUP = 20
MAX_SENSES = 5
MAX_EXAMPLES = 3


# ---------------------------------------------------------------- Tamil meanings

LEAD_POS = re.compile(r"^\s*((?:[a-z]{1,5}\.)(?:\s*[a-z]{1,5}\.?)?)\s*")
SPLIT_MARKERS = re.compile(r"\((வினை|பெ\.|பெ)\)")


def parse_tamil(text):
    """'n. ஓட்டம், ஓட்டப்பாணி, (வினை) ஓடு, ...' -> [{"pos": "noun", "ta": [...]}, {"pos": "verb", ...}]"""
    text = text.replace("‌", "").replace("‍", "").strip()
    pos = ""
    m = LEAD_POS.match(text)
    if m:
        abbr = m.group(1).split(".")[0].strip()
        pos = POS_EN.get(abbr, "")
        text = text[m.end():]
    groups = []
    parts = SPLIT_MARKERS.split(text)
    # parts = [first, marker, seg, marker, seg, ...]
    segments = [(pos, parts[0])]
    for i in range(1, len(parts) - 1, 2):
        segments.append(("verb" if parts[i] == "வினை" else "adjective", parts[i + 1]))
    for p, seg in segments:
        seen, items = set(), []
        for raw in re.split(r"[,;]", seg):
            t = raw.strip().strip(".").strip()
            t = re.sub(r"\s+", " ", t)
            if not t or len(t) > 60 or t in seen:
                continue
            seen.add(t)
            items.append(t)
            if len(items) >= MAX_MEANINGS_PER_GROUP:
                break
        if items:
            groups.append({"pos": p, "ta": items})
    return groups


def load_tamil(path):
    data = json.load(open(path, encoding="utf-8"))
    out = defaultdict(list)
    for row in data:
        eng, ta = row.get("eng"), row.get("tamil")
        if not eng or not ta:
            continue
        key = re.sub(r"\s+", " ", eng.strip().lower())
        if not key or len(key) > 60:
            continue
        for g in parse_tamil(ta):
            # merge groups with the same pos
            existing = next((x for x in out[key] if x["pos"] == g["pos"]), None)
            if existing:
                for t in g["ta"]:
                    if t not in existing["ta"] and len(existing["ta"]) < MAX_MEANINGS_PER_GROUP:
                        existing["ta"].append(t)
            else:
                out[key].append(g)
    return out


# ---------------------------------------------------------------- WordNet

def load_wordnet(folder):
    """Returns lemma -> [(pos, definition, [examples])] ordered by sense frequency, and all examples."""
    synsets = {}  # (pos_letter, offset) -> (definition, examples)
    for fn, letter in (("data.noun", "n"), ("data.verb", "v"), ("data.adj", "a"), ("data.adv", "r")):
        with open(os.path.join(folder, fn), encoding="utf-8", errors="replace") as f:
            for line in f:
                if line.startswith("  "):
                    continue
                head, _, gloss = line.partition(" | ")
                offset = head.split(" ", 1)[0]
                gloss = gloss.strip()
                examples = re.findall(r'"([^"]{8,200})"', gloss)
                definition = gloss.split('; "')[0].split(' "')[0].strip().rstrip(";").strip()
                synsets[(letter, offset)] = (definition, examples)

    senses = defaultdict(list)
    for fn, letter in (("index.noun", "n"), ("index.verb", "v"), ("index.adj", "a"), ("index.adv", "r")):
        with open(os.path.join(folder, fn), encoding="utf-8", errors="replace") as f:
            for line in f:
                if line.startswith("  "):
                    continue
                parts = line.split()
                lemma = parts[0].replace("_", " ").lower()
                synset_cnt = int(parts[2])
                offsets = parts[-synset_cnt:]
                for off in offsets:
                    d = synsets.get((letter, off))
                    if d:
                        senses[lemma].append((WN_POS[letter], d[0], d[1]))
    all_examples = sorted({e for d in synsets.values() for e in d[1]})
    return senses, all_examples


def interleave(senses):
    """WordNet lists all nouns, then all verbs...; take sense 1 of each POS, then sense 2 of each, and so on."""
    by_pos = defaultdict(list)
    for x in senses:
        by_pos[x[0]].append(x)
    out, i = [], 0
    while len(out) < len(senses):
        for lst in by_pos.values():
            if i < len(lst):
                out.append(lst[i])
        i += 1
    return out


# ---------------------------------------------------------------- CMU

def load_cmu(path):
    pron = {}
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.split("#")[0].strip()
            if not line:
                continue
            word, *phones = line.split()
            if "(" in word:  # alternate pronunciations: keep the first
                continue
            pron[word.lower()] = phones
    return pron


# ---------------------------------------------------------------- examples index

WORD_RE = re.compile(r"[a-z]+(?:'[a-z]+)?")


def inflections(word):
    """Very small set of surface forms, enough to find example sentences."""
    forms = {word}
    if " " in word:
        return forms
    forms |= {word + "s", word + "es", word + "ed", word + "d", word + "ing", word + "er", word + "ly"}
    if word.endswith("y"):
        forms |= {word[:-1] + "ies", word[:-1] + "ied"}
    if word.endswith("e"):
        forms.add(word[:-1] + "ing")
    return forms


def build_example_index(all_examples):
    index = defaultdict(list)
    for i, ex in enumerate(all_examples):
        for w in set(WORD_RE.findall(ex.lower())):
            index[w].append(i)
    return index


def pick_examples(word, wn_senses, all_examples, ex_index):
    out = []
    for _pos, _d, exs in wn_senses:
        for e in exs:
            if e not in out:
                out.append(e)
            if len(out) >= MAX_EXAMPLES:
                return out
    if " " in word:
        return out
    # borrow from other senses: shortest sentences that contain the word first
    cand = set()
    for form in inflections(word):
        cand.update(ex_index.get(form, ()))
    for i in sorted(cand, key=lambda i: (len(all_examples[i]) < 25, len(all_examples[i])))[:20]:
        e = all_examples[i]
        if e not in out and len(e) >= 20:
            out.append(e)
        if len(out) >= MAX_EXAMPLES:
            break
    return out


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tamil", required=True)
    ap.add_argument("--wordnet", required=True)
    ap.add_argument("--cmudict", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    tamil = load_tamil(args.tamil)
    wn, all_examples = load_wordnet(args.wordnet)
    cmu = load_cmu(args.cmudict)
    ex_index = build_example_index(all_examples)
    print(f"tamil={len(tamil)} wordnet={len(wn)} cmu={len(cmu)} examples={len(all_examples)}")

    # Vocabulary: every word with a Tamil meaning, plus WordNet words common enough to be in CMU.
    # (Multi-word WordNet entries without a Tamil meaning are mostly names and jargon, so they are left out.)
    vocab = set(tamil) | {w for w in wn if " " not in w and "-" not in w and w in cmu}

    if os.path.exists(args.out):
        os.remove(args.out)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    db = sqlite3.connect(args.out)
    db.executescript("""
        PRAGMA page_size = 4096;
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;
        CREATE TABLE words (
            word     TEXT NOT NULL,      -- lowercase headword
            tamil    TEXT,               -- JSON [{pos, ta:[...]}]
            senses   TEXT,               -- JSON [{pos, def}]
            examples TEXT,               -- JSON [string]
            ipa      TEXT,
            pron_ta  TEXT
        );
        CREATE TABLE ta_index (term TEXT NOT NULL, word TEXT NOT NULL, rank INTEGER NOT NULL, PRIMARY KEY (term, word)) WITHOUT ROWID;
    """)

    rows, ta_rows = [], []
    for word in sorted(vocab):
        t = tamil.get(word, [])
        s = interleave(wn.get(word, []))
        senses = [{"pos": p, "def": d} for p, d, _ in s[:MAX_SENSES]]
        examples = pick_examples(word, s, all_examples, ex_index)
        phones = cmu.get(word)
        if not phones and " " in word and all(p in cmu for p in word.split()):
            phones = [ph for p in word.split() for ph in cmu[p] + ["|"]][:-1]
        ipa = arpabet_to_ipa(phones) if phones else ""
        pron_ta = arpabet_to_tamil(phones) if phones else ""
        if not t and not senses:
            continue
        rows.append((word, json.dumps(t, ensure_ascii=False) if t else None,
                     json.dumps(senses, ensure_ascii=False) if senses else None,
                     json.dumps(examples, ensure_ascii=False) if examples else None,
                     ipa or None, pron_ta or None))
        # reverse index: first few Tamil meanings of each word -> word (for Tamil -> English search offline)
        if " " not in word or len(word) < 20:
            for g in t:
                # common words (those with a known pronunciation) rank above rare ones
                penalty = 0 if phones else 4
                for rank, term in enumerate(g["ta"][:6]):
                    if 1 < len(term) <= 25:
                        ta_rows.append((term, word, rank + penalty))

    db.executemany("INSERT INTO words VALUES (?,?,?,?,?,?)", rows)
    db.executemany("INSERT OR IGNORE INTO ta_index VALUES (?,?,?)", ta_rows)
    db.execute("CREATE UNIQUE INDEX words_word ON words(word)")
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("version", "1"),
        ("sources", "eng2tamildictionary (GPL-3.0); WordNet 3.1; CMU Pronouncing Dictionary"),
        ("words", str(len(rows))),
    ])
    db.commit()
    db.execute("VACUUM")
    db.close()
    print(f"wrote {len(rows)} words, {len(ta_rows)} Tamil index rows -> {args.out} "
          f"({os.path.getsize(args.out) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
