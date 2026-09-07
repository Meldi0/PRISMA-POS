import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft, LogOut, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AccessDenied: React.FC = () => {
  const { user, logout, isStaff } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-[#0F172A] font-sans flex flex-col items-center justify-center p-4 selection:bg-[#0D5C75] selection:text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="max-w-md w-full bg-white rounded-[28px] border border-[#E2E8F0] shadow-[0_16px_40px_rgba(15,23,42,0.08)] p-8 text-center space-y-6"
      >
        {/* Lock / Alert Icon */}
        <div className="w-18 h-18 mx-auto rounded-3xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
          <ShieldAlert size={36} />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold tracking-wider px-3 py-1 rounded-full bg-rose-100 text-rose-800 uppercase">
            Error 403: Forbidden Access
          </span>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
            Akses Tidak Diizinkan
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Akun Anda tidak memiliki izin atau otoritas yang memadai untuk mengakses halaman atau modul ini.
          </p>
        </div>

        {/* User Context Card */}
        {user && (
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-left text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Pengguna:</span>
              <span className="font-bold text-[#0F172A]">{user.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Peran (Role):</span>
              <span className="font-mono font-bold text-[#0D5C75]">{user.role}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Cakupan Data:</span>
              <span className="font-mono font-bold text-purple-700">{user.data_scope || 'OFFICE'}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            onClick={() => navigate(isStaff ? '/dashboard' : '/my-tickets')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-xs font-bold transition-all shadow-md shadow-[#0D5C75]/20 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Home size={14} />
            <span>Kembali ke Portal Saya</span>
          </button>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut size={14} />
            <span>Keluar Akun</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AccessDenied;
