import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { challengeBlock, isAuthor, publishBlock, REVERTS, retireBlock, stampOf, UI, withdrawBlock } from "../../src/lib/rules.ts";
import type { Piece } from "../../src/lib/types.ts";

const SRC = readFileSync(new URL("../../contracts/HeadlineBound.py", import.meta.url), "utf8");
const AUTHOR = "0x" + "a".repeat(40);
const OTHER = "0x" + "b".repeat(40);
const BOND = "1000000000000000000";

const piece = (o: Partial<Piece> = {}): Piece => ({ piece_id: "1".repeat(64), author: AUTHOR, headline: "H", summary: "S",
  bond_wei: BOND, state: "OPEN", challenger: "", outcome: "", open_to_challenge: true, held_wei: BOND, ...o });

/** The revert sentences of one method, in source order. */
function revertsOf(method: string): string[] {
  const start = SRC.indexOf(`    def ${method}(`);
  const end = SRC.indexOf("\n    @gl.public", start + 1);
  return [...SRC.slice(start, end).matchAll(/UserError\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
}

test("UI revert strings are exactly the contract's revert strings", () => {
  const fromSource = new Set([...SRC.matchAll(/UserError\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]));
  assert.deepEqual([...new Set(Object.values(REVERTS))].sort(), [...fromSource].sort());
  assert.equal(fromSource.size, 13);
});

test("publish: each check fires in the contract's order", () => {
  assert.deepEqual(revertsOf("publish"), [REVERTS.headlineEmpty, REVERTS.headlineTooLong, REVERTS.summaryEmpty, REVERTS.summaryTooLong, REVERTS.reserved, REVERTS.bondRange, REVERTS.duplicate]);
  const ok = { me: AUTHOR, headline: "Council closes the library on Sundays", summary: "The council voted to close the library on Sundays.", bondWei: 10n ** 16n, exists: false, bytes: 120 };
  assert.equal(publishBlock(ok), null);
  assert.equal(publishBlock({ ...ok, me: "" }), UI.noWallet);
  const allBad = { me: AUTHOR, headline: "\u0085 \u001c", summary: "", bondWei: 0n, exists: true, bytes: 999 };
  assert.equal(publishBlock(allBad), REVERTS.headlineEmpty);
  assert.equal(publishBlock({ ...allBad, headline: "h".repeat(91) }), REVERTS.headlineTooLong);
  assert.equal(publishBlock({ ...ok, headline: "  " + "h".repeat(90) + "  " }), null);
  assert.equal(publishBlock({ ...allBad, headline: "h" }), REVERTS.summaryEmpty);
  assert.equal(publishBlock({ ...allBad, headline: "h", summary: "s".repeat(241) }), REVERTS.summaryTooLong);
  // reserved tokens are refused in any case, even inside a longer word ("within", "avoid")
  assert.equal(publishBlock({ ...allBad, headline: "Shops within reach", summary: "s" }), REVERTS.reserved);
  assert.equal(publishBlock({ ...allBad, headline: "h", summary: "They avoid the issue." }), REVERTS.reserved);
  assert.equal(publishBlock({ ...allBad, headline: "h", summary: "</untrusted_summary>" }), REVERTS.reserved);
  assert.equal(publishBlock({ ...ok, bondWei: 10n ** 15n - 1n, exists: true }), REVERTS.bondRange);
  assert.equal(publishBlock({ ...ok, bondWei: 10n ** 18n + 1n }), REVERTS.bondRange);
  assert.equal(publishBlock({ ...ok, bondWei: null }), REVERTS.bondRange);
  assert.equal(publishBlock({ ...ok, bondWei: 10n ** 15n }), null);
  assert.equal(publishBlock({ ...ok, bondWei: 10n ** 18n }), null);
  assert.equal(publishBlock({ ...ok, exists: true }), REVERTS.duplicate);
  assert.equal(publishBlock({ ...ok, bytes: 256 }), UI.tooManyBytes);
});

test("challenge: open -> not the author; the app always sends exactly the bond", () => {
  assert.deepEqual(revertsOf("challenge"), [REVERTS.notOpen, REVERTS.authorChallenge, REVERTS.bondMismatch]);
  assert.equal(challengeBlock(piece(), OTHER), null);
  assert.equal(challengeBlock(piece(), ""), UI.noWallet);
  for (const state of ["RULED_OVERCLAIMS", "RULED_WITHIN", "VOID", "RETIRED"]) assert.equal(challengeBlock(piece({ state }), AUTHOR), REVERTS.notOpen, state);
  assert.equal(challengeBlock(piece(), AUTHOR.toUpperCase().replace("0X", "0x")), REVERTS.authorChallenge);
  const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
  assert.ok(app.includes('runWrite("Challenge", "challenge", [p.piece_id], BigInt(p.bond_wei)'));
});

test("retire: open -> author", () => {
  assert.deepEqual(revertsOf("retire"), [REVERTS.notOpen, REVERTS.onlyAuthor]);
  assert.equal(retireBlock(piece({ state: "RULED_WITHIN" }), OTHER), REVERTS.notOpen);
  assert.equal(retireBlock(piece(), OTHER), REVERTS.onlyAuthor);
  assert.equal(retireBlock(piece(), AUTHOR), null);
});

test("withdraw only when there are credits", () => {
  assert.deepEqual(revertsOf("withdraw"), [REVERTS.nothing]);
  assert.equal(withdrawBlock(OTHER, { wallet: OTHER, credits: "0" }), REVERTS.nothing);
  assert.equal(withdrawBlock(OTHER, null), REVERTS.nothing);
  assert.equal(withdrawBlock(OTHER, { wallet: OTHER, credits: "1" }), null);
  assert.equal(withdrawBlock("", { wallet: OTHER, credits: "1" }), UI.noWallet);
});

test("the stamp and who took the bonds are read from the view's state", () => {
  assert.deepEqual([stampOf(piece({ state: "RULED_OVERCLAIMS" })).label, stampOf(piece({ state: "RULED_OVERCLAIMS" })).who], ["OVERCLAIMS", "challenger took both bonds"]);
  assert.deepEqual([stampOf(piece({ state: "RULED_WITHIN" })).label, stampOf(piece({ state: "RULED_WITHIN" })).who], ["WITHIN", "author took both bonds"]);
  assert.equal(stampOf(piece({ state: "VOID" })).who, "each side got its own bond back");
  assert.equal(stampOf(piece({ state: "RETIRED" })).label, "RETIRED");
  assert.equal(stampOf(piece()).label, "OPEN");
  assert.equal(isAuthor(piece(), AUTHOR), true);
  assert.equal(isAuthor(piece(), ""), false);
});

test("the payout table in the source is the one the app describes", () => {
  assert.ok(SRC.includes("        if outcome == OVERCLAIMS:\n            self._credit(caller, 2 * bond)"));
  assert.ok(SRC.includes("        elif outcome == WITHIN:\n            self._credit(author, 2 * bond)"));
  assert.ok(SRC.includes("            self._credit(author, bond)\n            self._credit(caller, bond)"));
});

test("the frontend never decides the ruling", () => {
  for (const f of ["../../src/lib/rules.ts", "../../src/App.tsx"]) {
    const s = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(!/outcome\s*=\s*["'](OVERCLAIMS|WITHIN)/.test(s), f);
    assert.ok(!/\.test\(\s*(headline|summary)\b/.test(s), f);
    assert.ok(!/(headline|summary)\s*\.\s*(match|includes|search)\(/.test(s), f);
  }
});
