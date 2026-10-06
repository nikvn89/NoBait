# TESTING

```
COMPILE PASS ≠ RUNTIME PASS
SUBMITTED ≠ ACCEPTED ≠ FINALIZED ≠ EXECUTION SUCCESS ≠ POSTCONDITION PASS
```

## Automated gates (run before release; CI runs them on every push)

| Gate | Command | Result |
|---|---|---|
| Kill-set + rubric gate | `python3 HEADLINEBOUND_KILLSET_CHECK.py contracts/HeadlineBound.py` | rc 0 — no word or word pair separates the classes; the rubric shares no content word with any case |
| genvm-linter | `python3 -m genvm_linter.cli lint contracts/HeadlineBound.py` | pass |
| Contract tests (Direct Mode: the real py-genlayer v0.2.16 SDK, model mocked) | `python3 -m pytest tests/contract -q -p no:cacheprovider` | 51 passed |
| Mutation check | `python3 tools/mutate.py .` | 25/25 deliberate faults caught |
| Frontend build | `npm run build` | rc 0 |
| Frontend tests | `npm test` | 54 passed |
| Source hash | `npm run verify:source` | `contracts/HeadlineBound.py` matches `SOURCE_SHA256.txt` |
| Calldata table | `node tools/calldata-bytes.mjs` | every write ≤ 255 bytes (largest case 124) |
| Calldata on the RPC | `node tools/probe-calldata.mjs <address>` | runs in CI against both addresses in `deployments.json` |

The mocked model labels drive the deterministic code paths; they say nothing about what the real model returns. The
on-chain runs do.

### What the mutation check catches

Each fault is applied to the contract alone and the suite must go red (`tests/mutations.py`): bonds credited to the wrong
side for each ending, VOID not refunding, a piece challengeable twice, the bond check dropped or moved after the model
call, the author allowed to challenge, retire not returning the bond or allowed for others, withdraw not zeroing before
the transfer, the fail-safe flipped, an unknown label accepted, the validator accepting any label, every limit off by
one, the reserved-token check dropped, a single-pass fence, the wallet leaking into the prompt, and the check order
swapped.

### Calldata

Encoded exactly as genlayer-js 1.1.8 `writeContract` does. The case set measures up to 124 bytes. With a 90-character
headline, the longest ASCII summary that fits is **134 characters**; a piece at the caps (90 + 240) measures 363 bytes
and is refused by the RPC. The publish form shows a live byte meter and disables Publish above 255 bytes.

## Frontend checks

- **Revert sentences** (`tests/js/rules.test.ts`): the set in `src/lib/rules.ts` equals the 13 sentences in the source,
  and for `publish`, `challenge`, `retire` and `withdraw` the UI reports the earliest failing check in the source's order.
  The app always sends exactly the piece's bond with a challenge.
- **Piece ids** (`tests/js/ids.test.ts`, `tests/js/ids-html.test.ts`): viem Keccak-256 and Python whitespace rules; equal
  to vectors produced by the contract on the real SDK and to the pieces of the on-chain run.
- **Postconditions** (`tests/js/verify.test.ts`): a challenge is reported only when the reloaded piece names this wallet
  as challenger, holds no bond, and this wallet's credits moved by exactly what the ending says (+2 bonds, 0, or +1 bond).
- **Receipts** (`tests/js/receipt.test.ts`): a leader SUCCESS while validators are still proposing, committing or
  revealing is pending, not success.
- **Interface check** (Playwright against `vite preview`, the RPC mocked by decoding calldata): overview, a board with two
  open pieces as challenger and as author, the same board after OVERCLAIMS and WITHIN, credits, publish with a duplicate
  and with a reserved word, verification, and 390 px — no page error, no horizontal scroll.

## On-chain runs

See `RUNTIME_EVIDENCE.md`: the Project run through this app (11 transactions) and the Intelligent Contract run
(18 transactions, every must-verify row PASS), one hash per row.

Project run through the app: over one summary, "…by a third" was ruled **OVERCLAIMS** (both bonds to the challenger) and
"…in mice" **WITHIN** (both to the author); the author's Challenge button was disabled with the contract's sentence; a
third piece was ruled WITHIN; both wallets withdrew and their credits read 0. Every result was reported by the app only
after it re-read the accepted state: **PASS**.

## Consensus behaviour

The model is called once per challenge. Validators re-run the reading and must agree on the exact label; a disagreement
rotates the leader or ends the transaction without a ruling. In the Intelligent Contract run, one challenge (W4) needed a
leader rotation before validators agreed on WITHIN. `publish`, `retire` and `withdraw` are deterministic.

## What this run does NOT prove

- Each case is sent once; label stability across repeated runs or validator sets is not measured.
- O2, O3, O5, W2, W3 and W5 are tested offline only.
- The `VOID` path (unusable model output) is proven offline only.
- Pieces longer than the calldata limit (about 224 characters combined) are not sent.
- Direct Mode does not record native transfers; real transfers are proven only on StudioNet.
- Prompt-injection resistance rests on the fence and the reserved-token check; no adversarial model run is done.
