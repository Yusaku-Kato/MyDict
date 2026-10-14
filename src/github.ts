// GitHub API を使ってリポジトリ上のデータファイルを読み書きする。
// 書き込みには Contents: Read and write 権限を持つ Personal Access Token が必要。
// main ブランチへのコミットで GitHub Pages が自動的に再デプロイされる。

export const REPO: string = import.meta.env.VITE_REPO || 'Yusaku-Kato/MyDict';
export const BRANCH = 'main';
const API = 'https://api.github.com';
const TOKEN_KEY = 'mydict.token';

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ストレージが使えない環境では保存しない */
  }
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function api<T>(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<T> {
  const res = await fetch(`${API}/repos/${REPO}/${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: accept,
      Authorization: `Bearer ${getToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const hint = res.status === 401 || res.status === 403 || res.status === 404 ? '（トークンの権限を確認してください）' : '';
    throw new ApiError(res.status, `GitHub API ${res.status}: ${body.message ?? res.statusText}${hint}`);
  }
  return accept.endsWith('raw') ? ((await res.text()) as T) : res.json();
}

/** main の最新コミット上のテキストファイルを読む（Pages のキャッシュを経由しない） */
export async function readRepoText(path: string, ref: string): Promise<string> {
  return api<string>(`contents/${path}?ref=${ref}`, {}, 'application/vnd.github.raw');
}

export interface FileChange {
  path: string;
  /** base64 の内容。null ならファイルを削除する */
  base64: string | null;
}

/**
 * 複数ファイルの変更を 1 コミットにまとめて main に反映する。
 * `build` は最新コミットの SHA を受け取り変更内容を返す。他端末と競合したら最新を読み直して 1 度だけ再試行する。
 */
export async function commitFiles(message: string, build: (headSha: string) => Promise<FileChange[]>) {
  for (let attempt = 0; ; attempt++) {
    const ref = await api<{ object: { sha: string } }>(`git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const commit = await api<{ tree: { sha: string } }>(`git/commits/${head}`);
    const changes = await build(head);
    const tree = await Promise.all(
      changes.map(async ({ path, base64 }) => {
        if (base64 === null) return { path, mode: '100644', type: 'blob', sha: null };
        const blob = await api<{ sha: string }>('git/blobs', {
          method: 'POST',
          body: JSON.stringify({ content: base64, encoding: 'base64' }),
        });
        return { path, mode: '100644', type: 'blob', sha: blob.sha };
      }),
    );
    const newTree = await api<{ sha: string }>('git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: commit.tree.sha, tree }),
    });
    const newCommit = await api<{ sha: string }>('git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTree.sha, parents: [head] }),
    });
    try {
      await api(`git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha }) });
      return;
    } catch (e) {
      // fast-forward できない（他の変更が先に入った）場合は 422
      if (!(e instanceof ApiError && e.status === 422) || attempt >= 1) throw e;
    }
  }
}

export function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** トークンでリポジトリに書き込めるか確認する */
export async function verifyToken(token: string): Promise<boolean> {
  const res = await fetch(`${API}/repos/${REPO}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return false;
  const repo = await res.json();
  return Boolean(repo.permissions?.push);
}

/** デプロイ前でも表示できるよう、リポジトリ上の生ファイル URL を返す */
export function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
}
