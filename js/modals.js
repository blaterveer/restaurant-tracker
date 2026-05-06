// ============================================================
// OWNER HELPERS
// ============================================================
var _ownerReturnSelectId = null;


function populateOwnerSelect(sel, selected) {
  if (!sel) return;
  sel.innerHTML = '<option value="">Select or add...</option>' +
    state.owners.map(function(o) {
      return '<option value="' + o + '"' + (o === selected ? ' selected' : '') + '>' + o + '</option>';
    }).join('') +
    '<option value="__new__">+ Add new owner...</option>';
  if (selected && state.owners.includes(selected)) sel.value = selected;
}

function handleOwnerSelect(selectId) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  if (sel.value === '__new__') {
    sel.value = '';
    openAddOwnerModal(selectId);
  }
}

function openAddOwnerModal(returnSelectId) {
  _ownerReturnSelectId = returnSelectId;
  document.getElementById('f-owner-first').value = '';
  document.getElementById('f-owner-last').value  = '';
  // Populate team dropdown based on workspace
  var teamSel = document.getElementById('f-owner-team');
  var teams = state.workspace_slug === 'brandon'
    ? [{ value: 'LTH Team', label: 'LTH Team' }]
    : [{ value: 'SC Culinary', label: 'SC Culinary' }, { value: 'Property', label: 'Property' }];
  teamSel.innerHTML = teams.map(function(t) {
    return '<option value="' + t.value + '">' + t.label + '</option>';
  }).join('');
  teamSel.value = teams[0].value;
  document.getElementById('add-owner-modal').classList.add('open');
}

function closeAddOwnerModal() {
  document.getElementById('add-owner-modal').classList.remove('open');
}

async function saveNewOwner() {
  var first = document.getElementById('f-owner-first').value.trim();
  var last  = document.getElementById('f-owner-last').value.trim();
  var team  = document.getElementById('f-owner-team').value;
  if (!first || !last) { alert('First and last name are required.'); return; }
  var displayName = first + ' ' + last + ' (' + team + ')';
  if (!state.owners.includes(displayName)) {
    await dbAddLookup('owners', displayName);
    state.owners.push(displayName);
  }
  // Update all owner selects that are currently in the DOM
  var selectIds = ['f-owner', 'st-owner', 'st-edit-owner'];
  selectIds.forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var prevVal = sel.value;
    populateOwnerSelect(sel, id === _ownerReturnSelectId ? displayName : (prevVal || null));
  });
  closeAddOwnerModal();
}

// ============================================================
// SUBTASK HELPERS
// ============================================================
function subtaskBadge(p) {
  var done  = p.subtasks.filter(function(s){ return s.status === 'complete'; }).length;
  var total = p.subtasks.length;
  if (total === 0) return '<span class="subtask-badge">subtasks</span>';
  var cls = done === total ? ' all-done' : '';
  return '<span class="subtask-badge' + cls + '">' + done + '/' + total + ' subtasks</span>';
}

function renderSubtasksPanel(p) {
  var section = document.getElementById('dp-subtasks-section');
  var list    = document.getElementById('dp-subtasks-list');
  if (!p.isComplex) { section.style.display = 'none'; return; }
  section.style.display = '';
  hideSubtaskForm();

  // Populate add-form owner select
  populateOwnerSelect(document.getElementById('st-owner'), null);

  if (!p.subtasks || p.subtasks.length === 0) {
    list.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);font-style:italic">No subtasks yet.</p>';
    return;
  }

  var editingId = state.editingSubtaskId;
  list.innerHTML = p.subtasks.map(function(st) {
    var isDone = st.status === 'complete';

    // EDIT MODE for this subtask
    if (st.id === editingId) {
      return '<div class="subtask-item">' +
        '<div class="subtask-form" style="flex:1;margin-top:0">' +
          '<input type="text" class="form-input" id="st-edit-name" value="' + escHtml(st.name) + '" placeholder="Subtask name...">' +
          '<textarea class="form-textarea" id="st-edit-description" placeholder="Description (optional)...">' + escHtml(st.description) + '</textarea>' +
          '<div class="subtask-form-row">' +
            '<select class="form-select" id="st-edit-owner" onchange="handleOwnerSelect(\'st-edit-owner\')"><option value="">Assign owner...</option></select>' +
            '<input type="date" class="form-input" id="st-edit-due-date" value="' + (st.dueDate || '') + '">' +
          '</div>' +
          '<div class="subtask-form-actions">' +
            '<button class="btn-cancel" onclick="cancelSubtaskEdit()">Cancel</button>' +
            '<button class="btn-primary" onclick="saveSubtaskEdit(\'' + p.id + '\', \'' + st.id + '\')">Save</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // NORMAL VIEW
    var meta = [];
    if (st.owner)   meta.push(st.owner);
    if (st.dueDate) meta.push('Due ' + formatDate(st.dueDate));
    var checkCls = isDone ? ' done' : '';
    var nameCls  = isDone ? ' done' : '';
    return '<div class="subtask-item">' +
      '<div class="subtask-check' + checkCls + '" onclick="toggleSubtask(\'' + p.id + '\', \'' + st.id + '\')"></div>' +
      '<div class="subtask-body">' +
        '<div class="subtask-name' + nameCls + '">' + escHtml(st.name) + '</div>' +
        (st.description ? '<div class="subtask-desc">' + escHtml(st.description) + '</div>' : '') +
        (meta.length ? '<div class="subtask-meta">' + meta.join(' \u00b7 ') + '</div>' : '') +
      '</div>' +
      '<div class="subtask-actions">' +
        '<button class="subtask-action-btn" onclick="editSubtask(\'' + p.id + '\', \'' + st.id + '\')">Edit</button>' +
        '<button class="subtask-action-btn" onclick="deleteSubtask(\'' + p.id + '\', \'' + st.id + '\')">Delete</button>' +
      '</div>' +
    '</div>';
  }).join('');

  // After rendering, populate the edit owner select if in edit mode
  if (editingId) {
    var editSt = p.subtasks.find(function(s){ return s.id === editingId; });
    var editOwnerSel = document.getElementById('st-edit-owner');
    if (editOwnerSel && editSt) {
      populateOwnerSelect(editOwnerSel, editSt.owner || null);
    }
  }
}


function showSubtaskForm() {
  document.getElementById('dp-subtask-form').style.display = '';
  document.getElementById('dp-subtask-add-btn').style.display = 'none';
  document.getElementById('st-name').focus();
}

function hideSubtaskForm() {
  document.getElementById('dp-subtask-form').style.display = 'none';
  document.getElementById('dp-subtask-add-btn').style.display = '';
  document.getElementById('st-name').value = '';
  document.getElementById('st-description').value = '';
  document.getElementById('st-owner').value = '';
  document.getElementById('st-due-date').value = '';
}

async function saveSubtask() {
  var name = document.getElementById('st-name').value.trim();
  if (!name) { alert('Subtask name is required.'); return; }
  var p = state.projects.find(function(x){ return x.id === state.detailProjectId; });
  if (!p) return;
  var st = {
    id:          (Date.now().toString(36) + Math.random().toString(36).slice(2)),
    name:        name,
    description: document.getElementById('st-description').value.trim(),
    status:      'incomplete',
    owner:       document.getElementById('st-owner').value,
    dueDate:     document.getElementById('st-due-date').value || null,
    sortOrder:   p.subtasks.length,
  };
  try {
    var savedId = await dbUpsertSubtask(p.id, st);
    if (savedId) st.id = savedId;
    p.subtasks.push(st);
  } catch(e) {
    console.error('saveSubtask error:', e);
    alert('Error saving subtask. Please try again.');
    return;
  }
  renderSubtasksPanel(p);
  renderTable();
}

async function toggleSubtask(projectId, subtaskId) {
  var p  = state.projects.find(function(x){ return x.id === projectId; });
  if (!p) return;
  var st = p.subtasks.find(function(s){ return s.id === subtaskId; });
  if (!st) return;
  var prev = st.status;
  st.status = st.status === 'complete' ? 'incomplete' : 'complete';
  try {
    await dbUpsertSubtask(p.id, st);
  } catch(e) {
    console.error('toggleSubtask error:', e);
    st.status = prev; // roll back
    alert('Error updating subtask. Please try again.');
    renderSubtasksPanel(p);
    return;
  }
  renderSubtasksPanel(p);
  renderTable();
  checkSubtaskRollup(p);
}

async function deleteSubtask(projectId, subtaskId) {
  if (!confirm('Delete this subtask?')) return;
  var p = state.projects.find(function(x){ return x.id === projectId; });
  if (!p) return;
  try {
    await dbDeleteSubtask(subtaskId);
    p.subtasks = p.subtasks.filter(function(s){ return s.id !== subtaskId; });
  } catch(e) {
    console.error('deleteSubtask error:', e);
    alert('Error deleting subtask. Please try again.');
    return;
  }
  renderSubtasksPanel(p);
  renderTable();
}

async function checkSubtaskRollup(p) {
  if (!p.subtasks || p.subtasks.length === 0) return;
  var allDone = p.subtasks.every(function(s){ return s.status === 'complete'; });
  if (allDone && !p.complete) {
    p.complete = true;
    try {
      await dbUpsertProject(p);
    } catch(e) {
      console.error('checkSubtaskRollup error:', e);
      p.complete = false; // roll back
      return;
    }
    var completeBtn = document.getElementById('dp-complete-btn');
    if (completeBtn) completeBtn.textContent = 'Mark Incomplete';
    var toast = document.getElementById('dp-rollup-toast');
    if (toast) {
      toast.textContent = 'All subtasks complete — project marked as done!';
      toast.style.display = 'block';
      setTimeout(function(){ toast.style.display = 'none'; }, 4000);
    }
    renderTable();
    renderSummary();
  }
}

function editSubtask(projectId, subtaskId) {
  state.editingSubtaskId = subtaskId;
  var p = state.projects.find(function(x){ return x.id === projectId; });
  if (p) renderSubtasksPanel(p);
}

function cancelSubtaskEdit() {
  state.editingSubtaskId = null;
  var p = state.projects.find(function(x){ return x.id === state.detailProjectId; });
  if (p) renderSubtasksPanel(p);
}

async function saveSubtaskEdit(projectId, subtaskId) {
  var p  = state.projects.find(function(x){ return x.id === projectId; });
  if (!p) return;
  var st = p.subtasks.find(function(s){ return s.id === subtaskId; });
  if (!st) return;
  var name = document.getElementById('st-edit-name').value.trim();
  if (!name) { alert('Subtask name is required.'); return; }
  st.name        = name;
  st.description = document.getElementById('st-edit-description').value.trim();
  st.owner       = document.getElementById('st-edit-owner').value;
  st.dueDate     = document.getElementById('st-edit-due-date').value || null;
  try {
    await dbUpsertSubtask(p.id, st);
  } catch(e) {
    console.error('saveSubtaskEdit error:', e);
    alert('Error saving subtask. Please try again.');
    return;
  }
  state.editingSubtaskId = null;
  renderSubtasksPanel(p);
  renderTable();
}

// ============================================================
// DETAIL PANEL
// ============================================================
function openDetail(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  state.detailProjectId = id;

  const due = dueDate(p);

  document.getElementById('dp-restaurant').textContent = p.restaurant;
  document.getElementById('dp-title').textContent      = p.title;
  document.getElementById('dp-meta').innerHTML = `
    ${p.priority ? `<span class="priority-badge ${p.priority.toLowerCase()}">${p.priority}</span>` : ''}
    ${dueBadge(p)}
    ${p.openingId && p.phase != null ? `<span class="category-tag" style="background:${PHASE_COLORS[p.phase]}22;color:${PHASE_COLORS[p.phase]};border:1px solid ${PHASE_COLORS[p.phase]}44">Phase ${p.phase}</span>` : ''}
    ${p.openingId && p.phaseCategory ? `<span class="category-tag">${p.phaseCategory}</span>` : ''}
    ${!p.openingId && p.category ? `<span class="category-tag ${categoryClass(p.category)}">${p.category}</span>` : ''}
  `;
  document.getElementById('dp-details').innerHTML = `
    ${p.openingId && p.phase != null ? `<div class="detail-row"><span class="key">Phase</span><span class="val">${PHASE_LABELS[p.phase] || 'Phase ' + p.phase}</span></div>` : ''}
    ${p.openingId && p.phaseCategory ? `<div class="detail-row"><span class="key">Sub-Category</span><span class="val">${p.phaseCategory}</span></div>` : ''}
    <div class="detail-row"><span class="key">Owner</span><span class="val">${p.owner || '""'}</span></div>
    ${!p.openingId ? `<div class="detail-row"><span class="key">Type</span><span class="val">${p.type || '""'}</span></div>` : ''}
    <div class="detail-row"><span class="key">Date Added</span><span class="val">${formatDate(p.dateAdded)}</span></div>
    <div class="detail-row"><span class="key">Weeks to Complete</span><span class="val">${p.weeks || '""'}</span></div>
    <div class="detail-row"><span class="key">Due By</span><span class="val">${due ? formatDate(due) : '""'}</span></div>
    <div class="detail-row"><span class="key">Complete?</span><span class="val">${p.complete ? '✓ Yes' : 'No'}</span></div>
  `;
  document.getElementById('dp-description').textContent = p.description || 'No description provided.';

  renderPanelNotes(p);
  renderSubtasksPanel(p);

  const authorSel = document.getElementById('dp-note-author');
  authorSel.innerHTML = `<option value="">"" Who's adding this? ""</option>` +
    state.owners.map(o => `<option value="${o}">${o}</option>`).join('') +
    `<option value="__new__">+ Add my name…</option>`;
  document.getElementById('dp-note-author-new').style.display = 'none';
  document.getElementById('dp-note-author-new').value = '';
  document.getElementById('dp-note-text').value = '';
  document.getElementById('dp-note-date').textContent = formatDate(today());

  document.getElementById('dp-link').innerHTML = p.link
    ? `<a href="${p.link}" target="_blank" style="color:var(--primary);font-size:13px">${p.link}</a>`
    : '<span style="color:var(--text-secondary);font-size:13px">No link provided</span>';

  const completeBtn = document.getElementById('dp-complete-btn');
  completeBtn.textContent = p.complete ? 'Mark Incomplete' : 'Mark Complete';
  var isAdmin = state.session && state.session.role === 'admin';
  completeBtn.style.display = isAdmin ? '' : 'none';
  var editBtn   = document.getElementById('dp-edit-btn');
  var deleteBtn = document.getElementById('dp-delete-btn');
  if (editBtn)   editBtn.style.display   = isAdmin ? '' : 'none';
  if (deleteBtn) deleteBtn.style.display = isAdmin ? '' : 'none';

  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-panel').classList.add('open');
}

function renderPanelNotes(p) {
  const notesContainer = document.getElementById('dp-notes');
  document.getElementById('dp-notes-section').style.display = '';

  if (p.notes && p.notes.length > 0) {
    const indexed = p.notes.map((n, i) => ({ ...n, origIndex: i }));
    indexed.reverse();
    notesContainer.innerHTML = indexed.map(n =>
      `<div class="note-item" data-note-index="${n.origIndex}">
        <div class="note-date">${formatDate(n.date)} · <strong>${n.author || 'Unknown'}</strong></div>
        <div class="note-text" id="note-text-${n.origIndex}">${n.text}</div>
        <div class="note-actions">
          <button class="note-action-btn" onclick="openNoteEdit('${p.id}', ${n.origIndex})">Edit</button>
          <button class="note-action-btn delete" onclick="deleteNote('${p.id}', ${n.origIndex})">Delete</button>
        </div>
        <div class="note-edit-area" id="note-edit-${n.origIndex}">
          <textarea id="note-edit-text-${n.origIndex}">${n.text}</textarea>
          <div class="note-edit-actions">
            <button class="btn-note-save" onclick="saveNoteEdit('${p.id}', ${n.origIndex})">Save</button>
            <button class="btn-note-cancel" onclick="closeNoteEdit(${n.origIndex})">Cancel</button>
          </div>
        </div>
      </div>`
    ).join('');
  } else {
    notesContainer.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);font-style:italic">No notes yet.</p>';
  }
}

function openNoteEdit(projectId, noteIndex) {
  document.querySelectorAll('.note-edit-area.open').forEach(el => el.classList.remove('open'));
  const area = document.getElementById(`note-edit-${noteIndex}`);
  if (area) area.classList.add('open');
  const ta = document.getElementById(`note-edit-text-${noteIndex}`);
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

function closeNoteEdit(noteIndex) {
  const area = document.getElementById(`note-edit-${noteIndex}`);
  if (area) area.classList.remove('open');
}

async function saveNoteEdit(projectId, noteIndex) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  const newText = document.getElementById(`note-edit-text-${noteIndex}`).value.trim();
  if (!newText) return;
  const note = p.notes[noteIndex];
  note.text = newText;
  if (note.id) await dbUpdateNote(note.id, newText);
  renderPanelNotes(p);
  renderTable();
  showToast('Note updated');
}

async function deleteNote(projectId, noteIndex) {
  const p = state.projects.find(x => x.id === projectId);
  if (!p) return;
  if (!confirm('Delete this note?')) return;
  const note = p.notes[noteIndex];
  if (note && note.id) await dbDeleteNote(note.id);
  p.notes.splice(noteIndex, 1);
  renderPanelNotes(p);
  renderTable();
  showToast('Note deleted');
}

function handleNoteAuthorChange() {
  const sel      = document.getElementById('dp-note-author');
  const newInput = document.getElementById('dp-note-author-new');
  if (sel.value === '__new__') {
    newInput.style.display = 'block';
    newInput.focus();
  } else {
    newInput.style.display = 'none';
    newInput.value = '';
  }
}

async function submitPanelNote() {
  const text = document.getElementById('dp-note-text').value.trim();
  if (!text) { document.getElementById('dp-note-text').focus(); return; }

  const authorSel = document.getElementById('dp-note-author');
  let author = '';
  if (authorSel.value === '__new__') {
    author = document.getElementById('dp-note-author-new').value.trim();
    if (author && !state.owners.includes(author)) {
      try {
        await dbAddLookup('owners', author);
        state.owners.push(author);
      } catch(e) {
        console.error('submitPanelNote addLookup error:', e);
        alert('Error saving new author. Please try again.');
        return;
      }
    }
  } else {
    author = authorSel.value;
  }

  const p = state.projects.find(x => x.id === state.detailProjectId);
  if (!p) return;

  const newNote = { date: today(), text, author };
  try {
    const noteId = await dbInsertNote(p.id, newNote);
    if (noteId) newNote.id = noteId;
    p.notes.push(newNote);
  } catch(e) {
    console.error('submitPanelNote error:', e);
    alert('Error saving note. Please try again.');
    return;
  }

  document.getElementById('dp-note-text').value = '';
  document.getElementById('dp-note-author').value = '';
  document.getElementById('dp-note-author-new').style.display = 'none';
  document.getElementById('dp-note-author-new').value = '';

  renderPanelNotes(p);
  renderTable();
  renderSummary();
  showToast('Note added');
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('open');
  document.getElementById('detail-panel').classList.remove('open');
  state.detailProjectId = null;
  // Refresh openings view if active
  if (state.activeTab === '__openings__') renderOpeningsView();
}

function toggleCompleteFromPanel() {
  if (state.detailProjectId) {
    toggleComplete(state.detailProjectId).then(() => {
      openDetail(state.detailProjectId);
      if (state.activeTab === '__openings__') renderOpeningsView();
    });
  }
}

function editFromPanel() {
  if (state.detailProjectId) {
    const idToEdit = state.detailProjectId;
    const p = state.projects.find(x => x.id === idToEdit);
    closeDetail();
    if (p && p.openingId) {
      // Ensure we're in the opening context for the modal
      state.activeOpeningId = p.openingId;
      openOpeningTaskModal(idToEdit);
    } else {
      openAddModal(idToEdit);
    }
  }
}

function duplicateFromPanel() {
  if (state.detailProjectId) {
    const idToCopy = state.detailProjectId;
    closeDetail();
    duplicateProject(idToCopy);
  }
}

async function duplicateProject(sourceId) {
  const src = state.projects.find(x => x.id === sourceId);
  if (!src) return;

  showLoading('Duplicating…');

  // Build new project — copy all fields, fresh ID, not complete, no notes
  const newId = uid();
  const newProject = {
    id:          newId,
    restaurant:  src.restaurant,
    title:       'Copy of ' + src.title,
    category:    src.category,
    type:        src.type,
    description: src.description,
    owner:       src.owner,
    priority:    src.priority,
    weeks:       src.weeks,
    dateAdded:   src.dateAdded,
    isComplex:   src.isComplex,
    complete:    false,
    link:        src.link || '',
    archived:    false,
    notes:       [],
    subtasks:    [],
    createdAt:   null,
    updatedAt:   null,
  };

  try {
    // Save project to DB first
    await dbUpsertProject(newProject);

    // Duplicate subtasks with new IDs
    for (const st of (src.subtasks || [])) {
      const newSt = {
        id:          uid(),
        name:        st.name,
        description: st.description || '',
        status:      'incomplete',
        owner:       st.owner || '',
        dueDate:     st.dueDate || null,
        sortOrder:   st.sortOrder || 0,
      };
      await dbUpsertSubtask(newId, newSt);
      newProject.subtasks.push(newSt);
    }

    state.projects.push(newProject);
  } catch(e) {
    console.error('duplicateProject error:', e);
    hideLoading();
    alert('Error duplicating task. Please try again.');
    return;
  }

  hideLoading();

  // Open the duplicate in the edit modal so user can adjust fields
  openAddModal(newId);
}

async function archiveFromPanel() {
  if (!state.detailProjectId) return;
  if (!confirm('Archive this project? It will be hidden but can be restored from the Admin panel.')) return;
  const p = state.projects.find(x => x.id === state.detailProjectId);
  if (!p) return;
  p.archived = true;
  try {
    await dbUpsertProject(p);
  } catch(e) {
    console.error('archiveFromPanel error:', e);
    p.archived = false; // roll back
    showToast('Error archiving task', 'error');
    return;
  }
  closeDetail();
  render();
  showToast('Task archived');
}

// ============================================================
// ADD/EDIT MODAL
// ============================================================
function handleNewTaskClick() {
  if (state.activeTab === '__openings__' && state.activeOpeningId) {
    showToast('For openings, use the + Add Task button in the opening view.', 'warning');
    return;
  }
  openAddModal();
}

function openAddModal(editId = null, prefill = null) {
  state.editProjectId = editId;
  // Set or clear pending inbox/agenda IDs based on what triggered this open
  state.pendingInboxItemId   = (!editId && prefill) ? (prefill.inboxItemId   || null) : null;
  state._pendingAgendaItemId = (!editId && prefill) ? (prefill.agendaItemId  || null) : null;
  const isEdit = !!editId;
  const p = isEdit ? state.projects.find(x => x.id === editId) : null;

  document.getElementById('modal-title').innerHTML = isEdit ? 'Edit <em>Task</em>' : 'New <em>Task</em>';

  const rSel = document.getElementById('f-restaurant');
  rSel.innerHTML = state.restaurants.map(r => `<option value="${r}">${r}</option>`).join('');
  if (isEdit && p) {
    rSel.value = p.restaurant;
  } else if (prefill && prefill.restaurant) {
    rSel.value = prefill.restaurant;
  } else if (!isEdit && state.activeTab !== 'all') {
    rSel.value = state.activeTab;
  }

  populateDynamicSelect('f-category', state.categories, isEdit ? p?.category : null);
  populateDynamicSelect('f-type',     state.types,      isEdit ? p?.type     : null);
  populateOwnerSelect(document.getElementById('f-owner'), isEdit ? (p ? p.owner : null) : null);

  document.getElementById('f-title').value       = isEdit ? (p?.title       || '') : (prefill?.title || '');
  document.getElementById('f-description').value = isEdit ? (p?.description || '') : (prefill?.description || '');
  document.getElementById('f-priority').value    = isEdit ? (p?.priority    || 'Medium') : 'Medium';
  document.getElementById('f-weeks').value       = isEdit ? (p?.weeks       || '') : '';
  document.getElementById('f-due-date').value    = isEdit ? (p?.dueDate     || '') : '';
  document.getElementById('f-date-added').value  = isEdit ? (p?.dateAdded   || today()) : today();
  document.getElementById('f-note').value        = '';
  document.getElementById('f-is-complex').checked = isEdit ? (p ? (p.isComplex || false) : false) : false;

  ['new-category-input', 'new-type-input', 'new-phase-category-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.style.display = 'none'; }
  });

  // Reset opening-specific fields — hide them for regular tasks
  state._openingModalId = null;
  document.getElementById('fg-phase').style.display = 'none';
  document.getElementById('fg-phase-category').style.display = 'none';
  document.getElementById('fg-category').style.display = '';
  document.getElementById('fg-type').style.display = '';
  document.getElementById('f-phase').value = '';
  document.getElementById('f-phase-category').innerHTML = '<option value="">Select or create…</option>';
  document.getElementById('f-restaurant').disabled = false;

  const notesLog     = document.getElementById('edit-notes-log');
  const notesDisplay = document.getElementById('notes-log-display');
  if (isEdit && p?.notes && p.notes.length > 0) {
    notesLog.style.display = '';
    notesDisplay.innerHTML = [...p.notes].reverse().map(n =>
      `<div class="note-item"><div class="note-date">${formatDate(n.date)}${n.author ? ` · <strong>${n.author}</strong>` : ''}</div><div class="note-text">${n.text}</div></div>`
    ).join('');
  } else {
    notesLog.style.display = 'none';
  }

  updateDuePreview();
  document.getElementById('note-date-preview').textContent = 'Note dated: ' + formatDate(today());
  document.getElementById('project-modal').classList.add('open');
}

function promptChangeOpeningDate(openingId, currentDate) {
  // Create a hidden date input to trigger the native calendar picker
  let picker = document.getElementById('opening-date-picker');
  if (!picker) {
    picker = document.createElement('input');
    picker.type = 'date';
    picker.id = 'opening-date-picker';
    picker.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(picker);
  }
  picker.value = currentDate;
  picker.onchange = async function() {
    const newDate = picker.value;
    if (!newDate || newDate === currentDate) return;

    const oldD = new Date(currentDate + 'T00:00:00');
    const newD = new Date(newDate + 'T00:00:00');
    const deltaDays = Math.round((newD - oldD) / 86400000);
    if (deltaDays === 0) return;

    const direction = deltaDays > 0 ? 'later' : 'earlier';
    const absDays = Math.abs(deltaDays);
    const newDateStr = newD.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (!confirm(`Move opening to ${newDateStr}?\n\nThis will shift all task due dates ${absDays} day${absDays !== 1 ? 's' : ''} ${direction}.`)) return;

    try {
      const { error: openingErr } = await db.from('openings').update({ target_date: newDate }).eq('id', openingId);
      if (openingErr) throw openingErr;

      const tasks = state.projects.filter(p => p.openingId === openingId && p.dueDate);
      const updates = tasks.map(t => {
        const oldDue = new Date(t.dueDate + 'T00:00:00');
        oldDue.setDate(oldDue.getDate() + deltaDays);
        const shifted = oldDue.toISOString().split('T')[0];
        return db.from('projects').update({ due_date: shifted }).eq('id', t.id);
      });
      await Promise.all(updates);

      alert(`Done — ${tasks.length} task${tasks.length !== 1 ? 's' : ''} shifted ${absDays} day${absDays !== 1 ? 's' : ''} ${direction}.\n\nPage will refresh to show updated dates.`);
      window.location.reload();
    } catch (e) {
      console.error('Error shifting dates:', e);
      alert('Error updating dates: ' + e.message);
    }
  };
  picker.showPicker();
}

function openOpeningTaskModal(editId = null) {
  const opening = state.openings.find(o => o.id === state.activeOpeningId);
  if (!opening) return;

  const isEdit = !!editId;
  const p = isEdit ? state.projects.find(x => x.id === editId) : null;

  // Use the regular modal but configure it for opening mode
  openAddModal(editId);

  // Switch to side panel mode for openings
  document.getElementById('project-modal').classList.add('opening-panel');

  // Now override for opening context
  state._openingModalId = opening.id;
  document.getElementById('modal-title').innerHTML = isEdit ? 'Edit <em>Opening Task</em>' : 'New <em>Opening Task</em>';

  // Lock restaurant to the opening's restaurant
  const rSel = document.getElementById('f-restaurant');
  rSel.value = opening.restaurant;
  rSel.disabled = true;

  // Hide regular category/type, show phase/sub-category
  document.getElementById('fg-category').style.display = 'none';
  document.getElementById('fg-type').style.display = 'none';
  document.getElementById('fg-phase').style.display = '';
  document.getElementById('fg-phase-category').style.display = '';

  // If editing, pre-select phase and sub-category
  if (isEdit && p) {
    document.getElementById('f-phase').value = p.phase != null ? p.phase : '';
    if (p.phase != null) onPhaseChange(p.phaseCategory || null);
  } else {
    document.getElementById('f-phase').value = '';
    document.getElementById('f-phase-category').innerHTML = '<option value="">Select phase first…</option>';
  }
}

function onPhaseChange(preselect) {
  const phaseVal = document.getElementById('f-phase').value;
  const sel = document.getElementById('f-phase-category');
  if (!phaseVal && phaseVal !== '0') {
    sel.innerHTML = '<option value="">Select phase first…</option>';
    return;
  }
  const phase = parseInt(phaseVal);
  // Gather existing sub-categories for this phase from current opening tasks
  const openingId = state._openingModalId;
  const cats = new Set();
  state.projects.forEach(p => {
    if (p.openingId === openingId && p.phase === phase && p.phaseCategory) {
      cats.add(p.phaseCategory);
    }
  });
  const sorted = [...cats].sort();
  sel.innerHTML =
    '<option value="">Select or create…</option>' +
    sorted.map(c => `<option value="${c}"${c === preselect ? ' selected' : ''}>${c}</option>`).join('') +
    '<option value="__new__">+ Add new…</option>';
  if (preselect && sorted.includes(preselect)) sel.value = preselect;
}

function populateDynamicSelect(selectId, options, selected) {
  const sel = document.getElementById(selectId);
  sel.innerHTML =
    `<option value="">Select or create new…</option>` +
    options.map(o => `<option value="${o}"${o === selected ? ' selected' : ''}>${o}</option>`).join('') +
    `<option value="__new__">+ Add new…</option>`;
  if (selected && options.includes(selected)) sel.value = selected;
}

function checkNewOption(selectEl, inputId) {
  const input = document.getElementById(inputId);
  if (selectEl.value === '__new__') {
    input.style.display = 'block';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}

function updateDuePreview() {
  const weeks   = parseInt(document.getElementById('f-weeks').value);
  const dateVal = document.getElementById('f-date-added').value;
  const dueDateEl = document.getElementById('f-due-date');
  if (weeks && dateVal) {
    const d = new Date(dateVal + 'T00:00:00');
    d.setDate(d.getDate() + weeks * 7);
    dueDateEl.value = d.toISOString().split('T')[0];
  }
}

function onDueDateInput() {
  const dueDateEl = document.getElementById('f-due-date');
  const weeksEl   = document.getElementById('f-weeks');
  const dateVal   = document.getElementById('f-date-added').value;
  if (dueDateEl.value && dateVal) {
    // Recalculate weeks from the manually set due date
    const start = new Date(dateVal + 'T00:00:00');
    const end   = new Date(dueDateEl.value + 'T00:00:00');
    const diffWeeks = Math.round((end - start) / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks > 0) weeksEl.value = diffWeeks;
    else weeksEl.value = '';
  }
}

async function resolveSelectValue(selectId, inputId, table, stateKey) {
  const sel = document.getElementById(selectId);
  if (sel.value === '__new__') {
    const input  = document.getElementById(inputId);
    const newVal = input.value.trim();
    if (newVal && !state[stateKey].includes(newVal)) {
      await dbAddLookup(table, newVal);
      state[stateKey].push(newVal);
    }
    return newVal;
  }
  return sel.value;
}

async function saveProject() {
  const title      = document.getElementById('f-title').value.trim();
  const restaurant = document.getElementById('f-restaurant').value;
  if (!title)      { alert('Task title is required.'); return; }
  if (!restaurant) { alert('Please select a restaurant.'); return; }

  const isOpeningMode = !!state._openingModalId;

  // Validate opening-specific fields
  if (isOpeningMode) {
    const phaseVal = document.getElementById('f-phase').value;
    if (phaseVal === '') { alert('Please select a phase.'); return; }
    const pcSel = document.getElementById('f-phase-category');
    const pcInput = document.getElementById('new-phase-category-input');
    const pcVal = pcSel.value === '__new__' ? pcInput.value.trim() : pcSel.value;
    if (!pcVal) { alert('Please select or create a sub-category.'); return; }
  }

  showLoading('Saving…');

  const category    = isOpeningMode ? '' : await resolveSelectValue('f-category', 'new-category-input', 'categories', 'categories');
  const type        = isOpeningMode ? '' : await resolveSelectValue('f-type',     'new-type-input',     'types',      'types');
  const owner       = await resolveSelectValue('f-owner',    'new-owner-input',    'owners',     'owners');
  const noteText    = document.getElementById('f-note').value.trim();
  const weeks       = parseInt(document.getElementById('f-weeks').value) || null;
  let   description = document.getElementById('f-description').value.trim();
  const priority    = document.getElementById('f-priority').value;
  const dateAdded   = document.getElementById('f-date-added').value;
  const dueDate     = document.getElementById('f-due-date').value || null;

  // Opening-specific fields
  let openingId = null, phase = null, phaseCategory = '';
  if (isOpeningMode) {
    openingId = state._openingModalId;
    phase = parseInt(document.getElementById('f-phase').value);
    const pcSel = document.getElementById('f-phase-category');
    const pcInput = document.getElementById('new-phase-category-input');
    phaseCategory = pcSel.value === '__new__' ? pcInput.value.trim() : pcSel.value;
    // Embed phase tag in description for consistency with existing data
    const phaseTag = `[Phase ${phase} -- ${phaseCategory}]`;
    if (!description.includes(phaseTag)) {
      description = description ? phaseTag + ' ' + description : phaseTag;
    }
  }

  try {
    if (state.editProjectId) {
      const p = state.projects.find(x => x.id === state.editProjectId);
      if (!p) { alert('Could not find project to update.'); hideLoading(); return; }
      p.title = title; p.restaurant = restaurant; p.category = category;
      p.type = type; p.description = description; p.owner = owner;
      p.priority = priority; p.weeks = weeks; p.dateAdded = dateAdded; p.dueDate = dueDate;
      p.isComplex = document.getElementById('f-is-complex').checked;
      if (isOpeningMode) {
        p.openingId = openingId;
        p.phase = phase;
        p.phaseCategory = phaseCategory;
      }
      await dbUpsertProject(p);
      if (noteText) {
        const newNote = { date: today(), text: noteText, author: '' };
        const noteId  = await dbInsertNote(p.id, newNote);
        if (noteId) newNote.id = noteId;
        p.notes.push(newNote);
      }
    } else {
      const newProject = {
        id: uid(), restaurant, title, category, type, description,
        owner, priority, weeks, dateAdded, dueDate,
        isComplex: document.getElementById('f-is-complex').checked,
        complete: false, link: '', notes: [], subtasks: [],
        openingId: openingId,
        phase: phase,
        phaseCategory: phaseCategory,
      };
      await dbUpsertProject(newProject);
      if (noteText) {
        const newNote = { date: today(), text: noteText, author: '' };
        const noteId  = await dbInsertNote(newProject.id, newNote);
        if (noteId) newNote.id = noteId;
        newProject.notes.push(newNote);
      }
      state.projects.push(newProject);
    }
  } catch(e) {
    console.error('saveProject error:', e);
    hideLoading();
    alert('Error saving task. Please try again.');
    return;
  }

  // If this task was created from an inbox item, mark it as added
  if (!state.editProjectId && state.pendingInboxItemId) {
    try {
      await dbUpdateInboxStatus(state.pendingInboxItemId, 'added');
      _updateInboxRequestInState(state.pendingInboxItemId, { status: 'added' });
    } catch(e) { console.error('Failed to update inbox status', e); }
    state.pendingInboxItemId = null;
  }
  // If this task was created from an agenda item, mark it as converted
  if (!state.editProjectId && state._pendingAgendaItemId) {
    try {
      await dbUpdateAgendaItemStatus(state._pendingAgendaItemId, 'converted');
      state.agendaItems = state.agendaItems.map(a =>
        a.id === state._pendingAgendaItemId ? { ...a, converted: true } : a
      );
    } catch(e) { console.error('Failed to update agenda status', e); }
    state._pendingAgendaItemId = null;
  }

  const wasEdit = !!state.editProjectId;
  hideLoading();
  closeModal();
  render();
  showToast(wasEdit ? 'Task updated' : 'Task created');
}

function closeModal() {
  const modal = document.getElementById('project-modal');
  modal.classList.remove('open');
  modal.classList.remove('opening-panel');
  modal.classList.remove('collapsed');
  state.editProjectId = null;
  state.pendingInboxItemId = null;
  state._pendingAgendaItemId = null;
  state._openingModalId = null;
  document.getElementById('f-restaurant').disabled = false;
}

function toggleOpeningPanel() {
  const modal = document.getElementById('project-modal');
  const btn = modal.querySelector('.opening-panel-toggle');
  modal.classList.toggle('collapsed');
  if (modal.classList.contains('collapsed')) {
    btn.innerHTML = '&#9664;'; // left arrow = click to expand
    btn.title = 'Expand form';
  } else {
    btn.innerHTML = '&#9654;'; // right arrow = click to collapse
    btn.title = 'Collapse form';
  }
}

