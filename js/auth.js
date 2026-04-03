// ============================================================
// AUTH / LOGIN
// ============================================================
function updateHeaderTitle() {
  var el = document.getElementById('header-title');
  if (!el || !state.workspace_name) return;
  el.innerHTML = state.workspace_name + ' \u2014 <em>Project Dashboard</em>';
}

async function initApp() {
  // Copy logo from header into login screen
  var headerLogo = document.querySelector('.header-logos img');
  if (headerLogo) document.getElementById('login-logo').src = headerLogo.src;

  // Load workspaces and restaurants for login dropdown
  var { data: wsData } = await db.from('workspaces').select('*').order('name');
  var { data: restData } = await db.from('restaurants').select('name, workspace_id').order('sort_order');
  state.workspaces = wsData || [];

  var loginSel = document.getElementById('login-who');
  // Clear existing options except the first placeholder
  while (loginSel.options.length > 1) loginSel.remove(1);

  (wsData || []).forEach(function(ws) {
    if (ws.type === 'client') {
      // Admin option for client workspaces
      var adminOpt = document.createElement('option');
      adminOpt.value = ws.slug + '__admin__';
      adminOpt.textContent = ws.name + ' (Admin)';
      adminOpt.dataset.workspaceId = ws.id;
      adminOpt.dataset.workspaceSlug = ws.slug;
      adminOpt.dataset.workspaceName = ws.name;
      adminOpt.dataset.role = 'admin';
      adminOpt.dataset.restaurant = '';
      loginSel.appendChild(adminOpt);

      // Restaurant options for this workspace
      var wsRestaurants = (restData || []).filter(function(r) { return r.workspace_id === ws.id; });
      wsRestaurants.forEach(function(r) {
        var opt = document.createElement('option');
        opt.value = ws.slug + '__' + r.name;
        opt.textContent = ws.name + ' \u2014 ' + r.name;
        opt.dataset.workspaceId = ws.id;
        opt.dataset.workspaceSlug = ws.slug;
        opt.dataset.workspaceName = ws.name;
        opt.dataset.role = 'restaurant';
        opt.dataset.restaurant = r.name;
        loginSel.appendChild(opt);
      });
    } else if (ws.type === 'personal') {
      // Personal workspace — single option
      var opt = document.createElement('option');
      opt.value = ws.slug + '__personal__';
      opt.textContent = ws.name;
      opt.dataset.workspaceId = ws.id;
      opt.dataset.workspaceSlug = ws.slug;
      opt.dataset.workspaceName = ws.name;
      opt.dataset.role = 'admin';
      opt.dataset.restaurant = '';
      loginSel.appendChild(opt);
    }
  });

  // Check for existing session
  var saved = sessionStorage.getItem('sc_session');
  if (saved) {
    try {
      state.session = JSON.parse(saved);
      // Reject stale sessions that lack workspace_id
      if (!state.session.workspace_id) throw new Error('missing workspace');
      state.workspace_id = state.session.workspace_id;
      state.workspace_name = state.session.workspace_name;
      state.workspace_slug = state.session.workspace_slug;
      document.body.classList.add('workspace-' + state.workspace_slug);
      updateHeaderTitle();
      await loadAll();
      render();
      document.body.classList.add('logged-in');
      return;
    } catch(e) {
      sessionStorage.removeItem('sc_session');
      state.session = null;
    }
  }

  // No session — show login screen
  document.getElementById('login-screen').style.display = 'flex';
}

async function attemptLogin() {
  var selEl = document.getElementById('login-who');
  var who = selEl.value;
  var pwd = document.getElementById('login-password').value.trim();
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!who) { errEl.textContent = 'Please select a workspace.'; errEl.style.display = ''; return; }
  if (!pwd) { errEl.textContent = 'Please enter a password.'; errEl.style.display = ''; return; }

  var selected = selEl.options[selEl.selectedIndex];
  var workspaceId = selected.dataset.workspaceId;
  var workspaceSlug = selected.dataset.workspaceSlug;
  var workspaceName = selected.dataset.workspaceName;
  var role = selected.dataset.role;
  var restaurant = selected.dataset.restaurant || null;

  var authenticated = false;

  if (role === 'admin' && workspaceSlug === 'sc-culinary') {
    // SC Culinary admin — check admin_password
    var { data: setting } = await db.from('app_settings').select('value').eq('key', 'admin_password').single();
    if (setting && setting.value === pwd) authenticated = true;
  } else if (role === 'restaurant') {
    // Restaurant user — check restaurant password
    var { data: rest } = await db.from('restaurants').select('password').eq('name', restaurant).single();
    if (rest && rest.password === pwd) authenticated = true;
  } else if (workspaceSlug === 'brandon') {
    // Brandon personal workspace
    var { data: setting } = await db.from('app_settings').select('value').eq('key', 'workspace_password_brandon').single();
    if (setting && setting.value === pwd) authenticated = true;
  }

  if (!authenticated) {
    errEl.textContent = 'Incorrect password. Please try again.';
    errEl.style.display = '';
    document.getElementById('login-password').value = '';
    return;
  }

  state.session = {
    role: role,
    restaurant: restaurant,
    workspace_id: workspaceId,
    workspace_name: workspaceName,
    workspace_slug: workspaceSlug
  };
  state.workspace_id = workspaceId;
  state.workspace_name = workspaceName;
  state.workspace_slug = workspaceSlug;
  sessionStorage.setItem('sc_session', JSON.stringify(state.session));

  document.body.classList.add('workspace-' + workspaceSlug);
  updateHeaderTitle();

  showLoading('Loading data\u2026');
  await loadAll();
  hideLoading();
  render();

  document.getElementById('login-screen').style.display = 'none';
  document.body.classList.add('logged-in');
}

function logout() {
  sessionStorage.removeItem('sc_session');
  if (state.workspace_slug) document.body.classList.remove('workspace-' + state.workspace_slug);
  state.session = null;
  state.workspace_id = null;
  state.workspace_name = null;
  state.workspace_slug = null;
  // Clear data arrays to prevent stale data from flashing on next login
  state.restaurants = [];
  state.projects = [];
  state.categories = [];
  state.types = [];
  state.owners = [];
  state.openings = [];
  state.inboxRequests = [];
  state.agendaItems = [];
  state.adminInboxUnread = 0;
  render();
  document.body.classList.remove('logged-in');
  var headerEl = document.getElementById('header-title');
  if (headerEl) headerEl.innerHTML = 'LT Hospitality \u2014 <em>Project Dashboard</em>';
  document.getElementById('login-password').value = '';
  document.getElementById('login-who').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

