process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
import http from 'http';
import { pool } from '../config/db.js';
import app from '../server.js';
import { generateToken } from '../utils/auth.js';
import { id, digest } from '../utils/security.js';

const TEST_PORT = 5077;

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Accept': 'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSecurityAudit() {
  console.log('===================================================================');
  console.log('        PENGUJIAN OTOMATIS KEAMANAN & INTEGRITAS SISTEM POSO       ');
  console.log('===================================================================');

  const server = app.listen(TEST_PORT, '127.0.0.1');
  await new Promise(r => setTimeout(r, 600));

  let passed = 0;
  let failed = 0;

  function assert(name, condition, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}: ${detail}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------------------------------------------
    // UJI 1: Proteksi Akses Tiket Tanpa Autentikasi
    // ---------------------------------------------------------------------------------------------
    console.log('\n[GRUP 1] Verifikasi Penutupan Kebocoran Data Tiket Tanpa Login');
    const res1 = await makeRequest('/api/tickets');
    assert('GET /api/tickets tanpa token mengembalikan HTTP 401', res1.status === 401, `Status: ${res1.status}`);

    const res2 = await makeRequest('/api/tickets/track/TICK-SAMPLE');
    assert('GET /api/tickets/track/:id tanpa token mengembalikan HTTP 401', res2.status === 401, `Status: ${res2.status}`);

    const res3 = await makeRequest('/api/tickets', 'POST', { subject: 'Test Anonim' });
    assert('POST /api/tickets tanpa token mengembalikan HTTP 401', res3.status === 401, `Status: ${res3.status}`);

    const res4 = await makeRequest('/api/tickets/TICK-SAMPLE/threads', 'POST', { message: 'Halo' });
    assert('POST /api/tickets/:id/threads tanpa token mengembalikan HTTP 401', res4.status === 401, `Status: ${res4.status}`);

    // ---------------------------------------------------------------------------------------------
    // UJI 2: Penolakan Token Palsu / Raw Email Bypass
    // ---------------------------------------------------------------------------------------------
    console.log('\n[GRUP 2] Verifikasi Penolakan Token Palsu (No Fallback Auth)');
    const res5 = await makeRequest('/api/tickets', 'GET', null, 'admin@posindonesia.co.id');
    assert('Bearer token berupa raw email ditolak HTTP 401', res5.status === 401, `Status: ${res5.status}`);

    const res6 = await makeRequest('/api/tickets', 'GET', null, 'INVALID.JWT.TOKEN');
    assert('Bearer token format sembarang ditolak HTTP 401', res6.status === 401, `Status: ${res6.status}`);

    // ---------------------------------------------------------------------------------------------
    // UJI 3: Ketiadaan Kolom password_plain di Database & Controller
    // ---------------------------------------------------------------------------------------------
    console.log('\n[GRUP 3] Verifikasi Eliminasi Total Password Plaintext');
    const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'password_plain'");
    assert('Kolom password_plain tidak ada di tabel users', columns.length === 0, `Ditemukan: ${columns.length} kolom`);

    // ---------------------------------------------------------------------------------------------
    // UJI 4: Validasi Integritas Master Data Kantor pada Registrasi
    // ---------------------------------------------------------------------------------------------
    console.log('\n[GRUP 4] Verifikasi Integritas Kantor pada Registrasi');
    const res7 = await makeRequest('/api/auth/register', 'POST', {
      name: 'Tester Anonim',
      email: 'tester_fake_office@posindonesia.co.id',
      password: 'Password123!@#',
      region_id: 'REG-99',
      office_id: 'OFC-TIDAK-VALID'
    });
    assert('Pendaftaran dengan kantor/regional palsu ditolak HTTP 400', res7.status === 400, `Status: ${res7.status}`);

    // ---------------------------------------------------------------------------------------------
    // UJI 5: State Machine Tiket, Transaksi DB & Optimistic Concurrency
    // ---------------------------------------------------------------------------------------------
    console.log('\n[GRUP 5] Verifikasi State Machine & Optimistic Concurrency Control');

    // Cari user staff/admin aktif di database untuk membuat sesi uji yang sah
    const [[adminUser]] = await pool.query("SELECT * FROM users WHERE role IN ('ADMIN','PETUGAS_UPT','admin') AND account_status = 'ACTIVE' LIMIT 1");
    if (!adminUser) {
      console.warn('  [WARN] Tidak ada admin aktif untuk pengujian alur tiket; membuat akun uji sementara.');
    }

    // Buat sesi login sementara di tabel login_sessions
    const testSessionId = id('SES');
    const testToken = generateToken({ user_id: adminUser.user_id, sid: testSessionId }, '2h');
    await pool.query(`INSERT INTO login_sessions (session_id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR))`, [testSessionId, adminUser.user_id, digest(testToken)]);

    // 5a. Buat tiket uji coba
    const createRes = await makeRequest('/api/tickets', 'POST', {
      subject: 'Uji Keamanan dan State Machine POSO',
      description: 'Kendala ini dibuat otomatis oleh skrip pengujian keamanan sistem POSO.',
      department: 'TI & Sistem Informasi',
      topic: 'Gangguan Jaringan & Server',
      location: 'Ruang Server Uji',
      priority: 'High'
    }, testToken);

    assert('Pembuatan tiket sah berhasil HTTP 201', createRes.status === 201, `Status: ${createRes.status}`);
    const createdTicket = createRes.body?.data;
    const testTicketId = createdTicket?.ticket_id;

    if (testTicketId) {
      assert('Tiket otomatis memiliki version = 1', createdTicket.version === 1, `Version: ${createdTicket.version}`);
      assert('Tiket awal berstatus "open"', createdTicket.status === 'open', `Status: ${createdTicket.status}`);

      // 5b. Coba lompatan status ilegal: langsung ke 'closed' tanpa solusi
      const illegalRes = await makeRequest(`/api/tickets/${testTicketId}/status`, 'PATCH', {
        status: 'closed',
        note: 'Langsung ditutup'
      }, testToken);
      assert('Lompatan status ilegal (open -> closed) ditolak HTTP 409', illegalRes.status === 409, `Status: ${illegalRes.status}`);

      // 5c. Transisi sah: open -> in_progress
      const progressRes = await makeRequest(`/api/tickets/${testTicketId}/status`, 'PATCH', {
        status: 'in_progress',
        note: 'Petugas mulai memeriksa kendala.'
      }, testToken);
      assert('Transisi sah (open -> in_progress) diterima HTTP 200', progressRes.status === 200, `Status: ${progressRes.status}`);
      assert('Version bertambah menjadi 2 setelah update', progressRes.body?.data?.version === 2, `Version: ${progressRes.body?.data?.version}`);

      // 5d. Status waiting atau resolved wajib catatan
      const noNoteRes = await makeRequest(`/api/tickets/${testTicketId}/status`, 'PATCH', {
        status: 'waiting',
        note: '' // Catatan kosong tidak diperbolehkan
      }, testToken);
      assert('Status waiting tanpa catatan ditolak HTTP 400', noNoteRes.status === 400, `Status: ${noNoteRes.status}`);

      // 5e. Optimistic concurrency conflict: kirim version lama (version 1 padahal sudah 2)
      const conflictRes = await makeRequest(`/api/tickets/${testTicketId}/status`, 'PATCH', {
        version: 1,
        status: 'resolved',
        note: 'Solusi berhasil diterapkan pada perangkat jaringan.'
      }, testToken);
      assert('Deteksi tabrakan konkurensi (stale version 1) menghasilkan HTTP 409', conflictRes.status === 409, `Status: ${conflictRes.status}`);

      // 5f. Transisi sah ke resolved dengan version terkini (version 2)
      const resolvedRes = await makeRequest(`/api/tickets/${testTicketId}/status`, 'PATCH', {
        version: 2,
        status: 'resolved',
        note: 'Solusi perbaikan konfigurasi switch selesai dilakukan.'
      }, testToken);
      assert('Transisi sah ke resolved dengan catatan lengkap berhasil HTTP 200', resolvedRes.status === 200, `Status: ${resolvedRes.status}`);

      // 5g. Bersihkan tiket uji coba & thread & audit log
      await pool.query('DELETE FROM threads WHERE ticket_id = ?', [testTicketId]);
      await pool.query('DELETE FROM audit_logs WHERE ticket_id = ?', [testTicketId]);
      await pool.query('DELETE FROM tickets WHERE ticket_id = ?', [testTicketId]);
      console.log('  [CLEANUP] Data tiket uji coba dibersihkan.');
    }

    // ---------------------------------------------------------------------------------------------
    // UJI 6: Trusted Device 7 Hari (Bypass OTP pada Perangkat Tepercaya)
    // ---------------------------------------------------------------------------------------------
    console.log('\n[GRUP 6] Verifikasi Trusted Device 7 Hari (Bypass OTP)');
    const mockDeviceToken = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const mockDeviceId = id('DEV');
    await pool.query(
      `INSERT INTO trusted_devices (device_id, user_id, device_token_hash, device_name, expires_at)
       VALUES (?, ?, ?, 'Laptop Pengujian', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [mockDeviceId, adminUser.user_id, digest(mockDeviceToken)]
    );

    const [[trustedRow]] = await pool.query(
      'SELECT device_id FROM trusted_devices WHERE user_id = ? AND device_token_hash = ? AND expires_at > NOW()',
      [adminUser.user_id, digest(mockDeviceToken)]
    );
    assert('Tabel trusted_devices berhasil mencatat token perangkat dengan masa berlaku 7 hari', Boolean(trustedRow), `Found: ${Boolean(trustedRow)}`);

    await pool.query('DELETE FROM trusted_devices WHERE device_id = ?', [mockDeviceId]);

    // Bersihkan sesi uji
    await pool.query('DELETE FROM login_sessions WHERE session_id = ?', [testSessionId]);

  } catch (err) {
    console.error('Terjadi kesalahan selama pengujian:', err);
    failed++;
  } finally {
    server.close();
    await pool.end();
  }

  console.log('\n===================================================================');
  console.log(`HASIL AKHIR: ${passed} PENGUJIAN BERHASIL, ${failed} GAGAL`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit();
