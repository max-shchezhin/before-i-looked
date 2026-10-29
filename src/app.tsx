import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/reader.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestView } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.text('not found', 404);
    const data = readNight(config.runsDir, night);
    if (data === null) return c.text('not found', 404);
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestView night={night} data={data} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.json({ error: 'no such night' }, 404);
    const data = readNight(config.runsDir, night);
    if (data === null) return c.json({ error: 'no such night' }, 404);
    const rows = [...data.rows].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
    return c.json({ night, badLines: data.badLines, rows });
  });

  return app;
}
