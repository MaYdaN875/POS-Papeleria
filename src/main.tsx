import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Solución para el bug de foco en Electron después de mostrar un diálogo nativo (alert/confirm/prompt)
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = function (message?: any) {
    originalAlert(message);
    refocusElectronWindow();
  };

  const originalConfirm = window.confirm;
  window.confirm = function (message?: string): boolean {
    const res = originalConfirm(message);
    refocusElectronWindow();
    return res;
  };
}

function refocusElectronWindow() {
  setTimeout(() => {
    if (window.ipcRenderer) {
      try {
        window.ipcRenderer.send('focus-fix');
      } catch (e) {
        console.error('Failed to send focus-fix', e);
      }
    }
  }, 100);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
