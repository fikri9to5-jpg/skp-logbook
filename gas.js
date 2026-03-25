// ╔══════════════════════════════════════════════════════════════╗
// ║         GOOGLE APPS SCRIPT — Laporan Bulanan                ║
// ║  Copy-paste seluruh file ini ke Google Apps Script           ║
// ╚══════════════════════════════════════════════════════════════╝

// ── KONFIGURASI — ISI SESUAI KEBUTUHAN ANDA ──────────────────────
const CONFIG = {
  SPREADSHEET_ID: '',       // Kosongkan = buat otomatis. Atau isi ID spreadsheet Anda
  DRIVE_FOLDER_ID: '',      // Kosongkan = buat otomatis. Atau isi ID folder Drive Anda
  SHEET_NAME: 'Logbook',    // Nama sheet di spreadsheet
};
// ─────────────────────────────────────────────────────────────────

// ── ENTRY POINT: GET ─────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || '';

  if (action === 'ping') {
    return jsonResponse({ status: 'ok', message: 'Google Sheets terhubung!' });
  }

  if (action === 'getEntries') {
    const month = parseInt(e.parameter.month);
    const year  = parseInt(e.parameter.year);
    return jsonResponse({ status: 'ok', data: getEntries(month, year) });
  }

  return jsonResponse({ status: 'ok', message: 'Laporan Bulanan API aktif.' });
}

// ── ENTRY POINT: POST ─────────────────────────────────────────────
function doPost(e) {
  try {
    const action = e.parameter.action || '';

    if (action === 'addEntry') {
      const entry = JSON.parse(e.parameter.entry);
      const files = e.parameters.files || [];

      // Simpan entri ke Sheets
      saveEntryToSheet(entry);

      // Upload file ke Drive jika ada
      const uploadedFiles = [];
      if (e.postData && e.postData.contents) {
        // File upload handling (jika dikirim sebagai multipart)
        // Catatan: GAS tidak support multipart langsung, gunakan base64
      }

      return jsonResponse({ status: 'ok', message: 'Entri tersimpan!', files: uploadedFiles });
    }

    if (action === 'addEntryWithFiles') {
      const data = JSON.parse(e.postData.contents);
      saveEntryToSheet(data.entry);

      // Upload files (base64 encoded)
      const uploadedFiles = [];
      if (data.files && data.files.length > 0) {
        const folder = getDriveFolder();
        data.files.forEach(f => {
          try {
            const bytes = Utilities.base64Decode(f.data);
            const blob  = Utilities.newBlob(bytes, f.type, f.name);
            const file  = folder.createFile(blob);
            uploadedFiles.push({ name: f.name, url: file.getUrl(), id: file.getId() });
          } catch(err) {
            Logger.log('File upload error: ' + err.message);
          }
        });
      }

      return jsonResponse({ status: 'ok', message: 'Entri & file tersimpan!', files: uploadedFiles });
    }

    return jsonResponse({ status: 'error', message: 'Action tidak dikenal: ' + action });

  } catch(err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ── SPREADSHEET ───────────────────────────────────────────────────
function getSpreadsheet() {
  let ss;
  if (CONFIG.SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  } else {
    // Cari spreadsheet yang sudah ada
    const files = DriveApp.getFilesByName('Logbook Laporan Bulanan');
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
      CONFIG.SPREADSHEET_ID = ss.getId();
    } else {
      // Buat baru
      ss = SpreadsheetApp.create('Logbook Laporan Bulanan');
      CONFIG.SPREADSHEET_ID = ss.getId();
      Logger.log('Spreadsheet baru dibuat: ' + ss.getUrl());
    }
  }
  return ss;
}

function getSheet() {
  const ss    = getSpreadsheet();
  let sheet   = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    // Header row
    const headers = ['ID', 'Tanggal', 'Periode', 'Kegiatan', 'Detail', 'Kategori', 'File', 'Timestamp'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1A1916')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(4, 250);
    sheet.setColumnWidth(5, 350);
  }
  return sheet;
}

function saveEntryToSheet(entry) {
  const sheet = getSheet();
  const row = [
    entry.id,
    entry.t,                        // tanggal
    entry.per,                       // periode
    entry.k,                         // kegiatan
    entry.d || '',                   // detail
    (entry.kat || []).join(', '),    // kategori
    (entry.f   || []).join(', '),    // file names
    entry.ts || new Date().toISOString()
  ];
  sheet.appendRow(row);

  // Auto-format baris baru
  const lastRow = sheet.getLastRow();
  if (lastRow % 2 === 0) {
    sheet.getRange(lastRow, 1, 1, row.length).setBackground('#F7F6F2');
  }
}

function getEntries(month, year) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row  = data[i];
    const date = new Date(row[1]);
    if (!isNaN(date) && date.getMonth() === month && date.getFullYear() === year) {
      results.push({
        id:  row[0],
        t:   row[1],
        per: row[2],
        k:   row[3],
        d:   row[4],
        kat: row[5] ? row[5].split(', ') : [],
        f:   row[6] ? row[6].split(', ') : [],
        ts:  row[7]
      });
    }
  }
  return results;
}

// ── GOOGLE DRIVE ──────────────────────────────────────────────────
function getDriveFolder() {
  if (CONFIG.DRIVE_FOLDER_ID) {
    return DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  }

  // Cari folder yang sudah ada
  const folders = DriveApp.getFoldersByName('Lampiran Laporan Bulanan');
  if (folders.hasNext()) {
    const folder = folders.next();
    CONFIG.DRIVE_FOLDER_ID = folder.getId();
    return folder;
  }

  // Buat folder baru
  const folder = DriveApp.createFolder('Lampiran Laporan Bulanan');
  CONFIG.DRIVE_FOLDER_ID = folder.getId();
  Logger.log('Folder Drive baru dibuat: ' + folder.getUrl());
  return folder;
}

// ── UTILITIES ─────────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── SETUP — Jalankan fungsi ini sekali untuk inisialisasi ─────────
function setup() {
  const ss     = getSpreadsheet();
  const sheet  = getSheet();
  const folder = getDriveFolder();
  Logger.log('=== SETUP BERHASIL ===');
  Logger.log('Spreadsheet: ' + ss.getUrl());
  Logger.log('Sheet: ' + sheet.getName());
  Logger.log('Drive Folder: ' + folder.getUrl());
  Logger.log('Salin URL-URL di atas dan simpan.');
}
