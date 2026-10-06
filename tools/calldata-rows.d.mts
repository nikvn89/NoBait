export const ID: string;
export const CASES: Record<string, [string, string]>;
export type Row = { name: string; method: string; args: unknown[] };
export function hardBlockRows(): Row[];
export function measureOnlyRows(): Row[];
