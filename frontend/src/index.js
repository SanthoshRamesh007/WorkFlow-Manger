import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
// Global error handlers: suppress noisy extension errors (like MetaMask inpage) and log friendly warnings.
window.addEventListener('error', (event) => {
  try {
    const src = event.filename || '';
    // If the error originates from a chrome extension (inpage scripts), ignore it to avoid crashing the app UI
    if (typeof src === 'string' && src.startsWith('chrome-extension://')) {
      console.warn('Ignored extension error from', src, event.message);
      event.preventDefault();
      return;
    }
  } catch (e) {
    // fallthrough
  }
  // Let the error propagate normally for non-extension errors
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event.reason;
    const stack = (reason && reason.stack) ? reason.stack : '';
    if (typeof stack === 'string' && stack.includes('chrome-extension://')) {
      console.warn('Ignored extension unhandled rejection', stack);
      event.preventDefault();
      return;
    }
  } catch (e) {
    // fallthrough
  }
  // Otherwise allow default handling (so errors surface during development)
});
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
