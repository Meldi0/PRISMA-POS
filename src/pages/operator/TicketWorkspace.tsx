import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowRight, ChevronLeft, ChevronRight, Clock3, Inbox, Paperclip, Plus, RefreshCw, Search } from 'lucide-react';
import { AppShell } from '../../components/app/AppShell';
import { ErrorNotice, formatDate, LiveTimeAgo, Loading, Priority, shortId, Status, statusLabels } from '../../components/app/Primitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ticket, TicketPriority, TicketStatus } from '../../types';
import { CASCADING_DEPARTMENTS } from '../../config/services';
import { csvCell } from '../../utils/csv';

const Users = lazy(() => import('../../components/admin/UserManagement').then(module => ({default:module.UserManagement})));
const Approvals = lazy(() => import('../../components/admin/UserApprovalManagement').then(module => ({default:module.UserApprovalManagement})));
const Audit = lazy(() => import('../../components/admin/AuditLogView').then(module => ({default:module.AuditLogView})));
const Settings = lazy(() => import('../../components/admin/DataSourceConfig').then(module => ({default:module.DataSourceConfig})));
const Productivity = lazy(() => import('../../components/operator/OperatorProductivityTable').then(module => ({default:module.OperatorProductivityTable})));

export function TicketWorkspace() {
  const { user, isStaff, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'tickets';
  const admin = ['ADMIN','ADMIN_PUSAT','admin'].includes(user?.role || '');
  const [tickets,setTickets]=useState<Ticket[]>([]); const [summary,setSummary]=useState<Record<string,number>>({});
  const [total,setTotal]=useState(0); const [page,setPage]=useState(1); const [pages,setPages]=useState(0);
  const [query,setQuery]=useState(''); const [search,setSearch]=useState(''); const [status,setStatus]=useState('all'); const [priority,setPriority]=useState('all'); const [category,setCategory]=useState('all');
  const [loading,setLoading]=useState(true); const [syncing,setSyncing]=useState(false); const [error,setError]=useState(''); const [revision,setRevision]=useState(0); const [exporting,setExporting]=useState(false); const [lastSync,setLastSync]=useState('');
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query);setPage(1);},350);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>{
    if(view!=='tickets')return;
    let alive=true; let running=false;
    const load=async(silent=false)=>{
      if(running || (silent && document.hidden))return; running=true;
      if(!silent)setLoading(true);setSyncing(true);
      const params={search,status:status as TicketStatus|'all',priority:priority as TicketPriority|'all',category,page,limit:25};
      const [result,counts]=await Promise.all([apiService.getTickets(params),apiService.getTicketSummary({search,category})]);
      if(alive){
        if(result.status==='success'&&result.data){setTickets(result.data.tickets);setTotal(result.data.total);setPages(result.data.total_pages);setError('');setLastSync(new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}));if(page>1&&result.data.total_pages<page)setPage(Math.max(1,result.data.total_pages));}
        else setError(result.message||'Daftar tiket belum berhasil dimuat.');
        if(counts.status==='success'&&counts.data)setSummary(counts.data);
        setLoading(false);setSyncing(false);
      }running=false;
    };
    void load(); const timer=setInterval(()=>void load(true),15000);
    const focus=()=>{if(!document.hidden)void load(true);};document.addEventListener('visibilitychange',focus);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',focus);};
  },[view,search,status,priority,category,page,revision]);
  const changeStatus=(value:string)=>{setStatus(value);setPage(1);};
  const exportCsv=async()=>{
    setExporting(true);setError('');
    try{
      const rows:Ticket[]=[];let next=1;let totalPages=1;
      do {const result=await apiService.getTickets({search,status:status as TicketStatus|'all',priority:priority as TicketPriority|'all',category,page:next,limit:100});if(result.status!=='success'||!result.data)throw new Error(result.message||'Ekspor belum berhasil.');rows.push(...result.data.tickets);totalPages=result.data.total_pages;next++;}while(next<=totalPages);
      const csv=[['ID tiket','Judul','Layanan','Kantor','Pelapor','Prioritas','Status','Dibuat'],...rows.map(ticket=>[ticket.ticket_id,ticket.subject,ticket.category,ticket.office_name,ticket.requester_name,ticket.priority,statusLabels[ticket.status],formatDate(ticket.created_at)])].map(row=>row.map(csvCell).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='prisma-tiket-'+new Date().toISOString().slice(0,10)+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){setError((error as Error).message);}finally{setExporting(false);}
  };
  const adminViews:Record<string,{title:string;description:string;allowed:boolean;component:React.ReactNode}>={
    users:{title:'Pengguna & hak akses',description:'Kelola identitas, penempatan kantor, dan kewenangan pengguna.',allowed:admin,component:<Users/>},
    approvals:{title:'Persetujuan akun agen',description:'Periksa identitas mitra dan Kantor Pos pembina sebelum memberikan akses layanan.',allowed:admin,component:<Approvals/>},
    audit:{title:'Riwayat aktivitas',description:'Telusuri tindakan pengguna dan perubahan yang tercatat pada sistem.',allowed:hasPermission('audit.view'),component:<Audit/>},
    settings:{title:'Pengaturan layanan',description:'Pantau koneksi dan kelola konfigurasi layanan yang digunakan.',allowed:admin,component:<Settings/>},
    reports:{title:'Kinerja operator',description:'Lihat aktivitas serta penyelesaian tiket berdasarkan periode yang dipilih.',allowed:hasPermission('operator.stats_view'),component:<Productivity/>}
  };
  if(view!=='tickets'){const item=adminViews[view];return <AppShell><div className="page-heading"><div><div className="page-eyebrow">KELOLA LAYANAN</div><h1 className="page-title">{item?.title||'Halaman tidak ditemukan'}</h1><p className="page-description">{item?.description}</p></div></div>{item?.allowed?<Suspense fallback={<Loading/>}>{item.component}</Suspense>:<ErrorNotice message="Halaman ini tidak tersedia untuk peran Anda."/>}</AppShell>;}
  return <AppShell><div className="page-heading"><div><div className="page-eyebrow">{isStaff?'PUSAT PENANGANAN KENDALA':'LAYANAN UNTUK UNIT KERJA ANDA'}</div><h1 className="page-title">{isStaff?'Setiap tiket, langkah yang jelas.':'Pantau laporan, ikuti solusinya.'}</h1><p className="page-description">{isStaff?'Tinjau laporan baru, koordinasikan penanganan, dan pastikan solusi terdokumentasi.':'Laporan Anda dan unit kerja tersedia sesuai cakupan akses akun. Buka tiket untuk melihat respons petugas.'}</p></div><div className="flex items-center gap-2 muted"><span className={'h-2 w-2 rounded-full '+(error?'bg-amber-500':'bg-teal-500')}/>{lastSync?'Diperbarui '+lastSync:'Menyiapkan antrean'}</div></div>
    <div className="metric-grid"><button className="metric-card" onClick={()=>changeStatus('open')}><span>Laporan baru</span><strong>{summary.open??'—'}</strong><small>Perlu ditinjau petugas</small></button><button className="metric-card" onClick={()=>changeStatus('in_progress')}><span>Sedang dikerjakan</span><strong>{summary.in_progress??'—'}</strong><small>Dalam penanganan</small></button><button className="metric-card attention" onClick={()=>changeStatus('waiting')}><span>Menunggu informasi</span><strong>{summary.waiting??'—'}</strong><small>Perlu respons lanjutan</small></button><button className="metric-card" onClick={()=>changeStatus('resolved')}><span>Solusi diberikan</span><strong>{summary.resolved??'—'}</strong><small>Siap ditinjau sebelum ditutup</small></button></div>
    {Number(summary.overdue)>0&&<div className="info-notice mb-5 flex gap-2 items-center"><Clock3 size={17}/><span>{summary.overdue} tiket melewati target waktu penanganan.{Number(summary.reopen_pending)>0&&` ${summary.reopen_pending} permohonan buka kembali menunggu keputusan.`}</span></div>}
    <ErrorNotice message={error} retry={()=>setRevision(value=>value+1)}/><section className="panel overflow-hidden"><div className="table-toolbar"><div className="search-box"><Search size={17}/><input aria-label="Cari judul, nomor tiket, atau pelapor" className="input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari judul, nomor tiket, atau pelapor…"/></div><select aria-label="Filter status" className="input" value={status} onChange={event=>changeStatus(event.target.value)}><option value="all">Semua status</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><select aria-label="Filter layanan" className="input" value={category} onChange={event=>{setCategory(event.target.value);setPage(1);}}><option value="all">Semua layanan</option>{CASCADING_DEPARTMENTS.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select><select aria-label="Filter prioritas" className="input" value={priority} onChange={event=>{setPriority(event.target.value);setPage(1);}}><option value="all">Semua prioritas</option><option value="Urgent">Mendesak</option><option value="High">Tinggi</option><option value="Medium">Sedang</option><option value="Low">Rendah</option></select><button className="icon-button" aria-label="Muat ulang tiket" disabled={syncing} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={16} className={syncing?'animate-spin':''}/></button>{hasPermission('ticket.export')&&<button className="icon-button" aria-label="Ekspor seluruh hasil filter ke CSV" disabled={exporting} onClick={exportCsv}><ArrowDownToLine size={17}/></button>}</div>
    {loading?<Loading label="Memuat antrean tiket…"/>:tickets.length?<><table className="ticket-table"><thead><tr><th scope="col">LAPORAN</th><th scope="col">KANTOR / PELAPOR</th><th scope="col">STATUS</th><th scope="col">PRIORITAS</th><th scope="col">TARGET PENANGANAN</th></tr></thead><tbody>{tickets.map(ticket=><tr key={ticket.ticket_id}><td className="max-w-lg"><span className="mono-id" title={ticket.ticket_id}>{shortId(ticket.ticket_id)}</span><Link to={'/tickets/'+ticket.ticket_id} className="ticket-title">{ticket.subject}</Link><div className="muted flex items-center gap-3">{ticket.category}{Boolean(ticket.attachment_count)&&<span className="inline-flex gap-1 items-center"><Paperclip size={12}/>{ticket.attachment_count}</span>}{ticket.reopen_status==='PENDING'&&<span className="text-amber-700 font-semibold">Buka kembali diajukan</span>}</div></td><td className="mobile-optional"><div className="text-slate-700 text-xs">{ticket.office_name||'Belum tercatat'}</div><div className="muted mt-1">{ticket.requester_name}</div></td><td><Status value={ticket.status}/></td><td><Priority value={ticket.priority}/></td><td className="mobile-optional"><span className={new Date(ticket.sla_due_at)<new Date()&&!['resolved','closed'].includes(ticket.status)?'text-rose-700 text-xs font-semibold':'muted'}>{['resolved','closed'].includes(ticket.status)?'Penanganan selesai':formatDate(ticket.sla_due_at)}</span><div className="muted mt-1">Dibuat <LiveTimeAgo date={ticket.created_at}/></div></td></tr>)}</tbody></table><div className="pagination"><span className="muted">{(page-1)*25+1}–{Math.min(page*25,total)} dari {total} tiket</span><div className="flex items-center gap-2"><button className="icon-button" aria-label="Halaman sebelumnya" disabled={page<=1} onClick={()=>setPage(value=>value-1)}><ChevronLeft size={17}/></button><span className="muted">{page} / {pages}</span><button className="icon-button" aria-label="Halaman berikutnya" disabled={page>=pages} onClick={()=>setPage(value=>value+1)}><ChevronRight size={17}/></button></div></div></>:<div className="empty-state"><Inbox size={36}/><h3>{search||status!=='all'||category!=='all'?'Tidak ada tiket yang cocok':'Belum ada laporan'}</h3><p>{search||status!=='all'||category!=='all'?'Coba kata kunci lain atau hapus filter untuk melihat lebih banyak tiket.':'Saat ada kendala operasional, buat laporan pertama dan ikuti perkembangannya di sini.'}</p>{search||status!=='all'||category!=='all'?<button className="btn btn-secondary" onClick={()=>{setQuery('');setCategory('all');setPriority('all');changeStatus('all');}}>Hapus filter</button>:<Link className="btn btn-primary" to="/buat-tiket"><Plus size={16}/>Buat tiket pertama</Link>}</div>}</section>
    <p className="muted mt-4">Status dan jumlah tiket diperbarui otomatis setiap 15 detik saat halaman aktif. <Link className="text-teal-700 font-semibold" to="/track">Cari dengan nomor tiket <ArrowRight size={11} className="inline"/></Link></p>
  </AppShell>;
}
