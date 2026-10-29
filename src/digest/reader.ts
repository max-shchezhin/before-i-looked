import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, Status } from './types.js';

const statuses: readonly string[] = ['ok', 'retry', 'fail'];

type Entry = { at: string; job: string; status: Status; owner: string | null; error: string | null };

// Parse at the edge: anything that isn't a well-formed log line is undefined.
function parseLine(line: string): Entry | undefined {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof v !== 'object' || v === null) return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return undefined;
  if (typeof o.status !== 'string' || !statuses.includes(o.status)) return undefined;
  return {
    at: o.at,
    job: o.job,
    status: o.status as Status,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : null,
  };
}

export function readNight(runsDir: string, night: string): Night | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const e = parseLine(line);
    if (!e) {
      badLines++;
      continue;
    }
    const row = rows.get(e.job);
    if (!row) {
      rows.set(e.job, {
        job: e.job,
        owner: e.owner,
        runs: 1,
        retries: e.status === 'retry' ? 1 : 0,
        lastStatus: e.status,
        lastError: e.error,
        firstAt: e.at,
        lastAt: e.at,
      });
      continue;
    }
    row.runs++;
    if (e.status === 'retry') row.retries++;
    row.lastStatus = e.status;
    row.lastAt = e.at;
    if (e.error !== null) row.lastError = e.error;
    if (e.owner !== null) row.owner = e.owner;
  }
  return { rows: [...rows.values()], badLines };
}
