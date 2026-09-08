import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { 
  UserPlus, 
  ArrowLeft, 
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  MapPin,
  Briefcase,
  Phone,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  BadgeCheck,
  ChevronDown
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const REGION_LIST = [
  { id: 'REG-01', code: 'REG1', name: 'Regional 1 Sumatera Bagian Utara' },
  { id: 'REG-02', code: 'REG2', name: 'Regional 2 Sumatera Bagian Barat & Selatan' },
  { id: 'REG-03', code: 'REG3', name: 'Regional 3 Jawa Barat & Banten' },
  { id: 'REG-04', code: 'REG4', name: 'Regional 4 DKI Jakarta & Jawa Tengah/DIY' },
  { id: 'REG-05', code: 'REG5', name: 'Regional 5 Jawa Timur & Bali Nusra' },
  { id: 'REG-06', code: 'REG6', name: 'Regional 6 Kalimantan, Sulawesi & Maluku Papua' },
  { id: 'REG-PUSAT', code: 'PUSAT', name: 'Kantor Pusat Bandung' },
];

export const Register: React.FC = () => {
  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nip, setNip] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState('REG-03');
  const [officeName, setOfficeName] = useState('');
  const [nopen, setNopen] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback States
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPendingSubmitted, setIsPendingSubmitted] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password minimal 6 karakter.');
      return;
    }

    if (!officeName.trim()) {
      setErrorMsg('Silakan ketik nama Kantor Pos / KC penempatan Anda.');
      return;
    }

    if (!nopen.trim()) {
      setErrorMsg('Silakan ketik Nopen / Kode Kantor Pos Anda.');
      return;
    }

    setLoading(true);

    try {
      // In POSO, all staff self-register as UPT_LUAR (Office Staff / Pelapor)
      // Office is captured via manual text (office_name & nopen) and region_id
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        position: position.trim() || 'Staf Operasional',
        nip: nip.trim(),
        role: 'UPT_LUAR' as UserRole,
        data_scope: 'OFFICE' as const,
        region_id: selectedRegionId,
        office_name: officeName.trim(),
        kc_name: officeName.trim(),
        nopen: nopen.trim(),
        nopen_kc: nopen.trim()
      };

      const res = await register(payload);
      if (res.success) {
        setRegisteredEmail(email.trim().toLowerCase());
        setIsPendingSubmitted(true);
        success('Permohonan pendaftaran akun internal berhasil diajukan.');
      } else {
        const msg = res.message || 'Pendaftaran gagal diproses.';
        setErrorMsg(msg);
        toastError(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'Terjadi gangguan saat mendaftar.';
      setErrorMsg(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-[#0F172A] font-sans flex flex-col justify-between selection:bg-[#0D5C75] selection:text-white">
      {/* Top Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#E2E8F0]/60 bg-white/70 backdrop-blur-md sticky top-0 z-30">
        <Link to="/login" className="flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#0D5C75] transition-colors">
          <ArrowLeft size={15} />
          <span>Kembali ke Halaman Masuk</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center border border-[#CBD5E1] shadow-xs">
            <img src="/prisma-pos-logo.png" alt="POSO Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-black text-[15px] text-[#0D5C75]">POSO HELPDESK</span>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {isPendingSubmitted ? (
            /* ================= SCREEN: REGISTRATION PENDING SUCCESS ================= */
            <motion.div
              key="pending-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[24px] border border-[#E2E8F0] shadow-lg p-8 sm:p-10 text-center space-y-6"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
                <Clock size={32} />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">
                  Status: PENDING APPROVAL
                </span>
                <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                  Permohonan Registrasi Terkirim
                </h1>
                <p className="text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
                  Akun internal untuk <strong className="text-[#0F172A]">{registeredEmail}</strong> telah dicatat sebagai <strong>Pelapor Internal</strong> dan saat ini menunggu verifikasi serta persetujuan dari <strong className="text-[#0D5C75]">Administrator Pusat</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-left text-xs text-[#475569] space-y-2 max-w-md mx-auto">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-[#0D5C75] flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Keamanan & Pengendalian Akses:</strong> Akun Anda berhak membuat dan memantau tiket keluhan internal begitu status disetujui.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p>
                    Setelah disetujui, Anda dapat masuk menggunakan email dan password yang Anda daftarkan.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-8 h-11 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-sm font-bold shadow-md shadow-[#0D5C75]/25 transition-all cursor-pointer"
                >
                  Kembali ke Halaman Masuk
                </button>
              </div>
            </motion.div>
          ) : (
            /* ================= SCREEN: REGISTRATION FORM ================= */
            <motion.div
              key="form-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[24px] border border-[#E2E8F0]/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)] p-6 sm:p-8 space-y-6"
            >
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] text-[11px] font-bold">
                  <BadgeCheck size={14} />
                  <span>Registrasi Pegawai Internal PT Pos Indonesia</span>
                </div>
                <h1 className="text-2xl sm:text-[26px] font-black text-[#0F172A] tracking-tight">
                  Pendaftaran Akun Pelapor
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B]">
                  Sistem Helpdesk & Manajemen Tiket Terpadu PT Pos Indonesia
                </p>
              </div>

              {/* Notice Banner for Approval */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <Clock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Verifikasi Admin Pusat</strong>
                  <span>
                    Seluruh pendaftaran staf baru berstatus <strong>PENDING</strong> dan memerlukan persetujuan Administrator Pusat sebelum dapat digunakan untuk masuk.
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Row 1: Nama Lengkap & NIP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                      Nama Lengkap Pegawai <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama lengkap sesuai data kepegawaian"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                      Nomor Induk Pegawai (NIP) <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nomor Induk Pegawai (Cth: 199407222019021002)"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                    />
                  </div>
                </div>

                {/* Row 2: Email Kedinasan & Telepon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                      Email Dinas / Akun <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="nama@posindonesia.co.id"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                      Nomor Telepon / WhatsApp <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="08xxxxxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                    />
                  </div>
                </div>

                {/* Row 3: Jabatan */}
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Jabatan / Posisi Kerja <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Cth: Staf Operasional KCU, Petugas Loket, Supervisor Layanan"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                  />
                </div>

                {/* Row 4: Penempatan Kedinasan (Ketik Manual KC & Nopen) */}
                <div className="space-y-2 p-3.5 rounded-xl bg-[#F0F9FF]/60 border border-[#BAE6FD]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#083342] flex items-center gap-1.5">
                      <Building size={14} className="text-[#0D5C75]" />
                      <span>Unit Kerja Penempatan Kedinasan</span>
                    </span>
                    <span className="text-[10px] text-[#0369A1] font-semibold bg-white px-2 py-0.5 rounded border border-[#BAE6FD]">
                      Input Manual Kedinasan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Wilayah Regional */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] mb-1">
                        Wilayah Regional <span className="text-[#EF4444]">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={selectedRegionId}
                          onChange={(e) => setSelectedRegionId(e.target.value)}
                          className="w-full h-11 px-3 pr-8 rounded-xl bg-white border border-[#CBD5E1] text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] appearance-none transition-all cursor-pointer font-medium"
                        >
                          {REGION_LIST.map((reg) => (
                            <option key={reg.id} value={reg.id}>
                              {reg.code} - {reg.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={15} className="text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Kantor Cabang / Kantor Pos */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] mb-1">
                        Kantor Cabang / Pos (KC / KCU) <span className="text-[#EF4444]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Cth: KCU Bandung / KC Garut"
                        value={officeName}
                        onChange={(e) => setOfficeName(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                      />
                    </div>

                    {/* Nopen / Kode Kantor */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#475569] mb-1">
                        Nopen / Kode Kantor <span className="text-[#EF4444]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Cth: 40000 / 46100"
                        value={nopen}
                        onChange={(e) => setNopen(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#0369A1]/90 pt-0.5">
                    💡 Ketik nama KC dan nomor nopen kantor pos Anda. Sistem akan merekap akun ke unit kerja tersebut secara otomatis tanpa perlu pemilihan dari database master.
                  </p>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                      Kata Sandi <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Minimal 6 karakter"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-11 pl-3.5 pr-10 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                      Konfirmasi Kata Sandi <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Ketik ulang kata sandi"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] transition-all"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-sm font-bold transition-all shadow-md shadow-[#0D5C75]/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99] mt-4"
                >
                  <UserPlus size={18} />
                  <span>
                    {loading ? 'Memproses Pendaftaran...' : 'Ajukan Pendaftaran Akun Pelapor'}
                  </span>
                </button>
              </form>

              <div className="text-center text-xs text-[#64748B] pt-2">
                Sudah memiliki akun terverifikasi?{' '}
                <Link to="/login" className="text-[#0D5C75] hover:text-[#199FB1] font-bold underline">
                  Masuk Sekarang
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#94A3B8]">
        POSO — Sistem Helpdesk & Manajemen Tiket Internal PT Pos Indonesia © 2026
      </footer>
    </div>
  );
};

export default Register;
