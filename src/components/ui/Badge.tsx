import React from 'react';
import { TicketStatus, TicketPriority } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'status' | 'priority' | 'role';
  className?: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  open: { label: 'Open', bg: '#EFF6FF', text: '#0284C7', dot: '#0284C7' },
  in_progress: { label: 'In Progress', bg: '#F5F3FF', text: '#8B5CF6', dot: '#8B5CF6' },
  waiting: { label: 'Menunggu', bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  closed: { label: 'Selesai', bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
};

const priorityConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  low: { label: 'Rendah', bg: '#F8FAFC', text: '#64748B', dot: '#94A3B8' },
  medium: { label: 'Sedang', bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6' },
  high: { label: 'Tinggi', bg: '#FFF7ED', text: '#C2410C', dot: '#F58A61' },
  urgent: { label: 'Urgent', bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
};

export function StatusBadge({ status }: { status: TicketStatus | string }) {
  const norm = String(status || 'open').toLowerCase();
  const cfg = statusConfig[norm] || statusConfig.open;
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold leading-none tracking-wide select-none"
    >
      <span
        style={{ backgroundColor: cfg.dot }}
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      />
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority | string }) {
  const norm = String(priority || 'medium').toLowerCase();
  const cfg = priorityConfig[norm] || priorityConfig.medium;
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold leading-none select-none"
    >
      <span
        style={{ backgroundColor: cfg.dot }}
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      />
      {cfg.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const norm = String(role || 'upt_luar').toLowerCase();
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    admin: { bg: '#FDF4FF', text: '#9333EA', label: 'Admin' },
    admin_pusat: { bg: '#FDF4FF', text: '#9333EA', label: 'Admin' },
    petugas_upt: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Petugas UPT Pusat' },
    operator: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Petugas UPT Pusat' },
    upt: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Petugas UPT Pusat' },
    upt_luar: { bg: '#F0FDF4', text: '#15803D', label: 'UPT Luar' },
    pelapor: { bg: '#F0FDF4', text: '#15803D', label: 'UPT Luar' },
    user_cabang: { bg: '#F0FDF4', text: '#15803D', label: 'UPT Luar' },
    user_regional: { bg: '#F0FDF4', text: '#15803D', label: 'UPT Luar' },
    pengguna_umum: { bg: '#F0FDF4', text: '#15803D', label: 'UPT Luar' },
  };
  const cfg = configs[norm] || { bg: '#F0FDF4', text: '#15803D', label: 'UPT Luar' };
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
    >
      {cfg.label}
    </span>
  );
}

export default function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EAF4F8] text-[#0D5C75] ${className}`}>
      {children}
    </span>
  );
}
