// Contract views return JSON strings. HeadlineBound writes every amount as a
// decimal string, so no amount is ever read as a JS number.
import type { Credits, Piece } from "./types.ts";

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    let value: unknown = JSON.parse(raw);
    if (typeof value === "string") value = JSON.parse(value);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

const isAmount = (v: unknown) => typeof v === "string" && /^\d+$/.test(v);

export function parsePiece(raw: string): Piece | null {
  const o = parseObject(raw);
  if (!o || typeof o.piece_id !== "string" || !isAmount(o.bond_wei) || !isAmount(o.held_wei)) return null;
  return o as unknown as Piece;
}

export function parseCredits(raw: string): Credits | null {
  const o = parseObject(raw);
  if (!o || !isAmount(o.credits)) return null;
  return o as unknown as Credits;
}

export type Limits = { rubric_hash?: string; min_bond_wei?: string; max_bond_wei?: string; contract_name?: string; version?: string };

export function parseLimits(raw: string): Limits | null {
  return parseObject(raw) as Limits | null;
}
