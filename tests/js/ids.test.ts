import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { idsFromInput, pieceId } from "../../src/lib/ids.ts";
import { pyLen, pyNormalize, pyStrip } from "../../src/lib/pytext.ts";

const v = JSON.parse(readFileSync(new URL("./id-vectors.json", import.meta.url), "utf8"));

test("piece ids match the contract, including whitespace edge cases", () => {
  assert.ok(v.pieces.length >= 6);
  for (const row of v.pieces) {
    assert.equal(pyNormalize(pyStrip(row.headline)), row.normalized_headline);
    assert.equal(pyNormalize(pyStrip(row.summary)), row.normalized_summary);
    assert.equal(pyLen(row.normalized_headline), row.h_len);
    assert.equal(pyLen(row.normalized_summary), row.s_len);
    assert.equal(pieceId(v.author, row.headline, row.summary), row.piece_id, JSON.stringify(row.headline));
    assert.equal(pieceId(v.author.toUpperCase().replace("0X", "0x"), row.headline, row.summary), row.piece_id);
  }
});

test("the pieces of the on-chain run are reproduced from the author wallet", () => {
  const A = "0x6276095FAEA15108740445ff277fdA8c304657F4";
  const S = "In mice, the compound slowed tumour growth by a third.";
  assert.equal(pieceId(A, "Compound slows tumour growth by a third", S), "9ee4ab459dcb19619fe077709ad03075b872c14f7bac7feb37a8b84f1f316324");
  assert.equal(pieceId(A, "Compound slows tumour growth in mice", S), "1dd6fdf77274501af27a7c0cbdd0ed14326948856e1142db5eccc6665f183d79");
});

test("ids are found in a bare id, a 0x id, a link or a list, without duplicates", () => {
  const a = "9ee4ab459dcb19619fe077709ad03075b872c14f7bac7feb37a8b84f1f316324";
  const b = "1dd6fdf77274501af27a7c0cbdd0ed14326948856e1142db5eccc6665f183d79";
  assert.deepEqual(idsFromInput(a), [a]);
  assert.deepEqual(idsFromInput("0x" + a.toUpperCase()), [a]);
  assert.deepEqual(idsFromInput(`https://x.app/?pieces=${a},${b}&y=1`), [a, b]);
  assert.deepEqual(idsFromInput(`${a} ${a}`), [a]);
  assert.deepEqual(idsFromInput(a + "ab"), []);
  assert.deepEqual(idsFromInput("nothing here"), []);
});
