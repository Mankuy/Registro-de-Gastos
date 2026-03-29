/**
 * GESTOR DEL HOGAR - CORE ENGINE (Senior Version)
 * Integrado con index.html del usuario
 */

// 1. CONFIGURACIÓN FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDFCba95ny7I2HAA2KVm8IQgzgq-YkLJDo",
    authDomain: "registro-gastos-8a864.firebaseapp.com",
    databaseURL: "https://registro-gastos-8a864-default-rtdb.firebaseio.com",
    projectId: "registro-gastos-8a864",
    storageBucket: "registro-gastos-8a864.firebasestorage.app",
    messagingSenderId: "893257009763",
    appId: "1:893257009763:web:56d9c9dbdb682a3417f576",
    measurementId: "G-P81R3MJQP7"
};

// Inicialización Segura
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// 2. VARIABLES DE ESTADO
let currentUser = null;
let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
let members = ["Facu", "Lu", "Fran"];
const defaultExpenses = ["Alquiler", "UTE", "OSE", "Antel", "Patente", "Seguro", "Nafta", "Mutualista", "Supermercado", "Feria", "PedidosYa"];

// 3. LOGICA DE AUTENTICACIÓN
const handleAuth = async (isRegister) => {
    const userInp = document.getElementById(isRegister ? 'reg-username' : 'login-username');
    const passInp = document.getElementById(isRegister ? 'reg-password' : 'login-password');
    const displayInp = document.getElementById('reg-displayname');

    if (!userInp.value || !passInp.value) return alert("Completar campos");

    const email = `${userInp.value.trim().toLowerCase()}@gestor.hogar.app`;
    const password = passInp.value;

    try {
        if (isRegister) {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await db.ref(`users/${cred.user.uid}/profile`).set({
                displayName: displayInp.value || userInp.value,
                createdAt: Date.now()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (error) {
        localStorage.clear();
        alert("Error: " + error.message);
    }
};

// Observador de Sesión
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        initApp();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
    }
});

// 4. INICIALIZACIÓN DE LA APP
function initApp() {
    renderMonthNav();
    syncRealtimeData();
    setupEventListeners();
    
    // Cargar Nombre de Perfil
    db.ref(`users/${currentUser.uid}/profile/displayName`).once('value', s => {
        if (s.exists()) {
            document.getElementById('profile-display-name').innerText = s.val();
            document.getElementById('profile-avatar').innerText = s.val().charAt(0).toUpperCase();
        }
    });
}

// 5. NAVEGACIÓN Y SINCRONIZACIÓN
function renderMonthNav() {
    const nav = document.getElementById('month-nav');
    const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
    const year = new Date().getFullYear();
    
    nav.innerHTML = months.map(m => {
        const id = `${year}-${m}`;
        return `<button class="month-tab ${currentMonth === id ? 'active' : ''}" onclick="changeMonth('${id}')">${m}/${year.toString().slice(-2)}</button>`;
    }).join('');
}

window.changeMonth = (id) => {
    currentMonth = id;
    renderMonthNav();
    syncRealtimeData();
};

function syncRealtimeData() {
    const path = `users/${currentUser.uid}/data/${currentMonth}/expenses`;
    db.ref(path).on('value', snapshot => {
        const data = snapshot.val();
        if (!data) {
            seedMonth();
        } else {
            renderDashboard(data);
        }
    });
}

function seedMonth() {
    const path = `users/${currentUser.uid}/data/${currentMonth}/expenses`;
    const initial = {};
    defaultExpenses.forEach(exp => {
        const id = db.ref().child('t').push().key;
        initial[id] = { desc: exp, monto: 0, pago: members[0], fecha: new Date().toISOString().split('T')[0] };
    });
    db.ref(path).set(initial);
}

// 6. RENDERIZADO DEL DASHBOARD (HTML Dinámico)
function renderDashboard(expenses) {
    const main = document.getElementById('main-content');
    document.getElementById('header-month').innerText = currentMonth;
    
    let total = 0;
    const items = Object.keys(expenses).map(id => {
        const e = expenses[id];
        total += parseFloat(e.monto || 0);
        return `
            <tr>
                <td>${e.desc}</td>
                <td>
                    <select class="table-select" onchange="updateValue('${id}', 'pago', this.value)">
                        ${members.map(m => `<option value="${m}" ${e.pago === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </td>
                <td class="amount-cell" onclick="editMonto('${id}', ${e.monto})">$ ${e.monto}</td>
                <td><button class="btn-del" onclick="deleteItem('${id}')">✕</button></td>
            </tr>`;
    }).join('');

    main.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card total">
                <span class="label">Total Egresos</span>
                <span class="amount" id="total-amount">$ ${total.toLocaleString('es-UY')}</span>
            </div>
        </div>
        <div class="section-card">
            <div class="section-header">
                <h3>Gastos del Mes</h3>
                <button class="btn-confirm-sm" onclick="addItem()">+ Agregar</button>
            </div>
            <table>
                <thead><tr><th>Descripción</th><th>Quién</th><th>Monto</th><th></th></tr></thead>
                <tbody>${items}</tbody>
            </table>
        </div>
    `;
}

// 7. ACCIONES (Sincronizadas con Firebase)
window.updateValue = (id, field, val) => {
    db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses/${id}`).update({ [field]: val });
};

window.editMonto = (id, current) => {
    const nuevo = prompt("Nuevo monto ($):", current);
    if (nuevo !== null && !isNaN(nuevo)) updateValue(id, 'monto', parseFloat(nuevo));
};

window.deleteItem = (id) => {
    if (confirm("¿Eliminar gasto?")) db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses/${id}`).remove();
};

window.addItem = () => {
    const desc = prompt("Descripción:");
    if (!desc) return;
    const id = db.ref().child('t').push().key;
    db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses/${id}`).set({
        desc, monto: 0, pago: members[0], fecha: new Date().toISOString().split('T')[0]
    });
};

// 8. OCR Y TICKET (Integrado con tus IDs de Modal)
window.setupEventListeners = () => {
    // Tabs Login
    document.getElementById('tab-login-btn').onclick = () => {
        document.getElementById('login-form-wrap').hidden = false;
        document.getElementById('register-form-wrap').hidden = true;
    };
    document.getElementById('tab-register-btn').onclick = () => {
        document.getElementById('login-form-wrap').hidden = true;
        document.getElementById('register-form-wrap').hidden = false;
    };

    // Botones de Acción
    document.getElementById('btn-login').onclick = () => handleAuth(false);
    document.getElementById('btn-register').onclick = () => handleAuth(true);
    
    // Dark Mode
    document.getElementById('btn-dark-mode').onclick = () => {
        const theme = document.documentElement.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
    };

    // Modal OCR
    const ocrModal = document.getElementById('ocr-overlay');
    document.getElementById('btn-ticket').onclick = () => ocrModal.classList.add('open');
    document.getElementById('btn-close-ocr').onclick = () => ocrModal.classList.remove('open');
    document.getElementById('btn-ocr-browse').onclick = () => document.getElementById('ocr-file-browse').click();
    
    document.getElementById('ocr-file-browse').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const progressWrap = document.getElementById('ocr-progress-wrap');
        const progressBar = document.getElementById('ocr-progress-bar');
        progressWrap.hidden = false;
        
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'spa', {
                logger: m => { if(m.status === 'recognizing') progressBar.style.width = `${m.progress * 100}%` }
            });
            
            const prices = text.match(/\d+[\.,]\d{2}/g);
            if (prices) {
                const max = Math.max(...prices.map(p => parseFloat(p.replace(',', '.'))));
                document.getElementById('ocr-result-wrap').hidden = false;
                document.getElementById('ocr-amount-value').innerText = `$ ${max}`;
                document.getElementById('ocr-amount-input').value = max;
                document.getElementById('ocr-modal-foot').hidden = false;
            }
            document.getElementById('ocr-raw-text').value = text;
        } catch (err) { alert("Error al procesar"); }
    };

    // Guardar gasto desde OCR
    document.getElementById('btn-ocr-add-expense').onclick = () => {
        const monto = parseFloat(document.getElementById('ocr-amount-input').value);
        const desc = document.getElementById('ocr-commerce').value || "Gasto Ticket";
        if (monto) {
            const id = db.ref().child('t').push().key;
            db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses/${id}`).set({
                desc, monto, pago: members[0], fecha: new Date().toISOString().split('T')[0]
            });
            ocrModal.classList.remove('open');
        }
    };

    // Exportar CSV
    document.getElementById('btn-export').onclick = () => {
        db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses`).once('value', s => {
            const rows = Object.values(s.val() || {}).map(e => ({ Gasto: e.desc, Monto: e.monto, Quien: e.pago }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Gastos");
            XLSX.writeFile(wb, `Gestor_Hogar_${currentMonth}.xlsx`);
        });
    };

    // Drawer de Miembros
    const memOverlay = document.getElementById('members-overlay');
    const memDrawer = document.getElementById('members-drawer');
    document.getElementById('btn-members').onclick = () => {
        memOverlay.classList.add('open');
        memDrawer.classList.add('open');
        renderMembers();
    };
    document.getElementById('btn-close-members').onclick = () => {
        memOverlay.classList.remove('open');
        memDrawer.classList.remove('open');
    };
};

function renderMembers() {
    const list = document.getElementById('members-list');
    list.innerHTML = members.map((m, i) => `
        <li class="member-item">
            <span class="member-name">${m}</span>
            <button onclick="removeMember(${i})">✕</button>
        </li>`).join('');
}

window.removeMember = (i) => {
    if (members.length > 1) {
        members.splice(i, 1);
        renderMembers();
        syncRealtimeData();
    }
};

document.getElementById('btn-add-member').onclick = () => {
    const inp = document.getElementById('new-member-input');
    if (inp.value) {
        members.push(inp.value);
        inp.value = '';
        renderMembers();
        syncRealtimeData();
    }
};

// Soporte Tecla Enter en Login
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (!document.getElementById('login-screen').classList.contains('hidden')) {
            handleAuth(false);
        }
    }
});