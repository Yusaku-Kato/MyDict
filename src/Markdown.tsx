import { useEffect, useMemo, useRef } from 'preact/hooks';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { rawUrl } from './github';

const BASE = import.meta.env.BASE_URL;
const IMAGE_PREFIX = 'images/';

/** このセッションでアップロードした画像（デプロイ前でもプレビューできるよう保持） */
export const localImages = new Map<string, string>();

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    // ```mermaid コードブロックは図として描画する
    code({ text, lang }) {
      if (lang?.trim() === 'mermaid') return `<div class="mermaid">${escape(text)}</div>`;
      return false;
    },
  },
});

let mermaidLoader: Promise<typeof import('mermaid').default> | undefined;
let diagramSeq = 0;

/** Mermaid は大きいので、図を含む本文を表示するときだけ読み込む */
function loadMermaid() {
  mermaidLoader ??= import('mermaid').then(({ default: mermaid }) => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' });
    return mermaid;
  });
  return mermaidLoader;
}

/** 画面表示前に Mermaid を読み込んでおく（詳細画面の先読み用） */
export function preloadMermaidIfNeeded(markdown: string) {
  if (markdown.includes('```mermaid')) void loadMermaid();
}

function resolveImages(root: HTMLElement) {
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith(IMAGE_PREFIX)) return;
    const name = src.slice(IMAGE_PREFIX.length);
    const repoPath = `docs/data/images/${name}`;
    img.src = localImages.get(name) ?? `${BASE}data/${src}`;
    img.loading = 'lazy';
    // デプロイ完了前はリポジトリの生ファイルを表示する
    img.onerror = () => {
      img.onerror = null;
      img.src = rawUrl(repoPath);
    };
  });
}

export function Markdown({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(source) as string), [source]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    resolveImages(root);
    const nodes = [...root.querySelectorAll<HTMLElement>('.mermaid')];
    if (nodes.length === 0) return;
    let cancelled = false;
    loadMermaid().then(async (mermaid) => {
      for (const node of nodes) {
        if (cancelled) return;
        const code = node.textContent ?? '';
        try {
          const { svg } = await mermaid.render(`mmd-${++diagramSeq}`, code);
          if (!cancelled) node.innerHTML = svg;
        } catch (e) {
          if (!cancelled) {
            node.classList.add('mermaid-error');
            node.textContent = `図の記述にエラーがあります: ${(e as Error).message}`;
          }
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [html]);

  return <div ref={ref} class="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
