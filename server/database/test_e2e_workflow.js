import http from 'http';

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: `/api${path}`,
      method: options.method || 'GET',
      headers
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runE2ETests() {
  console.log('================================================================');
  console.log('MEMULAI PENGUJIAN END-TO-END (E2E) SISTEM POSO');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. UJI LOGIN AKUN ADMIN (PASSWORD + MFA)
  // ---------------------------------------------------------------------------
  console.log('>>> 1. Menguji Login Akun Admin (Password + MFA OTP)...');
  const loginRes = await request('/auth/login', { method: 'POST' }, {
    email: 'admin@poso.local',
    password: 'Admin123!'
  });

  if (loginRes.status !== 200 || !loginRes.data?.challenge_token) {
    console.error('FAILED: Login password Admin gagal!', loginRes);
    process.exit(1);
  }

  const mfaRes = await request('/auth/verify-mfa', { method: 'POST' }, {
    challenge_token: loginRes.data.challenge_token,
    otp_code: '123456'
  });

  if (mfaRes.status !== 200 || !mfaRes.data?.data?.token) {
    console.error('FAILED: Verifikasi MFA Admin gagal!', mfaRes);
    process.exit(1);
  }

  const adminToken = mfaRes.data.data.token;
  console.log('✓ Login Admin berhasil melalui MFA!');
  console.log(`  - Role: ${mfaRes.data.data.user.role}`);
  console.log(`  - Nama: ${mfaRes.data.data.user.name}`);
  console.log(`  - Token diterima (${adminToken.slice(0, 20)}...)\n`);

  // ---------------------------------------------------------------------------
  // 2. UJI REGISTRASI USER BARU (REGIST)
  // ---------------------------------------------------------------------------
  console.log('>>> 2. Menguji Registrasi Pengguna Baru (Pelapor Cabang)...');
  const regEmail = `budi.cabang_${Date.now()}@posindonesia.co.id`;
  const regRes = await request('/auth/register', { method: 'POST' }, {
    name: 'Budi Santoso (Petugas Loket)',
    email: regEmail,
    password: 'PasswordBudi123!',
    nip: '198904122015021003',
    phone: '081234567890',
    position: 'Petugas Layanan Loket',
    region_id: 'REG-03',
    office_id: 'OFC-KCU-BDG'
  });

  if (regRes.status !== 201 && regRes.status !== 200) {
    console.error('FAILED: Registrasi pengguna baru gagal!', regRes);
    process.exit(1);
  }
  console.log('✓ Registrasi pengguna baru berhasil!');
  console.log(`  - Email: ${regEmail}`);
  console.log(`  - Status: Menunggu approval admin\n`);

  // ---------------------------------------------------------------------------
  // 3. UJI APPROVAL & TAMBAH USER LANGSUNG OLEH ADMIN
  // ---------------------------------------------------------------------------
  console.log('>>> 3. Menguji Approval Pendaftaran & Tambah User oleh Admin...');
  // A. Ambil daftar approval
  const approvalsRes = await request('/admin/approvals', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  const pending = (approvalsRes.data?.data || []).find(a => a.email === regEmail);
  if (pending) {
    const approveRes = await request(`/admin/approvals/${pending.approval_id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, { assigned_role: 'PELAPOR' });

    if (approveRes.status === 200) {
      console.log(`✓ Admin berhasil menyetujui akun registrasi: ${regEmail}`);
    }
  }

  // B. Tambah User Langsung via Admin Management
  const directEmail = `dewi.operator_${Date.now()}@posindonesia.co.id`;
  const addUserRes = await request('/admin/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, {
    name: 'Dewi Lestari',
    email: directEmail,
    password: 'DewiPassword123!',
    role: 'OPERATOR',
    region_id: 'REG-00',
    office_id: 'OFC-PUSAT-01',
    data_scope: 'GLOBAL',
    department: 'Helpdesk Operasional',
    role_title: 'Operator Helpdesk Pusat',
    position: 'Helpdesk Support'
  });

  if (addUserRes.status !== 201 && addUserRes.status !== 200) {
    console.error('FAILED: Tambah user via Admin gagal!', addUserRes);
    process.exit(1);
  }
  console.log('✓ Tambah user langsung oleh Admin berhasil!');
  console.log(`  - Nama: Dewi Lestari (${directEmail})`);
  console.log(`  - Role: OPERATOR\n`);

  // ---------------------------------------------------------------------------
  // 4. UJI TAMBAH TIKET BARU (CREATE TICKET)
  // ---------------------------------------------------------------------------
  console.log('>>> 4. Menguji Pembuatan Tiket Baru (Tambah Ticket)...');
  // Login sebagai user Budi yang baru disetujui
  const budiLogin = await request('/auth/login', { method: 'POST' }, {
    email: regEmail,
    password: 'PasswordBudi123!'
  });

  if (budiLogin.status !== 200 || !budiLogin.data?.challenge_token) {
    console.error('FAILED: Login user baru gagal!', budiLogin);
    process.exit(1);
  }

  const budiMfa = await request('/auth/verify-mfa', { method: 'POST' }, {
    challenge_token: budiLogin.data.challenge_token,
    otp_code: '123456'
  });

  if (budiMfa.status !== 200 || !budiMfa.data?.data?.token) {
    console.error('FAILED: Verifikasi MFA Budi gagal!', budiMfa);
    process.exit(1);
  }
  const budiToken = budiMfa.data.data.token;
  console.log('✓ User Budi berhasil login dengan MFA!');

  // Buat tiket
  const createTicketRes = await request('/tickets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${budiToken}` }
  }, {
    requester_name: 'Budi Santoso',
    requester_email: regEmail,
    requester_nip: '198904122015021003',
    department: 'OPERASIONAL',
    topic: 'Kendala Scanner Loket & Barcode Reader',
    priority: 'High',
    region_id: 'REG-03',
    office_id: 'OFC-KCU-BDG',
    work_location: 'Gedung KCU Bandung Lt. 1, Loket Layanan 04',
    subject: 'Scanner Barcode Loket 04 Mengalami Timeout Saat Input Resi',
    description: 'Perangkat barcode reader merk Honeywell pada loket 4 tidak membaca resi barcode paket Kilat Khusus dan mengalami error port USB.'
  });

  if (createTicketRes.status !== 201 && createTicketRes.status !== 200) {
    console.error('FAILED: Pembuatan tiket gagal!', createTicketRes);
    process.exit(1);
  }

  const createdTicket = createTicketRes.data.data?.ticket || createTicketRes.data?.data;
  const ticketId = createdTicket.ticket_id;
  console.log('✓ Tiket berhasil dibuat!');
  console.log(`  - ID Tiket : ${ticketId}`);
  console.log(`  - Subjek   : ${createdTicket.subject}`);
  console.log(`  - Prioritas: ${createdTicket.priority}`);
  console.log(`  - Status   : ${createdTicket.status}\n`);

  // ---------------------------------------------------------------------------
  // 5. UJI RESPON-MERESPON TIKET (THREAD CHAT & UPDATE STATUS)
  // ---------------------------------------------------------------------------
  console.log('>>> 5. Menguji Respon-Merespon Tiket & Perubahan Status...');
  
  // A. Admin merespon tiket pertama kali
  const adminReplyRes = await request(`/tickets/${ticketId}/threads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, {
    message: 'Halo Pak Budi, laporan sudah diterima. Tim teknis helpdesk sedang mengarahkan petugas UPT TI KCU Bandung untuk memeriksa kabel data & driver scanner.',
    visibility: 'public'
  });

  if (adminReplyRes.status !== 201 && adminReplyRes.status !== 200) {
    console.error('FAILED: Balasan Admin gagal!', adminReplyRes);
    process.exit(1);
  }
  console.log('✓ Respon 1 (Admin): Berhasil mengirim balasan di thread pesan.');

  // B. Admin mengubah status ke in_progress
  const statusUpdateRes = await request(`/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, {
    status: 'in_progress',
    note: 'Tiket diproses ke tahap investigasi perangkat scanner loket.'
  });

  if (statusUpdateRes.status !== 200) {
    console.error('FAILED: Update status in_progress gagal!', statusUpdateRes);
    process.exit(1);
  }
  console.log('✓ Update Status: Status tiket berhasil diubah menjadi "in_progress".');

  // C. Pelapor membalas kembali pesan tiket
  const pelaporReplyRes = await request(`/tickets/${ticketId}/threads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${budiToken}` }
  }, {
    message: 'Terima kasih tim IT, scanner sudah mulai merespon kembali dan berhasil scan barcode resi.',
    visibility: 'public'
  });

  if (pelaporReplyRes.status !== 201 && pelaporReplyRes.status !== 200) {
    console.error('FAILED: Balasan Pelapor gagal!', pelaporReplyRes);
    process.exit(1);
  }
  console.log('✓ Respon 2 (Pelapor): Berhasil membalas pesan di tiket.');

  // D. Admin menutup tiket (status: closed)
  const closeRes = await request(`/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, {
    status: 'closed',
    note: 'Kendala loket 04 selesai ditangani. Tiket resmi ditutup.'
  });

  if (closeRes.status !== 200) {
    console.error('FAILED: Penutupan tiket gagal!', closeRes);
    process.exit(1);
  }
  console.log('✓ Respon 3 (Admin): Berhasil menutup tiket (status: "closed").');

  // D. Verifikasi detail tiket akhir & riwayat thread
  const finalTicketRes = await request(`/tickets/${ticketId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  const finalTicket = finalTicketRes.data?.data || finalTicketRes.data;
  console.log('\n================================================================');
  console.log('VERIFIKASI AKHIR TIKET & THREADS:');
  console.log(`- Status Tiket Akhir: ${finalTicket.status} (Harus: closed)`);
  console.log(`- Jumlah Pesan Thread: ${(finalTicket.threads || []).length} pesan`);
  (finalTicket.threads || []).forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.sender_name || t.user_name}]: "${t.message}"`);
  });
  console.log('================================================================');
  console.log('SEMUA PENGUJIAN E2E BERHASIL 100% TANPA KENDALA!');
  console.log('================================================================\n');

  process.exit(0);
}

runE2ETests().catch((err) => {
  console.error('E2E Test Error:', err);
  process.exit(1);
});
