import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { Toaster } from './components/ui/sonner';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      {/* Hors des pages : un message de confirmation doit survivre a la redirection qui suit le depot. */}
      <Toaster />
    </BrowserRouter>
  </StrictMode>,
);
