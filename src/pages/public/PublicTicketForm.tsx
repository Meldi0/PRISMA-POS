import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, FileText, Lightbulb, Paperclip, Send, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { TicketPriority } from '../../types';
import { AppShell } from '../../components/app/AppShell';
import { ErrorNotice, Field, Priority } from '../../components/app/Primitives';
import { CASCADING_DEPARTMENTS } from '../../config/services';
export { CASCADING_DEPARTMENTS } from '../../config/services';

type Attachment = { name: string; size: string; type: string; dataUrl: string; bytes: number };
const initial = { department: CASCADING_DEPARTMENTS[0].id, topic: CASCADING_DEPARTMENTS[0].topics[0].label, location:'', subject:'', description:'', priority:'Medium' as TicketPriority };
const descriptions: Record<TicketPriority,string> = { Low:'Pemeliharaan rutin; aktivitas tetap berjalan.', Medium:'Sebagian aktivitas terganggu.', High:'Banyak pengguna atau unit terdampak.', Urgent:'Operasional kritis berhenti.' };
export const PublicTicketForm: React.FC = () => {
  const { user, isStaff } = useAuth();
  const draftKey = 'prisma_draft_' + user?.user_id;
  const [form,setForm] = useState(() => { try { const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null'); return saved ? {...initial,...saved} as typeof initial : initial; } catch { return initial; } });
  const [step,setStep]=useState(0); const [attachments,setAttachments]=useState<Attachment[]>([]);
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [reading,setReading]=useState(false);
  const [created,setCreated]=useState('');
  const requestKey=useRef(crypto.randomUUID());
  const heading=useRef<HTMLHeadingElement>(null);
  const group = CASCADING_DEPARTMENTS.find(item=>item.id===form.department) || CASCADING_DEPARTMENTS[0];
  const home = isStaff ? '/dashboard' : '/my-tickets';
  const validOffice=Boolean(user?.region_id && user?.office_id);
  const update=(name:keyof typeof initial,value:string)=>setForm(previous=>({...previous,[name]:value}));
  useEffect(()=>{ if (!created) sessionStorage.setItem(draftKey,JSON.stringify(form)); },[form,draftKey,created]);
  useEffect(()=>{ const before=(event:BeforeUnloadEvent)=>{ if ((form.subject || attachments.length) && !created) event.preventDefault(); }; window.addEventListener('beforeunload',before); return()=>window.removeEventListener('beforeunload',before); },[form.subject,attachments.length,created]);
  useEffect(()=>{heading.current?.focus();},[step]);
  const next=()=>{
    setError('');
    if (!validOffice) {setError('Identitas kantor belum lengkap. Hubungi administrator untuk melengkapinya.'); return;}
    if(step===0 && (!form.location.trim() || !form.topic)) {setError('Lengkapi lokasi dan topik kendala.');return;}
    if(step===1 && (form.subject.trim().length<5 || form.description.trim().length<20)) {setError('Judul minimal 5 karakter dan rincian kendala minimal 20 karakter.');return;}
    setStep(previous=>previous+1);
  };
  const addFiles=async(files:FileList|null)=>{
    if(!files)return; setError('');setReading(true);
    try{
      if(attachments.length+files.length>5)throw new Error('Maksimal 5 berkas untuk satu tiket.');
      let total=attachments.reduce((sum,file)=>sum+file.bytes,0);
      const nextFiles:Attachment[]=[];
      for(const file of Array.from(files)){
        if(!['image/jpeg','image/png','application/pdf'].includes(file.type))throw new Error('Hanya JPG, PNG, dan PDF yang dapat diunggah.');
        total+=file.size;
        if(total>10*1024*1024)throw new Error('Total seluruh lampiran maksimal 10 MB.');
        const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Berkas tidak dapat dibaca.'));reader.readAsDataURL(file);});
        nextFiles.push({name:file.name,size:(file.size/1024).toFixed(1)+' KB',type:file.type,dataUrl,bytes:file.size});
      }
      setAttachments(previous=>[...previous,...nextFiles]);
    }catch(err){setError((err as Error).message);}finally{setReading(false);}
  };
  const submit=async()=>{
    setBusy(true);setError('');
    const result=await apiService.createTicket({ subject:form.subject, description:form.description, category:group.name, department:group.name, topic:form.topic, location:form.location, priority:form.priority, attachments, idempotency_key:requestKey.current });
    setBusy(false);
    if(result.status==='success' && result.data?.ticket_id){sessionStorage.removeItem(draftKey);setCreated(result.data.ticket_id);}else setError(result.message||'Laporan belum berhasil dikirim. Data formulir tetap tersimpan; silakan coba lagi.');
  };
  return <AppShell>{created ? <div className="panel panel-pad max-w-2xl mx-auto mt-10"><div className="empty-state"><CheckCircle2 size={48}/><div className="page-eyebrow">LAPORAN BERHASIL DIKIRIM</div><h1 className="page-title">Tiket Anda sudah tercatat</h1><p>Petugas akan meninjau kendala Anda. Buka detail tiket untuk mengikuti status dan menambahkan informasi.</p><code className="text-xs break-all bg-slate-50 p-3 rounded-lg">{created}</code><div className="flex flex-wrap gap-3 justify-center mt-3"><Link className="btn btn-primary" to={'/tickets/'+created}>Lihat perkembangan tiket<ArrowRight size={16}/></Link><Link className="btn btn-secondary" to={home}>Kembali ke daftar</Link></div></div></div> : <div className="max-w-5xl mx-auto">
    <Link to={home} className="btn btn-link mb-4"><ArrowLeft size={15}/>Kembali ke daftar tiket</Link><div className="page-eyebrow">PENGAJUAN KENDALA</div><h1 className="page-title">Buat laporan yang mudah ditindaklanjuti</h1><p className="page-description">Ceritakan kendalanya. Kami bantu mengarahkan laporan Anda ke unit yang tepat.</p>
    <ol className="stepper" aria-label="Langkah pengajuan">{['Layanan & lokasi','Kendala & bukti','Periksa & kirim'].map((label,index)=><li key={label} className={'step-item '+(index<=step?'active':'')} aria-current={index===step?'step':undefined}><span>{index<step?<Check size={12}/>:index+1}</span>{label}</li>)}</ol>
    <div className="form-layout"><section className="panel panel-pad"><h2 tabIndex={-1} ref={heading} className="panel-title outline-none">{['Layanan dan lokasi kejadian','Jelaskan kendala Anda','Periksa sebelum mengirim'][step]}</h2><p className="field-hint mb-6">{['Identitas pelapor diambil dari akun Anda. Pilih bidang layanan yang paling sesuai.','Informasi yang spesifik membantu petugas memahami dan menyelesaikan masalah lebih cepat.','Pastikan informasi sudah sesuai. Semua percakapan selanjutnya tersedia di detail tiket.'][step]}</p>
    {step===0&&<div className="form-stack"><div className="info-notice"><div className="flex items-center gap-2 font-semibold mb-2"><Building2 size={16}/>{user?.office_name||'Kantor belum ditetapkan'}</div><p>{user?.name} · {user?.email}</p><p>{user?.region_name||'Regional belum ditetapkan'}</p></div>{!validOffice&&<ErrorNotice message="Administrator perlu melengkapi kantor akun sebelum Anda mengajukan tiket."/>}<Field label="Bidang layanan" required><select className="input" value={form.department} onChange={e=>{const selected=CASCADING_DEPARTMENTS.find(item=>item.id===e.target.value)!;setForm(previous=>({...previous,department:selected.id,topic:selected.topics[0].label}));}}>{CASCADING_DEPARTMENTS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Topik kendala" required><select className="input" value={form.topic} onChange={e=>update('topic',e.target.value)}>{group.topics.map(item=><option key={item.id} value={item.label}>{item.label}</option>)}</select></Field><Field label="Lokasi kejadian" hint="Contoh: Loket 2, ruang sortir, atau aplikasi yang digunakan." required><input className="input" maxLength={150} value={form.location} onChange={e=>update('location',e.target.value)} placeholder="Tulis lokasi atau unit yang terdampak"/></Field></div>}
    {step===1&&<div className="form-stack"><Field label="Judul kendala" hint="Ringkas dan spesifik. Contoh: Printer barcode loket 2 tidak merespons." required><input className="input" minLength={5} maxLength={255} value={form.subject} onChange={e=>update('subject',e.target.value)} placeholder="Apa kendala utama yang terjadi?"/></Field><Field label="Rincian kendala" hint={form.description.length+' / 10.000 karakter · Jelaskan kapan terjadi, dampak, dan upaya yang sudah dilakukan.'} required><textarea className="input" rows={6} minLength={20} maxLength={10000} value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Sejak kapan masalah terjadi? Siapa yang terdampak? Apa yang sudah Anda coba?"/></Field><fieldset><legend className="field-label mb-3">Dampak / prioritas</legend><div className="priority-options">{(['Low','Medium','High','Urgent'] as TicketPriority[]).map(priority=><label key={priority} className={'priority-option '+(form.priority===priority?'selected':'')}><input type="radio" name="priority" value={priority} checked={form.priority===priority} onChange={()=>update('priority',priority)}/><Priority value={priority}/><small>{descriptions[priority]}</small></label>)}</div></fieldset><div><span className="field-label">Lampiran bukti <span className="font-normal text-slate-500">(opsional)</span></span><label className="upload-zone mt-3" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!reading)void addFiles(event.dataTransfer.files);}}><Upload size={23}/><strong>{reading?'Membaca berkas…':'Pilih atau tarik berkas ke sini'}</strong><span>JPG, PNG, PDF · Maks. 5 berkas · Total 10 MB</span><input className="sr-only" aria-label="Pilih lampiran bukti" type="file" accept="image/jpeg,image/png,application/pdf" multiple disabled={reading} onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/></label>{attachments.map((file,index)=><div className="attachment-row" key={index}><Paperclip size={17}/><div><strong>{file.name}</strong><div className="muted">{file.size}</div></div><button className="icon-button" aria-label={'Hapus lampiran '+file.name} onClick={()=>setAttachments(previous=>previous.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></div>)}</div></div>}
    {step===2&&<div><dl className="summary-list"><dt>Pelapor</dt><dd>{user?.name}<div className="muted">{user?.email}</div></dd><dt>Kantor</dt><dd>{user?.office_name}</dd><dt>Layanan</dt><dd>{group.name}<div className="muted">{form.topic}</div></dd><dt>Lokasi</dt><dd>{form.location}</dd><dt>Prioritas</dt><dd><Priority value={form.priority}/></dd><dt>Judul</dt><dd className="font-semibold">{form.subject}</dd><dt>Kendala</dt><dd>{form.description}</dd><dt>Lampiran</dt><dd>{attachments.length?attachments.map(file=><div key={file.name}>{file.name}</div>):'Tidak ada lampiran'}</dd><dt>Ditujukan ke</dt><dd>{group.uptUnit}</dd></dl><div className="info-notice mt-6">Laporan akan tercatat atas nama akun Anda. Pastikan lampiran tidak memuat kata sandi, OTP, atau data yang tidak diperlukan.</div></div>}
    <ErrorNotice message={error}/><div className="form-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>{setError('');if(step>0)setStep(previous=>previous-1);else{setForm(initial);setAttachments([]);sessionStorage.removeItem(draftKey);}}}>{step===0?'Kosongkan draf':'Kembali'}</button>{step<2?<button className="btn btn-primary" onClick={next} disabled={reading || !validOffice}>Lanjutkan<ArrowRight size={15}/></button>:<button className="btn btn-primary" onClick={submit} disabled={busy}>{busy?'Mengirim laporan…':'Kirim laporan'}<Send size={15}/></button>}</div><p className="field-hint mt-4">Draf teks tersimpan sementara pada tab ini. Lampiran perlu dipilih ulang jika halaman dimuat ulang.</p></section>
    <aside className="form-help"><Lightbulb className="text-teal-700 mb-4" size={22}/><strong>Laporan yang jelas, respons lebih tepat</strong><p>{group.tip}</p><div className="border-t border-teal-900/10 my-5"/><FileText size={19} className="text-teal-700 mb-3"/><strong>Unit penanganan</strong><p>{group.uptUnit}</p><p>Anda dapat mengikuti perubahan status dan berkomunikasi dengan petugas dari halaman detail tiket.</p></aside></div>
  </div>}</AppShell>;
};
