// ============================================================
// AUTH / LOGIN
// ============================================================
function updateHeaderTitle() {
  var el = document.getElementById('header-title');
  if (!el || !state.workspace_name) return;
  el.innerHTML = state.workspace_name + ' \u2014 <em>Project Dashboard</em>';
}

async function initApp() {
  // Check for saved session FIRST (synchronous) — before any async work
  var saved = sessionStorage.getItem('sc_session');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      if (!parsed.workspace_id) throw new Error('missing workspace');
      // Immediately show opaque loading screen to hide any stale DOM
      var loadEl = document.getElementById('loading-overlay');
      if (!loadEl) {
        loadEl = document.createElement('div');
        loadEl.id = 'loading-overlay';
        document.body.appendChild(loadEl);
      }
      loadEl.textContent = 'Loading data\u2026';
      loadEl.style.cssText = 'position:fixed;inset:0;background:#1C1915;display:flex;align-items:center;justify-content:center;z-index:10000;font-family:"DM Mono",monospace;color:#F7F3EE;font-size:14px;letter-spacing:0.1em;';
      // Set state from session
      state.session = parsed;
      state.workspace_id = parsed.workspace_id;
      state.workspace_name = parsed.workspace_name;
      state.workspace_slug = parsed.workspace_slug;
      document.body.classList.add('workspace-' + state.workspace_slug);
      updateHeaderTitle();
      // Load data and render behind opaque overlay
      await loadAll();
      render();
      // Remove overlay and show dashboard
      loadEl.style.display = 'none';
      document.body.classList.add('logged-in');
      return;
    } catch(e) {
      sessionStorage.removeItem('sc_session');
      state.session = null;
      var loadEl = document.getElementById('loading-overlay');
      if (loadEl) loadEl.style.display = 'none';
    }
  }

  // No session — populate login dropdown and show login screen
  var headerLogo = document.querySelector('.header-logos img');
  if (headerLogo) document.getElementById('login-logo').src = headerLogo.src;

  var { data: wsData } = await db.from('workspaces').select('*').order('name');
  var { data: restData } = await db.from('restaurants').select('name, workspace_id').order('sort_order');
  state.workspaces = wsData || [];

  var loginSel = document.getElementById('login-who');
  while (loginSel.options.length > 1) loginSel.remove(1);

  (wsData || []).forEach(function(ws) {
    if (ws.type === 'client') {
      var adminOpt = document.createElement('option');
      adminOpt.value = ws.slug + '__admin__';
      adminOpt.textContent = ws.name + ' (Admin)';
      adminOpt.dataset.workspaceId = ws.id;
      adminOpt.dataset.workspaceSlug = ws.slug;
      adminOpt.dataset.workspaceName = ws.name;
      adminOpt.dataset.role = 'admin';
      adminOpt.dataset.restaurant = '';
      loginSel.appendChild(adminOpt);

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

  sessionStorage.setItem('sc_session', JSON.stringify({
    role: role,
    restaurant: restaurant,
    workspace_id: workspaceId,
    workspace_name: workspaceName,
    workspace_slug: workspaceSlug
  }));

  // Full page reload ensures a clean DOM — initApp() picks up the session
  window.location.reload();
}

function logout() {
  sessionStorage.removeItem('sc_session');
  // Reload page — initApp() will find no session and show the login screen with a fresh DOM
  window.location.reload();
}

