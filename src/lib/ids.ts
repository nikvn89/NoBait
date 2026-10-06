import { keccak256, stringToBytes } from "viem";
import { pyLen, pyNormalize, pyStrip } from "./pytext.ts";

// Keccak-256 (Ethereum), not NIST SHA3-256. Same payload as the contract:
// keccak256("HEADLINE_BOUND:PIECE:V1|" + author_lower + "|" + len(h) + "|" + h + "|" + len(s) + "|" + s),
// with headline and summary stripped and their whitespace collapsed exactly like Python.
export function pieceId(authorWallet: string, headline: string, summary: string): string {
  const h = pyNormalize(pyStrip(headline));
  const s = pyNormalize(pyStrip(summary));
  const payload = "HEADLINE_BOUND:PIECE:V1|" + authorWallet.toLowerCase() + "|" + String(pyLen(h)) + "|" + h + "|" + String(pyLen(s)) + "|" + s;
  return keccak256(stringToBytes(payload)).slice(2);
}

/** Every 64-hex id found in a bare id, a 0x id, a link or a comma list. */
export function idsFromInput(value: string): string[] {
  const out: string[] = [];
  for (const m of value.matchAll(/(?<![0-9a-fA-F])([0-9a-fA-F]{64})(?![0-9a-fA-F])/g)) {
    const id = m[1].toLowerCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function short(value: string, head = 6, tail = 4): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
