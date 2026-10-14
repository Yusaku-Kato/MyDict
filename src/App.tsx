import { useLayoutEffect, useRef } from 'preact/hooks';
import { useRoute } from './router';
import { ListPage } from './pages/ListPage';
import { DetailPage } from './pages/DetailPage';
import { EditPage } from './pages/EditPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const route = useRoute();
  const listScroll = useRef(0);
  const prev = useRef(route.name);

  // 一覧は常にマウントしたまま隠すだけにして、戻ったときに再描画せずスクロール位置も復元する
  useLayoutEffect(() => {
    if (route.name === 'list') window.scrollTo(0, listScroll.current);
    else window.scrollTo(0, 0);
    prev.current = route.name;
  }, [route]);

  const onListScrollCapture = () => {
    if (prev.current === 'list') listScroll.current = window.scrollY;
  };
  useLayoutEffect(() => {
    window.addEventListener('scroll', onListScrollCapture, { passive: true });
    return () => window.removeEventListener('scroll', onListScrollCapture);
  }, []);

  return (
    <main>
      <div hidden={route.name !== 'list'}>
        <ListPage />
      </div>
      {route.name === 'term' && <DetailPage key={route.id} id={route.id} />}
      {route.name === 'new' && <EditPage key="new" />}
      {route.name === 'edit' && <EditPage key={route.id} id={route.id} />}
      {route.name === 'settings' && <SettingsPage />}
    </main>
  );
}
