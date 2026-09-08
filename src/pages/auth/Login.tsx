import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Smartphone,
  RotateCcw,
  Mail,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const Login: React.FC = () => {
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // MFA Challenge States (Stage 2)
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [smtpConfigured, setSmtpConfigured] = useState(true);
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // General States
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, verifyMfa, resendMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: toastError } = useToast();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // Cooldown countdown timer for resending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const redirectUserByRole = (role?: string) => {
    const isStaffOperatorOrAdmin = [
      'ADMIN', 'ADMIN_PUSAT', 'admin',
      'OPERATOR', 'PETUGAS_UPT', 'operator', 'upt_pusat'
    ].includes(role || '');

    if (isStaffOperatorOrAdmin) {
      const dest = (from && from !== '/' && from !== '/login' && from !== '/my-tickets') ? from : '/dashboard';
      navigate(dest, { replace: true });
    } else {
      // Seluruh Pelapor & UPT Luar masuk ke portal tiket dinas
      const dest = (from && from !== '/' && from !== '/login' && from !== '/dashboard') ? from : '/my-tickets';
      navigate(dest, { replace: true });
    }
  };

  // Handle Login Submit (Step 1: Password Check -> Trigger OTP Challenge)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await login(email.trim(), password);
      
      // Case 1: MFA is required (Stage 2 OTP sent to email)
      if (res.mfa_required && res.challenge_token) {
        setChallengeToken(res.challenge_token);
        setMaskedEmail(res.masked_email || email.trim());
        setSmtpConfigured(res.smtp_configured !== false);
        setIsMfaStep(true);
        setResendCooldown(60);
        if (res.smtp_configured !== false) {
          success(`Kredensial valid. Kode OTP telah dikirimkan ke email Anda.`);
        } else {
          success(`Kredensial valid. Layanan email SMTP belum dikonfigurasi.`);
        }
        return;
      }

      // Case 2: Direct Login Success
      if (res.success) {
        success('Selamat datang kembali di PRISMA POS!');
        redirectUserByRole(res.role);
      } else {
        const msg = res.message || 'Kombinasi email atau password salah.';
        setErrorMsg(msg);
        toastError(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan saat masuk ke sistem.';
      setErrorMsg(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending || !challengeToken) return;
    setResending(true);
    setErrorMsg('');

    try {
      const res = await resendMfa(challengeToken);
      if (res.success) {
        success('Kode OTP baru telah berhasil dikirimkan ke email Anda.');
        setResendCooldown(60);
      } else {
        const msg = res.message || 'Gagal mengirim ulang kode OTP.';
        setErrorMsg(msg);
        toastError(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'Gagal mengirim ulang kode OTP.';
      setErrorMsg(msg);
      toastError(msg);
    } finally {
      setResending(false);
    }
  };

  // Handle OTP MFA Submit (Step 2: Enter 6-digit OTP)
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMsg('Masukkan 6 digit kode OTP verifikasi.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await verifyMfa(challengeToken, otpCode.trim());
      if (res.success) {
        success('Verifikasi OTP berhasil! Mengalihkan ke portal Anda...');
        redirectUserByRole(res.role);
      } else {
        const msg = res.message || 'Kode OTP verifikasi salah atau kedaluwarsa.';
        setErrorMsg(msg);
        toastError(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'Gagal memverifikasi kode OTP.';
      setErrorMsg(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#F4F7F9] text-[#0F172A] font-sans flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden selection:bg-[#0D5C75] selection:text-white">
      
      {/* Main Container Split Box */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-5xl bg-white rounded-[28px] sm:rounded-[36px] shadow-[0_24px_64px_rgba(15,23,42,0.12)] border border-[#E2E8F0] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]"
      >
        
        {/* =========================================================================
            LEFT COLUMN: 3D ORGANIC CURVES & WELCOME HERO (OCEAN & CYAN PALETTE)
        ========================================================================= */}
        <div className="lg:col-span-6 relative bg-gradient-to-br from-[#083342] via-[#0D5C75] to-[#199FB1] p-8 sm:p-12 text-white flex flex-col justify-between overflow-hidden">
          
          {/* Background Ambient Glow & Spheres */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Top Large Curved Blob */}
            <div className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-gradient-to-br from-[#199FB1]/50 to-[#0D5C75]/20 blur-2xl" />

            {/* Main Central 3D Sphere */}
            <motion.div 
              animate={{
                y: [-6, 6, -6],
                rotate: [0, 4, 0]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-20 -left-12 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-gradient-to-br from-[#38BDF8] via-[#199FB1] to-[#083342]"
              style={{
                boxShadow: 'inset -20px -20px 50px rgba(8,51,66,0.8), inset 16px 16px 40px rgba(255,255,255,0.45), 0 30px 80px rgba(0,0,0,0.35)'
              }}
            />

            {/* Second Smaller Overlapping 3D Sphere */}
            <motion.div 
              animate={{
                y: [8, -8, 8],
                x: [-4, 4, -4]
              }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-4 -right-12 w-52 h-52 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br from-[#199FB1] via-[#0D5C75] to-[#083342]"
              style={{
                boxShadow: 'inset -14px -14px 35px rgba(0,0,0,0.6), inset 12px 12px 30px rgba(255,255,255,0.35), 0 20px 50px rgba(0,0,0,0.3)'
              }}
            />
          </div>

          {/* Top Brand Tag */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md border border-white/40">
                <img src="/prisma-pos-logo.png" alt="PRISMA POS Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-[16px] font-black tracking-tight text-white block leading-none">PRISMA POS</span>
                <span className="text-[9px] font-bold text-[#A5D1E1] tracking-wider uppercase">Pos Resolution & Integrated Service</span>
              </div>
            </div>

            {/* Official Badge (Beranda link removed) */}
            <div className="px-3 py-1.5 rounded-xl bg-white/15 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs">
              <ShieldCheck size={14} className="text-[#38BDF8]" />
              <span>Portal Dinas</span>
            </div>
          </div>

          {/* Welcome Text Content */}
          <div className="relative z-10 my-auto py-10 sm:py-14 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              LOGIN <span className="text-[#38BDF8]">PRISMA POS</span>
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#BAE6FC] uppercase tracking-wider">
              Helpdesk Terpadu PT Pos Indonesia
            </p>
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-sm pt-1">
              Portal penanganan tiket kendala operasional. Seluruh staf UPT di luar pusat mengajukan tiket secara mandiri, dan ditindaklanjuti secara langsung oleh Petugas Operator & Administrator Kantor Pusat.
            </p>
          </div>

          {/* Bottom Security Note */}
          <div className="relative z-10 flex items-center gap-2 text-[11px] text-[#BAE6FC]/80 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>Koneksi Sistem Terenkripsi & Otentikasi OTP Dua Faktor</span>
          </div>

        </div>


        {/* =========================================================================
            RIGHT COLUMN: SIGN IN & OTP VERIFICATION FORM
        ========================================================================= */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center bg-white space-y-5">
          
          {/* Top Tabs: Sign In vs Registrasi Dinas */}
          <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] rounded-xl">
            <button
              type="button"
              className="py-2 text-xs font-bold rounded-lg transition-all text-center bg-white text-[#0D5C75] shadow-xs cursor-default"
            >
              Sign In (Masuk)
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="py-2 text-xs font-bold rounded-lg transition-all text-center text-[#64748B] hover:text-[#0D5C75] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus size={14} />
              <span>Registrasi Dinas</span>
            </button>
          </div>

          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {isMfaStep ? 'Verifikasi OTP' : 'Masuk ke Sistem'}
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              {isMfaStep 
                ? 'Masukkan 6 digit kode OTP untuk konfirmasi autentikasi dinas'
                : 'Silakan masukkan email kedinasan dan kata sandi akun Anda'}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2"
            >
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {/* Forms with AnimatePresence */}
          <AnimatePresence mode="wait">
            {isMfaStep ? (
              /* ================= STEP 2: 6-DIGIT OTP MFA VERIFICATION ================= */
              <motion.form
                key="mfa-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleMfaSubmit}
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-[#F0F9FF] border border-[#BAE6FD] text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#0D5C75] text-white flex items-center justify-center shadow-md shadow-[#0D5C75]/20">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0C4A6E]">Tahap 2: Verifikasi Kode OTP</h3>
                    <p className="text-xs text-[#0369A1] mt-0.5">
                      Kode OTP verifikasi kedinasan telah dikirimkan ke email Anda:
                    </p>
                    <div className="mt-2 inline-block px-3.5 py-1 bg-white border border-[#BAE6FD] rounded-full text-xs font-mono font-bold text-[#0D5C75] shadow-xs">
                      {maskedEmail || 'Email Terdaftar'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#475569] leading-relaxed flex items-center gap-2.5">
                  <ShieldCheck size={16} className="text-[#0D5C75] flex-shrink-0" />
                  <span>Silakan buka Kotak Masuk (Inbox) atau folder Spam pada email Anda untuk melihat 6 digit kode OTP.</span>
                </div>

                {!smtpConfigured && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound size={15} className="text-amber-600 shrink-0" />
                      <span>SMTP belum dikonfigurasi. Kode darurat: <strong className="font-mono font-bold text-amber-950">123456</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpCode('123456')}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-950 hover:underline cursor-pointer bg-amber-100/70 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Gunakan
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5 text-center">
                    Kode OTP 6-Digit Kedinasan
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                      <KeyRound size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={10}
                      placeholder="000 000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                      className="w-full h-13 pl-12 pr-4 text-center tracking-[0.3em] font-mono text-xl font-bold rounded-xl bg-[#F8FAFC] border-2 border-[#0D5C75]/30 focus:border-[#0D5C75] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-4 focus:ring-[#0D5C75]/15 transition-all"
                    />
                  </div>

                  {/* Resend OTP Button with Countdown */}
                  <div className="flex items-center justify-between mt-2.5 px-1 text-xs">
                    <span className="text-[#64748B]">Tidak menerima email?</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || resending}
                      onClick={handleResendOtp}
                      className="font-bold text-[#0D5C75] hover:text-[#083342] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                      <span>
                        {resending
                          ? 'Mengirim...'
                          : resendCooldown > 0
                          ? `Kirim ulang (${resendCooldown}s)`
                          : 'Kirim Ulang Kode OTP'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Submit MFA */}
                <button
                  type="submit"
                  disabled={loading || !otpCode}
                  className="w-full h-12 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-sm font-bold transition-all shadow-md shadow-[#0D5C75]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-50"
                >
                  <ShieldCheck size={18} />
                  <span>{loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}</span>
                </button>

                {/* Cancel / Back Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMfaStep(false);
                    setOtpCode('');
                    setErrorMsg('');
                  }}
                  className="w-full py-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Kembali ke login email & password</span>
                </button>
              </motion.form>
            ) : (
              /* ================= STEP 1: PASSWORD LOGIN ================= */
              <motion.form 
                key="login-form"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleLoginSubmit} 
                className="space-y-4"
              >
                {/* Email Field */}
                <div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                      <User size={18} />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="Email Dinas / Staf"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 pl-12 pr-4 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0]/60 focus:bg-white border border-transparent focus:border-[#0D5C75] text-sm font-medium text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Kata Sandi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pl-12 pr-16 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0]/60 focus:bg-white border border-transparent focus:border-[#0D5C75] text-sm font-medium text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-[#0D5C75] hover:text-[#199FB1] uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0D5C75] focus:ring-[#0D5C75] border-[#CBD5E1]" 
                    />
                    <span className="text-xs text-[#64748B] font-medium">Ingat saya di perangkat ini</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-sm font-bold transition-all shadow-md shadow-[#0D5C75]/25 flex items-center justify-center cursor-pointer active:scale-[0.99] disabled:opacity-50"
                >
                  <span>{loading ? 'Sedang Masuk...' : 'Masuk ke Sistem'}</span>
                </button>

                {/* Quick Auto-Fill Admin Account */}
                <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B]">
                    <span>AKUN RESMI ADMINISTRATOR:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@poso.local');
                      setPassword('Admin123!');
                      setErrorMsg('');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#F0F9FF] hover:bg-[#E0F2FE] border border-[#BAE6FD] text-xs font-bold text-[#0D5C75] transition-all flex items-center justify-between cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[#0D5C75]" />
                      <span>Admin Pusat (Super Admin)</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">admin@poso.local</span>
                  </button>
                </div>

                {/* Footer Link to Registrasi Dinas */}
                <div className="text-center pt-2">
                  <p className="text-xs text-[#64748B]">
                    Staf UPT / Kantor Cabang belum terdaftar?{' '}
                    <Link
                      to="/register"
                      className="font-bold text-[#0D5C75] hover:text-[#199FB1] hover:underline"
                    >
                      Registrasi Dinas Baru
                    </Link>
                  </p>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

        </div>

      </motion.div>
    </div>
  );
};

export default Login;
