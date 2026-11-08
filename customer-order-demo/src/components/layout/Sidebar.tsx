import { NavLink } from 'react-router-dom';
export function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  return <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} id="app-navigation">
    <div className="brand"><span className="brand-mark">RF</span><span>Rayfin<span className="brand-subtitle">Business workspace</span></span></div>
    <nav aria-label="Main navigation">
      {[['/', 'Dashboard'], ['/customers', 'Customers'], ['/orders', 'Orders'], ['/products', 'Products']].map(([path, label]) => <NavLink key={path} to={path} end={path === '/'} onClick={close}>{label}</NavLink>)}
    </nav>
    <div className="sidebar-footer">Microsoft Fabric Apps<br /><span>Customer &amp; Order Management</span></div>
  </aside>;
}
