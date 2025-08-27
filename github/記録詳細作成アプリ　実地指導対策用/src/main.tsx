import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// テスト機能を開発環境でのみ有効化
if (import.meta.env.DEV) {
  import('./utils/runTests');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
