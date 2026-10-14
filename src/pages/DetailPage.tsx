import { useEffect, useState } from 'preact/hooks';
import { useTerms, getTerm, peekTerm, type Term } from '../store';
import { href } from '../router';
import { getToken } from '../github';
import { Markdown } from '../Markdown';

export function DetailPage({ id }: { id: string }) {
  const { terms, loaded } = useTerms();
  const meta = terms.find((t) => t.id === id);
  const [term, setTerm] = useState<Term | undefined>(() => peekTerm(id));
  const [error, setError] = useState('');

  useEffect(() => {
    const cached = peekTerm(id);
    setTerm(cached);
    setError('');
    if (cached) return;
    let alive = true;
    getTerm(id).then(
      (t) => alive && setTerm(t),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [id, meta?.updatedAt]);

  // 一覧のデータ（名前・読み・概要）は即座に表示し、本文だけ後から差し込む
  const head = term ?? meta;

  if (!head) {
    return (
      <div class="page">
        <BackLink />
        <p class="empty">{loaded && !error ? '用語が見つかりません。' : error || '読み込み中…'}</p>
      </div>
    );
  }

  return (
    <article class="page detail">
      <div class="detail-nav">
        <BackLink />
        {getToken() && (
          <a class="btn" href={href.edit(id)}>
            編集
          </a>
        )}
      </div>
      <header class="detail-head">
        <p class="detail-reading">{head.reading}</p>
        <h1 class="detail-name">{head.name}</h1>
      </header>

      <section class="summary">
        <h2>概要</h2>
        <p>{head.summary || '（概要なし）'}</p>
      </section>

      <section class="body">
        <h2>詳細説明</h2>
        {term ? (
          term.body.trim() ? <Markdown source={term.body} /> : <p class="muted">（詳細説明なし）</p>
        ) : (
          <p class="muted">{error || '読み込み中…'}</p>
        )}
      </section>
    </article>
  );
}

export function BackLink() {
  return (
    <a class="back" href={href.list}>
      ← 一覧
    </a>
  );
}
