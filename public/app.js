const form = document.getElementById('entry-form');
const formError = document.getElementById('form-error');
const lastResult = document.getElementById('last-result');
const averageEl = document.getElementById('average');
const tbody = document.querySelector('#entries-table tbody');
const noEntriesEl = document.getElementById('no-entries');
const userBar = document.getElementById('user-bar');
const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginMessage = document.getElementById('login-message');
const envBadge = document.getElementById('env-badge');

function renderEnvBadge(environment) {
  envBadge.classList.remove('hidden');
  if (environment === 'production') {
    envBadge.textContent = '🚀 Production';
    envBadge.className = 'env-badge production';
  } else {
    envBadge.textContent = '🧪 Test';
    envBadge.className = 'env-badge test';
  }
}

function statBlock(label, value) {
  return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function renderStats(container, conv) {
  container.innerHTML =
    statBlock('km/L', conv.kmPerL) +
    statBlock('L/100km', conv.lPer100km) +
    statBlock('MPG (US)', conv.mpgUs);
}

function renderAverage(average) {
  if (!average) {
    averageEl.className = 'stat-grid empty';
    averageEl.innerHTML = 'No entries yet.';
    return;
  }
  averageEl.className = 'stat-grid';
  renderStats(averageEl, average);
}

function renderEntries(entries) {
  tbody.innerHTML = '';
  noEntriesEl.classList.toggle('hidden', entries.length > 0);
  entries.forEach((e, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.startKm}</td>
      <td>${e.endKm}</td>
      <td>${e.distance}</td>
      <td>${e.liters}</td>
      <td>${e.kmPerL}</td>
      <td>${e.lPer100km}</td>
      <td>${e.mpgUs}</td>
      <td><button type="button" class="delete-btn" data-index="${index}" aria-label="Delete entry">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadEntries() {
  const res = await fetch('/api/entries');
  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    showLoggedOut(data.error);
    return;
  }
  const data = await res.json();
  renderEntries(data.entries);
  renderAverage(data.average);
}

function showLoggedOut(message) {
  loginView.classList.remove('hidden');
  appView.classList.add('hidden');
  userBar.classList.add('hidden');
  loginMessage.textContent = message || '';
  loginMessage.classList.toggle('hidden', !message);
}

function showLoggedIn(email) {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  userBar.classList.remove('hidden');
  userEmailEl.textContent = email;
}

async function init() {
  const res = await fetch('/api/session');
  const data = await res.json();
  renderEnvBadge(data.environment);
  if (!data.authenticated) {
    showLoggedOut();
    return;
  }
  showLoggedIn(data.email);
  loadEntries();
}

logoutBtn.addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.reload();
});

tbody.addEventListener('click', async (event) => {
  const btn = event.target.closest('.delete-btn');
  if (!btn) return;

  if (!window.confirm('Delete this entry? This cannot be undone.')) return;

  const index = btn.dataset.index;
  const res = await fetch(`/api/entries/${index}`, { method: 'DELETE' });

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    showLoggedOut(data.error);
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    window.alert(data.error || 'Could not delete entry.');
    return;
  }

  renderEntries(data.entries);
  renderAverage(data.average);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';

  const payload = {
    startKm: document.getElementById('startKm').value,
    endKm: document.getElementById('endKm').value,
    liters: document.getElementById('liters').value,
  };

  const res = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    showLoggedOut(data.error);
    return;
  }

  const data = await res.json();

  if (!res.ok) {
    formError.textContent = data.error || 'Something went wrong.';
    return;
  }

  const newEntry = data.entries[data.entries.length - 1];
  lastResult.classList.remove('hidden');
  renderStats(lastResult.querySelector('.stat-grid'), newEntry);

  renderEntries(data.entries);
  renderAverage(data.average);
  form.reset();
});

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
