"""CMU ARPAbet phonemes -> IPA, and -> an approximate pronunciation in Tamil letters.

Example: verdict  V ER1 D IH0 K T  ->  /ˈvɝdɪkt/  and  வெர்டிக்ட்
"""

IPA_VOWELS = {
    "AA": "ɑ", "AE": "æ", "AH": "ʌ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ", "EH": "ɛ", "ER": "ɝ",
    "EY": "eɪ", "IH": "ɪ", "IY": "i", "OW": "oʊ", "OY": "ɔɪ", "UH": "ʊ", "UW": "u",
}
IPA_CONS = {
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "F": "f", "G": "ɡ", "HH": "h", "JH": "dʒ", "K": "k",
    "L": "l", "M": "m", "N": "n", "NG": "ŋ", "P": "p", "R": "r", "S": "s", "SH": "ʃ", "T": "t",
    "TH": "θ", "V": "v", "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ",
}


def arpabet_to_ipa(phones):
    out = []
    for ph in phones:
        if ph == "|":
            out.append(" ")
            continue
        base, stress = ph.rstrip("012"), ph[len(ph.rstrip("012")):]
        if base in IPA_VOWELS:
            sym = IPA_VOWELS[base]
            if base == "AH" and stress == "0":
                sym = "ə"
            if base == "ER" and stress == "0":
                sym = "ɚ"
            mark = {"1": "ˈ", "2": "ˌ"}.get(stress, "")
            if mark:
                # put the mark before the consonant just before this vowel (approximate syllable start)
                if out and out[-1] and out[-1] not in IPA_VOWELS.values() and out[-1] not in ("ə", "ɚ", " ", "ˈ", "ˌ"):
                    out.insert(len(out) - 1, mark)
                else:
                    out.append(mark)
            out.append(sym)
        else:
            out.append(IPA_CONS.get(base, ""))
    return "/" + "".join(out).strip() + "/"


# Tamil: consonant base letter (no pulli). Vowel sign is appended to the base; pulli (்) when no vowel follows.
TA_CONS = {
    "B": "ப", "CH": "ச", "D": "ட", "DH": "த", "F": "ஃப", "G": "க", "HH": "ஹ", "JH": "ஜ", "K": "க",
    "L": "ல", "M": "ம", "N": "ன", "NG": "ங", "P": "ப", "R": "ர", "S": "ஸ", "SH": "ஷ", "T": "ட",
    "TH": "த", "V": "வ", "W": "வ", "Y": "ய", "Z": "ஸ", "ZH": "ஷ",
}
# vowel -> (independent letter, sign after a consonant, trailing consonant written with pulli)
TA_VOWEL = {
    "AA": ("ஆ", "ா", ""), "AE": ("ஏ", "ே", ""), "AH": ("அ", "", ""), "AO": ("ஆ", "ா", ""),
    "AW": ("அ", "", "வு"), "AY": ("ஐ", "ை", ""), "EH": ("எ", "ெ", ""), "ER": ("எ", "ெ", "ர்"),
    "EY": ("ஏ", "ே", ""), "IH": ("இ", "ி", ""), "IY": ("ஈ", "ீ", ""), "OW": ("ஓ", "ோ", ""),
    "OY": ("ஆ", "ா", "ய்"), "UH": ("உ", "ு", ""), "UW": ("ஊ", "ூ", ""),
}
PULLI = "்"


def arpabet_to_tamil(phones):
    out = []
    pending = None  # consonant waiting to see whether a vowel follows
    word_start = True

    def flush():
        nonlocal pending
        if pending is not None:
            out.append(pending + PULLI)
            pending = None

    last_vowel = None
    for ph in phones:
        if ph == "|":
            flush()
            out.append(" ")
            word_start = True
            last_vowel = None
            continue
        base, stress = ph.rstrip("012"), ph[len(ph.rstrip("012")):]
        if base in TA_VOWEL and pending is None and out and out[-1] == "வு":
            out[-1] = ""  # "power": பவு + அர் -> பவர்
            pending = "வ"
        if base in TA_VOWEL and pending is None and out and out[-1] in ("ர்", "ய்"):
            pending = out.pop()[0]  # "courage": கெர் + அஜ் -> கெரஜ், "boyish" -> பாயிஷ்
        if base in TA_VOWEL and pending is None and last_vowel:
            # two vowels in a row: Tamil writes a glide between them (ஸீ-யே-ஷன், கோ-வா)
            pending = "ய" if last_vowel in ("IY", "IH", "EY", "AY", "EH", "AE", "OY") else "வ"
        if base == "Y" and pending is not None:
            out.append(pending + "ி")
            pending = None
            last_vowel = "IY"
            continue
        if base in TA_VOWEL:
            indep, sign, tail = TA_VOWEL[base]
            if base == "ER" and stress == "0":  # unstressed -er as in "teacher" -> டீச்சர்
                indep, sign = "அ", ""
            if pending is not None:
                out.append(pending + sign)
                pending = None
            else:
                out.append(indep)
            if tail:
                out.append(tail)
            word_start = False
            last_vowel = None if tail else base
        else:
            flush()
            last_vowel = None
            letter = TA_CONS.get(base, "")
            if base == "N" and word_start:
                letter = "ந"
            if base == "CH":  # "church" sounds closer with a doubled ச்ச
                if not word_start:
                    out.append("ச்")
            pending = letter
            word_start = False
    flush()
    return "".join(out)


if __name__ == "__main__":
    tests = {
        "verdict": "V ER1 D IH0 K T", "beautiful": "B Y UW1 T AH0 F AH0 L", "teacher": "T IY1 CH ER0",
        "name": "N EY1 M", "house": "HH AW1 S", "pronunciation": "P R OW0 N AH2 N S IY0 EY1 SH AH0 N",
    }
    for w, p in tests.items():
        ph = p.split()
        print(w, arpabet_to_ipa(ph), arpabet_to_tamil(ph))
