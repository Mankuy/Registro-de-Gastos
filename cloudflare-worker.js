// ═══════════════════════════════════════════════════════════
//  CLOUDFLARE WORKER — Telegram Bot → Firestore
//  Procesa gastos por texto e imágenes (OCR con Claude)
// ═══════════════════════════════════════════════════════════
//
//  Variables de entorno (configurar en Cloudflare → Worker → Settings → Variables):
//    BOT_TOKEN         — Token del bot de Telegram
//    FIREBASE_API_KEY  — API Key de Firebase (la de firebaseConfig)
//    FIREBASE_EMAIL    — Email completo del usuario (ej: facu@gestor.hogar)
//    FIREBASE_PASSWORD — Contraseña del usuario
//    FIREBASE_PROJECT  — Project ID de Firebase (ej: registro-gastos-8a864)
//    FIREBASE_USER_ID  — UID de Firebase Auth del usuario
//    CLAUDE_API_KEY    — (opcional) API Key de Anthropic para OCR de imágenes
//    ACTIVE_PROFILE    — (opcional) ID del perfil activo, default: "familia"
//    ALLOWED_CHAT_ID   — (opcional) Chat ID autorizado, para seguridad

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';

// ── Firebase Auth: obtener token ─────────────────────────
async function getFirebaseToken(apiKey, email, password) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error('Auth failed: ' + (err.error?.message || resp.status));
  }
  const data = await resp.json();
  return data.idToken;
}

// ── Firestore: leer documento profiles ───────────────────
async function readProfiles(project, userId, token) {
  const url = `${FIRESTORE_BASE}/projects/${project}/databases/(default)/documents/profiles/${userId}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!resp.ok) {
    if (resp.status === 404) return null;
    throw new Error('Firestore read error: ' + resp.status);
  }
  const doc = await resp.json();
  const dataStr = doc.fields?.data?.stringValue;
  const activeId = doc.fields?.activeId?.stringValue || 'familia';
  return { profiles: dataStr ? JSON.parse(dataStr) : null, activeId };
}

// ── Firestore: guardar documento profiles ────────────────
async function writeProfiles(project, userId, token, profiles, activeId) {
  const url = `${FIRESTORE_BASE}/projects/${project}/databases/(default)/documents/profiles/${userId}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        data: { stringValue: JSON.stringify(profiles) },
        activeId: { stringValue: activeId }
      }
    })
  });
  if (!resp.ok) throw new Error('Firestore write error: ' + resp.status);
}

// ── Obtener mes actual formateado ────────────────────────
function getCurrentMonth() {
  const now = new Date();
  const name = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(now);
  return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + now.getFullYear();
}

// ── Agregar gasto al perfil ──────────────────────────────
function addExpense(profiles, activeId, month, expense) {
  const profile = profiles[activeId];
  if (!profile) throw new Error('Perfil no encontrado: ' + activeId);
  if (!profile.months) profile.months = {};
  if (!profile.months[month]) {
    profile.months[month] = {
      income: profile._incomeDefaults ? JSON.parse(JSON.stringify(profile._incomeDefaults)) : [],
      expense: profile._expenseDefaults ? JSON.parse(JSON.stringify(profile._expenseDefaults)) : []
    };
  }

  const expenses = profile.months[month].expense;

  // Cada gasto es una línea nueva — sin merge por nombre
  const today = new Date().toISOString().slice(0, 10);
  expenses.push({
    name: expense.name,
    value: String(expense.value),
    who: expense.who || '',
    belongsTo: expense.belongsTo || '',
    commerce: expense.commerce || '',
    paymentMethod: expense.paymentMethod || '',
    group: expense.group || '',
    date: expense.date || today,
    dueDay: (typeof expense.dueDay === 'number' && expense.dueDay >= 1 && expense.dueDay <= 31) ? expense.dueDay : 0,
    dueFreq: expense.group === 'fijos' ? (expense.dueFreq || 'mensual') : ''
  });
}

// ── Grupos de egreso (deben coincidir con la app) ────────
const BOT_EXPENSE_GROUPS = {
  fijos:          { label: 'Gastos Fijos',  emoji: '🏠' },
  comida:         { label: 'Comida',        emoji: '🛒' },
  afuera:         { label: 'Afuera',        emoji: '🍽️' },
  animales:       { label: 'Animales',      emoji: '🐾' },
  salud:          { label: 'Salud',         emoji: '💊' },
  vehiculo:       { label: 'Vehículo',      emoji: '🚗' },
  ocio:           { label: 'Ocio',          emoji: '🎭' },
  otros:          { label: 'Otros',         emoji: '📦' },
  ahorro:         { label: 'Ahorro',        emoji: '💰' },
  farmacia:       { label: 'Farmacia',      emoji: '💊' },
  personal_lu:    { label: 'Personal Lu',   emoji: '🙍🏻‍♀️' },
  personal_facu:  { label: 'Personal Facu', emoji: '🧔🏻‍♂️' },
  personal_fran:  { label: 'Personal Fran', emoji: '👶' },
  familia:        { label: 'Familia',       emoji: '👨‍👩‍👧' }
};

function resolveGroupKey(text, profile) {
  if (!text) return '';
  const t = text.trim().toLowerCase();
  // Match built-in
  for (const k of Object.keys(BOT_EXPENSE_GROUPS)) {
    const g = BOT_EXPENSE_GROUPS[k];
    if (t === k || t === g.label.toLowerCase() || t === g.emoji) return k;
  }
  // Match custom groups
  const custom = profile?.customGroups || [];
  for (const g of custom) {
    if (t === (g.label || '').toLowerCase() || t === g.emoji || t === g.key) return g.key;
  }
  return '';
}

function groupsListText(profile) {
  const builtin = Object.values(BOT_EXPENSE_GROUPS).map(g => `${g.emoji} ${g.label}`);
  const custom = (profile?.customGroups || []).map(g => `${g.emoji || '🏷️'} ${g.label}`);
  return builtin.concat(custom).join(', ');
}

function matchMember(name, members) {
  if (!name) return null;
  const n = String(name).toLowerCase().trim();
  let best = (members || []).find(m => m.toLowerCase() === n);
  if (best) return best;
  best = (members || []).find(m => m.toLowerCase().startsWith(n) || n.startsWith(m.toLowerCase()));
  return best || null;
}

function parseBelongsMembers(text, members) {
  if (!text) return { single: '', multi: [] };
  const parts = text.split(/\s*(?:,|\+|&|\/|\sy\s)\s*/i).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const matched = parts.map(p => matchMember(p, members)).filter(Boolean);
    if (matched.length >= 2) return { single: '', multi: matched };
  }
  return { single: '', multi: [] };
}

function finalizeExpense(profiles, activeId, month, expense) {
  const split = expense._splitMembers;
  delete expense._splitMembers;
  if (split && split.length >= 2) {
    const profile = profiles[activeId];
    if (!profile) throw new Error('Perfil no encontrado: ' + activeId);
    if (!profile.months) profile.months = {};
    if (!profile.months[month]) {
      profile.months[month] = {
        income: profile._incomeDefaults ? JSON.parse(JSON.stringify(profile._incomeDefaults)) : [],
        expense: profile._expenseDefaults ? JSON.parse(JSON.stringify(profile._expenseDefaults)) : []
      };
    }
    const total = parseFloat(expense.value) || 0;
    const share = Math.round((total / split.length) * 100) / 100;
    const today = new Date().toISOString().slice(0, 10);
    split.forEach(m => {
      profile.months[month].expense.push({
        name: expense.name,
        value: String(share),
        who: m,
        belongsTo: expense.belongsTo || '',
        commerce: expense.commerce || '',
        paymentMethod: expense.paymentMethod || '',
        group: expense.group || '',
        date: expense.date || today,
        dueDay: (typeof expense.dueDay === 'number' && expense.dueDay >= 1 && expense.dueDay <= 31) ? expense.dueDay : 0,
        dueFreq: expense.group === 'fijos' ? (expense.dueFreq || 'mensual') : ''
      });
    });
  } else {
    addExpense(profiles, activeId, month, expense);
  }
}

function resolveBelongsTo(text, members) {
  if (!text) return '';
  const t = text.trim().toLowerCase();
  if (t === 'hogar') return 'Hogar';
  if (t === 'lu') return 'Lu';
  if (t === 'facu') return 'Facu';
  if (t === 'fran') return 'Fran';
  const m = (members || []).find(mm => mm.toLowerCase() === t);
  return m || text.trim();
}

function finalizeMsg(expense, month) {
  const split = expense._splitMembers;
  const total = Number(expense.value) || 0;
  const parts = [
    `🫶 ¡Listo! Te lo anoté en ${month}`,
    `💰 $${total.toLocaleString('es-UY')} en "${expense.name}"`
  ];
  if (split && split.length >= 2) {
    const share = Math.round((total / split.length) * 100) / 100;
    parts.push(`🧮 Compartido entre ${split.join(', ')} ($${share.toLocaleString('es-UY')} c/u)`);
  } else {
    if (expense.who) {
      const whoEmoji = (expense.who.includes(',') || expense.who.includes(' y ')) ? '🫂' : '👤';
      parts.push(`${whoEmoji} ${expense.who}`);
    }
    if (expense.belongsTo) {
      const belongsEmoji = expense.belongsTo.toLowerCase() === 'hogar' ? '👨‍👩‍👦' : '👥';
      parts.push(`${belongsEmoji} Corresponde a: ${expense.belongsTo}`);
    }
  }
  if (expense.group && BOT_EXPENSE_GROUPS[expense.group]) parts.push(`🏷️ ${BOT_EXPENSE_GROUPS[expense.group].label}`);
  if (expense.commerce) parts.push(`🏪 ${expense.commerce}`);
  if (expense.paymentMethod) parts.push(`💳 ${expense.paymentMethod}`);
  if (expense.dueDay) parts.push(`📅 Vence día ${expense.dueDay}`);
  return parts.join('\n');
}

// ── Agregar ingreso al perfil ────────────────────────────
function addIncome(profiles, activeId, month, income) {
  const profile = profiles[activeId];
  if (!profile) throw new Error('Perfil no encontrado: ' + activeId);
  if (!profile.months) profile.months = {};
  if (!profile.months[month]) {
    profile.months[month] = {
      income: profile._incomeDefaults ? JSON.parse(JSON.stringify(profile._incomeDefaults)) : [],
      expense: profile._expenseDefaults ? JSON.parse(JSON.stringify(profile._expenseDefaults)) : []
    };
  }

  const incomes = profile.months[month].income;
  const existing = incomes.find(r => r.name.toLowerCase() === income.name.toLowerCase());
  if (existing) {
    existing.value = String((parseFloat(existing.value) || 0) + parseFloat(income.value));
    if (income.who) existing.who = income.who;
  } else {
    incomes.push({ name: income.name, value: String(income.value), who: income.who || '', date: new Date().toISOString().slice(0, 10) });
  }
}

// ── Agregar ahorro al perfil ────────────────────────────
function addSavingToProfile(profiles, activeId, month, saving) {
  const profile = profiles[activeId];
  if (!profile) throw new Error('Perfil no encontrado: ' + activeId);
  if (!profile.savings) profile.savings = [];
  profile.savings.push({
    date: new Date().toISOString().slice(0, 10),
    amount: String(saving.amount),
    description: saving.description || 'Ahorro',
    who: saving.who || '',
    month: month
  });
}

// ── Detectar miembro del mensaje ─────────────────────────
function detectMember(text, members) {
  // Buscar @nombre al final
  const atMatch = text.match(/\s+@(\w+)$/i);
  if (atMatch) {
    const name = atMatch[1];
    const member = members.find(m => m.toLowerCase() === name.toLowerCase());
    return { who: member || name, cleanText: text.slice(0, atMatch.index).trim() };
  }

  // Buscar nombre de miembro al final (sin @)
  if (members && members.length) {
    const words = text.split(/\s+/);
    if (words.length > 1) {
      const last = words[words.length - 1].toLowerCase();
      const member = members.find(m => m.toLowerCase() === last);
      if (member) {
        return { who: member, cleanText: words.slice(0, -1).join(' ') };
      }
    }
  }

  return { who: members?.[0] || '', cleanText: text };
}

// ── OCR.space API: gratis e ilimitado ────────────────────
async function ocrSpaceExtract(imageBase64, mediaType, apiKey) {
  const form = new URLSearchParams();
  form.append('base64Image', `data:${mediaType};base64,${imageBase64}`);
  form.append('language', 'spa');
  form.append('isTable', 'true');
  form.append('OCREngine', '2');
  form.append('scale', 'true');
  if (mediaType === 'application/pdf') form.append('filetype', 'PDF');

  const resp = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      'apikey': apiKey || 'helloworld',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  if (!resp.ok) throw new Error('OCR error: ' + resp.status);
  const data = await resp.json();
  if (data.IsErroredOnProcessing) throw new Error('OCR: ' + (data.ErrorMessage || 'falló'));
  return (data.ParsedResults?.[0]?.ParsedText || '').trim();
}

// ── Parsear texto del ticket localmente ──────────────────
function parseTicketText(rawText) {
  const text = rawText.replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  // Total: buscar líneas con "total" y un número cercano
  let total = null;
  const totalRegex = /(total\s*(?:a\s*pagar)?|importe(?:\s*total)?|a\s*pagar)\s*[:\-$]*\s*\$?\s*([\d.,]+)/i;
  for (const line of lines) {
    const m = line.match(totalRegex);
    if (m) {
      const num = parseLocaleNumber(m[2]);
      if (num != null) { total = num; break; }
    }
  }
  // Fallback: número más grande del ticket
  if (total == null) {
    const nums = (text.match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d{2,}/g) || [])
      .map(parseLocaleNumber).filter(n => n != null);
    if (nums.length) total = Math.max(...nums);
  }

  // Comercio: primera línea con letras
  let commerce = '';
  for (const line of lines.slice(0, 5)) {
    if (/[a-záéíóúñ]/i.test(line) && line.length >= 3 && !/^r\.?u\.?t/i.test(line)) {
      commerce = line.replace(/[^\wÁÉÍÓÚÑáéíóúñ &.\-]/g, '').trim();
      if (commerce) break;
    }
  }

  // Método de pago
  let paymentMethod = '';
  if (/cr[eé]dito/i.test(lower)) paymentMethod = 'Crédito';
  else if (/d[eé]bito/i.test(lower)) paymentMethod = 'Débito';
  else if (/efectivo|contado/i.test(lower)) paymentMethod = 'Efectivo';
  else if (/transfer/i.test(lower)) paymentMethod = 'Transferencia';
  else if (/mercado\s*pago|mp\b/i.test(lower)) paymentMethod = 'Mercado Pago';

  // Fecha
  let date = null;
  const dm = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dm) {
    let [_, d, mo, y] = dm;
    if (y.length === 2) y = '20' + y;
    date = `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  return { total, commerce, paymentMethod, date, details: '' };
}

function parseLocaleNumber(s) {
  if (!s) return null;
  s = String(s).trim();
  // Si tiene coma y punto, asumimos formato es-UY: punto miles, coma decimal
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // coma como decimal si tiene 1-2 dígitos después
    if (/,\d{1,2}$/.test(s)) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  } else if (/\.\d{3}$/.test(s)) {
    // un solo punto con 3 dígitos: separador de miles
    s = s.replace('.', '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

async function analyzeImage(_unused, imageBase64, mediaType, categories, ocrKey) {
  const text = await ocrSpaceExtract(imageBase64, mediaType, ocrKey);
  if (!text) throw new Error('OCR vacío');
  const parsed = parseTicketText(text);
  // Sugerir categoría si el comercio o texto coincide con alguna existente
  let suggestedCategory = null;
  if (categories && categories.length) {
    const lower = (text + ' ' + (parsed.commerce || '')).toLowerCase();
    for (const c of categories) {
      if (c && lower.includes(c.toLowerCase())) { suggestedCategory = c; break; }
    }
  }
  return { ...parsed, suggestedCategory };
}

// ── Descargar archivo binario de Telegram ────────────────
async function downloadTelegramFileBytes(botToken, fileId) {
  const fileResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileResp.json();
  if (!fileData.ok) throw new Error('No se pudo obtener el archivo');
  const filePath = fileData.result.file_path;
  const r = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  const buf = await r.arrayBuffer();
  return { bytes: new Uint8Array(buf), filePath };
}

// ── Transcribir audio con Groq Whisper (gratis) ──────────
async function transcribeAudio(bytes, mimeType, apiKey) {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: mimeType || 'audio/ogg' }), 'audio.ogg');
  fd.append('model', 'whisper-large-v3-turbo');
  fd.append('language', 'es');
  fd.append('response_format', 'json');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: fd
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('Transcripción falló: ' + r.status + ' ' + t.slice(0, 120));
  }
  const j = await r.json();
  return (j.text || '').trim();
}

// ── Convertir Uint8Array a base64 ────────────────────────
function bytesToBase64(bytes) {
  const CHUNK = 8192;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

// ── Descargar foto de Telegram ───────────────────────────
async function downloadTelegramPhoto(botToken, fileId) {
  // Obtener ruta del archivo
  const fileResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileResp.json();
  if (!fileData.ok) throw new Error('No se pudo obtener el archivo');

  const filePath = fileData.result.file_path;
  const ext = filePath.split('.').pop().toLowerCase();
  const mediaType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  // Descargar archivo
  const imgResp = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  const buffer = await imgResp.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  const base64 = btoa(parts.join(''));

  return { base64, mediaType };
}

// ── Enviar mensaje por Telegram ──────────────────────────
async function sendMessage(botToken, chatId, text, replyMarkup) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    console.error(`sendMessage FAILED: ${resp.status} ${resp.statusText} — ${errBody}`);
  }
}

// ── Helpers de teclados inline ──────────────────────────
function kb(rows) {
  return {
    inline_keyboard: rows.map(row => row.map(([text, data]) => ({ text, callback_data: data })))
  };
}

function chunkPairs(arr) {
  const rows = [];
  for (let i = 0; i < arr.length; i += 2) rows.push(arr.slice(i, i + 2));
  return rows;
}

function whoKeyboard(members) {
  const single = members.map(m => [m, m]);
  const rows = chunkPairs(single);
  if (members.length >= 2) {
    const pair = members.slice(0, 2).join(', ');
    rows.push([[`👫 ${pair}`, pair]]);
  }
  if (members.length >= 3) {
    const all = members.join(', ');
    rows.push([[`👨‍👩‍👧 Todos`, all]]);
  }
  rows.push([['⏭️ Skip', '/skip'], ['✅ Listo', '/listo'], ['❌ Cancelar', '/cancelar']]);
  return kb(rows);
}

function belongsKeyboard(members) {
  const rows = [
    [['🏠 Hogar', 'Hogar'], ['Lu', 'Lu']],
    [['Facu', 'Facu'], ['Fran', 'Fran']]
  ];
  rows.push([['⏭️ Skip', '/skip'], ['✅ Listo', '/listo'], ['❌ Cancelar', '/cancelar']]);
  return kb(rows);
}

function groupKeyboard(profile) {
  const builtin = Object.values(BOT_EXPENSE_GROUPS).map(g => [`${g.emoji} ${g.label}`, g.label]);
  const custom = (profile?.customGroups || []).map(g => [`${g.emoji || '🏷️'} ${g.label}`, g.label]);
  const rows = chunkPairs(builtin.concat(custom));
  rows.push([['⏭️ Skip', '/skip'], ['✅ Listo', '/listo'], ['❌ Cancelar', '/cancelar']]);
  return kb(rows);
}

function paymentKeyboard() {
  return kb([
    [['💵 Efectivo', 'Efectivo'], ['💳 Débito', 'Débito']],
    [['🏦 Crédito', 'Crédito'], ['📱 Mercado Pago', 'Mercado Pago']],
    [['🔁 Transferencia', 'Transferencia']],
    [['⏭️ Skip', '/skip'], ['✅ Listo', '/listo'], ['❌ Cancelar', '/cancelar']]
  ]);
}

function stepControlsKeyboard() {
  return kb([[['⏭️ Skip', '/skip'], ['✅ Listo', '/listo'], ['❌ Cancelar', '/cancelar']]]);
}

function dueDayKeyboard() {
  return kb([
    [['5', '5'], ['10', '10'], ['15', '15'], ['20', '20']],
    [['25', '25'], ['28', '28'], ['1', '1']],
    [['⏭️ Skip', '/skip'], ['✅ Listo', '/listo'], ['❌ Cancelar', '/cancelar']]
  ]);
}

// Buscar gasto fijo del mes anterior con el mismo nombre
function findPreviousFixedExpense(profile, currentMonth, expenseName) {
  if (!profile || !profile.months || !expenseName) return null;
  const name = expenseName.toLowerCase().trim();
  const monthKeys = Object.keys(profile.months).sort();
  // Buscar en orden inverso (mes más reciente primero)
  for (let i = monthKeys.length - 1; i >= 0; i--) {
    if (monthKeys[i] === currentMonth) continue;
    const month = profile.months[monthKeys[i]];
    if (!month.expense) continue;
    const found = month.expense.find(r =>
      r.name && r.name.toLowerCase().trim() === name && r.group === 'fijos' && r.dueDay
    );
    if (found) return found;
  }
  return null;
}

function reviewKeyboard() {
  const rows = [
    [['✅ Guardar así', '/listo']],
    [['✏️ Categoría', '__edit_name'], ['✏️ Quién', '__edit_who']],
    [['✏️ Corresponde a', '__edit_belongs'], ['✏️ Rubro', '__edit_group']],
    [['✏️ Comercio', '__edit_commerce'], ['✏️ Medio de pago', '__edit_payment']],
    [['✏️ Vence', '__edit_due_day']],
    [['❌ Cancelar', '/cancelar']]
  ];
  return kb(rows);
}

function reviewSummary(expense) {
  const lines = [`🤖 Listo, entendí esto:`, ''];
  lines.push(`💰 <b>$${Number(expense.value || 0).toLocaleString('es-UY')}</b> en "${expense.name}"`);
  if (expense._splitMembers && expense._splitMembers.length >= 2) {
    const share = Math.round(((parseFloat(expense.value) || 0) / expense._splitMembers.length) * 100) / 100;
    lines.push(`👤 Compartido entre ${expense._splitMembers.join(', ')} ($${share.toLocaleString('es-UY')} c/u)`);
  } else if (expense.who) {
    const whoEmoji = (expense.who.includes(',') || expense.who.includes(' y ')) ? '🫂' : '👤';
    lines.push(`${whoEmoji} ${expense.who}`);
  } else {
    lines.push(`👤 <i>(sin asignar)</i>`);
  }
  const belongsEmoji = expense.belongsTo && expense.belongsTo.toLowerCase() === 'hogar' ? '👨‍👩‍👦' : '👥';
  lines.push(`${belongsEmoji} Corresponde a: ${expense.belongsTo || '<i>(sin asignar)</i>'}`);
  const groupLabel = expense.group && BOT_EXPENSE_GROUPS[expense.group]
    ? `${BOT_EXPENSE_GROUPS[expense.group].emoji} ${BOT_EXPENSE_GROUPS[expense.group].label}`
    : (expense.group || '<i>(sin rubro)</i>');
  lines.push(`🏷️ ${groupLabel}`);
  if (expense.dueDay) lines.push(`📅 Vence día ${expense.dueDay}`);
  lines.push(`🏪 ${expense.commerce || '<i>(sin comercio)</i>'}`);
  lines.push(`💳 ${expense.paymentMethod || '<i>(sin medio de pago)</i>'}`);
  lines.push('', '¿Guardar así o querés editar algo?');
  return lines.join('\n');
}

async function answerCallback(botToken, callbackId) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId })
    });
  } catch (_) {}
}

// ── Parsear gasto con IA (Groq, gratis) ─────────────────
async function parseExpenseWithAI(text, peopleCtx, groupLabels, apiKey) {
  if (!apiKey) return null;
  const contribsList = (peopleCtx?.contributors || []).join(', ') || '(ninguno)';
  const membersList = (peopleCtx?.members || []).join(', ') || '(ninguno)';
  const sys = `Sos un parser de gastos familiares en español uruguayo.
Extraé del mensaje libre un JSON con estos campos:
{"amount": number, "name": string, "who": string[], "belongsTo": string, "group": string, "commerce": string, "paymentMethod": string, "dueDay": number}

Reglas:
- "amount" en pesos uruguayos (solo número).
- "name" descripción corta del gasto (ej: "Supermercado", "UTE", "Nafta", "Surtido"). NO incluyas en el nombre palabras como "pagamos", "pagué", "compré", ni nombres de personas.
- "who" array con los adultos que pagaron. Valores: Facu, Lu, Fran, u otros de tu contexto. Mapeá apodos. Ej: "pagué yo" → ["Facu"]. "pagamos lu y facu" → ["Lu","Facu"].
- "belongsTo" quién se beneficia: "Hogar" (la casa), "Lu", "Facu", "Fran".
- "group" la categoría: "Comida", "Salud", "Ocio", "Vehículo", "Gastos Fijos", "Animales", "Afuera", "Farmacia", "Personal Lu", "Personal Facu", "Personal Fran", "Familia", "Ahorro", "Otros".
- "commerce" nombre del comercio (ej: "El Naranjo", "Ancap", "Devoto", "Farmacia San José").
- "paymentMethod" medio de pago: "Efectivo", "Débito", "Crédito", "Transferencia", "Mercado Pago".
- "dueDay" día de vencimiento del mes (1 a 31). Buscá patrones como "vence [n]", "vencimiento [n]", "día [n]", "[n] de". Si no hay info de vencimiento, poné 0.

Ejemplos de parsing:
- "850 super facu" → {"amount":850, "name":"Super", "who":["Facu"], "belongsTo":"", "group":"Comida", "commerce":"", "paymentMethod":"", "dueDay":0}
- "1200 farmacia lu hogar salud" → {"amount":1200, "name":"Farmacia", "who":["Lu"], "belongsTo":"Hogar", "group":"Salud", "commerce":"", "paymentMethod":"", "dueDay":0}
- "1141 Surtido Lu Hogar Comida El Naranjo Débito" → {"amount":1141, "name":"Surtido", "who":["Lu"], "belongsTo":"Hogar", "group":"Comida", "commerce":"El Naranjo", "paymentMethod":"Débito", "dueDay":0}
- "2500 nafta facu auto ancap débito" → {"amount":2500, "name":"Nafta", "who":["Facu"], "belongsTo":"", "group":"Vehículo", "commerce":"Ancap", "paymentMethod":"Débito", "dueDay":0}
- "3400 cena facu y lu hogar ocio la pasiva efectivo" → {"amount":3400, "name":"Cena", "who":["Facu","Lu"], "belongsTo":"Hogar", "group":"Ocio", "commerce":"La Pasiva", "paymentMethod":"Efectivo", "dueDay":0}

Si un campo no aparece, devolvé vacío ("" o [] según corresponda; 0 si es amount).
Respondé SOLO con el JSON, sin texto adicional, sin markdown.`;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: text }
        ]
      })
    });
    if (!r.ok) return null;
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed.amount !== 'number' || parsed.amount <= 0 || !parsed.name) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

// ── Handler principal ────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('OK');

    try {
      const payload = await request.json();
      let msg = payload.message;
      let isCallback = false;
      // Si es un tap en un botón inline, lo transformamos en un mensaje de texto
      if (!msg && payload.callback_query) {
        const cq = payload.callback_query;
        await answerCallback(env.BOT_TOKEN, cq.id);
        msg = { chat: cq.message.chat, text: cq.data };
        isCallback = true;
      }
      if (!msg) return new Response('OK');

      const chatId = msg.chat.id;

      // /miid — responde con el chat ID antes del filtro de autorización
      if (msg.text && msg.text.trim() === '/miid') {
        await sendMessage(env.BOT_TOKEN, chatId, `Tu chat ID es: <code>${chatId}</code>`);
        return new Response('OK');
      }

      // /debug — temporal: muestra ALLOWED_CHAT_ID configurado
      if (msg.text && msg.text.trim() === '/debug') {
        const allowedRaw = env.ALLOWED_CHAT_ID || '(vacío)';
        await sendMessage(env.BOT_TOKEN, chatId,
          `🔍 <b>Debug</b>\nTu chat ID: <code>${chatId}</code>\nALLOWED_CHAT_ID: <code>${allowedRaw}</code>\nBOT_TOKEN OK: <code>${!!env.BOT_TOKEN}</code>`
        );
        return new Response('OK');
      }

      // Verificar chat autorizado (si está configurado)
      const allowedIds = (env.ALLOWED_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
      if (allowedIds.length && !allowedIds.includes(String(chatId))) {
        return new Response('OK');
      }

      // ── Handle due_pay callback (gasto fijo precargado) ──
      if (msg.text && msg.text.startsWith('due_pay|')) {
        const parts = msg.text.split('|');
        const [, name, who, commerce, paymentMethod, belongsTo] = parts;
        const pendingKey = `due_pending_${chatId}`;
        // Store pending due payment in KV or memory
        const dueData = JSON.stringify({ name, who, commerce, paymentMethod, belongsTo, group: 'fijos' });
        // We'll use a simple approach: ask for amount, then process on next message
        await sendMessage(env.BOT_TOKEN, chatId,
          `💰 <b>Registrar pago: ${name}</b>\n\n` +
          `Enviame solo el monto (ej: <code>5200</code>):`,
        );
        // Store in pending state — we'll save to a simple env-based approach
        // Use Telegram's reply approach: set state via message
        // We prefix next expected message
        if (typeof globalThis._duePending === 'undefined') globalThis._duePending = {};
        globalThis._duePending[chatId] = JSON.parse(dueData);
        return new Response('OK');
      }

      // ── Check if there's a pending due payment ──
      if (globalThis._duePending && globalThis._duePending[chatId] && msg.text) {
        const amount = parseFloat(msg.text.replace(/[,$]/g, '').replace(',', '.'));
        if (!isNaN(amount) && amount > 0) {
          const due = globalThis._duePending[chatId];
          delete globalThis._duePending[chatId];

          const token = await getFirebaseToken(env.FIREBASE_API_KEY, env.FIREBASE_EMAIL, env.FIREBASE_PASSWORD);
          const result = await readProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token);
          if (result && result.profiles) {
            const { profiles } = result;
            const activeId = env.ACTIVE_PROFILE || result.activeId || 'familia';
            const profile = profiles[activeId];
            const month = getCurrentMonth();
            if (!profile.months) profile.months = {};
            if (!profile.months[month]) profile.months[month] = { income: [], expense: [], savings: [] };
            profile.months[month].expense.push({
              name: due.name,
              value: String(amount),
              who: due.who,
              commerce: due.commerce,
              paymentMethod: due.paymentMethod,
              belongsTo: due.belongsTo,
              group: 'fijos',
              date: new Date().toISOString().slice(0, 10),
              dueDay: 0,
              dueFreq: ''
            });
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId,
              `✅ <b>Pago registrado</b>\n\n📋 ${due.name}\n💰 $${amount.toLocaleString('es-UY')}\n👤 ${due.who || 'Sin asignar'}`
            );
          }
          return new Response('OK');
        }
      }

      // Autenticar con Firebase
      const token = await getFirebaseToken(env.FIREBASE_API_KEY, env.FIREBASE_EMAIL, env.FIREBASE_PASSWORD);

      // Leer perfil actual de Firestore
      const result = await readProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token);
      if (!result || !result.profiles) {
        await sendMessage(env.BOT_TOKEN, chatId, '❌ No se encontró tu perfil en la app.');
        return new Response('OK');
      }

      const { profiles } = result;
      const activeId = env.ACTIVE_PROFILE || result.activeId || 'familia';
      const profile = profiles[activeId];
      const members = profile?.members || [];
      const contributors = (profile?.contributors && profile.contributors.length) ? profile.contributors : members;
      const month = getCurrentMonth();

      // ── Comando /saldo ─────────────────────────────────
      if (msg.text && (msg.text.trim() === '/saldo' || msg.text.trim() === '/balance')) {
        if (profile?.months?.[month]) {
          const totalIncome = (profile.months[month].income || []).reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
          const totalExpense = (profile.months[month].expense || []).reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
          const balance = totalIncome - totalExpense;
          const savTotal = (profile.savings || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
          await sendMessage(env.BOT_TOKEN, chatId,
            `📊 <b>${month}</b>\nIngresos: $${totalIncome.toLocaleString('es-UY')}\nEgresos: $${totalExpense.toLocaleString('es-UY')}\nBalance: $${balance.toLocaleString('es-UY')}\n💰 Ahorro acumulado: $${savTotal.toLocaleString('es-UY')}`
          );
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, `📊 No hay datos para ${month}.`);
        }
        return new Response('OK');
      }

      // ── Comando /ingreso ─────────────────────────────────
      if (msg.text && /^\/ingreso\s+/i.test(msg.text.trim())) {
        const text = msg.text.trim();
        const match = text.match(/^\/ingreso\s+(\d+(?:[.,]\d{1,2})?)\s+(.+)$/i);
        if (match) {
          const monto = parseFloat(match[1].replace(',', '.'));
          const rawDesc = match[2].trim();
          const { who, cleanText } = detectMember(rawDesc, members);
          const desc = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

          addIncome(profiles, activeId, month, { name: desc, value: monto, who });
          await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

          await sendMessage(env.BOT_TOKEN, chatId,
            `🌟 ¡Qué bueno! Te anoté el ingreso en ${month}\n💚 $${monto.toLocaleString('es-UY')} en "${desc}"${who ? ' por ' + who : ''} 💕`
          );
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, '⚠️ Formato: <code>/ingreso [monto] [descripción] [@quién]</code>\nEj: <code>/ingreso 50000 Sueldo @facu</code>');
        }
        return new Response('OK');
      }

      // ── Comando /ahorro ───────────────────────────────────
      if (msg.text && /^\/ahorro\s+/i.test(msg.text.trim())) {
        const text = msg.text.trim();
        const match = text.match(/^\/ahorro\s+(\d+(?:[.,]\d{1,2})?)\s*(.*)$/i);
        if (match) {
          const monto = parseFloat(match[1].replace(',', '.'));
          let rawDesc = (match[2] || '').trim() || 'Ahorro';
          let who = members[0] || '';
          const atMatch = rawDesc.match(/\s+@(\w+)$/i);
          if (atMatch) {
            const m = members.find(mm => mm.toLowerCase() === atMatch[1].toLowerCase());
            who = m || atMatch[1];
            rawDesc = rawDesc.slice(0, atMatch.index).trim() || 'Ahorro';
          }

          addSavingToProfile(profiles, activeId, month, { amount: monto, description: rawDesc, who });
          await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

          await sendMessage(env.BOT_TOKEN, chatId,
            `✨ ¡Genia! Anoté tu ahorro\n💰 $${monto.toLocaleString('es-UY')} — "${rawDesc}"${who ? ' por ' + who : ''} 🌷`
          );
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, '⚠️ Formato: <code>/ahorro [monto] [descripción] [@quién]</code>\nEj: <code>/ahorro 5000 Ahorro mensual</code>');
        }
        return new Response('OK');
      }

      // ── Comando /help ──────────────────────────────────
      if (msg.text && ['/help', '/start', '/ayuda'].includes(msg.text.trim())) {
        const builtinList = Object.values(BOT_EXPENSE_GROUPS).map(g => `${g.emoji} ${g.label}`).join('  ');
        const customList = (profile?.customGroups || []).map(g => `${g.emoji || '🏷️'} ${g.label}`).join('  ');
        const allCats = customList ? builtinList + '  ' + customList : builtinList;

        await sendMessage(env.BOT_TOKEN, chatId,
          `¡Holaa! 💕 Soy Clotilda, tu asistente del hogar.\n\n` +
          `✨ <b>Así anotás un gasto:</b>\n` +
          `<code>[monto] [en qué se gastó] [quién pagó] [para quién es] [rubro] [comercio] [medio de pago] [vencimiento]</code>\n\n` +
          `<b>Obligatorios:</b> monto y en qué se gastó. El resto es opcional.\n` +
          `El resto es opcional — si lo omitís te pregunto paso a paso.\n\n` +
          `<b>Ejemplos:</b>\n` +
          `• <code>850 super facu</code>\n` +
          `• <code>1200 farmacia lu hogar salud</code>\n` +
          `• <code>2500 nafta facu auto ancap débito</code>\n` +
          `• <code>3400 cena facu y lu hogar ocio la pasiva efectivo</code> (completo)\n\n` +
          `📸 Mandame una foto del ticket y yo lo leo por vos 💖\n` +
          `📄 También leo PDFs (UTE, OSE, etc.) 💕\n` +
          `🎤 O una nota de voz y la transcribo 💕\n\n` +
          `<b>¿Qué es cada cosa?</b>\n` +
          `<b>monto</b> — cuánto pagaste\n` +
          `<b>en qué se gastó</b> — qué compraste (super, nafta, cena)\n` +
          `<b>quién pagó</b> — tu nombre o el de quien pagó\n` +
          `<b>para quién es</b> — Hogar, Lu, Facu o Fran\n` +
          `<b>rubro</b> — la categoría ( salud, ocio, comida...)\n` +
          `<b>comercio</b> — dónde compraste (Ancap, Devoto, etc.)\n` +
          `<b>medio de pago</b> — Efectivo, Débito, Crédito o Transferencia\n` +
          `<b>vencimiento</b> — día del mes (ej: 24) para marcar cuándo vence ese gasto\n\n` +
          `<b>Tus rubros:</b>\n${allCats}\n\n` +
          `<b>Otros comandos:</b>\n` +
          `💚 <code>/ingreso 50000 Sueldo @facu</code>\n` +
          `💰 <code>/ahorro 5000 Ahorro mensual</code>\n` +
          `📊 /saldo — balance del mes\n\n` +
          `Cualquier cosa, acá estoy 🌷`
        );
        return new Response('OK');
      }

      // ── Foto: OCR con Claude ───────────────────────────
      if (msg.photo && msg.photo.length > 0) {
        await sendMessage(env.BOT_TOKEN, chatId, '🔍 Dejame ver tu ticket, dame un segundito...');

        // Tomar la foto de mayor resolución
        const photo = msg.photo[msg.photo.length - 1];
        const { base64, mediaType } = await downloadTelegramPhoto(env.BOT_TOKEN, photo.file_id);

        // Obtener categorías existentes para sugerencias
        const categories = profile?.months?.[month]?.expense?.map(r => r.name) || [];

        const extracted = await analyzeImage(null, base64, mediaType, categories, env.OCR_API_KEY || 'K89209721888957');

        if (!extracted || !extracted.total) {
          await sendMessage(env.BOT_TOKEN, chatId, '😕 Ay, no logré leer bien el ticket. ¿Probás con una foto más clarita o me lo escribís a mano? ¡Gracias, amor!');
          return new Response('OK');
        }

        // Determinar quién (del caption o primer miembro)
        let who = members[0] || '';
        if (msg.caption) {
          const { who: captionWho } = detectMember(msg.caption, members);
          if (captionWho) who = captionWho;
        }

        const expense = {
          name: extracted.suggestedCategory || extracted.commerce || 'Ticket',
          value: extracted.total,
          who: who,
          belongsTo: '',
          commerce: extracted.commerce || 'Ticket',
          paymentMethod: extracted.paymentMethod || '',
          group: ''
        };

        // Iniciar flujo para completar rubro y corresponde a.
        profiles._sessions = profiles._sessions || {};
        profiles._sessions[String(chatId)] = { expense, step: 'confirm', month };
        await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

        const details = extracted.details ? `\n📝 ${extracted.details}` : '';
        await sendMessage(env.BOT_TOKEN, chatId,
          `🧾 Ticket leído (${month})\n💰 Detecté <b>$${Number(extracted.total).toLocaleString('es-UY')}</b> en "${expense.name}"${expense.commerce ? ' · ' + expense.commerce : ''}${expense.paymentMethod ? ' · ' + expense.paymentMethod : ''}${who ? ' · ' + who : ''}${details}\n\n` +
          `❓ ¿El monto es correcto? Tocá ✅ o escribime el monto correcto (ej: <code>2580</code>).`,
          kb([[['✅ Sí, es correcto', '/si'], ['❌ Cancelar', '/cancelar']]])
        );
        return new Response('OK');
      }

      // ── Documento PDF: OCR y mismo flujo que foto ─────
      if (msg.document && (msg.document.mime_type === 'application/pdf' || /\.pdf$/i.test(msg.document.file_name || ''))) {
        await sendMessage(env.BOT_TOKEN, chatId, '📄 Dejame leer ese PDF, dame un segundito...');
        try {
          const { bytes } = await downloadTelegramFileBytes(env.BOT_TOKEN, msg.document.file_id);
          // OCR.space free tier limita PDFs a ~1MB en base64
          if (bytes.length > 900 * 1024) {
            await sendMessage(env.BOT_TOKEN, chatId, '😕 Ese PDF es grande para mi OCR (más de ~900KB). ¿Probás con uno más liviano o me mandás una foto?');
            return new Response('OK');
          }
          const base64 = bytesToBase64(bytes);
          const categories = profile?.months?.[month]?.expense?.map(r => r.name) || [];
          const extracted = await analyzeImage(null, base64, 'application/pdf', categories, env.OCR_API_KEY || 'K89209721888957');

          if (!extracted || !extracted.total) {
            await sendMessage(env.BOT_TOKEN, chatId, '😕 No logré extraer un total de ese PDF. ¿Probás con una foto del ticket?');
            return new Response('OK');
          }

          let who = members[0] || '';
          if (msg.caption) {
            const { who: captionWho } = detectMember(msg.caption, members);
            if (captionWho) who = captionWho;
          }

          const expense = {
            name: extracted.suggestedCategory || extracted.commerce || 'Ticket',
            value: extracted.total,
            who: who,
            belongsTo: '',
            commerce: extracted.commerce || 'Ticket',
            paymentMethod: extracted.paymentMethod || '',
            group: ''
          };

          profiles._sessions = profiles._sessions || {};
          profiles._sessions[String(chatId)] = { expense, step: 'confirm', month };
          await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

          const details = extracted.details ? `\n📝 ${extracted.details}` : '';
          await sendMessage(env.BOT_TOKEN, chatId,
            `📄 PDF leído (${month})\n💰 Detecté <b>$${Number(extracted.total).toLocaleString('es-UY')}</b> en "${expense.name}"${expense.commerce ? ' · ' + expense.commerce : ''}${expense.paymentMethod ? ' · ' + expense.paymentMethod : ''}${who ? ' · ' + who : ''}${details}\n\n` +
            `❓ ¿El monto es correcto? Tocá ✅ o escribime el monto correcto (ej: <code>2580</code>).`,
            kb([[['✅ Sí, es correcto', '/si'], ['❌ Cancelar', '/cancelar']]])
          );
        } catch (e) {
          await sendMessage(env.BOT_TOKEN, chatId, '😕 No pude leer ese PDF: ' + e.message);
        }
        return new Response('OK');
      }

      // ── Audio / nota de voz: transcribir y reusar flujo de texto ─
      if (msg.voice || msg.audio) {
        if (!env.GROQ_API_KEY) {
          await sendMessage(env.BOT_TOKEN, chatId, '🎤 Para usar audios necesito una <code>GROQ_API_KEY</code> (gratis en groq.com). Pedile a Facu que la configure en el worker.');
          return new Response('OK');
        }
        await sendMessage(env.BOT_TOKEN, chatId, '🎤 Escuchando tu mensajito, dame un segundo...');
        const audioObj = msg.voice || msg.audio;
        const { bytes } = await downloadTelegramFileBytes(env.BOT_TOKEN, audioObj.file_id);
        const transcript = await transcribeAudio(bytes, audioObj.mime_type, env.GROQ_API_KEY);
        if (!transcript) {
          await sendMessage(env.BOT_TOKEN, chatId, '😕 No te entendí del todo, ¿probás de nuevo más cerquita?');
          return new Response('OK');
        }
        await sendMessage(env.BOT_TOKEN, chatId, `🎤 Te escuché: <i>${transcript}</i>`);
        msg.text = transcript;
        // Cae al handler de texto debajo
      }

      // ── Texto: gasto manual ────────────────────────────
      if (msg.text) {
        const text = msg.text.trim();

        // Saludo/texto genérico: mini-ayuda corta (funciona incluso dentro de una sesión activa,
        // así no se consume "hola" como respuesta a un paso y el usuario queda atascado).
        const lowerTxt = text.toLowerCase();
        const isGreeting = /^(hola+|holi+s?|holaa+|hey|buenas|buen[oa]s? (d[ií]as?|tardes|noches)|help|ayuda|\?+)$/i.test(lowerTxt);
        if (isGreeting) {
          await sendMessage(env.BOT_TOKEN, chatId,
            '🌸 ¡Hola! Soy Clotilda 💕\n\n' +
            '✨ <b>Formato de una carga completa:</b>\n' +
            '<code>[monto] [en qué se gastó] [quién pagó] [para quién es] [rubro] [comercio] [medio de pago] [vencimiento]</code>\n\n' +
            '<b>Obligatorios:</b> monto y en qué se gastó. El resto es opcional — si lo omitís te lo pregunto paso a paso.\n\n' +
            '<b>Ejemplos:</b>\n' +
            '• <code>850 super facu</code> (mínimo)\n' +
            '• <code>1200 farmacia lu hogar salud</code>\n' +
            '• <code>2500 nafta facu auto ancap débito</code>\n' +
            '• <code>3400 cena facu y lu hogar ocio la pasiva efectivo 24</code> (con vencimiento)\n\n' +
            '📸 Mandame una foto del ticket y lo leo por vos\n' +
            '📄 También leo PDFs (UTE, OSE, etc.)\n' +
            '🎤 O una nota de voz y la transcribo\n\n' +
            'ℹ️ <code>/ayuda</code> para la guía completa con glosario y rubros · <code>/cancelar</code> si estás a mitad de una carga.'
          );
          return new Response('OK');
        }

        // Sesiones conversacionales (completar datos de un gasto)
        profiles._sessions = profiles._sessions || {};
        const sessionKey = String(chatId);
        const session = profiles._sessions[sessionKey];

        if (session && session.expense && session.step) {
          const lower = text.toLowerCase();
          const skip = lower === '/skip' || lower === '/omitir' || lower === '-';

          if (lower === '/cancelar') {
            delete profiles._sessions[sessionKey];
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, '❌ Carga cancelada.');
            return new Response('OK');
          }

          if (lower === '/listo' || lower === '/guardar') {
            const msgText = finalizeMsg(session.expense, session.month || month);
            finalizeExpense(profiles, activeId, session.month || month, session.expense);
            delete profiles._sessions[sessionKey];
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, msgText);
            return new Response('OK');
          }

          // Helper local para persistir y avanzar: si returnToReview, vuelve al resumen
          const gotoReview = async () => {
            session.step = 'review';
            session.returnToReview = false;
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, reviewSummary(session.expense), reviewKeyboard());
          };

          if (session.step === 'confirm') {
            const yes = ['/si', '/sí', 'si', 'sí', 'ok', 'dale', 'correcto'].includes(lower);
            if (!yes && !skip) {
              const cleaned = text.replace(/[^\d.,\-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
              const n = parseFloat(cleaned);
              if (!isNaN(n) && n > 0) {
                session.expense.value = n;
              }
            }
            await gotoReview();
            return new Response('OK');
          }

          if (session.step === 'review') {
            // Taps para editar campos individuales
            if (text === '__edit_name') {
              session.step = 'name'; session.returnToReview = true;
              profiles._sessions[sessionKey] = session;
              await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
              await sendMessage(env.BOT_TOKEN, chatId, '✏️ ¿Cuál es la categoría/descripción correcta? (escribila)', stepControlsKeyboard());
              return new Response('OK');
            }
            if (text === '__edit_who') {
              session.step = 'who'; session.returnToReview = true;
              profiles._sessions[sessionKey] = session;
              await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
              await sendMessage(env.BOT_TOKEN, chatId, `👤 ¿Quién hizo el gasto?\n<i>💡 Varios separados por coma = compartido.</i>`, whoKeyboard(contributors));
              return new Response('OK');
            }
            if (text === '__edit_belongs') {
              session.step = 'belongs'; session.returnToReview = true;
              profiles._sessions[sessionKey] = session;
              await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
              await sendMessage(env.BOT_TOKEN, chatId, `👥 ¿Corresponde a?`, belongsKeyboard(members));
              return new Response('OK');
            }
            if (text === '__edit_group') {
              session.step = 'group'; session.returnToReview = true;
              profiles._sessions[sessionKey] = session;
              await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
              await sendMessage(env.BOT_TOKEN, chatId, `🏷️ ¿Rubro?`, groupKeyboard(profile));
              return new Response('OK');
            }
            if (text === '__edit_commerce') {
              session.step = 'commerce'; session.returnToReview = true;
              profiles._sessions[sessionKey] = session;
              await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
              await sendMessage(env.BOT_TOKEN, chatId, '🏪 ¿Comercio? (escribilo)', stepControlsKeyboard());
              return new Response('OK');
            }
            if (text === '__edit_payment') {
              session.step = 'payment'; session.returnToReview = true;
              profiles._sessions[sessionKey] = session;
              await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
              await sendMessage(env.BOT_TOKEN, chatId, '💳 ¿Medio de pago?', paymentKeyboard());
              return new Response('OK');
            }
            if (text === '__edit_due_day') {
              session.step = 'dueDay'; session.returnToReview = true;
              profiles._sessions[sessionKey] = session;
              await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
              await sendMessage(env.BOT_TOKEN, chatId, '📅 ¿Qué día vence? (1-31)', dueDayKeyboard());
              return new Response('OK');
            }
            // Cualquier otro texto en review: reenviar el resumen
            await sendMessage(env.BOT_TOKEN, chatId, reviewSummary(session.expense), reviewKeyboard());
            return new Response('OK');
          }

          if (session.step === 'name') {
            if (!skip && text) session.expense.name = text.trim();
            if (session.returnToReview) { await gotoReview(); return new Response('OK'); }
            await gotoReview();
            return new Response('OK');
          }
          if (session.step === 'who') {
            if (!skip) {
              const multi = parseBelongsMembers(text, contributors);
              if (multi.multi.length >= 2) {
                session.expense._splitMembers = multi.multi;
                session.expense.who = multi.multi.join(', ');
              } else {
                delete session.expense._splitMembers;
                const m = matchMember(text, contributors);
                session.expense.who = m || text.trim();
              }
            }
            if (session.returnToReview) { await gotoReview(); return new Response('OK'); }
            session.step = 'belongs';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, `👥 ¿Corresponde a?`, belongsKeyboard(members));
            return new Response('OK');
          }
          if (session.step === 'belongs') {
            if (!skip) session.expense.belongsTo = resolveBelongsTo(text, members);
            if (session.returnToReview) { await gotoReview(); return new Response('OK'); }
            session.step = 'group';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, `🏷️ ¿Rubro?`, groupKeyboard(profile));
            return new Response('OK');
          }
          if (session.step === 'group') {
            if (!skip) session.expense.group = resolveGroupKey(text, profile);
            if (session.returnToReview) { await gotoReview(); return new Response('OK'); }
            // Si es gasto fijo, pedir día de vencimiento
            if (session.expense.group === 'fijos') {
              session.step = 'dueDay';
              profiles._sessions[sessionKey] = session;
              await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
              await sendMessage(env.BOT_TOKEN, chatId, '📅 ¿Qué día vence? (1-31)', dueDayKeyboard());
              return new Response('OK');
            }
            session.step = 'commerce';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, '🏪 ¿Comercio? (ej: Devoto, o escribilo)', stepControlsKeyboard());
            return new Response('OK');
          }
          if (session.step === 'dueDay') {
            if (!skip) {
              const day = parseInt(text.replace(/[^0-9]/g, '')) || 0;
              if (day >= 1 && day <= 31) session.expense.dueDay = day;
            }
            if (session.returnToReview) { await gotoReview(); return new Response('OK'); }
            session.step = 'commerce';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, '🏪 ¿Comercio? (ej: Devoto, o escribilo)', stepControlsKeyboard());
            return new Response('OK');
          }
          if (session.step === 'commerce') {
            if (!skip) session.expense.commerce = text;
            if (session.returnToReview) { await gotoReview(); return new Response('OK'); }
            session.step = 'payment';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, '💳 ¿Medio de pago?', paymentKeyboard());
            return new Response('OK');
          }
          if (session.step === 'payment') {
            if (!skip) session.expense.paymentMethod = text;
            if (session.returnToReview) { await gotoReview(); return new Response('OK'); }
            // Si venimos del flujo secuencial, ir al review en vez de guardar directo
            await gotoReview();
            return new Response('OK');
          }
        }

        let pending = null;
        let usedAI = false;

        // Intentar IA primero si está disponible (más comprensiva)
        if (env.GROQ_API_KEY) {
          const groupLabels = Object.values(BOT_EXPENSE_GROUPS).map(g => g.label)
            .concat((profile?.customGroups || []).map(g => g.label));
          const ai = await parseExpenseWithAI(text, { contributors, members }, groupLabels, env.GROQ_API_KEY);
          if (ai) {
            usedAI = true;
            let rawWho = Array.isArray(ai.who) ? ai.who : (ai.who ? [ai.who] : []);
            rawWho = rawWho.flatMap(w => String(w).split(/\s*(?:,|;|\/|\+|\s+y\s+|\s+e\s+)\s*/i)).filter(Boolean);
            const matchedWho = [...new Set(rawWho.map(w => matchMember(w, contributors)).filter(Boolean))];
            const whoField = matchedWho.join(', ');
            // Validar que tenga monto válido y nombre — sino descartar
            if (Number(ai.amount) > 0 && String(ai.name || '').trim().length > 0) {
              pending = {
              name: String(ai.name).trim(),
              value: Number(ai.amount) || 0,
              who: whoField || (matchedWho[0] || ''),
              belongsTo: resolveBelongsTo(ai.belongsTo, members),
              commerce: ai.commerce || '',
              paymentMethod: ai.paymentMethod || '',
              group: resolveGroupKey(ai.group || '', profile),
              dueDay: (typeof ai.dueDay === 'number' && ai.dueDay >= 1 && ai.dueDay <= 31) ? ai.dueDay : 0
            };
            if (matchedWho.length >= 2) {
              pending._splitMembers = matchedWho;
            }
            } // cierra if (amount > 0 && name)
          }
        }

        // Fallback a regex simple si la IA no estuvo disponible o falló
        if (!pending) {
          const match = text.match(/^(?:\/gasto\s+)?(\d+(?:[.,]\d{1,2})?)\s+(.+)$/i);
          if (match) {
            const monto = parseFloat(match[1].replace(',', '.'));
            const rawText = match[2].trim();

            // Intenta parsear todos los campos: desc quién belongsTo grupo comercio método vencimiento
            const parts = rawText.split(/\s+/);
            let desc = '';
            let who = '';
            let belongsTo = '';
            let group = '';
            let commerce = '';
            let paymentMethod = '';
            let dueDay = '';

            // Primero detecta miembro en el texto completo
            const { who: detectedWho, cleanText } = detectMember(rawText, members);

            // Si encontró miembro, lo usa como punto de partida
            if (detectedWho) {
              who = detectedWho;
              desc = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
            } else {
              // Si no, usa la primera palabra como descripción
              desc = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            }

            // Intenta extraer campos adicionales de los siguientes tokens
            const remainingText = detectedWho ? rawText.substring(rawText.indexOf(detectedWho) + detectedWho.length).trim() : parts.slice(1).join(' ');
            const tokens = remainingText.split(/\s+/).filter(t => t.length > 0);

            // Mapea palabras clave conocidas
            const allGroups = groups.map(g => g.name.toLowerCase());
            const paymentMethods = ['efectivo', 'débito', 'crédito', 'transferencia', 'mercado', 'mp'];
            const dueDayKeywords = ['vencimiento', 'vence', 'día'];

            for (let idx = 0; idx < tokens.length; idx++) {
              const token = tokens[idx];
              const lower = token.toLowerCase();
              const nextToken = tokens[idx + 1];

              // Detecta vencimiento (busca "vencimiento 24", "vence 24", "día 24", o solo "24" al final)
              if (dueDayKeywords.some(kw => lower.includes(kw)) && nextToken && /^\d{1,2}$/.test(nextToken)) {
                dueDay = nextToken;
                idx++; // Salta el próximo token que ya procesamos
              } else if (/^\d{1,2}$/.test(token) && idx === tokens.length - 1 && !dueDay) {
                // Si es un número al final y no detectamos vencimiento aún, lo asume como vencimiento
                dueDay = token;
              }
              // Detecta grupo (incluyendo multi-palabra como "gastos fijos")
              else if (allGroups.includes(lower)) {
                group = lower;
              } else if (lower === 'gastos' && nextToken && nextToken.toLowerCase() === 'fijos') {
                group = 'fijos';
                idx++; // Salta el próximo token
              }
              // Detecta método de pago (maneja typos como "tranferencia")
              else if (paymentMethods.some(pm => lower.replace('á', 'a').replace('é', 'e').includes(pm.replace(' ', '')))) {
                paymentMethod = token.charAt(0).toUpperCase() + token.slice(1);
              }
              // Detecta otro miembro como "a quién corresponde"
              else if (members.includes(lower)) {
                if (!belongsTo && lower !== who.toLowerCase()) {
                  belongsTo = lower;
                }
                // Si ya tiene belongsTo, ignora miembros posteriores
              }
              // Si es un token sin clasificación, lo asume como comercio si no hay otro
              else if (!commerce && token.length > 2) {
                commerce = token;
              }
            }

            pending = {
              name: desc,
              value: monto,
              who,
              belongsTo,
              commerce,
              paymentMethod,
              group,
              dueDay: dueDay ? parseInt(dueDay) : undefined
            };
          }
        }

        if (!pending) {
          // Si viene de un tap en un botón viejo (sin sesión activa), ignorar silenciosamente
          if (isCallback) {
            await sendMessage(env.BOT_TOKEN, chatId, '✅ Esa carga ya terminó. Mandame otro gasto cuando quieras 💕');
            return new Response('OK');
          }
          await sendMessage(env.BOT_TOKEN, chatId,
            '🌸 ¡Hola! Soy Clotilda 💕\n\n' +
            '✨ <b>Formato de una carga completa:</b>\n' +
            '<code>[monto] [en qué se gastó] [quién pagó] [para quién es] [rubro] [comercio] [medio de pago]</code>\n\n' +
            '<b>Obligatorios:</b> monto y en qué se gastó. El resto es opcional — si lo omitís te lo pregunto paso a paso.\n\n' +
            '<b>Ejemplos:</b>\n' +
            '• <code>850 super facu</code> (mínimo)\n' +
            '• <code>1200 farmacia lu hogar salud</code>\n' +
            '• <code>2500 nafta facu auto ancap débito</code>\n' +
            '• <code>3400 cena facu y lu hogar ocio la pasiva efectivo</code> (completo)\n\n' +
            '📸 Mandame una foto del ticket y lo leo por vos\n' +
            '📄 También leo PDFs (UTE, OSE, etc.)\n' +
            '🎤 O una nota de voz y la transcribo\n\n' +
            'ℹ️ <code>/ayuda</code> para la guía completa con glosario y rubros · <code>/cancelar</code> si estás a mitad de una carga.'
          );
          return new Response('OK');
        }

        // Autocompletar desde gasto fijo del mes anterior
        const prevFixed = findPreviousFixedExpense(profile, month, pending.name);
        if (prevFixed) {
          if (!pending.who && prevFixed.who) pending.who = prevFixed.who;
          if (!pending.commerce && prevFixed.commerce) pending.commerce = prevFixed.commerce;
          if (!pending.paymentMethod && prevFixed.paymentMethod) pending.paymentMethod = prevFixed.paymentMethod;
          if (!pending.belongsTo && prevFixed.belongsTo) pending.belongsTo = prevFixed.belongsTo;
          if (!pending.group && prevFixed.group) pending.group = prevFixed.group;
          if (prevFixed.dueDay) pending.dueDay = prevFixed.dueDay;
        }

        profiles._sessions[sessionKey] = { expense: pending, step: 'review', month };
        await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

        await sendMessage(env.BOT_TOKEN, chatId, reviewSummary(pending), reviewKeyboard());
      }

    } catch (e) {
      console.error('Worker error:', e.message, e.stack);
      try {
        const payload = await request.clone().json();
        console.error('Failed payload:', JSON.stringify(payload).slice(0, 500));
        if (payload.message?.chat?.id && env.BOT_TOKEN) {
          await sendMessage(
            env.BOT_TOKEN, payload.message.chat.id, '❌ Error interno: ' + e.message
          );
        }
      } catch (_) { console.error('Error in error handler:', _?.message); }
    }

    return new Response('OK');
  },

  // ── Cron Trigger: recordatorios de vencimiento ──────────
  async scheduled(event, env, ctx) {
    try {
      const token = await getFirebaseToken(env.FIREBASE_API_KEY, env.FIREBASE_EMAIL, env.FIREBASE_PASSWORD);
      const result = await readProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token);
      if (!result || !result.profiles) return;

      const profileId = env.ACTIVE_PROFILE || 'familia';
      const profile = result.profiles[profileId];
      if (!profile || !profile.months) return;

      const now = new Date();
      // Check 3 days ahead
      const target = new Date(now);
      target.setDate(target.getDate() + 3);
      const targetDay = target.getDate();
      const targetMonth = target.getMonth(); // 0-indexed
      const isEvenMonth = (target.getMonth() + 1) % 2 === 0;

      // Collect due items from any month (they repeat)
      const dueItems = [];
      const seen = new Set();
      Object.values(profile.months).forEach(month => {
        (month.expense || []).forEach(row => {
          if (row.group !== 'fijos' || !row.dueDay) return;
          const key = row.name + '|' + row.dueDay;
          if (seen.has(key)) return;
          seen.add(key);

          const freq = row.dueFreq || 'mensual';
          if (freq === 'bimensual' && !isEvenMonth) return;
          if (row.dueDay === targetDay) {
            dueItems.push({
              name: row.name,
              who: row.who || '',
              commerce: row.commerce || '',
              paymentMethod: row.paymentMethod || '',
              belongsTo: row.belongsTo || '',
              dueDay: row.dueDay,
              dueFreq: freq
            });
          }
        });
      });

      if (dueItems.length === 0) return;

      // Send Telegram reminders
      const chatIds = (env.ALLOWED_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const item of dueItems) {
        const dateStr = `${targetDay}/${targetMonth + 1}`;
        const msg = `⏰ <b>Recordatorio de vencimiento</b>\n\n`
          + `📋 <b>${item.name}</b>\n`
          + `📅 Vence el <b>${dateStr}</b> (en 3 días)\n`
          + (item.who ? `👤 Quién paga: ${item.who}\n` : '')
          + (item.commerce ? `🏪 Comercio: ${item.commerce}\n` : '')
          + (item.paymentMethod ? `💳 Medio: ${item.paymentMethod}\n` : '')
          + `\nTocá el botón para registrar el pago:`;

        const keyboard = {
          inline_keyboard: [[{
            text: '💰 Registrar pago de ' + item.name,
            callback_data: 'due_pay|' + item.name + '|' + (item.who || '') + '|' + (item.commerce || '') + '|' + (item.paymentMethod || '') + '|' + (item.belongsTo || '')
          }]]
        };

        for (const chatId of chatIds) {
          await sendMessage(env.BOT_TOKEN, chatId, msg, keyboard);
        }
      }

      // Send email reminders via EmailJS (if configured)
      if (env.EMAILJS_SERVICE_ID && env.EMAILJS_TEMPLATE_ID && env.EMAILJS_PUBLIC_KEY) {
        const emails = (env.REMINDER_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
        for (const email of emails) {
          const itemsList = dueItems.map(item => `• ${item.name} — vence el ${targetDay}/${targetMonth + 1}`).join('\n');
          await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_id: env.EMAILJS_SERVICE_ID,
              template_id: env.EMAILJS_TEMPLATE_ID,
              user_id: env.EMAILJS_PUBLIC_KEY,
              template_params: {
                to_email: email,
                subject: '⏰ Recordatorio: vencimientos en 3 días',
                message: `Hola,\n\nEstos gastos fijos vencen en 3 días:\n\n${itemsList}\n\nIngresá a Gestor del Hogar para registrar los pagos.`
              }
            })
          });
        }
      }
    } catch (e) {
      console.error('Scheduled worker error:', e.message);
    }
  }
};
