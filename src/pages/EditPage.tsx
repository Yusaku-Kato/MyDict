import { useEffect, useRef, useState } from 'preact/hooks';
import { getTerm, newId, saveTerm, removeTerm, peekTerm, uploadImage as commitImage, type Term } from '../store';
import { READING_PATTERN, toHiragana } from '../kana';
import { href, navigate } from '../router';
import { getToken } from '../github';
import { Markdown, localImages } from '../Markdown';
import { BackLink } from './DetailPage';

const MERMAID_TEMPLATE = '\n```mermaid\nflowchart LR\n  A[入力] --> B{判定}\n  B -->|はい| C[結果1]\n  B -->|いいえ| D[結果2]\n```\n';
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function EditPage({ id }: { id?: string }) {
  const isNew = !id;
  const [termId] = useState(() => id ?? newId());
  const [original, setOriginal] = useState<Term | undefined>(() => (id ? peekTerm(id) : undefined));
  const [name, setName] = useState(original?.name ?? '');
  const [reading, setReading] = useState(original?.reading ?? '');
  const [summary, setSummary] = useState(original?.summary ?? '');
  const [body, setBody] = useState(original?.body ?? '');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id || original) return;
    getTerm(id).then((t) => {
      setOriginal(t);
      setName(t.name);
      setReading(t.reading);
      setSummary(t.summary);
      setBody(t.body);
    }, (e: Error) => setError(e.message));
  }, [id]);

  if (!getToken()) {
    return (
      <div class="page">
        <BackLink />
        <p class="empty">
          登録・編集には GitHub トークンの設定が必要です。<a href={href.settings}>設定へ</a>
        </p>
      </div>
    );
  }

  const readingValid = READING_PATTERN.test(reading);
  const canSave = name.trim() !== '' && readingValid && !busy && (isNew || original);

  function insert(text: string) {
    const el = textarea.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + text + body.slice(end));
    setTab('edit');
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  async function uploadImage(file: File) {
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return setError('PNG / JPEG / GIF / WebP / SVG の画像を選んでください。');
    if (file.size > MAX_IMAGE_BYTES) return setError('画像は 5MB 以下にしてください。');
    setBusy('画像をアップロード中…');
    setError('');
    try {
      const fileName = `${termId}-${Date.now().toString(36)}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      await commitImage(fileName, bytes);
      localImages.set(fileName, URL.createObjectURL(file));
      insert(`\n![${file.name.replace(/\.[^.]+$/, '')}](images/${fileName})\n`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function onSave(e: Event) {
    e.preventDefault();
    if (!canSave) return;
    setBusy('保存中…');
    setError('');
    const now = new Date().toISOString();
    try {
      await saveTerm({
        id: termId,
        name: name.trim(),
        reading: reading.trim(),
        summary: summary.trim(),
        body,
        createdAt: original?.createdAt ?? now,
        updatedAt: now,
      });
      navigate(href.term(termId), true);
    } catch (err) {
      setError((err as Error).message);
      setBusy('');
    }
  }

  async function onDelete() {
    if (!id || !confirm(`「${name}」を削除しますか？`)) return;
    setBusy('削除中…');
    try {
      await removeTerm(id);
      navigate(href.list, true);
    } catch (err) {
      setError((err as Error).message);
      setBusy('');
    }
  }

  return (
    <form class="page edit" onSubmit={onSave}>
      <div class="detail-nav">
        <a class="back" href={isNew ? href.list : href.term(termId)}>
          ← {isNew ? '一覧' : '戻る'}
        </a>
        <h1 class="edit-title">{isNew ? '用語を登録' : '用語を編集'}</h1>
      </div>

      <label class="field">
        <span>名前</span>
        <input value={name} onInput={(e) => setName(e.currentTarget.value)} required autoFocus={isNew} />
      </label>

      <label class="field">
        <span>読み方（ひらがな）</span>
        <input
          value={reading}
          onInput={(e) => setReading(toHiragana(e.currentTarget.value))}
          placeholder="例: じしょ"
          aria-invalid={reading !== '' && !readingValid}
          required
        />
        {reading !== '' && !readingValid && <small class="error">ひらがな（と長音記号「ー」）のみで入力してください。</small>}
      </label>

      <label class="field">
        <span>概要</span>
        <textarea rows={2} value={summary} onInput={(e) => setSummary(e.currentTarget.value)} placeholder="一言での説明" />
      </label>

      <div class="field">
        <span>詳細説明（Markdown）</span>
        <div class="editor-bar">
          <div class="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'edit'} onClick={() => setTab('edit')}>
              編集
            </button>
            <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>
              プレビュー
            </button>
          </div>
          <div class="tools">
            <button type="button" class="btn small" onClick={() => insert(MERMAID_TEMPLATE)}>
              ＋ 図（Mermaid）
            </button>
            <button type="button" class="btn small" onClick={() => fileInput.current?.click()} disabled={!!busy}>
              ＋ 画像
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={Object.keys(IMAGE_TYPES).join(',')}
              hidden
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                if (f) void uploadImage(f);
              }}
            />
          </div>
        </div>
        {tab === 'edit' ? (
          <textarea
            ref={textarea}
            class="body-input"
            rows={16}
            value={body}
            onInput={(e) => setBody(e.currentTarget.value)}
            placeholder={'Markdown で記述できます。\n図は ```mermaid コードブロック、または画像で追加できます。'}
          />
        ) : (
          <div class="preview">{body.trim() ? <Markdown source={body} /> : <p class="muted">（空）</p>}</div>
        )}
      </div>

      {error && <p class="error">{error}</p>}

      <div class="form-actions">
        {!isNew && (
          <button type="button" class="btn danger" onClick={onDelete} disabled={!!busy}>
            削除
          </button>
        )}
        <span class="status">{busy}</span>
        <button type="submit" class="btn primary" disabled={!canSave}>
          保存
        </button>
      </div>
    </form>
  );
}
