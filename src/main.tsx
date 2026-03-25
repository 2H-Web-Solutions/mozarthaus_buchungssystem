import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { EnvValidator } from './utils/EnvValidator.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EnvValidator>
      <App />
    </EnvValidator>
  </StrictMode>,
);
