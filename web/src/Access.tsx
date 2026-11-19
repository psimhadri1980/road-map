import type { Entry } from './Header.tsx';

// What each role may do, as the service enforces it (003, 010 FR-008, 011, 014 FR-001). Explains; changes nothing.
const MAY = {
  viewer: 'See the team’s roadmaps, their history and insights.',
  editor: 'Also write drafts, submit them for review and create roadmaps.',
  reviewer: 'Also approve, return or reject others’ Proposals, restore versions and save baselines.',
} as const;

/** Teams and access (014 FR-010): the person's teams and role in each, from the roadmap list the service returns. */
export function Access(props: { list: Entry[] }) {
  const teams = props.list.filter((r, i, all) => r.team && all.findIndex((x) => x.team === r.team) === i);
  return (
    <section aria-labelledby="access-title">
      <h2 id="access-title">Teams and access</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Your role</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((r) => (
            <tr key={r.team}>
              <td>{r.team}</td>
              <td>{r.role ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>What each role may do</h3>
      <dl>
        {Object.entries(MAY).map(([role, text]) => (
          <div key={role}>
            <dt>{role}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
