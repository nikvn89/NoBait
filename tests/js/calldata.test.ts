// Calldata size of every write method, encoded exactly as genlayer-js 1.1.8 does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calldataBytes, CALLDATA_LIMIT } from "../../src/lib/calldata.ts";
import { CASES, hardBlockRows } from "../../tools/calldata-rows.mjs";

test("ten cases + every other write at its maximum stay under 255 bytes", () => {
  assert.equal(Object.keys(CASES).length, 10);
  for (const row of hardBlockRows()) {
    const n = calldataBytes(row.method, row.args);
    assert.ok(n <= CALLDATA_LIMIT, `${row.name}: ${n} bytes`);
  }
});

test("a piece at the caps is over the cliff (the publish meter must catch it)", () => {
  assert.ok(calldataBytes("publish", ["h".repeat(90), "s".repeat(240)]) > CALLDATA_LIMIT);
  assert.ok(calldataBytes("publish", ["h".repeat(90), "s".repeat(134)]) <= CALLDATA_LIMIT);
  assert.ok(calldataBytes("publish", ["h".repeat(90), "s".repeat(135)]) > CALLDATA_LIMIT);
});
