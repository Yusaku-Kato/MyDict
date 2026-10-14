import { render } from 'preact';
import { App } from './App';
import { refreshIndex } from './store';
import './style.css';

render(<App />, document.getElementById('app')!);
// キャッシュ済みの一覧で即座に描画し、裏で最新の一覧を取得する
void refreshIndex();
