import { createRoot } from 'react-dom/client';

import App from '@/App';
import { AuthProvider } from '@/hooks/AuthContext';
import { bootstrapAuth } from '@/services/bootstrap';

import './main.css';

const root = createRoot(document.getElementById('root')!);
try {
  const authService = await bootstrapAuth();
  root.render(
    <AuthProvider authService={authService}>
      <App />
    </AuthProvider>
  );
} catch (error) {
  console.error('Application initialization failed', error);
  root.render(
    <main className="startup-error">
      <h1>Customer &amp; Order Management</h1>
      <p role="alert">{error instanceof Error ? error.message : 'Application initialization failed.'}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </main>
  );
}
