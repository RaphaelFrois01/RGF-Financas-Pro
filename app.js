// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = 'https://lknqvuzpbxlizfplodvh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrbnF2dXpwYnhsaXpmcGxvZHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTIxNzYsImV4cCI6MjA5MTA2ODE3Nn0.kBbrpJqRTJ4zOCLiEGaT6EBBRlHK8AFHuvw-d9hjkEk';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
    });
}

// Core State Management
let transactions = [];
let cashFlowChart = null;
let expenseChart = null;
let currentUser = null;

// Auth State Management
let isLoginPage = true;

// Alternar entre Login e Cadastro
document.getElementById('toggle-auth')?.addEventListener('click', () => {
    isLoginPage = !isLoginPage;
    const title = document.getElementById('auth-title');
    const desc = document.getElementById('auth-desc');
    const btn = document.getElementById('auth-btn');
    const toggle = document.getElementById('toggle-auth');
    const msg = document.getElementById('auth-msg');

    msg.innerText = '';
    if (isLoginPage) {
        title.innerText = 'Bem-vindo! 👋';
        desc.innerText = 'Insira seu e-mail e senha para acessar sua conta.';
        btn.innerText = 'Entrar';
        toggle.innerText = 'Não tem conta? Cadastre-se';
    } else {
        title.innerText = 'Criar Conta ✨';
        desc.innerText = 'Comece sua jornada financeira agora mesmo.';
        btn.innerText = 'Cadastrar';
        toggle.innerText = 'Já tem conta? Entrar';
    }
});

// Formulário de Autenticação
document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('auth-btn');
    const msg = document.getElementById('auth-msg');
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    btn.disabled = true;
    const originalBtnText = btn.innerText;
    btn.innerText = 'Processando...';
    msg.innerText = '';
    msg.style.color = "var(--error)";

    try {
        if (isLoginPage) {
            // Apenas tentativa de Login
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                if (error.message.includes("Invalid login credentials")) {
                    throw new Error("E-mail ou senha incorretos. Verifique e tente novamente.");
                }
                throw error;
            }
        } else {
            // Apenas tentativa de Cadastro
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            if (error) throw error;

            if (data?.user?.identities?.length === 0) {
                throw new Error("Este e-mail já está cadastrado. Tente fazer login.");
            }

            msg.style.color = "var(--success)";
            msg.innerText = "Conta criada! Verifique seu e-mail se necessário ou faça login.";
        }
    } catch (err) {
        msg.innerText = err.message;
    } finally {
        btn.disabled = false;
        btn.innerText = originalBtnText;
    }
});

// Esqueci minha senha (Solicitação)
document.getElementById('forgot-password-link')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const msg = document.getElementById('auth-msg');

    if (!email) {
        msg.innerText = "Por favor, digite seu e-mail acima primeiro.";
        return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href, // Volta para o site atual
    });

    if (error) {
        msg.innerText = "Erro: " + error.message;
    } else {
        msg.style.color = "var(--success)";
        msg.innerText = "E-mail de recuperação enviado! Verifique sua caixa de entrada.";
    }
});

// Salvar Nova Senha (Após clicar no link do e-mail)
document.getElementById('recovery-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('recovery-btn');
    const msg = document.getElementById('recovery-msg');
    const newPassword = document.getElementById('new-password').value;

    btn.disabled = true;
    btn.innerText = "Salvando...";

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
        msg.innerText = "Erro ao salvar senha: " + error.message;
        btn.disabled = false;
        btn.innerText = "Salvar Nova Senha";
    } else {
        alert("Senha atualizada com sucesso! Você já pode entrar.");
        window.location.reload(); // Recarrega para limpar o estado de recuperação
    }
});

// Logout
document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

// Listener de Estado de Autenticação
supabaseClient.auth.onAuthStateChange((event, session) => {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const recoveryContainer = document.getElementById('recovery-container');

    // Se o evento for de recuperação de senha
    if (event === 'PASSWORD_RECOVERY') {
        authContainer.style.display = 'none';
        appContainer.style.display = 'none';
        recoveryContainer.style.display = 'flex';
        return;
    }

    if (session) {
        currentUser = session.user;
        authContainer.style.display = 'none';
        recoveryContainer.style.display = 'none';
        appContainer.style.display = 'grid'; // Volta para as classes do grid original
        appContainer.classList.add('container');
        setDefaultDates();
        loadData();
    } else {
        currentUser = null;
        transactions = [];
        authContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        recoveryContainer.style.display = 'none';
    }
});


// Load from Database
async function loadData() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;
        transactions = data || [];
        renderAll();
    } catch (err) {
        console.error("Erro ao carregar do Supabase:", err);
        alert("Erro de conexão com o Banco de Dados. Verifique o console.");
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('in-date').value = today;
    document.getElementById('ex-date').value = today;
}

// UI Rendering
function renderAll() {
    renderKPIs();
    renderTable();
    renderCharts();
}

function renderKPIs() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyData = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = monthlyData.filter(t => t.type === 'Entrada').reduce((acc, t) => acc + parseFloat(t.value), 0);
    const expense = monthlyData.filter(t => t.type === 'Saída').reduce((acc, t) => acc + parseFloat(t.value), 0);
    const balance = income - expense;

    document.getElementById('total-balance').textContent = formatCurrency(balance);
    document.getElementById('monthly-income').textContent = formatCurrency(income);
    document.getElementById('monthly-expense').textContent = formatCurrency(expense);
}

function renderTable() {
    const tbody = document.getElementById('transactions-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(t => {
        const idParam = typeof t.id === 'string' ? `'${t.id}'` : t.id;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td>${t.category}</td>
            <td>${t.description}</td>
            <td style="color: ${t.type === 'Entrada' ? 'var(--success)' : 'var(--error)'}">${t.type}</td>
            <td style="font-weight: 700;">${formatCurrency(t.value)}</td>
            <td>
                <button onclick="deleteTransaction(${idParam})" style="background: none; border: none; cursor: pointer; color: var(--text-secondary);">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderCharts() {
    const canvasFlow = document.getElementById('cashflow-chart');
    const canvasExp = document.getElementById('expense-chart');

    if (!canvasFlow || !canvasExp) return;

    const ctxFlow = canvasFlow.getContext('2d');
    const ctxExp = canvasExp.getContext('2d');

    if (cashFlowChart) cashFlowChart.destroy();
    if (expenseChart) expenseChart.destroy();

    const labels = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthLabel = d.toLocaleString('pt-br', { month: 'short' });
        labels.push(monthLabel);

        const m = d.getMonth();
        const y = d.getFullYear();

        const filtered = transactions.filter(t => {
            const td = new Date(t.date);
            return td.getMonth() === m && td.getFullYear() === y;
        });

        incomeData.push(filtered.filter(t => t.type === 'Entrada').reduce((acc, t) => acc + parseFloat(t.value), 0));
        expenseData.push(filtered.filter(t => t.type === 'Saída').reduce((acc, t) => acc + parseFloat(t.value), 0));
    }

    cashFlowChart = new Chart(ctxFlow, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Entradas', data: incomeData, backgroundColor: '#22c55e', borderRadius: 8 },
                { label: 'Saídas', data: expenseData, backgroundColor: '#ef4444', borderRadius: 8 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: '#f8fafc' } } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    const expenses = transactions.filter(t => t.type === 'Saída');
    const categories = [...new Set(expenses.map(t => t.category))];
    const categoryTotals = categories.map(c =>
        expenses.filter(t => t.category === c).reduce((acc, t) => acc + parseFloat(t.value), 0)
    );

    expenseChart = new Chart(ctxExp, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: categoryTotals,
                backgroundColor: ['#6366f1', '#ec4899', '#8b5cf6', '#f59e0b', '#06b6d4', '#10b981'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc', padding: 20 } }
            },
            cutout: '70%'
        }
    });
}

// Transaction Logic API Integration
async function addTransaction(event, type) {
    event.preventDefault();
    if (!currentUser) return;

    // Mostra estado de loading
    const rawBtn = event.target.querySelector('button[type="submit"]');
    const originalText = rawBtn.innerText;
    rawBtn.innerText = "Salvando...";
    rawBtn.disabled = true;

    const prefix = type === 'Entrada' ? 'in' : 'ex';
    const category = document.getElementById(`${prefix}-category`).value;
    const value = document.getElementById(`${prefix}-value`).value;
    const desc = document.getElementById(`${prefix}-desc`).value;
    const date = document.getElementById(`${prefix}-date`).value;

    const newRow = {
        user_id: currentUser.id,
        date,
        category,
        description: desc || 'Sem descrição',
        type,
        value: parseFloat(value)
    };

    // Envia pro Supabase
    const { data, error } = await supabaseClient
        .from('transactions')
        .insert([newRow])
        .select();

    if (error) {
        console.error(error);
        alert("Erro ao salvar no banco em nuvem.");
    } else if (data) {
        transactions.push(data[0]); // Pega o retorno do DB com o UUID gerado
    }

    renderAll();
    event.target.reset();
    setDefaultDates();

    // Restaura botão
    rawBtn.innerText = originalText;
    rawBtn.disabled = false;
}

async function deleteTransaction(id) {
    if (!confirm("Tem certeza que deseja apagar essa transação?")) return;
    if (!currentUser) return;

    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error(error);
        alert("Ocorreu um erro ao apagar item da nuvem.");
        return;
    }

    transactions = transactions.filter(t => t.id !== id);
    renderAll();
}

// UI Tabs
function switchTab(tab) {
    document.getElementById('income-form').style.display = tab === 'income' ? 'block' : 'none';
    document.getElementById('expense-form').style.display = tab === 'expense' ? 'block' : 'none';
    document.getElementById('import-tab').style.display = tab === 'import' ? 'block' : 'none';

    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(b => b.classList.remove('active'));

    const currentBtn = Array.from(btns).find(b =>
        (tab === 'income' && b.textContent.includes('Receita')) ||
        (tab === 'expense' && b.textContent.includes('Despesa')) ||
        (tab === 'import' && b.textContent.includes('Importar'))
    );
    if (currentBtn) currentBtn.classList.add('active');
}

// CSV Export/Import
document.getElementById('export-csv')?.addEventListener('click', () => {
    const headers = ['Data', 'Categoria', 'Descrição', 'Tipo', 'Valor'];
    const rows = transactions.map(t => [t.date, t.category, t.description, t.type, t.value].join(','));
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "finance_backup.csv");
    document.body.appendChild(link);
    link.click();
});

document.getElementById('csv-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target.result;
        const rows = text.split('\n').slice(1).filter(r => r.trim() !== "");

        let batchToInsert = [];

        rows.forEach(row => {
            const cols = row.split(',');
            if (cols.length >= 5) {
                batchToInsert.push({
                    user_id: currentUser.id,
                    date: cols[0],
                    category: cols[1],
                    description: cols[2],
                    type: cols[3],
                    value: parseFloat(cols[4])
                });
            }
        });

        // Importar tudo de uma vez no banco
        const { data, error } = await supabaseClient
            .from('transactions')
            .insert(batchToInsert)
            .select();

        if (error) {
            console.error("Erro no import bulk: ", error);
            alert("Erro de importação na nuvem!");
            return;
        }
        if (data) {
            transactions = [...transactions, ...data];
        }

        renderAll();
        alert('Dados importados com sucesso! 🎉');
    };
    reader.readAsText(file);
});

// Utils
function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(val) {
    if (!val) return "";
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
}
