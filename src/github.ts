// GitHub Contents API を使ってリポジトリ上のデータファイルを読み書きする。
// 書き込みには Contents: Read and write 権限を持つ Personal Access Token が必要。

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

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}/repos/${REPO}/contents/${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${getToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`GitHub API ${res.status}: ${body.message ?? res.statusText}`);
  }
  return res;
}

async function getSha(path: string): Promise<string | undefined> {
  const res = await request(`${path}?ref=${BRANCH}`, { cache: 'no-store' });
  if (res.status === 404) return undefined;
  return (await res.json()).sha;
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

/** ファイルを作成または上書きする（1 回のコミット） */
export async function putFile(path: string, base64: string, message: string) {
  const sha = await getSha(path);
  const res = await request(path, {
    method: 'PUT',
    body: JSON.stringify({ message, content: base64, branch: BRANCH, sha }),
  });
  if (res.status === 404) throw new Error('リポジトリが見つかりません。トークンの権限を確認してください。');
}

export async function deleteFile(path: string, message: string) {
  const sha = await getSha(path);
  if (!sha) return;
  await request(path, { method: 'DELETE', body: JSON.stringify({ message, sha, branch: BRANCH }) });
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
