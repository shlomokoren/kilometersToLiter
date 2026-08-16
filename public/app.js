const form = document.getElementById('entry-form');
const formError = document.getElementById('form-error');
const lastResult = document.getElementById('last-result');
const averageEl = document.getElementById('average');
const tbody = document.querySelector('#entries-table tbody');
const noEntriesEl = document.getElementById('no-entries');
const carSelect = document.getElementById('carId');
const entrySubmitBtn = document.getElementById('entry-submit-btn');
const noCarsHint = document.getElementById('no-cars-hint');
const carForm = document.getElementById('car-form');
const carFormError = document.getElementById('car-form-error');
const carNameInput = document.getElementById('carName');
const carMakeInput = document.getElementById('carMake');
const carModelInput = document.getElementById('carModel');
const carYearInput = document.getElementById('carYear');
const carSubmitBtn = document.getElementById('car-submit-btn');
const carCancelBtn = document.getElementById('car-cancel-btn');
const makeList = document.getElementById('make-list');
const modelList = document.getElementById('model-list');
const carsTbody = document.querySelector('#cars-table tbody');
const noCarsEl = document.getElementById('no-cars');
const goToCarsBtn = document.getElementById('go-to-cars-btn');
const entryCancelBtn = document.getElementById('entry-cancel-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = {
  fuel: document.getElementById('tab-fuel'),
  cars: document.getElementById('tab-cars'),
  issues: document.getElementById('tab-issues'),
};
const issueForm = document.getElementById('issue-form');
const issueDescriptionInput = document.getElementById('issueDescription');
const issueFormError = document.getElementById('issue-form-error');
const issueSubmitBtn = document.getElementById('issue-submit-btn');
const issueCancelBtn = document.getElementById('issue-cancel-btn');
const issuesTbody = document.querySelector('#issues-table tbody');
const issuesTableHead = document.getElementById('issues-table-head');
const issuesListTitle = document.getElementById('issues-list-title');
const noIssuesEl = document.getElementById('no-issues');
const userBar = document.getElementById('user-bar');
const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginMessage = document.getElementById('login-message');
const envBadge = document.getElementById('env-badge');
const aboutBtn = document.getElementById('about-btn');
const aboutModal = document.getElementById('about-modal');
const aboutVersion = document.getElementById('about-version');
const aboutCloseBtn = document.getElementById('about-close-btn');

let cars = [];
let editingCarId = null;
let editingEntryId = null;
let issues = [];
let isDeveloperUser = false;

const ISSUE_STATUSES = ['new', 'in_progress', 'resolved', 'wont_fix', 'closed'];
let editingIssueId = null;

function parseKm(value) {
  if (typeof value !== 'string') return Number(value);
  return Number(value.replace(/,/g, ''));
}

function formatKm(value) {
  const num = parseKm(value);
  if (!Number.isFinite(num)) return value;
  const [intPart, decPart] = String(num).split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

['startKm', 'endKm'].forEach((id) => {
  document.getElementById(id).addEventListener('blur', (event) => {
    if (!event.target.value) return;
    event.target.value = formatKm(event.target.value);
  });
});

function resetIssueForm() {
  editingIssueId = null;
  issueForm.reset();
  issueSubmitBtn.textContent = 'Report issue';
  issueCancelBtn.classList.add('hidden');
  issueFormError.textContent = '';
}

issueCancelBtn.addEventListener('click', resetIssueForm);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function statusLabel(status) {
  return status.replace(/_/g, ' ');
}

function renderIssues() {
  issuesListTitle.textContent = isDeveloperUser ? '📋 All reported issues' : '📋 Your reported issues';
  issuesTableHead.innerHTML = isDeveloperUser
    ? '<th>Date</th><th>Reporter</th><th>Status</th><th>Description</th><th></th>'
    : '<th>Date</th><th>Status</th><th>Description</th><th></th>';

  issuesTbody.innerHTML = '';
  noIssuesEl.classList.toggle('hidden', issues.length > 0);

  issues.forEach((issue) => {
    const tr = document.createElement('tr');
    const dateStr = new Date(issue.date).toLocaleString();
    const description = escapeHtml(issue.description);
    const editBtn = `<button type="button" class="edit-btn" data-id="${issue.id}" aria-label="Edit issue">✎</button>`;

    if (isDeveloperUser) {
      const statusOptions = ISSUE_STATUSES.map(
        (s) => `<option value="${s}" ${s === issue.status ? 'selected' : ''}>${statusLabel(s)}</option>`
      ).join('');
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td>${escapeHtml(issue.email)}</td>
        <td><select class="issue-status-select" data-id="${issue.id}">${statusOptions}</select></td>
        <td>${description}</td>
        <td>
          ${editBtn}
          <button type="button" class="delete-btn" data-id="${issue.id}" aria-label="Delete issue">✕</button>
        </td>
      `;
    } else {
      const closeBtn = issue.status !== 'closed'
        ? `<button type="button" class="close-issue-btn" data-id="${issue.id}">Close</button>`
        : '';
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td>${statusLabel(issue.status)}</td>
        <td>${description}</td>
        <td>${editBtn} ${closeBtn}</td>
      `;
    }
    issuesTbody.appendChild(tr);
  });
}

async function loadIssues() {
  const res = await fetch('/api/issues');
  if (res.status === 401) return;
  const data = await res.json();
  issues = data.issues;
  renderIssues();
}

issueForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  issueFormError.textContent = '';

  const payload = { description: issueDescriptionInput.value.trim() };
  const url = editingIssueId ? `/api/issues/${editingIssueId}` : '/api/issues';
  const method = editingIssueId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) return;

  const data = await res.json();
  if (!res.ok) {
    issueFormError.textContent = data.error || 'Something went wrong.';
    return;
  }

  issues = data.issues;
  renderIssues();
  resetIssueForm();
});

issuesTbody.addEventListener('change', async (event) => {
  const select = event.target.closest('.issue-status-select');
  if (!select) return;

  const res = await fetch(`/api/issues/${select.dataset.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: select.value }),
  });

  if (res.status === 401) return;

  const data = await res.json();
  if (!res.ok) {
    window.alert(data.error || 'Could not update issue.');
    return;
  }

  issues = data.issues;
  renderIssues();
});

issuesTbody.addEventListener('click', async (event) => {
  const editBtn = event.target.closest('.edit-btn');
  const closeBtn = event.target.closest('.close-issue-btn');
  const deleteBtn = event.target.closest('.delete-btn');

  if (editBtn) {
    const issue = issues.find((i) => String(i.id) === editBtn.dataset.id);
    if (!issue) return;
    editingIssueId = issue.id;
    issueDescriptionInput.value = issue.description;
    issueSubmitBtn.textContent = 'Save issue';
    issueCancelBtn.classList.remove('hidden');
    issueFormError.textContent = '';
    return;
  }

  if (closeBtn) {
    const res = await fetch(`/api/issues/${closeBtn.dataset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    if (res.status === 401) return;

    const data = await res.json();
    if (!res.ok) {
      window.alert(data.error || 'Could not close issue.');
      return;
    }

    issues = data.issues;
    renderIssues();
    return;
  }

  if (!deleteBtn) return;

  if (!window.confirm('Delete this issue? This cannot be undone.')) return;

  const res = await fetch(`/api/issues/${deleteBtn.dataset.id}`, { method: 'DELETE' });
  if (res.status === 401) return;

  const data = await res.json();
  if (!res.ok) {
    window.alert(data.error || 'Could not delete issue.');
    return;
  }

  issues = data.issues;
  renderIssues();
});

function resetEntryForm() {
  editingEntryId = null;
  form.reset();
  entrySubmitBtn.textContent = 'Calculate';
  entryCancelBtn.classList.add('hidden');
  formError.textContent = '';
}

entryCancelBtn.addEventListener('click', resetEntryForm);

function showTab(tab) {
  Object.entries(tabPanels).forEach(([name, panel]) => {
    panel.classList.toggle('hidden', name !== tab);
  });
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

goToCarsBtn.addEventListener('click', () => showTab('cars'));

function carLabel(c) {
  const details = [c.make, c.model].filter(Boolean).join(' ');
  return details ? `${c.name} (${details})` : c.name;
}

function renderCarSelect() {
  carSelect.innerHTML = cars
    .map((c) => `<option value="${c.id}">${carLabel(c)}</option>`)
    .join('');
  const hasCars = cars.length > 0;
  noCarsHint.classList.toggle('hidden', hasCars);
  carSelect.disabled = !hasCars;
  entrySubmitBtn.disabled = !hasCars;
  ['startKm', 'endKm', 'liters'].forEach((id) => {
    document.getElementById(id).disabled = !hasCars;
  });
}

function renderCars() {
  carsTbody.innerHTML = '';
  noCarsEl.classList.toggle('hidden', cars.length > 0);
  cars.forEach((c) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.make || '—'}</td>
      <td>${c.model || '—'}</td>
      <td>${c.year || '—'}</td>
      <td>
        <button type="button" class="edit-btn" data-id="${c.id}" aria-label="Edit car">✎</button>
        <button type="button" class="delete-btn" data-id="${c.id}" aria-label="Delete car">✕</button>
      </td>
    `;
    carsTbody.appendChild(tr);
  });
}

async function loadCars() {
  const res = await fetch('/api/cars');
  if (res.status === 401) return;
  const data = await res.json();
  cars = data.cars;
  renderCars();
  renderCarSelect();
}

async function loadCarMakes() {
  const res = await fetch('/api/car-makes');
  if (res.status === 401) return;
  const data = await res.json();
  makeList.innerHTML = data.makes.map((m) => `<option value="${m}">`).join('');
}

async function loadCarModels(make) {
  if (!make) {
    modelList.innerHTML = '';
    return;
  }
  const res = await fetch(`/api/car-models?make=${encodeURIComponent(make)}`);
  if (res.status === 401 || !res.ok) return;
  const data = await res.json();
  modelList.innerHTML = data.models.map((m) => `<option value="${m}">`).join('');
}

function resetCarForm() {
  editingCarId = null;
  carForm.reset();
  carSubmitBtn.textContent = 'Add car';
  carCancelBtn.classList.add('hidden');
  carFormError.textContent = '';
}

carMakeInput.addEventListener('change', () => loadCarModels(carMakeInput.value.trim()));

carCancelBtn.addEventListener('click', resetCarForm);

carsTbody.addEventListener('click', async (event) => {
  const editBtn = event.target.closest('.edit-btn');
  const deleteBtn = event.target.closest('.delete-btn');

  if (editBtn) {
    const car = cars.find((c) => String(c.id) === editBtn.dataset.id);
    if (!car) return;
    editingCarId = car.id;
    carNameInput.value = car.name;
    carMakeInput.value = car.make;
    carModelInput.value = car.model;
    carYearInput.value = car.year || '';
    carSubmitBtn.textContent = 'Save car';
    carCancelBtn.classList.remove('hidden');
    loadCarModels(car.make);
    return;
  }

  if (deleteBtn) {
    if (!window.confirm('Delete this car? Fuel entries logged against it will keep their data but no longer show a car.')) return;
    const id = deleteBtn.dataset.id;
    const res = await fetch(`/api/cars/${id}`, { method: 'DELETE' });
    if (res.status === 401) return;
    const data = await res.json();
    if (!res.ok) {
      window.alert(data.error || 'Could not delete car.');
      return;
    }
    if (editingCarId === Number(id)) resetCarForm();
    cars = data.cars;
    renderCars();
    renderCarSelect();
    loadEntries();
  }
});

carForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  carFormError.textContent = '';

  const payload = {
    name: carNameInput.value.trim(),
    make: carMakeInput.value.trim(),
    model: carModelInput.value.trim(),
    year: carYearInput.value || null,
  };

  const url = editingCarId ? `/api/cars/${editingCarId}` : '/api/cars';
  const method = editingCarId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) return;

  const data = await res.json();
  if (!res.ok) {
    carFormError.textContent = data.error || 'Something went wrong.';
    return;
  }

  cars = data.cars;
  renderCars();
  renderCarSelect();
  resetCarForm();
  loadEntries();
});

function closeAbout() {
  aboutModal.classList.add('hidden');
}

async function openAbout() {
  aboutModal.classList.remove('hidden');
  aboutVersion.textContent = 'Loading…';
  try {
    const res = await fetch('/api/version');
    const data = await res.json();
    const deployed = new Date(data.deployedAt).toLocaleString();
    aboutVersion.textContent = `Version: ${data.commit}\nDeployed: ${deployed}`;
  } catch {
    aboutVersion.textContent = 'Version info unavailable.';
  }
}

aboutBtn.addEventListener('click', openAbout);
aboutCloseBtn.addEventListener('click', closeAbout);
aboutModal.addEventListener('click', (event) => {
  if (event.target === aboutModal) closeAbout();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !aboutModal.classList.contains('hidden')) closeAbout();
});

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

function renderCarAverages(carAverages) {
  if (!carAverages || carAverages.length === 0) {
    averageEl.innerHTML = '<p class="empty">Add a car to see its average.</p>';
    return;
  }

  averageEl.innerHTML = carAverages
    .map((ca) => {
      const body = ca.average
        ? `<div class="stat-grid"></div>`
        : `<p class="empty">No entries yet.</p>`;
      return `<div class="car-average"><h3>${ca.carName}</h3>${body}</div>`;
    })
    .join('');

  carAverages.forEach((ca, i) => {
    if (!ca.average) return;
    const grid = averageEl.children[i].querySelector('.stat-grid');
    renderStats(grid, ca.average);
  });
}

let lastLoadedEntries = [];

function renderEntries(entries) {
  lastLoadedEntries = entries;
  tbody.innerHTML = '';
  noEntriesEl.classList.toggle('hidden', entries.length > 0);
  entries.forEach((e, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.carName || '—'}</td>
      <td>${formatKm(e.startKm)}</td>
      <td>${formatKm(e.endKm)}</td>
      <td>${e.distance}</td>
      <td>${e.liters}</td>
      <td>${e.kmPerL}</td>
      <td>${e.lPer100km}</td>
      <td>${e.mpgUs}</td>
      <td>
        <button type="button" class="edit-btn" data-id="${e.id}" aria-label="Edit entry">✎</button>
        <button type="button" class="delete-btn" data-index="${index}" aria-label="Delete entry">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function prefillStartKm(entries) {
  const startKmInput = document.getElementById('startKm');
  if (startKmInput.value || !entries || entries.length === 0) return;
  startKmInput.value = formatKm(entries[entries.length - 1].endKm);
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
  renderCarAverages(data.carAverages);
  prefillStartKm(data.entries);
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
  isDeveloperUser = Boolean(data.isDeveloper);
  loadCarMakes();
  await loadCars();
  loadEntries();
  loadIssues();
}

logoutBtn.addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.reload();
});

tbody.addEventListener('click', async (event) => {
  const editBtn = event.target.closest('.edit-btn');
  const deleteBtn = event.target.closest('.delete-btn');

  if (editBtn) {
    const entry = lastLoadedEntries.find((en) => String(en.id) === editBtn.dataset.id);
    if (!entry) return;

    editingEntryId = entry.id;
    carSelect.value = entry.carId || '';
    document.getElementById('startKm').value = formatKm(entry.startKm);
    document.getElementById('endKm').value = formatKm(entry.endKm);
    document.getElementById('liters').value = entry.liters;
    entrySubmitBtn.textContent = 'Save entry';
    entryCancelBtn.classList.remove('hidden');
    formError.textContent = '';
    return;
  }

  if (!deleteBtn) return;

  if (!window.confirm('Delete this entry? This cannot be undone.')) return;

  const index = deleteBtn.dataset.index;
  const deletedEntry = lastLoadedEntries[index];
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

  if (deletedEntry && String(deletedEntry.id) === String(editingEntryId)) resetEntryForm();
  renderEntries(data.entries);
  renderCarAverages(data.carAverages);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';

  const payload = {
    carId: carSelect.value,
    startKm: parseKm(document.getElementById('startKm').value),
    endKm: parseKm(document.getElementById('endKm').value),
    liters: document.getElementById('liters').value,
  };

  const url = editingEntryId ? `/api/entries/${editingEntryId}` : '/api/entries';
  const method = editingEntryId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
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

  const newEntry = editingEntryId
    ? data.entries.find((en) => String(en.id) === String(editingEntryId))
    : data.entries[data.entries.length - 1];
  if (newEntry) {
    lastResult.classList.remove('hidden');
    renderStats(lastResult.querySelector('.stat-grid'), newEntry);
  }

  renderEntries(data.entries);
  renderCarAverages(data.carAverages);
  resetEntryForm();
});

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
