import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyTransaction, revertReasonFrom } from "../../src/lib/receipt.ts";
import { errorMessage } from "../../src/lib/errors.ts";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const hex = (s: string) => "0x" + Buffer.from(s, "utf8").toString("hex");

test("SUCCESS on the leader receipt is success", () => {
  const tx = { status: "ACCEPTED", consensus_data: { leader_receipt: [{ mode: "leader", execution_result: "SUCCESS" }] } };
  assert.equal(classifyTransaction(tx).kind, "success");
});

test("leader SUCCESS while consensus is still running is pending, not success", () => {
  for (const status of ["PROPOSING", "COMMITTING", "REVEALING", "PENDING", 3, "4"]) {
    const v = classifyTransaction({ status, consensus_data: { leader_receipt: [{ mode: "leader", execution_result: "SUCCESS" }] } });
    assert.equal(v.kind, "pending", String(status));
  }
  for (const status of ["FINALIZED", 7, "5", "READY_TO_FINALIZE"]) {
    const v = classifyTransaction({ status, consensus_data: { leader_receipt: [{ mode: "leader", execution_result: "SUCCESS" }] } });
    assert.equal(v.kind, "success", String(status));
  }
  assert.equal(classifyTransaction({ status: 6, consensus_data: { leader_receipt: { mode: "leader", execution_result: "SUCCESS" } } }).kind, "error");
});

test("validator receipt listed first does not count; leader is found by mode", () => {
  const tx = { consensus_data: { leader_receipt: [
    { mode: "validator", execution_result: "SUCCESS" },
    { mode: "leader", execution_result: "ERROR", result: b64("UserError: The author cannot challenge their own piece") },
  ] } };
  const v = classifyTransaction(tx);
  assert.equal(v.kind, "error");
  assert.equal(v.kind === "error" && v.reason, "The author cannot challenge their own piece");
});

test("missing or null execution result is NOT success", () => {
  assert.equal(classifyTransaction({ status: "PENDING" }).kind, "pending");
  assert.equal(classifyTransaction({ consensus_data: { leader_receipt: [{ mode: "leader", execution_result: null }] } }).kind, "pending");
  assert.equal(classifyTransaction({ consensus_data: { leader_receipt: null } }).kind, "pending");
  assert.equal(classifyTransaction(null).kind, "pending");
});

test("UNDETERMINED / CANCELED is a failure even with a SUCCESS leader", () => {
  const v = classifyTransaction({ status: "UNDETERMINED", consensus_data: { leader_receipt: { mode: "leader", execution_result: "SUCCESS" } } });
  assert.equal(v.kind, "error");
});

test("revert reason found in plain, hex and base64 fields", () => {
  assert.equal(revertReasonFrom({ error: "[rollback] This piece is no longer open to challenge" }), "This piece is no longer open to challenge");
  assert.equal(revertReasonFrom({ result: hex("The challenge bond must equal the author's bond") }), "The challenge bond must equal the author's bond");
  assert.equal(revertReasonFrom({ genvm_result: { stderr: b64("x UserError('Unknown piece id')") } }), "Unknown piece id");
  assert.equal(revertReasonFrom({ a: "nothing here" }), null);
});

test("errorMessage walks every nested cause", () => {
  const err = { message: "Execution reverted", cause: { shortMessage: "RPC error", cause: { details: "UserError: Only the author may retire this piece" } } };
  assert.equal(errorMessage(err), "Only the author may retire this piece");
  assert.equal(errorMessage({ code: 4001, message: "User rejected the request." }), "The wallet request was rejected.");
  assert.match(errorMessage(new Error("RLP string ends with 12 superfluous bytes")), /255 bytes/);
});
