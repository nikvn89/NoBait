# NoBait V2 — deployment verified, runtime pending

Contract version 2.0.0. Fresh Project address: `0xB4f042B07E140F990DE7e5c6fecdd6bB46cF9816`. Deployment is FINALIZED with explicit normal GenVM return; fetched source SHA-256 matches SOURCE_SHA256.txt and finalized get_limits identifies version 2.0.0. See [deployment evidence](tests/evidence/deployment.json). Source capture, model consensus and native payout runtime are NOT RUN. Old transactions/images are retained as v1 history only.

## Minimal signed path after fresh deploy

Use two different StudioNet wallets. Begin with **0.001 GEN per bond**. Wait for finalized normal-return receipts and reload authoritative state after each write. A signature/submitted hash is not execution success.

1. Deployment/source/profile verification is complete. Upload the corrected dApp, set VITE_CONTRACT_ADDRESS to the Project address above and redeploy before following the signed path.
2. Author publishes headline `Brookfield council orders Sunday library closures` with the new dApp's `/examples/town-council.txt` HTTPS URL, bond 0.001 GEN. The source is clearly labelled fictional testing content, not real news. Verify `get_source` contains the actual fetched text, source hash, all passage indexes and commitment.
3. Challenger loads that committed snapshot, selects the paragraph stating no vote/closure order occurred, and challenges with the matching bond. Expected `OVERCLAIMS`, with one or more real cited passages. Record the actual model result; do not relabel a different outcome as PASS.
4. Author publishes `Brookfield council discusses Sunday library closures` against the same source URL. Challenger selects a relevant passage and challenges. Expected `WITHIN` with a supporting citation; record the actual result and credit deltas. Compare source hashes and different headline commitments.
5. Each wallet withdraws its credits. Expected two allocations of 0.002 GEN each (one to each wallet) across the two rulings; both credit balances end at zero. Verify actual native transfer children and balances, not only credit clearance.

Optional ambiguity path: publish a specific library-decision headline against `/examples/unclear.txt`. A genuinely insufficient source should yield VOID and each bond refunded; this remains an expected test, not an observed result.

## Evidence to retain

- Fresh contract/deploy tx and code fingerprint; exact source URL and on-chain snapshot/hash/commitment.
- Publication IDs, source passage indexes, selected challenger quotes, actual verdict and validator supporting citations.
- Full finalized parent hashes, explicit normal GenVM return, exact credits before/after and unchanged committed snapshot after ruling.
- Withdrawal parent/child linkage, child recipient/value, finalized credited flag and before/after wallet/native contract balances.
- Public Production dApp, new submitted full commit SHA and immutable compare link. Use the actual reviewed baseline where required by the steward.

The fixture articles are controlled software examples. Before describing the project as working with arbitrary news publishers, additionally test an accessible external article and capture its independently retrieved snapshot. Dynamic/blocked pages may fail capture or yield insufficient content; there is no summary fallback.
