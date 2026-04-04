// OPENINGS VIEW
// ============================================================
const PHASE_COLORS = ['#8B3A1E', '#3A5C6B', '#5C4A2E', '#3B5241'];
const PHASE_LABELS = ['Phase 0 — Construction & Design', 'Phase 1 — Pre-Opening Planning', 'Phase 2 — Build-Out & Execution', 'Phase 3 — Opening Sequence'];
const PHASE_SHORT = ['Phase 0', 'Phase 1', 'Phase 2', 'Phase 3'];
const PHASE_DESCRIPTIONS = [
  'Site, lease, permits, contractor, equipment walk and installations. The physical space getting ready to operate. For Ponte specifically this is compressed — it\u2019s an existing buildout, so it\u2019s mostly equipment changes and the CO/permit amendment rather than a full build.',
  'LTH\u2019s analytical and strategic work. Market study, competitive set, pro forma, concept finalization, pre-opening budgets, staffing cost estimates, and locking the critical path. This is the planning phase before execution starts.',
  'The bulk of the work — everything that gets built, hired, designed, written, and ordered. Menu development, beverage program, brand and PR, staffing and HR, training materials, operational systems, POS, licenses and permits, collateral, OS&E. This is where LTH\u2019s scope is heaviest.',
  'The final push. Staff training, mock service, Friends and Family, procedural setup, opening and closing checklists, sidework, and the grand opening itself. Everything from about 6 weeks out through opening day.'
];

function getOpeningTasks(openingId) {
  return state.projects.filter(p => p.openingId === openingId && !p.archived);
}

function renderOpeningsView() {
  const el = document.getElementById('openings-content');
  if (!el) return;

  if (state.activeOpeningId) {
    renderOpeningDetail(el);
  } else {
    renderOpeningSelector(el);
  }
}

function renderOpeningSelector(el) {
  let html = '<div class="page-title">Openings</div><div class="opening-cards">';

  state.openings.forEach(o => {
    const tasks = getOpeningTasks(o.id);
    const total = tasks.length;
    const done = tasks.filter(t => t.complete).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const overdue = tasks.filter(t => {
      if (t.complete) return false;
      const d = daysUntil(dueDate(t));
      return d !== null && d < 0;
    }).length;
    const targetStr = new Date(o.targetDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const daysLeft = daysUntil(o.targetDate);

    html += `
      <div class="opening-card" onclick="openOpeningDetail('${o.id}')">
        <div class="opening-card-restaurant">${o.restaurant}</div>
        <div class="opening-card-name">${o.name}</div>
        <div class="opening-card-date">Target: ${targetStr}${daysLeft !== null ? ' &middot; ' + daysLeft + ' days' : ''}</div>
        <div class="opening-card-progress-bar"><div class="opening-card-progress-fill" style="width:${pct}%"></div></div>
        <div class="opening-card-stats">
          <span>${done}/${total} complete (${pct}%)</span>
          ${overdue > 0 ? '<span class="stat-red">' + overdue + ' overdue</span>' : ''}
        </div>
      </div>`;
  });

  html += '</div>';
  el.innerHTML = html;
}

function openOpeningDetail(id) {
  state.activeOpeningId = id;
  renderOpeningsView();
}

function closeOpeningDetail() {
  state.activeOpeningId = null;
  state.openingTab = 'thisweek';
  state._openingSearch = '';
  state._openingSections = {};
  renderOpeningsView();
}

function switchOpeningTab(tab) {
  state.openingTab = tab;
  state._openingSections = {};
  renderOpeningsView();
}

function clearOpeningSearch() {
  state._openingSearch = '';
  renderOpeningsView();
}

function onOpeningSearch(val) {
  state._openingSearch = val;
  // Re-render only the tab content, not the whole view, to keep focus
  const opening = state.openings.find(o => o.id === state.activeOpeningId);
  if (!opening) return;
  const tasks = getOpeningTasks(opening.id);
  const searchQuery = (val || '').toLowerCase().trim();
  const filteredTasks = searchQuery
    ? tasks.filter(t => {
        return (t.title || '').toLowerCase().includes(searchQuery)
          || (t.phaseCategory || '').toLowerCase().includes(searchQuery)
          || (t.owner || '').toLowerCase().includes(searchQuery)
          || (t.description || '').toLowerCase().includes(searchQuery);
      })
    : tasks;
  const contentEl = document.getElementById('opening-tab-content');
  if (!contentEl) return;
  const tabActive = state.openingTab || 'thisweek';
  if (searchQuery && filteredTasks.length === 0) {
    contentEl.innerHTML = '<div class="opening-empty"><strong>No matches</strong>No tasks match "' + escHtml(val) + '"</div>';
  } else if (tabActive === 'thisweek') {
    renderOpeningThisWeek(contentEl, filteredTasks);
  } else if (tabActive === 'phases') {
    renderOpeningPhases(contentEl, filteredTasks);
  } else if (tabActive === 'byowner') {
    renderOpeningByOwner(contentEl, filteredTasks);
  } else if (tabActive === 'gantt') {
    renderOpeningGantt(contentEl, filteredTasks, opening);
  } else if (tabActive === 'notes') {
    renderOpeningNotes(contentEl, opening);
  }
  // Update clear button visibility
  const clearBtn = document.querySelector('.opening-search-clear');
  if (clearBtn) clearBtn.style.display = searchQuery ? '' : 'none';
}

function renderOpeningDetail(el) {
  const opening = state.openings.find(o => o.id === state.activeOpeningId);
  if (!opening) { closeOpeningDetail(); return; }

  const tasks = getOpeningTasks(opening.id);
  const total = tasks.length;
  const done = tasks.filter(t => t.complete).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const overdue = tasks.filter(t => !t.complete && daysUntil(dueDate(t)) !== null && daysUntil(dueDate(t)) < 0).length;
  const dueSoon = tasks.filter(t => !t.complete && daysUntil(dueDate(t)) !== null && daysUntil(dueDate(t)) >= 0 && daysUntil(dueDate(t)) <= 14).length;
  const high = tasks.filter(t => !t.complete && t.priority === 'High').length;
  const targetStr = new Date(opening.targetDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const daysLeft = daysUntil(opening.targetDate);

  const tabActive = state.openingTab || 'thisweek';

  let html = `
    <button class="opening-back" onclick="closeOpeningDetail()">&larr; All Openings</button>
    <div class="opening-header">
      <div class="opening-header-top">
        <div>
          <div class="opening-title">${opening.name}</div>
          <div class="opening-meta">
            <span class="opening-meta-item">Opening: <strong class="opening-date-edit" onclick="promptChangeOpeningDate('${opening.id}','${opening.targetDate}')" title="Click to change opening date">${targetStr}</strong> <span style="font-size:11px;cursor:pointer;color:var(--warm-gray)" onclick="promptChangeOpeningDate('${opening.id}','${opening.targetDate}')">&#9998;</span></span>
            ${daysLeft !== null ? '<span class="opening-meta-item"><strong>' + daysLeft + ' days</strong> remaining</span>' : ''}
            <span class="opening-meta-item"><strong>${total}</strong> tasks</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-ghost" onclick="exportOpeningCSV()" title="Export full task list to CSV" style="font-size:12px;color:var(--warm-gray);border-color:var(--border)">&#128229; Export CSV</button>
          <button class="btn-ghost" onclick="exportOpeningReport()" title="Export executive summary report" style="font-size:12px;color:var(--warm-gray);border-color:var(--border)">&#128438; Report</button>
          <button class="btn-primary" onclick="openOpeningTaskModal()">+ Add Task</button>
        </div>
      </div>
    </div>

    <div class="opening-summary">
      <div class="summary-stat"><span class="label">Complete</span><span class="value green">${done}/${total}</span></div>
      <div class="divider"></div>
      <div class="summary-stat"><span class="label">Overdue</span><span class="value red">${overdue}</span></div>
      <div class="summary-stat"><span class="label">Due ≤ 14 days</span><span class="value orange">${dueSoon}</span></div>
      <div class="divider"></div>
      <div class="summary-stat"><span class="label">High Priority</span><span class="value">${high}</span></div>
      <div class="divider"></div>
      <div class="summary-stat"><span class="label">Progress</span><span class="value green">${pct}%</span></div>
    </div>

    <div class="opening-tabs-row">
      <div class="opening-tabs">
        <button class="opening-tab ${tabActive === 'thisweek' ? 'active' : ''}" onclick="switchOpeningTab('thisweek')">Upcoming</button>
        <button class="opening-tab ${tabActive === 'phases' ? 'active' : ''}" onclick="switchOpeningTab('phases')">Phases</button>
        <button class="opening-tab ${tabActive === 'byowner' ? 'active' : ''}" onclick="switchOpeningTab('byowner')">By Owner</button>
        <button class="opening-tab ${tabActive === 'gantt' ? 'active' : ''}" onclick="switchOpeningTab('gantt')">Gantt</button>
        <button class="opening-tab ${tabActive === 'notes' ? 'active' : ''}" onclick="switchOpeningTab('notes')">Notes</button>
      </div>
      <div class="opening-search-wrap">
        <input type="text" class="opening-search" id="opening-search" placeholder="Search tasks..." value="${state._openingSearch || ''}" oninput="onOpeningSearch(this.value)">
        ${state._openingSearch ? '<button class="opening-search-clear" onclick="clearOpeningSearch()">&#10005;</button>' : ''}
      </div>
    </div>

    <div id="opening-tab-content"></div>
  `;

  el.innerHTML = html;

  const searchQuery = (state._openingSearch || '').toLowerCase().trim();
  const filteredTasks = searchQuery
    ? tasks.filter(t => {
        return (t.title || '').toLowerCase().includes(searchQuery)
          || (t.phaseCategory || '').toLowerCase().includes(searchQuery)
          || (t.owner || '').toLowerCase().includes(searchQuery)
          || (t.description || '').toLowerCase().includes(searchQuery);
      })
    : tasks;

  const contentEl = document.getElementById('opening-tab-content');
  if (searchQuery && filteredTasks.length === 0) {
    contentEl.innerHTML = '<div class="opening-empty"><strong>No matches</strong>No tasks match "' + escHtml(state._openingSearch) + '"</div>';
  } else if (tabActive === 'thisweek') {
    renderOpeningThisWeek(contentEl, filteredTasks);
  } else if (tabActive === 'phases') {
    renderOpeningPhases(contentEl, filteredTasks);
  } else if (tabActive === 'byowner') {
    renderOpeningByOwner(contentEl, filteredTasks);
  } else if (tabActive === 'gantt') {
    renderOpeningGantt(contentEl, filteredTasks, opening);
  } else if (tabActive === 'notes') {
    renderOpeningNotes(contentEl, opening);
  }
}

function openingTaskRow(p) {
  const isComplete = p.complete;
  const isAdmin = state.session && state.session.role === 'admin';
  const ownerOptions = state.owners.map(o => `<option value="${escHtml(o)}" ${p.owner === o ? 'selected' : ''}>${escHtml(o)}</option>`).join('');
  const priorityOptions = ['', 'Low', 'Medium', 'High'].map(pr => `<option value="${pr}" ${(p.priority || '') === pr ? 'selected' : ''}>${pr || '—'}</option>`).join('');
  return `
    <div class="opening-task-row ${isComplete ? 'done' : ''}">
      <div onclick="event.stopPropagation()">
        ${isAdmin ? '<div class="complete-toggle ' + (isComplete ? 'done' : '') + '" onclick="toggleOpeningComplete(\'' + p.id + '\')"></div>' : '<div style="width:18px"></div>'}
      </div>
      <div class="opening-task-info" onclick="openDetail('${p.id}')" style="cursor:pointer">
        <div class="opening-task-title">${escHtml(p.title)}</div>
        <div class="opening-task-meta">
          ${p.phase != null ? '<span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:' + PHASE_COLORS[p.phase] + ';vertical-align:middle;margin-right:2px"></span>' : ''}
          ${p.phaseCategory ? '<span class="opening-task-category">' + escHtml(p.phaseCategory) + '</span>' : ''}
        </div>
      </div>
      <div class="opening-task-right" onclick="event.stopPropagation()">
        <select class="opening-inline-select ${p.owner ? '' : 'unassigned'}" onchange="inlineUpdateOwner('${p.id}', this.value)" title="Assign owner">
          <option value="">Unassigned</option>
          ${ownerOptions}
        </select>
        <select class="opening-inline-select" onchange="inlineUpdatePriority('${p.id}', this.value)" title="Set priority" style="max-width:90px">
          ${priorityOptions}
        </select>
        ${dueBadge(p)}
      </div>
    </div>`;
}

async function inlineUpdateOwner(id, owner) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  p.owner = owner;
  await dbUpsertProject(p);
  renderOpeningsView();
  showToast(owner ? 'Owner: ' + owner : 'Owner cleared');
}

async function inlineUpdatePriority(id, priority) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  p.priority = priority;
  await dbUpsertProject(p);
  renderOpeningsView();
  showToast(priority ? 'Priority: ' + priority : 'Priority cleared');
}

async function bulkAssignOwner(category, phase, owner) {
  if (!owner) return;
  const opening = state.openings.find(o => o.id === state.activeOpeningId);
  if (!opening) return;
  const tasks = getOpeningTasks(opening.id).filter(t => t.phaseCategory === category && t.phase === phase && !t.complete);
  if (tasks.length === 0) return;
  if (!confirm('Assign ' + owner + ' to all ' + tasks.length + ' incomplete tasks in ' + category + '?')) return;
  showLoading('Assigning...');
  for (const t of tasks) {
    t.owner = owner;
    await dbUpsertProject(t);
  }
  hideLoading();
  renderOpeningsView();
  showToast(tasks.length + ' tasks assigned to ' + owner);
}

async function toggleOpeningComplete(id) {
  await toggleComplete(id);
  renderOpeningsView();
}

// --- THIS WEEK ---
function renderOpeningThisWeek(el, tasks) {
  const todayStr = today();
  const now = new Date(todayStr + 'T00:00:00');

  // Overdue tasks (not complete, due date in past)
  const overdueTasks = tasks.filter(t => {
    if (t.complete) return false;
    const d = daysUntil(dueDate(t));
    return d !== null && d < 0;
  }).sort((a, b) => {
    const da = new Date(dueDate(a) + 'T00:00:00'), db = new Date(dueDate(b) + 'T00:00:00');
    return da - db;
  });

  // Due within 14 days (not complete, due in 0-14 days)
  const upcomingTasks = tasks.filter(t => {
    if (t.complete) return false;
    const d = daysUntil(dueDate(t));
    return d !== null && d >= 0 && d <= 14;
  }).sort((a, b) => {
    const da = new Date(dueDate(a) + 'T00:00:00'), db = new Date(dueDate(b) + 'T00:00:00');
    return da - db;
  });

  let html = '';

  if (overdueTasks.length === 0 && upcomingTasks.length === 0) {
    html = '<div class="opening-empty"><strong>All clear</strong>No overdue or upcoming tasks in the next two weeks.</div>';
    el.innerHTML = html;
    return;
  }

  // Overdue section
  if (overdueTasks.length > 0) {
    html += `
      <div class="opening-section">
        <div class="opening-section-header">
          <div class="opening-section-title overdue">Overdue</div>
          <span class="opening-section-count">${overdueTasks.length}</span>
        </div>
        <div class="opening-task-list">
          ${overdueTasks.map(t => openingTaskRow(t)).join('')}
        </div>
      </div>`;
  }

  // Upcoming — group by phase
  if (upcomingTasks.length > 0) {
    // Group by phase
    const byPhase = {};
    upcomingTasks.forEach(t => {
      const ph = t.phase != null ? t.phase : -1;
      if (!byPhase[ph]) byPhase[ph] = [];
      byPhase[ph].push(t);
    });

    html += `
      <div class="opening-section">
        <div class="opening-section-header">
          <div class="opening-section-title">Due Next 14 Days</div>
          <span class="opening-section-count">${upcomingTasks.length}</span>
        </div>`;

    Object.keys(byPhase).sort((a, b) => a - b).forEach(ph => {
      const phTasks = byPhase[ph];
      const phLabel = ph >= 0 ? PHASE_LABELS[ph] || 'Phase ' + ph : 'No Phase';
      const color = ph >= 0 ? PHASE_COLORS[ph] || '#888' : '#888';
      html += `
        <div style="margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;margin-bottom:2px">
            <div style="width:8px;height:8px;border-radius:2px;background:${color};flex-shrink:0"></div>
            <span style="font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--warm-gray)">${phLabel}</span>
          </div>
          <div class="opening-task-list">
            ${phTasks.map(t => openingTaskRow(t)).join('')}
          </div>
        </div>`;
    });

    html += '</div>';
  }

  el.innerHTML = html;
}

// --- PHASES ---
function renderOpeningPhases(el, tasks) {
  const phases = [0, 1, 2, 3];
  let html = '';

  phases.forEach(ph => {
    const phaseTasks = tasks.filter(t => t.phase === ph);
    if (phaseTasks.length === 0) return;

    const done = phaseTasks.filter(t => t.complete).length;
    const total = phaseTasks.length;
    const pct = Math.round((done / total) * 100);
    const color = PHASE_COLORS[ph];

    // Group by phaseCategory
    const byCat = {};
    phaseTasks.forEach(t => {
      const cat = t.phaseCategory || 'General';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(t);
    });
    const catKeys = Object.keys(byCat).sort();

    // On first render, auto-open phases with urgent work; after that, preserve user's choices
    const phaseKey = 'phase-' + ph;
    if (!(phaseKey in state._openingSections)) {
      const hasUrgent = phaseTasks.some(t => {
        if (t.complete) return false;
        const d = daysUntil(dueDate(t));
        return d !== null && d < 14;
      });
      state._openingSections[phaseKey] = hasUrgent;
    }
    const phaseOpen = state._openingSections[phaseKey];

    html += `
      <div class="opening-phase ${phaseOpen ? 'open' : ''}" id="opening-phase-${ph}">
        <div class="opening-phase-header" onclick="toggleOpeningPhase(${ph})">
          <div class="opening-phase-dot" style="background:${color}"></div>
          <div class="opening-phase-name">${PHASE_LABELS[ph]} <span class="phase-info-icon" onclick="event.stopPropagation();togglePhaseInfo(this)" title="Phase details">i</span>
            <div class="phase-info-tooltip">${PHASE_DESCRIPTIONS[ph]}</div>
          </div>
          <div class="opening-phase-stats">
            <span class="opening-phase-progress">${done}/${total}</span>
            <div class="opening-phase-progress-bar">
              <div class="opening-phase-progress-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <span class="opening-phase-progress">${pct}%</span>
          </div>
          <span class="opening-phase-arrow">&#9660;</span>
        </div>
        <div class="opening-phase-body">`;

    catKeys.forEach((cat, ci) => {
      const catTasks = byCat[cat];
      const catDone = catTasks.filter(t => t.complete).length;
      const catHasUrgent = catTasks.some(t => {
        if (t.complete) return false;
        const d = daysUntil(dueDate(t));
        return d !== null && d < 14;
      });
      // Sort: incomplete first (overdue first, then by due date), then complete
      catTasks.sort((a, b) => {
        if (a.complete !== b.complete) return a.complete ? 1 : -1;
        const da = dueDate(a), db = dueDate(b);
        if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
        return new Date(da + 'T00:00:00') - new Date(db + 'T00:00:00');
      });

      const subcatId = 'subcat-' + ph + '-' + ci;
      // Persist subcat open/close state
      if (!(subcatId in state._openingSections)) {
        state._openingSections[subcatId] = catHasUrgent;
      }
      const subcatOpen = state._openingSections[subcatId];
      const bulkOwnerOpts = state.owners.map(o => `<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('');
      html += `
          <div class="opening-subcat ${subcatOpen ? 'open' : ''}" id="${subcatId}">
            <div class="opening-subcat-header" onclick="toggleSubcat('${subcatId}')">
              ${escHtml(cat)} <span class="opening-subcat-count">${catDone}/${catTasks.length}</span>
              <select class="opening-subcat-bulk" onclick="event.stopPropagation()" onchange="bulkAssignOwner('${escHtml(cat)}', ${ph}, this.value); this.value='';" title="Bulk assign owner">
                <option value="">Assign all...</option>
                ${bulkOwnerOpts}
              </select>
              <span class="opening-subcat-arrow">&#9660;</span>
            </div>
            <div class="opening-task-list">
              ${catTasks.map(t => openingTaskRow(t)).join('')}
            </div>
          </div>`;
    });

    html += `
        </div>
      </div>`;
  });

  if (!html) {
    html = '<div class="opening-empty"><strong>No tasks</strong>No tasks found for this opening.</div>';
  }

  const controls = `<div style="display:flex;gap:12px;margin-bottom:12px">
    <button class="opening-expand-btn" onclick="toggleAllPhases(true)">&#9660; Expand All</button>
    <button class="opening-expand-btn" onclick="toggleAllPhases(false)">&#9650; Collapse All</button>
  </div>`;

  el.innerHTML = controls + html;
}

function toggleAllPhases(expand) {
  document.querySelectorAll('.opening-phase, .opening-subcat').forEach(el => {
    if (expand) {
      el.classList.add('open');
    } else {
      el.classList.remove('open');
    }
  });
  // Persist all section states
  Object.keys(state._openingSections).forEach(k => {
    state._openingSections[k] = expand;
  });
}

function togglePhaseInfo(iconEl) {
  const tooltip = iconEl.nextElementSibling;
  if (!tooltip) return;
  // Close any other open tooltips first
  document.querySelectorAll('.phase-info-tooltip.show').forEach(el => {
    if (el !== tooltip) el.classList.remove('show');
  });
  tooltip.classList.toggle('show');
}

// Close phase info tooltips when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.phase-info-icon') && !e.target.closest('.phase-info-tooltip')) {
    document.querySelectorAll('.phase-info-tooltip.show').forEach(el => el.classList.remove('show'));
  }
});

function toggleOpeningPhase(ph) {
  const key = 'phase-' + ph;
  state._openingSections[key] = !state._openingSections[key];
  const el = document.getElementById('opening-phase-' + ph);
  if (el) el.classList.toggle('open');
}

function toggleSubcat(id) {
  state._openingSections[id] = !state._openingSections[id];
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

// --- BY OWNER ---
function renderOpeningByOwner(el, tasks) {
  // Group by owner
  const byOwner = {};
  tasks.forEach(t => {
    const owner = t.owner || '';
    if (!byOwner[owner]) byOwner[owner] = [];
    byOwner[owner].push(t);
  });

  // Sort: unassigned first, then by overdue count desc, then alpha
  const ownerEntries = Object.entries(byOwner).map(([owner, ownerTasks]) => {
    const done = ownerTasks.filter(t => t.complete).length;
    const total = ownerTasks.length;
    const overdue = ownerTasks.filter(t => {
      if (t.complete) return false;
      const d = daysUntil(dueDate(t));
      return d !== null && d < 0;
    }).length;
    const dueSoon = ownerTasks.filter(t => {
      if (t.complete) return false;
      const d = daysUntil(dueDate(t));
      return d !== null && d >= 0 && d <= 14;
    }).length;
    return { owner, tasks: ownerTasks, done, total, overdue, dueSoon };
  });

  ownerEntries.sort((a, b) => {
    // Unassigned last
    if (!a.owner && b.owner) return 1;
    if (a.owner && !b.owner) return -1;
    // Then by overdue count desc
    if (a.overdue !== b.overdue) return b.overdue - a.overdue;
    // Then alphabetically
    return a.owner.localeCompare(b.owner);
  });

  let html = '';

  ownerEntries.forEach((g, idx) => {
    const displayName = g.owner || 'Unassigned';
    const pct = g.total > 0 ? Math.round((g.done / g.total) * 100) : 0;
    const hasUrgent = g.overdue > 0 || g.dueSoon > 0;
    const groupId = 'owner-group-' + idx;

    // Sort tasks: incomplete overdue first, then by due date, then complete
    g.tasks.sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? 1 : -1;
      const da = dueDate(a), db = dueDate(b);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return new Date(da + 'T00:00:00') - new Date(db + 'T00:00:00');
    });

    // Persist owner group open/close state
    if (!(groupId in state._openingSections)) {
      state._openingSections[groupId] = hasUrgent;
    }
    const groupOpen = state._openingSections[groupId];

    html += `
      <div class="opening-owner-group ${groupOpen ? 'open' : ''}" id="${groupId}">
        <div class="opening-owner-header" onclick="toggleOwnerGroup('${groupId}')">
          <div class="opening-owner-name">${escHtml(displayName)}</div>
          <div class="opening-owner-stats">
            ${g.overdue > 0 ? `<div class="opening-owner-stat"><span class="red">${g.overdue} overdue</span></div>` : ''}
            ${g.dueSoon > 0 ? `<div class="opening-owner-stat">${g.dueSoon} due soon</div>` : ''}
            <div class="opening-owner-stat"><span class="green">${g.done}/${g.total}</span> (${pct}%)</div>
          </div>
          <span class="opening-owner-arrow">&#9660;</span>
        </div>
        <div class="opening-owner-body">
          <div class="opening-task-list">
            ${g.tasks.map(t => openingTaskRow(t)).join('')}
          </div>
        </div>
      </div>`;
  });

  if (!html) {
    html = '<div class="opening-empty"><strong>No tasks</strong>No tasks found for this opening.</div>';
  }

  el.innerHTML = html;
}

function toggleOwnerGroup(id) {
  state._openingSections[id] = !state._openingSections[id];
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

// --- GANTT ---
// Cell-based approach: color table cells directly, no absolute positioning
function renderOpeningGantt(el, tasks, opening) {
  const todayDate = new Date(today() + 'T00:00:00');
  const targetDate = new Date(opening.targetDate + 'T00:00:00');

  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 7);

  // Build weeks array (each entry = Monday of that week)
  const weeks = [];
  const firstMonday = new Date(todayDate);
  firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
  for (let d = new Date(firstMonday); d <= endDate; d.setDate(d.getDate() + 7)) {
    weeks.push(new Date(d));
  }

  // Helper: which week index does a date fall in?
  function weekIndex(date) {
    const ms = date - weeks[0];
    return ms / (7 * 86400000);
  }

  // Legend
  let legendHtml = '<div class="opening-gantt-legend">';
  PHASE_SHORT.forEach((label, i) => {
    legendHtml += `<div class="opening-gantt-legend-item"><div class="opening-gantt-legend-dot" style="background:${PHASE_COLORS[i]}"></div>${label}</div>`;
  });
  legendHtml += `<div class="opening-gantt-legend-item" style="margin-left:16px"><div class="opening-gantt-legend-dot" style="background:var(--rust);border-radius:50%"></div>Today</div>`;
  legendHtml += `<div class="opening-gantt-legend-item"><div class="opening-gantt-legend-dot" style="background:var(--gold)"></div>Opening Day</div>`;
  legendHtml += '</div>';

  // Month headers
  const monthHeaders = [];
  let curMonth = null, curSpan = 0;
  weeks.forEach(w => {
    const m = w.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (m !== curMonth) {
      if (curMonth) monthHeaders.push({ label: curMonth, span: curSpan });
      curMonth = m; curSpan = 1;
    } else { curSpan++; }
  });
  if (curMonth) monthHeaders.push({ label: curMonth, span: curSpan });

  // Find which week index the target date falls in
  const targetWeekIdx = Math.floor(weekIndex(targetDate));

  const monthRow = monthHeaders.map(m => `<th colspan="${m.span}" style="text-align:left;padding-left:8px">${m.label}</th>`).join('');
  const weekRow = weeks.map((w, idx) => {
    const wEnd = new Date(w); wEnd.setDate(wEnd.getDate() + 6);
    const todayInWeek = todayDate >= w && todayDate <= wEnd;
    const isTarget = idx === targetWeekIdx;
    const label = w.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    let cls = 'gantt-day-cell';
    if (todayInWeek) cls += ' today-col';
    if (isTarget) cls += ' opening-target-col';
    return `<th class="${cls}" style="min-width:36px;font-size:9px">${label}${todayInWeek ? '<div style="font-size:7px;color:#ff6b4a;font-weight:700;letter-spacing:0.05em;margin-top:1px">TODAY</div>' : ''}${isTarget ? '<div style="font-size:7px;color:var(--gold);font-weight:700;letter-spacing:0.05em;margin-top:1px">OPEN</div>' : ''}</th>`;
  }).join('');

  // Build grouped rows
  const phases = [0, 1, 2, 3];
  let tableRows = '';

  phases.forEach(ph => {
    const phaseTasks = tasks.filter(t => t.phase === ph);
    if (phaseTasks.length === 0) return;

    const byCat = {};
    phaseTasks.forEach(t => {
      const cat = t.phaseCategory || 'General';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(t);
    });

    const catEntries = Object.entries(byCat).map(([cat, catTasks]) => {
      let earliest = null, latest = null;
      catTasks.forEach(t => {
        const due = getDueDate(t);
        if (!due) return;
        if (!earliest || due < earliest) earliest = due;
        if (!latest || due > latest) latest = due;
      });
      const done = catTasks.filter(t => t.complete).length;
      const hasOverdue = catTasks.some(t => !t.complete && getDueDate(t) && getDueDate(t) < todayDate);
      return { cat, tasks: catTasks, earliest, latest, total: catTasks.length, done, hasOverdue, phase: ph };
    });
    catEntries.sort((a, b) => (a.earliest || Infinity) - (b.earliest || Infinity));

    tableRows += `<tr class="gantt-group-row"><td colspan="${weeks.length + 1}">${PHASE_LABELS[ph]}</td></tr>`;

    catEntries.forEach(g => {
      const pct = g.total > 0 ? Math.round((g.done / g.total) * 100) : 0;
      const allDone = g.done === g.total;
      const dateRange = g.earliest && g.latest
        ? g.earliest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' \u2014 ' + g.latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
      const barColor = PHASE_COLORS[g.phase];

      // Determine start/end week indices for this category
      const startWk = g.earliest ? Math.floor(weekIndex(g.earliest)) : -1;
      const endWk = g.latest ? Math.floor(weekIndex(g.latest)) : -1;

      const cells = weeks.map((w, idx) => {
        const wEnd = new Date(w); wEnd.setDate(wEnd.getDate() + 6);
        const todayInWeek = todayDate >= w && todayDate <= wEnd;
        const isTarget = idx === targetWeekIdx;
        const inRange = idx >= startWk && idx <= endWk;
        const isFirst = idx === startWk;
        const isLast = idx === endWk;

        let bgStyle = '';
        let content = '';
        if (inRange) {
          const opacity = allDone ? 0.2 : 0.3;
          bgStyle = `background:${barColor}${Math.round(opacity * 255).toString(16).padStart(2,'0')};`;
          // Rounded edges on first/last cells
          if (isFirst && isLast) bgStyle += 'border-radius:4px;';
          else if (isFirst) bgStyle += 'border-radius:4px 0 0 4px;';
          else if (isLast) bgStyle += 'border-radius:0 4px 4px 0;';
          // Show progress label in first cell
          if (isFirst) {
            content = `<span style="position:relative;z-index:1;font-family:'DM Mono',monospace;font-size:9px;color:white;font-weight:600;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.3)">${g.done}/${g.total}</span>`;
          }
        }

        let cls = 'gantt-bar-cell gantt-day-cell';
        if (todayInWeek) cls += ' today-col';
        if (isTarget) cls += ' opening-target-col';

        return `<td class="${cls}" style="height:32px;min-width:36px;padding:0 3px;vertical-align:middle;${bgStyle}">${content}</td>`;
      }).join('');

      tableRows += `<tr class="gantt-row" style="cursor:default" title="${escHtml(g.cat)}: ${g.done}/${g.total} (${pct}%)">
        <td class="gantt-label-cell ${allDone ? 'complete' : ''}">
          <div class="gantt-label-name">${escHtml(g.cat)}</div>
          <div class="gantt-label-meta">${g.done}/${g.total} &middot; ${dateRange}</div>
        </td>
        ${cells}
      </tr>`;
    });
  });

  el.innerHTML = legendHtml + `
    <div class="gantt-scroll-wrap" id="opening-gantt-scroll">
      <table class="gantt-table" id="opening-gantt-table">
        <thead>
          <tr class="gantt-header-row"><th class="label-col"></th>${monthRow}</tr>
          <tr class="gantt-header-row"><th class="label-col" style="font-size:10px">Category</th>${weekRow}</tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}

// --- NOTES ---
function renderOpeningNotes(el, opening) {
  const allNotes = state.openingNotes.filter(n => n.openingId === opening.id);
  const activeNotes = allNotes.filter(n => n.status === 'active');
  const archivedNotes = allNotes.filter(n => n.status === 'archived');

  let html = `
    <div class="opening-notes-wrap">
      <div class="opening-notes-input">
        <textarea id="opening-note-input" class="opening-note-textarea" placeholder="Add a note or update..." rows="3"></textarea>
        <div class="opening-notes-input-actions">
          <button class="btn-primary" onclick="saveOpeningNote()">Save Note</button>
        </div>
      </div>
      <div class="opening-notes-list">`;

  if (activeNotes.length === 0) {
    html += '<div class="opening-empty"><strong>No notes yet</strong>Add your first note above</div>';
  } else {
    activeNotes.forEach(n => { html += openingNoteCard(n); });
  }

  html += '</div>';

  // Archived section
  if (archivedNotes.length > 0) {
    const isOpen = state._openingSections['archived-notes'];
    html += `
      <div class="opening-phase ${isOpen ? 'open' : ''}" id="archived-notes">
        <div class="opening-phase-header" onclick="togglePhaseGroup('archived-notes')">
          <div class="opening-phase-dot" style="background:var(--warm-gray)"></div>
          <div class="opening-phase-name">Archived</div>
          <div class="opening-phase-stats">
            <span class="opening-phase-progress">${archivedNotes.length} note${archivedNotes.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="opening-phase-arrow">&#9660;</div>
        </div>
        <div class="opening-phase-body">
          <div class="opening-notes-list archived">`;
    archivedNotes.forEach(n => { html += openingNoteCard(n, true); });
    html += '</div></div></div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

function openingNoteCard(n, isArchived) {
  const date = new Date(n.createdAt);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `
    <div class="opening-note-card ${isArchived ? 'archived' : ''}">
      <div class="opening-note-timestamp">${dateStr} at ${timeStr}</div>
      <div class="opening-note-content">${escHtml(n.content).replace(/\n/g, '<br>')}</div>
      <div class="opening-note-actions">
        ${isArchived
          ? '<button class="opening-note-btn" onclick="unarchiveOpeningNote(\'' + n.id + '\')" title="Restore">Restore</button>'
          : '<button class="opening-note-btn" onclick="archiveOpeningNote(\'' + n.id + '\')" title="Archive">Archive</button>'
        }
        <button class="opening-note-btn danger" onclick="deleteOpeningNote('${n.id}')" title="Delete">Delete</button>
        ${!isArchived ? '<button class="opening-note-btn primary" onclick="openingNoteToTask(\'' + n.id + '\')" title="Turn into Task">Turn into Task</button>' : ''}
      </div>
    </div>`;
}

async function saveOpeningNote() {
  const input = document.getElementById('opening-note-input');
  const content = (input ? input.value : '').trim();
  if (!content) return;
  const openingId = state.activeOpeningId;
  if (!openingId) return;
  try {
    const note = await dbInsertOpeningNote(openingId, content);
    state.openingNotes.unshift(note);
    input.value = '';
    const contentEl = document.getElementById('opening-tab-content');
    const opening = state.openings.find(o => o.id === openingId);
    if (contentEl && opening) renderOpeningNotes(contentEl, opening);
    showToast('Note saved');
  } catch (e) {
    showToast('Error saving note', 'error');
  }
}

async function archiveOpeningNote(noteId) {
  try {
    await dbUpdateOpeningNoteStatus(noteId, 'archived');
    const n = state.openingNotes.find(x => x.id === noteId);
    if (n) n.status = 'archived';
    refreshNotesTab();
    showToast('Note archived');
  } catch (e) {
    showToast('Error archiving note', 'error');
  }
}

async function unarchiveOpeningNote(noteId) {
  try {
    await dbUpdateOpeningNoteStatus(noteId, 'active');
    const n = state.openingNotes.find(x => x.id === noteId);
    if (n) n.status = 'active';
    refreshNotesTab();
    showToast('Note restored');
  } catch (e) {
    showToast('Error restoring note', 'error');
  }
}

async function deleteOpeningNote(noteId) {
  if (!confirm('Delete this note? This cannot be undone.')) return;
  try {
    await dbDeleteOpeningNote(noteId);
    state.openingNotes = state.openingNotes.filter(x => x.id !== noteId);
    refreshNotesTab();
    showToast('Note deleted');
  } catch (e) {
    showToast('Error deleting note', 'error');
  }
}

function openingNoteToTask(noteId) {
  const n = state.openingNotes.find(x => x.id === noteId);
  if (!n) return;
  openOpeningTaskModal();
  // Pre-fill the title field with the note content
  const titleField = document.getElementById('f-title');
  if (titleField) titleField.value = n.content;
}

function refreshNotesTab() {
  const contentEl = document.getElementById('opening-tab-content');
  const opening = state.openings.find(o => o.id === state.activeOpeningId);
  if (contentEl && opening) renderOpeningNotes(contentEl, opening);
}

