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
  const existing = expenses.find(r => r.name.toLowerCase() === expense.name.toLowerCase());
  if (existing) {
    existing.value = String((parseFloat(existing.value) || 0) + parseFloat(expense.value));
    if (expense.who) existing.who = expense.who;
    if (expense.commerce) existing.commerce = expense.commerce;
    if (expense.paymentMethod) existing.paymentMethod = expense.paymentMethod;
  } else {
    expenses.push({
      name: expense.name,
      value: String(expense.value),
      who: expense.who || '',
      commerce: expense.commerce || '',
      paymentMethod: expense.paymentMethod || '',
      group: expense.group || ''
    });
  }
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
    incomes.push({ name: income.name, value: String(income.value), who: income.who || '' });
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

// ── Claude API: analizar imagen de ticket ────────────────
async function analyzeImage(apiKey, imageBase64, mediaType, categories) {
  const categoryHint = categories.length
    ? `\nCategorías disponibles: ${categories.join(', ')}. Si corresponde, incluí "suggestedCategory" con el nombre exacto.`
    : '';

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
          {
            type: 'text',
            text: `Analizá este ticket/factura y extraé la información en JSON:
{"total":<número sin símbolo>,"commerce":"<nombre>","date":"<YYYY-MM-DD>","paymentMethod":"<método en español>","details":"<productos separados por coma>","suggestedCategory":null}
Si no podés determinar un campo, usá null. Respondé ÚNICAMENTE con JSON válido.${categoryHint}`
          }
        ]
      }]
    })
  });

  if (!resp.ok) throw new Error('Claude API error: ' + resp.status);
  const data = await resp.json();
  const text = data.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
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
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

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
            `✅ ¡Ingreso anotado en ${month}!\n💚 $${monto.toLocaleString('es-UY')} en "${desc}"${who ? ' por ' + who + '.' : ''}`
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
            `✅ ¡Ahorro registrado!\n💰 $${monto.toLocaleString('es-UY')} — "${rawDesc}"${who ? ' por ' + who : ''}`
          );
        } else {
          await sendMessage(env.BOT_TOKEN, chatId, '⚠️ Formato: <code>/ahorro [monto] [descripción] [@quién]</code>\nEj: <code>/ahorro 5000 Ahorro mensual</code>');
        }
        return new Response('OK');
      }

      // ── Comando /help ──────────────────────────────────
      if (msg.text && ['/help', '/start', '/ayuda'].includes(msg.text.trim())) {
        await sendMessage(env.BOT_TOKEN, chatId,
          '🏠 <b>Gestor del Hogar — Bot</b>\n\n' +
          '<b>Gastos:</b>\n' +
          '<code>500 supermercado facu</code>\n' +
          '<code>/gasto 350 verduleria @facu</code>\n\n' +
          '<b>Ingresos:</b>\n' +
          '<code>/ingreso 50000 Sueldo @facu</code>\n\n' +
          '<b>Ahorro:</b>\n' +
          '<code>/ahorro 5000 Ahorro mensual</code>\n\n' +
          '📸 <b>Foto:</b> Enviá una foto de un ticket\n\n' +
          '<b>Consultas:</b>\n' +
          '/saldo — Balance del mes\n' +
          '/ayuda — Este mensaje'
        );
        return new Response('OK');
      }

      // ── Foto: OCR con Claude ───────────────────────────
      if (msg.photo && msg.photo.length > 0) {
        if (!env.CLAUDE_API_KEY) {
          await sendMessage(env.BOT_TOKEN, chatId, '❌ OCR no configurado. Falta CLAUDE_API_KEY.');
          return new Response('OK');
        }

        await sendMessage(env.BOT_TOKEN, chatId, '🔍 Analizando ticket...');

        // Tomar la foto de mayor resolución
        const photo = msg.photo[msg.photo.length - 1];
        const { base64, mediaType } = await downloadTelegramPhoto(env.BOT_TOKEN, photo.file_id);

        // Obtener categorías existentes para sugerencias
        const categories = profile?.months?.[month]?.expense?.map(r => r.name) || [];

        const extracted = await analyzeImage(env.CLAUDE_API_KEY, base64, mediaType, categories);

        if (!extracted || !extracted.total) {
          await sendMessage(env.BOT_TOKEN, chatId, '❌ No pude leer el ticket. Intentá con mejor iluminación o escribí el gasto manualmente.');
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
          commerce: extracted.commerce || 'Ticket',
          paymentMethod: extracted.paymentMethod || '',
          group: ''
        };

        addExpense(profiles, activeId, month, expense);
        await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

        const details = extracted.details ? `\n📝 ${extracted.details}` : '';
        await sendMessage(env.BOT_TOKEN, chatId,
          `✅ ¡Ticket procesado en ${month}!\n💰 $${Number(extracted.total).toLocaleString('es-UY')} en "${expense.name}"${who ? ' por ' + who : ''}.${details}`
        );
        return new Response('OK');
      }

      // ── Texto: gasto manual ────────────────────────────
      if (msg.text) {
        const text = msg.text.trim();
        const match = text.match(/^(?:\/gasto\s+)?(\d+(?:[.,]\d{1,2})?)\s+(.+)$/i);

        if (!match) {
          await sendMessage(env.BOT_TOKEN, chatId,
            '⚠️ Formato: <code>[monto] [categoría] [quién]</code>\nEj: <code>850 super facu</code>\n\n📸 También podés enviar una foto de un ticket.'
          );
          return new Response('OK');
        }

        const monto = parseFloat(match[1].replace(',', '.'));
        const rawDesc = match[2].trim();
        const { who, cleanText } = detectMember(rawDesc, members);
        const desc = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);

        const expense = {
          name: desc,
          value: monto,
          who: who,
          commerce: 'Telegram',
          paymentMethod: '',
          group: ''
        };

        addExpense(profiles, activeId, month, expense);
        await writeProfiles(env.FIREBASE_PROJECT, env.FIREBASE_USER_ID, token, profiles, activeId);

        await sendMessage(env.BOT_TOKEN, chatId,
          `✅ ¡Gasto anotado en ${month}!\n💰 $${monto.toLocaleString('es-UY')} en "${desc}"${who ? ' por ' + who + '.' : ''}`
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
