// ============================================================
// TRAVEL CALENDAR
// ============================================================

// Travel state
const travelState = {
  view: 'calendar',          // 'calendar' | 'list'
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),  // 0-indexed
  trips: [],
  travelers: [],
  itineraryItems: [],
  editTripId: null,
  editItinId: null,
  editItinTripId: null,
  newTravelerColor: '#4F86C6',
  // v2: quarterly tracking
  quarterlyStats: {},        // { restaurantName: { 'Q1 2026': {days, trips}, ... } }
  // v2: agenda builder
  agendaBlocks: [],
  agendaTemplates: [],
  editAgendaBlockId: null,
  // v2: recap tool
  recaps: [],
  recapObservations: [],
  editRecapId: null,
};

const TRAVELER_PALETTE = [
  '#4F86C6','#52A775','#E07B4F','#9B59B6','#E74C3C',
  '#1ABC9C','#F39C12','#8E44AD',
];

// ---- Data layer ----

async function loadTravelData() {
  const [
    { data: travelers },
    { data: trips },
    { data: tripTravelers },
    { data: itinItems },
    { data: agendaBlocks },
    { data: agendaTemplates },
    { data: recaps },
    { data: recapObs },
    { data: ownerRecords },
  ] = await Promise.all([
    db.from('travelers').select('*').order('created_at'),
    db.from('trips').select('*, restaurants(name)').eq('workspace_id', state.workspace_id).order('start_date'),
    db.from('trip_travelers').select('*'),
    db.from('itinerary_items').select('*').order('date').order('time', { nullsFirst: true }),
    db.from('agenda_blocks').select('*').order('date').order('sort_order'),
    db.from('agenda_templates').select('*').eq('workspace_id', state.workspace_id).order('name'),
    db.from('visit_recaps').select('*, restaurants(name)').order('created_at', { ascending: false }),
    db.from('recap_observations').select('*').order('sort_order'),
    db.from('owners').select('id, name').eq('workspace_id', state.workspace_id).order('sort_order'),
  ]);

  travelState.travelers = (travelers || []);
  travelState.ownerRecords = (ownerRecords || []);

  const ttByTrip = {};
  (tripTravelers || []).forEach(tt => {
    if (!ttByTrip[tt.trip_id]) ttByTrip[tt.trip_id] = [];
    ttByTrip[tt.trip_id].push(tt.traveler_id);
  });

  travelState.trips = (trips || []).map(t => ({
    ...t,
    restaurantName: t.restaurants ? t.restaurants.name : null,
    travelerIds: ttByTrip[t.id] || [],
  }));

  travelState.itineraryItems = (itinItems || []);
  travelState.agendaBlocks = (agendaBlocks || []);
  travelState.agendaTemplates = (agendaTemplates || []);
  travelState.recaps = (recaps || []).map(r => ({
    ...r,
    restaurantName: r.restaurants ? r.restaurants.name : null,
  }));
  travelState.recapObservations = (recapObs || []);

  computeQuarterlyStats();
}

async function dbSaveTrip(trip, travelerIds) {
  let id = trip.id;
  if (!id) {
    const { data, error } = await db.from('trips').insert({
      title:         trip.title,
      destination:   trip.destination,
      restaurant_id: trip.restaurant_id || null,
      start_date:    trip.start_date,
      end_date:      trip.end_date,
      notes:         trip.notes || null,
      workspace_id:  state.workspace_id,
    }).select('id').single();
    if (error) { console.error(error); return; }
    id = data.id;
  } else {
    const { error } = await db.from('trips').update({
      title:         trip.title,
      destination:   trip.destination,
      restaurant_id: trip.restaurant_id || null,
      start_date:    trip.start_date,
      end_date:      trip.end_date,
      notes:         trip.notes || null,
    }).eq('id', id);
    if (error) { console.error(error); return; }
    // Delete existing traveler links
    await db.from('trip_travelers').delete().eq('trip_id', id);
  }
  // Insert traveler links
  if (travelerIds.length > 0) {
    await db.from('trip_travelers').insert(
      travelerIds.map(tid => ({ trip_id: id, traveler_id: tid }))
    );
  }
  await loadTravelData();
  renderTravelView();
}

async function dbDeleteTrip(id) {
  await db.from('trips').delete().eq('id', id);
  await loadTravelData();
  closeTripModal();
  renderTravelView();
}

async function dbSaveItinItem(item) {
  if (item.id) {
    await db.from('itinerary_items').update({
      date:        item.date,
      time:        item.time || null,
      title:       item.title,
      description: item.description || null,
      type:        item.type,
      project_id:  item.project_id || null,
      completed:   item.completed,
    }).eq('id', item.id);
  } else {
    await db.from('itinerary_items').insert({
      trip_id:     item.trip_id,
      date:        item.date,
      time:        item.time || null,
      title:       item.title,
      description: item.description || null,
      type:        item.type,
      project_id:  item.project_id || null,
      completed:   item.completed || false,
    });
  }
  await loadTravelData();
  reopenTripModal(item.trip_id);
}

async function dbDeleteItinItem(id, tripId) {
  await db.from('itinerary_items').delete().eq('id', id);
  await loadTravelData();
  reopenTripModal(tripId);
}

async function dbToggleItinComplete(id, tripId, completed) {
  await db.from('itinerary_items').update({ completed: !completed }).eq('id', id);
  await loadTravelData();
  reopenTripModal(tripId);
}

async function dbSaveTraveler(t) {
  if (t.id) {
    await db.from('travelers').update({
      name: t.name, initials: t.initials, color: t.color, active: t.active,
    }).eq('id', t.id);
  } else {
    const row = { name: t.name, initials: t.initials, color: t.color, active: true };
    if (t.owner_id) row.owner_id = t.owner_id;
    await db.from('travelers').insert(row);
  }
  await loadTravelData();
  renderPeopleModal();
  renderTravelView();
}

async function dbDeleteTraveler(id) {
  const usedInTrips = travelState.trips.some(t => t.travelerIds.includes(id));
  if (usedInTrips && !confirm('This traveler is assigned to existing trips. Remove them anyway?')) return;
  await db.from('travelers').delete().eq('id', id);
  await loadTravelData();
  renderPeopleModal();
  renderTravelView();
}

async function dbToggleTravelerActive(id, current) {
  await db.from('travelers').update({ active: !current }).eq('id', id);
  await loadTravelData();
  renderPeopleModal();
  renderTravelView();
}

// ---- Helpers ----

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseLocalDate(str) {
  // Returns a Date at local midnight
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateStr(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function itinTypeIcon(type) {
  const icons = { flight: '✈️', hotel: '🏨', meeting: '🤝', 'site-visit': '👁️', meal: '🍽️', other: '📝' };
  return icons[type] || '📝';
}

function travelerById(id) {
  return travelState.travelers.find(t => t.id === id);
}

function autoInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---- Quarterly visit tracking ----

function getQuarterForDate(dateStr) {
  const d = parseLocalDate(dateStr);
  const m = d.getMonth(); // 0-indexed
  const q = Math.floor(m / 3) + 1;
  const y = d.getFullYear();
  return { quarter: q, year: y, label: 'Q' + q + ' ' + y };
}

function daysBetweenInclusive(startStr, endStr) {
  const s = parseLocalDate(startStr);
  const e = parseLocalDate(endStr);
  return Math.round((e - s) / 86400000) + 1;
}

function computeQuarterlyStats() {
  const stats = {}; // { restaurantName: { 'Q1 2026': {days, trips, tripIds}, ... } }

  travelState.trips.forEach(trip => {
    if (!trip.restaurantName) return;
    const rName = trip.restaurantName;
    if (!stats[rName]) stats[rName] = {};

    // Iterate each day of the trip and assign to correct quarter
    const start = parseLocalDate(trip.start_date);
    const end   = parseLocalDate(trip.end_date);
    const quartersSeen = new Set();

    const cur = new Date(start);
    while (cur <= end) {
      const ds = dateStr(cur);
      const qi = getQuarterForDate(ds);
      const qLabel = qi.label;
      if (!stats[rName][qLabel]) stats[rName][qLabel] = { days: 0, trips: 0, tripIds: [] };
      stats[rName][qLabel].days++;
      quartersSeen.add(qLabel);
      cur.setDate(cur.getDate() + 1);
    }

    // Count this trip once per quarter it touches
    quartersSeen.forEach(qLabel => {
      stats[rName][qLabel].trips++;
      stats[rName][qLabel].tripIds.push(trip.id);
    });
  });

  travelState.quarterlyStats = stats;
}

function getCurrentQuarterLabel() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return 'Q' + q + ' ' + now.getFullYear();
}

function getPreviousQuarterLabel(currentLabel) {
  const parts = currentLabel.split(' ');
  let q = parseInt(parts[0].replace('Q', ''));
  let y = parseInt(parts[1]);
  q--;
  if (q < 1) { q = 4; y--; }
  return 'Q' + q + ' ' + y;
}

function getLastVisitDate(restaurantName) {
  const now = new Date();
  let lastDate = null;
  travelState.trips.forEach(t => {
    if (t.restaurantName !== restaurantName) return;
    const end = parseLocalDate(t.end_date);
    if (end <= now && (!lastDate || end > lastDate)) lastDate = end;
  });
  return lastDate;
}

function buildQuarterlyWidget() {
  const curQ = getCurrentQuarterLabel();
  const prevQ = getPreviousQuarterLabel(curQ);
  const stats = travelState.quarterlyStats;
  const restaurants = state.restaurants || [];

  if (restaurants.length === 0) return '';

  const rows = restaurants.map(rName => {
    const rStats = stats[rName] || {};
    const cur = rStats[curQ] || { days: 0, trips: 0 };
    const prev = rStats[prevQ] || { days: 0, trips: 0 };
    const daysDelta = cur.days - prev.days;
    const tripsDelta = cur.trips - prev.trips;
    const daysArrow = daysDelta > 0 ? `<span class="qv-up">&#9650; ${daysDelta}</span>` :
                      daysDelta < 0 ? `<span class="qv-down">&#9660; ${Math.abs(daysDelta)}</span>` : '<span class="qv-flat">—</span>';
    const tripsArrow = tripsDelta > 0 ? `<span class="qv-up">&#9650; ${tripsDelta}</span>` :
                       tripsDelta < 0 ? `<span class="qv-down">&#9660; ${Math.abs(tripsDelta)}</span>` : '<span class="qv-flat">—</span>';

    const lastVisit = getLastVisitDate(rName);
    const lastVisitStr = lastVisit ? fmtDate(dateStr(lastVisit)) : 'Never';
    const daysSince = lastVisit ? Math.round((new Date() - lastVisit) / 86400000) : null;
    const daysSinceStr = daysSince !== null ? `(${daysSince}d ago)` : '';

    return `<tr>
      <td class="qv-restaurant">${escHtml(rName)}</td>
      <td class="qv-metric"><span class="qv-value">${cur.days}</span> days ${daysArrow}</td>
      <td class="qv-metric"><span class="qv-value">${cur.trips}</span> trips ${tripsArrow}</td>
      <td class="qv-last-visit">${lastVisitStr} <span class="qv-days-since">${daysSinceStr}</span></td>
    </tr>`;
  }).join('');

  return `
  <div class="quarterly-widget" id="quarterly-widget">
    <div class="qv-header" onclick="toggleQuarterlyWidget()">
      <h3>&#128200; Visit Tracking — ${escHtml(curQ)}</h3>
      <span class="qv-toggle" id="qv-toggle-icon">&#9660;</span>
    </div>
    <div class="qv-body" id="qv-body">
      <table class="qv-table">
        <thead>
          <tr>
            <th>Restaurant</th>
            <th>Days On-Site</th>
            <th>Trips</th>
            <th>Last Visit</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="qv-note">Compared to ${escHtml(prevQ)}</div>
    </div>
  </div>`;
}

function toggleQuarterlyWidget() {
  const body = document.getElementById('qv-body');
  const icon = document.getElementById('qv-toggle-icon');
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = '';
    icon.innerHTML = '&#9660;';
  } else {
    body.style.display = 'none';
    icon.innerHTML = '&#9654;';
  }
}

// ---- Main render ----

function renderTravelView() {
  const el = document.getElementById('travel-content');
  if (!el) return;

  if (travelState.view === 'calendar') {
    el.innerHTML = buildCalendarHTML();
  } else if (travelState.view === 'recaps') {
    el.innerHTML = buildRecapHistoryHTML();
  } else {
    el.innerHTML = buildListHTML();
  }
  const showWidget = travelState.view !== 'recaps';
  el.innerHTML = buildTravelHeaderHTML() + (showWidget ? buildQuarterlyWidget() : '') + el.innerHTML;
}

function buildTravelHeaderHTML() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const label = months[travelState.calMonth] + ' ' + travelState.calYear;
  const calActive    = travelState.view === 'calendar' ? 'active' : '';
  const listActive   = travelState.view === 'list'     ? 'active' : '';
  const recapsActive = travelState.view === 'recaps'   ? 'active' : '';

  const recapCount = (travelState.recaps || []).length;

  const calendarNav = travelState.view === 'calendar' ? `
    <div class="travel-month-nav">
      <button class="travel-nav-btn" onclick="travelPrevMonth()">&#8249;</button>
      <h2>${label}</h2>
      <button class="travel-nav-btn" onclick="travelNextMonth()">&#8250;</button>
    </div>` : `<div></div>`;

  return `
  <div class="travel-header">
    <div class="travel-header-left">
      ${calendarNav}
    </div>
    <div class="travel-header-actions">
      <div class="travel-view-toggle">
        <button class="travel-view-btn ${calActive}" onclick="travelSetView('calendar')">&#128197; Calendar</button>
        <button class="travel-view-btn ${listActive}" onclick="travelSetView('list')">&#9776; List</button>
        <button class="travel-view-btn ${recapsActive}" onclick="travelSetView('recaps')">&#128196; Recaps${recapCount > 0 ? ` (${recapCount})` : ''}</button>
      </div>
      <button class="travel-people-btn" title="Manage travelers" onclick="openPeopleModal()">&#9881;</button>
      <button class="btn-primary" onclick="openTripModal(null)">+ Add Trip</button>
    </div>
  </div>`;
}

function travelPrevMonth() {
  if (travelState.calMonth === 0) { travelState.calMonth = 11; travelState.calYear--; }
  else travelState.calMonth--;
  renderTravelView();
}

function travelNextMonth() {
  if (travelState.calMonth === 11) { travelState.calMonth = 0; travelState.calYear++; }
  else travelState.calMonth++;
  renderTravelView();
}

function travelSetView(v) {
  travelState.view = v;
  renderTravelView();
}

// ---- Calendar build ----

function buildCalendarHTML() {
  const year = travelState.calYear;
  const month = travelState.calMonth;
  const today = new Date();
  today.setHours(0,0,0,0);

  // First day of the month, last day
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Grid starts on Sunday
  const startOffset = firstDay.getDay(); // 0=Sun
  const gridStart   = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startOffset);

  // Always 6 rows × 7 cols = 42 cells
  const cells = [];
  const cur = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build trip-day index: date-string → [{trip, traveler, barClass}]
  const tripDayMap = {};
  travelState.trips.forEach(trip => {
    const start = parseLocalDate(trip.start_date);
    const end   = parseLocalDate(trip.end_date);
    trip.travelerIds.forEach(tid => {
      const traveler = travelerById(tid);
      if (!traveler) return;
      const d = new Date(start);
      while (d <= end) {
        const ds = dateStr(d);
        if (!tripDayMap[ds]) tripDayMap[ds] = [];
        const isStart = ds === trip.start_date;
        const isEnd   = ds === trip.end_date;
        let barClass = 'trip-mid';
        if (isStart && isEnd) barClass = 'trip-start trip-end';
        else if (isStart)      barClass = 'trip-start';
        else if (isEnd)        barClass = 'trip-end';
        tripDayMap[ds].push({ trip, traveler, barClass });
        d.setDate(d.getDate() + 1);
      }
    });
  });

  const cellsHTML = cells.map(d => {
    const ds = dateStr(d);
    const isOther = d.getMonth() !== month;
    const isToday = d.getTime() === today.getTime();
    let cls = 'travel-cal-cell';
    if (isOther) cls += ' other-month';
    if (isToday) cls += ' today';

    const bars = (tripDayMap[ds] || []).map(({ trip, traveler, barClass }) => {
      const showLabel = trip.start_date === ds;
      const tripTitle = trip.title.length > 22 ? trip.title.slice(0,20)+'…' : trip.title;
      return `<div class="trip-bar ${barClass}" style="background:${traveler.color}"
        onclick="openTripModal('${trip.id}')" title="${trip.title} — ${traveler.name}">
        ${showLabel ? `<span class="trip-bar-label">${tripTitle}</span>` : ''}
        <span class="trip-bar-initials">${traveler.initials}</span>
      </div>`;
    }).join('');

    return `<div class="${cls}">
      <div class="travel-cal-date-num">${d.getDate()}</div>
      ${bars}
    </div>`;
  }).join('');

  return `
  <div class="travel-calendar-grid">
    <div class="travel-cal-days-header">
      ${dayLabels.map(l => `<div class="travel-cal-day-label">${l}</div>`).join('')}
    </div>
    <div class="travel-cal-body">
      ${cellsHTML}
    </div>
  </div>`;
}

// ---- List build ----

function buildListHTML() {
  const today = dateStr(new Date());
  const sorted = [...travelState.trips].sort((a, b) => a.start_date.localeCompare(b.start_date));

  if (sorted.length === 0) {
    return `<div class="empty-state"><h3>No trips yet</h3><p>Click <strong>+ Add Trip</strong> to plan your first trip.</p></div>`;
  }

  const cards = sorted.map(trip => {
    const isPast = trip.end_date < today;
    const pills = trip.travelerIds.map(tid => {
      const t = travelerById(tid);
      if (!t) return '';
      return `<span class="trip-traveler-pill" style="background:${t.color}">${t.initials}</span>`;
    }).join('');
    const restBadge = trip.restaurantName ? `<span class="trip-card-restaurant">${trip.restaurantName}</span>` : '';
    return `<div class="trip-card ${isPast ? 'trip-past' : ''}" onclick="openTripModal('${trip.id}')">
      <div class="trip-card-travelers">
        ${trip.travelerIds.map(tid => {
          const t = travelerById(tid);
          return t ? `<div class="trip-traveler-dot" style="background:${t.color}" title="${t.name}"></div>` : '';
        }).join('')}
      </div>
      <div class="trip-card-body">
        <div class="trip-card-title">${trip.title}</div>
        <div class="trip-card-dest">${trip.destination}</div>
        <div class="trip-card-meta">
          <span class="trip-card-dates">${fmtDateShort(trip.start_date)} – ${fmtDateShort(trip.end_date)}</span>
          ${restBadge}
          <div class="trip-card-traveler-pills">${pills}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `<div class="travel-list">${cards}</div>`;
}

// ---- Trip Modal ----

function openTripModal(tripId) {
  travelState.editTripId = tripId;
  document.getElementById('trip-modal-overlay').classList.add('open');
  renderTripModal();
}

function closeTripModal() {
  travelState.editTripId = null;
  document.getElementById('trip-modal-overlay').classList.remove('open');
}

function reopenTripModal(tripId) {
  travelState.editTripId = tripId;
  renderTripModal();
}

function renderTripModal() {
  const tripId = travelState.editTripId;
  const trip   = tripId ? travelState.trips.find(t => t.id === tripId) : null;
  const isEdit = !!trip;

  document.getElementById('trip-modal-title').textContent = isEdit ? trip.title : 'New Trip';

  // Restaurant options
  const restOpts = state.restaurants.map(r => {
    const rObj = (travelState.trips.length > 0 ? [] : []).concat([]); // just need names
    const selected = trip && trip.restaurantName === r ? 'selected' : '';
    return `<option value="${r}" ${selected}>${r}</option>`;
  }).join('');

  // Need restaurant_id — look it up from restaurant name
  // We store restaurant_id in trip, but display name from join
  // Build restaurant select with IDs — we need to fetch from state
  // Actually the trips table uses restaurant_id (UUID FK to restaurants.id)
  // But our restaurants state only has names. Let's do a lookup of restaurant rows.
  // We'll use the name-to-ID map we build at load time from travelState.
  // For simplicity, build options from state.restaurants (names) but we need IDs.
  // Let's fetch that mapping now.

  // We need restaurants with IDs; state.restaurants only has names
  // We'll need to load them. For now use a separate approach:
  // Store restaurants with IDs in travelState.restaurantMap
  const restOptsHTML = buildRestaurantOptsHTML(trip);

  // Traveler checkboxes
  const activeTravelers = travelState.travelers.filter(t => t.active);
  const checkboxes = activeTravelers.map(t => {
    const checked = trip && trip.travelerIds.includes(t.id) ? 'checked' : '';
    return `<label class="traveler-checkbox-row ${checked ? 'selected' : ''}" onclick="">
      <input type="checkbox" name="trip-traveler" value="${t.id}" ${checked} onchange="this.closest('.traveler-checkbox-row').classList.toggle('selected',this.checked)">
      <span class="traveler-color-swatch" style="background:${t.color}"></span>
      <span class="traveler-checkbox-label">${t.name}</span>
    </label>`;
  }).join('');

  const body = `
  <div class="trip-modal-section">
    <div class="trip-modal-section-title">Trip Information</div>
    <div class="form-grid">
      <div class="form-group">
        <label>Trip Title <span class="required">*</span></label>
        <input type="text" class="form-input" id="trip-title" value="${trip ? trip.title.replace(/"/g,'&quot;') : ''}" placeholder="e.g. New York Culinary Tour">
      </div>
      <div class="form-group">
        <label>Destination <span class="required">*</span></label>
        <input type="text" class="form-input" id="trip-destination" value="${trip ? trip.destination.replace(/"/g,'&quot;') : ''}" placeholder="City, Country">
      </div>
      <div class="form-group">
        <label>Start Date <span class="required">*</span></label>
        <input type="date" class="form-input" id="trip-start" value="${trip ? trip.start_date : ''}">
      </div>
      <div class="form-group">
        <label>End Date <span class="required">*</span></label>
        <input type="date" class="form-input" id="trip-end" value="${trip ? trip.end_date : ''}">
      </div>
      <div class="form-group">
        <label>Restaurant (optional)</label>
        <select class="form-select" id="trip-restaurant">
          <option value="">None</option>
          ${restOptsHTML}
        </select>
      </div>
      <div class="form-group">
        <label>Notes (optional)</label>
        <textarea class="form-textarea" id="trip-notes" rows="2" style="min-height:60px">${trip ? (trip.notes || '') : ''}</textarea>
      </div>
    </div>
    <div class="form-group" style="margin-top:16px">
      <label>Travelers</label>
      <div class="traveler-checkboxes">${checkboxes || '<span style="color:var(--warm-gray);font-size:14px">No active travelers. Add travelers via the ⚙ button.</span>'}</div>
    </div>
  </div>
  ${isEdit ? buildRestaurantContextCard(trip) : ''}
  ${isEdit ? buildAgendaSection(tripId) : ''}
  ${isEdit ? buildPreTripChecklist(trip) : ''}
  ${isEdit ? buildItinerarySection(tripId) : ''}`;

  document.getElementById('trip-modal-body').innerHTML = body;

  // Footer — recap button for existing trips
  const existingRecap = isEdit ? travelState.recaps.find(r => r.trip_id === tripId) : null;
  const recapBtn = isEdit ? (existingRecap
    ? `<button class="btn-sm" style="background:var(--sage);color:white" onclick="closeTripModal();openRecapModal('${existingRecap.id}')">View Recap</button>`
    : `<button class="btn-sm" style="background:var(--sage);color:white" onclick="createRecapFromTrip('${tripId}')">Create Recap</button>`)
    : '';

  const footerHTML = `
    ${isEdit ? `<button class="btn-cancel" style="color:var(--rust);border-color:rgba(139,58,30,0.35)" onclick="confirmDeleteTrip('${tripId}')">Delete Trip</button>` : ''}
    ${recapBtn}
    <button class="btn-cancel" onclick="closeTripModal()">Cancel</button>
    <button class="btn-primary" onclick="saveTripModal()">Save Trip</button>`;
  document.getElementById('trip-modal-footer').innerHTML = footerHTML;
}

function buildRestaurantOptsHTML(trip) {
  // travelState.restaurantMap maps name→id
  const map = travelState.restaurantMap || {};
  return state.restaurants.map(name => {
    const id = map[name] || '';
    const selected = trip && trip.restaurant_id === id ? 'selected' : '';
    return `<option value="${id}" ${selected}>${name}</option>`;
  }).join('');
}

async function saveTripModal() {
  const title  = document.getElementById('trip-title').value.trim();
  const dest   = document.getElementById('trip-destination').value.trim();
  const start  = document.getElementById('trip-start').value;
  const end    = document.getElementById('trip-end').value;
  const restId = document.getElementById('trip-restaurant').value;
  const notes  = document.getElementById('trip-notes').value.trim();

  if (!title || !dest || !start || !end) {
    alert('Please fill in Title, Destination, Start Date, and End Date.');
    return;
  }
  if (end < start) {
    alert('End date must be on or after start date.');
    return;
  }

  const checkedBoxes = document.querySelectorAll('input[name="trip-traveler"]:checked');
  const travelerIds  = Array.from(checkedBoxes).map(cb => cb.value);

  const tripData = {
    id:            travelState.editTripId || null,
    title,
    destination:   dest,
    restaurant_id: restId || null,
    start_date:    start,
    end_date:      end,
    notes:         notes || null,
  };

  showLoading('Saving trip…');
  await dbSaveTrip(tripData, travelerIds);
  hideLoading();
  closeTripModal();
  renderTravelView();
}

function confirmDeleteTrip(tripId) {
  if (!confirm('Delete this trip and all its itinerary items? This cannot be undone.')) return;
  showLoading('Deleting…');
  dbDeleteTrip(tripId).then(() => { hideLoading(); });
}

// ---- Itinerary section ----

function buildItinerarySection(tripId) {
  const items = travelState.itineraryItems.filter(i => i.trip_id === tripId)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

  const itemsHTML = items.map(item => {
    const timeStr = item.time ? item.time.slice(0,5) : '';
    const meta    = [fmtDate(item.date), timeStr].filter(Boolean).join(' · ');
    const projText = item.project_id ? (() => {
      const p = state.projects.find(p => p.id === item.project_id);
      return p ? `<div class="itinerary-item-project">📌 ${p.title}</div>` : '';
    })() : '';
    return `<div class="itinerary-item">
      <div class="itinerary-item-check ${item.completed ? 'done' : ''}"
        onclick="dbToggleItinComplete('${item.id}','${tripId}',${item.completed})"></div>
      <div class="itinerary-item-type">${itinTypeIcon(item.type)}</div>
      <div class="itinerary-item-body">
        <div class="itinerary-item-title ${item.completed ? 'done' : ''}">${item.title}</div>
        <div class="itinerary-item-meta">${meta}</div>
        ${item.description ? `<div class="itinerary-item-desc">${item.description}</div>` : ''}
        ${projText}
      </div>
      <div class="itinerary-item-actions">
        <button class="itin-action-btn" onclick="openItinModal('${item.id}','${tripId}')">Edit</button>
        <button class="itin-action-btn del" onclick="dbDeleteItinItem('${item.id}','${tripId}')">Del</button>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="trip-modal-section">
    <div class="trip-modal-section-title">Itinerary</div>
    <div class="itinerary-list">
      ${items.length === 0 ? '<p style="color:var(--warm-gray);font-size:14px;padding:8px 0">No items yet.</p>' : itemsHTML}
    </div>
    <button class="btn-sm" style="margin-top:12px" onclick="openItinModal(null,'${tripId}')">+ Add Item</button>
  </div>`;
}

// ---- Itinerary Item Modal ----

function openItinModal(itinId, tripId) {
  travelState.editItinId    = itinId;
  travelState.editItinTripId = tripId;
  document.getElementById('itin-modal-overlay').classList.add('open');
  renderItinModal();
}

function closeItinModal() {
  document.getElementById('itin-modal-overlay').classList.remove('open');
  travelState.editItinId    = null;
  travelState.editItinTripId = null;
}

function renderItinModal() {
  const itinId = travelState.editItinId;
  const tripId = travelState.editItinTripId;
  const item   = itinId ? travelState.itineraryItems.find(i => i.id === itinId) : null;
  const trip   = travelState.trips.find(t => t.id === tripId);

  document.getElementById('itin-modal-title').textContent = item ? 'Edit Item' : 'Add Itinerary Item';

  const typeOpts = [
    ['flight','✈️ Flight'],['hotel','🏨 Hotel'],['meeting','🤝 Meeting'],
    ['site-visit','👁️ Site Visit'],['meal','🍽️ Meal'],['other','📝 Other'],
  ].map(([v,l]) => `<option value="${v}" ${item && item.type===v ? 'selected':''}>${l}</option>`).join('');

  // Project options — filtered to trip's restaurant if set
  const projPool = trip && trip.restaurant_id
    ? state.projects.filter(p => {
        const rObj = travelState.restaurantMap || {};
        const matchName = Object.entries(rObj).find(([name,id]) => id === trip.restaurant_id);
        return matchName ? p.restaurant === matchName[0] : true;
      })
    : state.projects;
  const projOpts = projPool.filter(p => !p.complete).map(p =>
    `<option value="${p.id}" ${item && item.project_id===p.id ? 'selected':''}>${p.restaurant} – ${p.title}</option>`
  ).join('');

  document.getElementById('itin-modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>Type <span class="required">*</span></label>
        <select class="form-select" id="itin-type">${typeOpts}</select>
      </div>
      <div class="form-group">
        <label>Date <span class="required">*</span></label>
        <input type="date" class="form-input" id="itin-date" value="${item ? item.date : (trip ? trip.start_date : '')}">
      </div>
      <div class="form-group full">
        <label>Title <span class="required">*</span></label>
        <input type="text" class="form-input" id="itin-title" value="${item ? item.title.replace(/"/g,'&quot;') : ''}" placeholder="e.g. Flight to JFK">
      </div>
      <div class="form-group">
        <label>Time (optional)</label>
        <input type="time" class="form-input" id="itin-time" value="${item && item.time ? item.time.slice(0,5) : ''}">
      </div>
      <div class="form-group">
        <label>Project (optional)</label>
        <select class="form-select" id="itin-project">
          <option value="">None</option>
          ${projOpts}
        </select>
      </div>
      <div class="form-group full">
        <label>Description (optional)</label>
        <textarea class="form-textarea" id="itin-description" rows="2" style="min-height:60px">${item ? (item.description || '') : ''}</textarea>
      </div>
    </div>`;

  document.getElementById('itin-modal-footer').innerHTML = `
    <button class="btn-cancel" onclick="closeItinModal()">Cancel</button>
    <button class="btn-primary" onclick="saveItinModal()">Save Item</button>`;
}

async function saveItinModal() {
  const type  = document.getElementById('itin-type').value;
  const date  = document.getElementById('itin-date').value;
  const title = document.getElementById('itin-title').value.trim();
  const time  = document.getElementById('itin-time').value || null;
  const proj  = document.getElementById('itin-project').value || null;
  const desc  = document.getElementById('itin-description').value.trim() || null;

  if (!title || !date) { alert('Please fill in Title and Date.'); return; }

  const item = {
    id:          travelState.editItinId || null,
    trip_id:     travelState.editItinTripId,
    date,
    time,
    title,
    description: desc,
    type,
    project_id:  proj,
    completed:   false,
  };

  showLoading('Saving…');
  await dbSaveItinItem(item);
  hideLoading();
  closeItinModal();
}

// ============================================================
// AGENDA BLOCKS
// ============================================================

function agendaBlockTypeIcon(type) {
  const icons = { 'tasting': '🍷', 'boh-walk': '🔧', 'service-obs': '👁️', 'debrief': '📋', 'meeting': '🤝', 'training': '📚', 'other': '📝' };
  return icons[type] || '📝';
}

function agendaBlockTypeLabel(type) {
  const labels = { 'tasting': 'Tasting', 'boh-walk': 'BOH Walk', 'service-obs': 'Service Obs', 'debrief': 'Debrief', 'meeting': 'Meeting', 'training': 'Training', 'other': 'Other' };
  return labels[type] || type;
}

async function dbSaveAgendaBlock(block) {
  const row = {
    trip_id:    block.trip_id,
    date:       block.date,
    start_time: block.start_time || null,
    end_time:   block.end_time || null,
    title:      block.title,
    type:       block.type || 'other',
    notes:      block.notes || null,
    sort_order: block.sort_order || 0,
    completed:  block.completed || false,
    project_id: block.project_id || null,
  };
  if (block.id) {
    await db.from('agenda_blocks').update(row).eq('id', block.id);
  } else {
    await db.from('agenda_blocks').insert(row);
  }
  await loadTravelData();
  reopenTripModal(block.trip_id);
}

async function dbDeleteAgendaBlock(id, tripId) {
  await db.from('agenda_blocks').delete().eq('id', id);
  await loadTravelData();
  reopenTripModal(tripId);
}

async function dbToggleAgendaComplete(id, tripId, current) {
  await db.from('agenda_blocks').update({ completed: !current }).eq('id', id);
  await loadTravelData();
  reopenTripModal(tripId);
}

async function dbApplyAgendaTemplate(tripId, templateId, date) {
  const tmpl = travelState.agendaTemplates.find(t => t.id === templateId);
  if (!tmpl || !tmpl.blocks || tmpl.blocks.length === 0) return;

  showLoading('Applying template…');
  const rows = tmpl.blocks.map((b, i) => ({
    trip_id:    tripId,
    date:       date,
    title:      b.title,
    type:       b.type || 'other',
    notes:      b.notes || null,
    sort_order: i + 1,
    completed:  false,
  }));
  await db.from('agenda_blocks').insert(rows);
  await loadTravelData();
  hideLoading();
  reopenTripModal(tripId);
}

function buildRestaurantContextCard(trip) {
  if (!trip || !trip.restaurantName) return '';

  const rName = trip.restaurantName;
  const curQ = getCurrentQuarterLabel();
  const qStats = travelState.quarterlyStats[rName] || {};
  const curQData = qStats[curQ] || { days: 0, trips: 0 };
  const lastVisit = getLastVisitDate(rName);
  const lastVisitStr = lastVisit ? fmtDate(dateStr(lastVisit)) : 'No previous visits';
  const daysSince = lastVisit ? Math.round((new Date() - lastVisit) / 86400000) : null;

  // Open tasks at this restaurant
  const openTasks = state.projects.filter(p => p.restaurant === rName && !p.complete && !p.archived);
  const overdueTasks = openTasks.filter(p => {
    const d = daysUntil(dueDate(p));
    return d !== null && d < 0;
  });

  return `
  <div class="trip-context-card">
    <div class="trip-context-title">&#128205; ${escHtml(rName)} — At a Glance</div>
    <div class="trip-context-grid">
      <div class="trip-context-stat">
        <div class="trip-context-value">${lastVisitStr}</div>
        <div class="trip-context-label">Last Visit${daysSince !== null ? ` (${daysSince}d ago)` : ''}</div>
      </div>
      <div class="trip-context-stat">
        <div class="trip-context-value">${curQData.days}d / ${curQData.trips} trips</div>
        <div class="trip-context-label">${escHtml(curQ)}</div>
      </div>
      <div class="trip-context-stat">
        <div class="trip-context-value">${openTasks.length}</div>
        <div class="trip-context-label">Open Tasks</div>
      </div>
      <div class="trip-context-stat">
        <div class="trip-context-value ${overdueTasks.length > 0 ? 'danger' : ''}">${overdueTasks.length}</div>
        <div class="trip-context-label">Overdue</div>
      </div>
    </div>
  </div>`;
}

function buildAgendaSection(tripId) {
  const trip = travelState.trips.find(t => t.id === tripId);
  if (!trip) return '';

  const blocks = travelState.agendaBlocks.filter(b => b.trip_id === tripId)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

  // Group by date
  const byDate = {};
  blocks.forEach(b => {
    if (!byDate[b.date]) byDate[b.date] = [];
    byDate[b.date].push(b);
  });

  const datesHTML = Object.entries(byDate).map(([date, items]) => {
    const dayItems = items.map(b => {
      const timeRange = b.start_time && b.end_time
        ? `<span class="ab-time">${b.start_time.slice(0,5)} – ${b.end_time.slice(0,5)}</span>`
        : b.start_time ? `<span class="ab-time">${b.start_time.slice(0,5)}</span>` : '';
      return `<div class="agenda-block-item ${b.completed ? 'done' : ''}">
        <div class="ab-check ${b.completed ? 'done' : ''}" onclick="dbToggleAgendaComplete('${b.id}','${tripId}',${b.completed})"></div>
        <div class="ab-icon">${agendaBlockTypeIcon(b.type)}</div>
        <div class="ab-body">
          <div class="ab-title ${b.completed ? 'done' : ''}">${escHtml(b.title)}</div>
          <div class="ab-meta">${timeRange} <span class="ab-type-badge">${agendaBlockTypeLabel(b.type)}</span></div>
          ${b.notes ? `<div class="ab-notes">${escHtml(b.notes)}</div>` : ''}
          ${b.project_id ? (() => { const p = state.projects.find(pr => pr.id === b.project_id); return p ? `<div class="ab-linked-task">&#128204; ${escHtml(p.title)}</div>` : ''; })() : ''}
        </div>
        <div class="ab-actions">
          <button class="itin-action-btn" onclick="openAgendaBlockModal('${b.id}','${tripId}')">Edit</button>
          <button class="itin-action-btn del" onclick="dbDeleteAgendaBlock('${b.id}','${tripId}')">Del</button>
        </div>
      </div>`;
    }).join('');

    return `<div class="ab-date-group">
      <div class="ab-date-header">${fmtDate(date)}</div>
      ${dayItems}
    </div>`;
  }).join('');

  // Template selector
  const templates = travelState.agendaTemplates || [];
  const tmplOpts = templates.map(t =>
    `<option value="${t.id}">${escHtml(t.name)}${t.description ? ' — ' + escHtml(t.description) : ''}</option>`
  ).join('');

  const tmplSection = templates.length > 0 ? `
  <div class="ab-template-row">
    <select class="form-select" id="ab-template-select" style="flex:1;font-size:13px">
      ${tmplOpts}
    </select>
    <input type="date" class="form-input" id="ab-template-date" value="${trip.start_date}" style="width:140px;font-size:13px">
    <button class="btn-sm" onclick="applyAgendaTemplateFromModal('${tripId}')">Apply Template</button>
  </div>` : '';

  return `
  <div class="trip-modal-section">
    <div class="trip-modal-section-title">Agenda</div>
    ${tmplSection}
    <div class="agenda-blocks-list">
      ${blocks.length === 0 ? '<p style="color:var(--warm-gray);font-size:14px;padding:8px 0">No agenda blocks yet. Apply a template or add blocks manually.</p>' : datesHTML}
    </div>
    <button class="btn-sm" style="margin-top:12px" onclick="openAgendaBlockModal(null,'${tripId}')">+ Add Block</button>
  </div>`;
}

function applyAgendaTemplateFromModal(tripId) {
  const sel = document.getElementById('ab-template-select');
  const dateInput = document.getElementById('ab-template-date');
  if (!sel || !dateInput || !dateInput.value) {
    alert('Please select a template and date.');
    return;
  }
  dbApplyAgendaTemplate(tripId, sel.value, dateInput.value);
}

function buildPreTripChecklist(trip) {
  if (!trip || !trip.restaurantName) return '';

  const rName = trip.restaurantName;
  const openTasks = state.projects.filter(p =>
    p.restaurant === rName && !p.complete && !p.archived
  ).sort((a, b) => {
    const da = daysUntil(dueDate(a));
    const db2 = daysUntil(dueDate(b));
    if (da === null && db2 === null) return 0;
    if (da === null) return 1;
    if (db2 === null) return -1;
    return da - db2;
  });

  if (openTasks.length === 0) return '';

  // Check which tasks are already on the agenda for this trip
  const agendaProjectIds = travelState.agendaBlocks
    .filter(b => b.trip_id === trip.id && b.project_id)
    .map(b => b.project_id);

  const tasksHTML = openTasks.map(p => {
    const dd = dueDate(p);
    const du = daysUntil(dd);
    const overdue = du !== null && du < 0;
    const alreadyOnAgenda = agendaProjectIds.includes(p.id);

    return `<div class="checklist-item">
      <div class="checklist-body">
        <div class="checklist-title">${escHtml(p.title)}</div>
        <div class="checklist-meta">
          ${p.category ? `<span class="checklist-cat">${escHtml(p.category)}</span>` : ''}
          ${p.owner ? `<span class="checklist-owner">${escHtml(p.owner)}</span>` : ''}
          ${dd ? `<span class="checklist-due ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue ' + Math.abs(du) + 'd' : 'Due ' + fmtDate(dd)}</span>` : ''}
        </div>
      </div>
      <div class="checklist-actions">
        ${alreadyOnAgenda
          ? '<span class="checklist-on-agenda">&#10003; On Agenda</span>'
          : `<button class="btn-sm checklist-add-btn" onclick="addTaskToAgenda('${trip.id}','${p.id}')">+ Agenda</button>`}
      </div>
    </div>`;
  }).join('');

  return `
  <div class="trip-modal-section">
    <div class="trip-modal-section-title">&#9745; Open Tasks at ${escHtml(rName)} (${openTasks.length})</div>
    <div class="checklist-list">${tasksHTML}</div>
  </div>`;
}

async function addTaskToAgenda(tripId, projectId) {
  const trip = travelState.trips.find(t => t.id === tripId);
  const project = state.projects.find(p => p.id === projectId);
  if (!trip || !project) return;

  // Map project category to agenda block type
  const catTypeMap = {
    'Culinary': 'tasting',
    'Beverage': 'tasting',
    'Dining Room': 'service-obs',
    'Administrative': 'meeting',
    'Collateral/Menu': 'meeting',
  };
  const blockType = catTypeMap[project.category] || 'meeting';

  await dbSaveAgendaBlock({
    trip_id:    tripId,
    date:       trip.start_date,
    title:      project.title,
    type:       blockType,
    notes:      project.description || null,
    project_id: projectId,
    sort_order: travelState.agendaBlocks.filter(b => b.trip_id === tripId).length + 1,
  });
}

// ---- Agenda Block Modal ----

function openAgendaBlockModal(blockId, tripId) {
  travelState.editAgendaBlockId = blockId;
  travelState.editItinTripId = tripId; // reuse for context
  document.getElementById('agenda-block-modal-overlay').classList.add('open');
  renderAgendaBlockModal();
}

function closeAgendaBlockModal() {
  document.getElementById('agenda-block-modal-overlay').classList.remove('open');
  travelState.editAgendaBlockId = null;
}

function renderAgendaBlockModal() {
  const blockId = travelState.editAgendaBlockId;
  const tripId  = travelState.editItinTripId;
  const block   = blockId ? travelState.agendaBlocks.find(b => b.id === blockId) : null;
  const trip    = travelState.trips.find(t => t.id === tripId);

  document.getElementById('agenda-block-modal-title').textContent = block ? 'Edit Agenda Block' : 'Add Agenda Block';

  const typeOpts = [
    ['tasting','🍷 Tasting'],['boh-walk','🔧 BOH Walk'],['service-obs','👁️ Service Observation'],
    ['debrief','📋 Debrief'],['meeting','🤝 Meeting'],['training','📚 Training'],['other','📝 Other'],
  ].map(([v,l]) => `<option value="${v}" ${block && block.type===v ? 'selected':''}>${l}</option>`).join('');

  document.getElementById('agenda-block-modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>Type <span class="required">*</span></label>
        <select class="form-select" id="ab-type">${typeOpts}</select>
      </div>
      <div class="form-group">
        <label>Date <span class="required">*</span></label>
        <input type="date" class="form-input" id="ab-date" value="${block ? block.date : (trip ? trip.start_date : '')}">
      </div>
      <div class="form-group full">
        <label>Title <span class="required">*</span></label>
        <input type="text" class="form-input" id="ab-title" value="${block ? block.title.replace(/"/g,'&quot;') : ''}" placeholder="e.g. Morning Tasting">
      </div>
      <div class="form-group">
        <label>Start Time</label>
        <input type="time" class="form-input" id="ab-start-time" value="${block && block.start_time ? block.start_time.slice(0,5) : ''}">
      </div>
      <div class="form-group">
        <label>End Time</label>
        <input type="time" class="form-input" id="ab-end-time" value="${block && block.end_time ? block.end_time.slice(0,5) : ''}">
      </div>
      <div class="form-group full">
        <label>Notes</label>
        <textarea class="form-textarea" id="ab-notes" rows="3">${block ? (block.notes || '') : ''}</textarea>
      </div>
    </div>`;

  document.getElementById('agenda-block-modal-footer').innerHTML = `
    <button class="btn-cancel" onclick="closeAgendaBlockModal()">Cancel</button>
    <button class="btn-primary" onclick="saveAgendaBlockModal()">Save Block</button>`;
}

async function saveAgendaBlockModal() {
  const title = document.getElementById('ab-title').value.trim();
  const date  = document.getElementById('ab-date').value;
  if (!title || !date) { alert('Title and date are required.'); return; }

  const block = {
    id:         travelState.editAgendaBlockId || null,
    trip_id:    travelState.editItinTripId,
    date:       date,
    start_time: document.getElementById('ab-start-time').value || null,
    end_time:   document.getElementById('ab-end-time').value || null,
    title:      title,
    type:       document.getElementById('ab-type').value,
    notes:      document.getElementById('ab-notes').value.trim() || null,
  };

  showLoading('Saving…');
  await dbSaveAgendaBlock(block);
  hideLoading();
  closeAgendaBlockModal();
}

// ---- People Manager Modal ----

function openPeopleModal() {
  document.getElementById('people-modal-overlay').classList.add('open');
  renderPeopleModal();
}

function closePeopleModal() {
  document.getElementById('people-modal-overlay').classList.remove('open');
}

function renderPeopleModal() {
  const travelers = travelState.travelers;

  // Find owners who are NOT yet linked as travelers
  const linkedOwnerIds = travelers.filter(t => t.owner_id).map(t => t.owner_id);

  // We need to look up owners from state.owners (names) and match to the owners table
  // We'll fetch owner records with ids from the DB. For now, build from state data.
  const unlinkedOwners = (travelState.ownerRecords || []).filter(o => !linkedOwnerIds.includes(o.id));

  const listHTML = travelers.map(t => `
    <div class="people-item">
      <div class="people-color-dot" style="background:${t.color}"></div>
      <div class="people-initials-badge" style="background:${t.color}">${t.initials}</div>
      <div class="people-name">${escHtml(t.name)}</div>
      <button class="people-active-toggle ${t.active ? 'active' : ''}"
        onclick="dbToggleTravelerActive('${t.id}',${t.active})">
        ${t.active ? 'Active' : 'Inactive'}
      </button>
      <button class="people-delete-btn" onclick="dbDeleteTraveler('${t.id}')">Del</button>
    </div>`).join('');

  // Unlinked team members section
  const unlinkedHTML = unlinkedOwners.length > 0 ? unlinkedOwners.map(o => {
    const initials = autoInitials(o.name);
    return `<div class="people-item people-unlinked">
      <div class="people-initials-badge" style="background:var(--warm-gray);color:white">${initials}</div>
      <div class="people-name">${escHtml(o.name)}</div>
      <button class="btn-sm checklist-add-btn" onclick="addOwnerAsTraveler('${o.id}')">+ Add as Traveler</button>
    </div>`;
  }).join('') : '<p style="color:var(--warm-gray);font-size:13px">All team members are set up as travelers.</p>';

  document.getElementById('people-modal-body').innerHTML = `
    <div class="people-section-label">Active Travelers</div>
    <div class="people-list">${listHTML || '<p style="color:var(--warm-gray)">No travelers yet. Add team members below.</p>'}</div>
    <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
    <div class="people-section-label">Team Members</div>
    <p style="color:var(--ink-light);font-size:12px;margin:0 0 10px">Team members from the Admin tab. Click to add them as travelers.</p>
    <div class="people-list">${unlinkedHTML}</div>`;
}

async function addOwnerAsTraveler(ownerId) {
  const ownerRec = (travelState.ownerRecords || []).find(o => o.id === ownerId);
  if (!ownerRec) return;

  // Pick the next available color from palette
  const usedColors = travelState.travelers.map(t => t.color);
  const availColor = TRAVELER_PALETTE.find(c => !usedColors.includes(c)) || TRAVELER_PALETTE[0];

  showLoading('Adding traveler…');
  await dbSaveTraveler({
    name: ownerRec.name,
    initials: autoInitials(ownerRec.name),
    color: availColor,
    owner_id: ownerId,
  });
  hideLoading();
}

// (Color selection and manual add removed — travelers are now added from team members list)

// ============================================================
// SITE VISIT RECAP TOOL
// ============================================================

// ---- Recap DB layer ----

async function dbSaveRecap(recap) {
  const row = {
    trip_id:         recap.trip_id,
    restaurant_id:   recap.restaurant_id || null,
    summary:         recap.summary || null,
    next_visit_date: recap.next_visit_date || null,
    followup_notes:  recap.followup_notes || null,
    status:          recap.status || 'draft',
  };
  if (recap.id) {
    await db.from('visit_recaps').update(row).eq('id', recap.id);
  } else {
    const { data, error } = await db.from('visit_recaps').insert(row).select().single();
    if (error) throw error;
    return data;
  }
  return recap;
}

async function dbDeleteRecap(id) {
  if (!confirm('Delete this recap and all observations? This cannot be undone.')) return;
  await db.from('visit_recaps').delete().eq('id', id);
  await loadTravelData();
  closeRecapModal();
  renderTravelView();
  showToast('Recap deleted');
}

async function dbFinalizeRecap(id) {
  await db.from('visit_recaps').update({ status: 'final' }).eq('id', id);
  await loadTravelData();
  reopenRecapModal(id);
  showToast('Recap marked as final');
}

async function dbSaveObservation(obs) {
  const row = {
    recap_id:  obs.recap_id,
    category:  obs.category,
    text:      obs.text,
    sort_order: obs.sort_order || 0,
  };
  if (obs.id) {
    await db.from('recap_observations').update(row).eq('id', obs.id);
  } else {
    await db.from('recap_observations').insert(row);
  }
  await loadTravelData();
}

async function dbDeleteObservation(id, recapId) {
  await db.from('recap_observations').delete().eq('id', id);
  await loadTravelData();
  reopenRecapModal(recapId);
}

async function dbConvertObsToTask(obsId, recapId, restaurantName) {
  const obs = travelState.recapObservations.find(o => o.id === obsId);
  if (!obs) return;

  showLoading('Creating task…');
  const catMap = { 'culinary': 'Culinary', 'beverage': 'Beverage', 'service': 'Dining Room', 'facilities': 'Administrative' };
  const newProject = {
    id: uid(),
    restaurant: restaurantName,
    title: obs.text.length > 80 ? obs.text.substring(0, 77) + '...' : obs.text,
    category: catMap[obs.category] || '',
    type: '',
    description: obs.text,
    owner: '',
    priority: 'Medium',
    weeks: null,
    dateAdded: today(),
    complete: false,
    link: '',
    dueDate: null,
    notes: [],
    subtasks: [],
    archived: false,
    isComplex: false,
  };
  await dbUpsertProject(newProject);
  state.projects.push(newProject);

  // Update observation
  await db.from('recap_observations').update({ converted_to_task_id: newProject.id }).eq('id', obsId);
  await loadTravelData();
  hideLoading();
  render();
  reopenRecapModal(recapId);
  showToast('Observation converted to task');
}

// ---- Recap UI ----

async function createRecapFromTrip(tripId) {
  const trip = travelState.trips.find(t => t.id === tripId);
  if (!trip) return;

  showLoading('Creating recap…');
  const recap = await dbSaveRecap({
    trip_id: tripId,
    restaurant_id: trip.restaurant_id || null,
    status: 'draft',
  });
  await loadTravelData();
  hideLoading();
  closeTripModal();
  openRecapModal(recap.id);
}

function openRecapModal(recapId) {
  travelState.editRecapId = recapId;
  document.getElementById('recap-modal-overlay').classList.add('open');
  renderRecapModal();
}

function closeRecapModal() {
  document.getElementById('recap-modal-overlay').classList.remove('open');
  travelState.editRecapId = null;
}

function reopenRecapModal(recapId) {
  travelState.editRecapId = recapId;
  renderRecapModal();
}

// Active observation category tab
let _recapObsTab = 'culinary';

function renderRecapModal() {
  const recapId = travelState.editRecapId;
  const recap = travelState.recaps.find(r => r.id === recapId);
  if (!recap) return;

  const trip = travelState.trips.find(t => t.id === recap.trip_id);
  const restaurantName = recap.restaurantName || (trip ? trip.restaurantName : '') || 'Unknown';

  // Trip travelers
  const travelerNames = trip ? trip.travelerIds.map(tid => {
    const t = travelState.travelers.find(tr => tr.id === tid);
    return t ? t.name : '';
  }).filter(Boolean).join(', ') : '';

  document.getElementById('recap-modal-title').textContent = 'Site Visit Recap';

  // Header card
  const headerHTML = `
  <div class="recap-header-card">
    <div class="recap-header-title">${escHtml(restaurantName)} — Site Visit Recap</div>
    <div class="recap-header-meta">
      ${trip ? `<strong>Trip:</strong> ${escHtml(trip.title)}<br>` : ''}
      ${trip ? `<strong>Dates:</strong> ${fmtDate(trip.start_date)} — ${fmtDate(trip.end_date)}<br>` : ''}
      ${trip ? `<strong>Destination:</strong> ${escHtml(trip.destination)}<br>` : ''}
      ${travelerNames ? `<strong>Visitors:</strong> ${escHtml(travelerNames)}` : ''}
    </div>
    <div style="margin-top:8px">
      <span class="recap-status-badge ${recap.status}">${recap.status}</span>
    </div>
  </div>`;

  // Executive summary
  const summaryHTML = `
  <div class="recap-section">
    <div class="recap-section-title">Executive Summary</div>
    <textarea class="form-textarea" id="recap-summary" rows="4" placeholder="Write a brief overview of the visit findings…"
      ${recap.status === 'final' ? 'disabled' : ''}>${recap.summary || ''}</textarea>
  </div>`;

  // Observations tabs
  const categories = ['culinary', 'beverage', 'service', 'facilities'];
  const catLabels = { culinary: 'Culinary', beverage: 'Beverage', service: 'Service', facilities: 'Facilities' };
  const allObs = travelState.recapObservations.filter(o => o.recap_id === recapId);

  const tabsHTML = categories.map(cat => {
    const count = allObs.filter(o => o.category === cat).length;
    return `<button class="recap-obs-tab ${_recapObsTab === cat ? 'active' : ''}" onclick="_recapObsTab='${cat}';renderRecapModal()">${catLabels[cat]} (${count})</button>`;
  }).join('');

  const catObs = allObs.filter(o => o.category === _recapObsTab);
  const obsListHTML = catObs.map(obs => {
    const isConverted = !!obs.converted_to_task_id;
    return `<div class="recap-obs-item">
      <div class="recap-obs-text ${isConverted ? 'converted' : ''}">${escHtml(obs.text)}</div>
      <div class="recap-obs-actions">
        ${!isConverted && recap.status !== 'final' ? `<button class="itin-action-btn" style="font-size:11px;white-space:nowrap" onclick="dbConvertObsToTask('${obs.id}','${recapId}','${escHtml(restaurantName)}')">→ Task</button>` : ''}
        ${isConverted ? '<span style="font-size:11px;color:var(--sage)">✓ Task</span>' : ''}
        ${recap.status !== 'final' ? `<button class="itin-action-btn del" onclick="dbDeleteObservation('${obs.id}','${recapId}')">Del</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const addObsHTML = recap.status !== 'final' ? `
  <div style="display:flex;gap:8px;margin-top:10px">
    <input type="text" class="form-input" id="recap-new-obs" placeholder="Add observation…" style="flex:1" onkeypress="if(event.key==='Enter')addObservation('${recapId}')">
    <button class="btn-sm" onclick="addObservation('${recapId}')">Add</button>
  </div>` : '';

  const observationsHTML = `
  <div class="recap-section">
    <div class="recap-section-title">Observations</div>
    <div class="recap-obs-tabs">${tabsHTML}</div>
    <div class="recap-obs-list">
      ${catObs.length === 0 ? '<p style="color:var(--warm-gray);font-size:14px;padding:8px 0">No observations in this category yet.</p>' : obsListHTML}
    </div>
    ${addObsHTML}
  </div>`;

  // Action items — tasks created during trip window at this restaurant
  let actionItemsHTML = '';
  if (trip) {
    const tripTasks = state.projects.filter(p =>
      p.restaurant === restaurantName &&
      p.dateAdded >= trip.start_date &&
      p.dateAdded <= trip.end_date
    );
    const tasksListHTML = tripTasks.map(p => {
      const dd = dueDate(p);
      return `<div class="recap-action-item">
        <div class="recap-action-title">${escHtml(p.title)}</div>
        <div class="recap-action-meta">
          ${p.owner ? escHtml(p.owner) : ''}
          ${dd ? ' · Due ' + fmtDate(dd) : ''}
          ${p.complete ? ' · ✓ Complete' : ''}
        </div>
      </div>`;
    }).join('');

    // Also include observations converted to tasks
    const convObs = allObs.filter(o => o.converted_to_task_id);
    const convTasksHTML = convObs.map(obs => {
      const p = state.projects.find(pr => pr.id === obs.converted_to_task_id);
      if (!p) return '';
      const dd = dueDate(p);
      return `<div class="recap-action-item">
        <div class="recap-action-title">${escHtml(p.title)}</div>
        <div class="recap-action-meta">
          From observation · ${p.owner ? escHtml(p.owner) : ''}${dd ? ' · Due ' + fmtDate(dd) : ''}
        </div>
      </div>`;
    }).filter(Boolean).join('');

    const allActionItems = tasksListHTML + convTasksHTML;
    actionItemsHTML = `
    <div class="recap-section">
      <div class="recap-section-title">Action Items</div>
      ${allActionItems || '<p style="color:var(--warm-gray);font-size:14px;padding:8px 0">No tasks created during this trip window.</p>'}
    </div>`;
  }

  // Follow-up
  const followupHTML = `
  <div class="recap-section">
    <div class="recap-section-title">Follow-Up</div>
    <div class="form-grid">
      <div class="form-group">
        <label>Next Visit Date</label>
        <input type="date" class="form-input" id="recap-next-visit" value="${recap.next_visit_date || ''}" ${recap.status === 'final' ? 'disabled' : ''}>
      </div>
    </div>
    <div class="form-group" style="margin-top:12px">
      <label>30-Day Check-in Notes</label>
      <textarea class="form-textarea" id="recap-followup" rows="3" placeholder="Items to review at the 30-day mark…"
        ${recap.status === 'final' ? 'disabled' : ''}>${recap.followup_notes || ''}</textarea>
    </div>
  </div>`;

  document.getElementById('recap-modal-body').innerHTML =
    headerHTML + summaryHTML + observationsHTML + actionItemsHTML + followupHTML;

  // Footer
  const isFinal = recap.status === 'final';
  document.getElementById('recap-modal-footer').innerHTML = `
    <button class="btn-cancel" style="color:var(--rust);border-color:rgba(139,58,30,0.35)" onclick="dbDeleteRecap('${recapId}')">Delete</button>
    ${!isFinal ? `<button class="btn-sm" onclick="saveRecapDraft('${recapId}')">Save Draft</button>` : ''}
    ${!isFinal ? `<button class="btn-sm" style="background:var(--sage);color:white" onclick="dbFinalizeRecap('${recapId}')">Mark Final</button>` : ''}
    <button class="btn-primary" onclick="printRecap('${recapId}')">&#128424; Export PDF</button>
    <button class="btn-cancel" onclick="closeRecapModal()">Close</button>`;
}

async function addObservation(recapId) {
  const input = document.getElementById('recap-new-obs');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const existingObs = travelState.recapObservations.filter(o => o.recap_id === recapId && o.category === _recapObsTab);
  await dbSaveObservation({
    recap_id:   recapId,
    category:   _recapObsTab,
    text:       text,
    sort_order: existingObs.length + 1,
  });
  reopenRecapModal(recapId);
}

async function saveRecapDraft(recapId) {
  const recap = travelState.recaps.find(r => r.id === recapId);
  if (!recap) return;

  showLoading('Saving…');
  await dbSaveRecap({
    id:              recapId,
    trip_id:         recap.trip_id,
    restaurant_id:   recap.restaurant_id,
    summary:         document.getElementById('recap-summary').value.trim(),
    next_visit_date: document.getElementById('recap-next-visit').value || null,
    followup_notes:  document.getElementById('recap-followup').value.trim(),
    status:          'draft',
  });
  await loadTravelData();
  hideLoading();
  reopenRecapModal(recapId);
  showToast('Recap saved');
}

// ---- Recap History View ----

function buildRecapHistoryHTML() {
  const recaps = travelState.recaps || [];

  if (recaps.length === 0) {
    return '<p style="color:var(--warm-gray);font-size:14px;padding:20px 0">No recaps yet. Create one from a trip.</p>';
  }

  // Restaurant filter
  const restaurants = [...new Set(recaps.map(r => r.restaurantName).filter(Boolean))];
  const filterOpts = restaurants.map(r => `<option value="${r}">${r}</option>`).join('');
  const filterHTML = `
  <div style="margin-bottom:16px">
    <select class="form-select" id="recap-history-filter" onchange="renderRecapHistoryFiltered()" style="font-size:13px">
      <option value="">All Restaurants</option>
      ${filterOpts}
    </select>
  </div>`;

  const listHTML = recaps.map(r => {
    const trip = travelState.trips.find(t => t.id === r.trip_id);
    return `<div class="recap-history-item" data-restaurant="${escHtml(r.restaurantName || '')}" onclick="openRecapModal('${r.id}')">
      <div class="recap-history-info">
        <div class="recap-history-title">${escHtml(r.restaurantName || 'Unknown')} — ${trip ? escHtml(trip.title) : 'Trip'}</div>
        <div class="recap-history-meta">${fmtDate(r.created_at ? r.created_at.split('T')[0] : '')} ${trip ? '· ' + fmtDate(trip.start_date) + ' – ' + fmtDate(trip.end_date) : ''}</div>
      </div>
      <span class="recap-status-badge ${r.status}">${r.status}</span>
    </div>`;
  }).join('');

  return filterHTML + `<div class="recap-history-list" id="recap-history-list">${listHTML}</div>`;
}

function renderRecapHistoryFiltered() {
  const filter = document.getElementById('recap-history-filter').value;
  const items = document.querySelectorAll('.recap-history-item');
  items.forEach(item => {
    if (!filter || item.dataset.restaurant === filter) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// ---- Recap PDF Export ----

function printRecap(recapId) {
  const recap = travelState.recaps.find(r => r.id === recapId);
  if (!recap) return;

  const trip = travelState.trips.find(t => t.id === recap.trip_id);
  const restaurantName = recap.restaurantName || 'Unknown';
  const travelerNames = trip ? trip.travelerIds.map(tid => {
    const t = travelState.travelers.find(tr => tr.id === tid);
    return t ? t.name : '';
  }).filter(Boolean).join(', ') : '';

  const allObs = travelState.recapObservations.filter(o => o.recap_id === recapId);
  const categories = ['culinary', 'beverage', 'service', 'facilities'];
  const catLabels = { culinary: 'Culinary', beverage: 'Beverage', service: 'Service / FOH', facilities: 'Facilities' };

  // Observations by category
  const obsHTML = categories.map(cat => {
    const obs = allObs.filter(o => o.category === cat);
    if (obs.length === 0) return '';
    const items = obs.map(o => `<li style="margin-bottom:6px;line-height:1.6">${escHtml(o.text)}${o.converted_to_task_id ? ' <em style="color:#4A5C4A">(→ Task created)</em>' : ''}</li>`).join('');
    return `<div style="margin-bottom:16px">
      <h3 style="font-size:14px;font-weight:600;color:#1C1915;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">${catLabels[cat]}</h3>
      <ul style="margin:0;padding-left:20px;color:#3D3830">${items}</ul>
    </div>`;
  }).join('');

  // Action items
  let actionItemsHTML = '';
  if (trip) {
    const tripTasks = state.projects.filter(p =>
      p.restaurant === restaurantName &&
      p.dateAdded >= trip.start_date && p.dateAdded <= trip.end_date
    );
    const convTasks = allObs.filter(o => o.converted_to_task_id).map(o =>
      state.projects.find(p => p.id === o.converted_to_task_id)
    ).filter(Boolean);
    const allTasks = [...tripTasks, ...convTasks.filter(ct => !tripTasks.some(tt => tt.id === ct.id))];

    if (allTasks.length > 0) {
      const rows = allTasks.map(p => {
        const dd = dueDate(p);
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #D4CBB8">${escHtml(p.title)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #D4CBB8">${escHtml(p.owner || '—')}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #D4CBB8">${dd ? fmtDate(dd) : '—'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #D4CBB8">${p.complete ? '✓' : '○'}</td>
        </tr>`;
      }).join('');
      actionItemsHTML = `
      <h2 style="font-family:'DM Sans',sans-serif;font-size:20px;font-weight:400;margin:24px 0 12px;color:#1C1915">Action Items</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#EDE7DC">
          <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8C8278">Task</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8C8278">Owner</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8C8278">Due Date</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8C8278">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }
  }

  // Follow-up
  const followupHTML = (recap.next_visit_date || recap.followup_notes) ? `
  <h2 style="font-family:'DM Sans',sans-serif;font-size:20px;font-weight:400;margin:24px 0 12px;color:#1C1915">Follow-Up</h2>
  ${recap.next_visit_date ? `<p style="font-size:14px;color:#3D3830"><strong>Next Visit:</strong> ${fmtDate(recap.next_visit_date)}</p>` : ''}
  ${recap.followup_notes ? `<p style="font-size:14px;color:#3D3830;line-height:1.6"><strong>30-Day Check-in:</strong><br>${escHtml(recap.followup_notes).replace(/\n/g, '<br>')}</p>` : ''}` : '';

  // Get logo from header
  const logoEl = document.querySelector('.header-logos img');
  const logoSrc = logoEl ? logoEl.src : '';

  const html = `
  <div style="font-family:'DM Sans',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1C1915">
    ${logoSrc ? `<div style="text-align:center;margin-bottom:24px"><img src="${logoSrc}" style="height:40px;opacity:0.8"></div>` : ''}
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-family:'DM Sans',sans-serif;font-size:28px;font-weight:400;margin:0 0 8px">${escHtml(restaurantName)}</h1>
      <div style="font-size:15px;color:#3D3830">Site Visit Recap</div>
      ${trip ? `<div style="font-size:13px;color:#8C8278;margin-top:6px">${fmtDate(trip.start_date)} — ${fmtDate(trip.end_date)} · ${escHtml(trip.destination)}</div>` : ''}
      ${travelerNames ? `<div style="font-size:13px;color:#8C8278;margin-top:4px">Visitors: ${escHtml(travelerNames)}</div>` : ''}
    </div>
    <hr style="border:none;border-top:1px solid #D4CBB8;margin:0 0 24px">
    ${recap.summary ? `
    <h2 style="font-family:'DM Sans',sans-serif;font-size:20px;font-weight:400;margin:0 0 12px;color:#1C1915">Executive Summary</h2>
    <p style="font-size:14px;line-height:1.7;color:#3D3830;margin-bottom:24px">${escHtml(recap.summary).replace(/\n/g, '<br>')}</p>` : ''}
    ${obsHTML ? `
    <h2 style="font-family:'DM Sans',sans-serif;font-size:20px;font-weight:400;margin:0 0 16px;color:#1C1915">Observations</h2>
    ${obsHTML}` : ''}
    ${actionItemsHTML}
    ${followupHTML}
    <hr style="border:none;border-top:1px solid #D4CBB8;margin:32px 0 16px">
    <div style="text-align:center;font-size:11px;color:#8C8278">
      SC Culinary · ${escHtml(restaurantName)} · ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}
    </div>
  </div>`;

  const printView = document.getElementById('print-view');
  printView.innerHTML = html;
  setTimeout(() => window.print(), 300);
}

// ---- Travel header — Recaps button ----

// ---- Load restaurant ID map ----

