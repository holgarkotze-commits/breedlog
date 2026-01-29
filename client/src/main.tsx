import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { openDatabase } from "./lib/indexeddb";

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[PWA] Service Worker registered:', registration.scope);
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New content available, refresh to update');
            }
          });
        }
      });
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  });
}

openDatabase()
  .then(() => console.log('[PWA] IndexedDB initialized'))
  .catch((error) => console.error('[PWA] IndexedDB initialization failed:', error));

createRoot(document.getElementById("root")!).render(<App />);
