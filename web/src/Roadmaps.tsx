import type { ReactNode } from 'react';
import type { Entry } from './Header.tsx';
import { hashOf } from './Nav.tsx';

/** Every roadmap the person can see, with its team and their role (014 FR-010); the service's list as it is. */
export function Roadmaps(props: { list: Entry[]; notice?: string; children?: ReactNode }) {
  return (
    <section aria-labelledby="roadmaps-title">
      <h2 id="roadmaps-title">Roadmaps</h2>
      {props.notice && (
        <p role="status" className="banner">
          {props.notice}
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Team</th>
            <th scope="col">Your role</th>
          </tr>
        </thead>
        <tbody>
          {props.list.map((r) => (
            <tr key={r.slug}>
              <td>
                <a href={hashOf('plan', r.slug)}>{r.name}</a>
              </td>
              <td>{r.team ?? '—'}</td>
              <td>{r.role ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {props.children}
    </section>
  );
}
