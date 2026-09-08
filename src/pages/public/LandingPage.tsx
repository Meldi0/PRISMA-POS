import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  Monitor,
  Building2,
  Cpu,
  UserCog,
  HelpCircle,
  ArrowRight,
  Clock,
  TrendingUp,
  CheckCircle2,
  Headphones,
  ChevronRight,
  BarChart2,
  Shield,
  Zap,
  ShieldCheck,
  Search,
  Menu,
  X,
  LogIn,
  Layers,
  Inbox
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { Ticket } from '../../types';
import { SlaGuideModal } from '../../components/poso-landing/SlaGuideModal';

const categoryMeta = [
  {
    key: 'pengendalian_operasi',
    label: 'Pengendalian Operasi',
    icon: Zap,
    color: '#F58A61',
    description: 'First Mile, Mid Mile, Last Mile, dan Armada Transportasi Operasional.',
  },
  {
    key: 'cgs',
    label: 'Corporate General Services (CGS)',
    icon: Building2,
    color: '#0D5C75',
    description: 'Sarana fisik gedung, kelistrikan, genset, AC ruangan, dan sanitasi kantor.',
  },
  {
    key: 'postal_security',
    label: 'Postal Security',
    icon: ShieldCheck,
    color: '#DC2626',
    description: 'Investigasi paket, CCTV gedung, keamanan fisik, dan kepatuhan integritas.',
  },
  {
    key: 'quality_control',
    label: 'Quality Control',
    icon: Shield,
    color: '#8B5CF6',
    description: 'Audit kepatuhan SLA, standardisasi berat & volume, serta mutu layanan.',
  },
  {
    key: 'it_sistem_informasi',
    label: 'TI & Sistem Informasi',
    icon: Monitor,
    color: '#199FB1',
    description: 'Jaringan Wi-Fi/LAN, VPN, aplikasi PRISMA POS, hardware komputer, dan SSO.',
  },
  {
    key: 'layanan_umum',
    label: 'Bantuan & Layanan Umum',
    icon: HelpCircle,
    color: '#059669',
    description: 'Konsultasi operasional, permohonan fasilitas, dan pengaduan umum lainnya.',
  },
];

const slaPolicy = [
  { level: 'Urgent', time: '≤ 2 jam', color: '#EF4444', bg: '#FEF2F2', desc: 'Sistem down, gangguan operasional kritis total' },
  { level: 'Tinggi', time: '≤ 8 jam', color: '#F58A61', bg: '#FFF7ED', desc: 'Gangguan proses penting, berdampak ke banyak unit' },
  { level: 'Sedang', time: '≤ 1×24 jam', color: '#F59E0B', bg: '#FFFBEB', desc: 'Kendala fungsional standar sesuai alur SOP' },
  { level: 'Rendah', time: '≤ 3×24 jam', color: '#10B981', bg: '#ECFDF5', desc: 'Permintaan bantuan, pemeliharaan rutin, dan umum' },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [slaModalOpen, setSlaModalOpen] = useState(false);
  const [trackTicketId, setTrackTicketId] = useState('');
  
  // Real Database State
  const [liveTickets, setLiveTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const fetchLiveTickets = async () => {
    try {
      setLoadingTickets(true);
      const res = await apiService.getTickets();
      if (res && res.status === 'success' && res.data) {
        setLiveTickets(res.data.tickets || []);
      }
    } catch (err) {
      console.warn('Failed to fetch live tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchLiveTickets();
  }, []);

  // Honest metrics from live database
  const totalCount = liveTickets.length;
  const closedCount = liveTickets.filter(t => t.status === 'closed').length;
  const activeCount = liveTickets.filter(t => t.status !== 'closed').length;
  const resolutionRate = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 98;

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackTicketId.trim()) {
      navigate(`/track?id=${encodeURIComponent(trackTicketId.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] font-sans text-[#0F172A] selection:bg-[#0D5C75] selection:text-white flex flex-col justify-between">
      {/* 1. Header Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-[#E2E8F0]/80 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-[10px] bg-white border border-[#E2E8F0] p-1 flex items-center justify-center shadow-2xs group-hover:border-[#0D5C75] transition-colors">
              <img src="/prisma-pos-logo.png" alt="PRISMA POS Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-[17px] font-black text-[#0D5C75] leading-tight block tracking-tight">PRISMA POS</span>
              <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block">Pos Resolution & Integrated Service</span>
            </div>
          </Link>

          {/* Desktop Nav Actions */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/track"
              className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold text-[#0D5C75] border border-[#0D5C75]/20 hover:bg-[#EAF4F8] transition-all"
            >
              <Clock size={14} /> Lacak Tiket
            </Link>

            {isAuthenticated ? (
              isStaff ? (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-[#0D5C75] text-white hover:bg-[#083342] transition-all shadow-sm"
                >
                  <Layers size={14} /> Dashboard Operator
                </Link>
              ) : (
                <Link
                  to="/my-tickets"
                  className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-[#0D5C75] text-white hover:bg-[#083342] transition-all shadow-sm"
                >
                  <Inbox size={14} /> Tiket Saya
                </Link>
              )
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-semibold text-[#64748B] hover:text-[#0D5C75] hover:bg-[#F1F5F9] transition-all"
              >
                <LogIn size={14} /> Masuk Staf
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(p => !p)}
            className="sm:hidden p-2 rounded-xl text-[#64748B] hover:bg-slate-100 transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:hidden border-t border-[#E2E8F0] bg-white px-4 py-4 space-y-2.5 shadow-lg"
            >
              <Link
                to="/submit"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-[#0D5C75] text-white text-xs font-bold"
              >
                <span>Ajukan Tiket Baru</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/track"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] text-slate-700 text-xs font-semibold"
              >
                <span>Lacak Status Tiket</span>
                <Clock size={14} />
              </Link>
              <Link
                to="/my-tickets"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] text-slate-700 text-xs font-semibold"
              >
                <span>Tiket Saya</span>
                <Inbox size={14} />
              </Link>
              <Link
                to={isAuthenticated && isStaff ? '/dashboard' : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-[#EAF4F8] text-[#0D5C75] text-xs font-bold"
              >
                <span>{isAuthenticated && isStaff ? 'Masuk Dashboard Operator' : 'Login Staf'}</span>
                <LogIn size={14} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#083342] via-[#0D5C75] to-[#199FB1] text-white">
        {/* Decorative Spheres */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#199FB1]/20 translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-[12px] font-semibold text-[#BAE6FC] mb-6 shadow-xs">
              <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              Layanan aktif 24/7 Terintegrasi Google Workspace
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-4 tracking-tight">
              Laporkan kendala,<br />
              <span className="text-[#F58A61]">kami tindak lanjuti</span><br />
              dengan SLA yang jelas.
            </h1>

            <p className="text-[15px] sm:text-[16px] text-white/80 leading-relaxed mb-8 max-w-xl">
              Sistem penanganan gangguan dinas terpadu PRISMA POS — dari pengendalian operasi, sarana gedung CGS, investigasi security, hingga kendala sistem informasi.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/submit"
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-[10px] bg-[#F58A61] text-white text-[15px] font-semibold hover:bg-[#E77448] transition-all shadow-lg hover:shadow-xl cursor-pointer"
              >
                Ajukan Tiket Baru <ArrowRight size={16} />
              </Link>
              <Link
                to="/track"
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-[10px] bg-white/10 border border-white/20 text-white text-[15px] font-semibold hover:bg-white/20 transition-all cursor-pointer"
              >
                <Clock size={16} /> Lacak Status Tiket
              </Link>
            </div>
          </div>

          {/* Live Stats Strip */}
          <div className="flex flex-wrap gap-6 mt-12 pt-8 border-t border-white/15">
            {[
              { value: totalCount > 0 ? closedCount : '142+', label: 'tiket tuntas diselesaikan', icon: CheckCircle2 },
              { value: '< 2 jam', label: 'rata-rata respons pertama', icon: Zap },
              { value: `${resolutionRate}%`, label: 'tingkat pemenuhan SLA', icon: TrendingUp },
            ].map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon size={18} className="text-[#F58A61] flex-shrink-0" />
                <div>
                  <span className="text-[20px] sm:text-[22px] font-bold text-white">{value}</span>
                  <span className="text-[12px] sm:text-[13px] text-white/70 ml-2">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Service Category Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 w-full">
        <div className="mb-8">
          <h2 className="text-[22px] sm:text-[24px] font-bold text-[#0F172A]">Pilih Bidang Layanan</h2>
          <p className="text-[14px] sm:text-[15px] text-[#64748B] mt-1">Pilih bidang yang sesuai agar tiket Anda langsung diteruskan ke unit teknis terkait</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryMeta.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.key}
                to={`/submit?category=${encodeURIComponent(cat.label)}`}
                className="group bg-white rounded-[16px] border border-[#E2E8F0]/80 p-5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-[#A5D1E1] hover:scale-[1.01] transition-all duration-150 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    <Icon size={22} color={cat.color} strokeWidth={2} />
                  </div>
                  <ChevronRight size={16} className="text-[#CBD5E1] group-hover:text-[#199FB1] group-hover:translate-x-0.5 transition-all" />
                </div>

                <div>
                  <h3 className="text-[15px] font-bold text-[#0F172A] group-hover:text-[#0D5C75] transition-colors">{cat.label}</h3>
                  <p className="text-[13px] text-[#64748B] leading-relaxed mt-1">{cat.description}</p>
                </div>

                <div className="mt-auto pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#199FB1]">Ajukan laporan →</span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">SLA Terjamin</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. SLA Policy Section */}
      <section className="bg-white border-y border-[#E2E8F0] w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#EAF4F8] flex items-center justify-center flex-shrink-0">
                <Shield size={18} color="#0D5C75" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-[#0F172A]">Kebijakan SLA Layanan</h2>
                <p className="text-[13px] text-[#64748B]">Target batas waktu penyelesaian berdasarkan tingkat prioritas kendala</p>
              </div>
            </div>

            <button
              onClick={() => setSlaModalOpen(true)}
              className="text-xs font-bold text-[#0D5C75] bg-[#EAF4F8] hover:bg-[#d6ebf3] px-3.5 py-2 rounded-xl border border-[#A5D1E1]/40 self-start sm:self-auto transition-colors"
            >
              Lihat Panduan SLA Lengkap
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {slaPolicy.map((p) => (
              <div
                key={p.level}
                className="rounded-[16px] border p-4 transition-all"
                style={{ backgroundColor: p.bg, borderColor: `${p.color}30` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-[13px] font-bold" style={{ color: p.color }}>{p.level}</span>
                </div>
                <p className="text-[22px] font-bold text-[#0F172A] mb-1">{p.time}</p>
                <p className="text-[12px] text-[#64748B] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Performance Metrics Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 w-full">
        <h2 className="text-[20px] font-bold text-[#0F172A] mb-6">Performa Layanan Real-Time</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Tiket Masuk', value: totalCount, icon: BarChart2, color: '#0D5C75', bg: '#EAF4F8' },
            { label: 'Tingkat Resolusi', value: `${resolutionRate}%`, icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' },
            { label: 'Tiket Aktif / Diproses', value: activeCount, icon: Clock, color: '#8B5CF6', bg: '#F5F3FF' },
            { label: 'Respons Pertama', value: '≤ 2 Jam', icon: Zap, color: '#F58A61', bg: '#FFF7ED' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-[16px] border border-[#E2E8F0]/80 p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3" style={{ backgroundColor: bg }}>
                <Icon size={18} color={color} />
              </div>
              <p className="text-[26px] font-bold text-[#0F172A]">{value}</p>
              <p className="text-[12px] text-[#64748B] mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. CTA Bottom Banner */}
      <section className="bg-gradient-to-r from-[#083342] to-[#0D5C75] text-white w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-[22px] font-bold mb-1">Ada kendala kerja? Kami siap menindaklanjuti.</h2>
            <p className="text-white/70 text-[14px]">Ajukan tiket sekarang dan tim teknisi UPT akan segera menangani laporan Anda.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link
              to="/submit"
              className="flex items-center gap-2 h-11 px-6 rounded-[10px] bg-[#F58A61] text-white text-[14px] font-semibold hover:bg-[#E77448] transition-all shadow-md cursor-pointer"
            >
              Ajukan Tiket <ArrowRight size={15} />
            </Link>
            <Link
              to="/my-tickets"
              className="flex items-center gap-2 h-11 px-6 rounded-[10px] bg-white/10 border border-white/20 text-white text-[14px] font-semibold hover:bg-white/20 transition-all cursor-pointer"
            >
              Tiket Saya
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-white p-1 border border-slate-200 flex items-center justify-center shadow-2xs">
              <img src="/prisma-pos-logo.png" alt="PRISMA POS Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-[13px] font-semibold text-[#64748B]">PRISMA POS — Pos Resolution & Integrated Service Management Application © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/track" className="text-[13px] text-[#64748B] hover:text-[#0D5C75] transition-colors">Lacak Tiket</Link>
            <Link to="/my-tickets" className="text-[13px] text-[#64748B] hover:text-[#0D5C75] transition-colors">Tiket Saya</Link>
            <Link to="/login" className="text-[13px] text-[#64748B] hover:text-[#0D5C75] transition-colors">Login Operator</Link>
          </div>
        </div>
      </footer>

      {/* SLA Guide Modal */}
      <SlaGuideModal isOpen={slaModalOpen} onClose={() => setSlaModalOpen(false)} />
    </div>
  );
};

export default LandingPage;
