const form = document.getElementById('entry-form');
const formError = document.getElementById('form-error');
const lastResult = document.getElementById('last-result');
const averageEl = document.getElementById('average');
const tbody = document.querySelector('#entries-table tbody');
const noEntriesEl = document.getElementById('no-entries');
const syncStatusEl = document.getElementById('sync-status');

function setSyncStatus(state, message) {
  syncStatusEl.className = `sync-status ${state}`;
  syncStatusEl.textContent = message;
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
  for (const e of entries) {
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
    `;
    tbody.appendChild(tr);
  }
}

async function loadEntries() {
  const res = await fetch('/api/entries');
  const data = await res.json();
  renderEntries(data.entries);
  renderAverage(data.average);
  if (!data.driveConfigured) {
    setSyncStatus('off', '☁ Drive sync not set up — see SETUP.md');
  } else {
    setSyncStatus('ok', '☁ Drive sync enabled');
  }
}

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

  if (data.synced) {
    setSyncStatus('ok', '☁ Synced to Drive');
  } else if (data.syncError) {
    setSyncStatus('warn', `⚠ Saved locally, Drive sync failed: ${data.syncError}`);
  }
});

loadEntries();
