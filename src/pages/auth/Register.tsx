import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Brand } from '../../components/app/AppShell';
import { OrganizationFields } from '../../components/app/OrganizationFields';
import { ErrorNotice, Field } from '../../components/app/Primitives';
import { useAuth } from '../../context/AuthContext';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    nopen: '',
    position: 'Pengelola Agen',
    region_id: '',
    office_id: '',
    password: '',
    confirm: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const field = (name: keyof typeof form, value: string) =>
    setForm(previous => ({ ...previous, [name]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.phone.trim()) {
      setError('Nomor Handphone / WhatsApp wajib diisi untuk koordinasi akun.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Konfirmasi kata sandi belum sama.');
      return;
    }
    if (form.password.length < 12 || !/[a-zA-Z]/.test(form.password) || !/[^a-zA-Z]/.test(form.password)) {
      setError('Gunakan minimal 12 karakter, gabungkan huruf dengan angka atau simbol.');
      return;
    }
    setBusy(true);
    const result = await register({
      ...form,
      nip: form.nopen // backward compatibility
    });
    setBusy(false);
    if (result.success) setDone(true);
    else setError(result.message || 'Pendaftaran belum berhasil.');
  };

  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Brand />
        <div className="auth-copy">
          <div className="page-eyebrow" style={{ color: '#85d4c4' }}>
            PORTAL MITRA AGEN POS
          </div>
          <h1>
            Terhubung dengan
            <br />
            <em>tim helpdesk kami.</em>
          </h1>
          <p>
            Layanan penanganan kendala sistem, operasional transaksi, dan logistik terpadu untuk Mitra Agen Pos Indonesia.
          </p>
          <div className="auth-flow">
            <div>
              <span>01</span>Lengkapi data Agen Pos & kontak
            </div>
            <div>
              <span>02</span>Pilih Kantor Pos Pembina
            </div>
            <div>
              <span>03</span>Tunggu persetujuan akun
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-300 flex gap-2 items-center">
          <ShieldCheck size={16} />
          Layanan terpadu Mitra Agen Pos Indonesia
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-form auth-register">
          <div className="auth-mobile-brand">
            <Brand />
          </div>

          {done ? (
            <div className="form-stack">
              <CheckCircle2 size={42} className="text-teal-700" />
              <h2>Pendaftaran diterima</h2>
              <p className="page-description">
                Akun Agen Pos Anda sedang diverifikasi oleh administrator. Setelah disetujui, Anda dapat langsung masuk menggunakan email dan kata sandi yang telah didaftarkan.
              </p>
              <Link to="/login" className="btn btn-primary">
                Kembali ke halaman masuk
              </Link>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-link mb-5">
                <ArrowLeft size={15} />
                Kembali ke masuk
              </Link>

              <div className="page-eyebrow">PENDAFTARAN AKUN</div>
              <h2>Lengkapi data pendaftaran</h2>
              <p>
                Gunakan nomor HP aktif dan data Agen Pos yang valid untuk verifikasi akun.
              </p>

              <form onSubmit={submit} className="form-stack">
                <div className="form-grid">
                  <Field label="Nama lengkap (Pemilik / Penanggung Jawab)" required>
                    <input
                      className="input"
                      value={form.name}
                      onChange={e => field('name', e.target.value)}
                      autoComplete="name"
                      placeholder="Contoh: Budi Santoso"
                      maxLength={150}
                      required
                    />
                  </Field>

                  <Field label="ID User / No. Agen (Nopen)" hint="Nomor Pendirian Agen Pos">
                    <input
                      className="input"
                      value={form.nopen}
                      onChange={e => field('nopen', e.target.value)}
                      placeholder="Contoh: 6812345 / NOPEN-001"
                      maxLength={50}
                    />
                  </Field>
                </div>

                <div className="form-grid">
                  <Field label="Nomor Handphone / WhatsApp" required hint="Nomor aktif untuk verifikasi & koordinasi">
                    <input
                      className="input"
                      type="tel"
                      value={form.phone}
                      onChange={e => field('phone', e.target.value)}
                      autoComplete="tel"
                      placeholder="Contoh: 081234567890"
                      maxLength={25}
                      required
                    />
                  </Field>

                  <Field label="Alamat email aktif" required hint="Digunakan untuk masuk & menerima kode keamanan">
                    <input
                      className="input"
                      value={form.email}
                      onChange={e => field('email', e.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="nama@email.com"
                      maxLength={150}
                      required
                    />
                  </Field>
                </div>

                <Field label="Peran di Agen Pos" hint="Posisi Anda dalam operasional agen">
                  <input
                    className="input"
                    value={form.position}
                    onChange={e => field('position', e.target.value)}
                    placeholder="Contoh: Pemilik Agen / Pengelola / Petugas Loket"
                    maxLength={100}
                  />
                </Field>

                <OrganizationFields
                  region={form.region_id}
                  office={form.office_id}
                  onChange={(region_id, office_id) =>
                    setForm(previous => ({ ...previous, region_id, office_id }))
                  }
                />

                <div className="form-grid">
                  <Field
                    label="Kata sandi"
                    hint="Minimal 12 karakter; gabungkan huruf dan angka atau simbol."
                    required
                  >
                    <input
                      className="input"
                      value={form.password}
                      onChange={e => field('password', e.target.value)}
                      type="password"
                      minLength={12}
                      autoComplete="new-password"
                      required
                    />
                  </Field>

                  <Field label="Ulangi kata sandi" required>
                    <input
                      className="input"
                      value={form.confirm}
                      onChange={e => field('confirm', e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                </div>

                <ErrorNotice message={error} />

                <button className="btn btn-primary" disabled={busy}>
                  {busy ? 'Mengirim pendaftaran…' : 'Ajukan pendaftaran akun agen'}
                </button>

                <p className="field-hint">
                  Akun pendaftaran baru berperan sebagai pelapor kendala Agen Pos. Akses penuh akan aktif setelah disetujui administrator.
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
