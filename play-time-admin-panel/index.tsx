import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './utils/serviceWorkerRegistration';
import { initializeConsoleFilters } from './utils/consoleFilter';

// Initialize console filters to suppress known harmless errors
initializeConsoleFilters();

// Register service worker for FCM
if ('serviceWorker' in navigator) {
  registerServiceWorker().catch(console.error);
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
