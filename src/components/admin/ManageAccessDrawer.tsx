import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Save, 
  RefreshCw, 
  Building2, 
  MapPin, 
  Check, 
  Sliders, 
  Lock,
  Sparkles,
  Info
} from 'lucide-react';
import { User, UserRole, DataScope, Permission, Region, Office } from '../../types';
import { apiService } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ManageAccessDrawerProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManageAccessDrawer: React.FC<ManageAccessDrawerProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [role, setRole] = useState<UserRole>('UPT_LUAR');
  const [dataScope, setDataScope] = useState<DataScope>('OFFICE');
  const [regionId, setRegionId] = useState<string>('');
  const [officeId, setOfficeId] = useState<string>('');
  const [position, setPosition] = useState<string>('');

  // Master Data
  const [regions, setRegions] = useState<Region[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [overrides, setOverrides] = useState<Record<number, 'ALLOW' | 'DENY' | 'INHERIT'>>({});

  const { success, error: toastError } = useToast();

  // Load User Data & Permissions
  useEffect(() => {
    if (!user || !isOpen) return;

    setRole(user.role || 'UPT_LUAR');
    setDataScope(user.data_scope || (user.role === 'UPT_LUAR' ? 'OFFICE' : 'GLOBAL'));
    setRegionId(user.region_id || '');
    setOfficeId(user.office_id || '');
    setPosition(user.position || user.role_title || '');

    const fetchData = async () => {
      setLoading(true);
      try {
        const [permRes, regRes, offRes] = await Promise.all([
          apiService.getUserPermissions(user.user_id),
          apiService.getRegions(),
          user.region_id ? apiService.getOffices(user.region_id) : apiService.getOffices()
        ]);

        if (permRes.status === 'success' && permRes.data) {
          setPermissions(permRes.data.permissions || []);
          const initialOverrides: Record<number, 'ALLOW' | 'DENY' | 'INHERIT'> = {};
          permRes.data.permissions.forEach((p) => {
            if (p.is_override && p.effect) {
              initialOverrides[p.id] = p.effect;
            } else {
              initialOverrides[p.id] = 'INHERIT';
            }
          });
          setOverrides(initialOverrides);
        }

        if (regRes.status === 'success' && regRes.data) {
          setRegions(regRes.data);
        }

        if (offRes.status === 'success' && offRes.data) {
          setOffices(offRes.data);
        }
      } catch (err) {
        toastError('Gagal memuat konfigurasi hak akses pengguna.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, isOpen]);

  // Handle Region Change
  const handleRegionChange = async (newRegionId: string) => {
    setRegionId(newRegionId);
    setOfficeId('');
    if (!newRegionId) {
      setOffices([]);
      return;
    }
    try {
      const res = await apiService.getOffices(newRegionId);
      if (res.status === 'success' && res.data) {
        setOffices(res.data);
        if (res.data.length > 0) {
          setOfficeId(res.data[0].office_id);
        }
      }
    } catch {
      // Ignore
    }
  };

  // Tri-state toggle handler
  const handleOverrideChange = (permissionId: number, value: 'ALLOW' | 'DENY' | 'INHERIT') => {
    setOverrides(prev => ({ ...prev, [permissionId]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Update User Identity, Role, Scope, Region, Office
      const roleUpdateRes = await apiService.updateUserRole({
        target_user_id: user.user_id,
        role,
        new_role: role,
        data_scope: dataScope,
        region_id: regionId || undefined,
        office_id: officeId || undefined,
        position
      });

      if (roleUpdateRes.status !== 'success') {
        toastError(roleUpdateRes.message || 'Gagal memperbarui peranan pengguna.');
        setSaving(false);
        return;
      }

      // 2. Update Granular Overrides
      const overridePayload = Object.entries(overrides).map(([pId, effect]) => ({
        permission_id: Number(pId),
        effect
      }));

      const permRes = await apiService.updateUserPermissions(user.user_id, overridePayload);
      if (permRes.status === 'success') {
        success(`Hak akses pengguna ${user.name} berhasil diperbarui.`);
        onSuccess();
        onClose();
      } else {
        toastError(permRes.message || 'Gagal menyimpan izin granular.');
      }
    } catch (err: any) {
      toastError(err.message || 'Terjadi kesalahan sistem saat menyimpan izin.');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  const MODULE_LABELS: Record<string, string> = {
    ticket: 'Manajemen Tiket & Pengaduan',
    user: 'Manajemen Akun & Staf',
    role: 'Otorisasi & Manajemen Peran',
    audit_log: 'Log Audit & Forensik',
    system: 'Konfigurasi Sistem & Database',
    monitoring: 'Laporan, SLA & Monitoring'
  };

  return (
    <AnimatePresence>
      {isOpen && user && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-xs z-50"
          />

          {/* Slide-over Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden border-l border-[#E2E8F0]"
          >
            {/* Drawer Header */}
            <div className="h-18 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0D5C75] text-white flex items-center justify-center font-black shadow-sm">
                  <Sliders size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#0F172A] tracking-tight">
                    Kelola Hak Akses & Cakupan Data
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    {user.name} ({user.email})
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {loading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-[#0D5C75] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-[#64748B]">Memuat data izin dan peran...</p>
                </div>
              ) : (
                <>
                  {/* Section 1: Role & Data Scope */}
                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
                    <h3 className="text-xs font-bold text-[#0D5C75] uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={14} />
                      <span>Peran Pokok & Cakupan Data (Data Scope)</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Role Dropdown */}
                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                          Peran Sistem (Role)
                        </label>
                        <select
                          value={role}
                          onChange={(e) => {
                            const r = e.target.value as UserRole;
                            setRole(r);
                            if (r === 'ADMIN' || r === 'PETUGAS_UPT' || r === 'ADMIN_PUSAT' || r === 'OPERATOR') setDataScope('GLOBAL');
                            else if (r === 'UPT_LUAR') setDataScope('OFFICE');
                          }}
                          className="w-full h-10 px-3 rounded-xl border border-[#CBD5E1] text-xs font-bold text-[#0F172A] bg-white focus:outline-none focus:border-[#0D5C75] focus:ring-2 focus:ring-[#0D5C75]/15 transition-all cursor-pointer"
                        >
                          <option value="ADMIN">ADMIN (Super Administrator - Full Control)</option>
                          <option value="PETUGAS_UPT">PETUGAS_UPT (Petugas Helpdesk UPT Pusat)</option>
                          <option value="UPT_LUAR">UPT_LUAR (Pelapor / Staf Unit Kantor Cabang / Regional)</option>
                        </select>
                      </div>

                      {/* Data Scope Dropdown */}
                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                          Cakupan Data (Data Scope)
                        </label>
                        <select
                          value={dataScope}
                          onChange={(e) => setDataScope(e.target.value as DataScope)}
                          className="w-full h-10 px-3 rounded-xl border border-[#CBD5E1] text-xs font-bold text-[#0F172A] bg-white focus:outline-none focus:border-[#0D5C75] focus:ring-2 focus:ring-[#0D5C75]/15 transition-all cursor-pointer"
                        >
                          <option value="GLOBAL">GLOBAL (Semua regional & cabang)</option>
                          <option value="REGIONAL">REGIONAL (Hanya cabang di regionalnya)</option>
                          <option value="OFFICE">OFFICE (Hanya tiket kantor cabangnya)</option>
                          <option value="OWN">OWN (Hanya tiket miliknya sendiri)</option>
                        </select>
                      </div>
                    </div>

                    {/* Regional & Office Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                          Wilayah Regional
                        </label>
                        <select
                          value={regionId}
                          onChange={(e) => handleRegionChange(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-[#CBD5E1] text-xs font-medium text-[#0F172A] bg-white focus:outline-none focus:border-[#0D5C75] cursor-pointer"
                        >
                          <option value="">-- Tanpa Regional / Pusat --</option>
                          {regions.map((reg) => (
                            <option key={reg.region_id} value={reg.region_id}>
                              {reg.code} - {reg.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                          Kantor Penempatan (KCU/KC)
                        </label>
                        <select
                          value={officeId}
                          onChange={(e) => setOfficeId(e.target.value)}
                          disabled={!regionId}
                          className="w-full h-10 px-3 rounded-xl border border-[#CBD5E1] text-xs font-medium text-[#0F172A] bg-white focus:outline-none focus:border-[#0D5C75] disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                        >
                          <option value="">-- Tanpa Kantor Spesifik --</option>
                          {offices.map((off) => (
                            <option key={off.office_id} value={off.office_id}>
                              [{off.type}] {off.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Granular Permissions Matrix */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-black text-[#0F172A] tracking-tight">
                          Matriks Izin Granular (24 Permissions)
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Formula: <code className="text-[#0D5C75] font-mono font-bold">User Override &gt; Role Baseline &gt; Deny</code>
                        </p>
                      </div>
                      <div className="text-[11px] text-[#64748B] flex items-center gap-2">
                        <span className="flex items-center gap-1 font-semibold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" /> ALLOW
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-rose-700">
                          <span className="w-2 h-2 rounded-full bg-rose-500" /> DENY
                        </span>
                      </div>
                    </div>

                    {/* Permissions Grouped by Module */}
                    <div className="space-y-4">
                      {Object.entries(groupedPermissions).map(([mod, perms]) => (
                        <div key={mod} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                          <div className="px-4 py-2.5 bg-[#F1F5F9] border-b border-[#E2E8F0] flex items-center justify-between">
                            <span className="text-xs font-bold text-[#0F172A]">
                              {MODULE_LABELS[mod] || mod.toUpperCase()}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-[#64748B] border border-[#E2E8F0]">
                              {perms.length} izin
                            </span>
                          </div>

                          <div className="divide-y divide-[#F1F5F9]">
                            {perms.map((p) => {
                              const currentSetting = overrides[p.id] || 'INHERIT';
                              const isInherit = currentSetting === 'INHERIT';
                              const isAllow = currentSetting === 'ALLOW';
                              const isDeny = currentSetting === 'DENY';

                              return (
                                <div key={p.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] transition-colors">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-[#0F172A]">{p.name}</span>
                                      <code className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                        {p.code}
                                      </code>
                                    </div>
                                    {p.description && (
                                      <p className="text-[11px] text-[#64748B] mt-0.5">{p.description}</p>
                                    )}
                                  </div>

                                  {/* Tri-state Button Group */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOverrideChange(p.id, 'INHERIT')}
                                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                                        isInherit
                                          ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                      title="Mengikuti pengaturan bawaan Role"
                                    >
                                      INHERIT
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOverrideChange(p.id, 'ALLOW')}
                                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                                        isAllow
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                          : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                                      }`}
                                      title="Paksa izinkan untuk pengguna ini"
                                    >
                                      ALLOW
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOverrideChange(p.id, 'DENY')}
                                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                                        isDeny
                                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                          : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                                      }`}
                                      title="Paksa tolak untuk pengguna ini"
                                    >
                                      DENY
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="h-18 px-6 border-t border-[#E2E8F0] flex items-center justify-between bg-white flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="px-6 py-2.5 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-xs font-bold shadow-md shadow-[#0D5C75]/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={15} />
                <span>{saving ? 'Menyimpan...' : 'Simpan Hak Akses'}</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ManageAccessDrawer;
