import { useState } from 'react';

/** The pages of 014 User Story 3. The first five belong to the open roadmap. */
export type Page = 'plan' | 'review' | 'drafts' | 'history' | 'insights' | 'roadmaps' | 'access';
const ROADMAP_PAGES: Page[] = ['plan', 'review', 'drafts', 'history', 'insights'];
const LABEL: Record<Page, string> = {
  plan: 'Plan',
  review: 'Review',
  drafts: 'Drafts',
  history: 'History',
  insights: 'Insights',
  roadmaps: 'Roadmaps',
  access: 'Teams and access',
};

/** `#/<slug>/<page>`, `#/roadmaps` or `#/access` (014 FR-005); anything else names no page. */
export function parseHash(hash: string): { slug?: string; page?: Page } {
  let a: string | undefined, b: string | undefined;
  try {
    [a, b] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  } catch {
    return { slug: '' }; // a malformed address names nothing: Roadmaps with a notice
  }
  if (!a) return {};
  if (a === 'roadmaps' || a === 'access') return { page: a };
  const page = (b || 'plan') as Page;
  return { slug: a, page: ROADMAP_PAGES.includes(page) ? page : undefined };
}
/** The address of a page; roadmap pages carry the slug. */
export const hashOf = (page: Page, slug?: string) =>
  slug && ROADMAP_PAGES.includes(page) ? `#/${encodeURIComponent(slug)}/${page}` : `#/${page}`;

const KEY = 'rm-menu';
function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === 'collapsed';
  } catch {
    return false; // storage blocked: the menu starts open
  }
}

/**
 * The left menu (014 FR-005). Links set the address, and the page follows the address, so reload and back
 * work. Review and Drafts are drawn only for editors and reviewers; the service refuses the rest regardless.
 */
export function Nav(props: { page: Page; slug?: string; name?: string; writer: boolean; waiting: number }) {
  const [collapsed, setCollapsed] = useState(stored);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(KEY, next ? 'collapsed' : 'open');
    } catch {
      // the choice still applies for this visit
    }
  };
  const link = (page: Page, extra?: string) => (
    <li key={page}>
      <a href={hashOf(page, props.slug)} aria-current={props.page === page ? 'page' : undefined} title={LABEL[page]}>
        <span className="label">{LABEL[page]}</span>
        {extra && <span className="count"> {extra}</span>}
      </a>
    </li>
  );
  return (
    <nav className={collapsed ? 'menu collapsed' : 'menu'} aria-label="Menu">
      <ul>{link('roadmaps')}</ul>
      {props.slug && (
        <>
          <p className="menu-roadmap">{props.name}</p>
          <ul>
            {link('plan')}
            {props.writer && link('review', props.waiting ? String(props.waiting) : undefined)}
            {props.writer && link('drafts')}
            {link('history')}
            {link('insights')}
          </ul>
        </>
      )}
      <button type="button" className="collapse" aria-expanded={!collapsed} onClick={toggle}>
        {collapsed ? 'Expand menu' : 'Collapse menu'}
      </button>
    </nav>
  );
}
