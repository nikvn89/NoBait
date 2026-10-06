// Postconditions checked AFTER the receipt says SUCCESS, against reloaded
// accepted state. A write is reported as done only when the state shows it.

import { pyNormalize, pyStrip } from "./pytext.ts";
import type { Credits, Piece } from "./types.ts";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const big = (v: string | undefined) => BigInt(v ?? "0");

export function publishVerified(p: Piece | null, s: { id: string; me: string; headline: string; summary: string; bondWei: bigint }): boolean {
  return !!p && p.piece_id === s.id && same(p.author, s.me) && p.headline === pyStrip(s.headline) &&
    p.summary === pyStrip(s.summary) && p.bond_wei === s.bondWei.toString() && p.state === "OPEN" &&
    p.held_wei === s.bondWei.toString() && pyNormalize(p.headline) === pyNormalize(s.headline);
}

export type ChallengeCheck = { ok: true; piece: Piece } | { ok: false };

/**
 * The piece is closed, I am the recorded challenger, and the credits moved
 * exactly as the outcome table says: OVERCLAIMS -> me +2 bonds; WITHIN -> me +0
 * (the author +2); VOID -> me +1 bond back.
 */
export function challengeVerified(before: { piece: Piece; myCredits: Credits | null }, after: { piece: Piece | null; myCredits: Credits | null }, me: string): ChallengeCheck {
  const p = after.piece;
  if (!p || !after.myCredits || !same(p.challenger, me) || p.held_wei !== "0") return { ok: false };
  const bond = big(before.piece.bond_wei);
  const gain = big(after.myCredits.credits) - big(before.myCredits?.credits);
  const expected: Record<string, [string, bigint]> = {
    OVERCLAIMS: ["RULED_OVERCLAIMS", 2n * bond],
    WITHIN: ["RULED_WITHIN", 0n],
    VOID: ["VOID", bond],
  };
  const e = expected[p.outcome];
  if (!e || p.state !== e[0] || gain !== e[1]) return { ok: false };
  return { ok: true, piece: p };
}

export function retireVerified(before: { piece: Piece; myCredits: Credits | null }, after: { piece: Piece | null; myCredits: Credits | null }): boolean {
  return !!after.piece && after.piece.state === "RETIRED" && after.piece.held_wei === "0" &&
    big(after.myCredits?.credits) === big(before.myCredits?.credits) + big(before.piece.bond_wei);
}

export function withdrawVerified(before: Credits | null, after: Credits | null): boolean {
  return !!before && !!after && big(before.credits) > 0n && big(after.credits) === 0n;
}
