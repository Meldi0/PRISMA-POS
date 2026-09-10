import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;if(open&&!dialog?.open)dialog?.showModal();if(!open&&dialog?.open)dialog.close();},[open]);
  return <dialog ref={ref} aria-label={title} onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}} className="rounded-2xl bg-white p-0 w-[min(680px,calc(100%-32px))] max-h-[90vh] shadow-2xl backdrop:bg-slate-950/40"><div className="p-6 sm:p-8"><div className="flex items-center justify-between gap-4 mb-6"><h2 className="panel-title mb-0">{title}</h2><button type="button" className="icon-button" aria-label="Tutup dialog" onClick={onClose}><X size={18}/></button></div>{children}</div></dialog>;
}
