// ============================================================
// SUMMARY BAR
// ============================================================
function renderSummary() {
  const ownRest = state.session && state.session.role === 'restaurant' ? state.session.restaurant : null;
  const baseProjects = state.projects.filter(p => !p.archived && !p.openingId && (!ownRest || p.restaurant === ownRest));
  const open    = baseProjects.filter(p => !p.complete);
  const overdue = open.filter(p => { const d = daysUntil(dueDate(p)); return d !== null && d < 0; }).length;
  const soon    = open.filter(p => { const d = daysUntil(dueDate(p)); return d !== null && d >= 0 && d <= 7; }).length;
  const complete= baseProjects.filter(p => p.complete).length;
  const high    = open.filter(p => p.priority === 'High').length;

  document.getElementById('summary-bar').innerHTML = `
    <div class="summary-stat"><span class="label">Open Tasks</span><span class="value">${open.length}</span></div>
    <div class="divider"></div>
    <div class="summary-stat clickable" onclick="filterFromSummary('overdue')" title="Click to filter overdue tasks"><span class="label">Overdue</span><span class="value red">${overdue}</span></div>
    <div class="summary-stat clickable" onclick="filterFromSummary('due7')" title="Click to filter tasks due within 7 days"><span class="label">Due ≤ 7 days</span><span class="value orange">${soon}</span></div>
    <div class="divider"></div>
    <div class="summary-stat clickable" onclick="filterFromSummary('high')" title="Click to filter high priority tasks"><span class="label">High Priority</span><span class="value">${high}</span></div>
    <div class="divider"></div>
    <div class="summary-stat"><span class="label">Complete</span><span class="value green">${complete}</span></div>
  `;
}

// ============================================================
// TABS
// ============================================================
function renderTabs() {
  const wrapper = document.getElementById('tabs-wrapper');
  const tabs = ['all', ...state.restaurants];
  const restaurantTabs = tabs.map(t => {
    const isAll  = t === 'all';
    const label  = isAll ? 'All Restaurants' : t;
    const count  = isAll
      ? state.projects.filter(p => !p.complete).length
      : state.projects.filter(p => p.restaurant === t && !p.complete).length;
    return `<button class="tab ${state.activeTab === t ? 'active' : ''}" onclick="switchTab('${t}')">
      ${label} <span class="badge">${count}</span>
    </button>`;
  }).join('');

  const ganttTab = `<button class="tab ${state.activeTab === '__gantt__' ? 'active' : ''}" onclick="switchTab('__gantt__')">
    &#9638; Gantt
  </button>`;
  const recentTab = `<button class="tab ${state.activeTab === '__recent__' ? 'active' : ''}" onclick="switchTab('__recent__')">
    &#128197; Recent
  </button>`;
  const isAdmin = state.session && state.session.role === 'admin';
  const adminInboxTab = isAdmin ? `<button class="tab ${state.activeTab === '__admin_inbox__' ? 'active' : ''}" onclick="switchTab('__admin_inbox__')">&#128235; Inbox${state.adminInboxUnread > 0 ? ` <span class="badge" style="background:var(--rust);color:white">${state.adminInboxUnread}</span>` : ''}</button>` : '';
  const analyticsTab = isAdmin ? `<button class="tab ${state.activeTab === '__analytics__' ? 'active' : ''}" onclick="switchTab('__analytics__')">&#128200; Analytics</button>` : '';
  const adminTab = isAdmin ? `<button class="tab ${state.activeTab === '__admin__' ? 'active' : ''}" onclick="switchTab('__admin__')" style="margin-left:auto">&#9881; Admin</button>` : '';

  // For restaurant role: only show their own restaurant tab
  var visibleRestaurantTabs = restaurantTabs;
  if (state.session && state.session.role === 'restaurant') {
    const myRest = state.session.restaurant;
    const tabs2 = ['all', myRest];
    visibleRestaurantTabs = tabs2.map(t => {
      const isAll2 = t === 'all';
      const label2 = isAll2 ? 'All Tasks' : t;
      const count2 = state.projects.filter(p => p.restaurant === myRest && !p.complete).length;
      const cnt = isAll2 ? count2 : count2;
      return `<button class="tab ${state.activeTab === t ? 'active' : ''}" onclick="switchTab('${t}')">${label2} <span class="badge">${cnt}</span></button>`;
    }).join('');
  }

  const travelTab = `<button class="tab ${state.activeTab === '__travel__' ? 'active' : ''}" onclick="switchTab('__travel__')">&#9992; Travel</button>`;
  const openingsTab = isAdmin && state.openings.length > 0 ? `<button class="tab ${state.activeTab === '__openings__' ? 'active' : ''}" onclick="switchTab('__openings__')">&#127959; Openings</button>` : '';
  const isRestaurant = state.session && state.session.role === 'restaurant';
  const inboxTab = isRestaurant ? `<button class="tab ${state.activeTab === '__inbox__' ? 'active' : ''}" onclick="switchTab('__inbox__')">&#128235; Submit New Task Request</button>` : '';

  // Restaurant tabs go in primary row
  wrapper.innerHTML = visibleRestaurantTabs;

  // Utility tabs go in secondary row
  const utilityWrapper = document.getElementById('tabs-utility');
  if (utilityWrapper) {
    utilityWrapper.innerHTML = (isAdmin ? adminInboxTab : '') + (isAdmin ? openingsTab : '') + ganttTab + recentTab + (isAdmin ? travelTab : '') + (isAdmin ? analyticsTab : '') + inboxTab + (isAdmin ? adminTab : '');
  }

  // Also update mobile nav drawer
  renderMobileNav();
  // Update scroll fade indicators after DOM settles
  requestAnimationFrame(updateTabScrollIndicators);
}

// ============================================================
// MOBILE NAV DRAWER
// ============================================================
function renderMobileNav() {
  const container = document.getElementById('mobile-nav-content');
  if (!container) return;

  const isAdmin = state.session && state.session.role === 'admin';
  const isRestaurant = state.session && state.session.role === 'restaurant';
  let html = '';

  // Restaurant tabs section
  html += '<div class="mobile-nav-section">';
  html += '<div class="mobile-nav-section-label">Restaurants</div>';

  if (isRestaurant) {
    const myRest = state.session.restaurant;
    const count = state.projects.filter(p => p.restaurant === myRest && !p.complete).length;
    html += `<button class="mobile-nav-item ${state.activeTab === 'all' ? 'active' : ''}" onclick="switchTab('all');closeMobileNav()">All Tasks <span class="badge">${count}</span></button>`;
    html += `<button class="mobile-nav-item ${state.activeTab === myRest ? 'active' : ''}" onclick="switchTab('${myRest}');closeMobileNav()">${myRest} <span class="badge">${count}</span></button>`;
  } else {
    const allCount = state.projects.filter(p => !p.complete).length;
    html += `<button class="mobile-nav-item ${state.activeTab === 'all' ? 'active' : ''}" onclick="switchTab('all');closeMobileNav()">All Restaurants <span class="badge">${allCount}</span></button>`;
    state.restaurants.forEach(r => {
      const cnt = state.projects.filter(p => p.restaurant === r && !p.complete).length;
      html += `<button class="mobile-nav-item ${state.activeTab === r ? 'active' : ''}" onclick="switchTab('${r.replace(/'/g, "\\'")}');closeMobileNav()">${r} <span class="badge">${cnt}</span></button>`;
    });
  }
  html += '</div>';

  // Views section
  html += '<div class="mobile-nav-section">';
  html += '<div class="mobile-nav-section-label">Views</div>';
  if (isAdmin) {
    html += `<button class="mobile-nav-item ${state.activeTab === '__admin_inbox__' ? 'active' : ''}" onclick="switchTab('__admin_inbox__');closeMobileNav()">&#128235; Inbox${state.adminInboxUnread > 0 ? ' <span class="badge" style="background:var(--rust);color:white">' + state.adminInboxUnread + '</span>' : ''}</button>`;
  }
  html += `<button class="mobile-nav-item ${state.activeTab === '__gantt__' ? 'active' : ''}" onclick="switchTab('__gantt__');closeMobileNav()">&#9638; Gantt</button>`;
  html += `<button class="mobile-nav-item ${state.activeTab === '__recent__' ? 'active' : ''}" onclick="switchTab('__recent__');closeMobileNav()">&#128197; Recent</button>`;
  if (isAdmin) {
    if (state.openings.length > 0) html += `<button class="mobile-nav-item ${state.activeTab === '__openings__' ? 'active' : ''}" onclick="switchTab('__openings__');closeMobileNav()">&#127959; Openings</button>`;
    html += `<button class="mobile-nav-item ${state.activeTab === '__travel__' ? 'active' : ''}" onclick="switchTab('__travel__');closeMobileNav()">&#9992; Travel</button>`;
    html += `<button class="mobile-nav-item ${state.activeTab === '__analytics__' ? 'active' : ''}" onclick="switchTab('__analytics__');closeMobileNav()">&#128200; Analytics</button>`;
    html += `<button class="mobile-nav-item ${state.activeTab === '__admin__' ? 'active' : ''}" onclick="switchTab('__admin__');closeMobileNav()">&#9881; Admin</button>`;
  }
  if (isRestaurant) {
    html += `<button class="mobile-nav-item ${state.activeTab === '__inbox__' ? 'active' : ''}" onclick="switchTab('__inbox__');closeMobileNav()">&#128235; Submit New Task Request</button>`;
  }
  html += '</div>';

  container.innerHTML = html;
}

// ============================================================
// TAB SCROLL FADE INDICATORS
// ============================================================
function updateTabScrollIndicators() {
  const wrapper = document.getElementById('tabs-wrapper');
  const container = document.querySelector('.tabs-container');
  if (!wrapper || !container) return;
  const scrollLeft = wrapper.scrollLeft;
  const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
  container.classList.toggle('scroll-left', scrollLeft > 4);
  container.classList.toggle('scroll-right', scrollLeft < maxScroll - 4);
}
(function initTabScroll() {
  const wrapper = document.getElementById('tabs-wrapper');
  if (wrapper) {
    wrapper.addEventListener('scroll', updateTabScrollIndicators, { passive: true });
    // Also check on resize
    window.addEventListener('resize', updateTabScrollIndicators, { passive: true });
  }
})();

function toggleMobileNav() {
  const overlay = document.getElementById('mobile-nav-overlay');
  const drawer = document.getElementById('mobile-nav-drawer');
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    closeMobileNav();
  } else {
    overlay.style.display = 'block';
    // Force reflow for transition
    overlay.offsetHeight;
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileNav() {
  const overlay = document.getElementById('mobile-nav-overlay');
  const drawer = document.getElementById('mobile-nav-drawer');
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { overlay.style.display = 'none'; }, 250);
}

function switchTab(tab) {
  if (tab !== state.activeTab) state.showOverdue = false;
  state.activeTab = tab;
  // Clear pending inbox/agenda flags so a subsequent task save
  // doesn't incorrectly trigger status updates from a prior session
  state.pendingInboxItemId    = null;
  state._pendingAgendaItemId  = null;
  renderTabs();

  const projectsEl    = document.getElementById('projects-view');
  const filterBar     = document.querySelector('.filter-bar-header');
  const filterContent = document.getElementById('filter-content');
  const pageHeader    = document.querySelector('.page-header');
  const adminEl       = document.getElementById('admin-view');
  const ganttEl       = document.getElementById('gantt-view');
  const analyticsEl   = document.getElementById('analytics-view');
  const travelEl      = document.getElementById('travel-view');
  const inboxEl       = document.getElementById('inbox-view');
  const adminInboxEl  = document.getElementById('admin-inbox-view');
  const recentEl      = document.getElementById('recent-view');
  const agendaEl      = document.getElementById('agenda-restaurant-view');
  const openingsEl    = document.getElementById('openings-view');

  projectsEl.style.display = 'none';
  if (filterBar)     filterBar.style.display     = 'none';
  if (filterContent) filterContent.style.display = 'none';
  if (pageHeader)    pageHeader.style.display    = 'none';
  adminEl.style.display = 'none';
  ganttEl.style.display = 'none';
  analyticsEl.style.display = 'none';
  if (recentEl) recentEl.style.display = 'none';
  if (travelEl) travelEl.style.display = 'none';
  if (inboxEl) inboxEl.style.display = 'none';
  if (adminInboxEl) adminInboxEl.style.display = 'none';
  if (agendaEl) agendaEl.style.display = 'none';
  if (openingsEl) openingsEl.style.display = 'none';

  if (tab === '__openings__') {
    if (openingsEl) openingsEl.style.display = 'block';
    renderOpeningsView();
  } else if (tab === '__recent__') {
    renderRecentView();
  } else if (tab === '__admin__') {
    adminEl.style.display = 'block';
    renderAdminView();
  } else if (tab === '__gantt__') {
    ganttEl.style.display = 'block';
    renderGanttView();
  } else if (tab === '__analytics__') {
    analyticsEl.style.display = 'block';
    renderAnalyticsView();
  } else if (tab === '__travel__') {
    if (travelEl) travelEl.style.display = 'block';
    renderTravelView();
  } else if (tab === '__admin_inbox__') {
    if (adminInboxEl) adminInboxEl.style.display = 'block';
    renderAdminInbox('admin-inbox-tab-section');
  } else if (tab === '__inbox__') {
    if (inboxEl) inboxEl.style.display = 'block';
    renderRestaurantInbox();
  } else {
    projectsEl.style.display = '';
    if (filterBar)     filterBar.style.display     = '';
    if (filterContent) filterContent.style.display = '';
    if (pageHeader)    pageHeader.style.display    = '';
    document.getElementById('page-title').textContent = tab === 'all' ? 'All Restaurants' : tab;
    const col = document.getElementById('col-restaurant');
    if (col) col.style.display = tab === 'all' ? '' : 'none';
    renderTable();
    // Show agenda section for admin on a specific restaurant tab
    const isAdmin = state.session && state.session.role === 'admin';
    if (isAdmin && tab !== 'all' && agendaEl) {
      agendaEl.style.display = 'block';
      renderRestaurantAgenda(tab);
    }
  }
}


// ============================================================
// RENDER
// ============================================================
function render() {
  renderSummary();
  renderTabs();
  renderTable();
  renderFilterDropdowns();
  applySessionGating();
  // Re-render openings view if currently active
  if (state.activeTab === '__openings__') {
    renderOpeningsView();
  }
}

function applySessionGating() {
  var isAdmin = state.session && state.session.role === 'admin';
  var btnNew    = document.getElementById('btn-new-project');
  var btnRest   = document.getElementById('btn-add-restaurant');
  var btnReport = document.getElementById('btn-print-report');
  if (btnNew)    btnNew.style.display    = isAdmin ? '' : 'none';
  if (btnRest)   btnRest.style.display   = isAdmin ? '' : 'none';
  if (btnReport) btnReport.style.display = isAdmin ? '' : 'none';
  var btnExport = document.getElementById('btn-export-tasks');
  if (btnExport) btnExport.style.display = (isAdmin || (state.session && state.session.role === 'restaurant')) ? '' : 'none';
  // Overdue badge — respects restaurant role filter, excludes archived
  var visibleProjects = state.session && state.session.role === 'restaurant'
    ? state.projects.filter(function(p){ return !p.archived && !p.openingId && p.restaurant === state.session.restaurant; })
    : state.projects.filter(function(p){ return !p.archived && !p.openingId; });
  var overdueCount = visibleProjects.filter(function(p) {
    if (p.complete) return false;
    var d = daysUntil(dueDate(p));
    return d !== null && d < 0;
  }).length;
  var badge = document.getElementById('overdue-badge');
  if (badge) {
    badge.textContent = overdueCount + ' overdue';
    badge.style.display = overdueCount > 0 ? '' : 'none';
  }
}

function renderFilterDropdowns() {
  const catSel   = document.getElementById('filter-category');
  const curCat   = catSel.value;
  catSel.innerHTML = '<option value="">All</option>' +
    state.categories.map(c => `<option value="${c}" ${c === curCat ? 'selected' : ''}>${c}</option>`).join('');

  const ownerSel  = document.getElementById('filter-owner');
  const curOwner  = ownerSel.value;
  const usedOwners= [...new Set(state.projects.map(p => p.owner).filter(Boolean))].sort();
  ownerSel.innerHTML = '<option value="">All</option>' +
    usedOwners.map(o => `<option value="${o}" ${o === curOwner ? 'selected' : ''}>${o}</option>`).join('');
}

// ============================================================

// ============================================================
// INIT
// ============================================================
async function init() {
  document.getElementById('today-display').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  await initApp();
}

init();
