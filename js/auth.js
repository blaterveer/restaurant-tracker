// ============================================================
// AUTH / LOGIN
// ============================================================
async function initApp() {
  // Copy logo from header into login screen
  var headerLogo = document.querySelector('.header-logos img');
  if (headerLogo) document.getElementById('login-logo').src = headerLogo.src;

  // Load restaurant list into login dropdown
  var { data: restData } = await db.from('restaurants').select('name').order('sort_order');
  var loginSel = document.getElementById('login-who');
  (restData || []).forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.name;
    loginSel.appendChild(opt);
  });

  // Check for existing session
  var saved = sessionStorage.getItem('sc_session');
  if (saved) {
    try {
      state.session = JSON.parse(saved);
      await loadAll();
      render();
      document.body.classList.add('logged-in');
      return;
    } catch(e) {
      sessionStorage.removeItem('sc_session');
    }
  }

  // No session — show login screen
  document.getElementById('login-screen').style.display = 'flex';
}

async function attemptLogin() {
  var who = document.getElementById('login-who').value;
  var pwd = document.getElementById('login-password').value.trim();
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!who) { errEl.textContent = 'Please select who you are.'; errEl.style.display = ''; return; }
  if (!pwd) { errEl.textContent = 'Please enter a password.'; errEl.style.display = ''; return; }

  var role = null;
  var restaurant = null;

  if (who === '__admin__') {
    var { data: setting } = await db.from('app_settings').select('value').eq('key', 'admin_password').single();
    if (setting && setting.value === pwd) role = 'admin';
  } else {
    var { data: rest } = await db.from('restaurants').select('password').eq('name', who).single();
    if (rest && rest.password === pwd) { role = 'restaurant'; restaurant = who; }
  }

  if (!role) {
    errEl.textContent = 'Incorrect password. Please try again.';
    errEl.style.display = '';
    document.getElementById('login-password').value = '';
    return;
  }

  state.session = { role: role, restaurant: restaurant };
  sessionStorage.setItem('sc_session', JSON.stringify(state.session));

  showLoading('Loading data\u2026');
  await loadAll();
  hideLoading();
  render();

  document.getElementById('login-screen').style.display = 'none';
  document.body.classList.add('logged-in');
}

function logout() {
  sessionStorage.removeItem('sc_session');
  state.session = null;
  document.body.classList.remove('logged-in');
  document.getElementById('login-password').value = '';
  document.getElementById('login-who').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

