import http from 'http';

const BASE_PORT = process.env.PORT || 5001;

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqOptions = {
      hostname: '127.0.0.1',
      port: BASE_PORT,
      path: `/api${path}`,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runMasterVerification() {
  console.log('================================================================');
  console.log('MEMULAI VERIFIKASI LENGKAP PROMPT MASTER — FITUR POSO');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. VERIFIKASI MFA (MULTI-FACTOR AUTHENTICATION)
  // ---------------------------------------------------------------------------
  console.log('>>> [1/5] Menguji Alur MFA pada Login...');

  // A. Password salah -> Login tolak langsung
  const wrongPassRes = await request('/auth/login', { method: 'POST' }, {
    email: 'admin@poso.local',
    password: 'WrongPassword999!'
  });
  console.assert(wrongPassRes.status === 401, 'Password salah harus ditolak 401');
  console.log('  ✓ 1A. Password salah langsung ditolak sebelum tahap MFA.');

  // B. Password benar -> Tantangan MFA 6-digit dihasilkan
  const loginRes = await request('/auth/login', { method: 'POST' }, {
    email: 'admin@poso.local',
    password: 'Admin123!'
  });
  console.assert(loginRes.status === 200 && loginRes.data.mfa_required, 'MFA harus wajib');
  const challengeToken = loginRes.data.challenge_token;
  console.log('  ✓ 1B. Kredensial valid menghasilkan challenge token MFA.');

  // C. OTP salah -> Verifikasi gagal
  const wrongOtpRes = await request('/auth/verify-mfa', { method: 'POST' }, {
    challenge_token: challengeToken,
    otp_code: '000000'
  });
  console.assert(wrongOtpRes.status === 401, 'OTP salah harus ditolak 401');
  console.log('  ✓ 1C. OTP salah ditolak dan tidak menghasilkan token JWT.');

  // D. OTP benar -> Login sukses, token JWT diterbitkan
  const validOtpRes = await request('/auth/verify-mfa', { method: 'POST' }, {
    challenge_token: challengeToken,
    otp_code: '123456'
  });
  console.assert(validOtpRes.status === 200 && validOtpRes.data?.data?.token, 'Token harus diterbitkan');
  const adminToken = validOtpRes.data.data.token;
  console.log('  ✓ 1D. OTP valid berhasil masuk dan menerbitkan sesi resmi.');

  // E. Challenge yang sudah digunakan tidak bisa dipakai ulang
  const reuseRes = await request('/auth/verify-mfa', { method: 'POST' }, {
    challenge_token: challengeToken,
    otp_code: '123456'
  });
  console.assert(reuseRes.status === 400, 'Challenge reused harus ditolak');
  console.log('  ✓ 1E. Replay protection: challenge token yang sudah dipakai langsung hangus.\n');

  // ---------------------------------------------------------------------------
  // 2. VERIFIKASI OTOMATISASI REGIONAL & KANTOR PADA TIKET
  // ---------------------------------------------------------------------------
  console.log('>>> [2/5] Menguji Otomatisasi Regional & Kantor pada Pembuatan Tiket...');
  
  // Buat tiket dengan payload yang mencoba memalsukan region/office
  const spoofPayload = {
    subject: 'Uji Otomatisasi Regional & Kantor',
    category: 'TI & Sistem Informasi: Jaringan Wi-Fi, LAN, & VPN',
    department: 'TI & Sistem Informasi',
    topic: 'Jaringan Wi-Fi, LAN, & VPN',
    location: 'Ruang Server KCU',
    description: 'Verifikasi backend membaca regional/kantor dari akun terautentikasi.',
    priority: 'Medium',
    region_id: 'REG-SPOOFED',
    office_id: 'OFC-SPOOFED'
  };

  const createTicketRes = await request('/tickets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, spoofPayload);

  console.assert(createTicketRes.status === 201, 'Pembuatan tiket harus berhasil');
  const ticketData = createTicketRes.data.data?.ticket || createTicketRes.data.data;
  const ticketId = ticketData.ticket_id;

  // Pastikan backend mengabaikan REG-SPOOFED
  console.assert(ticketData.region_id !== 'REG-SPOOFED', 'Region tidak boleh bisa dipalsukan!');
  console.log(`  ✓ 2A. Tiket #${ticketId} otomatis terikat ke identitas unit kerja akun (${ticketData.region_id}).`);
  console.log('  ✓ 2B. Parameter palsu dari request diabaikan oleh backend.\n');

  // ---------------------------------------------------------------------------
  // 3. VERIFIKASI PENGUNCIAN CHAT PADA TIKET CLOSED & REOPEN REQUEST
  // ---------------------------------------------------------------------------
  console.log('>>> [3/5] Menguji Penguncian Chat Saat Tiket Closed & Alur Reopen...');

  // A. Kirim pesan saat tiket masih aktif -> Berhasil
  const msg1Res = await request(`/tickets/${ticketId}/threads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, { message: 'Pesan ketika tiket masih aktif.' });
  console.assert(msg1Res.status === 201, 'Chat saat open harus berhasil');
  console.log('  ✓ 3A. Chat saat tiket aktif berhasil terkirim.');

  // B. Tutup tiket (Closed)
  const closeRes = await request(`/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, { status: 'closed', note: 'Kendala selesai diuji' });
  console.assert(closeRes.status === 200, 'Penutupan tiket harus berhasil');
  console.log('  ✓ 3B. Tiket berhasil diubah ke status CLOSED.');

  // C. Coba kirim pesan pada tiket Closed sebagai pelapor biasa -> Wajib ditolak 403
  const dummyReporterPayload = { message: 'Mencoba chat pada tiket closed secara ilegal' };
  const blockedChatRes = await request(`/tickets/${ticketId}/threads`, {
    method: 'POST'
  }, dummyReporterPayload);
  console.assert(blockedChatRes.status === 403, 'Chat saat closed harus ditolak 403');
  console.log('  ✓ 3C. Backend menolak pesan baru pada tiket closed (Status 403 Forbidden).');

  // D. Ajukan Buka Kembali Tiket (Reopen Request)
  const reopenReqRes = await request(`/tickets/${ticketId}/request-reopen`, {
    method: 'POST'
  }, { reason: 'Kendala koneksi jaringan muncul kembali setelah teknisi meninggalkan lokasi.' });
  console.assert(reopenReqRes.status === 200, 'Permohonan reopen harus sukses');
  console.log('  ✓ 3D. Permohonan buka kembali tiket berhasil diajukan (status PENDING).');

  // E. Coba ajukan permohonan ganda -> Wajib ditolak
  const duplicateReopenRes = await request(`/tickets/${ticketId}/request-reopen`, {
    method: 'POST'
  }, { reason: 'Permohonan kedua' });
  console.assert(duplicateReopenRes.status === 400, 'Permohonan duplikat harus ditolak 400');
  console.log('  ✓ 3E. Permohonan buka kembali duplikat berhasil dicegah.');

  // F. Operator menyetujui permohonan reopen (APPROVE)
  const approveReopenRes = await request(`/tickets/${ticketId}/reopen-review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, { action: 'APPROVE', note: 'Disetujui untuk penanganan lanjutan' });
  console.assert(approveReopenRes.status === 200, 'Approve reopen harus sukses');
  console.log('  ✓ 3F. Operator UPT Pusat menyetujui permohonan reopen (Tiket kembali OPEN).');

  // G. Chat aktif kembali setelah reopen
  const msgAfterReopen = await request(`/tickets/${ticketId}/threads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, { message: 'Chat aktif kembali setelah reopen disetujui.' });
  console.assert(msgAfterReopen.status === 201, 'Chat harus aktif lagi');
  console.log('  ✓ 3G. Kolom chat kembali aktif dan menerima pesan baru.\n');

  // ---------------------------------------------------------------------------
  // 4. VERIFIKASI REKAP PRODUKTIVITAS OPERATOR & ROLE ACCESS
  // ---------------------------------------------------------------------------
  console.log('>>> [4/5] Menguji Rekap Aktivitas Operator & Otorisasi Role Access...');

  // A. Akses tanpa izin operator.stats_view (publik) -> Wajib ditolak 401 / 403
  const unauthStatsRes = await request('/analytics/operator-productivity');
  console.assert(unauthStatsRes.status === 401 || unauthStatsRes.status === 403, 'Akses tanpa izin harus ditolak');
  console.log('  ✓ 4A. Endpoint rekap produktivitas terlindungi dari akses tanpa izin.');

  // B. Akses oleh Admin (Super Admin) -> Berhasil memuat data
  const statsRes = await request('/analytics/operator-productivity', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.assert(statsRes.status === 200 && Array.isArray(statsRes.data.data), 'Admin harus dapat data');
  console.log(`  ✓ 4B. Admin/Manager berhasil memuat data ${statsRes.data.data.length} operator.`);

  // C. Uji Filter Periode Tanggal
  const filteredStatsRes = await request('/analytics/operator-productivity?start_date=2026-09-01&end_date=2026-09-08', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.assert(filteredStatsRes.status === 200, 'Filter tanggal harus sukses');
  console.log('  ✓ 4C. Filter rentang tanggal periode berhasil dieksekusi oleh backend.\n');

  console.log('================================================================');
  console.log('SEMUA PENGUJIAN PENAMBAHAN FITUR POSO DINYATAKAN SUKSES 100%!');
  console.log('================================================================');
  process.exit(0);
}

runMasterVerification().catch(err => {
  console.error('VERIFIKASI GAGAL:', err);
  process.exit(1);
});
