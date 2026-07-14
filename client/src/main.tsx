import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { openDatabase } from "./lib/indexeddb";
import {
  installNativeApiFetchBridge,
  registerBreedLogServiceWorker,
  shouldRegisterPwaServiceWorker,
} from "./lib/runtime-updates";

installNativeApiFetchBridge();

if ('serviceWorker' in navigator && shouldRegisterPwaServiceWorker()) {
  window.addEventListener('load', async () => {
    try {
      await registerBreedLogServiceWorker();
      console.log('[PWA] Service Worker registered');
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  });
}

openDatabase()
  .then(() => console.log('[PWA] IndexedDB initialized'))
  .catch((error) => console.error('[PWA] IndexedDB initialization failed:', error));

createRoot(document.getElementById("root")!).render(<App />);
