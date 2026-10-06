// Mirrors every revert of contracts/HeadlineBound.py that can be predicted from
// state already read, in the SAME order the contract checks them. Whether a
// headline overclaims is NEVER decided here: only validators decide that, inside
// challenge(). Who received the bonds is read back from the view (state, outcome).

import { pyContainsToken, pyLen, pyStrip } from "./pytext.ts";
import type { Credits, Piece } from "./types.ts";

export const MAX_HEADLINE_LENGTH = 90;
export const MAX_SUMMARY_LENGTH = 240;
export const MIN_BOND_WEI = 10n ** 15n;
export const MAX_BOND_WEI = 10n ** 18n;

export const RESERVED_TOKENS = [
  "<UNTRUSTED_SUMMARY>",
  "</UNTRUSTED_SUMMARY>",
  "<UNTRUSTED_HEADLINE>",
  "</UNTRUSTED_HEADLINE>",
  "OVERCLAIMS",
  "WITHIN",
  "VOID",
] as const;

export const REVERTS = {
  headlineEmpty: "Headline is empty",
  headlineTooLong: "Headline is too long",
  summaryEmpty: "Summary is empty",
  summaryTooLong: "Summary is too long",
  reserved: "Text contains a reserved token",
  bondRange: "The bond is out of range",
  duplicate: "This piece already exists",
  unknown: "Unknown piece id",
  notOpen: "This piece is no longer open to challenge",
  authorChallenge: "The author cannot challenge their own piece",
  bondMismatch: "The challenge bond must equal the author's bond",
  onlyAuthor: "Only the author may retire this piece",
  nothing: "Nothing to withdraw",
} as const;

/** UI-only reasons (the contract never sees these calls). */
export const UI = {
  noWallet: "Connect a wallet first",
  tooManyBytes: "Headline and summary together are over the 255-byte calldata limit; shorten them",
} as const;

const same = (a: string, b: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function isAuthor(p: Piece, me: string): boolean {
  return same(p.author, me);
}

export type PublishInput = { me: string; headline: string; summary: string; bondWei: bigint | null; exists: boolean; bytes: number };

/** publish order: headline -> summary -> reserved -> bond range -> duplicate. */
export function publishBlock(i: PublishInput): string | null {
  if (!i.me) return UI.noWallet;
  const h = pyStrip(i.headline);
  if (pyLen(h) === 0) return REVERTS.headlineEmpty;
  if (pyLen(h) > MAX_HEADLINE_LENGTH) return REVERTS.headlineTooLong;
  const s = pyStrip(i.summary);
  if (pyLen(s) === 0) return REVERTS.summaryEmpty;
  if (pyLen(s) > MAX_SUMMARY_LENGTH) return REVERTS.summaryTooLong;
  if (pyContainsToken(h, RESERVED_TOKENS) || pyContainsToken(s, RESERVED_TOKENS)) return REVERTS.reserved;
  if (i.bondWei === null || i.bondWei < MIN_BOND_WEI || i.bondWei > MAX_BOND_WEI) return REVERTS.bondRange;
  if (i.exists) return REVERTS.duplicate;
  if (i.bytes > 255) return UI.tooManyBytes;
  return null;
}

/** challenge order: OPEN -> not the author. The app always sends exactly bond_wei, so the bond check cannot fail. */
export function challengeBlock(p: Piece, me: string): string | null {
  if (!me) return UI.noWallet;
  if (p.state !== "OPEN") return REVERTS.notOpen;
  if (isAuthor(p, me)) return REVERTS.authorChallenge;
  return null;
}

/** retire order: OPEN -> author. */
export function retireBlock(p: Piece, me: string): string | null {
  if (!me) return UI.noWallet;
  if (p.state !== "OPEN") return REVERTS.notOpen;
  if (!isAuthor(p, me)) return REVERTS.onlyAuthor;
  return null;
}

export function withdrawBlock(me: string, c: Credits | null): string | null {
  if (!me) return UI.noWallet;
  if (BigInt(c?.credits ?? "0") <= 0n) return REVERTS.nothing;
  return null;
}

export type Stamp = { label: string; tone: "over" | "within" | "void" | "open" | "retired"; who: string };

/** The stamp and who took both bonds, straight from the view's own fields. */
export function stampOf(p: Piece): Stamp {
  switch (p.state) {
    case "RULED_OVERCLAIMS": return { label: "OVERCLAIMS", tone: "over", who: "challenger took both bonds" };
    case "RULED_WITHIN": return { label: "WITHIN", tone: "within", who: "author took both bonds" };
    case "VOID": return { label: "VOID", tone: "void", who: "each side got its own bond back" };
    case "RETIRED": return { label: "RETIRED", tone: "retired", who: "author took the bond back" };
    default: return { label: "OPEN", tone: "open", who: "bond held, open to one challenge" };
  }
}
