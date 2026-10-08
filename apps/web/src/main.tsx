import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import { App } from './App';
import './styles/global.css';

// La CSP de la app de escritorio prohíbe eval: Zod valida sin compilar código en tiempo de ejecución.
z.config({ jitless: true });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
