// ============================================================
// HELPERS
// ============================================================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function today() { return new Date().toISOString().split('T')[0]; }
function formatDate(d) {
  if (!d) return '""';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function dueDate(project) {
  if (project.dueDate) return project.dueDate;
  if (!project.dateAdded || !project.weeks) return null;
  const d = new Date(project.dateAdded + 'T00:00:00');
  d.setDate(d.getDate() + project.weeks * 7);
  return d.toISOString().split('T')[0];
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(today() + 'T00:00:00');
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - now) / 86400000);
}
function dueBadge(project) {
  if (project.complete) return '<span class="due-badge track">Complete</span>';
  const due = dueDate(project);
  if (!due) return '<span style="color:var(--text-secondary);font-size:11px">""</span>';
  const days = daysUntil(due);
  if (days < 0) return `<span class="due-badge overdue">Overdue</span>`;
  if (days <= 7) return `<span class="due-badge soon">${formatDate(due)}</span>`;
  if (days <= 28) return `<span class="due-badge mid">${formatDate(due)}</span>`;
  return `<span class="due-badge track">${formatDate(due)}</span>`;
}
function categoryClass(cat) {
  if (!cat) return '';
  const c = cat.toLowerCase();
  if (c.includes('bev'))   return 'beverage';
  if (c.includes('cul'))   return 'culinary';
  if (c.includes('admin')) return 'administrative';
  if (c.includes('collat'))return 'collateral';
  if (c.includes('dining'))return 'dining';
  return '';
}

// ============================================================
// LOADING OVERLAY
// ============================================================
function showLoading(msg = 'Loading…') {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(28,25,21,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:"DM Sans",sans-serif;color:var(--card-bg);font-size:14px;letter-spacing:0.1em;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast' + (type !== 'success' ? ' ' + type : '');
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}


function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
