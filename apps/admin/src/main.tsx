import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './app';
import './globals.css';
import './editorial.css';
import './features/studio/card-studio.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element.');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
