import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
export function AppLayout() {
  const [open, setOpen] = useState(false);
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><Sidebar open={open} close={() => setOpen(false)} /><div className="app-body"><Header menuOpen={open} onToggleMenu={() => setOpen(value => !value)} /><main id="main-content" tabIndex={-1}><Outlet /></main></div></div>;
}
