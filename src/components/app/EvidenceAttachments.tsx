import React from 'react';
import { Download, Paperclip } from 'lucide-react';
import { ParsedAttachment } from '../../utils/ticketFormatter';

export function EvidenceAttachments({ files }: { files: ParsedAttachment[] }) {
  const download = (file: ParsedAttachment) => {
    if (!file.dataUrl || !/^data:(image\/(png|jpeg)|application\/pdf);base64,/.test(file.dataUrl)) return;
    const [header,content]=file.dataUrl.split(',');
    const bytes=Uint8Array.from(atob(content),char=>char.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:header.slice(5,header.indexOf(';'))}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=file.name||'lampiran';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div>{files.map((file,index)=>{
    const embedded=Boolean(file.dataUrl && /^data:(image\/(png|jpeg)|application\/pdf);base64,/.test(file.dataUrl));
    const image=Boolean(file.dataUrl && /^data:image\/(png|jpeg);base64,/.test(file.dataUrl));
    const external=file.url && /^https?:\/\//i.test(file.url);
    return <div className="attachment-row flex-wrap" key={index}><Paperclip size={16}/><div><strong>{file.name||'Lampiran bukti'}</strong><p className="muted">{file.size||'Berkas tersimpan'}</p></div>{embedded?<button className="icon-button" aria-label={'Unduh '+file.name} onClick={()=>download(file)}><Download size={16}/></button>:external?<a className="btn btn-secondary" href={file.url} target="_blank" rel="noreferrer noopener">Buka tautan sumber</a>:<span className="muted">Berkas tidak tersedia</span>}{image&&<details className="basis-full"><summary className="text-xs text-teal-700 cursor-pointer">Lihat gambar</summary><img alt={file.name||'Bukti kendala'} src={file.dataUrl} className="mt-3 max-h-80 rounded-lg object-contain" loading="lazy"/></details>}</div>;
  })}</div>;
}
