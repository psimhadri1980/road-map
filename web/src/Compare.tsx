/** One difference, as the service answers it (spec 011 contract). */
export type Difference = {
  entity: 'task' | 'link';
  id: string;
  kind: 'added' | 'removed' | 'moved' | 'changed';
  old?: Record<string, unknown>;
  new?: Record<string, unknown>;
};

const label = (d: Difference) => String(d.new?.['name'] ?? d.old?.['name'] ?? d.id);
const fieldsChanged = (d: Difference) =>
  d.old && d.new
    ? [...new Set([...Object.keys(d.old), ...Object.keys(d.new)])]
        .filter((k) => JSON.stringify(d.old![k]) !== JSON.stringify(d.new![k]))
        .join(', ')
    : '';

/**
 * What changed from an earlier version (or a baseline) to the current plan, as a list (011 FR-002). Reading
 * only. An empty answer says so in words.
 */
export function Compare(props: { against: string; diffs: Difference[]; onClose: () => void }) {
  return (
    <section aria-labelledby="compare-title">
      <h2 id="compare-title">Changes since {props.against}</h2>
      {props.diffs.length === 0 && <p>No changes.</p>}
      <ul>
        {props.diffs.map((d) => (
          <li key={`${d.entity}:${d.id}`}>
            <span className="chip">{d.kind}</span> {d.entity} <strong>{label(d)}</strong>
            {(d.kind === 'changed' || d.kind === 'moved') && <span className="note"> · {fieldsChanged(d)}</span>}
          </li>
        ))}
      </ul>
      <button type="button" onClick={props.onClose}>
        Close comparison
      </button>
    </section>
  );
}
