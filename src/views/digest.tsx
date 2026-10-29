import type { DigestRow, Night } from '../digest/types.js';

// Plain code-point order, not localeCompare: the JSON route sorts the same way.
const byJob = (a: DigestRow, b: DigestRow) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0);

// A row needs a look when it kept failing or retried three times or more. The "!" is the
// text marker, so the flag survives without color.
const needsLook = (r: DigestRow) => r.retries >= 3 || r.lastStatus === 'fail';

const dash = (v: string | null) => v ?? '—';

export function DigestView({ night, data }: { night: string; data: Night }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {data.badLines > 0 ? <p class="mute">{`${data.badLines} unparsable line(s) skipped`}</p> : null}
      {data.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th></th>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {[...data.rows].sort(byJob).map((r) => (
              <tr class={needsLook(r) ? 'warn' : undefined}>
                <td>{needsLook(r) ? '!' : ''}</td>
                <td>{r.job}</td>
                <td>{dash(r.owner)}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.lastStatus}</td>
                <td>{dash(r.lastError)}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
