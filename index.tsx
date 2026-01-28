import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        // Only log in development mode
        if (import.meta.env.DEV) {
          console.log('Service Worker registered:', registration.scope);
        }
      })
      .catch((error) => {
        // Always log errors
        console.error('Service Worker registration failed:', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfirmDialogProvider>
        <App />
      </ConfirmDialogProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
