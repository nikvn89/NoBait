import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCredits, parseLimits, parsePiece } from "../../src/lib/parse.ts";

const PIECE = '{"piece_id": "9ee4", "author": "0xabc", "headline": "H", "summary": "S", "bond_wei": "1000000000000000000", "state": "RULED_OVERCLAIMS", "challenger": "0xb", "outcome": "OVERCLAIMS", "open_to_challenge": false, "held_wei": "0"}';

test("views are parsed as JSON once, or twice when the RPC double-encodes them", () => {
  assert.equal(parsePiece(PIECE)?.state, "RULED_OVERCLAIMS");
  assert.equal(parsePiece(JSON.stringify(PIECE))?.outcome, "OVERCLAIMS");
  assert.equal(parseLimits('{"rubric_hash": "ab", "version": "1.0.0"}')?.rubric_hash, "ab");
});

test("amounts stay decimal strings, including ones beyond 2^53", () => {
  assert.equal(parsePiece(PIECE)?.bond_wei, "1000000000000000000");
  assert.equal(parseCredits('{"wallet": "0xabc", "credits": "5000000000000000000"}')?.credits, "5000000000000000000");
});

test("unknown id, broken JSON or a numeric amount read as nothing", () => {
  assert.equal(parsePiece("{}"), null);
  assert.equal(parsePiece("not json"), null);
  assert.equal(parseCredits('{"credits": 5}'), null);
  assert.equal(parsePiece(PIECE.replace('"held_wei": "0"', '"held_wei": 0')), null);
});
