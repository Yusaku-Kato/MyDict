import { useEffect, useState } from 'preact/hooks';
import { collator } from './kana';
import { putFile, deleteFile, utf8ToBase64 } from './github';
import { preloadMermaidIfNeeded } from './Markdown';

export interface TermMeta {
  id: string;
  name: string;
  /** ひらがなの読み方。一覧の並べ替えに使う */
  reading: string;
  /** 概要（一覧と詳細の冒頭に表示） */
  summary: string;
  updatedAt: string;
}

export interface Term extends TermMeta {
  /** 詳細説明（Markdown。Mermaid 図・画像を含められる） */
  body: string;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL;
const INDEX_CACHE_KEY = 'mydict.index';
const PENDING_KEY = 'mydict.pending';
/** デプロイが失敗した場合でも未反映データが残り続けないよう期限を設ける */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

type Pending = Record<string, { term?: Term; deleted?: boolean; at: number }>;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できなくても動作は継続 */
  }
}

// ---- 状態 ----
let remote: TermMeta[] = load<TermMeta[]>(INDEX_CACHE_KEY, []);
let pending: Pending = load<Pending>(PENDING_KEY, {});
let terms: TermMeta[] = [];
let loaded = remote.length > 0;
const listeners = new Set<() => void>();

function recompute() {
  const now = Date.now();
  const byId = new Map(remote.map((t) => [t.id, t]));
  for (const [id, p] of Object.entries(pending)) {
    const r = byId.get(id);
    // デプロイ済み（またはTTL切れ）の未反映データは破棄する
    const deployed = p.deleted ? !r : r && p.term && r.updatedAt >= p.term.updatedAt;
    if (deployed || now - p.at > PENDING_TTL_MS) {
      delete pending[id];
      continue;
    }
    if (p.deleted) byId.delete(id);
    else if (p.term) byId.set(id, metaOf(p.term));
  }
  save(PENDING_KEY, pending);
  terms = [...byId.values()].sort(
    (a, b) => collator.compare(a.reading, b.reading) || collator.compare(a.name, b.name),
  );
  listeners.forEach((l) => l());
}

function metaOf(t: Term): TermMeta {
  return { id: t.id, name: t.name, reading: t.reading, summary: t.summary, updatedAt: t.updatedAt };
}

export async function refreshIndex() {
  try {
    const res = await fetch(`${BASE}data/index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    remote = await res.json();
    save(INDEX_CACHE_KEY, remote);
  } catch (e) {
    console.warn('index.json の取得に失敗しました', e);
  }
  loaded = true;
  recompute();
}

recompute();

export function useTerms(): { terms: TermMeta[]; loaded: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return { terms, loaded };
}

export function findMeta(id: string): TermMeta | undefined {
  return terms.find((t) => t.id === id);
}

// ---- 詳細データ（本文） ----
const bodyCache = new Map<string, Promise<Term>>();
const resolved = new Map<string, Term>();

/** 取得済みなら同期的に返す（先読み済みの詳細画面をちらつきなく表示するため） */
export function peekTerm(id: string): Term | undefined {
  const p = pending[id]?.term;
  if (p) return p;
  const t = resolved.get(id);
  return t && t.updatedAt === findMeta(id)?.updatedAt ? t : undefined;
}

/** 詳細データを取得する。同じ版は一度だけ取得し、以降はメモリから即座に返す */
export function getTerm(id: string): Promise<Term> {
  const p = pending[id]?.term;
  if (p) return Promise.resolve(p);
  const key = `${id}@${findMeta(id)?.updatedAt ?? ''}`;
  let promise = bodyCache.get(key);
  if (!promise) {
    promise = fetch(`${BASE}data/terms/${encodeURIComponent(id)}.json`).then((r) => {
      if (!r.ok) throw new Error(`用語データを取得できませんでした (${r.status})`);
      return r.json() as Promise<Term>;
    });
    promise.then((t) => {
      resolved.set(id, t);
      preloadMermaidIfNeeded(t.body);
    }, () => {});
    promise.catch(() => bodyCache.delete(key));
    bodyCache.set(key, promise);
  }
  return promise;
}

/** ホバー・タッチ時に呼び、遷移前に本文を読み込んでおく */
export function prefetch(id: string) {
  getTerm(id).catch(() => {});
}

// ---- 書き込み ----
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function saveTerm(term: Term) {
  const json = JSON.stringify(term, null, 2) + '\n';
  const isNew = !findMeta(term.id);
  await putFile(`public/data/terms/${term.id}.json`, utf8ToBase64(json), `${isNew ? 'Add' : 'Update'} term: ${term.name}`);
  pending[term.id] = { term, at: Date.now() };
  recompute();
}

export async function removeTerm(id: string) {
  const name = findMeta(id)?.name ?? id;
  await deleteFile(`public/data/terms/${id}.json`, `Delete term: ${name}`);
  pending[id] = { deleted: true, at: Date.now() };
  recompute();
}
