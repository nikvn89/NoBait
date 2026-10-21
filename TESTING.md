# NoBait V2 verification

Executed locally on 21 October 2026 against `contracts/HeadlineBound.py`, py-genlayer v0.2.16. **Fresh v2 deployment: verified finalized with normal return, matching source and finalized limits. Live source-capture/model judgments/native delivery: NOT RUN.** No old v1 result is counted as a v2 result.

| Check | Executed result | Meaning |
| --- | --- | --- |
| SDK Direct Mode | 61 passed | Real SDK storage, contract methods, mocked HTTP/render/model responses |
| Frontend tests | 18 passed | Hash/ID parity, source verification, citations, role gates, both credit deltas, finality, exact amounts |
| Directed mutations | 12/12 detected | Source-fetch consensus, source hash, full context, citations, uncertainty, consensus evidence, payout allocation, withdrawal replay, challenger pointer and HTTP gate |
| React DOM integration | 8 passed | Controlled API fixtures; source selection, exact pointer/value, cited results, failed reads, pending-write guard, profile gate and URL publication |
| GenVM AST lint | 3 checks passed | Offline lint; not a distributed execution result |
| TypeScript + Vite | Passed | Production compilation; profile guard intentionally starts unconfigured |

Machine-readable selected results are in [tests/evidence/local-results.json](tests/evidence/local-results.json) and [tests/evidence/mutations.json](tests/evidence/mutations.json).

## Important regression cases

- Validators independently fetch the source; a validator seeing different content refuses source capture agreement.
- Source body, URL, hash and publication commitment remain fixed after a later live page change. The challenge prompt receives the original whole snapshot, not the new page or a selected excerpt alone.
- Invalid HTTPS hosts, HTTP errors, renderer errors, source bounds and fabricated passage indexes cannot publish or consume a challenge.
- Conclusive labels without valid citations, out-of-range/boolean/duplicate indexes, extra keys, malformed JSON and `UNCLEAR` refund both bonds; uncertainty never defaults to `WITHIN`.
- Validators must agree on both outcome and canonical citations. Agreeing on a label while selecting different supporting passages is insufficient.
- Author/self-wallet challenge, incorrect bond, duplicate publication, repeated ruling/retirement and withdrawal replay are blocked. Immutable basis stays unchanged after withdrawal.
- Conservation holds over bonds held, credits and recorded withdrawals. Native delivery is replaced by a recorder in Direct Mode and is not proven by that recorder.
- Shared golden vectors compare real SDK Keccak/Unicode IDs and commitments with TypeScript. The browser verifies source text and passage segmentation before enabling a challenge.

## Reproduce

```bash
npm ci
npm run verify
pip install -r requirements-test.txt
python3 -m genvm_linter.cli lint contracts/HeadlineBound.py
python3 -m pytest tests/contract/test_source_backed.py -q -p no:cacheprovider
python3 tests/mutation_check.py
```

The suite mocks web and model outputs. Its labels are **assumed fixture results**; assertions prove plumbing, commitment checks, validator agreement rules and consequences. They do not measure real model accuracy, render reliability, publisher authenticity, distributed GenVM consensus, or prompt-injection resistance. Untrusted source instructions are retained as data in a test; that is not an adversarial LLM evaluation.

Remote schema compilation was not performed. SDK import/storage tests and offline lint were completed. The actual Studio deployment has now been verified (tests/evidence/deployment.json); the small signed path in RUNTIME_EVIDENCE.md remains necessary. The private DOM harness used jsdom with controlled API fixtures; it has no layout engine and is not included in this minimal public bundle. No real-browser layout or wallet-signing PASS is claimed.
