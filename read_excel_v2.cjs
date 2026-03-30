const XLSX = require('xlsx');
const fs = require('fs');

const FILE_PATH = 'data.xlsb';
const SHEET_NAME = 'Tarefas';

try {
  const buf = fs.readFileSync(FILE_PATH);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    console.error(`Sheet "${SHEET_NAME}" not found. Available:`, workbook.SheetNames);
    process.exit(1);
  }

  // Use raw: false to avoid formula issues if possible
  const rows = XLSX.utils.sheet_to_json(sheet, { range: 1, header: 1, raw: false }).slice(0, 10);
  console.log('--- Headers (Row 2) ---');
  console.log(rows[0]);
  console.log('--- Data (Rows 3+) ---');
  console.log(rows.slice(1));
} catch (err) {
  console.error('Error reading file:', err);
}
