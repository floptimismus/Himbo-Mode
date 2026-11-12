import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="p-6">
      <h1 className="font-pixel text-lg">Himbo-Mode</h1>
    </main>
  </StrictMode>,
);
