import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Bersihkan seluruh cache & URL legacy Google Apps Script dari storage browser
try {
  localStorage.removeItem('poso_gas_url');
  localStorage.removeItem('poso_live_tickets');
  localStorage.removeItem('poso_live_threads');
  localStorage.removeItem('poso_live_users');
  localStorage.removeItem('poso_auth_token');
  localStorage.removeItem('poso_auth_user');
} catch (e) {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
