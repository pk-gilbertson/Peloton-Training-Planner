function normalizedKey(s) {
  return String(s || '').toLowerCase().replace(/^\uFEFF/, '').replace(/[^a-z0-9]+/g, '');
}

function buildColumnMap(row) {
  const byNorm = new Map();
  Object.keys(row || {}).forEach(k => byNorm.set(normalizedKey(k), k));
  const map = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const found = byNorm.get(normalizedKey(alias));
      if (found) { map[field] = found; break; }
    }
  }
  return map;
}

function getMapped(row, map, field) {
  const key = map[field];
  return key ? row[key] : '';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '"') {
      if (inQuotes && n === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      row.push(cell); cell = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && n === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(v => String(v).trim() !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim().replace(/^\uFEFF/, ''));
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

function num(value) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace('%', '').replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseMinutes(value) {
  const s = String(value || '').trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return num(s);
  const parts = s.split(':').map(Number);
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] + parts[1] / 60;
  if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1] + parts[2] / 60;
  return num(s);
}

function parsePelotonDate(value) {
  const s = String(value || '').trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

