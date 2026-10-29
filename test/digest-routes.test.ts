import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const line = (o: object) => JSON.stringify(o);

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(
    join(runsDir, '2026-02-01.jsonl'),
    [
      line({ at: '2026-02-01T23:00:00+01:00', job: 'b/job', status: 'ok', owner: 'rook' }),
      line({ at: '2026-02-01T23:05:00+01:00', job: 'a/job', status: 'fail', owner: null, error: 'boom' }),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2026-02-02.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-02-03.jsonl'),
    [line({ at: '2026-02-03T01:00:00+01:00', job: 'a/job', status: 'ok', owner: 'rook' }), '{not json'].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

type Json = { night: string; badLines: number; rows: { job: string; owner: string | null }[] };

describe('GET /digest/:night', () => {
  it('renders the rows sorted by job, marks a fail, shows a null owner as —', async () => {
    const res = await app.request('/digest/2026-02-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('<td>!</td>');
    expect(html).toContain('<td>—</td>');
  });

  it('returns 404 for a night with no file and for a malformed night', async () => {
    expect((await app.request('/digest/2026-02-09')).status).toBe(404);
    expect((await app.request('/digest/..%2Fpackage')).status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line and notes it', async () => {
    const res = await app.request('/digest/2026-02-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 unparsable line(s) skipped');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the same jobs in the same order as the page', async () => {
    const json = (await (await app.request('/api/digest/2026-02-01')).json()) as Json;
    expect(json.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
    expect(json.rows[0]?.owner).toBeNull();
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-02-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns no rows for an empty night', async () => {
    const json = (await (await app.request('/api/digest/2026-02-02')).json()) as Json;
    expect(json.rows).toEqual([]);
  });

  it('counts the bad line', async () => {
    const json = (await (await app.request('/api/digest/2026-02-03')).json()) as Json;
    expect(json.badLines).toBe(1);
    expect(json.rows).toHaveLength(1);
  });
});
