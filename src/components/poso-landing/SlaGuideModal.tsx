import React from 'react';
import { X, Clock, ShieldCheck, CheckCircle2, AlertTriangle, Info, Zap, Building2, Globe, Laptop } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SlaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SlaGuideModal: React.FC<SlaGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-2xl z-10 my-auto flex flex-col overflow-hidden text-[#0F172A] font-sans selection:bg-[#002B49] selection:text-white"
        >
          {/* Header */}
          <div className="px-6 sm:px-8 py-5 sm:py-6 bg-gradient-to-r from-[#002B49] to-[#0D5C75] text-white flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center font-bold shadow-inner">
                <Clock className="w-6 h-6 text-sky-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg sm:text-2xl text-white tracking-tight leading-tight">
                  Standar Layanan & Kebijakan SLA
                </h3>
                <p className="text-xs sm:text-sm text-sky-100/90 font-medium mt-0.5">
                  Service Level Agreement (SLA) PT Pos Indonesia (Persero)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 sm:p-8 overflow-y-auto max-h-[75vh] space-y-8">
            
            {/* Section 1: SLA Matrix */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-base sm:text-lg text-[#0F172A] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#002B49]" />
                  <span>1. Target Kecepatan Penanganan Berdasarkan Tingkat Urgensi</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Urgent */}
                <div className="p-5 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm sm:text-base text-rose-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                      Tingkat URGENT
                    </span>
                    <span className="text-xs sm:text-sm font-black text-rose-700 bg-rose-200/80 px-2.5 py-1 rounded-lg border border-rose-300/50">
                      Maks. 4 Jam
                    </span>
                  </div>
                  <p className="text-rose-950 text-xs sm:text-sm leading-relaxed">
                    Gangguan server sentral, listrik gedung padam total, kebocoran data, atau putusnya koneksi jaringan utama seluruh kantor.
                  </p>
                </div>

                {/* High */}
                <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm sm:text-base text-amber-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                      Tingkat HIGH
                    </span>
                    <span className="text-xs sm:text-sm font-black text-amber-700 bg-amber-200/80 px-2.5 py-1 rounded-lg border border-amber-300/50">
                      Maks. 8 Jam
                    </span>
                  </div>
                  <p className="text-amber-950 text-xs sm:text-sm leading-relaxed">
                    Kerusakan workstation loket transaksi, AC ruang rapat pimpinan, atau kendala modul sistem operasional pengiriman.
                  </p>
                </div>

                {/* Medium / Low */}
                <div className="p-5 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm sm:text-base text-sky-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                      MEDIUM / NORMAL
                    </span>
                    <span className="text-xs sm:text-sm font-black text-sky-800 bg-sky-200/80 px-2.5 py-1 rounded-lg border border-sky-300/50">
                      Maks. 24 Jam
                    </span>
                  </div>
                  <p className="text-sky-950 text-xs sm:text-sm leading-relaxed">
                    Permohonan reset kata sandi portal, instalasi software pendukung, penggantian toner printer, atau pengaduan umum.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: UPT Integration */}
            <div className="space-y-4">
              <h4 className="font-bold text-base sm:text-lg text-[#0F172A] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#002B49]" />
                <span>2. Unit Pelaksana Teknis (UPT) yang Terintegrasi</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-sky-100 text-[#002B49] shrink-0 mt-0.5">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm sm:text-base text-[#0F172A]">UPT TI & Sistem Informasi</h5>
                    <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 leading-relaxed">
                      Router, kabel LAN, switch hub, access point Wi-Fi, VPN, dan portal aplikasi internal.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm sm:text-base text-[#0F172A]">UPT Sarana & Prasarana (CGS)</h5>
                    <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 leading-relaxed">
                      Kelistrikan gedung, pendingin ruangan (AC), genset, perbaikan fisik ruangan, dan mebel.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm sm:text-base text-[#0F172A]">UPT Pengendalian Operasi</h5>
                    <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 leading-relaxed">
                      Manajemen armada logistik, first/mid/last mile delivery, sorting hub, dan manifes perjalanan.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-800 shrink-0 mt-0.5">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm sm:text-base text-[#0F172A]">UPT Quality Control & Security</h5>
                    <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 leading-relaxed">
                      Audit standar kepatuhan SLA operasional, rekaman CCTV, keamanan fisik, dan investigasi.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
            <span className="text-xs sm:text-sm text-[#64748B] font-medium hidden sm:inline">
              Standar Operasional Prosedur PRISMA POS v2.0
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#002B49] hover:bg-[#001D33] text-white text-xs sm:text-sm font-bold transition-all shadow-sm shadow-[#002B49]/20 cursor-pointer"
            >
              Mengerti & Tutup Panduan
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
