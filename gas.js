// ╔══════════════════════════════════════════════════════════════╗
// ║         GOOGLE APPS SCRIPT — Laporan Bulanan                ║
// ║  Copy-paste seluruh file ini ke Google Apps Script           ║
// ╚══════════════════════════════════════════════════════════════╝

// ── KONFIGURASI — ISI SESUAI KEBUTUHAN ANDA ──────────────────────
const CONFIG = {
  SPREADSHEET_ID: '1217iIk3ZTC2aodLqX1hXSZMUal0aCN7LemllwxuuBio',
  DRIVE_FOLDER_ID: '1Vp4kOQ5JOK4wKP9-0Wl3tah7zYTw4VYs',
  SHEET_NAME: 'Logbook',
  TEMPLATE_DOC_ID: '1LWcpm8hQ43Pj2gx1aT0bwxZ_DUglb6GIljdVqtOLm2A', // ID template Google Docs Anda
  OUTPUT_FOLDER_NAME: 'Laporan Bulanan Generated', // Folder output di Drive
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
    const data = JSON.parse(e.postData.contents);
    const action = e.parameter.action || data.action || '';

    if (action === 'addEntryWithFiles') {
      const uploadedFiles = [];
      const fileLinks = [];

      if (data.files && data.files.length > 0) {
        const folder = getDriveFolder();
        data.files.forEach(f => {
          try {
            const bytes = Utilities.base64Decode(f.data);
            const blob  = Utilities.newBlob(bytes, f.type, f.name);
            const file  = folder.createFile(blob);
            uploadedFiles.push({ name: f.name, url: file.getUrl() });
            fileLinks.push(file.getUrl());
          } catch(err) {
            Logger.log('File upload error: ' + err.message);
          }
        });
      }

      saveEntryToSheet(data.entry, fileLinks);
      return jsonResponse({ status: 'ok', message: 'Entri & file tersimpan!', files: uploadedFiles });
    }

    if (action === 'generateDoc') {
      const result = generateLaporanDoc(data);
      return jsonResponse({ status: 'ok', docUrl: result.url, docId: result.id });
    }

    return jsonResponse({ status: 'error', message: 'Action tidak dikenal: ' + action });

  } catch(err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ── GENERATE LAPORAN KE GOOGLE DOCS ──────────────────────────────
function generateLaporanDoc(data) {
  const { entries, narasiRaw, bulanTahun, tanggalAkhir, nama, jabatan, month, year } = data;

  // 1. Buat salinan template
  const templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_DOC_ID);
  const outputFolder = getOutputFolder();
  const namaFile     = 'Laporan Bulanan ' + bulanTahun + ' - ' + (nama || 'Pelapor');
  const newFile      = templateFile.makeCopy(namaFile, outputFolder);
  const doc          = DocumentApp.openById(newFile.getId());
  const body         = doc.getBody();

  // 2. Ganti semua placeholder teks sederhana
  body.replaceText('\\{\\{BULAN_TAHUN\\}\\}', bulanTahun);
  body.replaceText('\\{\\{TANGGAL_AKHIR\\}\\}', tanggalAkhir);

  // 3. Isi Tabel 3 (tabel logbook per minggu)
  // Parse bagian [TABEL] dari output AI
  const tabelData = parseTabelFromAI(narasiRaw);

  // Cari tabel yang berisi placeholder {{NO}}
  const tables = body.getTables();
  let targetTable = null;
  for (let i = 0; i < tables.length; i++) {
    const tbl = tables[i];
    if (tbl.getText().indexOf('{{NO}}') !== -1) {
      targetTable = tbl;
      break;
    }
  }

  if (targetTable && tabelData.length > 0) {
    // Ambil baris placeholder (baris pertama setelah header)
    const templateRow = targetTable.getRow(1);

    // Isi baris pertama dengan data minggu pertama
    fillTableRow(templateRow, tabelData[0]);

    // Tambah baris untuk minggu selanjutnya
    for (let i = 1; i < tabelData.length; i++) {
      const newRow = targetTable.appendTableRow();
      // Copy style dari template row
      const noCell      = newRow.appendTableCell();
      const mingguCell  = newRow.appendTableCell();
      const kegiatanCell= newRow.appendTableCell();

      noCell.setText(String(i + 1));
      mingguCell.setText(tabelData[i].minggu);

      // Isi kegiatan sebagai paragraf terpisah per item
      kegiatanCell.setText('');
      tabelData[i].kegiatan.forEach((k, idx) => {
        if (idx === 0) {
          kegiatanCell.editAsText().setText('• ' + k);
        } else {
          kegiatanCell.appendParagraph('• ' + k);
        }
      });

      // Styling: center untuk no dan minggu
      noCell.setWidth(40);
      mingguCell.setWidth(120);
    }
  }

  // 4. Isi {{NARASI_KEGIATAN}} dengan narasi AI
  const narasiBersih = parseNarasiFromAI(narasiRaw);
  body.replaceText('\\{\\{NARASI_KEGIATAN\\}\\}', narasiBersih);

  // 5. Simpan dan tutup
  doc.saveAndClose();

  return { url: newFile.getUrl(), id: newFile.getId() };
}

// ── HELPER: ISI BARIS TABEL ───────────────────────────────────────
function fillTableRow(row, mingguData) {
  // Kolom 0: No
  row.getCell(0).setText('1');

  // Kolom 1: Minggu
  row.getCell(1).setText(mingguData.minggu);

  // Kolom 2: Kegiatan (bullet list)
  const kegCell = row.getCell(2);
  kegCell.setText('');
  mingguData.kegiatan.forEach((k, idx) => {
    if (idx === 0) {
      kegCell.editAsText().setText('• ' + k);
    } else {
      kegCell.appendParagraph('• ' + k);
    }
  });
}

// ── HELPER: PARSE BAGIAN [TABEL] DARI OUTPUT AI ───────────────────
function parseTabelFromAI(rawText) {
  // Ambil konten antara [TABEL] dan [/TABEL]
  const tabelMatch = rawText.match(/\[TABEL\]([\s\S]*?)\[\/TABEL\]/);
  if (!tabelMatch) return [];

  const tabelText = tabelMatch[1].trim();
  const lines     = tabelText.split('\n').map(l => l.trim()).filter(l => l);

  const result = [];
  let currentMinggu = null;

  lines.forEach(line => {
    // Deteksi baris "Minggu X:" atau "Minggu X Bulan:"
    if (/^Minggu\s+(I{1,3}V?|IV|VI{0,3}|IX|XI{0,2})/i.test(line)) {
      currentMinggu = { minggu: line.replace(/:$/, '').trim(), kegiatan: [] };
      result.push(currentMinggu);
    } else if (line.startsWith('-') && currentMinggu) {
      currentMinggu.kegiatan.push(line.replace(/^-\s*/, '').trim());
    }
  });

  return result;
}

// ── HELPER: PARSE BAGIAN [NARASI] DARI OUTPUT AI ─────────────────
function parseNarasiFromAI(rawText) {
  const narasiMatch = rawText.match(/\[NARASI\]([\s\S]*?)\[\/NARASI\]/);
  if (!narasiMatch) {
    // Fallback: kalau tidak ada tag, kembalikan semua teks
    return rawText.trim();
  }
  return narasiMatch[1].trim();
}

// ── HELPER: FOLDER OUTPUT ─────────────────────────────────────────
function getOutputFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.OUTPUT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(CONFIG.OUTPUT_FOLDER_NAME);
}

// ── SPREADSHEET ───────────────────────────────────────────────────
function getSpreadsheet() {
  let ss;
  if (CONFIG.SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  } else {
    const files = DriveApp.getFilesByName('Logbook Laporan Bulanan');
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
      CONFIG.SPREADSHEET_ID = ss.getId();
    } else {
      ss = SpreadsheetApp.create('Logbook Laporan Bulanan');
      CONFIG.SPREADSHEET_ID = ss.getId();
      Logger.log('Spreadsheet baru dibuat: ' + ss.getUrl());
    }
  }
  return ss;
}

function getSheet() {
  const ss  = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    const headers = ['ID', 'Tanggal', 'Periode', 'Kegiatan', 'Detail', 'Kategori', 'File 1', 'File 2', 'File 3', 'Timestamp'];
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

function saveEntryToSheet(entry, fileUrls = []) {
  const sheet = getSheet();

  const row = [
    entry.id,
    entry.t,
    entry.per,
    entry.k,
    entry.d || '',
    (entry.kat || []).join(', '),
  ];

  // File 1, 2, 3 di kolom terpisah sebagai hyperlink
  for (let i = 0; i < 5; i++) {
    row.push(fileUrls[i] || '');
  }

  row.push(entry.ts || new Date().toISOString());
  sheet.appendRow(row);

  const lastRow = sheet.getLastRow();

  // Buat hyperlink untuk tiap kolom file
  for (let i = 0; i < 5; i++) {
    if (fileUrls[i]) {
      const fileName = entry.f && entry.f[i] ? entry.f[i] : 'File ' + (i + 1);
      const kolom    = 7 + i;
      const cell     = sheet.getRange(lastRow, kolom);
      cell.setFormula(`=HYPERLINK("${fileUrls[i]}","${fileName}")`);
    }
  }

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
  const folders = DriveApp.getFoldersByName('Lampiran Laporan Bulanan');
  if (folders.hasNext()) {
    const folder = folders.next();
    CONFIG.DRIVE_FOLDER_ID = folder.getId();
    return folder;
  }
  const folder = DriveApp.createFolder('Lampiran Laporan Bulanan');
  CONFIG.DRIVE_FOLDER_ID = folder.getId();
  return folder;
}

// ── UTILITIES ─────────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── SETUP ─────────────────────────────────────────────────────────
function setup() {
  const ss     = getSpreadsheet();
  const sheet  = getSheet();
  const folder = getDriveFolder();
  const outFolder = getOutputFolder();
  Logger.log('=== SETUP BERHASIL ===');
  Logger.log('Spreadsheet: ' + ss.getUrl());
  Logger.log('Sheet: ' + sheet.getName());
  Logger.log('Drive Folder lampiran: ' + folder.getUrl());
  Logger.log('Drive Folder output laporan: ' + outFolder.getUrl());
}
