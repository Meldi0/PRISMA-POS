import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface SlaCountdownProps {
  slaTarget?: string;
  isClosed?: boolean;
  compact?: boolean;
  showSeconds?: boolean;
}

function getTimeRemaining(target?: string) {
  if (!target) {
    return { diff: 86400000, h: 24, m: 0, s: 0, breached: false, valid: false };
  }
  const targetTime = new Date(target).getTime();
  if (isNaN(targetTime)) {
    return { diff: 86400000, h: 24, m: 0, s: 0, breached: false, valid: false };
  }
  const diff = targetTime - Date.now();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return { diff, h, m, s, breached: diff < 0, valid: true };
}

export function SlaCountdown({ slaTarget, isClosed = false, compact = false, showSeconds = !compact }: SlaCountdownProps) {
  const [time, setTime] = useState(() => getTimeRemaining(slaTarget));

  useEffect(() => {
    setTime(getTimeRemaining(slaTarget));
    const interval = setInterval(() => {
      setTime(getTimeRemaining(slaTarget));
    }, 1000);
    return () => clearInterval(interval);
  }, [slaTarget]);

  if (isClosed) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
          <Clock size={10} />
          Selesai Tepat Waktu
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669]">
        <Clock size={14} />
        <span className="text-[13px] font-semibold font-mono">Selesai Tepat Waktu</span>
      </div>
    );
  }

  const isBreached = time.breached;
  const isAtRisk = !isBreached && time.h < 4;

  const colorConfig = isBreached
    ? { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
    : isAtRisk
    ? { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A' }
    : { text: '#059669', bg: '#ECFDF5', border: '#A7F3D0' };

  const secStr = showSeconds ? ` ${time.s}d` : '';
  const label = !time.valid
    ? 'Target 24 Jam'
    : isBreached
    ? `Terlambat ${time.h > 0 ? `${time.h}j ` : ''}${time.m}m${secStr}`
    : `${time.h > 0 ? `${time.h}j ` : ''}${time.m}m${secStr} tersisa`;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono ${isBreached ? 'sla-pulse animate-pulse' : ''}`}
        style={{ backgroundColor: colorConfig.bg, color: colorConfig.text, border: `1px solid ${colorConfig.border}` }}
        title={isBreached ? 'Target batas penanganan SLA terlampaui' : `Batas waktu SLA: ${slaTarget || ''}`}
      >
        <Clock size={10} className={isBreached ? 'text-rose-600' : ''} />
        {label}
      </span>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] border font-mono ${isBreached ? 'sla-pulse' : ''}`}
      style={{ backgroundColor: colorConfig.bg, borderColor: colorConfig.border }}
    >
      <Clock size={16} style={{ color: colorConfig.text }} className={isBreached ? 'animate-pulse' : ''} />
      <div className="flex flex-col">
        <span className="text-[13px] font-bold tracking-tight" style={{ color: colorConfig.text }}>
          {label}
        </span>
        <span className="text-[10px] font-sans font-medium opacity-80 mt-0.5" style={{ color: colorConfig.text }}>
          {isBreached ? 'Target SLA terlampaui' : isAtRisk ? 'Mendekati batas waktu penanganan' : 'Target SLA berjalan normal'}
        </span>
      </div>
    </div>
  );
}

export default SlaCountdown;
