import { useEffect, useMemo, useState } from 'preact/hooks';
import { useTerms, prefetch, type TermMeta } from '../store';
import { ROWS, rowOf, toHiragana } from '../kana';
import { href } from '../router';
import { getToken } from '../github';

export function ListPage() {
  const { terms, loaded } = useTerms();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = toHiragana(query.trim().toLowerCase());
    const hit = (t: TermMeta) =>
      !q || t.reading.includes(q) || toHiragana(t.name.toLowerCase()).includes(q) || t.summary.toLowerCase().includes(q);
    const map = new Map<string, TermMeta[]>();
    for (const t of terms) {
      if (!hit(t)) continue;
      const row = rowOf(t.reading);
      if (!map.has(row)) map.set(row, []);
      map.get(row)!.push(t);
    }
    return ROWS.filter((r) => map.has(r)).map((r) => ({ row: r, items: map.get(r)! }));
  }, [terms, query]);

  const present = groups.map((g) => g.row);

  return (
    <div class="page list-page">
      <header class="topbar">
        <h1>MyDict</h1>
        <div class="topbar-actions">
          {getToken() && (
            <a class="btn primary" href={href.new}>
              ＋ 登録
            </a>
          )}
          <a class="btn icon" href={href.settings} aria-label="設定" title="設定">
            ⚙
          </a>
        </div>
      </header>

      <input
        class="search"
        type="search"
        placeholder="用語・読み方・概要で検索"
        value={query}
        onInput={(e) => setQuery(e.currentTarget.value)}
      />

      {groups.map(({ row, items }) => (
        <section key={row} class="group" id={`row-${row}`}>
          <h2 class="group-head">{row}</h2>
          <ul class="term-list">
            {items.map((t) => (
              <li key={t.id}>
                <a
                  class="term-item"
                  href={href.term(t.id)}
                  onPointerEnter={() => prefetch(t.id)}
                  onTouchStart={() => prefetch(t.id)}
                  onFocus={() => prefetch(t.id)}
                >
                  <span class="term-name">{t.name}</span>
                  <span class="term-reading">{t.reading}</span>
                  {t.summary && <span class="term-summary">{t.summary}</span>}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {loaded && groups.length === 0 && (
        <p class="empty">{query ? '該当する用語がありません。' : 'まだ用語が登録されていません。'}</p>
      )}

      {present.length > 0 && <KanaRail present={present} />}
    </div>
  );
}

/**
 * 画面横に固定表示する五十音インデックス。スクロールに合わせて現在の行を強調し、
 * タップやなぞる操作でその行へジャンプする（用語がない行は次の行へ）。
 */
function KanaRail({ present }: { present: string[] }) {
  const [active, setActive] = useState(present[0]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = present[0];
      for (const row of present) {
        const el = document.getElementById(`row-${row}`);
        if (el && el.getBoundingClientRect().top <= 4) current = row;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [present.join()]);

  const jumpTo = (row: string) => {
    const target = ROWS.slice(ROWS.indexOf(row as (typeof ROWS)[number])).find((r) => present.includes(r)) ?? present.at(-1)!;
    const el = document.getElementById(`row-${target}`);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
  };

  const rowAt = (e: PointerEvent) => (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.dataset.row;

  return (
    <nav
      class="kana-rail"
      aria-label="五十音インデックス"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const row = rowAt(e);
        if (row) jumpTo(row);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const row = rowAt(e);
        if (row) jumpTo(row);
      }}
    >
      {ROWS.map((r) => (
        <button
          key={r}
          type="button"
          data-row={r}
          class={r === active ? 'active' : present.includes(r) ? '' : 'none'}
          aria-label={`${r}行へ`}
          onKeyDown={(e) => e.key === 'Enter' && jumpTo(r)}
        >
          {r}
        </button>
      ))}
    </nav>
  );
}
