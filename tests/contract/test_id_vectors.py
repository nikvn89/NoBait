"""
Golden piece-id vectors shared with the frontend (tests/js/ids.test.ts and
tests/js/ids-html.test.ts read the same file). Every id is computed by the
contract's own code on the real SDK Keccak256.

Regenerate:  WRITE_VECTORS=1 python3 -m pytest tests/contract/test_id_vectors.py
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "tests" / "js" / "id-vectors.json"
CONTRACT = str(ROOT / "contracts" / "HeadlineBound.py")

AUTHOR = "0x3065e31b1d993d7c0d59e6786844cba56780b2d3"
PIECES = [
    ("Compound slows tumour growth by a third", "In mice, the compound slowed tumour growth by a third."),
    ("Compound slows tumour growth in mice", "In mice, the compound slowed tumour growth by a third."),
    ("  Council closes\tthe library\n on Sundays  ", "The council voted to close the library on Sundays."),
    ("\u001cBakery opens a second shop\u001f", "The bakery opened\u0085a second shop on Market Street this week."),
    ("﻿Headline with a byte order mark", "Summary\u001dwith\u001egroup separators."),
    ("Mairie : la bibliothèque ferme le dimanche", "Le conseil a voté　la fermeture le dimanche. \U0001F4F0"),
]


def build(contract):
    rows = []
    for headline, summary in PIECES:
        h = contract._normalize_text(headline.strip())
        s = contract._normalize_text(summary.strip())
        rows.append({"headline": headline, "summary": summary, "normalized_headline": h, "normalized_summary": s,
                     "h_len": len(h), "s_len": len(s), "piece_id": contract._piece_id(AUTHOR, h, s)})
    return {"author": AUTHOR, "pieces": rows}


def test_vectors_match_contract(direct_deploy):
    data = build(direct_deploy(CONTRACT))
    if os.environ.get("WRITE_VECTORS") == "1":
        VECTORS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    assert json.loads(VECTORS.read_text(encoding="utf-8")) == data
