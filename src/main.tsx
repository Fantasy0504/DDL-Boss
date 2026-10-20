import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import FloatingBoss from './components/FloatingBoss';
import './styles.css';
import '../shared/bridge';
const floating = new URLSearchParams(location.search).has('floating');
if (floating) document.documentElement.classList.add('floating-document');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{floating ? <FloatingBoss /> : <App />}</React.StrictMode>,
);
