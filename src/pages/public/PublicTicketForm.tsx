import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { TicketPriority, Region, Office } from '../../types';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { 
  Send, 
  AlertCircle, 
  CheckCircle, 
  ArrowLeft, 
  Paperclip, 
  Trash2, 
  Upload,
  Copy,
  Check,
  ChevronDown,
  File,
  Lightbulb,
  Headphones,
  RotateCcw,
  Sparkles,
  Eye,
  Clock
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';

// =================================================================================================
// DATASET CASCADING DROPDOWN (DEPARTMENT -> TOPIK KENDALA)
// =================================================================================================
export interface DepartmentConfig {
  id: string;
  name: string;
  code: string;
  uptUnit: string;
  topics: {
    id: string;
    label: string;
  }[];
  tip: string;
}

export const CASCADING_DEPARTMENTS: DepartmentConfig[] = [
  {
    id: 'pengendalian_operasi',
    name: 'Pengendalian Operasi',
    code: 'OPS',
    uptUnit: 'UPT Pengendalian Operasi & Transportasi',
    topics: [
      { id: 'first_mile', label: 'First Mile (Pick-up & Loket)' },
      { id: 'mid_mile', label: 'Mid Mile (Sortir & Hub Sentral)' },
      { id: 'last_mile', label: 'Last Mile (Antaran Kurir)' },
      { id: 'armada_logistik', label: 'Armada & Kendaraan Operasional' },
    ],
    tip: 'Sertakan nomor kantong/resi paket, barcode manifesto, atau nomor polisi kendaraan yang mengalami kendala operasional.'
  },
  {
    id: 'cgs',
    name: 'Corporate General Services (CGS)',
    code: 'CGS',
    uptUnit: 'UPT Sarana & Prasarana (CGS)',
    topics: [
      { id: 'sarana_gedung', label: 'Sarana & Fisik Gedung Kantor' },
      { id: 'listrik_genset_ac', label: 'Listrik, Genset, & AC Ruangan' },
      { id: 'atk_perlengkapan', label: 'ATK & Perlengkapan Operasional' },
      { id: 'kebersihan_sanitasi', label: 'Kebersihan & Sanitasi Kantor' },
    ],
    tip: 'Cantumkan nomor lantai/ruangan spesifik dan foto kondisi fasilitas fisik yang membutuhkan perbaikan.'
  },
  {
    id: 'postal_security',
    name: 'Postal Security',
    code: 'SEC',
    uptUnit: 'UPT Postal Security & Keamanan',
    topics: [
      { id: 'investigasi_paket', label: 'Investigasi Paket Rusak / Hilang' },
      { id: 'cctv_akses_gedung', label: 'CCTV & Akses Pintu Masuk Gedung' },
      { id: 'pelanggaran_sop', label: 'Pelanggaran SOP & Integritas' },
      { id: 'insiden_keamanan', label: 'Laporan Insiden Keamanan' },
    ],
    tip: 'Laporan insiden keamanan akan ditangani secara rahasia dan langsung diteruskan ke tim investigasi Postal Security.'
  },
  {
    id: 'quality_control',
    name: 'Quality Control',
    code: 'QC',
    uptUnit: 'UPT Quality Control & Audit SLA',
    topics: [
      { id: 'audit_sla', label: 'Audit Kepatuhan SLA Layanan' },
      { id: 'volumetrik_berat', label: 'Volumetrik & Ketepatan Berat Paket' },
      { id: 'cacat_layanan', label: 'Cacat Layanan & Komplain Pelanggan' },
    ],
    tip: 'Sertakan data perbandingan waktu manifesto atau nota selisih timbangan untuk mempercepat proses audit QC.'
  },
  {
    id: 'it_sistem_informasi',
    name: 'TI & Sistem Informasi',
    code: 'IT',
    uptUnit: 'UPT TI & Sistem Informasi',
    topics: [
      { id: 'jaringan_vpn_internet', label: 'Jaringan Wi-Fi, LAN, & VPN' },
      { id: 'error_aplikasi_poso', label: 'Aplikasi PRISMA POS & Core System' },
      { id: 'kendala_hardware', label: 'Hardware, Komputer, & Printer Barcode' },
      { id: 'reset_password_akses', label: 'Akun Email Dinas & Akses SSO' },
    ],
    tip: 'Sertakan screenshot pesan error yang muncul, URL/layanan yang terdampak, atau nomor aset stiker perangkat.'
  }
];

const priorityConfig: Record<TicketPriority, { label: string; desc: string; color: string; bg: string; border: string }> = {
  Low: { label: 'Rendah', desc: 'Tidak mengganggu aktivitas utama, pemeliharaan rutin', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
  Medium: { label: 'Sedang', desc: 'Mengganggu sebagian aktivitas, diselesaikan sesuai SOP', color: '#0284C7', bg: '#EFF6FF', border: '#BAE6FD' },
  High: { label: 'Tinggi', desc: 'Mengganggu aktivitas penting, berdampak ke banyak unit', color: '#F58A61', bg: '#FFF7ED', border: '#FFEDD5' },
  Urgent: { label: 'Urgent', desc: 'Sistem/operasional kritis lumpuh, butuh penanganan segera', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
};

interface AttachedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  dataUrl?: string;
}

export const PublicTicketForm: React.FC = () => {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error, info } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backDestination = isStaff ? '/dashboard' : user ? '/my-tickets' : '/login';
  const backLabel = isStaff 
    ? 'Kembali ke Dashboard' 
    : user 
    ? 'Kembali ke Tiket Saya' 
    : 'Kembali ke Halaman Masuk';

  // Form State
  const [requesterName, setRequesterName] = useState(user?.name || '');
  const [requesterEmail, setRequesterEmail] = useState(user?.email || '');
  const [requesterNip, setRequesterNip] = useState(user?.nip || user?.nopen_kc || '');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(CASCADING_DEPARTMENTS[0].id);
  const [selectedTopic, setSelectedTopic] = useState<string>(CASCADING_DEPARTMENTS[0].topics[0].label);
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [regions, setRegions] = useState<Region[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(user?.region_id || 'REG-03');
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(user?.office_id || 'OFC-KCU-BDG');
  const [workLocation, setWorkLocation] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Fetch Regions & Offices
  useEffect(() => {
    apiService.getRegions().then(res => {
      if (res.status === 'success' && res.data) {
        setRegions(res.data);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedRegionId) {
      apiService.getOffices(selectedRegionId).then(res => {
        if (res.status === 'success' && res.data) {
          setOffices(res.data);
          if (!res.data.some(o => o.office_id === selectedOfficeId)) {
            setSelectedOfficeId(res.data[0]?.office_id || '');
          }
        }
      }).catch(() => {});
    }
  }, [selectedRegionId]);

  // Pre-fill user data
  useEffect(() => {
    if (user) {
      setRequesterName(user.name);
      setRequesterEmail(user.email);
      if (user.region_id) setSelectedRegionId(user.region_id);
      if (user.office_id) setSelectedOfficeId(user.office_id);
    }
  }, [user]);

  // Query parameter pre-selection
  useEffect(() => {
    const catParam = searchParams.get('category');
    if (catParam) {
      const match = CASCADING_DEPARTMENTS.find(d => 
        d.name.toLowerCase().includes(catParam.toLowerCase()) || 
        catParam.toLowerCase().includes(d.name.toLowerCase())
      );
      if (match) {
        setSelectedDepartmentId(match.id);
        if (match.topics.length > 0) {
          setSelectedTopic(match.topics[0].label);
        }
      }
    }
  }, [searchParams]);

  const currentDepartment = CASCADING_DEPARTMENTS.find(d => d.id === selectedDepartmentId) || CASCADING_DEPARTMENTS[0];

  const regionOptions = useMemo(
    () =>
      regions.map((reg) => ({
        value: reg.region_id,
        label: reg.name,
        subLabel: `Kode: ${reg.code}`,
        badge: reg.code,
      })),
    [regions]
  );

  const officeOptions = useMemo(
    () =>
      offices.map((off) => ({
        value: off.office_id,
        label: off.name,
        subLabel: `Kode: ${off.code}`,
        badge: off.type || 'KANTOR',
      })),
    [offices]
  );

  const handleDepartmentChange = (newDeptId: string) => {
    setSelectedDepartmentId(newDeptId);
    const dept = CASCADING_DEPARTMENTS.find(d => d.id === newDeptId);
    if (dept && dept.topics.length > 0) {
      setSelectedTopic(dept.topics[0].label);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const compressImage = (file: File): Promise<{ dataUrl: string; size: string }> => {
    return new Promise((resolve) => {
      // If not an image (e.g. PDF/document), read directly
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            dataUrl: (e.target?.result as string) || '',
            size: formatFileSize(file.size)
          });
        };
        reader.onerror = () => {
          resolve({ dataUrl: '', size: '0 B' });
        };
        reader.readAsDataURL(file);
        return;
      }

      // If it is an image, compress & resize to max 1600px dimension and JPEG quality 0.82
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = (e.target?.result as string) || '';
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            const approxBytes = Math.round((compressed.length * 3) / 4);
            resolve({
              dataUrl: compressed,
              size: formatFileSize(approxBytes)
            });
          } else {
            resolve({
              dataUrl: rawDataUrl,
              size: formatFileSize(file.size)
            });
          }
        };
        img.onerror = () => {
          resolve({
            dataUrl: rawDataUrl,
            size: formatFileSize(file.size)
          });
        };
        img.src = rawDataUrl;
      };
      reader.onerror = () => {
        resolve({ dataUrl: '', size: '0 B' });
      };
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > 20 * 1024 * 1024) {
        error(`Berkas "${file.name}" melebihi batas 20MB.`);
        continue;
      }

      const { dataUrl, size } = await compressImage(file);
      if (!dataUrl) continue;

      setAttachments(prev => [
        ...prev,
        {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: size,
          type: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
          dataUrl: dataUrl
        }
      ]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleCopyTicketId = () => {
    if (createdTicketId) {
      navigator.clipboard.writeText(createdTicketId);
      setCopiedId(true);
      info(`ID Tiket #${createdTicketId} disalin.`);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requesterName.trim() || !requesterEmail.trim() || !selectedTopic || !subject.trim() || !description.trim() || !workLocation.trim()) {
      setErrorMsg('Harap lengkapi semua kolom bertanda bintang (*) yang wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await apiService.createTicket({
        subject: subject.trim(),
        category: `${currentDepartment.name}: ${selectedTopic}`,
        department: currentDepartment.name,
        topic: selectedTopic,
        location: workLocation.trim(),
        region_id: selectedRegionId,
        office_id: selectedOfficeId,
        description: description.trim(),
        priority,
        requester_email: requesterEmail.trim().toLowerCase(),
        requester_name: requesterName.trim() || 'Pelapor',
        requester_nip: requesterNip.trim() || user?.nip || undefined,
        assigned_upt: currentDepartment.uptUnit,
        attachments: attachments.map(a => ({
          name: a.name,
          size: a.size,
          type: a.type,
          dataUrl: a.dataUrl
        }))
      });

      if (res.status === 'success' && res.data) {
        const ticketIdFromRes = (res.data as any).ticket_id || (res.data as any).ticket?.ticket_id || (res.data as any).id;
        if (ticketIdFromRes) {
          setCreatedTicketId(ticketIdFromRes);
          success(`Tiket #${ticketIdFromRes} berhasil diajukan!`);
        } else {
          setErrorMsg('Gagal mendapatkan nomor tiket dari server.');
        }
      } else {
        setErrorMsg(res.message || 'Gagal mengirimkan laporan tiket.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi gangguan koneksi sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS VIEW MATCHING FIGMA
  if (createdTicketId) {
    return (
      <div className="min-h-screen bg-[#F4F7F9] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[24px] shadow-xl border border-[#E2E8F0] p-8 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-[#ECFDF5] flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="text-[#10B981]" size={40} />
          </div>
          <h2 className="text-[24px] font-bold text-[#0F172A] mb-2">Tiket Berhasil Diajukan!</h2>
          <p className="text-[14px] text-[#64748B] mb-6">
            Laporan kendala Anda telah tercatat dan masuk ke antrean triase unit teknis terkait sesuai kebijakan SLA.
          </p>

          <div className="bg-[#F8FAFC] rounded-[12px] border border-[#E2E8F0] p-4 mb-6">
            <p className="text-[12px] text-[#64748B] mb-1">ID Tiket Anda</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-[18px] font-bold text-[#0D5C75]">#{createdTicketId}</span>
              <button
                onClick={handleCopyTicketId}
                className="p-1.5 rounded-[6px] text-[#94A3B8] hover:text-[#0D5C75] hover:bg-[#EAF4F8] transition-all cursor-pointer"
                title="Salin ID"
              >
                {copiedId ? <Check size={16} className="text-[#10B981]" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">Disposisi: <strong className="text-slate-800">{currentDepartment.uptUnit}</strong></p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to={`/track?id=${createdTicketId}`}
              className="flex items-center justify-center gap-2 h-11 rounded-[10px] bg-[#0D5C75] text-white text-[14px] font-semibold hover:bg-[#083342] transition-colors"
            >
              Pantau Status Tiket Sekarang
            </Link>
            <button
              onClick={() => {
                setCreatedTicketId(null);
                setSubject('');
                setDescription('');
                setWorkLocation('');
                setAttachments([]);
              }}
              className="flex items-center justify-center gap-2 h-11 rounded-[10px] border border-[#E2E8F0] text-[#64748B] text-[14px] font-semibold hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              Ajukan Tiket Lain
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-[#0F172A] font-sans pb-20 selection:bg-[#0D5C75] selection:text-white">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        className="hidden"
      />

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-[#E2E8F0]/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to={backDestination} className="flex items-center gap-2 text-xs font-semibold text-[#64748B] hover:text-[#0D5C75] transition-colors">
            <ArrowLeft size={15} />
            <span>{backLabel}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] bg-slate-100 p-0.5 border border-slate-200 flex items-center justify-center">
              <img src="/prisma-pos-logo.png" alt="PRISMA POS Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xs font-bold text-[#0D5C75] bg-[#EAF4F8] px-3 py-1 rounded-full border border-[#A5D1E1]/40">
              PRISMA POS — Formulir Pengaduan
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-bold text-[#0F172A]">Ajukan Tiket Pengaduan Baru</h1>
          <p className="text-[14px] text-[#64748B] mt-1">
            Lengkapi formulir di bawah ini agar operator dan teknisi UPT dapat segera menindaklanjuti kendala Anda
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-[12px] bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 2-Column Grid: Form on Left + Live Preview & Tip on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Form (2 cols) */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white rounded-[16px] border border-[#E2E8F0]/80 shadow-[0_2px_8px_rgba(15,23,42,0.06)] p-6 space-y-5">
            
            {/* Requester Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                  Nama Lengkap Pelapor <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama pelapor dinas"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[10px] border border-[#E2E8F0] text-[14px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                  NIP / NOPEN Dinas
                </label>
                <input
                  type="text"
                  placeholder="NIP / Nopen (Cth: 1994...)"
                  value={requesterNip}
                  onChange={(e) => setRequesterNip(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[10px] border border-[#E2E8F0] text-[14px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] transition-all"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                  Email Resmi <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="nama@posindonesia.co.id"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-[10px] border border-[#E2E8F0] text-[14px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] transition-all"
                />
              </div>
            </div>

            {/* Department & Topic Cascading */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                  Bidang Layanan / Department <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full h-11 px-3.5 pr-8 rounded-[10px] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] appearance-none transition-all cursor-pointer"
                  >
                    {CASCADING_DEPARTMENTS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                  Topik Spesifik Kendala <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full h-11 px-3.5 pr-8 rounded-[10px] border border-[#E2E8F0] text-[13px] font-medium text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] appearance-none transition-all cursor-pointer"
                  >
                    {currentDepartment.topics.map(t => (
                      <option key={t.id} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Visual Priority Selector (4 Colored Buttons from Figma) */}
            <div>
              <label className="block text-[13px] font-semibold text-[#0F172A] mb-2">
                Tingkat Urgensi / Prioritas <span className="text-[#EF4444]">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {(['Low', 'Medium', 'High', 'Urgent'] as TicketPriority[]).map((lvl) => {
                  const cfg = priorityConfig[lvl];
                  const isSelected = priority === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPriority(lvl)}
                      className={`p-3 rounded-[12px] border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-[#0D5C75] shadow-sm'
                          : 'hover:border-[#94A3B8]'
                      }`}
                      style={{
                        backgroundColor: cfg.bg,
                        borderColor: isSelected ? '#0D5C75' : cfg.border
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <span className="text-[13px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] leading-snug">{cfg.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wilayah Regional & Kantor Cabang / Kantor Pos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0]">
              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                  Wilayah Regional Pos <span className="text-[#EF4444]">*</span>
                </label>
                <SearchableSelect
                  options={regionOptions}
                  value={selectedRegionId}
                  onChange={(val) => setSelectedRegionId(val)}
                  placeholder="Pilih Wilayah Regional..."
                  searchPlaceholder="Cari nama atau kode regional..."
                  required
                />
                <p className="text-[11px] text-[#64748B] mt-1">Menentukan regional pemantau tiket</p>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                  Kantor Cabang / Kantor Pos <span className="text-[#EF4444]">*</span>
                </label>
                <SearchableSelect
                  options={officeOptions}
                  value={selectedOfficeId}
                  onChange={(val) => setSelectedOfficeId(val)}
                  placeholder="Pilih Kantor Cabang / KC..."
                  searchPlaceholder="Cari nama cabang, tipe (KCU/KC), kode..."
                  emptyMessage="Tidak ada kantor cabang ditemukan pada regional ini"
                  required
                />
                <p className="text-[11px] text-[#64748B] mt-1">Cari cepat cabang pelaksana penanganan</p>
              </div>
            </div>

            {/* Work Location */}
            <div>
              <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                Lokasi Spesifik / Ruangan / Unit Kerja <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Gedung Kantor Pos Pusat Lt. 2, Ruang Sortir"
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                className="w-full h-11 px-3.5 rounded-[10px] border border-[#E2E8F0] text-[14px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] transition-all"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[13px] font-semibold text-[#0F172A] mb-1.5">
                Subjek / Judul Kendala <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Kendala Gagal Dispatching Paket Mid Mile"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-11 px-3.5 rounded-[10px] border border-[#E2E8F0] text-[14px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-semibold text-[#0F172A]">
                  Rincian Deskripsi Masalah <span className="text-[#EF4444]">*</span>
                </label>
                <span className="text-[11px] text-[#94A3B8] font-mono">{description.length} karakter</span>
              </div>
              <textarea
                required
                rows={4}
                placeholder="Jelaskan kronologi kendala, nomor resi terkait, kode error, atau detail ruangan..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3.5 rounded-[10px] border border-[#E2E8F0] text-[14px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#199FB1]/30 focus:border-[#199FB1] transition-all resize-y leading-relaxed"
              />
            </div>

            {/* Drag & Drop File Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[13px] font-semibold text-[#0F172A]">Lampiran Bukti (Opsional)</label>
                <span className="text-[11px] text-[#94A3B8]">Maks 5 berkas (≤10MB)</span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  processFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-[12px] p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[#0D5C75] bg-[#EAF4F8]/60'
                    : 'border-[#CBD5E1] hover:border-[#199FB1] bg-[#F8FAFC]'
                }`}
              >
                <Upload size={24} className="text-[#94A3B8] mx-auto mb-2" />
                <p className="text-[13px] font-semibold text-[#0F172A]">
                  Tarik berkas ke sini, atau <span className="text-[#199FB1] underline">pilih berkas</span>
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">PNG, JPG, PDF hingga 10MB</p>
              </div>

              {/* Uploaded File Chips */}
              {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {attachments.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-2.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {file.dataUrl ? (
                          <img src={file.dataUrl} alt={file.name} className="w-8 h-8 rounded-[6px] object-cover border border-[#E2E8F0] flex-shrink-0" />
                        ) : (
                          <File size={20} className="text-[#94A3B8] flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0F172A] truncate">{file.name}</p>
                          <p className="text-[10px] text-[#64748B]">{file.size}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(file.id); }}
                        className="p-1 rounded text-[#94A3B8] hover:text-[#DC2626] transition-colors cursor-pointer"
                        title="Hapus berkas"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#F1F5F9] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubject('');
                  setDescription('');
                  setWorkLocation('');
                  setAttachments([]);
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-[13px] font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-[10px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={14} /> Reset
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto h-11 px-6 rounded-[10px] bg-[#0D5C75] hover:bg-[#083342] text-white text-[14px] font-semibold transition-all shadow-md shadow-[#0D5C75]/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Send size={15} />
                <span>{isSubmitting ? 'Mengirimkan...' : 'Kirim Laporan Tiket'}</span>
              </button>
            </div>
          </form>

          {/* Right Column: Live Real-Time Ticket Preview + Contextual Tip */}
          <div className="space-y-4">
            {/* Live Preview Card */}
            <div className="bg-white rounded-[16px] border border-[#E2E8F0]/80 shadow-[0_2px_8px_rgba(15,23,42,0.06)] p-5 space-y-3">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#0D5C75]">
                <Eye size={16} />
                <span>Pratinjau Tiket Real-Time</span>
              </div>

              <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-[#0D5C75] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                    #TICK-PREVIEW
                  </span>
                  <PriorityBadge priority={priority} />
                </div>

                <h4 className="text-[14px] font-bold text-[#0F172A] leading-snug">
                  {subject.trim() || '(Judul kendala akan muncul di sini...)'}
                </h4>

                <p className="text-[12px] text-[#64748B] line-clamp-3 leading-relaxed">
                  {description.trim() || '(Rincian deskripsi masalah yang Anda ketikkan...)'}
                </p>

                <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
                  <span className="truncate max-w-[140px] font-semibold">{currentDepartment.name}</span>
                  <span>{attachments.length} Berkas</span>
                </div>
              </div>
            </div>

            {/* Contextual Tip Card */}
            <div className="bg-[#FFFBEB] rounded-[16px] border border-[#FDE68A] p-4 flex gap-3">
              <Lightbulb size={18} className="text-[#D97706] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-bold text-[#92400E]">Tips Pengaduan {currentDepartment.name}</p>
                <p className="text-[12px] text-[#B45309] leading-relaxed mt-1">{currentDepartment.tip}</p>
              </div>
            </div>

            {/* UPT Disposisi Badge */}
            <div className="bg-white rounded-[16px] border border-[#E2E8F0]/80 p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#0D5C75]">
                <Sparkles size={14} className="text-[#199FB1]" />
                <span>Unit Disposisi Otomatis</span>
              </div>
              <p className="text-[12px] font-semibold text-slate-800">{currentDepartment.uptUnit}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublicTicketForm;
