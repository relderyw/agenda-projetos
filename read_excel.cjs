const XLSX = require('xlsx');

const FILE_PATH = 'PROJETOS_2026 (102.103KI).xlsb';
const SHEET_NAME = 'Tarefas';

try {
  const workbook = XLSX.readFile(FILE_PATH);
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    console.error(`Sheet "${SHEET_NAME}" not found. Available:`, workbook.SheetNames);
    process.exit(1);
  }

  // Read range B2 to L... (based on screenshot)
  const rows = XLSX.utils.sheet_to_json(sheet, { range: 1, header: 1 }).slice(0, 10);
  console.log('--- Headers (Row 2) ---');
  console.log(rows[0]);
  console.log('--- Data (Rows 3+) ---');
  console.log(rows.slice(1));
} catch (err) {
  console.error('Error reading file:', err);
}
