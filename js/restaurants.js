// ============================================================
// TABLE
// ============================================================
const restaurantColorCache = {};
function restaurantColorIndex(name) {
  if (!(name in restaurantColorCache)) {
    const idx = state.restaurants.indexOf(name);
    restaurantColorCache[name] = idx >= 0 ? idx % 8 : 0;
  }
  return restaurantColorCache[name];
}

function getFilteredProjects() {
  // Restrict to own restaurant for restaurant role
  const ownRest = state.session && state.session.role === 'restaurant' ? state.session.restaurant : null;
  let projects = state.projects.filter(p => !p.archived && !p.openingId);
  projects = state.activeTab === 'all'
    ? (ownRest ? projects.filter(p => p.restaurant === ownRest) : projects)
    : projects.filter(p => p.restaurant === state.activeTab);

  const search = document.getElementById('search-input').value.toLowerCase();
  const cat    = document.getElementById('filter-category').value;
  const pri    = document.getElementById('filter-priority').value;
  const owner  = document.getElementById('filter-owner').value;
  const status = document.getElementById('filter-status').value;
  const d7     = document.getElementById('due-7').checked;
  const d14    = document.getElementById('due-14').checked;
  const d30    = document.getElementById('due-30').checked;

  if (search)  projects = projects.filter(p =>
    p.title.toLowerCase().includes(search) ||
    (p.description || '').toLowerCase().includes(search) ||
    (p.owner || '').toLowerCase().includes(search)
  );
  if (cat)    projects = projects.filter(p => p.category  === cat);
  if (pri)    projects = projects.filter(p => p.priority  === pri);
  if (owner)  projects = projects.filter(p => p.owner     === owner);
  if (status === 'open')     projects = projects.filter(p => !p.complete);
  if (status === 'complete') projects = projects.filter(p => p.complete);

  if (d7 || d14 || d30) {
    projects = projects.filter(p => {
      const days = daysUntil(dueDate(p));
      if (days === null) return false;
      if (d7  && days >= 0 && days <= 7)  return true;
      if (d14 && days >= 0 && days <= 14) return true;
      if (d30 && days >= 0 && days <= 30) return true;
      return false;
    });
  }

  if (state.showOverdue) {
    projects = projects.filter(p => {
      const days = daysUntil(dueDate(p));
      return days !== null && days < 0 && !p.complete;
    });
  }

  const anyActive = search || cat || pri || owner || status || d7 || d14 || d30 || state.showOverdue;
  const clearBtn = document.getElementById('filter-clear-btn');
  if (clearBtn) clearBtn.style.display = anyActive ? '' : 'none';

  ['filter-category','filter-priority','filter-owner','filter-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', !!el.value);
  });

  return sortProjects(projects);
}

function showOverdueTasks() {
  switchTab('all');
  state.showOverdue = true;
  renderTable();
}

function clearFilters() {
  document.getElementById('search-input').value   = '';
  document.getElementById('filter-category').value= '';
  document.getElementById('filter-priority').value= '';
  document.getElementById('filter-owner').value   = '';
  document.getElementById('filter-status').value  = '';
  document.getElementById('due-7').checked  = false;
  document.getElementById('due-14').checked = false;
  document.getElementById('due-30').checked = false;
  state.showOverdue = false;
  renderTable();
}

function toggleFilters() {
  const content = document.getElementById('filter-content');
  const toggle = document.getElementById('filter-toggle');
  if (content && toggle) {
    content.classList.toggle('open');
    toggle.classList.toggle('active');
  }
}

function openFilters() {
  const content = document.getElementById('filter-content');
  const toggle = document.getElementById('filter-toggle');
  if (content && toggle && !content.classList.contains('open')) {
    content.classList.add('open');
    toggle.classList.add('active');
  }
}

function filterFromSummary(type) {
  clearFilters();
  if (type === 'overdue') {
    switchTab('all');
    state.showOverdue = true;
    renderTable();
  } else if (type === 'due7') {
    switchTab('all');
    openFilters();
    document.getElementById('due-7').checked = true;
    renderTable();
  } else if (type === 'high') {
    switchTab('all');
    openFilters();
    document.getElementById('filter-priority').value = 'High';
    renderTable();
  }
}

function renderRestaurantCards() {
  var ownRest   = state.session && state.session.restaurant;
  var projects  = getFilteredProjects();
  // Belt-and-suspenders: always restrict to this restaurant only
  if (ownRest) projects = projects.filter(function(p) { return p.restaurant === ownRest; });
  var projectsView = document.getElementById('projects-view');
  var empty        = document.getElementById('empty-state');
  var container    = document.getElementById('restaurant-cards');

  // Create card container if it doesn't exist, insert before the table
  if (!container) {
    container = document.createElement('div');
    container.id = 'restaurant-cards';
    if (projectsView) projectsView.insertBefore(container, projectsView.firstChild);
  }
  container.style.display = '';

  if (projects.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  var active    = projects.filter(function(p){ return !p.complete; });
  var completed = projects.filter(function(p){ return p.complete; });

  function cardHTML(p) {
    var due    = dueDate(p);
    var days   = due ? daysUntil(due) : null;
    var dueStr = '';
    if (p.complete) {
      dueStr = '<span class="rc-badge rc-complete">Complete</span>';
    } else if (due) {
      if (days < 0)       dueStr = '<span class="rc-badge rc-overdue">Overdue</span>';
      else if (days === 0) dueStr = '<span class="rc-badge rc-soon">Due Today</span>';
      else if (days <= 7) dueStr = '<span class="rc-badge rc-soon">Due ' + formatDate(due) + '</span>';
      else                dueStr = '<span class="rc-badge rc-upcoming">Due ' + formatDate(due) + '</span>';
    }
    var priStr = p.priority ? '<span class="rc-badge rc-pri-' + p.priority.toLowerCase() + '">' + p.priority + '</span>' : '';
    var subStr = p.isComplex && p.subtasks && p.subtasks.length > 0
      ? '<span class="rc-subtasks">' + p.subtasks.filter(function(s){ return s.status === 'complete'; }).length + '/' + p.subtasks.length + ' subtasks</span>'
      : '';
    var noteStr = p.notes && p.notes.length > 0
      ? '<div class="rc-note">&#128203; ' + escHtml(p.notes[p.notes.length-1].text) + '</div>'
      : '';
    return '<div class="rc-card' + (p.complete ? ' rc-card-done' : '') + '" onclick="openDetail(\'' + p.id + '\')">'
      + '<div class="rc-badges">' + priStr + dueStr + subStr + '</div>'
      + '<div class="rc-title">' + escHtml(p.title) + '</div>'
      + (p.description ? '<div class="rc-desc">' + escHtml(p.description) + '</div>' : '')
      + (p.owner ? '<div class="rc-owner">&#128100; ' + escHtml(p.owner) + '</div>' : '')
      + noteStr
      + '</div>';
  }

  var html = '';
  if (active.length) {
    html += '<div class="rc-section-label">Active (' + active.length + ')</div>';
    html += '<div class="rc-grid">' + active.map(cardHTML).join('') + '</div>';
  }
  if (completed.length) {
    html += '<div class="rc-section-label rc-section-done">Completed (' + completed.length + ')</div>';
    html += '<div class="rc-grid">' + completed.map(cardHTML).join('') + '</div>';
  }
  container.innerHTML = html;
}

function sortBy(col) {
  if (state.sort.col === col) {
    state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.col = col;
    state.sort.dir = 'asc';
  }
  renderTable();
  updateSortIcons();
}

function updateSortIcons() {
  ['restaurant','title','category','owner','due','priority'].forEach(function(c) {
    var el = document.getElementById('sort-' + c);
    if (!el) return;
    if (state.sort.col !== c) { el.textContent = ''; return; }
    el.textContent = state.sort.dir === 'asc' ? ' ▲' : ' ▼';
  });
}

function sortProjects(projects) {
  var col = state.sort.col;
  var dir = state.sort.dir;
  var sorted = projects.slice().sort(function(a, b) {
    // Always push completed to bottom
    if (a.complete !== b.complete) return a.complete ? 1 : -1;
    // Within completed items, sort most recently completed first
    if (a.complete && b.complete) {
      var ua = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
      var ub = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
      return ub - ua;
    }
    var va, vb;
    if (col === 'due') {
      va = dueDate(a) || 'z'; vb = dueDate(b) || 'z';
    } else if (col === 'priority') {
      var pOrder = { High: 0, Medium: 1, Low: 2 };
      va = pOrder[a.priority] !== undefined ? pOrder[a.priority] : 3;
      vb = pOrder[b.priority] !== undefined ? pOrder[b.priority] : 3;
      return dir === 'asc' ? va - vb : vb - va;
    } else if (col === 'title')      { va = (a.title      || '').toLowerCase(); vb = (b.title      || '').toLowerCase(); }
    else if (col === 'category')     { va = (a.category   || '').toLowerCase(); vb = (b.category   || '').toLowerCase(); }
    else if (col === 'owner')        { va = (a.owner      || '').toLowerCase(); vb = (b.owner      || '').toLowerCase(); }
    else if (col === 'restaurant')   { va = (a.restaurant || '').toLowerCase(); vb = (b.restaurant || '').toLowerCase(); }
    else {
      // default: incomplete first, then by due date
      if (a.complete !== b.complete) return a.complete ? 1 : -1;
      var da = dueDate(a), db2 = dueDate(b);
      if (!da && !db2) return 0; if (!da) return 1; if (!db2) return -1;
      return da.localeCompare(db2);
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

function renderTable() {
  var _pv   = document.getElementById('projects-view');
  var _tbl  = _pv ? _pv.querySelector('table') : null;
  var _cards = document.getElementById('restaurant-cards');
  // Always use table view (cards no longer used)
  if (_tbl)   _tbl.style.display   = '';
  if (_cards) _cards.style.display = 'none';
  const projects = getFilteredProjects();
  const tbody    = document.getElementById('project-table-body');
  const empty    = document.getElementById('empty-state');
  const isRestRole = state.session && state.session.role === 'restaurant';
  const showRestaurant = state.activeTab === 'all' && !isRestRole;
  const col = document.getElementById('col-restaurant');
  if (col) col.style.display = showRestaurant ? '' : 'none';

  if (projects.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = projects.map(p => {
    const latestNote = p.notes && p.notes.length > 0 ? p.notes[p.notes.length - 1].text : '';
    const colorIdx   = restaurantColorIndex(p.restaurant);
    const restaurantCell = showRestaurant
      ? `<td style="padding-left:8px"><span class="restaurant-pill" data-r="${colorIdx}">${p.restaurant}</span></td>`
      : '';
    return `<tr onclick="openDetail('${p.id}')">
      <td onclick="event.stopPropagation()">
        ${state.session && state.session.role === 'restaurant' ? '<div style="width:20px"></div>' : `<div class="complete-toggle ${p.complete ? 'done' : ''}" onclick="toggleComplete('${p.id}')"></div>`}
      </td>
      ${restaurantCell}
      <td style="${p.complete ? 'opacity:0.5' : ''}">
        <span class="project-name">${p.title}</span>
        ${p.description ? `<span class="project-desc">${p.description}</span>` : ''}
        ${p.isComplex ? subtaskBadge(p) : ''}
      </td>
      <td><span class="category-tag ${categoryClass(p.category)}">${p.category || '&mdash;'}</span></td>
      <td class="owner-cell">${p.owner || '&mdash;'}</td>
      <td>${dueBadge(p)}</td>
      <td>${p.priority ? `<span class="priority-badge ${p.priority.toLowerCase()}">${p.priority}</span>` : '&mdash;'}</td>
      <td><div class="update-preview">${latestNote || '&mdash;'}</div></td>
    </tr>`;
  }).join('');
}

async function toggleComplete(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  const prev = p.complete;
  p.complete = !p.complete;
  try {
    await dbUpsertProject(p);
  } catch(e) {
    console.error('toggleComplete error:', e);
    p.complete = prev; // roll back optimistic update
    showToast('Error updating task', 'error');
    render();
    return;
  }
  render();
  showToast(p.complete ? 'Task marked complete' : 'Task marked incomplete');
}

// ============================================================
// PRINT / PDF REPORT — Weekly Summary
// ============================================================
function printReport() {
  var session  = state.session;
  var myRest   = session && session.role === 'restaurant' ? session.restaurant : null;
  var todayStr = today();
  var now      = new Date(todayStr + 'T00:00:00');
  var cutoff7  = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);
  var future7  = new Date(now); future7.setDate(future7.getDate() + 7);

  // Logo + header strings
  var scLogoSrc  = '';
  var scLogoEl   = document.querySelector('.header-logos img');
  if (scLogoEl) scLogoSrc = scLogoEl.src;
  var lthLogoSrc = 'data:image/png;base64,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';
  var dateLabel   = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  var reportTitle = myRest ? myRest + ' — Weekly Summary' : 'Weekly Project Summary';

  // Determine which restaurants to include (state.restaurants is an array of strings)
  var restaurants = myRest
    ? state.restaurants.filter(function(r) { return r === myRest; })
    : state.restaurants;

  // ── Gather global stats for summary bar ──
  var totalCompleted = 0, totalNew = 0, totalUpcoming = 0, totalNotes = 0;

  // Build per-restaurant sections
  var sectionsHtml = '';
  restaurants.forEach(function(restName, idx) {
    var restProjects = state.projects.filter(function(p) { return p.restaurant === restName; });

    // 1. Recently Completed in past 7 days
    var done = restProjects.filter(function(p) {
      if (!p.complete) return false;
      var u = p.updatedAt ? new Date(p.updatedAt) : null;
      return u && u >= cutoff7;
    });

    // 2. New Projects added in past 7 days
    var newP = restProjects.filter(function(p) {
      var c = p.createdAt ? new Date(p.createdAt) : null;
      return c && c >= cutoff7;
    });

    // 3. Upcoming: due within next 7 days, not complete
    var upcoming = restProjects.filter(function(p) {
      if (p.complete) return false;
      var dd = dueDate(p);
      if (!dd) return false;
      var dueD = new Date(dd + 'T00:00:00');
      return dueD >= now && dueD <= future7;
    });
    upcoming.sort(function(a, b) {
      var da = dueDate(a) || '9999-12-31';
      var db = dueDate(b) || '9999-12-31';
      return da.localeCompare(db);
    });

    // 4. Notes & Updates: notes in past 7 days, deduplicated from done/newP
    var doneIds = done.map(function(p) { return p.id; });
    var newIds  = newP.map(function(p) { return p.id; });
    var updated = [];
    restProjects.forEach(function(p) {
      if (doneIds.indexOf(p.id) !== -1 || newIds.indexOf(p.id) !== -1) return;
      (p.notes || []).forEach(function(n) {
        if (!n.date) return;
        if (new Date(n.date + 'T00:00:00') >= cutoff7) updated.push({ project: p, note: n });
      });
    });
    updated.sort(function(a, b) { return new Date(b.note.date) - new Date(a.note.date); });

    // Accumulate global stats
    totalCompleted += done.length;
    totalNew       += newP.length;
    totalUpcoming  += upcoming.length;
    totalNotes     += updated.length;

    var hasActivity = done.length > 0 || newP.length > 0 || upcoming.length > 0 || updated.length > 0;
    var pbClass     = idx > 0 ? ' pr-page-break' : '';

    var sec = '<div class="pr-restaurant-section' + pbClass + '">';
    sec += '<div class="pr-restaurant-header">' + escHtml(restName) + '</div>';

    if (!hasActivity) {
      sec += '<p class="pr-no-activity">No activity this period.</p>';
    } else {

      // ── Recently Completed ──
      sec += '<div class="pr-subsection">';
      sec += '<div class="pr-subsection-title">' + String.fromCodePoint(0x2705) + ' Recently Completed</div>';
      if (!done.length) {
        sec += '<p class="pr-no-activity">None.</p>';
      } else {
        sec += '<table class="pr-table"><thead><tr><th>Project</th><th>Owner</th><th>Completed</th></tr></thead><tbody>';
        done.forEach(function(p) {
          var cd = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
          sec += '<tr><td>' + escHtml(p.title)
            + (p.description ? '<br><span style="font-size:9pt;color:#6b6055">' + escHtml(p.description) + '</span>' : '')
            + '</td><td>' + escHtml(p.owner || '—') + '</td>'
            + '<td class="pr-complete">' + cd + '</td></tr>';
        });
        sec += '</tbody></table>';
      }
      sec += '</div>';

      // ── New Projects ──
      sec += '<div class="pr-subsection">';
      sec += '<div class="pr-subsection-title">' + String.fromCodePoint(0x1F195) + ' New Tasks</div>';
      if (!newP.length) {
        sec += '<p class="pr-no-activity">None.</p>';
      } else {
        sec += '<table class="pr-table"><thead><tr><th>Project</th><th>Owner</th><th>Category</th><th>Status</th><th>Added</th></tr></thead><tbody>';
        newP.forEach(function(p) {
          var ad = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
          var statusCls = p.complete ? 'pr-status-badge pr-complete' : 'pr-status-badge pr-status-active';
          var statusTxt = p.complete ? 'Complete' : 'In Progress';
          sec += '<tr><td>' + escHtml(p.title)
            + (p.description ? '<br><span style="font-size:9pt;color:#6b6055">' + escHtml(p.description) + '</span>' : '')
            + '</td><td>' + escHtml(p.owner || '—') + '</td>'
            + '<td>' + escHtml(p.category || '—') + '</td>'
            + '<td><span class="' + statusCls + '">' + statusTxt + '</span></td>'
            + '<td style="white-space:nowrap">' + ad + '</td></tr>';
        });
        sec += '</tbody></table>';
      }
      sec += '</div>';

      // ── Upcoming Tasks ──
      sec += '<div class="pr-subsection">';
      sec += '<div class="pr-subsection-title">' + String.fromCodePoint(0x1F4C5) + ' Upcoming (Next 7 Days)</div>';
      if (!upcoming.length) {
        sec += '<p class="pr-no-activity">None.</p>';
      } else {
        sec += '<table class="pr-table"><thead><tr><th>Project</th><th>Owner</th><th>Priority</th><th>Due</th></tr></thead><tbody>';
        upcoming.forEach(function(p) {
          var dd = dueDate(p);
          var du = daysUntil(dd);
          var dueFmt = dd ? new Date(dd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
          var dueCls = '';
          if (du !== null && du < 0) dueCls = ' class="pr-overdue"';
          else if (du !== null && du <= 3) dueCls = ' class="pr-due-soon"';
          var priHtml = '—';
          if (p.priority) {
            priHtml = '<span class="pr-pri-' + p.priority.toLowerCase() + '">' + escHtml(p.priority) + '</span>';
          }
          sec += '<tr><td>' + escHtml(p.title)
            + (p.description ? '<br><span style="font-size:9pt;color:#6b6055">' + escHtml(p.description) + '</span>' : '')
            + '</td><td>' + escHtml(p.owner || '—') + '</td>'
            + '<td>' + priHtml + '</td>'
            + '<td style="white-space:nowrap"' + dueCls + '>' + dueFmt + '</td></tr>';
        });
        sec += '</tbody></table>';
      }
      sec += '</div>';

      // ── Notes & Updates ──
      sec += '<div class="pr-subsection">';
      sec += '<div class="pr-subsection-title">' + String.fromCodePoint(0x1F4DD) + ' Notes & Updates</div>';
      if (!updated.length) {
        sec += '<p class="pr-no-activity">None.</p>';
      } else {
        sec += '<table class="pr-table"><thead><tr><th>Date</th><th>Project</th><th>Note</th><th>Author</th></tr></thead><tbody>';
        updated.forEach(function(item) {
          sec += '<tr>'
            + '<td style="white-space:nowrap">' + formatDate(item.note.date) + '</td>'
            + '<td>' + escHtml(item.project.title) + '</td>'
            + '<td>' + escHtml(item.note.text) + '</td>'
            + '<td style="white-space:nowrap">' + escHtml(item.note.author || '—') + '</td>'
            + '</tr>';
        });
        sec += '</tbody></table>';
      }
      sec += '</div>';

    }

    sec += '</div>'; // .pr-restaurant-section
    sectionsHtml += sec;
  });

  // ── Assemble ──────────────────────────────────────────────────────────────
  var html = '<div class="pr-header">'
    + '<div class="pr-header-left">'
    + '<img src="' + lthLogoSrc + '" alt="Lowder-Tascarella Hospitality" style="height:40pt">'
    + '</div>'
    + '<div style="text-align:center;flex:1"><h1 style="font-size:14pt;font-weight:700;margin:0;color:#1a1612">' + reportTitle + '</h1>'
    + '<p style="font-size:9pt;color:#6b6055;margin:2pt 0 0">' + dateLabel + '</p></div>'
    + (scLogoSrc ? '<img src="' + scLogoSrc + '" alt="SC Culinary" style="height:40pt">' : '')
    + '</div>';

  // Summary bar
  html += '<div class="pr-summary-bar">'
    + '<div class="pr-summary-stat pr-stat-green"><span class="pr-stat-value">' + totalCompleted + '</span><span class="pr-stat-label">Completed</span></div>'
    + '<div class="pr-summary-stat pr-stat-blue"><span class="pr-stat-value">' + totalNew + '</span><span class="pr-stat-label">New Tasks</span></div>'
    + '<div class="pr-summary-stat pr-stat-rust"><span class="pr-stat-value">' + totalUpcoming + '</span><span class="pr-stat-label">Upcoming</span></div>'
    + '<div class="pr-summary-stat"><span class="pr-stat-value">' + totalNotes + '</span><span class="pr-stat-label">Notes Added</span></div>'
    + '</div>';

  html += sectionsHtml;
  html += '<div class="pr-footer"><span>Lowder-Tascarella Hospitality</span><span>Generated ' + dateLabel + '</span></div>';

  var printEl = document.getElementById('print-view');
  printEl.innerHTML = html;

  // Force browser to decode images & layout before printing
  void printEl.offsetHeight;
  setTimeout(function() { window.print(); }, 300);
}

// ============================================================
// ANALYTICS VIEW
// ============================================================
function renderAnalyticsView() {
  const all = state.projects;

  // ── Summary stats ─────────────────────────────────────────
  const total     = all.length;
  const completed = all.filter(p => p.complete).length;
  const active    = all.filter(p => !p.complete).length;
  const overdue   = all.filter(p => {
    if (p.complete) return false;
    const d = daysUntil(dueDate(p));
    return d !== null && d < 0;
  }).length;
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;

  document.getElementById('an-total').textContent   = total;
  document.getElementById('an-active').textContent  = active;
  document.getElementById('an-overdue').textContent = overdue;
  document.getElementById('an-rate').textContent    = rate + '%';

  // ── Destroy previous chart instances ──────────────────────
  if (window._analyticsCharts) {
    Object.values(window._analyticsCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  }
  window._analyticsCharts = {};

  const chartDefaults = {
    font: { family: "'Instrument Sans', sans-serif", size: 12 },
    color: '#6b6055',
  };
  Chart.defaults.font.family = chartDefaults.font.family;
  Chart.defaults.font.size   = chartDefaults.font.size;
  Chart.defaults.color       = chartDefaults.color;

  // ── Chart 1: Health by Restaurant ─────────────────────────
  const restaurants = state.restaurants;
  const healthData = restaurants.map(r => {
    const rp        = all.filter(p => p.restaurant === r);
    const rComplete = rp.filter(p => p.complete).length;
    const rOverdue  = rp.filter(p => {
      if (p.complete) return false;
      const d = daysUntil(dueDate(p));
      return d !== null && d < 0;
    }).length;
    const rActive   = Math.max(0, rp.filter(p => !p.complete).length - rOverdue);
    return { active: rActive, overdue: rOverdue, completed: rComplete };
  });

  window._analyticsCharts.health = new Chart(
    document.getElementById('chart-health').getContext('2d'), {
    type: 'bar',
    data: {
      labels: restaurants,
      datasets: [
        { label: 'Active',    data: healthData.map(d => d.active),    backgroundColor: '#4a7c9e' },
        { label: 'Overdue',   data: healthData.map(d => d.overdue),   backgroundColor: '#c0392b' },
        { label: 'Completed', data: healthData.map(d => d.completed), backgroundColor: '#4a7c59' },
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: {
          stacked: false,
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            callback: function(value) {
              var label = this.getLabelForValue(value);
              return label.length > 12 ? label.substring(0, 11) + '...' : label;
            }
          }
        },
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });

  // ── Chart 2: Completions over past 6 months ───────────────
  const now    = new Date();
  const months = [];
  const byMonth = {};
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    months.push(key);
    byMonth[key] = 0;
  }
  all.filter(p => p.complete && p.updatedAt).forEach(p => {
    const key = new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (key in byMonth) byMonth[key]++;
  });

  window._analyticsCharts.completions = new Chart(
    document.getElementById('chart-completions').getContext('2d'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Completed',
        data: months.map(m => byMonth[m]),
        borderColor: '#4a7c59',
        backgroundColor: 'rgba(74,124,89,0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });

  // ── Chart 3: Projects by Owner (horizontal stacked bar) ───
  const ownerMap = {};
  all.forEach(p => {
    const o = p.owner || 'Unassigned';
    if (!ownerMap[o]) ownerMap[o] = { active: 0, completed: 0 };
    if (p.complete) ownerMap[o].completed++;
    else            ownerMap[o].active++;
  });
  const ownersSorted = Object.entries(ownerMap)
    .sort((a, b) => (b[1].active + b[1].completed) - (a[1].active + a[1].completed));

  window._analyticsCharts.owners = new Chart(
    document.getElementById('chart-owners').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ownersSorted.map(e => e[0]),
      datasets: [
        { label: 'Active',    data: ownersSorted.map(e => e[1].active),    backgroundColor: '#4a7c9e' },
        { label: 'Completed', data: ownersSorted.map(e => e[1].completed), backgroundColor: '#4a7c59' },
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, y: { stacked: true } }
    }
  });

  // ── Chart 4: Active Projects by Category (doughnut) ───────
  const catMap = {};
  all.filter(p => !p.complete).forEach(p => {
    const c = p.category || 'Uncategorized';
    catMap[c] = (catMap[c] || 0) + 1;
  });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const palette    = ['#4a7c9e','#8b3a1e','#4a7c59','#c0892b','#7a4a9e','#6b6055','#2c7a7a','#9e4a6b'];

  window._analyticsCharts.categories = new Chart(
    document.getElementById('chart-categories').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: catEntries.map(e => e[0]),
      datasets: [{
        data: catEntries.map(e => e[1]),
        backgroundColor: palette.slice(0, catEntries.length),
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'right' } }
    }
  });

  // ── Chart 5: Visit Tracking — current quarter (grouped bar) ──
  const curQ = getCurrentQuarterLabel();
  const qStats = travelState.quarterlyStats || {};
  const visitRestaurants = state.restaurants.filter(r => qStats[r]);
  const visitCanvas = document.getElementById('chart-visits');
  if (visitCanvas && visitRestaurants.length > 0) {
    window._analyticsCharts.visits = new Chart(
      visitCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: visitRestaurants,
        datasets: [
          { label: 'Days On-Site', data: visitRestaurants.map(r => (qStats[r][curQ] || {}).days || 0), backgroundColor: '#4a7c9e' },
          { label: 'Trips',        data: visitRestaurants.map(r => (qStats[r][curQ] || {}).trips || 0), backgroundColor: '#c0892b' },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: curQ } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  } else if (visitCanvas) {
    // No visit data — show placeholder text
    const ctx = visitCanvas.getContext('2d');
    ctx.font = "13px 'Instrument Sans', sans-serif";
    ctx.fillStyle = '#8C8278';
    ctx.textAlign = 'center';
    ctx.fillText('No visits logged this quarter', visitCanvas.width / 2, visitCanvas.height / 2);
  }
}


// ============================================================
// RESTAURANT MODAL
// ============================================================
function openRestaurantModal() {
  renderRestaurantChips();
  document.getElementById('restaurant-modal').classList.add('open');
}
function closeRestaurantModal() {
  document.getElementById('restaurant-modal').classList.remove('open');
  renderTabs();
}
function renderRestaurantChips() {
  document.getElementById('restaurant-chips').innerHTML = state.restaurants.map(r =>
    `<div class="restaurant-chip">${r}<span class="remove-chip" onclick="removeRestaurant('${r}')">×</span></div>`
  ).join('');
}
async function addRestaurant() {
  const name = document.getElementById('new-restaurant-name').value.trim();
  if (!name) return;
  if (!state.restaurants.includes(name)) {
    await dbAddLookup('restaurants', name);
    state.restaurants.push(name);
  }
  document.getElementById('new-restaurant-name').value = '';
  renderRestaurantChips();
}
async function removeRestaurant(name) {
  if (state.projects.some(p => p.restaurant === name)) {
    alert(`Cannot remove "${name}" "" it has existing projects.`);
    return;
  }
  await dbDeleteLookup('restaurants', name);
  state.restaurants = state.restaurants.filter(r => r !== name);
  if (state.activeTab === name) state.activeTab = 'all';
  renderRestaurantChips();
}


// ============================================================
// GANTT VIEW
// ============================================================
const GANTT_COLORS = ['#7B3F2E','#3A5C6B','#5C4A2E','#3B5241','#4A3A6B','#6B4A2E','#2E4A5C','#5C3A4A'];

function renderGanttView() {
  const el          = document.getElementById('gantt-content');
  const windowDays  = state.gantt.windowDays;
  const groupBy     = state.gantt.groupBy;
  const showComplete= state.gantt.showComplete;

  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);
  const endDate = new Date(todayDate);
  endDate.setDate(endDate.getDate() + windowDays);

  const days = [];
  for (let d = new Date(todayDate); d <= endDate; d.setDate(d.getDate()+1)) days.push(new Date(d));

  const ganttBase = state.session && state.session.role === 'restaurant'
    ? state.projects.filter(p => !p.openingId && p.restaurant === state.session.restaurant)
    : state.projects.filter(p => !p.openingId);
  let projects = ganttBase.filter(p => {
    if (!p.dateAdded) return false;
    const due = getDueDate(p);
    if (!due) return false;
    if (!showComplete && p.complete) return false;
    return true;
  });

  let groups = {};
  if (groupBy === 'restaurant') {
    state.restaurants.forEach(r => { groups[r] = []; });
    projects.forEach(p => { if (!groups[p.restaurant]) groups[p.restaurant] = []; groups[p.restaurant].push(p); });
  } else if (groupBy === 'priority') {
    ['High','Medium','Low'].forEach(pri => { groups[pri] = []; });
    projects.forEach(p => { const k = p.priority || 'Low'; if (!groups[k]) groups[k] = []; groups[k].push(p); });
  } else {
    state.categories.forEach(c => { groups[c] = []; });
    projects.forEach(p => { const k = p.category || '""'; if (!groups[k]) groups[k] = []; groups[k].push(p); });
  }

  const DAY_W = 28;
  const monthHeaders = [];
  let curMonth = null;
  let curSpan  = 0;
  days.forEach(d => {
    const m = d.toLocaleDateString('en-US',{month:'short',year:'numeric'});
    if (m !== curMonth) {
      if (curMonth) monthHeaders.push({ label: curMonth, span: curSpan });
      curMonth = m; curSpan = 1;
    } else { curSpan++; }
  });
  if (curMonth) monthHeaders.push({ label: curMonth, span: curSpan });

  const monthRow  = monthHeaders.map(m => `<th colspan="${m.span}" style="text-align:left;padding-left:8px">${m.label}</th>`).join('');
  const dayRow    = days.map(d => {
    const isToday   = d.toISOString().split('T')[0] === todayDate.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    return `<th class="gantt-day-cell ${isToday?'today-col':''} ${isWeekend?'weekend':''}" style="min-width:${DAY_W}px">${d.getDate()}</th>`;
  }).join('');

  let tableRows = '';
  const orderedProjects = [];

  Object.entries(groups).forEach(([groupName, ps]) => {
    if (!ps.length) return;
    tableRows += `<tr class="gantt-group-row"><td colspan="${days.length + 1}">${groupName}</td></tr>`;
    ps.sort((a,b) => {
      if (a.complete !== b.complete) return a.complete ? 1 : -1;
      const da = getDueDate(a), db = getDueDate(b);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return da - db;
    });
    ps.forEach(p => {
      const due    = getDueDate(p);
      const dueStr = due ? due.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '""';
      const isOverdue = due && due < todayDate && !p.complete;
      tableRows += `<tr class="gantt-row" data-id="${p.id}" onclick="openDetail('${p.id}')" style="cursor:pointer">
        <td class="gantt-label-cell ${p.complete?'complete':''}">
          <div class="gantt-label-name" title="${p.title}">${p.title}</div>
          <div class="gantt-label-meta">${p.restaurant} · ${dueStr}</div>
        </td>
        ${days.map(d => {
          const isToday   = d.toISOString().split('T')[0] === todayDate.toISOString().split('T')[0];
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return `<td class="gantt-bar-cell gantt-day-cell ${isToday?'today-col':''} ${isWeekend?'weekend':''}"></td>`;
        }).join('')}
      </tr>`;
      orderedProjects.push(p);
    });
  });

  el.innerHTML = `
    <table class="gantt-table" id="gantt-table">
      <thead>
        <tr class="gantt-header-row"><th class="label-col"></th>${monthRow}</tr>
        <tr class="gantt-header-row"><th class="label-col">Project</th>${dayRow}</tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  // Draw bars
  const rows = document.querySelectorAll('#gantt-table .gantt-row');
  rows.forEach((row, i) => {
    const p = orderedProjects[i];
    if (!p) return;
    const due = getDueDate(p);
    if (!due) return;

    const start    = new Date(p.dateAdded + 'T00:00:00');
    const barStart = start < todayDate ? todayDate : start;
    const barEnd   = due > endDate ? endDate : due;
    if (barStart > barEnd) return;

    const startOffset = Math.round((barStart - todayDate) / 86400000);
    const barDays     = Math.round((barEnd   - barStart)  / 86400000) + 1;
    const labelCell   = row.querySelector('.gantt-label-cell');
    const labelWidth  = labelCell ? labelCell.offsetWidth : 220;
    const leftPx      = startOffset * DAY_W + 1;
    const widthPx     = Math.max(barDays * DAY_W - 2, 6);

    const rIdx     = state.restaurants.indexOf(p.restaurant);
    const barColor = GANTT_COLORS[rIdx >= 0 ? rIdx % 8 : 0];
    const isOverdue= due < todayDate && !p.complete;
    const dueStr   = due.toLocaleDateString('en-US',{month:'short',day:'numeric'});

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;bottom:0;left:0;right:0;pointer-events:none;';

    const bar = document.createElement('div');
    bar.className = `gantt-bar ${p.complete?'complete':''} ${isOverdue?'overdue':''}`;
    bar.style.cssText = `left:${labelWidth + leftPx}px;width:${widthPx}px;background:${barColor};`;
    bar.title = `${p.title} "" Due: ${dueStr}${p.complete?' (Complete)':isOverdue?' (OVERDUE)':''}`;
    bar.innerHTML = widthPx > 50 ? `<span class="gantt-bar-label">${dueStr}</span>` : '';
    bar.style.pointerEvents = 'auto';
    overlay.appendChild(bar);
    row.style.position = 'relative';
    row.appendChild(overlay);
  });

  // Today line
  const wrap  = document.getElementById('gantt-scroll-wrap');
  const table = document.getElementById('gantt-table');
  if (wrap && table) {
    const labelCell = table.querySelector('.gantt-label-cell');
    const labelW    = labelCell ? labelCell.offsetWidth : 220;
    const todayLine = document.createElement('div');
    todayLine.className      = 'gantt-today-line';
    todayLine.style.left     = (labelW + 1) + 'px';
    todayLine.style.position = 'absolute';
    todayLine.style.top      = '0';
    todayLine.style.bottom   = '0';
    todayLine.style.width    = '2px';
    wrap.style.position = 'relative';
    wrap.appendChild(todayLine);
  }

  renderGanttLegend();
}

function renderGanttLegend() {
  const el = document.getElementById('gantt-legend');
  if (!el) return;
  const used = [...new Set(state.projects.map(p => p.restaurant))];
  el.innerHTML = used.map(r => {
    const idx   = state.restaurants.indexOf(r);
    const color = GANTT_COLORS[idx >= 0 ? idx % 8 : 0];
    return `<div class="gantt-legend-item"><div class="gantt-legend-dot" style="background:${color}"></div>${r}</div>`;
  }).join('') +
  `<div class="gantt-legend-item" style="margin-left:16px"><div class="gantt-legend-dot" style="background:var(--rust);border-radius:50%"></div>Today</div>` +
  `<div class="gantt-legend-item"><div class="gantt-legend-dot" style="background:#ccc"></div>Overdue (red outline)</div>`;
}

function getDueDate(p) {
  if (p.dueDate) return new Date(p.dueDate + 'T00:00:00');
  if (!p.dateAdded || !p.weeks) return null;
  const d = new Date(p.dateAdded + 'T00:00:00');
  d.setDate(d.getDate() + (p.weeks * 7));
  return d;
}

function setGanttWindow(days) {
  state.gantt.windowDays = days;
  renderGanttView();
}
function setGanttGroup(val) {
  state.gantt.groupBy = val;
  renderGanttView();
}

// ============================================================
// RECENT VIEW
// ============================================================
function renderRecentView() {
  var projectsEl = document.getElementById("projects-view");
  var filterBar  = document.querySelector(".filter-bar-header");
  var filterContent = document.getElementById("filter-content");
  var pageHeader = document.querySelector(".page-header");
  var adminEl    = document.getElementById("admin-view");
  var ganttEl    = document.getElementById("gantt-view");
  var recentEl   = document.getElementById("recent-view");

  projectsEl.style.display = "none";
  if (filterBar)     filterBar.style.display     = "none";
  if (filterContent) filterContent.style.display = "none";
  if (pageHeader)    pageHeader.style.display    = "none";
  adminEl.style.display  = "none";
  ganttEl.style.display  = "none";
  recentEl.style.display = "block";

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  cutoff.setHours(0, 0, 0, 0);

  var ownRest = state.session && state.session.role === 'restaurant' ? state.session.restaurant : null;
  var recent = state.projects.filter(function(p) {
    if (!p.complete) return false;
    if (!p.updatedAt) return false;
    if (ownRest && p.restaurant !== ownRest) return false;
    return new Date(p.updatedAt) >= cutoff;
  });

  var titleStyle = "font-family:'DM Sans',sans-serif;font-size:22px;font-weight:500;color:var(--text-primary);margin-bottom:4px";
  var subtitleStyle = "font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text-secondary);margin-bottom:24px;font-variant-numeric:tabular-nums";

  if (recent.length === 0) {
    recentEl.innerHTML =
      "<h2 style=\"" + titleStyle + "\">Recently Completed</h2>" +
      "<div class=\"empty-state\" style=\"padding:40px 0\">" +
        "<h3>No completions in the last 14 days</h3>" +
        "<p>Projects marked complete will appear here for two weeks.</p>" +
      "</div>";
    return;
  }

  var grouped = {};
  recent.forEach(function(p) {
    if (!grouped[p.restaurant]) grouped[p.restaurant] = [];
    grouped[p.restaurant].push(p);
  });

  var thStyle = "font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-secondary);padding:10px 14px;text-align:left;border-bottom:1px solid var(--border);background:var(--surface-sunken)";

  var out =
    "<h2 style=\"" + titleStyle + "\">Recently Completed</h2>" +
    "<p style=\"" + subtitleStyle + "\">Projects completed in the last 14 days &middot; " + recent.length + " total</p>";

  Object.entries(grouped).forEach(function(entry) {
    var restaurant = entry[0];
    var projects   = entry[1];
    var colorIdx   = state.restaurants.indexOf(restaurant) % 8;

    var rows = "";
    projects.forEach(function(p) {
      var latestNote  = (p.notes && p.notes.length > 0) ? p.notes[p.notes.length - 1].text : "&mdash;";
      var completedOn = p.updatedAt ? formatDate(p.updatedAt.split("T")[0]) : "&mdash;";
      var desc = p.description
        ? "<span style=\"display:block;font-family:'Source Serif 4',Georgia,serif;font-size:13px;color:var(--text-secondary);margin-top:3px;line-height:1.5\">" + p.description + "</span>"
        : "";
      rows +=
        "<tr style=\"border-bottom:1px solid var(--border);cursor:pointer\" onclick=\"openDetail('" + p.id + "')\">" +
          "<td style=\"padding:12px 14px\">" +
            "<span style=\"font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;color:var(--text-primary);opacity:0.55;text-decoration:line-through\">" + p.title + "</span>" +
            desc +
          "</td>" +
          "<td style=\"padding:12px 14px\"><span class=\"category-tag " + categoryClass(p.category) + "\">" + (p.category || "&mdash;") + "</span></td>" +
          "<td style=\"padding:12px 14px;font-size:13px;color:var(--text-secondary)\">" + (p.owner || "&mdash;") + "</td>" +
          "<td style=\"padding:12px 14px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:var(--green);font-variant-numeric:tabular-nums\">" + completedOn + "</td>" +
          "<td style=\"padding:12px 14px\"><div class=\"update-preview\">" + latestNote + "</div></td>" +
        "</tr>";
    });

    out +=
      "<div style=\"margin-bottom:24px\">" +
        "<div style=\"display:flex;align-items:center;gap:12px;margin-bottom:8px\">" +
          "<span class=\"restaurant-pill\" data-r=\"" + colorIdx + "\">" + restaurant + "</span>" +
          "<span style=\"font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:var(--text-secondary);letter-spacing:0.04em;font-variant-numeric:tabular-nums\">" + projects.length + " project" + (projects.length !== 1 ? "s" : "") + "</span>" +
        "</div>" +
        "<table style=\"width:100%;border-collapse:collapse;background:var(--card-bg);border:1px solid var(--border);font-variant-numeric:tabular-nums\">" +
          "<thead><tr>" +
            "<th style=\"" + thStyle + "\">Project</th>" +
            "<th style=\"" + thStyle + "\">Category</th>" +
            "<th style=\"" + thStyle + "\">Owner</th>" +
            "<th style=\"" + thStyle + "\">Completed</th>" +
            "<th style=\"" + thStyle + "\">Latest Note</th>" +
          "</tr></thead>" +
          "<tbody>" + rows + "</tbody>" +
        "</table>" +
      "</div>";
  });

  recentEl.innerHTML = out;
}


async function loadRestaurantMap() {
  const { data } = await db.from('restaurants').select('id,name').eq('workspace_id', state.workspace_id);
  travelState.restaurantMap = {};
  (data || []).forEach(r => { travelState.restaurantMap[r.name] = r.id; });
}

