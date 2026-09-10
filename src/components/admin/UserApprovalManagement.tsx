import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  RefreshCw, 
  AlertCircle,
  Building2,
  MapPin,
  Briefcase,
  Shield,
  ShieldAlert,
  ChevronRight,
  Filter,
  Check,
  X
} from 'lucide-react';
import { apiService } from '../../services/api';
import { RegistrationApproval, UserRole, DataScope } from '../../types';
import { useToast } from '../../context/ToastContext';

interface UserApprovalManagementProps {
  onApprovedCountChange?: (count: number) => void;
}

export const UserApprovalManagement: React.FC<UserApprovalManagementProps> = ({ onApprovedCountChange }) => {
  const [approvals, setApprovals] = useState<RegistrationApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  // Approval Modal State
  const [selectedApproval, setSelectedApproval] = useState<RegistrationApproval | null>(null);
  const [approveRole, setApproveRole] = useState<UserRole>('UPT_LUAR');
  const [approveScope, setApproveScope] = useState<DataScope>('OFFICE');
  const [isApproving, setIsApproving] = useState(false);

  // Reject Modal State
  const [rejectingApproval, setRejectingApproval] = useState<RegistrationApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const { success, error: toastError } = useToast();

  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getApprovals({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined
      });

      if (res.status === 'success' && res.data) {
        setApprovals(res.data);
        const pendingCount = res.data.filter(a => a.approval_status === 'PENDING').length;
        if (onApprovedCountChange) {
          onApprovedCountChange(pendingCount);
        }
        window.dispatchEvent(new CustomEvent('approvals-updated'));
      }
    } catch (err: any) {
      toastError('Gagal memuat daftar persetujuan registrasi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApprovals();
  };

  const handleOpenApproveModal = (approval: RegistrationApproval) => {
    setSelectedApproval(approval);
    setApproveRole((approval.role as UserRole) || 'UPT_LUAR');
    setApproveScope((approval.data_scope as DataScope) || 'OFFICE');
  };

  const handleConfirmApprove = async () => {
    if (!selectedApproval) return;
    setIsApproving(true);
    try {
      const res = await apiService.approveRegistration(selectedApproval.approval_id, {
        role: approveRole,
        data_scope: approveScope,
        region_id: selectedApproval.region_id,
        office_id: selectedApproval.office_id
      });

      if (res.status === 'success') {
        success(`Akun dinas untuk ${selectedApproval.name} (${selectedApproval.email}) berhasil disetujui & diaktifkan.`);
        setSelectedApproval(null);
        fetchApprovals();
      } else {
        toastError(res.message || 'Gagal menyetujui akun dinas.');
      }
    } catch (err: any) {
      toastError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleOpenRejectModal = (approval: RegistrationApproval) => {
    setRejectingApproval(approval);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingApproval) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      toastError('Harap berikan alasan penolakan yang jelas (minimal 5 karakter).');
      return;
    }

    setIsRejecting(true);
    try {
      const res = await apiService.rejectRegistration(rejectingApproval.approval_id, rejectionReason.trim());
      if (res.status === 'success') {
        success(`Permohonan akun untuk ${rejectingApproval.name} telah ditolak.`);
        setRejectingApproval(null);
        setRejectionReason('');
        fetchApprovals();
      } else {
        toastError(res.message || 'Gagal menolak akun.');
      }
    } catch (err: any) {
      toastError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsRejecting(false);
    }
  };

  const pendingTotal = approvals.filter(a => a.approval_status === 'PENDING').length;

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black text-[#0F172A] tracking-tight">
              Persetujuan Registrasi Staf Dinas
            </h2>
            {pendingTotal > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                {pendingTotal} Menunggu
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Verifikasi identitas dan penugasan cakupan data sebelum akun dinas diaktifkan.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex p-1 bg-[#F1F5F9] rounded-xl text-xs font-bold">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#0D5C75] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {st === 'PENDING' ? 'Menunggu' : st === 'APPROVED' ? 'Disetujui' : st === 'REJECTED' ? 'Ditolak' : 'Semua'}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchApprovals()}
            className="h-9 px-3 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#475569] hover:bg-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Muat Ulang"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#0D5C75]' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari berdasarkan nama pemohon, email, jabatan, atau kantor cabang..."
          className="w-full h-11 pl-10 pr-24 rounded-xl bg-white border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0D5C75] focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/15 transition-all"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#0D5C75] hover:bg-[#083342] text-white text-xs font-bold transition-all cursor-pointer"
        >
          Cari
        </button>
      </form>

      {/* Table List */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-[#0D5C75] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#64748B]">Memuat daftar permohonan registrasi...</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <UserCheck size={24} />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">Tidak Ada Data Permohonan</h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              {statusFilter === 'PENDING'
                ? 'Tidak ada permohonan akun yang sedang menunggu persetujuan.'
                : 'Tidak ditemukan permohonan yang sesuai dengan filter pencarian saat ini.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="py-3 px-4">Pemohon & Jabatan</th>
                  <th className="py-3 px-4">Tipe Akses</th>
                  <th className="py-3 px-4">Wilayah & Penempatan</th>
                  <th className="py-3 px-4">Tanggal Permohonan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-xs">
                {approvals.map((app) => {
                  const isPending = app.approval_status === 'PENDING';
                  const isApproved = app.approval_status === 'APPROVED';
                  const isRejected = app.approval_status === 'REJECTED';

                  return (
                    <tr key={app.approval_id} className="hover:bg-[#F8FAFC]/80 transition-colors">
                      {/* Pemohon */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0F172A] text-[13px]">{app.name}</div>
                        <div className="text-[11px] text-[#0D5C75] font-medium">{app.email}</div>
                        <div className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
                          {app.position && (
                            <span className="font-semibold text-slate-700">{app.position}</span>
                          )}
                          {app.phone_number && (
                            <span>• {app.phone_number}</span>
                          )}
                        </div>
                      </td>

                      {/* Tipe Akses */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[10px] ${
                          app.role === 'ADMIN_PUSAT'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : app.role === 'OPERATOR'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          <Shield size={10} />
                          <span>{app.role}</span>
                        </span>
                        <div className="text-[10px] text-[#64748B] mt-1 font-medium">
                          Scope: <strong>{app.data_scope || 'OWN'}</strong>
                        </div>
                      </td>

                      {/* Wilayah & Penempatan */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#0F172A]">
                          {app.region_name || 'Regional Belum Disetel'}
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          {app.office_name || (app.role === 'USER_REGIONAL' ? 'Kantor Regional' : 'Kantor Belum Dipilih')}
                        </div>
                        {app.nopen_kc && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Nopen: {app.nopen_kc}
                          </span>
                        )}
                      </td>

                      {/* Tanggal */}
                      <td className="py-3.5 px-4 text-[#64748B]">
                        <div>{new Date(app.requested_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(app.requested_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock size={11} />
                            <span>Menunggu Review</span>
                          </span>
                        )}
                        {isApproved && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={11} />
                              <span>Disetujui</span>
                            </span>
                            {app.reviewer_name && (
                              <div className="text-[9px] text-slate-400">Oleh: {app.reviewer_name}</div>
                            )}
                          </div>
                        )}
                        {isRejected && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full text-[10px] bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle size={11} />
                              <span>Ditolak</span>
                            </span>
                            {app.rejection_reason && (
                              <div className="text-[9px] text-rose-600 max-w-[140px] truncate mx-auto" title={app.rejection_reason}>
                                "{app.rejection_reason}"
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Tindakan */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenApproveModal(app)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                              title="Setujui dan Aktifkan Akun"
                            >
                              <Check size={13} />
                              <span>Setujui</span>
                            </button>
                            <button
                              onClick={() => handleOpenRejectModal(app)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                              title="Tolak Permohonan"
                            >
                              <X size={13} />
                              <span>Tolak</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Selesai</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: APPROVE CONFIRMATION ================= */}
      <AnimatePresence>
        {selectedApproval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-[#E2E8F0]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Setujui Akun Dinas</h3>
                  <p className="text-xs text-[#64748B]">Verifikasi penugasan role dan scope pemohon</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1.5">
                <p><strong>Nama:</strong> {selectedApproval.name}</p>
                <p><strong>Email:</strong> {selectedApproval.email}</p>
                <p><strong>Jabatan:</strong> {selectedApproval.position || '-'}</p>
                <p><strong>Regional:</strong> {selectedApproval.region_name || '-'}</p>
                <p><strong>Kantor:</strong> {selectedApproval.office_name || '-'}</p>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Role yang Diberikan
                  </label>
                  <select
                    value={approveRole}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setApproveRole(r);
                      if (r === 'UPT_LUAR') setApproveScope('OFFICE');
                      else if (r === 'PETUGAS_UPT' || r === 'ADMIN') setApproveScope('GLOBAL');
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs font-semibold focus:border-[#0D5C75] focus:outline-none"
                  >
                    <option value="UPT_LUAR">UPT_LUAR (Pelapor / Staf Unit Kantor Cabang / Regional)</option>
                    <option value="PETUGAS_UPT">PETUGAS_UPT (Petugas Helpdesk UPT Pusat)</option>
                    <option value="ADMIN">ADMIN (Super Administrator)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Cakupan Data (Data Scope)
                  </label>
                  <select
                    value={approveScope}
                    onChange={(e) => setApproveScope(e.target.value as DataScope)}
                    className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-xs font-semibold focus:border-[#0D5C75] focus:outline-none"
                  >
                    <option value="OFFICE">OFFICE (Tiket Akun & Kantor Sendiri - UPT Luar)</option>
                    <option value="GLOBAL">GLOBAL (Seluruh Tiket Nasional - Petugas UPT & Admin)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setSelectedApproval(null)}
                  disabled={isApproving}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApprove}
                  disabled={isApproving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{isApproving ? 'Menyetujui...' : 'Setujui & Aktifkan'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: REJECT CONFIRMATION ================= */}
      <AnimatePresence>
        {rejectingApproval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-[#E2E8F0]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Tolak Permohonan Akun</h3>
                  <p className="text-xs text-[#64748B]">Pemohon tidak akan dapat masuk ke sistem PRISMA POS</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                Menolak permohonan akun untuk <strong>{rejectingApproval.name}</strong> ({rejectingApproval.email}).
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Alasan Penolakan <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Cth: Data NIP / Penempatan tidak sesuai dengan sistem kepegawaian dinas."
                  className="w-full p-3 rounded-xl border border-[#CBD5E1] text-xs focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/15"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setRejectingApproval(null)}
                  disabled={isRejecting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <X size={14} />
                  <span>{isRejecting ? 'Menolak...' : 'Konfirmasi Tolak'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserApprovalManagement;
