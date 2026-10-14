import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { createReadStream, existsSync, rmSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';

const BASE = '/MyDict/';
const DOCS = join(import.meta.dirname, 'docs');

// GitHub Pages は main ブランチの docs/ をそのまま配信する。
// docs/data（用語データ）はリポジトリで管理するため、ビルドでは docs/assets と docs/index.html だけを置き換える。
function docsOutput(): Plugin {
  return {
    name: 'mydict-docs-output',
    apply: 'build',
    buildStart() {
      rmSync(join(DOCS, 'assets'), { recursive: true, force: true });
      rmSync(join(DOCS, 'index.html'), { force: true });
    },
  };
}

// 開発サーバーでも本番と同じ URL（/MyDict/data/...）で docs/data を配信する
function serveData(): Plugin {
  return {
    name: 'mydict-serve-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(`${BASE}data/`, (req, res, next) => {
        const file = normalize(join(DOCS, 'data', decodeURIComponent((req.url ?? '').split('?')[0])));
        if (!file.startsWith(join(DOCS, 'data')) || !existsSync(file) || !statSync(file).isFile()) return next();
        if (file.endsWith('.json')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: BASE,
  publicDir: false,
  plugins: [preact(), docsOutput(), serveData()],
  build: {
    outDir: 'docs',
    emptyOutDir: false,
    target: 'es2022',
    // Mermaid の大きなチャンクは図を表示するときだけ遅延読み込みされる
    chunkSizeWarningLimit: 2000,
  },
});
