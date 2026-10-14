import { useMemo, useState } from 'preact/hooks';
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

  const present = new Set(groups.map((g) => g.row));

  return (
    <div class="page">
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

      <nav class="kana-index" aria-label="五十音インデックス">
        {ROWS.map((r) =>
          present.has(r) ? (
            <a key={r} href={`#row-${r}`} onClick={(e) => jump(e, r)}>
              {r}
            </a>
          ) : (
            <span key={r} class="disabled">
              {r}
            </span>
          ),
        )}
      </nav>

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
    </div>
  );
}

// ハッシュをルーティングに使っているため、行へのジャンプはスクロールで行う
function jump(e: MouseEvent, row: string) {
  e.preventDefault();
  document.getElementById(`row-${row}`)?.scrollIntoView({ block: 'start' });
}
