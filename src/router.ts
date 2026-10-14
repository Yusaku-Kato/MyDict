import { useEffect, useState } from 'preact/hooks';
import { flushSync } from 'preact/compat';

// ハッシュルーティング。GitHub Pages でも 404 にならず、遷移はすべてクライアント内で完結する。
export type Route =
  | { name: 'list' }
  | { name: 'term'; id: string }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'settings' };

export function parse(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, '').split('/');
  if (a === 't' && b) return { name: 'term', id: decodeURIComponent(b) };
  if (a === 'edit' && b) return { name: 'edit', id: decodeURIComponent(b) };
  if (a === 'new') return { name: 'new' };
  if (a === 'settings') return { name: 'settings' };
  return { name: 'list' };
}

export const href = {
  list: '#/',
  term: (id: string) => `#/t/${encodeURIComponent(id)}`,
  edit: (id: string) => `#/edit/${encodeURIComponent(id)}`,
  new: '#/new',
  settings: '#/settings',
};

export function navigate(to: string, replace = false) {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => {
      const next = parse(location.hash);
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      // View Transitions API があれば短いクロスフェードで切り替える
      if (doc.startViewTransition && !reduce) doc.startViewTransition(() => flushSync(() => setRoute(next)));
      else setRoute(next);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
