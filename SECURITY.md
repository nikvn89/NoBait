# SECURITY

## Money

The contract holds GEN: bonds of open pieces and credits not yet withdrawn. GEN enters only through `publish` and
`challenge` (payable) and leaves only through `withdraw`, which pays the caller alone and zeroes the credit before
sending. `challenge` — the only method with a model call — writes credits and never sends GEN.

## Where the central rule lives

Whether a headline overclaims is decided only by validators inside `challenge`. What follows is one deterministic table
in the contract: OVERCLAIMS → both bonds to the challenger, WITHIN → both to the author, VOID → each side refunded. The
app never decides the ruling and never screens text: it reads `state` and `outcome` back from `get_piece` (checked by
`tests/js/rules.test.ts`).

## Fail-safe

Unusable output becomes `VOID`: both bonds return to their owners and the piece is closed, so nobody can grind for a
better reading. A model that itself answers "VOID" is treated as unusable output.

## Prompt fence

The summary and the headline sit inside `<UNTRUSTED_SUMMARY>` and `<UNTRUSTED_HEADLINE>` tags. The four tags and the
three labels are refused in any letter case on input (even inside longer words) and stripped to a fixed point inside the
prompt. The model sees no wallet, bond or state.

## Grinding and self-dealing

One challenge per piece. The author cannot challenge their own piece from the same wallet; from a second wallet they can,
at the risk of their own bond (see the README).

## Frontend

- No MetaMask Snap: the app switches the network with `wallet_switchEthereumChain` / `wallet_addEthereumChain`.
- One same-origin RPC proxy (`/genlayer-rpc`, in `vite.config.ts` and `vercel.json`) for reads, receipts and writes.
- A write is reported only after the leader receipt says SUCCESS **and** consensus has reached ACCEPTED, and only after
  the reloaded state shows the change; otherwise "confirmation delayed" with a Check again button that re-reads state.
- Every revert predictable from state disables the button with the contract's own sentence. A challenge always sends
  exactly the piece's bond, read from the view. Amounts are bigint from view to wallet.
- Contract text is rendered as React text; no raw HTML. The board of piece ids is kept in the URL and, when the browser
  allows it, in local storage — nothing else is stored.

## Remaining limits

See "Honest limitation" in the README.
