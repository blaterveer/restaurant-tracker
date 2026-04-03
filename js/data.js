// ============================================================
// SUPABASE DATA LAYER
// ============================================================

async function autoArchiveOldCompleted() {
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  var toArchive = state.projects.filter(function(p) {
    return p.complete && !p.archived && p.updatedAt && new Date(p.updatedAt) < cutoff;
  });
  if (toArchive.length === 0) return;
  for (var i = 0; i < toArchive.length; i++) {
    toArchive[i].archived = true;
    await dbUpsertProject(toArchive[i]);
  }
  // Remove newly archived from state so they don't show
  state.projects = state.projects.filter(function(p) { return !p.archived; });
}

async function loadAll() {
  const wsId = state.workspace_id;
  const [
    { data: restaurants },
    { data: categories  },
    { data: types       },
    { data: owners      },
    { data: projects    },
    { data: notes       },
    { data: subtasks    },
    { data: agendaItems },
    { data: inboxRequests },
    { data: openingsData },
  ] = await Promise.all([
    db.from('restaurants').select('name, next_meeting_date').eq('workspace_id', wsId).order('sort_order'),
    db.from('categories' ).select('name').eq('workspace_id', wsId).order('sort_order'),
    db.from('types'      ).select('name').eq('workspace_id', wsId).order('sort_order'),
    db.from('owners'     ).select('name').eq('workspace_id', wsId).order('sort_order'),
    db.from('projects'   ).select('*').eq('workspace_id', wsId),
    db.from('notes'      ).select('*').order('created_at'),
    db.from('subtasks'   ).select('*').order('sort_order'),
    db.from('agenda_items').select('*').eq('workspace_id', wsId).order('created_at'),
    db.from('inbox_requests').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
    db.from('openings'   ).select('*').eq('workspace_id', wsId).order('created_at'),
  ]);

  state.restaurants = (restaurants || []).map(r => r.name);
  state.categories  = (categories  || []).map(c => c.name);
  state.types       = (types       || []).map(t => t.name);
  state.owners      = (owners      || []).map(o => o.name);

  // Load openings
  state.openings = (openingsData || []).map(o => ({
    id: o.id, restaurant: o.restaurant, name: o.name,
    targetDate: o.target_date, createdAt: o.created_at,
  }));

  // Build restaurant meta (next_meeting_date, etc.)
  state.restaurantMeta = {};
  (restaurants || []).forEach(r => {
    state.restaurantMeta[r.name] = { next_meeting_date: r.next_meeting_date || '' };
  });

  // Load agenda items
  state.agendaItems = (agendaItems || []).map(a => ({
    id: a.id, restaurant: a.restaurant_name, title: a.title,
    description: a.description || '',
    converted: a.converted_to_task || false,
    cleared: a.cleared || false,
    sourceInboxId: a.inbox_request_id, createdAt: a.created_at,
  }));

  // Load inbox requests and derive unread count
  state.inboxRequests = inboxRequests || [];
  state.adminInboxUnread = state.inboxRequests.filter(r => r.status === 'submitted').length;

  // Normalize project fields from snake_case DB columns to camelCase
  const notesByProject = {};
  (notes || []).forEach(n => {
    if (!notesByProject[n.project_id]) notesByProject[n.project_id] = [];
    notesByProject[n.project_id].push({
      id:     n.id,
      date:   n.note_date,
      text:   n.text,
      author: n.author || '',
    });
  });

  state.projects = (projects || []).map(p => {
    // Parse phase sub-category from description: [Phase N -- Category Name]
    let phaseCategory = '';
    if (p.opening_id && p.description) {
      const m = p.description.match(/\[Phase \d+ -- ([^\]]+)\]/);
      if (m) phaseCategory = m[1].trim();
    }
    return {
      id:          p.id,
      restaurant:  p.restaurant,
      title:       p.title,
      category:    p.category   || '',
      type:        p.type       || '',
      description: p.description|| '',
      owner:       p.owner      || '',
      priority:    p.priority   || 'Medium',
      weeks:       p.weeks,
      dateAdded:   p.date_added,
      complete:    p.complete   || false,
      link:        p.link       || '',
      dueDate:     p.due_date   || null,
      updatedAt:   p.updated_at  || null,
      createdAt:   p.created_at  || null,
      archived:    p.archived    || false,
      isComplex:   p.is_complex  || false,
      openingId:   p.opening_id  || null,
      phase:       p.phase != null ? p.phase : null,
      phaseCategory: phaseCategory,
      notes:       notesByProject[p.id] || [],
      subtasks:    [],
    };
  });

  // Merge subtasks into projects
  const subtasksByProject = {};
  (subtasks || []).forEach(s => {
    if (!subtasksByProject[s.project_id]) subtasksByProject[s.project_id] = [];
    subtasksByProject[s.project_id].push({
      id:          s.id,
      name:        s.name,
      description: s.description || '',
      status:      s.status || 'incomplete',
      owner:       s.owner || '',
      dueDate:     s.due_date || null,
      sortOrder:   s.sort_order || 0,
    });
  });
  state.projects.forEach(p => { p.subtasks = subtasksByProject[p.id] || []; });
  await autoArchiveOldCompleted();
  await Promise.all([loadRestaurantMap(), loadTravelData()]);
}

async function dbUpsertProject(p) {
  const row = {
    id:          p.id,
    restaurant:  p.restaurant,
    title:       p.title,
    category:    p.category   || null,
    type:        p.type       || null,
    description: p.description|| null,
    owner:       p.owner      || null,
    priority:    p.priority   || null,
    weeks:       p.weeks      || null,
    date_added:  p.dateAdded  || null,
    due_date:    p.dueDate    || null,
    complete:    p.complete,
    link:        p.link       || null,
    is_complex:  p.isComplex  || false,
    archived:    p.archived   || false,
    opening_id:  p.openingId  || null,
    phase:       p.phase != null ? p.phase : null,
    workspace_id: state.workspace_id,
  };
  const { error } = await db.from('projects').upsert(row);
  if (error) throw error;
}

async function dbDeleteProject(id) {
  const { error } = await db.from('projects').delete().eq('id', id);
  if (error) throw error;
}

async function dbInsertNote(projectId, note) {
  const { data, error } = await db.from('notes').insert({
    project_id: projectId,
    note_date:  note.date,
    text:       note.text,
    author:     note.author || null,
  }).select().single();
  if (error) throw error;
  return data.id;
}

async function dbUpdateNote(noteId, text) {
  const { error } = await db.from('notes').update({ text }).eq('id', noteId);
  if (error) throw error;
}

async function dbDeleteNote(noteId) {
  const { error } = await db.from('notes').delete().eq('id', noteId);
  if (error) throw error;
}

async function dbUpsertSubtask(projectId, st) {
  const { data, error } = await db.from('subtasks').upsert({
    id:          st.id,
    project_id:  projectId,
    name:        st.name,
    description: st.description || null,
    status:      st.status || 'incomplete',
    owner:       st.owner || null,
    due_date:    st.dueDate || null,
    sort_order:  st.sortOrder || 0,
  }).select().single();
  if (error) throw error;
  return data ? data.id : st.id;
}

async function dbDeleteSubtask(id) {
  const { error } = await db.from('subtasks').delete().eq('id', id);
  if (error) throw error;
}

async function dbAddLookup(table, name) {
  const maxOrder = state[lookupStateKey(table)].length;
  const { error } = await db.from(table).insert({ name, sort_order: maxOrder, workspace_id: state.workspace_id });
  if (error) throw error;
}

async function dbUpdateLookup(table, oldName, newName) {
  const { error } = await db.from(table).update({ name: newName }).eq('name', oldName);
  if (error) throw error;
}

async function dbDeleteLookup(table, name) {
  const { error } = await db.from(table).delete().eq('name', name);
  if (error) throw error;
}

function lookupStateKey(table) {
  return { restaurants: 'restaurants', categories: 'categories', types: 'types', owners: 'owners' }[table];
}
