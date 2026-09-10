import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Building2, Inbox, LayoutDashboard, LogOut, Menu, Plus, Search, ShieldCheck, Users, X, ChartNoAxesCombined, Settings, History, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
  const dateStr = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(now);

  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f0f5f7] border border-[#d6e3e8] text-slate-700 text-xs font-mono select-none" title="Jam Operasional Helpdesk Real-time (WIB)">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <span className="font-sans font-medium text-slate-600">{dateStr}</span>
      <span className="text-slate-300">•</span>
      <span className="font-bold text-[#102f3c] tracking-wider">{timeStr} WIB</span>
    </div>
  );
}

export function Brand() { return <Link to="/" className="app-brand"><span className="brand-mark"><img src="/prisma-pos-logo.png" alt="" /></span><span><strong>PRISMA POS</strong><small>Pusat layanan operasional</small></span></Link>; }
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isStaff, hasPermission, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isAdmin = ['ADMIN','ADMIN_PUSAT','admin'].includes(user?.role || '');
  const home = isStaff ? '/dashboard' : '/my-tickets';
  const active = new URLSearchParams(location.search).get('view') || 'tickets';
  const menu = [
    { to: home, icon: isStaff ? LayoutDashboard : Inbox, label: isStaff ? 'Antrean tiket' : 'Tiket unit kerja', view: 'tickets', show: true },
    { to: '/track', icon: Search, label: 'Cari tiket', view: 'track', show: true },
    { to: '/account', icon: ShieldCheck, label: 'Akun & keamanan', view: 'account', show: true },
  ];
  const adminMenu = [
    { view: 'users', icon: Users, label: 'Pengguna & akses', show: isAdmin },
    { view: 'approvals', icon: UserCheck, label: 'Persetujuan akun', show: isAdmin },
    { view: 'reports', icon: ChartNoAxesCombined, label: 'Kinerja operator', show: isStaff && hasPermission('operator.stats_view') },
    { view: 'audit', icon: History, label: 'Riwayat aktivitas', show: hasPermission('audit.view') },
    { view: 'settings', icon: Settings, label: 'Pengaturan layanan', show: isAdmin },
  ];
  return <div className="app-frame">
    <a className="skip-link" href="#main-content">Langsung ke konten</a>
    {open && <button className="sidebar-backdrop" aria-label="Tutup navigasi" onClick={() => setOpen(false)} />}
    <aside className={`app-sidebar ${open ? 'is-open' : ''}`} aria-label="Navigasi utama">
      <div className="flex items-center justify-between"><Brand /><button className="mobile-close" onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={22} /></button></div>
      <div className="sidebar-caption">RUANG KERJA</div>
      <nav>{menu.map(item => <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive && (item.view !== 'tickets' || active === 'tickets') ? 'active' : ''}`}><item.icon size={19} />{item.label}</NavLink>)}</nav>
      {adminMenu.some(item => item.show) && <><div className="sidebar-caption">KELOLA LAYANAN</div><nav>{adminMenu.filter(item => item.show).map(item => <Link key={item.view} to={`/dashboard?view=${item.view}`} onClick={() => setOpen(false)} className={`nav-item ${location.pathname === '/dashboard' && active === item.view ? 'active' : ''}`}><item.icon size={19} />{item.label}</Link>)}</nav></>}
      <div className="sidebar-help"><Building2 size={20} /><strong>{user?.office_name || 'Kantor belum ditetapkan'}</strong><span>{user?.region_name || 'Lengkapi melalui administrator'}</span><Link to="/account">Lihat profil <ArrowUpRight size={14} /></Link></div>
      <button onClick={logout} className="nav-item sidebar-logout"><LogOut size={18} />Keluar dari akun</button>
    </aside>
    <div className="app-body">
      <header className="app-topbar"><div className="flex items-center gap-3"><button className="mobile-menu icon-button" aria-label="Buka menu navigasi" onClick={() => setOpen(true)}><Menu size={21} /></button><span className="topbar-label">Helpdesk terpadu <span>/</span> <strong>{isStaff ? 'Ruang petugas' : 'Portal pelapor'}</strong></span></div><div className="flex items-center gap-3 sm:gap-4"><LiveClock /><Link className="btn btn-primary topbar-create" to="/buat-tiket"><Plus size={16} />Buat tiket</Link><Link to="/account" className="account-chip" aria-label={`Profil ${user?.name}`}><span>{user?.name?.slice(0,1).toUpperCase()}</span><div><strong>{user?.name}</strong><small>{isAdmin ? 'Administrator' : isStaff ? 'Petugas helpdesk' : 'Pelapor'}</small></div></Link></div></header>
      <main id="main-content" tabIndex={-1} className="app-content">{children}</main>
      <footer className="app-footer"><span>PRISMA POS · PT Pos Indonesia</span><span>Setiap laporan, ditangani dengan jelas.</span></footer>
    </div>
  </div>;
}
