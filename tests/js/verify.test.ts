import { test } from "node:test";
import assert from "node:assert/strict";
import { challengeVerified, publishVerified, retireVerified, withdrawVerified } from "../../src/lib/verify.ts";
import type { Credits, Piece } from "../../src/lib/types.ts";

const ME = "0x" + "b".repeat(40);
const AUTHOR = "0x" + "a".repeat(40);
const BOND = "1000000000000000000";
const piece = (o: Partial<Piece> = {}): Piece => ({ piece_id: "p".repeat(64), author: AUTHOR, headline: "Council closes the library on Sundays",
  summary: "The council voted to close the library on Sundays.", bond_wei: BOND, state: "OPEN", challenger: "", outcome: "", open_to_challenge: true, held_wei: BOND, ...o });
const cr = (credits: string): Credits => ({ wallet: ME, credits });
const before = { piece: piece(), myCredits: cr("2000000000000000000") };
const ruled = (outcome: string, state: string) => piece({ outcome, state, challenger: ME, open_to_challenge: false, held_wei: "0" });

test("publish: the stored piece carries my wallet, the stripped texts and the bond held", () => {
  const s = { id: "p".repeat(64), me: AUTHOR.toUpperCase().replace("0X", "0x"), headline: " Council closes the library on Sundays ", summary: "The council voted to close the library on Sundays.", bondWei: 10n ** 18n };
  assert.equal(publishVerified(piece(), s), true);
  assert.equal(publishVerified(piece({ held_wei: "0" }), s), false);
  assert.equal(publishVerified(piece({ bond_wei: "1" }), s), false);
  assert.equal(publishVerified(null, s), false);
});

test("OVERCLAIMS: I am the challenger and both bonds became my credits", () => {
  assert.equal(challengeVerified(before, { piece: ruled("OVERCLAIMS", "RULED_OVERCLAIMS"), myCredits: cr("4000000000000000000") }, ME).ok, true);
  assert.equal(challengeVerified(before, { piece: ruled("OVERCLAIMS", "RULED_OVERCLAIMS"), myCredits: cr("3000000000000000000") }, ME).ok, false);
});

test("WITHIN: my credits did not move (the author took both)", () => {
  assert.equal(challengeVerified(before, { piece: ruled("WITHIN", "RULED_WITHIN"), myCredits: cr("2000000000000000000") }, ME).ok, true);
  assert.equal(challengeVerified(before, { piece: ruled("WITHIN", "RULED_WITHIN"), myCredits: cr("4000000000000000000") }, ME).ok, false);
});

test("VOID: my own bond came back", () => {
  assert.equal(challengeVerified(before, { piece: ruled("VOID", "VOID"), myCredits: cr("3000000000000000000") }, ME).ok, true);
});

test("a ruling recorded for someone else, a mismatched state or bonds still held are not mine", () => {
  assert.equal(challengeVerified(before, { piece: { ...ruled("OVERCLAIMS", "RULED_OVERCLAIMS"), challenger: AUTHOR }, myCredits: cr("4000000000000000000") }, ME).ok, false);
  assert.equal(challengeVerified(before, { piece: ruled("OVERCLAIMS", "RULED_WITHIN"), myCredits: cr("4000000000000000000") }, ME).ok, false);
  assert.equal(challengeVerified(before, { piece: { ...ruled("OVERCLAIMS", "RULED_OVERCLAIMS"), held_wei: BOND }, myCredits: cr("4000000000000000000") }, ME).ok, false);
  assert.equal(challengeVerified(before, { piece: piece(), myCredits: cr("2000000000000000000") }, ME).ok, false);
});

test("retire and withdraw are checked on reloaded credits", () => {
  assert.equal(retireVerified({ piece: piece(), myCredits: cr("0") }, { piece: piece({ state: "RETIRED", held_wei: "0" }), myCredits: cr(BOND) }), true);
  assert.equal(retireVerified({ piece: piece(), myCredits: cr("0") }, { piece: piece({ state: "RETIRED", held_wei: "0" }), myCredits: cr("0") }), false);
  assert.equal(withdrawVerified(cr("5000000000000000000"), cr("0")), true);
  assert.equal(withdrawVerified(cr("0"), cr("0")), false);
  assert.equal(withdrawVerified(cr("5"), cr("5")), false);
});
