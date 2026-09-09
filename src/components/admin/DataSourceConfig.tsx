import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  Zap, 
  Cpu, 
  Layers, 
  Cloud, 
  Copy, 
  Check, 
  Terminal, 
  Server,
  Lock,
  Globe,
  Send,
  BotMessageSquare,
  Info,
  AlertCircle,
  Eye,
  EyeOff,
  Sliders,
  HardDrive,
  Sparkles,
  AlertTriangle,
  Play
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export const DataSourceConfig: React.FC = () => {
  const { success, error: toastError, info } = useToast();
  
  // Status state
  const [testing, setTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dbData, setDbData] = useState<{
    database_engine: string;
    mode?: 'online' | 'offline';
    is_local?: boolean;
    is_online?: boolean;
    host: string;
    port: number;
    database_name: string;
    ssl_mode: string;
    ssl_active: boolean;
    latency_ms: number;
    mysql_version: string;
    table_counts: Record<string, number>;
    connection_pool: { connection_limit: number; status: string };
  } | null>(null);

  // Configuration Form state
  const [configLoading, setConfigLoading] = useState(false);
  const [presets, setPresets] = useState<Record<string, any>>({});
  const [selectedPreset, setSelectedPreset] = useState<'online' | 'offline' | 'custom'>('online');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState('3306');
  const [formUser, setFormUser] = useState('root');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formDatabase, setFormDatabase] = useState('poso_helpdesk');
  const [formSsl, setFormSsl] = useState(false);
  const [createDbIfNotExists, setCreateDbIfNotExists] = useState(true);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);

  // Action states
  const [testingTarget, setTestingTarget] = useState(false);
  const [targetTestResult, setTargetTestResult] = useState<{
    success: boolean;
    message: string;
    latency_ms?: number;
    database?: string;
    mysql_version?: string;
    total_tables?: number;
    missing_tables?: string[];
  } | null>(null);

  const [savingConfig, setSavingConfig] = useState(false);
  const [migratingSchema, setMigratingSchema] = useState(false);
  const [showConfirmMigrate, setShowConfirmMigrate] = useState(false);

  // Telegram bot state
  const [telegramData, setTelegramData] = useState<{
    enabled: boolean;
    configured: boolean;
    maskedToken?: string | null;
    chatId?: string | null;
    baseUrl?: string;
    bot?: { firstName: string; username: string; id: number; canJoinGroups: boolean } | null;
    setupGuide?: Record<string, string> | null;
  } | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);

  // Fetch Database Live Status
  const fetchStatus = async () => {
    setTesting(true);
    try {
      const res = await apiService.getDbStatus();
      if (res.status === 'success' && res.data) {
        setDbData(res.data);
      } else {
        toastError(res.message || 'Gagal mengambil status database.');
      }
    } catch (err: any) {
      toastError(err.message || 'Terjadi gangguan jaringan.');
    } finally {
      setTesting(false);
    }
  };

  // Fetch Database Configuration & Presets
  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await apiService.getDbConfig();
      if (res.status === 'success' && res.data) {
        const { current, presets: fetchedPresets } = res.data;
        setPresets(fetchedPresets || {});
        setHasExistingPassword(Boolean(current.has_password));

        // Detect current mode
        const isLoc = current.is_local || current.mode === 'offline';
        setSelectedPreset(isLoc ? 'offline' : 'online');

        // Populate form with current settings
        setFormHost(current.host || '');
        setFormPort(String(current.port || (isLoc ? 3306 : 21970)));
        setFormUser(current.user || '');
        setFormDatabase(current.database || '');
        setFormSsl(Boolean(current.ssl));
        setFormPassword(''); // leave blank by default
      }
    } catch (err: any) {
      console.warn('Gagal memuat konfigurasi database:', err.message);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchTelegramStatus = async () => {
    setTelegramLoading(true);
    try {
      const res = await apiService.getTelegramStatus();
      if (res.status === 'success' && res.data) {
        setTelegramData(res.data);
      }
    } catch (err: any) {
      // silent - telegram may not be configured
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    setTelegramTesting(true);
    try {
      const res = await apiService.testTelegramNotification();
      if (res.status === 'success') {
        success(res.message || 'Pesan uji coba berhasil dikirim ke Telegram!');
      } else {
        toastError(res.message || 'Gagal mengirim pesan ke Telegram.');
      }
    } catch (err: any) {
      toastError(err.message || 'Gagal menghubungi Telegram API.');
    } finally {
      setTelegramTesting(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    fetchTelegramStatus();
  }, []);

  // Quick preset selector
  const handleSelectPreset = (presetKey: 'online' | 'offline' | 'custom') => {
    setSelectedPreset(presetKey);
    setTargetTestResult(null);

    if (presetKey === 'online') {
      const p = presets.online || {
        host: 'mysql-1810b125-nugrahaeldi123-5f2b.f.aivencloud.com',
        port: 21970,
        user: 'avnadmin',
        database: 'defaultdb',
        ssl: true
      };
      setFormHost(p.host);
      setFormPort(String(p.port));
      setFormUser(p.user);
      setFormDatabase(p.database);
      setFormSsl(true);
    } else if (presetKey === 'offline') {
      const p = presets.offline || {
        host: 'localhost',
        port: 3306,
        user: 'root',
        database: 'poso_helpdesk',
        ssl: false
      };
      setFormHost(p.host);
      setFormPort(String(p.port));
      setFormUser(p.user);
      setFormDatabase(p.database);
      setFormSsl(false);
    }
  };

  // Live ping current active DB
  const handleTestCurrentConnection = async () => {
    setTesting(true);
    try {
      const res = await apiService.ping();
      if (res.success) {
        success(`Koneksi Database Berhasil! Latensi: ${res.latency}ms`);
        await fetchStatus();
      } else {
        toastError(res.message || 'Gagal terhubung ke database');
      }
    } catch (err: any) {
      toastError('Gagal melakukan uji koneksi.');
    } finally {
      setTesting(false);
    }
  };

  // Test target credentials before applying
  const handleTestTarget = async () => {
    if (!formHost.trim()) {
      toastError('Host database wajib diisi.');
      return;
    }

    setTestingTarget(true);
    setTargetTestResult(null);

    try {
      const res = await apiService.testDbConfig({
        host: formHost.trim(),
        port: Number(formPort) || 3306,
        user: formUser.trim(),
        password: formPassword || undefined,
        database: formDatabase.trim(),
        ssl: formSsl,
        createDbIfNotExists
      });

      if (res.status === 'success' && res.data) {
        setTargetTestResult({
          success: true,
          message: res.message || 'Koneksi ke target database berhasil terhubung!',
          latency_ms: res.data.latency_ms,
          database: res.data.database,
          mysql_version: res.data.mysql_version,
          total_tables: res.data.total_tables,
          missing_tables: res.data.missing_tables
        });
        success(`Uji koneksi target berhasil! Latensi: ${res.data.latency_ms}ms`);
      } else {
        setTargetTestResult({
          success: false,
          message: res.message || 'Gagal terhubung ke target database.'
        });
        toastError(res.message || 'Uji koneksi gagal.');
      }
    } catch (err: any) {
      setTargetTestResult({
        success: false,
        message: err.message || 'Terjadi kesalahan saat menguji koneksi.'
      });
      toastError(err.message || 'Uji koneksi gagal.');
    } finally {
      setTestingTarget(false);
    }
  };

  // Save and switch database (hot-swap)
  const handleSaveAndApply = async () => {
    if (!formHost.trim()) {
      toastError('Host database wajib diisi.');
      return;
    }

    setSavingConfig(true);
    try {
      const res = await apiService.saveDbConfig({
        host: formHost.trim(),
        port: Number(formPort) || 3306,
        user: formUser.trim(),
        password: formPassword || undefined,
        database: formDatabase.trim(),
        ssl: formSsl,
        createDbIfNotExists
      });

      if (res.status === 'success') {
        success(res.message || 'Database berhasil dialihkan dan diterapkan!');
        setFormPassword('');
        setTargetTestResult(null);
        await fetchStatus();
        await fetchConfig();
      } else {
        toastError(res.message || 'Gagal menerapkan konfigurasi database.');
      }
    } catch (err: any) {
      toastError(err.message || 'Terjadi kesalahan saat menyimpan database.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Run schema migration on active DB
  const handleRunMigration = async () => {
    setMigratingSchema(true);
    setShowConfirmMigrate(false);
    try {
      const res = await apiService.migrateDbSchema();
      if (res.status === 'success') {
        success('Inisialisasi skema tabel & akun master berhasil dieksekusi!');
        await fetchStatus();
      } else {
        toastError(res.message || 'Gagal menjalankan inisialisasi skema.');
      }
    } catch (err: any) {
      toastError(err.message || 'Terjadi kesalahan saat inisialisasi skema.');
    } finally {
      setMigratingSchema(false);
    }
  };

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    success(`Berhasil menyalin: ${keyId}`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const isLocalActive = dbData?.is_local || dbData?.mode === 'offline' || (dbData?.host && (dbData.host.includes('localhost') || dbData.host.includes('127.0.0.1')));

  const vercelEnvVars = [
    { key: 'DB_HOST', val: dbData?.host || 'mysql-1810b125-nugrahaeldi123-5f2b.f.aivencloud.com' },
    { key: 'DB_PORT', val: String(dbData?.port || 21970) },
    { key: 'DB_USER', val: formUser || 'avnadmin' },
    { key: 'DB_PASSWORD', val: 'YOUR_DATABASE_PASSWORD' },
    { key: 'DB_NAME', val: dbData?.database_name || 'defaultdb' },
    { key: 'DB_SSL', val: String(dbData?.ssl_active ?? true) },
    { key: 'JWT_SECRET', val: 'poso_secret_jwt_key_2026_super_secure' }
  ];

  return (
    <div className="space-y-6 text-[#0F172A] max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-[#0F172A] tracking-tight">Database & Infrastruktur Sistem</h2>
          <p className="text-[14px] text-[#64748B] mt-0.5">
            Pusat konfigurasi basis data relasional PRISMA POS. Mendukung fleksibilitas pergantian Mode Cloud Online (Aiven MySQL) dan Mode Offline Lokal (Localhost/XAMPP).
          </p>
        </div>

        {/* Dynamic Mode Badge */}
        <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold shadow-xs ${
          isLocalActive 
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700' 
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isLocalActive ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <span>{isLocalActive ? 'Mode Offline: MySQL Lokal' : 'Mode Online: Aiven MySQL (Cloud)'}</span>
        </div>
      </div>

      {/* Main Connection Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isLocalActive 
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-600' 
                : 'bg-[#0D5C75]/10 border border-[#0D5C75]/20 text-[#0D5C75]'
            }`}>
              <Database size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  {dbData?.database_engine || (isLocalActive ? 'MySQL Localhost (Offline)' : 'Aiven for MySQL Cluster')}
                </h3>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase ${
                  dbData?.ssl_active 
                    ? 'bg-sky-100 text-sky-800' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {dbData?.ssl_active ? 'SSL REQUIRED' : 'SSL DISABLED'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 size={11} /> Terhubung
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5 select-all">
                {dbData?.host || 'localhost'}:{dbData?.port || 3306}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestCurrentConnection}
            disabled={testing}
            className="px-4 py-2.5 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
            <span>{testing ? 'Menguji Latensi...' : 'Uji Koneksi & Ping Latensi'}</span>
          </button>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Item 1: Database Name */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Database Aktif</span>
            <div className="text-sm font-black text-slate-900 font-mono truncate" title={dbData?.database_name}>
              {dbData?.database_name || 'defaultdb'}
            </div>
            <div className="text-[10px] text-slate-400">
              {dbData?.mysql_version ? `Versi: ${dbData.mysql_version.split('-')[0]}` : 'MySQL Server'}
            </div>
          </div>

          {/* Item 2: Latency */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Latensi Respon</span>
            <div className="text-sm font-black text-emerald-600 flex items-center gap-1.5 font-mono">
              <Zap size={14} className="text-amber-500" />
              <span>{dbData?.latency_ms ?? 0} ms</span>
            </div>
            <div className="text-[10px] text-slate-400">Direct TCP Connection</div>
          </div>

          {/* Item 3: Security & Encryption */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Enkripsi Jaringan</span>
            <div className={`text-sm font-black flex items-center gap-1.5 ${dbData?.ssl_active ? 'text-[#0D5C75]' : 'text-slate-600'}`}>
              <ShieldCheck size={15} className={dbData?.ssl_active ? 'text-emerald-500' : 'text-slate-400'} />
              <span>{dbData?.ssl_active ? 'TLS 1.3 / SSL' : 'Plaintext (Lokal)'}</span>
            </div>
            <div className="text-[10px] text-slate-400">Mode: {dbData?.ssl_mode || 'DISABLED'}</div>
          </div>

          {/* Item 4: Connection Pool */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Connection Pool</span>
            <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <Cpu size={14} className="text-blue-500" />
              <span>{dbData?.connection_pool?.connection_limit || 10} Koneksi (Pooling)</span>
            </div>
            <div className="text-[10px] text-slate-400">mysql2/promise Dynamic Proxy</div>
          </div>
        </div>
      </div>

      {/* Table Statistics Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[#0D5C75]" />
            <h3 className="text-sm font-bold text-slate-900">
              Statistik Data Tabel ({dbData?.database_name || 'Database Aktif'})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Single Source of Truth</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">Tabel Pengguna (users)</span>
            <span className="text-2xl font-black text-slate-900">{dbData?.table_counts?.users ?? 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Akun RBAC</span>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">Tabel Tiket (tickets)</span>
            <span className="text-2xl font-black text-[#0D5C75]">{dbData?.table_counts?.tickets ?? 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Laporan Masuk</span>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">Tabel Percakapan (threads)</span>
            <span className="text-2xl font-black text-slate-900">{dbData?.table_counts?.threads ?? 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Balasan & Catatan</span>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-center">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">Tabel Audit (audit_logs)</span>
            <span className="text-2xl font-black text-slate-900">{dbData?.table_counts?.audit_logs ?? 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Log Aktivitas</span>
          </div>
        </div>
      </div>

      {/* ── DATABASE CONFIGURATION & SWITCHER PANEL (ADMIN EXCLUSIVE) ───────────────────────── */}
      <div className="bg-white rounded-2xl border-2 border-[#0D5C75]/20 p-6 sm:p-7 shadow-sm space-y-6">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0D5C75] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Sliders size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Konfigurasi & Pergantian Database</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                  Khusus Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih preset atau masukkan kredensial target, uji koneksi, lalu simpan untuk mengalihkan database aktif seketika.
              </p>
            </div>
          </div>

          {/* Migration Button Header Shortcut */}
          <button
            type="button"
            onClick={() => setShowConfirmMigrate(true)}
            disabled={migratingSchema}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            title="Inisialisasi tabel dan data master pada database aktif"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span>{migratingSchema ? 'Menginisialisasi...' : 'Inisialisasi Skema & Akun'}</span>
          </button>
        </div>

        {/* Quick Presets Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600 block uppercase tracking-wider">
            Pilih Preset Cepat:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Preset 1: Online Aiven */}
            <button
              type="button"
              onClick={() => handleSelectPreset('online')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                selectedPreset === 'online'
                  ? 'border-[#0D5C75] bg-[#0D5C75]/5 ring-2 ring-[#0D5C75]/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-sky-600" />
                  <span className="text-xs font-bold text-slate-900">Mode Online (Cloud)</span>
                </div>
                {selectedPreset === 'online' && <Check size={14} className="text-[#0D5C75]" />}
              </div>
              <p className="text-[11px] text-slate-500">Aiven for MySQL Cluster (SSL Aktif)</p>
            </button>

            {/* Preset 2: Offline Localhost */}
            <button
              type="button"
              onClick={() => handleSelectPreset('offline')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                selectedPreset === 'offline'
                  ? 'border-[#0D5C75] bg-[#0D5C75]/5 ring-2 ring-[#0D5C75]/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className="text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900">Mode Offline (Lokal)</span>
                </div>
                {selectedPreset === 'offline' && <Check size={14} className="text-[#0D5C75]" />}
              </div>
              <p className="text-[11px] text-slate-500">Localhost:3306 / XAMPP / MariaDB</p>
            </button>

            {/* Preset 3: Custom */}
            <button
              type="button"
              onClick={() => setSelectedPreset('custom')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                selectedPreset === 'custom'
                  ? 'border-[#0D5C75] bg-[#0D5C75]/5 ring-2 ring-[#0D5C75]/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Server size={16} className="text-slate-600" />
                  <span className="text-xs font-bold text-slate-900">Kustom (Manual)</span>
                </div>
                {selectedPreset === 'custom' && <Check size={14} className="text-[#0D5C75]" />}
              </div>
              <p className="text-[11px] text-slate-500">Input parameter server kustom</p>
            </button>
          </div>
        </div>

        {/* Configuration Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {/* Field 1: DB Host */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Server size={13} className="text-slate-400" />
              <span>Host / Alamat Server</span>
            </label>
            <input
              type="text"
              value={formHost}
              onChange={(e) => {
                setFormHost(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="contoh: localhost atau mysql-1810...aivencloud.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/30 focus:border-[#0D5C75]"
            />
          </div>

          {/* Field 2: DB Port */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Port MySQL</span>
            </label>
            <input
              type="number"
              value={formPort}
              onChange={(e) => {
                setFormPort(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="3306 atau 21970"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/30 focus:border-[#0D5C75]"
            />
          </div>

          {/* Field 3: Database Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Database size={13} className="text-slate-400" />
              <span>Nama Database</span>
            </label>
            <input
              type="text"
              value={formDatabase}
              onChange={(e) => {
                setFormDatabase(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="poso_helpdesk atau defaultdb"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/30 focus:border-[#0D5C75]"
            />
          </div>

          {/* Field 4: DB User */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Username Database</span>
            </label>
            <input
              type="text"
              value={formUser}
              onChange={(e) => {
                setFormUser(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="root atau avnadmin"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/30 focus:border-[#0D5C75]"
            />
          </div>

          {/* Field 5: DB Password */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Lock size={13} className="text-slate-400" />
                <span>Password Database</span>
              </label>
              {hasExistingPassword && !formPassword && (
                <span className="text-[10px] text-emerald-600 font-medium">Tersimpan di .env</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder={hasExistingPassword ? '•••••••• (Kosongkan jika tetap)' : 'Masukkan password database'}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D5C75]/30 focus:border-[#0D5C75]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Options & SSL Toggle */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* SSL Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFormSsl(!formSsl);
                setSelectedPreset('custom');
              }}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative flex items-center px-0.5 ${
                formSsl ? 'bg-[#0D5C75]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                  formSsl ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div>
              <span className="text-xs font-bold text-slate-800 block">Enkripsi SSL / TLS (ca.pem)</span>
              <span className="text-[11px] text-slate-500 block">
                {formSsl ? 'Aktif (Wajib untuk Cloud Aiven)' : 'Nonaktif (Standar untuk MySQL Lokal / XAMPP)'}
              </span>
            </div>
          </div>

          {/* Auto Create DB Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={createDbIfNotExists}
              onChange={(e) => setCreateDbIfNotExists(e.target.checked)}
              className="w-4 h-4 rounded text-[#0D5C75] focus:ring-[#0D5C75] border-slate-300"
            />
            <span className="text-xs text-slate-700 font-medium">
              Buat database otomatis jika belum ada (<code className="text-[10px] bg-slate-200 px-1 py-0.5 rounded font-mono">CREATE DATABASE</code>)
            </span>
          </label>
        </div>

        {/* Test Result Alert Banner */}
        {targetTestResult && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            targetTestResult.success 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {targetTestResult.success ? (
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 text-xs">
              <p className="font-bold">{targetTestResult.message}</p>
              {targetTestResult.success && (
                <div className="text-[11px] text-emerald-800 space-y-0.5">
                  <p>
                    ✓ Database: <span className="font-mono font-bold">{targetTestResult.database}</span> | 
                    Versi: <span className="font-mono">{targetTestResult.mysql_version}</span> | 
                    Latensi: <span className="font-mono font-bold">{targetTestResult.latency_ms}ms</span>
                  </p>
                  <p>
                    ✓ Jumlah Tabel Ditemukan: <span className="font-bold">{targetTestResult.total_tables ?? 0}</span> tabel.
                    {targetTestResult.total_tables === 0 && (
                      <span className="text-amber-800 font-bold ml-1">
                        (Database kosong baru. Setelah menyimpan, klik tombol "Inisialisasi Skema & Akun" untuk membuat tabel).
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-slate-500">
            * Menyimpan konfigurasi akan langsung mengalihkan koneksi aktif dan memperbarui file <span className="font-mono">.env</span> secara aman.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Button 1: Test Target */}
            <button
              type="button"
              onClick={handleTestTarget}
              disabled={testingTarget || savingConfig}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw size={14} className={testingTarget ? 'animate-spin' : ''} />
              <span>{testingTarget ? 'Menguji Koneksi...' : 'Uji Koneksi Target'}</span>
            </button>

            {/* Button 2: Save and Switch */}
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={savingConfig || testingTarget}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Check size={14} />
              <span>{savingConfig ? 'Menerapkan Perubahan...' : 'Simpan & Terapkan Perubahan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Database Migration */}
      {showConfirmMigrate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Inisialisasi Skema Tabel & Data Master?</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Tindakan ini akan membuat seluruh struktur tabel sistem PRISMA POS (<span className="font-mono">users</span>, <span className="font-mono">tickets</span>, <span className="font-mono">roles</span>, <span className="font-mono">permissions</span>, dll.) serta akun bawaan pada database aktif (<span className="font-mono font-bold text-slate-900">{dbData?.database_name}</span>).
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Data yang sudah ada tidak akan terhapus karena proses bersifat idempotent (non-destruktif).
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmMigrate(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRunMigration}
                disabled={migratingSchema}
                className="px-4 py-2 rounded-xl bg-[#0D5C75] hover:bg-[#083342] text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play size={13} />
                <span>{migratingSchema ? 'Menjalankan...' : 'Ya, Jalankan Inisialisasi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vercel Environment Variables Instruction Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#083342] to-[#0D5C75] text-white shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cloud size={20} className="text-[#38BDF8]" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              Panduan Deployment & Sinkronisasi Vercel (Produksi Cloud)
            </h4>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-[#38BDF8] border border-sky-400/30 text-[10px] font-bold">
            Cloud Production
          </span>
        </div>

        <p className="text-xs text-white/80 leading-relaxed">
          Untuk menghubungkan sistem PRISMA POS di Vercel (<span className="font-mono text-[#38BDF8]">poso-jet.vercel.app</span>) dengan cluster cloud MySQL:
        </p>

        <ol className="text-xs text-white/90 space-y-2 list-decimal list-inside pl-1">
          <li>Buka Dashboard proyek Anda di <strong>Vercel (vercel.com)</strong>.</li>
          <li>Masuk ke menu <strong>Settings</strong> ➔ <strong>Environment Variables</strong>.</li>
          <li>
            Pastikan variabel berikut telah ditambahkan di Vercel:
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5 not-prose">
              {vercelEnvVars.map(v => (
                <div 
                  key={v.key}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/10 hover:border-[#38BDF8]/40 transition-all font-mono text-[11px]"
                >
                  <div className="overflow-hidden mr-2">
                    <span className="text-[#38BDF8] font-bold block">{v.key}</span>
                    <span className="text-slate-300 text-[10px] truncate block">
                      {v.key === 'DB_PASSWORD' ? '••••••••••••••••' : v.val}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(v.val, v.key)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex-shrink-0 cursor-pointer"
                    title={`Salin nilai ${v.key}`}
                  >
                    {copiedKey === v.key ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              ))}
            </div>
          </li>
          <li>
            Jalankan <span className="font-mono text-[#38BDF8] bg-black/30 px-1.5 py-0.5 rounded">git push origin main</span> dari terminal lokal Anda, atau klik <strong>Redeploy</strong> di Vercel.
          </li>
        </ol>
      </div>

      {/* Terminal CLI Helper Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <Terminal size={17} className="text-[#0D5C75]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Perintah Terminal Backend & Migrasi</h4>
        </div>
        <div className="space-y-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-900 text-slate-100 flex items-center justify-between">
            <span>npm run test:db</span>
            <span className="text-slate-400 text-[11px] font-sans">Uji koneksi SELECT 1+2 & info database</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 text-slate-100 flex items-center justify-between">
            <span>npm run migrate</span>
            <span className="text-slate-400 text-[11px] font-sans">Eksekusi skema tabel DDL & seed data master</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 text-slate-100 flex items-center justify-between">
            <span>npm run dev</span>
            <span className="text-slate-400 text-[11px] font-sans">Jalankan Express Backend (5001) & Vite (3000)</span>
          </div>
        </div>
      </div>

      {/* ── TELEGRAM BOT GATEWAY PANEL ───────────────────────────────────── */}
      <div className="bg-white rounded-[16px] border border-[#E2E8F0]/80 p-6 shadow-sm space-y-4 mt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #229ED9 0%, #1a7bbf 100%)' }}>
              <BotMessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#0F172A]">Telegram Bot Gateway</h3>
              <p className="text-[11px] text-[#64748B]">Notifikasi real-time tiket ke grup Telegram tim helpdesk</p>
            </div>
          </div>
          {telegramData && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
              telegramData.configured
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {telegramData.configured ? (
                <><CheckCircle2 size={11} /> Terhubung & Aktif</>
              ) : (
                <><AlertCircle size={11} /> Belum Dikonfigurasi</>
              )}
            </span>
          )}
        </div>

        {telegramLoading && (
          <div className="flex items-center gap-2 text-[12px] text-slate-500 py-2">
            <RefreshCw size={13} className="animate-spin" />
            <span>Mengambil status bot Telegram...</span>
          </div>
        )}

        {/* Bot Info (if configured) */}
        {telegramData?.configured && telegramData.bot && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-[10px] bg-[#F0F9FF] border border-blue-100">
              <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider mb-1">Nama Bot</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{telegramData.bot.firstName}</p>
            </div>
            <div className="p-3 rounded-[10px] bg-[#F0F9FF] border border-blue-100">
              <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider mb-1">Username Bot</p>
              <p className="text-[13px] font-bold text-[#0F172A]">@{telegramData.bot.username}</p>
            </div>
            <div className="p-3 rounded-[10px] bg-[#F0F9FF] border border-blue-100">
              <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider mb-1">Token (masked)</p>
              <p className="text-[12px] font-mono text-slate-600">{telegramData.maskedToken}</p>
            </div>
            <div className="p-3 rounded-[10px] bg-[#F0F9FF] border border-blue-100">
              <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider mb-1">Target Chat ID</p>
              <p className="text-[12px] font-mono text-slate-600">{telegramData.chatId}</p>
            </div>
          </div>
        )}

        {/* Notifications Coverage */}
        {telegramData?.configured && (
          <div className="p-3 rounded-[10px] bg-emerald-50 border border-emerald-100 space-y-1.5">
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Cakupan Notifikasi Aktif
            </p>
            {[
              '📦 Tiket baru diterbitkan (termasuk prioritas Urgent & High)',
              '🔄 Perubahan status penanganan tiket (Open → In Progress → Closed)',
              '⚠️ Permohonan buka kembali tiket yang sudah ditutup (Reopen Request)',
              '💬 Balasan percakapan publik baru di tiket'
            ].map((item, i) => (
              <p key={i} className="text-[11px] text-emerald-800">{item}</p>
            ))}
          </div>
        )}

        {/* Setup Guide (if not configured) */}
        {telegramData && !telegramData.configured && telegramData.setupGuide && (
          <div className="p-4 rounded-[10px] bg-amber-50 border border-amber-200 space-y-2">
            <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
              <Info size={12} /> Panduan Aktivasi Telegram Bot
            </p>
            {Object.values(telegramData.setupGuide).map((step: string, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <p className="text-[11px] text-amber-900">{step}</p>
              </div>
            ))}
            <div className="mt-3 p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono space-y-1">
              <p className="text-slate-400 text-[10px]"># Tambahkan ke file .env lalu restart server:</p>
              <p>TELEGRAM_BOT_TOKEN=7123456789:AAFxAbc...xyz</p>
              <p>TELEGRAM_CHAT_ID=-1001234567890</p>
              <p>TELEGRAM_NOTIF_ENABLED=true</p>
              <p>APP_BASE_URL=https://your-domain.vercel.app</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            id="btn-refresh-telegram-status"
            onClick={fetchTelegramStatus}
            disabled={telegramLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[12px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={telegramLoading ? 'animate-spin' : ''} />
            Refresh Status
          </button>
          {telegramData?.configured && (
            <button
              id="btn-test-telegram-ping"
              onClick={handleTestTelegram}
              disabled={telegramTesting}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[12px] font-semibold text-white transition-colors cursor-pointer"
              style={{ background: telegramTesting ? '#94a3b8' : 'linear-gradient(135deg, #229ED9 0%, #1a7bbf 100%)' }}
            >
              <Send size={13} className={telegramTesting ? 'animate-pulse' : ''} />
              {telegramTesting ? 'Mengirim...' : 'Kirim Pesan Uji Coba (Test Ping)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataSourceConfig;

