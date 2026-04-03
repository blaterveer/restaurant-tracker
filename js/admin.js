// ============================================================
// ADMIN VIEW
// ============================================================
function renderAdminView() {
  renderAdminStats();
  renderAdminList('categories', 'admin-cat-list',   'admin-cat-count');
  renderAdminList('types',      'admin-type-list',  'admin-type-count');
  renderAdminList('owners',     'admin-owner-list', 'admin-owner-count');
  renderAdminRestaurants();
  renderAdminInbox();
}

// ============================================================
// RESTAURANT AGENDA (admin view, per restaurant tab)
// ============================================================

function renderRestaurantAgenda(restaurant) {
  const el = document.getElementById('agenda-restaurant-view');
  if (!el) return;

  const activeItems = state.agendaItems.filter(a => a.restaurant === restaurant && !a.converted && !a.cleared);
  const meta        = state.restaurantMeta[restaurant] || {};
  const nextDate    = meta.next_meeting_date || '';

  // Store agenda items in a lookup map so onclick handlers can retrieve by id only
  window._agendaItemMap = window._agendaItemMap || {};
  activeItems.forEach(a => { window._agendaItemMap[a.id] = a; });

  const itemsHtml = activeItems.length === 0
    ? `<div style="color:var(--warm-gray);font-family:'DM Mono',monospace;font-size:13px;padding:8px 0 16px">No agenda items yet.</div>`
    : activeItems.map(item => `
        <div class="inbox-item" id="agenda-item-${escHtml(item.id)}" style="align-items:center">
          <div class="inbox-item-body" style="flex:1">
            <div class="inbox-item-title">${escHtml(item.title)}</div>
            ${item.description ? `<div class="inbox-item-desc" style="margin-top:4px">${escHtml(item.description)}</div>` : ''}
          </div>
          <div class="inbox-item-actions" style="display:flex;gap:6px;flex-shrink:0">
            <button class="inbox-action-btn" style="background:var(--gold-light);color:var(--ink)" onclick="agendaConvertToTask('${escHtml(item.id)}')">Convert to Task</button>
            <button class="inbox-action-btn" style="background:transparent;color:var(--warm-gray);border:1px solid var(--border)" onclick="agendaRemoveItem('${escHtml(item.id)}')">Remove</button>
          </div>
        </div>`).join('');

  el.innerHTML = `
    <div style="max-width:820px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
        <div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:var(--ink)">Restaurant Agenda</div>
          <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--warm-gray);margin-top:2px">Items to discuss at the next check-in</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--warm-gray)">Next Check-in</label>
            <input type="date" id="agenda-meeting-date-${escHtml(restaurant)}" value="${escHtml(nextDate)}"
              style="padding:5px 10px;border:1px solid var(--border);border-radius:4px;font-family:'DM Mono',monospace;font-size:12px;background:var(--cream);color:var(--ink)"
              onchange="agendaUpdateMeetingDate('${escHtml(restaurant)}', this.value)">
          </div>
          ${activeItems.length > 0 ? `<button class="inbox-action-btn" style="background:var(--warm-gray);color:white" onclick="agendaClearAll('${escHtml(restaurant)}')">Clear Agenda</button>` : ''}
        </div>
      </div>

      ${itemsHtml}

      <div style="margin-top:16px;display:flex;gap:8px">
        <input type="text" id="agenda-add-input-${escHtml(restaurant)}" placeholder="Add agenda item…"
          style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:4px;font-family:'Instrument Sans',sans-serif;font-size:13px;background:var(--cream);color:var(--ink)"
          onkeydown="if(event.key==='Enter') agendaAddManual('${escHtml(restaurant)}')">
        <button class="inbox-action-btn" style="background:var(--ink);color:var(--cream)" onclick="agendaAddManual('${escHtml(restaurant)}')">+ Add Item</button>
      </div>
    </div>`;
}

async function agendaUpdateMeetingDate(restaurant, date) {
  try {
    await dbUpdateRestaurantMeetingDate(restaurant, date);
    if (!state.restaurantMeta[restaurant]) state.restaurantMeta[restaurant] = {};
    state.restaurantMeta[restaurant].next_meeting_date = date;
  } catch(e) { console.error('Meeting date update error', e); alert('Error saving meeting date.'); }
}

async function agendaAddManual(restaurant) {
  const input = document.getElementById(`agenda-add-input-${restaurant}`);
  const title = input ? input.value.trim() : '';
  if (!title) return;
  try {
    const item = await dbAddAgendaItem(restaurant, title, '', null);
    state.agendaItems.push({ id: item.id, restaurant, title, description: '', converted: false, cleared: false, sourceInboxId: null, createdAt: item.created_at });
    renderRestaurantAgenda(restaurant);
  } catch(e) { console.error('Agenda add error', e); alert('Error adding agenda item.'); }
}

async function agendaConvertToTask(id) {
  const item = (window._agendaItemMap || {})[id];
  if (!item) return;
  state._pendingAgendaItemId = id;
  openAddModal(null, { restaurant: item.restaurant, title: item.title, description: item.description || '' });
}

async function agendaRemoveItem(id) {
  try {
    await dbUpdateAgendaItemStatus(id, 'cleared');
    state.agendaItems = state.agendaItems.filter(a => a.id !== id);
    const tab = state.activeTab;
    renderRestaurantAgenda(tab);
  } catch(e) { console.error('Agenda remove error', e); alert('Error removing item.'); }
}

async function agendaClearAll(restaurant) {
  if (!confirm(`Clear all agenda items for ${restaurant}? This cannot be undone.`)) return;
  try {
    await dbClearAgendaForRestaurant(restaurant);
    state.agendaItems = state.agendaItems.map(a =>
      a.restaurant === restaurant && !a.converted && !a.cleared ? { ...a, cleared: true } : a
    );
    renderRestaurantAgenda(restaurant);
  } catch(e) { console.error('Clear agenda error', e); alert('Error clearing agenda.'); }
}

function renderAdminStats() {
  const open     = state.projects.filter(p => !p.complete);
  const complete = state.projects.filter(p => p.complete);
  const overdue  = open.filter(p => { const d = daysUntil(dueDate(p)); return d !== null && d < 0; });
  const high     = open.filter(p => p.priority === 'High');
  const el       = document.getElementById('admin-stats');
  el.innerHTML = `
    <div class="admin-stat-card">
      <div class="stat-label">Total Projects</div>
      <div class="stat-value">${state.projects.length}</div>
      <div class="stat-sub">${open.length} open · ${complete.length} complete</div>
    </div>
    <div class="admin-stat-card">
      <div class="stat-label">Restaurants</div>
      <div class="stat-value">${state.restaurants.length}</div>
      <div class="stat-sub">${state.categories.length} categories · ${state.types.length} types</div>
    </div>
    <div class="admin-stat-card">
      <div class="stat-label">Team Members</div>
      <div class="stat-value">${state.owners.length}</div>
      <div class="stat-sub">across all restaurants</div>
    </div>
    <div class="admin-stat-card">
      <div class="stat-label">Overdue</div>
      <div class="stat-value" style="color:var(--rust)">${overdue.length}</div>
      <div class="stat-sub">${high.length} high priority open</div>
    </div>
  `;
}

function renderAdminList(listKey, listId, countId) {
  const items   = state[listKey];
  const ul      = document.getElementById(listId);
  const countEl = document.getElementById(countId);
  if (countEl) countEl.textContent = items.length + ' items';
  ul.innerHTML = items.map((item, i) =>
    `<li class="admin-list-item" id="admin-item-${listKey}-${i}">
      <span class="item-label">${item}</span>
      <div class="admin-item-actions">
        <button class="admin-item-btn" onclick="startEditAdminItem('${listKey}',${i})">Edit</button>
        <button class="admin-item-btn del" onclick="deleteAdminItem('${listKey}',${i})">Delete</button>
      </div>
      <div class="admin-save-row" id="admin-save-row-${listKey}-${i}">
        <input type="text" class="admin-add-input" id="admin-edit-input-${listKey}-${i}" value="${item}" style="flex:1" onkeydown="if(event.key==='Enter')saveAdminItem('${listKey}',${i});if(event.key==='Escape')cancelEditAdminItem('${listKey}',${i})">
        <button class="admin-item-btn save" onclick="saveAdminItem('${listKey}',${i})">Save</button>
        <button class="admin-item-btn" onclick="cancelEditAdminItem('${listKey}',${i})">✕</button>
      </div>
    </li>`
  ).join('');
}

function startEditAdminItem(listKey, index) {
  document.querySelectorAll('.admin-list-item.editing').forEach(el => el.classList.remove('editing'));
  document.getElementById(`admin-item-${listKey}-${index}`).classList.add('editing');
  const input = document.getElementById(`admin-edit-input-${listKey}-${index}`);
  input.focus(); input.select();
}
function cancelEditAdminItem(listKey, index) {
  document.getElementById(`admin-item-${listKey}-${index}`).classList.remove('editing');
}

const lookupTableMap = { categories: 'categories', types: 'types', owners: 'owners' };

async function saveAdminItem(listKey, index) {
  const input  = document.getElementById(`admin-edit-input-${listKey}-${index}`);
  const newVal = input.value.trim();
  if (!newVal) return;
  const oldVal = state[listKey][index];
  try {
    await dbUpdateLookup(lookupTableMap[listKey] || listKey, oldVal, newVal);
    state[listKey][index] = newVal;
    if (listKey === 'categories') state.projects.forEach(p => { if (p.category === oldVal) p.category = newVal; });
    if (listKey === 'types')      state.projects.forEach(p => { if (p.type     === oldVal) p.type     = newVal; });
    if (listKey === 'owners')     state.projects.forEach(p => { if (p.owner    === oldVal) p.owner    = newVal; });
  } catch(e) {
    console.error('saveAdminItem error:', e);
    alert('Error saving changes. Please try again.');
    return;
  }
  const mapId = listKey === 'categories' ? 'cat' : listKey === 'types' ? 'type' : 'owner';
  renderAdminList(listKey, `admin-${mapId}-list`, `admin-${mapId}-count`);
  renderFilterDropdowns();
}

async function deleteAdminItem(listKey, index) {
  const val   = state[listKey][index];
  const inUse = listKey === 'categories'
    ? state.projects.some(p => p.category === val)
    : listKey === 'types'
    ? state.projects.some(p => p.type     === val)
    : state.projects.some(p => p.owner    === val);
  if (inUse && !confirm(`"${val}" is used by existing projects. Remove it anyway?`)) return;
  try {
    await dbDeleteLookup(lookupTableMap[listKey] || listKey, val);
    state[listKey].splice(index, 1);
  } catch(e) {
    console.error('deleteAdminItem error:', e);
    alert('Error deleting item. Please try again.');
    return;
  }
  const mapId = listKey === 'categories' ? 'cat' : listKey === 'types' ? 'type' : 'owner';
  renderAdminList(listKey, `admin-${mapId}-list`, `admin-${mapId}-count`);
  renderFilterDropdowns();
}

async function addAdminItem(listKey, inputId, listId, countId) {
  const input = document.getElementById(inputId);
  const val   = input.value.trim();
  if (!val) return;
  if (state[listKey].includes(val)) { input.focus(); return; }
  try {
    await dbAddLookup(lookupTableMap[listKey] || listKey, val);
    state[listKey].push(val);
    input.value = '';
  } catch(e) {
    console.error('addAdminItem error:', e);
    alert('Error adding item. Please try again.');
    return;
  }
  renderAdminList(listKey, listId, countId);
  renderFilterDropdowns();
}

function renderAdminRestaurants() {
  const colors = ['var(--r0)','var(--r1)','var(--r2)','var(--r3)','var(--r4)','var(--r5)','var(--r6)','var(--r7)'];
  const el = document.getElementById('admin-restaurant-list');
  el.innerHTML = state.restaurants.map((r, i) => {
    const count = state.projects.filter(p => p.restaurant === r).length;
    return `<div class="admin-restaurant-row">
      <div class="admin-restaurant-color" style="background:${colors[i % 8]}"></div>
      <span class="admin-restaurant-name">${r}</span>
      <span class="admin-restaurant-count">${count} project${count !== 1 ? 's' : ''}</span>
      <div class="admin-restaurant-actions">
        <button class="admin-item-btn del" onclick="removeAdminRestaurant('${r}')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

async function addAdminRestaurant() {
  const input = document.getElementById('new-restaurant-admin');
  const name  = input.value.trim();
  if (!name || state.restaurants.includes(name)) return;
  try {
    await dbAddLookup('restaurants', name);
    state.restaurants.push(name);
    input.value = '';
  } catch(e) {
    console.error('addAdminRestaurant error:', e);
    alert('Error adding restaurant. Please try again.');
    return;
  }
  renderAdminRestaurants();
  renderTabs();
}

async function removeAdminRestaurant(name) {
  const count = state.projects.filter(p => p.restaurant === name).length;
  if (count > 0) { alert(`Cannot remove "${name}" — it has ${count} existing project${count !== 1 ? 's' : ''}.`); return; }
  if (!confirm(`Remove "${name}" from the portfolio?`)) return;
  try {
    await dbDeleteLookup('restaurants', name);
    state.restaurants = state.restaurants.filter(r => r !== name);
  } catch(e) {
    console.error('removeAdminRestaurant error:', e);
    alert('Error removing restaurant. Please try again.');
    return;
  }
  renderAdminRestaurants();
  renderTabs();
}

async function clearCompleted() {
  const count = state.projects.filter(p => p.complete).length;
  if (count === 0) { alert('No completed projects to clear.'); return; }
  if (!confirm(`Permanently delete ${count} completed project${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
  // Delete one by one (cascade deletes notes via FK)
  const completed = state.projects.filter(p => p.complete);
  try {
    for (const p of completed) await dbDeleteProject(p.id);
    state.projects = state.projects.filter(p => !p.complete);
  } catch(e) {
    console.error('clearCompleted error:', e);
    alert('Error deleting completed tasks. Some may not have been removed — please refresh and try again.');
    await loadAll();
    render();
    return;
  }
  renderAdminStats();
  renderSummary();
  renderTabs();
}

function exportData() {
  const data = JSON.stringify({
    restaurants: state.restaurants,
    categories:  state.categories,
    types:       state.types,
    owners:      state.owners,
    projects:    state.projects,
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sc-culinary-projects-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportRestaurantTasks() {
  const ownRest = state.session && state.session.role === 'restaurant' ? state.session.restaurant : null;
  const tab = state.activeTab;
  const isSpecific = tab !== 'all' && tab !== '__gantt__' && tab !== '__recent__' && tab !== '__analytics__' && tab !== '__admin__' && tab !== '__admin_inbox__' && tab !== '__travel__' && tab !== '__inbox__';
  const restaurant = isSpecific ? tab : ownRest;

  let projects = state.projects.filter(p => !p.archived && !p.complete);
  if (restaurant) {
    projects = projects.filter(p => p.restaurant === restaurant);
  }

  projects = projects.sort((a, b) => {
    const da = dueDate(a) || '9999-12-31';
    const db = dueDate(b) || '9999-12-31';
    return da.localeCompare(db);
  });

  const csvEscape = v => {
    const s = String(v == null ? '' : v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const headers = ['Restaurant', 'Project', 'Category', 'Type', 'Owner', 'Priority', 'Due Date', 'Status', 'Latest Note'];
  const rows = [headers.join(',')];

  projects.forEach(p => {
    const due = dueDate(p);
    const days = daysUntil(due);
    let status = '';
    if (days !== null && days < 0) status = 'Overdue';
    else if (days !== null && days <= 7) status = 'Due Soon';
    else if (days !== null) status = 'On Track';
    else status = 'No Due Date';

    const latestNote = p.notes && p.notes.length > 0 ? p.notes[p.notes.length - 1].text : '';

    rows.push([
      csvEscape(p.restaurant),
      csvEscape(p.title),
      csvEscape(p.category),
      csvEscape(p.type),
      csvEscape(p.owner),
      csvEscape(p.priority),
      csvEscape(due ? formatDate(due) : ''),
      csvEscape(status),
      csvEscape(latestNote)
    ].join(','));
  });

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const label = restaurant ? restaurant.replace(/\s+/g, '-').toLowerCase() : 'all-restaurants';
  a.download = `open-tasks-${label}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${projects.length} open task${projects.length !== 1 ? 's' : ''}`, 'success');
}

function exportOpeningCSV() {
  const opening = state.openings.find(o => o.id === state.activeOpeningId);
  if (!opening) return;

  const tasks = getOpeningTasks(opening.id);
  const csvEscape = v => {
    const s = String(v == null ? '' : v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const headers = ['Task', 'Category', 'Type', 'Owner', 'Priority', 'Due Date', 'Status', 'Complete', 'Latest Note'];
  const rows = [headers.join(',')];

  tasks.sort((a, b) => (dueDate(a) || '9999-12-31').localeCompare(dueDate(b) || '9999-12-31')).forEach(t => {
    const due = dueDate(t);
    const days = daysUntil(due);
    let status = '';
    if (t.complete) status = 'Complete';
    else if (days !== null && days < 0) status = 'Overdue';
    else if (days !== null && days <= 14) status = 'Due Soon';
    else if (days !== null) status = 'On Track';
    else status = 'No Due Date';

    const latestNote = t.notes && t.notes.length > 0 ? t.notes[t.notes.length - 1].text : '';

    rows.push([
      csvEscape(t.title),
      csvEscape(t.category),
      csvEscape(t.type),
      csvEscape(t.owner),
      csvEscape(t.priority),
      csvEscape(due ? formatDate(due) : ''),
      csvEscape(status),
      csvEscape(t.complete ? 'Yes' : 'No'),
      csvEscape(latestNote)
    ].join(','));
  });

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const label = opening.name.replace(/\s+/g, '-').toLowerCase();
  a.download = `opening-tasks-${label}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${tasks.length} task${tasks.length !== 1 ? 's' : ''} for ${opening.name}`, 'success');
}

function exportOpeningReport() {
  const opening = state.openings.find(o => o.id === state.activeOpeningId);
  if (!opening) return;
  document.getElementById('report-notes-input').value = '';
  document.getElementById('report-notes-modal-overlay').classList.add('open');
}

function closeReportNotesModal() {
  document.getElementById('report-notes-modal-overlay').classList.remove('open');
}

function generateOpeningReportPDF() {
  const opening = state.openings.find(o => o.id === state.activeOpeningId);
  if (!opening) return;

  const userNotes = document.getElementById('report-notes-input').value.trim();
  closeReportNotesModal();

  const tasks = getOpeningTasks(opening.id);
  const total = tasks.length;
  const doneCount = tasks.filter(t => t.complete).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const overdue = tasks.filter(t => {
    if (t.complete) return false;
    const d = daysUntil(dueDate(t));
    return d !== null && d < 0;
  });
  const high = tasks.filter(t => !t.complete && t.priority === 'High');

  const targetStr = new Date(opening.targetDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const daysLeft = daysUntil(opening.targetDate);
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // 7-day cutoff
  const now = new Date(today() + 'T00:00:00');
  const cutoff7 = new Date(now);
  cutoff7.setDate(cutoff7.getDate() - 7);

  // Tasks completed in last 7 days
  const recentlyCompleted = tasks.filter(t => {
    if (!t.complete) return false;
    const u = t.updatedAt ? new Date(t.updatedAt) : null;
    return u && u >= cutoff7;
  }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // Updates (notes) added in last 7 days
  const recentUpdates = [];
  tasks.forEach(t => {
    const taskNotes = (t.notes || []).filter(n => n.date && new Date(n.date + 'T00:00:00') >= cutoff7);
    if (taskNotes.length > 0) {
      recentUpdates.push({ task: t, notes: taskNotes.sort((a, b) => b.date.localeCompare(a.date)) });
    }
  });
  recentUpdates.sort((a, b) => b.notes[0].date.localeCompare(a.notes[0].date));

  // Logo
  var lthLogoSrc = '';
  var scLogoEl = document.querySelector('.header-logos img');
  if (scLogoEl) lthLogoSrc = scLogoEl.src;

  // Build HTML
  let html = '';

  // Header
  html += '<div class="pr-header">';
  html += '<div class="pr-header-left">';
  html += '<div>';
  html += '<h1>' + escHtml(opening.name) + '</h1>';
  html += '<p>' + escHtml(opening.restaurant) + ' &mdash; Target: ' + escHtml(targetStr);
  if (daysLeft !== null) html += ' (' + daysLeft + ' days remaining)';
  html += '</p>';
  html += '<p style="font-size:8pt;color:#a09585;margin:2pt 0 0">Generated ' + dateLabel + '</p>';
  html += '</div>';
  html += '</div>';
  if (lthLogoSrc) {
    html += '<div class="pr-header-logos"><img src="' + lthLogoSrc + '"></div>';
  }
  html += '</div>';

  // User notes
  if (userNotes) {
    html += '<div class="pr-notes-label">Executive Summary</div>';
    html += '<div class="pr-notes-block">' + escHtml(userNotes) + '</div>';
  }

  // Summary bar
  html += '<div class="pr-summary-bar">';
  html += '<div class="pr-summary-stat"><span class="pr-stat-value">' + total + '</span><span class="pr-stat-label">Total Tasks</span></div>';
  html += '<div class="pr-summary-stat pr-stat-green"><span class="pr-stat-value">' + doneCount + '/' + total + '</span><span class="pr-stat-label">Completed (' + pct + '%)</span>';
  html += '<div class="pr-progress-bar-track"><div class="pr-progress-bar-fill" style="width:' + pct + '%"></div></div>';
  html += '</div>';
  html += '<div class="pr-summary-stat pr-stat-rust"><span class="pr-stat-value">' + overdue.length + '</span><span class="pr-stat-label">Overdue</span></div>';
  html += '<div class="pr-summary-stat"><span class="pr-stat-value">' + high.length + '</span><span class="pr-stat-label">High Priority Open</span></div>';
  html += '</div>';

  // Tasks completed in last 7 days
  html += '<div class="pr-section-title">Tasks Completed (Last 7 Days)</div>';
  if (recentlyCompleted.length === 0) {
    html += '<p class="pr-no-activity">No tasks completed in the last 7 days.</p>';
  } else {
    html += '<div class="pr-subsection">';
    html += '<table class="pr-table"><thead><tr><th>Task</th><th>Category</th><th>Owner</th><th>Completed</th></tr></thead><tbody>';
    recentlyCompleted.forEach(t => {
      const cd = t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014';
      html += '<tr>';
      html += '<td>' + escHtml(t.title) + '</td>';
      html += '<td>' + escHtml(t.category || '\u2014') + '</td>';
      html += '<td>' + escHtml(t.owner || '\u2014') + '</td>';
      html += '<td class="pr-complete">' + cd + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // Updates in last 7 days
  html += '<div class="pr-section-title">Updates (Last 7 Days)</div>';
  if (recentUpdates.length === 0) {
    html += '<p class="pr-no-activity">No updates added in the last 7 days.</p>';
  } else {
    recentUpdates.forEach(({ task, notes }) => {
      html += '<div class="pr-update-group">';
      html += '<div class="pr-update-task-name">' + escHtml(task.title) + '</div>';
      notes.forEach(n => {
        const nd = new Date(n.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        html += '<div class="pr-update-note"><span class="pr-update-note-date">' + nd + '</span> &mdash; ' + escHtml(n.text) + '</div>';
      });
      html += '</div>';
    });
  }

  // Overdue tasks
  if (overdue.length > 0) {
    html += '<div class="pr-section-title">Overdue Tasks</div>';
    html += '<div class="pr-subsection">';
    html += '<table class="pr-table"><thead><tr><th>Task</th><th>Days Overdue</th><th>Owner</th><th>Priority</th></tr></thead><tbody>';
    overdue.sort((a, b) => (dueDate(a) || '').localeCompare(dueDate(b) || '')).forEach(t => {
      const due = dueDate(t);
      const days = Math.abs(daysUntil(due));
      const priClass = t.priority === 'High' ? 'pr-pri-high' : t.priority === 'Medium' ? 'pr-pri-medium' : 'pr-pri-low';
      html += '<tr>';
      html += '<td>' + escHtml(t.title) + '</td>';
      html += '<td class="pr-overdue">' + days + ' day' + (days !== 1 ? 's' : '') + '</td>';
      html += '<td>' + escHtml(t.owner || '\u2014') + '</td>';
      html += '<td><span class="' + priClass + '">' + escHtml(t.priority || 'Low') + '</span></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // Footer
  html += '<div class="pr-footer"><span>Opening Report &mdash; ' + escHtml(opening.name) + '</span><span>' + dateLabel + '</span></div>';

  // Render and print
  const printView = document.getElementById('print-view');
  printView.innerHTML = html;
  window.print();
  setTimeout(() => { printView.innerHTML = ''; }, 1000);
}

async function importData(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  try {
    const text = await file.text();
    let imported;
    try { imported = JSON.parse(text); }
    catch { showToast('Invalid JSON file', 'error'); return; }

    const required = ['restaurants','categories','types','owners','projects'];
    const missing = required.filter(k => !Array.isArray(imported[k]));
    if (missing.length) {
      showToast('Missing required fields: ' + missing.join(', '), 'error');
      return;
    }

    const msg = `Import ${imported.projects.length} projects, ${imported.restaurants.length} restaurants, `
      + `${imported.categories.length} categories, ${imported.types.length} types, ${imported.owners.length} owners?\n\n`
      + `Existing records with matching IDs will be overwritten.`;
    if (!confirm(msg)) return;

    // Upsert lookup tables
    for (const table of ['restaurants','categories','types','owners']) {
      const rows = imported[table].map((name, i) => ({ name, sort_order: i, workspace_id: state.workspace_id }));
      if (rows.length) {
        const { error } = await db.from(table).upsert(rows, { onConflict: 'name' });
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    }

    // Upsert projects
    for (const p of imported.projects) {
      await dbUpsertProject(p);

      // Upsert nested notes
      if (Array.isArray(p.notes)) {
        for (const n of p.notes) {
          const { error } = await db.from('notes').upsert({
            id:         n.id,
            project_id: p.id,
            note_date:  n.date,
            text:       n.text,
            author:     n.author || null,
          });
          if (error) throw new Error(`note ${n.id}: ${error.message}`);
        }
      }

      // Upsert nested subtasks
      if (Array.isArray(p.subtasks)) {
        for (const st of p.subtasks) {
          await dbUpsertSubtask(p.id, st);
        }
      }
    }

    await loadAll();
    render();
    renderAdminView();
    showToast(`Imported ${imported.projects.length} projects successfully`);
  } catch (err) {
    console.error('Import failed:', err);
    showToast('Import failed: ' + err.message, 'error');
  }
}

