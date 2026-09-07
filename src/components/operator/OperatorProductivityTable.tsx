import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Search, 
  Download, 
  Award, 
  CheckCircle2, 
  Activity, 
  Clock, 
  ShieldAlert, 
  RefreshCw,
  TrendingUp,
  UserCheck,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { OperatorProductivityItem } from '../../types';
import { useToast } from '../../context/ToastContext';

export const OperatorProductivityTable: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { error: toastError, success: toastSuccess, info } = useToast();
  
  const [data, setData] = useState<OperatorProductivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'ADMIN_PUSAT' || user?.role === 'admin';
  const canViewStats = isAdmin || hasPermission('operator.stats_view') || hasPermission('*');

  const fetchProductivity = async (silent = false) => {
    if (!canViewStats) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await apiService.getOperatorProductivity();
      if (res.status === 'success' && res.data) {
        setData(res.data);
      } else {
        toastError(res.message || 'Gagal memuat rekap aktivitas operator.');
      }
    } catch (err: any) {
      console.error('Error fetching operator productivity:', err);
      toastError(err.message || 'Terjadi kesalahan koneksi.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProductivity();
  }, [canViewStats]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase().trim();
    return data.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.position.toLowerCase().includes(q) ||
      item.department.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Aggregate KPI summary
  const summary = useMemo(() => {
    const totalOps = data.length;
    const totalHandled = data.reduce((acc, curr) => acc + curr.tickets_handled, 0);
    const totalActions = data.reduce((acc, curr) => acc + curr.total_actions, 0);
    const topOperator = data.length > 0 ? data[0] : null;
    const maxHandled = topOperator?.tickets_handled || 1;
    return { totalOps, totalHandled, totalActions, topOperator, maxHandled };
  }, [data]);

  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      toastError('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = ['Peringkat', 'Nama Operator', 'Email', 'Peran', 'Jabatan', 'Departemen', 'Tiket Ditangani', 'Total Tindakan Nyata', 'Tiket Diselesaikan', 'Aktivitas Terakhir'];
    const rows = filteredData.map((item, idx) => [
      idx + 1,
      `"${item.name.replace(/"/g, '""')}"`,
      item.email,
      item.role,
      `"${item.position.replace(/"/g, '""')}"`,
      `"${item.department.replace(/"/g, '""')}"`,
      item.tickets_handled,
      item.total_actions,
      item.tickets_resolved,
      item.last_active_at ? new Date(item.last_active_at).toLocaleString('id-ID') : '-'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Produktivitas_Operator_POSO_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('Laporan rekapitulasi CSV berhasil diunduh.');
  };

  const formatLastActive = (isoString: string | null) => {
    if (!isoString) return 'Belum ada aksi';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '-';
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // IF ACCESS DENIED (Standard Operator without operator.stats_view permission)
  if (!canViewStats) {
    return (
      <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-8 shadow-xs text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
          <ShieldAlert size={32} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-[#0F172A]">Akses Rekapitulasi Dibatasi (Khusus Atasan / Manager)</h3>
          <p className="text-sm text-[#64748B] leading-relaxed">
            Fitur rekapitulasi jumlah tiket dan statistik produktivitas operator hanya dapat diakses oleh akun Manager atau Atasan berwenang. Operator biasa tidak diizinkan melihat data rekapitulasi operator lainnya sesuai dengan matriks hak akses (*Role-Based Access Control*).
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
          <span>Izin yang dibutuhkan: <code className="font-mono text-[#0D5C75]">operator.stats_view</code></span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-[16px] border border-[#E2E8F0] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-[12px] bg-[#EAF4F8] border border-[#A5D1E1] flex items-center justify-center text-[#0D5C75] shadow-xs shrink-0">
            <Users size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-bold text-[#0F172A] tracking-tight">
                Rekap Aktivitas & Produktivitas Operator
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF4F8] text-[#0D5C75] border border-[#A5D1E1]">
                Khusus Manager / Atasan
              </span>
            </div>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Statistik kuantitatif jumlah tiket yang ditangani dan tindakan nyata (tanggapan & eskalasi) per operator.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchProductivity(true)}
            disabled={isRefreshing}
            className="h-10 px-3.5 rounded-[10px] border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-white text-[#0F172A] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#0D5C75]' : 'text-[#64748B]'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="h-10 px-4 rounded-[10px] bg-[#0D5C75] hover:bg-[#083342] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-98"
          >
            <Download size={14} />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-4.5 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[10px] bg-[#EFF6FF] text-[#0284C7] flex items-center justify-center shrink-0">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Operator</p>
            <p className="text-[24px] font-extrabold text-[#0F172A] font-mono leading-tight">{summary.totalOps}</p>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-4.5 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[10px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Tiket Ditangani</p>
            <p className="text-[24px] font-extrabold text-[#059669] font-mono leading-tight">{summary.totalHandled}</p>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-4.5 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[10px] bg-[#F5F3FF] text-[#8B5CF6] flex items-center justify-center shrink-0">
            <Activity size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Tindakan Nyata Tiket</p>
            <p className="text-[24px] font-extrabold text-[#8B5CF6] font-mono leading-tight">{summary.totalActions}</p>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-4.5 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[10px] bg-[#FFFBEB] text-[#D97706] flex items-center justify-center shrink-0">
            <Award size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider truncate">Operator Teraktif</p>
            <p className="text-[15px] font-extrabold text-[#0F172A] truncate">
              {summary.topOperator?.name || '-'}
            </p>
            <p className="text-[11px] font-semibold text-[#D97706]">
              {summary.topOperator ? `${summary.topOperator.tickets_handled} tiket ditangani` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
        {/* Table Search & Filter Bar */}
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama operator, email, atau jabatan..."
              className="w-full h-10 pl-10 pr-4 bg-white border border-[#CBD5E1] rounded-[10px] text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0D5C75] focus:ring-2 focus:ring-[#0D5C75]/15 outline-none transition-all"
            />
          </div>

          <div className="text-[12px] text-[#64748B] font-medium flex items-center gap-2">
            <span>Menampilkan <strong className="text-[#0F172A]">{filteredData.length}</strong> operator</span>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F1F5F9]/60 text-[#475569] font-bold text-[11px] uppercase tracking-wider select-none">
                <th className="py-3.5 px-4 w-14 text-center">Rank</th>
                <th className="py-3.5 px-4">Operator</th>
                <th className="py-3.5 px-4">Jabatan & Unit</th>
                <th className="py-3.5 px-4 text-center">Tiket Ditangani</th>
                <th className="py-3.5 px-4 text-center">Tindakan Nyata</th>
                <th className="py-3.5 px-4 text-center">Diselesaikan</th>
                <th className="py-3.5 px-4">Aktivitas Terakhir</th>
                <th className="py-3.5 px-4 w-36">Produktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-[#0D5C75]" />
                      <span className="text-xs font-semibold">Memuat data produktivitas operator...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Users size={32} className="text-[#CBD5E1] mb-1" />
                      <p className="text-sm font-bold text-[#0F172A]">Tidak ada data operator ditemukan</p>
                      <p className="text-xs text-[#94A3B8]">Coba sesuaikan kata kunci pencarian Anda.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((op, index) => {
                  const rank = index + 1;
                  const ratio = summary.maxHandled > 0 ? (op.tickets_handled / summary.maxHandled) * 100 : 0;
                  
                  return (
                    <motion.tr
                      key={op.user_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-[#F8FAFC] transition-colors"
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center">
                        {rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold font-mono text-xs border border-amber-300">
                            1
                          </span>
                        ) : rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-800 font-bold font-mono text-xs border border-slate-300">
                            2
                          </span>
                        ) : rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-800 font-bold font-mono text-xs border border-orange-300">
                            3
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-semibold text-[#64748B]">{rank}</span>
                        )}
                      </td>

                      {/* Operator Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#0D5C75] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {getInitials(op.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#0F172A] truncate hover:text-[#0D5C75] transition-colors">
                              {op.name}
                            </p>
                            <p className="text-[11px] text-[#64748B] truncate font-mono">
                              {op.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Position & Department */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-[#1E293B] text-[12px]">{op.position}</p>
                          <p className="text-[11px] text-[#64748B] truncate">{op.department}</p>
                        </div>
                      </td>

                      {/* Tickets Handled */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-extrabold font-mono bg-[#EAF4F8] text-[#0D5C75] border border-[#A5D1E1]">
                          {op.tickets_handled} tiket
                        </span>
                      </td>

                      {/* Total Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-[13px] text-[#475569]">
                          {op.total_actions}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] block">tindakan</span>
                      </td>

                      {/* Tickets Resolved */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-[13px] text-[#059669]">
                          {op.tickets_resolved}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] block">selesai</span>
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#475569]">
                          <Clock size={13} className="text-[#94A3B8] shrink-0" />
                          <span>{formatLastActive(op.last_active_at)}</span>
                        </div>
                      </td>

                      {/* Productivity Bar */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B]">
                            <span>Rasio</span>
                            <span>{Math.round(ratio)}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-[#0D5C75] to-[#199FB1]"
                              style={{ width: `${Math.max(5, Math.min(100, ratio))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] text-[11px] text-[#64748B] flex items-center justify-between flex-wrap gap-2">
          <span>
            ℹ️ Perhitungan produktivitas dihitung berdasarkan tindakan nyata (perubahan status, jawaban thread, resolusi tiket).
          </span>
          <span className="font-semibold text-slate-700">PRISMA POS Governance Matrix</span>
        </div>
      </div>
    </div>
  );
};
