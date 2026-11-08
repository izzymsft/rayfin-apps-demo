import { useState } from 'react';
import { useAuth } from '@/hooks/AuthContext';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { errorMessage } from '@/hooks/useResource';
export function Header({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) {
  const { user, signOut, error: authError } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <header className="app-header">
    <Button variant="secondary" className="menu-button" aria-expanded={menuOpen} aria-controls="app-navigation" onClick={onToggleMenu}>Menu</Button>
    <span className="header-title">Customer &amp; Order Management</span>
    <div className="header-user"><span>{user?.name || user?.email}</span><Button variant="secondary" disabled={busy} onClick={() => {
      setBusy(true); void signOut().catch(err => { setError(errorMessage(err)); setBusy(false); });
    }}>Sign out</Button></div><ErrorMessage message={error || authError} />
  </header>;
}
