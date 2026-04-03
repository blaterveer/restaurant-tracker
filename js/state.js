// ============================================================
// STATE  (UI-only; data lives in Supabase)
// ============================================================
let state = {
  restaurants: [],
  projects: [],
  categories: [],
  types: [],
  owners: [],
  workspace_id: null,
  workspace_name: null,
  workspace_slug: null,
  workspaces: [],
  activeTab: 'all',
  detailProjectId: null,
  editProjectId: null,
  gantt: { windowDays: 90, groupBy: 'restaurant', showComplete: false },
  editingSubtaskId: null,
  session: null,
  sort: { col: null, dir: 'asc' },
  showOverdue: false,
  inboxRequests: [],
  adminInboxUnread: 0,
  agendaItems: [],
  restaurantMeta: {},       // { 'LEOLA': { next_meeting_date: '2026-03-20' }, ... }
  pendingInboxItemId: null, // set before opening new-task modal from inbox
  openings: [],             // { id, restaurant, name, targetDate }
  activeOpeningId: null,    // currently selected opening
  openingTab: 'thisweek',   // 'thisweek' | 'phases' | 'byowner' | 'gantt'
  _openingModalId: null,    // set when add/edit modal is in opening mode
  _openingSearch: '',       // search query for opening tasks
  _openingSections: {},     // tracks open/closed state of collapsible sections {sectionId: true/false}
  _openingSectionsInit: false, // whether sections have been initialized for current view
};
