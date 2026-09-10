import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { AppShell } from '../../components/app/AppShell';
import { ErrorNotice, Field } from '../../components/app/Primitives';
import { apiService } from '../../services/api';

export function TicketLookup() {
  const [params]=useSearchParams();const navigate=useNavigate();const [ticket,setTicket]=useState(params.get('id')||params.get('ticket')||'');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{const id=params.get('id')||params.get('ticket');if(id)navigate('/tickets/'+encodeURIComponent(id),{replace:true});},[params,navigate]);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');const id=ticket.trim();const result=await apiService.trackTicket(id);setBusy(false);if(result.status==='success')navigate('/tickets/'+encodeURIComponent(id));else setError(result.message||'Tiket tidak tersedia.');};
  return <AppShell><div className="max-w-2xl mx-auto mt-8"><div className="page-eyebrow">PENCARIAN TIKET</div><h1 className="page-title">Langsung ke laporan Anda.</h1><p className="page-description">Masukkan nomor tiket lengkap dari konfirmasi pengajuan. Tiket hanya dapat dibuka sesuai akses akun Anda.</p><form onSubmit={submit} className="panel panel-pad form-stack mt-7"><Field label="Nomor tiket lengkap" required hint="Salin seluruh nomor, termasuk awalan TICK-."><input className="input font-mono" value={ticket} onChange={event=>setTicket(event.target.value)} required maxLength={50} placeholder="TICK-…"/></Field><ErrorNotice message={error}/><button className="btn btn-primary" disabled={busy}><Search size={17}/>{busy?'Mencari…':'Cari tiket'}</button></form></div></AppShell>;
}
