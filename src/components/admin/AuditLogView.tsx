import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  RefreshCw, 
  Clock, 
  User, 
  KeyRound, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileText,
  Filter,
  Globe
} from 'lucide-react';
import { apiService } from '../../services/api';
import { AuditLogItem } from '../../types';
import { useToast } from '../../context/ToastContext';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { error: toastError } = useToast();

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getAuditLog({
        limit: 100,
        action: selectedAction === 'ALL' ? undefined : selectedAction
      });

      if (res.status === 'success' && res.data) {
        setLogs(res.data);
      }
    } catch (err: any) {
      toastError('Gagal memuat log audit.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedAction]);

  const filteredLogs = logs.filter(l => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.actor_name && l.actor_name.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.description && l.description.toLowerCase().includes(q)) ||
      (l.entity_id && l.entity_id.toLowerCase().includes(q)) ||
      (l.ip_address && l.ip_address.toLowerCase().includes(q))
    );
  });

  const getActionBadge = (action: string) => {
    if (action.startsWith('AUTH_') || action.startsWith('MFA_')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (action.includes('APPROVE')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (action.includes('REJECT') || action.includes('DELETE') || action.includes('SUSPEND')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (action.includes('OVERRIDE') || action.includes('ROLE') || action.includes('PERMISSION')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="space-y-5 text-[#0F172A] font-sans">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0D5C75] text-white flex items-center justify-center font-bold">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#0F172A] tracking-tight">
                Log Audit Forensik & Keamanan
              </h2>
              <p className="text-xs text-[#64748B]">
                Pencatatan real-time seluruh tindakan sistem, autentikasi, persetujuan dan izin.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="h-9 px-3 rounded-xl border border-[#CBD5E1] text-xs font-semibold text-[#0F172A] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#0D5C75] cursor-pointer"
          >
            <option value="ALL">Semua Aksi</option>
            <option value="AUTH_LOGIN">Login Berhasil</option>
            <option value="AUTH_LOGIN_FAILED">Login Gagal</option>
            <option value="MFA_VERIFIED">MFA Terverifikasi</option>
            <option value="REGISTRATION_REQUESTED">Permohonan Registrasi</option>
            <option value="REGISTRATION_APPROVED">Persetujuan Registrasi</option>
            <option value="REGISTRATION_REJECTED">Penolakan Registrasi</option>
            <option value="USER_OVERRIDE_UPDATED">Perubahan Izin Granular</option>
            <option value="USER_ROLE_UPDATED">Perubahan Role / Scope</option>
            <option value="USER_MFA_RESET">Reset MFA Pengguna</option>
            <option value="USER_SUSPENDED">Akun Disuspend</option>
            <option value="USER_ACTIVATED">Akun Diaktifkan</option>
            <option value="TICKET_STATUS_CHANGED">Perubahan Status Tiket</option>
          </select>

          <button
            onClick={() => fetchLogs()}
            className="h-9 px-3 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#475569] hover:bg-[#F8FAFC] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Muat Ulang"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#0D5C75]' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari berdasarkan nama pelaku, deskripsi, entitas ID, atau IP address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0D5C75] focus:ring-2 focus:ring-[#0D5C75]/15"
        />
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-700 font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Waktu</th>
              <th className="py-3.5 px-4">Pelaku (Actor)</th>
              <th className="py-3.5 px-4">Aktivitas (Action)</th>
              <th className="py-3.5 px-4">Deskripsi / Detail</th>
              <th className="py-3.5 px-4">Entitas Terkait</th>
              <th className="py-3.5 px-4">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0D5C75]" />
                  Memuat catatan audit log forensik...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-slate-400">
                  Tidak ada catatan audit yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.log_id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Timestamp */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-[#64748B]">
                    <div className="font-mono font-medium text-slate-800">
                      {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
                    </div>
                  </td>

                  {/* Actor */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#0F172A]">{log.actor_name || 'System / Anonymous'}</div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                      {log.actor_role || 'GUEST'}
                    </span>
                  </td>

                  {/* Action Badge */}
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center font-mono font-bold text-[10px] px-2 py-0.5 rounded border ${getActionBadge(log.action)}`}>
                      {log.action}
                    </span>
                  </td>

                  {/* Description */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="text-slate-800 line-clamp-2" title={log.description || log.details}>
                      {log.description || log.details || '-'}
                    </div>
                  </td>

                  {/* Entity */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {log.entity_type ? (
                      <div className="text-[11px]">
                        <span className="text-slate-400 uppercase text-[9px] font-bold block">{log.entity_type}</span>
                        <code className="text-[11px] font-mono font-semibold text-[#0D5C75]">{log.entity_id || '-'}</code>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* IP Address */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                    <div className="flex items-center gap-1">
                      <Globe size={11} className="text-slate-400" />
                      <span>{log.ip_address || '127.0.0.1'}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogView;
