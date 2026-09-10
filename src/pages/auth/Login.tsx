import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Brand } from '../../components/app/AppShell';
import { ErrorNotice, Field } from '../../components/app/Primitives';

export const Login: React.FC = () => {
  const { login, verifyMfa, resendMfa, isAuthenticated, isStaff } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [visible, setVisible] = useState(false);
  const [challenge, setChallenge] = useState('');
  const [method, setMethod] = useState<'email'|'totp'>('email');
  const [masked, setMasked] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(value => value - 1),1000); return () => clearTimeout(timer); }, [cooldown]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const from = (location.state as any)?.from;
    const path = typeof from?.pathname === 'string' && from.pathname.startsWith('/') && !from.pathname.startsWith('//') && !['/login','/register'].includes(from.pathname) ? from.pathname + (from.search || '') : isStaff ? '/dashboard' : '/my-tickets';
    navigate(path, { replace: true });
  }, [isAuthenticated,isStaff,location.state,navigate]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (challenge) {
        const result = await verifyMfa(challenge, code);
        if (!result.success) setError(result.message || 'Kode tidak cocok.');
      } else {
        const result = await login(email, password, remember);
        if (result.mfa_required && result.challenge_token) {
          setChallenge(result.challenge_token); setMasked(result.masked_email || email); setMethod(result.mfa_method || 'email'); setCooldown(60); setPassword('');
        } else if (!result.success) setError(result.message || 'Belum berhasil masuk.');
      }
    } finally { setBusy(false); }
  };
  const resend = async () => { setBusy(true); const result = await resendMfa(challenge); if (result.success) { setCooldown(60); setNotice('Kode baru dikirim. Gunakan kode terbaru.'); } else setError(result.message || 'Kode belum terkirim.'); setBusy(false); };
  return <div className="auth-layout">
    <aside className="auth-aside"><Brand /><div className="auth-copy"><div className="page-eyebrow" style={{color:'#85d4c4'}}>LAYANAN INTERNAL POS INDONESIA</div><h1>Kendala tercatat.<br /><em>Penanganan terarah.</em></h1><p>Satu ruang untuk melaporkan kendala operasional, berkoordinasi dengan petugas, dan mengikuti penyelesaiannya.</p><div className="auth-flow"><div><span>01</span>Laporkan kendala dari unit kerja Anda</div><div><span>02</span>Ikuti respons dan tindakan petugas</div><div><span>03</span>Dapatkan solusi yang terdokumentasi</div></div></div><p className="text-xs text-slate-300 flex gap-2 items-center"><ShieldCheck size={16} />Akun terverifikasi · Akses sesuai kewenangan</p></aside>
    <main className="auth-main"><div className="auth-form"><div className="auth-mobile-brand"><Brand /></div><div className="page-eyebrow">{challenge ? 'LANGKAH 2 DARI 2' : 'SELAMAT DATANG KEMBALI'}</div><h2>{challenge ? 'Verifikasi akun Anda' : 'Masuk ke ruang kerja'}</h2><p>{challenge ? method === 'totp' ? 'Masukkan kode authenticator atau salah satu kode pemulihan Anda.' : `Kode sekali pakai telah dikirim ke ${masked}. Berlaku 5 menit; periksa juga folder spam.` : 'Gunakan email akun dinas Anda. Verifikasi dua langkah membantu melindungi akses layanan.'}</p><form onSubmit={submit} className="form-stack">
      {!challenge ? <><Field label="Email akun dinas" htmlFor="login-email" required><input id="login-email" autoComplete="username" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@posindonesia.co.id" required /></Field><Field label="Kata sandi" htmlFor="login-password" required><div className="relative"><input id="login-password" autoComplete="current-password" className="input pr-12" type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Masukkan kata sandi Anda" /><button type="button" className="absolute right-3 top-3 text-slate-500 hover:text-slate-700" aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></Field><label htmlFor="login-remember" className="flex gap-2 items-center text-xs text-slate-700 cursor-pointer select-none"><input id="login-remember" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="accent-teal-700 w-4 h-4 rounded cursor-pointer" />Ingat saya selama 7 hari di perangkat pribadi ini</label></> : <Field label={method === 'totp' ? 'Kode authenticator / pemulihan' : 'Kode verifikasi 6 digit'} htmlFor="login-code" required><input id="login-code" autoFocus autoComplete="one-time-code" className="input text-center tracking-widest text-xl" inputMode={method === 'email' ? 'numeric' : 'text'} pattern={method === 'email' ? '[0-9]{6}' : undefined} maxLength={method === 'email' ? 6 : 20} value={code} onChange={e => setCode(e.target.value)} required placeholder={method === 'email' ? '000000' : 'Kode authenticator'} /></Field>}
      <ErrorNotice message={error} />{notice && <p role="status" className="info-notice">{notice}</p>}<button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Memproses…' : challenge ? 'Verifikasi & masuk' : 'Lanjutkan'}{!busy && <ArrowRight size={16} />}</button>
      {challenge && <div className="flex justify-between flex-wrap gap-2">{method === 'email' && <button type="button" className="btn btn-link" disabled={busy || cooldown > 0} onClick={resend}>{cooldown > 0 ? `Kirim ulang dalam ${cooldown} dtk` : 'Kirim ulang kode'}</button>}<button type="button" className="btn btn-link" onClick={() => { setChallenge(''); setCode(''); setError(''); }}>Kembali ke halaman masuk</button></div>}
    </form><div className="auth-footer">{challenge ? 'Jangan bagikan kode verifikasi kepada siapa pun.' : <>Belum punya akun? <Link to="/register">Daftarkan akun dinas</Link><p className="mt-3">Lupa kata sandi atau akses email? Hubungi administrator unit untuk pemulihan akun setelah verifikasi identitas.</p></>}</div></div></main>
  </div>;
};
