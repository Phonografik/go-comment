// settings.html — a full browser tab, not the popup. OS file pickers close a
// popup on macOS Chrome, which is why export/import live here. WXT emits this
// as an unlisted page (nothing in the manifest points at it); the popup opens
// it with browser.runtime.getURL('/settings.html').
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
