import React from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { TicketPriority, TicketStatus } from '../../types';

export const statusLabels: Record<TicketStatus, string> = { open: 'Baru', in_progress: 'Dikerjakan', waiting: 'Menunggu informasi', resolved: 'Solusi diberikan', closed: 'Ditutup' };
export const priorityLabels: Record<TicketPriority, string> = { Low: 'Rendah', Medium: 'Sedang', High: 'Tinggi', Urgent: 'Mendesak' };
export const nextStatuses: Record<TicketStatus, TicketStatus[]> = { open: ['in_progress','waiting','resolved'], in_progress: ['waiting','resolved'], waiting: ['in_progress','resolved'], resolved: ['in_progress','closed'], closed: [] };
export function Status({ value }: { value: TicketStatus }) { return <span className={`status-pill status-${value}`}><span aria-hidden="true" />{statusLabels[value] || value}</span>; }
export function Priority({ value }: { value: TicketPriority }) { return <span className={`priority-pill priority-${value.toLowerCase()}`}>{priorityLabels[value]}</span>; }
export function ErrorNotice({ message, retry }: { message?: string; retry?: () => void }) {
  return message ? <div className="error-notice" role="alert"><AlertCircle size={18} className="shrink-0" /><div>{message}{retry && <button className="underline ml-2 font-semibold" onClick={retry}>Coba lagi</button>}</div></div> : null;
}
export function Loading({ label = 'Memuat data…' }: { label?: string }) { return <div className="loading-state" role="status"><LoaderCircle className="animate-spin" size={22} /><span>{label}</span></div>; }
export function Field({ label, hint, children, required = false }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return <label className="field"><span className="field-label">{label}{required && <span className="text-rose-600 ml-1" aria-label="wajib diisi">*</span>}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}
export function formatDate(value?: string) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date); }
export function shortId(value: string) { return value.startsWith('TICK-') && value.length > 25 ? `TICK-${value.slice(5, 13).toUpperCase()}` : value; }
export function timeAgo(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'baru saja';
  if (seconds < 60) return `${seconds} dtk lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hr lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bln lalu`;
  return `${Math.floor(days / 365)} thn lalu`;
}
export function LiveTimeAgo({ date }: { date?: string }) {
  const [text, setText] = React.useState(() => timeAgo(date));
  React.useEffect(() => {
    setText(timeAgo(date));
    const interval = setInterval(() => setText(timeAgo(date)), 5000);
    return () => clearInterval(interval);
  }, [date]);
  return <span title={date ? formatDate(date) : undefined}>{text}</span>;
}

