// ============================================================
// INBOX (restaurant role)
// ============================================================

async function dbSubmitInboxRequest(restaurantName, title, description, category) {
  const { data, error } = await db
    .from('inbox_requests')
    .insert([{ restaurant_name: restaurantName, title, description, category, status: 'submitted', workspace_id: state.workspace_id }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbDeleteInboxRequest(id) {
  const { error } = await db.from('inbox_requests').delete().eq('id', id);
  if (error) throw error;
}

async function dbUpdateInboxStatus(id, status) {
  const { error } = await db
    .from('inbox_requests')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// AGENDA
// ============================================================

async function dbAddAgendaItem(restaurant, title, description, sourceInboxId) {
  const row = { restaurant_name: restaurant, title, description: description || '', workspace_id: state.workspace_id };
  if (sourceInboxId) row.inbox_request_id = sourceInboxId;
  const { data, error } = await db.from('agenda_items').insert([row]).select().single();
  if (error) throw error;
  return data;
}

async function dbUpdateAgendaItemStatus(id, status) {
  const update = status === 'converted' ? { converted_to_task: true } : { cleared: true };
  const { error } = await db.from('agenda_items').update(update).eq('id', id);
  if (error) throw error;
}

async function dbClearAgendaForRestaurant(restaurant) {
  const { error } = await db.from('agenda_items')
    .update({ cleared: true })
    .eq('restaurant_name', restaurant)
    .eq('cleared', false)
    .eq('converted_to_task', false);
  if (error) throw error;
}

async function dbUpdateRestaurantMeetingDate(restaurant, date) {
  const { error } = await db.from('restaurants')
    .update({ next_meeting_date: date || null }).eq('name', restaurant);
  if (error) throw error;
}

function renderRestaurantInbox() {
  const container = document.getElementById('inbox-view-content');
  if (!container) return;
  const restaurantName = state.session && state.session.restaurant;
  if (!restaurantName) return;

  const myRequests = (state.inboxRequests || []).filter(r => r.restaurant_name === restaurantName);

  const categories = state.categories.length ? state.categories : [];

  const categoryOptions = categories.map(c =>
    `<option value="${escHtml(c)}">${escHtml(c)}</option>`
  ).join('');

  const requestsHtml = myRequests.length === 0
    ? `<div class="inbox-empty">No requests yet. Use the form above to submit one.</div>`
    : myRequests.map(req => {
        const statusLabel = { submitted: 'Submitted', added: 'Added to Task List', agenda: 'On Agenda', archived: 'Archived' }[req.status] || req.status;
        const dateStr = req.created_at ? new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const catPill = req.category ? `<span class="inbox-category-pill">${escHtml(req.category)}</span>` : '';
        return `<div class="inbox-item">
          <div class="inbox-item-body">
            <div class="inbox-item-title">${escHtml(req.title)}</div>
            <div class="inbox-item-meta">${dateStr}${catPill ? ' · ' + catPill : ''}</div>
            ${req.description ? `<div class="inbox-item-desc">${escHtml(req.description)}</div>` : ''}
          </div>
          <div class="inbox-item-actions">
            <span class="inbox-status ${escHtml(req.status)}">${escHtml(statusLabel)}</span>
            ${req.status === 'submitted' ? `<button class="inbox-action-btn danger" onclick="inboxDeleteRequest('${escHtml(req.id)}')">Delete</button>` : ''}
          </div>
        </div>`;
      }).join('');

  container.innerHTML = `
    <div class="inbox-section">
      <div class="inbox-section-title">Submit a Request</div>
      <div class="inbox-form-card">
        <div style="margin-bottom:14px">
          <label style="display:block;font-family:'DM Sans',sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-secondary);margin-bottom:6px">Request Title *</label>
          <input id="inbox-title" type="text" placeholder="e.g. New appetizer menu for spring" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border);border-radius:0;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text-primary);background:var(--card-bg);outline:none">
        </div>
        <div style="margin-bottom:14px">
          <label style="display:block;font-family:'DM Sans',sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-secondary);margin-bottom:6px">Category</label>
          <select id="inbox-category" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border);border-radius:0;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text-primary);background:var(--card-bg);outline:none">
            <option value="">— Select category —</option>
            ${categoryOptions}
          </select>
        </div>
        <div style="margin-bottom:18px">
          <label style="display:block;font-family:'DM Sans',sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-secondary);margin-bottom:6px">Description</label>
          <textarea id="inbox-desc" rows="3" placeholder="Add any context or details…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border);border-radius:0;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text-primary);background:var(--card-bg);outline:none;resize:vertical"></textarea>
        </div>
        <button class="inbox-submit-btn" onclick="inboxSubmitRequest()">Submit Request</button>
      </div>
    </div>
    <div class="inbox-section">
      <div class="inbox-section-title">My Requests</div>
      ${requestsHtml}
    </div>`;
}

async function inboxSubmitRequest() {
  const titleEl    = document.getElementById('inbox-title');
  const categoryEl = document.getElementById('inbox-category');
  const descEl     = document.getElementById('inbox-desc');
  const title      = titleEl ? titleEl.value.trim() : '';
  if (!title) { alert('Please enter a request title.'); return; }
  const restaurantName = state.session && state.session.restaurant;
  if (!restaurantName) return;
  try {
    const btn = document.querySelector('.inbox-submit-btn');
    if (btn) btn.disabled = true;
    const newReq = await dbSubmitInboxRequest(restaurantName, title, descEl ? descEl.value.trim() : '', categoryEl ? categoryEl.value : '');
    // Prepend to state so it shows at top (requests ordered desc by created_at)
    state.inboxRequests = [newReq, ...(state.inboxRequests || [])];
    renderRestaurantInbox();
  } catch (e) {
    console.error('inbox submit error', e);
    alert('Error submitting request. Please try again.');
    const btn = document.querySelector('.inbox-submit-btn');
    if (btn) btn.disabled = false;
  }
}

async function inboxDeleteRequest(id) {
  if (!confirm('Delete this request?')) return;
  try {
    await dbDeleteInboxRequest(id);
    state.inboxRequests = (state.inboxRequests || []).filter(r => r.id !== id);
    renderRestaurantInbox();
  } catch (e) {
    console.error('inbox delete error', e);
    alert('Error deleting request.');
  }
}

function renderAdminInbox(targetId = 'admin-inbox-section') {
  const section = document.getElementById(targetId);
  if (!section) return;

  const requests = state.inboxRequests || [];

  const activeReqs   = requests.filter(r => r.status === 'submitted');
  const resolvedReqs = requests.filter(r => r.status !== 'submitted');

  const resolvedStatusLabel = { added: 'Added to Task List', agenda: 'On Agenda', archived: 'Archived' };

  // Store request data keyed by id so onclick handlers can look up by id only
  window._adminInboxMap = {};
  requests.forEach(r => { window._adminInboxMap[r.id] = r; });

  function buildInboxItem(req, isResolved) {
    const dateStr = req.created_at ? new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const catPill = req.category ? `<span class="inbox-category-pill">${escHtml(req.category)}</span>` : '';
    const actions = isResolved
      ? `<span class="inbox-status ${escHtml(req.status)}" style="font-family:'DM Sans',sans-serif;font-size:11px;opacity:.65">${escHtml(resolvedStatusLabel[req.status] || req.status)}</span>`
      : `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
           <button class="inbox-action-btn" style="background:var(--primary);color:#fff" onclick="adminInboxAddToAgenda('${escHtml(req.id)}')">Add to Agenda</button>
           <button class="inbox-action-btn" style="background:var(--surface-hover);color:var(--text-primary);border:1px solid var(--border)" onclick="adminInboxAddToTasks('${escHtml(req.id)}')">Add to Tasks</button>
           <button class="inbox-action-btn" style="background:transparent;color:var(--text-secondary);border:1px solid var(--border)" onclick="adminInboxArchive('${escHtml(req.id)}')">Archive</button>
         </div>`;
    return `<div class="inbox-item" id="admin-inbox-item-${escHtml(req.id)}" ${isResolved ? 'style="opacity:.55"' : ''}>
      <div class="inbox-item-body">
        <div class="inbox-item-title">${escHtml(req.title)}</div>
        <div class="inbox-item-meta">${dateStr}${catPill ? ' · ' + catPill : ''}</div>
        ${req.description ? `<div class="inbox-item-desc">${escHtml(req.description)}</div>` : ''}
      </div>
      <div class="inbox-item-actions" style="min-width:200px;text-align:right">${actions}</div>
    </div>`;
  }

  function buildRestaurantGroup(reqs, isResolved) {
    const grouped = {};
    reqs.forEach(req => {
      const r = req.restaurant_name || 'Unknown';
      if (!grouped[r]) grouped[r] = [];
      grouped[r].push(req);
    });
    return Object.keys(grouped).sort().map(rest =>
      `<div style="margin-bottom:24px">
        <div style="font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-secondary);margin-bottom:8px">${escHtml(rest)}</div>
        ${grouped[rest].map(r => buildInboxItem(r, isResolved)).join('')}
      </div>`
    ).join('');
  }

  const activeHtml   = activeReqs.length   ? buildRestaurantGroup(activeReqs, false)   : '<div style="color:var(--text-secondary);font-family:\'DM Sans\',sans-serif;font-size:13px;padding:12px 0">No pending requests.</div>';
  const resolvedHtml = resolvedReqs.length ? buildRestaurantGroup(resolvedReqs, true)  : '';

  const resolvedSection = resolvedReqs.length ? `
    <details style="margin-top:32px">
      <summary style="font-family:'DM Sans',sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-secondary);cursor:pointer;margin-bottom:12px">
        Resolved (${resolvedReqs.length})
      </summary>
      <div style="margin-top:14px">${resolvedHtml}</div>
    </details>` : '';

  section.innerHTML = `<div style="max-width:820px">${activeHtml}${resolvedSection}</div>`;
}

function _updateInboxRequestInState(id, updates) {
  state.inboxRequests = (state.inboxRequests || []).map(r => r.id === id ? { ...r, ...updates } : r);
  state.adminInboxUnread = state.inboxRequests.filter(r => r.status === 'submitted').length;
  renderTabs();
}

async function adminInboxAddToAgenda(id) {
  const req = (window._adminInboxMap || {})[id];
  if (!req) return;
  const { restaurant_name: restaurant, title, description } = req;
  try {
    const item = await dbAddAgendaItem(restaurant, title, description || '', id);
    state.agendaItems.push({ id: item.id, restaurant, title, description: description || '', converted: false, cleared: false, sourceInboxId: id, createdAt: item.created_at });
    await dbUpdateInboxStatus(id, 'agenda');
    _updateInboxRequestInState(id, { status: 'agenda' });
    const targetId = state.activeTab === '__admin_inbox__' ? 'admin-inbox-tab-section' : 'admin-inbox-section';
    renderAdminInbox(targetId);
  } catch(e) { console.error('Add to agenda error', e); alert('Error adding to agenda.'); }
}

async function adminInboxAddToTasks(id) {
  const req = (window._adminInboxMap || {})[id];
  if (!req) return;
  openAddModal(null, { inboxItemId: id, restaurant: req.restaurant_name, title: req.title, description: req.description || '' });
}

async function adminInboxArchive(id) {
  try {
    await dbUpdateInboxStatus(id, 'archived');
    _updateInboxRequestInState(id, { status: 'archived' });
    const targetId = state.activeTab === '__admin_inbox__' ? 'admin-inbox-tab-section' : 'admin-inbox-section';
    renderAdminInbox(targetId);
  } catch(e) { console.error('Archive error', e); alert('Error archiving request.'); }
}

async function adminInboxUpdateStatus(id, status) {
  try {
    await dbUpdateInboxStatus(id, status);
    _updateInboxRequestInState(id, { status });
    const targetId = state.activeTab === '__admin_inbox__' ? 'admin-inbox-tab-section' : 'admin-inbox-section';
    renderAdminInbox(targetId);
  } catch (e) {
    console.error('inbox status update error', e);
    alert('Error updating status.');
    const targetId = state.activeTab === '__admin_inbox__' ? 'admin-inbox-tab-section' : 'admin-inbox-section';
    renderAdminInbox(targetId);
  }
}

