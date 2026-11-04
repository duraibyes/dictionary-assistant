# Building the offline dictionary

Produces `app/assets/dict.db` (SQLite). Run it again only if you change the data or the script.

```bash
mkdir -p /tmp/dictdata && cd /tmp/dictdata
git clone --depth 1 https://github.com/linuxkathirvel/eng2tamildictionary e2t
npm pack wordnet-db@3.1.14 && tar xzf wordnet-db-3.1.14.tgz
curl -sO https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict
cd -   # back to data-build/
python3 build_dict.py --tamil /tmp/dictdata/e2t/dictionary.json --wordnet /tmp/dictdata/package/dict \
  --cmudict /tmp/dictdata/cmudict.dict --out ../app/assets/dict.db
```

After rebuilding, change `DICT_DB` in `app/App.tsx` (e.g. `dict-v2.db`) so installed apps copy the new file.

Tables:

- `words(word, tamil, senses, examples, ipa, pron_ta)` — `tamil` is JSON `[{pos, ta:[...]}]`,
  `senses` JSON `[{pos, def}]`, `examples` JSON `[string]`
- `ta_index(term, word, rank)` — Tamil meaning → English word, for offline Tamil search
- `meta(key, value)`

`pronounce.py` turns CMU phonemes into IPA and into Tamil letters (verdict → வெர்டிக்ட்).
