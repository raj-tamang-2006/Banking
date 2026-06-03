// ===== DADDY'S MONEY BANK - CORE JS =====
const DMB = {

  // ===== STORAGE HELPERS =====
  getUsers() { return JSON.parse(localStorage.getItem('dmb_users') || '[]'); },
  saveUsers(users) { localStorage.setItem('dmb_users', JSON.stringify(users)); },
  getSession() { return JSON.parse(localStorage.getItem('dmb_session') || 'null'); },
  saveSession(user) { localStorage.setItem('dmb_session', JSON.stringify(user)); },
  clearSession() { localStorage.removeItem('dmb_session'); },
  getTransactions() { return JSON.parse(localStorage.getItem('dmb_transactions') || '[]'); },
  saveTransactions(txns) { localStorage.setItem('dmb_transactions', JSON.stringify(txns)); },

  // ===== AUTH =====
  requireAuth() {
    const user = this.getSession();
    if (!user) { window.location.href = 'index.html'; return null; }
    return user;
  },

  login(email, password) {
    const users = this.getUsers();
    const user = users.find(u => u.email === email && u.password === this.hashPass(password));
    if (!user) return { ok: false, msg: 'Invalid email or password.' };
    this.saveSession(user);
    return { ok: true, user };
  },

  register(data) {
    const users = this.getUsers();
    if (users.find(u => u.email === data.email)) return { ok: false, msg: 'Email already registered.' };
    const user = {
      id: 'U' + Date.now(),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      password: this.hashPass(data.password),
      balance: 5000.00,
      accountNumber: this.genAccountNumber(),
      accountType: 'Premium Checking',
      joined: new Date().toISOString(),
      avatar: (data.firstName[0] + data.lastName[0]).toUpperCase()
    };
    users.push(user);
    this.saveUsers(users);
    // Welcome transaction
    this.addTransaction({
      userId: user.id,
      type: 'credit',
      category: 'Welcome Bonus',
      description: 'Welcome Bonus – Daddy\'s Money Bank',
      amount: 5000.00,
      balance: 5000.00,
      status: 'completed'
    });
    return { ok: true, user };
  },

  logout() {
    this.clearSession();
    window.location.href = 'index.html';
  },

  hashPass(pw) {
    // Simple hash simulation (NOT for production)
    let h = 0;
    for (let i = 0; i < pw.length; i++) h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
    return 'H' + Math.abs(h).toString(16);
  },

  genAccountNumber() {
    return 'DMB-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
  },

  // ===== CURRENT USER =====
  getCurrentUser() {
    const session = this.getSession();
    if (!session) return null;
    const users = this.getUsers();
    return users.find(u => u.id === session.id) || session;
  },

  updateUser(updated) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === updated.id);
    if (idx !== -1) { users[idx] = updated; this.saveUsers(users); this.saveSession(updated); }
    return updated;
  },

  // ===== TRANSACTIONS =====
  addTransaction(txn) {
    const txns = this.getTransactions();
    const full = {
      id: 'T' + Date.now() + Math.floor(Math.random()*1000),
      ...txn,
      date: new Date().toISOString()
    };
    txns.unshift(full);
    this.saveTransactions(txns);
    return full;
  },

  getUserTransactions(userId, limit = null) {
    const txns = this.getTransactions().filter(t => t.userId === userId);
    return limit ? txns.slice(0, limit) : txns;
  },

  deposit(amount) {
    const user = this.getCurrentUser();
    if (!user) return { ok: false, msg: 'Not logged in.' };
    if (amount <= 0) return { ok: false, msg: 'Amount must be positive.' };
    const newBalance = parseFloat((user.balance + amount).toFixed(2));
    const updated = { ...user, balance: newBalance };
    this.updateUser(updated);
    this.addTransaction({
      userId: user.id, type: 'credit', category: 'Deposit',
      description: 'Cash Deposit', amount, balance: newBalance, status: 'completed'
    });
    return { ok: true, balance: newBalance };
  },

  withdraw(amount) {
    const user = this.getCurrentUser();
    if (!user) return { ok: false, msg: 'Not logged in.' };
    if (amount <= 0) return { ok: false, msg: 'Amount must be positive.' };
    if (amount > user.balance) return { ok: false, msg: 'Insufficient funds.' };
    const newBalance = parseFloat((user.balance - amount).toFixed(2));
    const updated = { ...user, balance: newBalance };
    this.updateUser(updated);
    this.addTransaction({
      userId: user.id, type: 'debit', category: 'Withdrawal',
      description: 'Cash Withdrawal', amount, balance: newBalance, status: 'completed'
    });
    return { ok: true, balance: newBalance };
  },

  transfer(toIdentifier, amount, note) {
    const user = this.getCurrentUser();
    if (!user) return { ok: false, msg: 'Not logged in.' };
    if (amount <= 0) return { ok: false, msg: 'Amount must be positive.' };
    if (amount > user.balance) return { ok: false, msg: 'Insufficient funds.' };
    const users = this.getUsers();
    const recipient = users.find(u =>
      u.email === toIdentifier || u.accountNumber === toIdentifier
    );
    if (!recipient) return { ok: false, msg: 'Recipient not found. Check email or account number.' };
    if (recipient.id === user.id) return { ok: false, msg: 'Cannot transfer to yourself.' };

    const senderBalance = parseFloat((user.balance - amount).toFixed(2));
    const recipientBalance = parseFloat((recipient.balance + amount).toFixed(2));
    const desc = note || `Transfer to ${recipient.firstName} ${recipient.lastName}`;

    this.updateUser({ ...user, balance: senderBalance });
    this.updateUser({ ...recipient, balance: recipientBalance });

    this.addTransaction({
      userId: user.id, type: 'debit', category: 'Transfer',
      description: `Transfer to ${recipient.firstName} ${recipient.lastName}`,
      amount, balance: senderBalance, status: 'completed', note
    });
    this.addTransaction({
      userId: recipient.id, type: 'credit', category: 'Transfer',
      description: `Transfer from ${user.firstName} ${user.lastName}`,
      amount, balance: recipientBalance, status: 'completed', note
    });
    return { ok: true, balance: senderBalance, recipient: recipient.firstName };
  },

  // ===== HELPERS =====
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  },

  formatDate(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  formatDateTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  },

  txnIcon(type) {
    if (type === 'credit') return 'fa-arrow-down-left';
    if (type === 'debit') return 'fa-arrow-up-right';
    return 'fa-arrow-right-arrow-left';
  },

  categoryIcon(cat) {
    const map = {
      'Deposit': 'fa-wallet', 'Withdrawal': 'fa-money-bill',
      'Transfer': 'fa-arrow-right-arrow-left', 'Welcome Bonus': 'fa-gift',
      'Payment': 'fa-credit-card', 'Shopping': 'fa-bag-shopping',
      'Food': 'fa-utensils', 'Travel': 'fa-plane'
    };
    return map[cat] || 'fa-circle-dollar-to-slot';
  }
};

// ===== TOAST NOTIFICATIONS =====
const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(type, title, msg, duration = 4000) {
    this.init();
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info} toast-icon"></i>
      <div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>
      <i class="fa-solid fa-xmark toast-close"></i>
    `;
    t.querySelector('.toast-close').onclick = () => this.dismiss(t);
    this.container.appendChild(t);
    if (duration > 0) setTimeout(() => this.dismiss(t), duration);
    return t;
  },
  dismiss(t) {
    t.classList.add('hiding');
    setTimeout(() => t.remove(), 350);
  },
  success(title, msg) { return this.show('success', title, msg); },
  error(title, msg) { return this.show('error', title, msg); },
  warning(title, msg) { return this.show('warning', title, msg); },
  info(title, msg) { return this.show('info', title, msg); }
};

// ===== LOADING =====
const Loader = {
  el: null,
  show() {
    this.el = document.getElementById('loadingOverlay');
    if (this.el) this.el.classList.remove('hidden');
  },
  hide() {
    if (this.el) {
      setTimeout(() => this.el.classList.add('hidden'), 600);
    }
  }
};

// ===== SIDEBAR =====
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const toggle = document.getElementById('menuToggle');
  if (!sidebar) return;

  if (toggle) toggle.onclick = () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  };
  if (overlay) overlay.onclick = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  };

  // Set active nav
  const page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('href') === page);
  });

  // Fill user info
  const user = DMB.getCurrentUser();
  if (user) {
    const nameEl = document.getElementById('sidebarUserName');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (nameEl) nameEl.textContent = `${user.firstName} ${user.lastName}`;
    if (avatarEl) avatarEl.textContent = user.avatar || (user.firstName[0] + user.lastName[0]).toUpperCase();
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = () => {
    if (confirm('Are you sure you want to logout?')) DMB.logout();
  };
}

// ===== FORM VALIDATION =====
function validateForm(rules) {
  let ok = true;
  rules.forEach(({ id, check, msg }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value.trim();
    const wrap = el.closest('.form-group');
    const existing = wrap && wrap.querySelector('.field-error');
    if (existing) existing.remove();
    if (!check(val)) {
      ok = false;
      el.style.borderColor = 'var(--danger)';
      if (wrap) {
        const err = document.createElement('p');
        err.className = 'field-error';
        err.style.cssText = 'color:var(--danger);font-size:12px;margin-top:6px;';
        err.textContent = msg;
        wrap.appendChild(err);
      }
    } else {
      el.style.borderColor = '';
    }
  });
  return ok;
}

// ===== PASSWORD TOGGLE =====
function initPasswordToggles() {
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.onclick = () => {
      const input = btn.closest('.input-wrap').querySelector('input');
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.classList.toggle('fa-eye', isText);
      btn.classList.toggle('fa-eye-slash', !isText);
    };
  });
}

// ===== SEED DEMO DATA =====
function seedDemoData() {
  const users = DMB.getUsers();
  if (users.length > 0) return; // Already seeded

  const demoUsers = [
    { firstName: 'John', lastName: 'Daddy', email: 'demo@daddysmoney.com', phone: '555-0100', password: 'demo1234', balance: 24850.75 },
    { firstName: 'Sarah', lastName: 'Connor', email: 'sarah@example.com', phone: '555-0101', password: 'pass1234', balance: 8400.00 },
    { firstName: 'Mike', lastName: 'Johnson', email: 'mike@example.com', phone: '555-0102', password: 'pass1234', balance: 15200.50 },
  ];

  demoUsers.forEach(d => {
    const user = {
      id: 'U' + Date.now() + Math.random(),
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      password: DMB.hashPass(d.password),
      balance: d.balance,
      accountNumber: DMB.genAccountNumber(),
      accountType: 'Premium Checking',
      joined: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
      avatar: (d.firstName[0] + d.lastName[0]).toUpperCase()
    };
    users.push(user);

    // Seed transactions
    const txnTemplates = [
      { type: 'credit', category: 'Deposit', description: 'Payroll Deposit – ABC Corp', amount: 4200.00 },
      { type: 'debit', category: 'Shopping', description: 'Amazon Purchase', amount: 89.99 },
      { type: 'debit', category: 'Food', description: 'Restaurant – The Capital Grille', amount: 145.50 },
      { type: 'credit', category: 'Transfer', description: 'Transfer Received', amount: 500.00 },
      { type: 'debit', category: 'Travel', description: 'Delta Airlines', amount: 380.00 },
      { type: 'debit', category: 'Payment', description: 'Utility Bill – City Electric', amount: 112.30 },
      { type: 'credit', category: 'Deposit', description: 'Interest Credit', amount: 28.45 },
      { type: 'debit', category: 'Shopping', description: 'Apple Store', amount: 299.00 },
    ];

    let bal = d.balance;
    const txns = DMB.getTransactions();
    txnTemplates.forEach((t, i) => {
      const date = new Date(Date.now() - (i + 1) * 1000 * 60 * 60 * 24 * 3);
      txns.push({
        id: 'T' + Date.now() + i + Math.random(),
        userId: user.id,
        ...t,
        balance: bal,
        status: 'completed',
        date: date.toISOString()
      });
      if (t.type === 'credit') bal -= t.amount; else bal += t.amount;
    });
    DMB.saveTransactions(txns);
  });
  DMB.saveUsers(users);
}

// Init on all pages
document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  initPasswordToggles();
  Loader.show();
  setTimeout(() => Loader.hide(), 800);
});
