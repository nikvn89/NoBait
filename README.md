<p align="center"><img src="logo.png" alt="NoBait" width="120"></p>

# NoBait V2 — source-backed headline challenges

NoBait compares a headline with a **validator-fetched, committed source snapshot**. The author supplies a headline and original HTTPS article URL, not a summary. A challenger selects a passage in the captured source and matches the author's GEN bond. Validators read the complete snapshot and must agree on a verdict **and supporting passage indexes** before credits are allocated.

**Contract: HeadlineBound 2.0.0. Local checks passed. The fresh deployment is finalized and its source matches this release. Distributed web/model consensus and native payouts are not yet tested.** The rejected v1 Project and its separate Intelligent Contract address are historical, not v2 deployments.

## Correction to the rejected submission

| Steward concern | V2 behavior |
| --- | --- |
| Only author-provided headline and summary were judged | `publish(headline, source_url)` checks the URL response and renders readable source text independently in the leader and validator functions |
| No committed underlying source | Publication stores the full agreed snapshot, original URL, Keccak-256 content hash and a commitment binding author/headline/URL/content |
| Challenger supplied no evidence | `challenge(piece_id, passage_index)` selects a concrete passage in that exact snapshot; fabricated or out-of-range references are rejected before model evaluation |
| Verdict lacked independently reviewed support | Model receives every source passage. A conclusive result needs 1–3 valid citations; validators re-evaluate and agree on verdict and canonical citation indexes |
| Unresolved pairs defaulted to author victory | `UNCLEAR` and unusable/uncited results become `VOID`; each side recovers its own bond as credits |

This evaluates **fidelity to the chosen, recorded source**, not universal truth, publisher identity or the authenticity of its underlying claims. An author can still choose an unreliable publisher. Independently fetching that publisher is not proof its reporting is true.

## Workflow and money

1. An author publishes a headline and URL with 0.001–1 GEN. HTTP success is checked and readable text rendered. Nodes must agree on the same complete snapshot before the publication becomes OPEN. Capture failure rolls back publication; no summary fallback exists.
2. Anyone can read `get_source(piece_id)`. The dApp verifies the snapshot hash/commitment, displays all passages and requires the challenger to select one. Only its integer index is sent with a matching bond.
3. Validators read the full committed source, headline and challenger pointer. `OVERCLAIMS` credits both bonds to the challenger; `WITHIN` credits both to the author; `VOID` returns each bond to its owner. A verdict includes source-derived citations; no arbitrary citation text is accepted from either party.
4. Each wallet withdraws its own credits separately. An OPEN publication can be retired by its author. A ruled/retired publication is terminal and cannot be challenged again.

The source is fetched **at publication**, not again at challenge. Later page changes, deletion or a revised author description cannot replace the committed snapshot. The dApp exposes both the mutable live URL and immutable recorded text. A new page version requires a distinct publication URL or headline; there is no edit method.

## Source format, bounds and hashes

- Public HTTPS DNS host; no credentials, fragments, explicit ports, local names or IP literals.
- Headline: 1–90 Python characters. URL: at most 512 characters.
- Snapshot: 80–12,000 characters of rendered readable text, CRLF/CR converted to LF and outer whitespace stripped. This is **not a hash of the raw HTML bytes**.
- Every nonempty rendered line is retained, split into at most 600-character passages; maximum 64 passages. Over-limit pages fail instead of being silently truncated or summarized.
- Rendered navigation, advertisements or paywalls may make a page unsuitable. Dynamic pages may fail exact capture consensus. Choose an accessible stable article; a substantive decision about a paywall/error/insufficient source must not be inferred.
- `source_hash` is Keccak-256 of the UTF-8 snapshot. `commitment` binds that hash to publication identity. `SOURCE_SHA256.txt` separately fingerprints the **contract code**.
- The UI retains a conservative 255-byte calldata compatibility budget from the earlier deployment. Select a shorter original URL/headline if it does not fit. This is not a claim about every provider's current limit.

## Deployment

Deploy **`contracts/HeadlineBound.py`**, class **HeadlineBound**, with **no constructor arguments** in GenLayer Studio. Do not upgrade or silently reuse either old address.

Read `get_limits()`: version `2.0.0`; `source_snapshot_required`, `challenger_passages`, `verdict_citations` and `external_web_used` must all be true.

On Vercel, set **VITE_CONTRACT_ADDRESS** to the new Project contract address, then redeploy. `.env.example` and the frontend default use `0xB4f042B07E140F990DE7e5c6fecdd6bB46cF9816`. An existing Vercel environment value overrides the default and must be updated. The frontend verifies the v2 profile before writes and refuses legacy v1 contracts. If deploying a separate Intelligent Contract submission, use a separate instance/address for that track.

```bash
npm ci
cp .env.example .env
# .env.example contains the verified v2 Project deployment.
npm run dev
```

## Verification

```bash
npm ci
npm run verify
pip install -r requirements-test.txt
python3 -m genvm_linter.cli lint contracts/HeadlineBound.py
python3 -m pytest tests/contract/test_source_backed.py -q -p no:cacheprovider
python3 tests/mutation_check.py
```

See [TESTING.md](TESTING.md), [RUNTIME_EVIDENCE.md](RUNTIME_EVIDENCE.md), [SECURITY.md](SECURITY.md) and [release.json](release.json). V1 documentation/source are under [docs/history/v1](docs/history/v1); the pre-existing [docs/evidence](docs/evidence) images are v1 history only. They do not establish v2 runtime results.

The observed v1 baseline is [`5e894ff28a9b67ad8c87cbb2b6dd5d448c2ebcad`](https://github.com/nikvn89/NoBait/tree/5e894ff28a9b67ad8c87cbb2b6dd5d448c2ebcad); its contract matches the user-provided rejected source. Its identity as the exact commit reviewed by the steward has not been independently confirmed. Pin the actual new upload SHA for corrected-submission Evidence and distinguish a development comparison from a verified reviewed baseline.

## Project V2 deployment

- [StudioNet contract](https://explorer-studio.genlayer.com/address/0xB4f042B07E140F990DE7e5c6fecdd6bB46cF9816)
- [Finalized deployment](https://explorer-studio.genlayer.com/tx/0xbe3fb8609a32b76aee70e2bd158586ddc2e48f2c4e69621bd5a8669aa8b42bdc)
- Source fingerprint and finalized `get_limits`: [deployment.json](tests/evidence/deployment.json).

Deployment verification does not establish source-capture, semantic accuracy or payout runtime results. See [RUNTIME_EVIDENCE.md](RUNTIME_EVIDENCE.md).
