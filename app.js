/**
 * GESTOR DEL HOGAR - APP.JS (VERSIÓN FINAL PRODUCCIÓN - FIX LOGIN)
 * Optimizado para Uruguay | Firebase SDK v8 Compat | GitHub Pages
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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

// 2. ESTADO GLOBAL
let currentUser = null;
let currentMonth = new Date().toISOString().slice(0, 7);
let currentExpensesRef = null;

let members = ["Facu", "Lu", "Fran"];
const defaultExpenses = ["Alquiler", "UTE", "OSE", "Antel", "Patente", "Seguro", "Nafta", "Mutualista", "Supermercado", "Feria", "PedidosYa"];

// 3. LÓGICA DE AUTENTICACIÓN
const handleAuth = async (isRegister) => {
    const userInp = document.getElementById(isRegister ? 'reg-username' : 'login-username');
    const passInp = document.getElementById(isRegister ? 'reg-password' : 'login-password');

    if (!userInp || !passInp || !userInp.value || !passInp.value) {
        return alert("Por favor, completa los campos requeridos.");
    }

    if (isRegister) {
        const pass2 = document.getElementById('reg-password2').value;
        if (passInp.value !== pass2) return alert("Las contraseñas no coinciden.");
    }

    const email = `${userInp.value.trim().toLowerCase()}@gestor.hogar.app`;
    const password = passInp.value;

    try {
        if (isRegister) {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            const displayName = document.getElementById('reg-displayname').value || userInp.value;
            await db.ref(`users/${cred.user.uid}/profile`).set({
                displayName,
                createdAt: Date.now()
            });
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (error) {
        console.error("Firebase Auth Error:", error);
        alert(`Error: ${error.message}`);
    }
};

// Observador de usuario
auth.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        initApp();
    } else {
        loginScreen.classList.remove('hidden');
    }
});

// 4. INICIALIZACIÓN DE LA APP (solo después de login)
function initApp() {
    setupAppListeners();
    renderMonthNav();
    syncRealtimeData();

    // Cargar perfil
    db.ref(`users/${currentUser.uid}/profile/displayName`).once('value', s => {
        if (s.exists()) {
            document.getElementById('profile-display-name').innerText = s.val();
            document.getElementById('profile-avatar').innerText = s.val().charAt(0).toUpperCase();
        }
    });
}

// 5. LISTENERS DEL LOGIN (se ejecutan apenas carga la página)
function setupLoginListeners() {
    // Tabs
    const tabLogin = document.getElementById('tab-login-btn');
    const tabRegister = document.getElementById('tab-register-btn');
    const loginForm = document.getElementById('login-form-wrap');
    const registerForm = document.getElementById('register-form-wrap');

    if (tabLogin) tabLogin.onclick = () => {
        loginForm.hidden = false;
        registerForm.hidden = true;
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    };
    if (tabRegister) tabRegister.onclick = () => {
        loginForm.hidden = true;
        registerForm.hidden = false;
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
    };

    // Botones
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    if (btnLogin) btnLogin.onclick = () => handleAuth(false);
    if (btnRegister) btnRegister.onclick = () => handleAuth(true);

    // Enter
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('login-screen').classList.contains('hidden')) {
            handleAuth(false);
        }
    });

    console.log("✅ Listeners del login cargados correctamente");
}

// 6. LISTENERS DE LA APP (después de login)
function setupAppListeners() {
    // Dark Mode
    const darkBtn = document.getElementById('btn-dark-mode');
    if (darkBtn) darkBtn.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        darkBtn.innerText = next === 'dark' ? '☀️' : '🌙';
    };

    // Miembros
    document.getElementById('btn-members').onclick = () => {
        document.getElementById('members-overlay').classList.add('open');
        document.getElementById('members-drawer').classList.add('open');
        renderMembersList();
    };
    document.getElementById('btn-close-members').onclick = () => {
        document.getElementById('members-overlay').classList.remove('open');
        document.getElementById('members-drawer').classList.remove('open');
    };
    document.getElementById('btn-add-member').onclick = () => {
        const inp = document.getElementById('new-member-input');
        if (inp.value.trim()) {
            members.push(inp.value.trim());
            inp.value = '';
            renderMembersList();
        }
    };

    // Exportar
    document.getElementById('btn-export').onclick = () => {
        db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses`).once('value', s => {
            const data = Object.values(s.val() || {}).map(e => ({Gasto: e.desc, Monto: e.monto, Pago: e.pago}));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Gastos");
            XLSX.writeFile(wb, `Gastos_${currentMonth}.xlsx`);
        });
    };

    // OCR
    const ocrOverlay = document.getElementById('ocr-overlay');
    document.getElementById('btn-ticket').onclick = () => ocrOverlay.classList.add('open');
    document.getElementById('btn-close-ocr').onclick = () => ocrOverlay.classList.remove('open');
    document.getElementById('btn-ocr-browse').onclick = () => document.getElementById('ocr-file-browse').click();

    document.getElementById('ocr-file-browse').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const progressWrap = document.getElementById('ocr-progress-wrap');
        const progressBar = document.getElementById('ocr-progress-bar');
        progressWrap.hidden = false;

        try {
            const { data: { text } } = await Tesseract.recognize(file, 'spa', {
                logger: m => { if (m.status === 'recognizing') progressBar.style.width = `${m.progress * 100}%`; }
            });

            const prices = text.match(/\d+[\.,]\d{2}/g);
            if (prices) {
                const maxVal = Math.max(...prices.map(p => parseFloat(p.replace(',', '.'))));
                document.getElementById('ocr-result-wrap').hidden = false;
                document.getElementById('ocr-amount-value').innerText = `$ ${maxVal}`;
                document.getElementById('ocr-amount-input').value = maxVal;
                document.getElementById('ocr-modal-foot').hidden = false;
            }
            document.getElementById('ocr-raw-text').value = text;
        } catch (err) {
            alert("Error al leer la imagen.");
        } finally {
            progressWrap.hidden = true;
        }
    };

    document.getElementById('btn-ocr-add-expense').onclick = () => {
        const monto = parseFloat(document.getElementById('ocr-amount-input').value);
        const desc = document.getElementById('ocr-commerce').value || "Compra Ticket";
        if (monto) {
            const id = db.ref().child('temp').push().key;
            db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses/${id}`).set({
                desc, monto, pago: members[0], fecha: new Date().toISOString().split('T')[0]
            });
            ocrOverlay.classList.remove('open');
        }
    };
}

// 7. MES Y SINCRONIZACIÓN
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
    if (currentExpensesRef) currentExpensesRef.off('value');
    currentExpensesRef = db.ref(path);
    currentExpensesRef.on('value', snapshot => {
        const data = snapshot.val();
        if (!data) {
            seedInitialMonth();
        } else {
            renderDashboard(data);
        }
    });
}

function seedInitialMonth() {
    const path = `users/${currentUser.uid}/data/${currentMonth}/expenses`;
    const seeds = {};
    defaultExpenses.forEach(name => {
        const id = db.ref().child('temp').push().key;
        seeds[id] = { desc: name, monto: 0, pago: members[0], fecha: new Date().toISOString().split('T')[0] };
    });
    db.ref(path).set(seeds);
}

// 8. DASHBOARD Y CRUD
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
                    <select class="table-select" onchange="updateRecord('${id}', 'pago', this.value)">
                        ${members.map(m => `<option value="${m}" ${e.pago === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </td>
                <td class="amount-cell" onclick="editAmount('${id}', ${e.monto})">$ ${parseFloat(e.monto).toLocaleString('es-UY')}</td>
                <td><button class="btn-del" onclick="deleteRecord('${id}')">✕</button></td>
            </tr>`;
    }).join('');

    main.innerHTML = `
        <div class="summary">
            <div class="summary-card expense">
                <span class="label">Total del Mes</span>
                <span class="amount">$ ${total.toLocaleString('es-UY')}</span>
            </div>
        </div>
        <div class="section-card">
            <div class="section-header">
                <h3>Gastos</h3>
                <button class="btn-confirm-sm" onclick="addNewExpense()">+ Nuevo</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Gasto</th><th>Responsable</th><th>Monto</th><th></th></tr></thead>
                    <tbody>${items}</tbody>
                </table>
            </div>
        </div>
    `;
}

window.updateRecord = (id, field, val) => {
    db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses/${id}`).update({ [field]: val });
};

window.editAmount = (id, current) => {
    const val = prompt("Editar monto ($):", current);
    if (val !== null && !isNaN(val)) updateRecord(id, 'monto', parseFloat(val));
};

window.deleteRecord = (id) => {
    if (confirm("¿Eliminar este gasto?")) {
        db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses/${id}`).remove();
    }
};

window.addNewExpense = () => {
    const desc = prompt("Descripción del gasto:");
    if (!desc) return;
    const id = db.ref().child('temp').push().key;
    db.ref(`users/${currentUser.uid}/data/${currentMonth}/expenses/${id}`).set({
        desc, monto: 0, pago: members[0], fecha: new Date().toISOString().split('T')[0]
    });
};

function renderMembersList() {
    const list = document.getElementById('members-list');
    list.innerHTML = members.map((m, i) => `
        <li class="member-item">
            <span>${m}</span>
            <button class="btn-del" onclick="removeMember(${i})">✕</button>
        </li>`).join('');
}

window.removeMember = (i) => {
    if (members.length > 1) {
        members.splice(i, 1);
        renderMembersList();
    }
};

// 9. INICIALIZACIÓN INMEDIATA
document.addEventListener('DOMContentLoaded', () => {
    setupLoginListeners();
});