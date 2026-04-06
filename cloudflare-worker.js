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

  // Si ya existe la categoría, sumar al valor existente
  const today = new Date().toISOString().slice(0, 10);
  const existing = expenses.find(r => r.name.toLowerCase() === expense.name.toLowerCase());
  if (existing) {
    existing.value = String((parseFloat(existing.value) || 0) + parseFloat(expense.value));
    if (expense.who) existing.who = expense.who;
    if (expense.commerce) existing.commerce = expense.commerce;
    if (expense.paymentMethod) existing.paymentMethod = expense.paymentMethod;
    if (expense.group) existing.group = expense.group;
    if (expense.belongsTo) existing.belongsTo = expense.belongsTo;
    existing.date = expense.date || today;
  } else {
    expenses.push({
      name: expense.name,
      value: String(expense.value),
      who: expense.who || '',
      belongsTo: expense.belongsTo || '',
      commerce: expense.commerce || '',
      paymentMethod: expense.paymentMethod || '',
      group: expense.group || '',
      date: expense.date || today
    });
  }
}

// ── Grupos de egreso (deben coincidir con la app) ────────
const BOT_EXPENSE_GROUPS = {
  fijos:    { label: 'Fijos',    emoji: '🏠' },
  comida:   { label: 'Comida',   emoji: '🛒' },
  afuera:   { label: 'Afuera',   emoji: '🍽️' },
  animales: { label: 'Animales', emoji: '🐾' },
  ninos:    { label: 'Niñxs',    emoji: '👶' },
  salud:    { label: 'Salud',    emoji: '💊' },
  vehiculo: { label: 'Vehículo', emoji: '🚗' },
  ocio:     { label: 'Ocio',     emoji: '🎭' },
  otros:    { label: 'Otros',    emoji: '📦' }
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

function parseBelongsMembers(text, members) {
  if (!text) return { single: '', multi: [] };
  const parts = text.split(/\s*(?:,|\+|&|\/|\sy\s)\s*/i).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const matched = parts.map(p => {
      const m = (members || []).find(mm => mm.toLowerCase() === p.toLowerCase());
      return m || null;
    }).filter(Boolean);
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
        date: expense.date || today
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
  const m = (members || []).find(mm => mm.toLowerCase() === t);
  return m || text.trim();
}

function finalizeMsg(expense, month) {
  const split = expense._splitMembers;
  const total = Number(expense.value) || 0;
  const parts = [
    `💖 ¡Listo! Te lo anoté en ${month}`,
    `💰 $${total.toLocaleString('es-UY')} en "${expense.name}"`
  ];
  if (split && split.length >= 2) {
    const share = Math.round((total / split.length) * 100) / 100;
    parts.push(`🧮 Compartido entre ${split.join(', ')} ($${share.toLocaleString('es-UY')} c/u)`);
  } else {
    if (expense.who) parts.push(`👤 ${expense.who}`);
    if (expense.belongsTo) parts.push(`👥 Corresponde a: ${expense.belongsTo}`);
  }
  if (expense.group && BOT_EXPENSE_GROUPS[expense.group]) parts.push(`🏷️ ${BOT_EXPENSE_GROUPS[expense.group].label}`);
  if (expense.commerce) parts.push(`🏪 ${expense.commerce}`);
  if (expense.paymentMethod) parts.push(`💳 ${expense.paymentMethod}`);
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
async function sendMessage(botToken, chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

// ── Handler principal ────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('OK');

    try {
      const payload = await request.json();
      const msg = payload.message;
      if (!msg) return new Response('OK');

      const chatId = msg.chat.id;

      // Verificar chat autorizado (si está configurado)
      if (env.ALLOWED_CHAT_ID && String(chatId) !== String(env.ALLOWED_CHAT_ID)) {
        return new Response('OK');
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
        const builtinList = Object.values(BOT_EXPENSE_GROUPS).map(g => `   ${g.emoji} ${g.label}`).join('\n');
        const customList = (profile?.customGroups || []).map(g => `   ${g.emoji || '🏷️'} ${g.label}`).join('\n');
        const allCats = customList ? builtinList + '\n' + customList : builtinList;
        const membersTxt = members.length ? members.join(', ') : 'tu familia';

        await sendMessage(env.BOT_TOKEN, chatId,
          `¡Holaa! 💕 Soy tu asistente del hogar, acá para ayudarte a llevar las cuentas tranqui.\n\n` +
          `🗂️ <b>Estas son tus categorías:</b>\n${allCats}\n\n` +
          `👨‍👩‍👧 <b>Miembros:</b> ${membersTxt}\n\n` +
          `✨ <b>Para anotar un gasto, escribime así:</b>\n` +
          `<code>[monto] [categoría] [quién]</code>\n` +
          `Ej: <code>850 super facu</code>\n\n` +
          `📸 O mandame una foto del ticket y yo lo leo por vos 💖\n` +
          `🎤 También podés mandarme una nota de voz y la transcribo 💕\n\n` +
          `<b>Otros comanditos:</b>\n` +
          `💚 <code>/ingreso 50000 Sueldo @facu</code>\n` +
          `💰 <code>/ahorro 5000 Ahorro mensual</code>\n` +
          `📊 /saldo — te muestro el balance del mes\n` +
          `🤍 /ayuda — esta ayudita\n\n` +
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

        // Iniciar flujo para completar grupo y corresponde a.
        profiles._sessions = profiles._sessions || {};
        profiles._sessions[String(chatId)] = { expense, step: 'confirm', month };
        await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

        const details = extracted.details ? `\n📝 ${extracted.details}` : '';
        await sendMessage(env.BOT_TOKEN, chatId,
          `🧾 Ticket leído (${month})\n💰 Detecté <b>$${Number(extracted.total).toLocaleString('es-UY')}</b> en "${expense.name}"${expense.commerce ? ' · ' + expense.commerce : ''}${expense.paymentMethod ? ' · ' + expense.paymentMethod : ''}${who ? ' · ' + who : ''}${details}\n\n` +
          `❓ ¿El monto es correcto? Respondé <code>/si</code> para confirmar, o escribime el monto correcto (ej: <code>2580</code>).\n` +
          `<i>/cancelar para descartar</i>`
        );
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

          if (session.step === 'confirm') {
            const yes = ['/si', '/sí', 'si', 'sí', 'ok', 'dale', 'correcto'].includes(lower);
            if (!yes && !skip) {
              const cleaned = text.replace(/[^\d.,\-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
              const n = parseFloat(cleaned);
              if (!isNaN(n) && n > 0) {
                session.expense.value = n;
              }
            }
            session.step = 'who';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            const whoOpts = members.join(', ');
            await sendMessage(env.BOT_TOKEN, chatId, `✅ Monto: $${Number(session.expense.value).toLocaleString('es-UY')}\n\n👤 ¿Quién hizo el gasto? (${whoOpts})\n<i>💡 Para dividirlo entre varios: separalos por coma (ej: Facu, Lu)</i>\n<i>/skip · /listo · /cancelar</i>`);
            return new Response('OK');
          }
          if (session.step === 'who') {
            if (!skip) {
              const multi = parseBelongsMembers(text, members);
              if (multi.multi.length >= 2) {
                session.expense._splitMembers = multi.multi;
                session.expense.who = multi.multi.join(', ');
                const shareNow = Math.round(((parseFloat(session.expense.value) || 0) / multi.multi.length) * 100) / 100;
                await sendMessage(env.BOT_TOKEN, chatId, `🧮 Compartido entre ${multi.multi.join(', ')} — $${shareNow.toLocaleString('es-UY')} c/u`);
              } else {
                const m = (members || []).find(mm => mm.toLowerCase() === text.toLowerCase());
                session.expense.who = m || text.trim();
              }
            }
            session.step = 'belongs';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            const belongsOpts = ['Hogar'].concat(members).join(', ');
            await sendMessage(env.BOT_TOKEN, chatId, `👥 ¿Corresponde a? (${belongsOpts})\n<i>/skip · /listo · /cancelar</i>`);
            return new Response('OK');
          }
          if (session.step === 'belongs') {
            if (!skip) {
              session.expense.belongsTo = resolveBelongsTo(text, members);
            }
            session.step = 'group';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, `🏷️ ¿Grupo? (${groupsListText(profile)})\n<i>/skip · /listo · /cancelar</i>`);
            return new Response('OK');
          }
          if (session.step === 'group') {
            if (!skip) session.expense.group = resolveGroupKey(text, profile);
            session.step = 'commerce';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, '🏪 ¿Comercio? (ej: Devoto)\n<i>/skip · /listo · /cancelar</i>');
            return new Response('OK');
          }
          if (session.step === 'commerce') {
            if (!skip) session.expense.commerce = text;
            session.step = 'payment';
            profiles._sessions[sessionKey] = session;
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, '💳 ¿Medio de pago? (efectivo, débito, crédito…)\n<i>/skip · /listo · /cancelar</i>');
            return new Response('OK');
          }
          if (session.step === 'payment') {
            if (!skip) session.expense.paymentMethod = text;
            const msgText = finalizeMsg(session.expense, session.month || month);
            finalizeExpense(profiles, activeId, session.month || month, session.expense);
            delete profiles._sessions[sessionKey];
            await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);
            await sendMessage(env.BOT_TOKEN, chatId, msgText);
            return new Response('OK');
          }
        }

        const match = text.match(/^(?:\/gasto\s+)?(\d+(?:[.,]\d{1,2})?)\s+(.+)$/i);

        if (!match) {
          await sendMessage(env.BOT_TOKEN, chatId,
            '🌸 Mmm, no entendí del todo. Probá así:\n<code>[monto] [categoría] [quién]</code>\nEj: <code>850 super facu</code>\n\n📸 O mandame una foto del ticket y yo me encargo 💕'
          );
          return new Response('OK');
        }

        const monto = parseFloat(match[1].replace(',', '.'));
        const rawDesc = match[2].trim();
        const { who, cleanText } = detectMember(rawDesc, members);
        const desc = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

        // Crear sesión pendiente en lugar de guardar directo.
        // Así vamos pidiendo los datos que faltan para mejor calidad de info.
        const pending = {
          name: desc,
          value: monto,
          who: who,
          belongsTo: '',
          commerce: '',
          paymentMethod: '',
          group: ''
        };
        profiles._sessions[sessionKey] = { expense: pending, step: 'who', month };
        await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

        const whoOpts = members.join(', ');
        await sendMessage(env.BOT_TOKEN, chatId,
          `📝 Gasto pendiente en ${month}\n💰 $${monto.toLocaleString('es-UY')} en "${desc}"${who ? ' · detectado: ' + who : ''}\n\n` +
          `👤 ¿Quién hizo el gasto? (${whoOpts})\n<i>💡 Para dividirlo entre varios: separalos por coma (ej: Facu, Lu)</i>\n` +
          `<i>/skip para mantener lo detectado · /listo para guardar ya · /cancelar</i>`
        );
      }

    } catch (e) {
      console.error('Worker error:', e.message);
      try {
        const payload = await request.clone().json();
        if (payload.message?.chat?.id) {
          await sendMessage(
            // Can't use env here reliably, but try
            '', payload.message.chat.id, '❌ Error interno: ' + e.message
          );
        }
      } catch (_) {}
    }

    return new Response('OK');
  }
};
