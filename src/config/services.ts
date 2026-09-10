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
