# NoBait V2 boundaries

## Source and verdict integrity

Publication fetches the public HTTPS URL in a non-deterministic block. Each validator performs its own HTTP check/render and compares the full rendered text with the leader. The complete accepted snapshot is stored with a Keccak-256 UTF-8 hash and a commitment binding it to author, normalized headline and exact URL. Source text and cited evidence cannot be edited afterward. Challenge reviews the stored snapshot; it does not silently switch to the current live page.

A challenger supplies an integer passage pointer, not a free-form substitute article or an unverified quotation. A fabricated index is rejected before model evaluation. The model reads all source passages and the selected pointer. Every conclusive decision requires 1–3 valid source indexes; validators independently re-evaluate and agree on the canonical outcome and citation indexes. Unclear or unusable output gives VOID and each bond is returned as credits. A model service exception reverts the challenge instead of issuing an author-favouring default.

These guarantees bind the result to a source, not to reality. The publisher may be wrong or controlled by the author. The contract does not verify publisher identity, legal ownership, external facts or the authenticity of a report. Independently retrieving a source is not proof of its truth.

The snapshot is rendered readable text, including any navigation/advertisements; it is not a signed publisher archive or raw-HTML digest. HTTP check and rendering are separate requests. A 200 response alone does not establish article quality. Blocked, dynamic, paywalled, incomplete or unstable pages may be unusable. Nodes seeing different text must not agree to capture. Bounds reject large/many-passage sources without truncation.

## Model and incentives

All headline/source strings are untrusted data in a JSON payload, including embedded instructions. JSON framing is not a guarantee against prompt injection. A real model can still make mistakes; strict citation agreement may cause additional consensus failures. These properties require live evaluation.

One challenge per publication is final. Same-wallet self-challenge is blocked, but multiple wallets cannot be proven to represent different people; an author may self-deal through another wallet. Different headlines/URLs create new publications. No claim of Sybil resistance or elimination of semantic grinding is made.

## GEN

Publish/challenge accept bonds; deterministic outcome handling allocates credits only. The author may retire an OPEN piece. Withdraw zeroes the caller's credit before emitting a native transfer. No admin can redirect credits. Credit clearance and transaction return do not alone prove native delivery; recipient/value, finalized linked transfer and balance evidence are needed.

## Frontend

No default legacy address. Writes require the 2.0.0 source/citation profile, the connected wallet and correct StudioNet chain. Reads use LATEST_FINAL. Source hashes, commitment and full paragraph derivation are checked before signing. Conclusive postconditions check both wallets' credits and source-derived citations. Raw finalized normal-return receipts are required; missing receipt data stays pending. Pending writes block repetition; manual Check again rechecks the receipt as well as state.

Source text is rendered as React text, never raw HTML. URL syntax excludes obvious local/IP/credential targets but does not by itself prevent DNS rebinding or redirects; external web-service network restrictions remain important. No private key is read by the application.
