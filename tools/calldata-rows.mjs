// Shared rows for tools/calldata-bytes.mjs, tools/probe-calldata.mjs and tests.
export const ID = "f".repeat(64);

// Each case: [summary, headline].
export const CASES = {
  O1: ["In mice, the compound slowed tumour growth by a third.", "Compound slows tumour growth by a third"],
  O2: ["Sales rose in two of the five regions last quarter.", "Sales rose last quarter"],
  O3: ["Some users reported the battery lasted longer after the update.", "Update makes the battery last longer"],
  O4: ["The council discussed closing the library on Sundays.", "Council closes the library on Sundays"],
  O5: ["The trial found the drug may reduce migraines for some adults.", "Drug cures migraines in adults"],
  W1: ["In mice, the compound slowed tumour growth by a third.", "Compound slows tumour growth in mice"],
  W2: ["Sales rose in all five regions last quarter.", "Sales rose last quarter"],
  W3: ["Every phone in the test kept its charge longer after the update.", "Update makes the battery last longer"],
  W4: ["The council voted to close the library on Sundays.", "Council closes the library on Sundays"],
  W5: ["The trial found the drug reduced migraines for most adults.", "Drug reduces migraines for most adults"],
};

/** HARD BLOCK: any of these over 255 bytes stops the release. */
export function hardBlockRows() {
  const rows = Object.entries(CASES).map(([name, [summary, headline]]) => ({ name: `publish ${name}`, method: "publish", args: [headline, summary] }));
  rows.push({ name: "publish (90-char headline + 134-char summary)", method: "publish", args: ["h".repeat(90), "s".repeat(134)] });
  rows.push({ name: "challenge (id)", method: "challenge", args: [ID] });
  rows.push({ name: "retire (id)", method: "retire", args: [ID] });
  rows.push({ name: "withdraw ()", method: "withdraw", args: [] });
  return rows;
}

/** MEASURE ONLY: the contract caps are wider than the RPC carries. */
export function measureOnlyRows() {
  return [{ name: "publish at the caps (90 + 240)", method: "publish", args: ["h".repeat(90), "s".repeat(240)] }];
}
