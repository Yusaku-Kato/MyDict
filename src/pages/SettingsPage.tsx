import { useState } from 'preact/hooks';
import { getToken, setToken, verifyToken, REPO } from '../github';
import { BackLink } from './DetailPage';

export function SettingsPage() {
  const [value, setValue] = useState(getToken());
  const [status, setStatus] = useState(getToken() ? '設定済み' : '未設定（閲覧のみ）');

  async function onSave(e: Event) {
    e.preventDefault();
    const token = value.trim();
    if (!token) {
      setToken('');
      setStatus('トークンを削除しました（閲覧のみ）');
      return;
    }
    setStatus('確認中…');
    if (await verifyToken(token)) {
      setToken(token);
      setStatus('保存しました。用語の登録・編集ができます。');
    } else {
      setStatus(`このトークンでは ${REPO} に書き込めません。権限を確認してください。`);
    }
  }

  return (
    <form class="page edit" onSubmit={onSave}>
      <div class="detail-nav">
        <BackLink />
        <h1 class="edit-title">設定</h1>
      </div>
      <p>
        用語の登録・編集・削除は、GitHub リポジトリ <code>{REPO}</code> へのコミットとして保存されます。
        保存から 1 分ほどで公開サイトに反映されます（この端末では即座に反映されます）。
      </p>
      <ol class="steps">
        <li>
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            Fine-grained personal access token
          </a>{' '}
          を作成
        </li>
        <li>Repository access で <code>{REPO}</code> のみを選択</li>
        <li>Permissions → Repository permissions → Contents を <b>Read and write</b> に設定</li>
        <li>生成したトークンを下に貼り付けて保存（この端末のブラウザにのみ保存されます）</li>
      </ol>
      <label class="field">
        <span>GitHub トークン</span>
        <input type="password" value={value} onInput={(e) => setValue(e.currentTarget.value)} autoComplete="off" placeholder="github_pat_…" />
      </label>
      <div class="form-actions">
        <span class="status">{status}</span>
        <button type="submit" class="btn primary">
          保存
        </button>
      </div>
    </form>
  );
}
