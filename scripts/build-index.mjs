// public/data/terms/*.json から一覧用の public/data/index.json を生成する。
// 一覧には本文 (body) を含めず軽量に保ち、本文は詳細画面で個別に読み込む。
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const termsDir = join(root, 'public', 'data', 'terms');
const READING = /^[ぁ-ゖー\s]+$/u;

const files = (await readdir(termsDir)).filter((f) => f.endsWith('.json'));
const index = [];
for (const file of files) {
  const term = JSON.parse(await readFile(join(termsDir, file), 'utf8'));
  const id = file.slice(0, -'.json'.length);
  if (term.id !== id) throw new Error(`${file}: id "${term.id}" がファイル名と一致しません`);
  if (!term.name) throw new Error(`${file}: name がありません`);
  if (!READING.test(term.reading ?? '')) throw new Error(`${file}: reading はひらがなで入力してください`);
  index.push({
    id,
    name: term.name,
    reading: term.reading,
    summary: term.summary ?? '',
    updatedAt: term.updatedAt,
  });
}

const collator = new Intl.Collator('ja');
index.sort((a, b) => collator.compare(a.reading, b.reading) || collator.compare(a.name, b.name));
await writeFile(join(root, 'public', 'data', 'index.json'), JSON.stringify(index));
console.log(`index.json: ${index.length} terms`);
