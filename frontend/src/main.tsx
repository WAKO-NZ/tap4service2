/**
 * main.tsx - Version V1.1
 * - Entry point for React application.
 * - Renders App component into #root.
 * - Ensures no aria-hidden attribute on root to fix ARIA warning.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}
// Ensure no aria-hidden attribute
container.removeAttribute('aria-hidden');
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);