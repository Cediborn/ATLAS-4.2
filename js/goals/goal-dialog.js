// Atlas — Goal create/edit dialog. Same shell pattern as
// habits/habit-dialog.js and calendar/event-panel.js — independent
// implementation, since each form shares nothing with the others but the
// container shape.

import { icon } from '../icons.js';
import { CATEGORY_CONFIG, CATEGORIES, TIMEFRAME_CONFIG, TIMEFRAMES, STATUSES, GOAL_COLORS } from './data.js';
import { PRIORITIES } from '../components.js';
import { createGoal, updateGoal, deleteGoal } from './state.js';
import { projects } from '../projects/data.js';
import { habits } from '../habits/data.js';
import { notes } from '../notes/data.js';

let els = null;
let lastFocused = null;
let onSavedCallback = null;

function ensureShell() {
  if (els) return;
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div class="overlay goal-dialog-overlay" id="goal-dialog-overlay" hidden><div class="goal-dialog-shell" id="goal-dialog-shell" role="dialog" aria-modal="true"></div></div>'
  );
  els = { overlay: document.getElementById('goal-dialog-overlay'), shell: document.getElementById('goal-dialog-shell') };
  els.overlay.addEventListener('click', (e) => {
    if (e.target === els.overlay) closeGoalDialog();
  });
  document.addEventListener('keydown', (e) => {
    if (els.overlay.hidden) return;
    if (e.key === 'Escape') closeGoalDialog();
    else if (e.key === 'Tab') trapFocus(e);
  });
}

function trapFocus(e) {
  const focusable = els.shell.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function closeGoalDialog() {
  if (!els) return;
  els.overlay.hidden = true;
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}

function openOverlay() {
  ensureShell();
  lastFocused = document.activeElement;
  els.overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

export function openGoalDialog(mode, existingOrNull, onSaved) {
  openOverlay();
  onSavedCallback = onSaved || null;
  renderDialog(mode, existingOrNull);
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

function multiSelectOptions(items, selectedIds, labelFn) {
  return items.map((item) => `<option value="${item.id}" ${selectedIds.includes(item.id) ? 'selected' : ''}>${labelFn(item)}</option>`).join('');
}

function renderDialog(mode, existing) {
  const isEdit = mode === 'edit';
  const base = isEdit
    ? existing
    : {
        id: null, title: '', description: '', icon: '\u{1F3AF}', coverColor: 'blue', category: 'personal', timeframe: 'monthly',
        priority: 'Medium', status: 'Not Started', deadline: '', startDate: '', favorite: false, archived: false,
        measurable: null, tags: [], notes: '', linkedProjectIds: [], linkedHabitIds: [], linkedNoteIds: [],
      };

  els.shell.setAttribute('aria-label', isEdit ? 'Edit goal' : 'New goal');
  els.shell.innerHTML = `
    <form class="goal-dialog" id="goal-dialog-form" novalidate>
      <header class="goal-dialog__header">
        <h2>${isEdit ? 'Edit goal' : 'New goal'}</h2>
        <button type="button" class="icon-btn" id="gd-close" aria-label="Close">${icon('x', { size: 18 })}</button>
      </header>

      <div class="goal-dialog__body">
        <div class="goal-dialog__row goal-dialog__row--icon">
          <div class="field" style="max-width:70px"><label for="gd-icon">Icon</label><input id="gd-icon" type="text" maxlength="4" value="${escapeAttr(base.icon)}" /></div>
          <div class="field" style="flex:1"><label for="gd-title">Title</label><input id="gd-title" type="text" value="${escapeAttr(base.title)}" placeholder="e.g. Become a Software Engineer" required /></div>
        </div>
        <p class="goal-dialog__error" id="gd-title-error" hidden>Title is required.</p>

        <div class="field"><label for="gd-description">Description</label><textarea id="gd-description" rows="2">${escapeAttr(base.description)}</textarea></div>

        <div class="goal-dialog__row">
          <div class="field"><label for="gd-category">Category</label>
            <select id="gd-category">${CATEGORIES.map((c) => `<option value="${c}" ${c === base.category ? 'selected' : ''}>${CATEGORY_CONFIG[c].label}</option>`).join('')}</select>
          </div>
          <div class="field"><label for="gd-timeframe">Timeframe</label>
            <select id="gd-timeframe">${TIMEFRAMES.map((t) => `<option value="${t}" ${t === base.timeframe ? 'selected' : ''}>${TIMEFRAME_CONFIG[t].label}</option>`).join('')}</select>
          </div>
          <div class="field"><label for="gd-color">Cover color</label>
            <select id="gd-color">${GOAL_COLORS.map((c) => `<option value="${c}" ${c === base.coverColor ? 'selected' : ''}>${c[0].toUpperCase()}${c.slice(1)}</option>`).join('')}</select>
          </div>
        </div>

        <div class="goal-dialog__row">
          <div class="field"><label for="gd-priority">Priority</label>
            <select id="gd-priority">${PRIORITIES.map((p) => `<option value="${p}" ${p === base.priority ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="field"><label for="gd-status">Status</label>
            <select id="gd-status">${STATUSES.map((s) => `<option value="${s}" ${s === base.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
        </div>

        <div class="goal-dialog__row">
          <div class="field"><label for="gd-start">Start date</label><input id="gd-start" type="date" value="${base.startDate || ''}" /></div>
          <div class="field"><label for="gd-deadline">Deadline</label><input id="gd-deadline" type="date" value="${base.deadline || ''}" /></div>
        </div>

        <label class="goal-dialog__checkbox"><input type="checkbox" id="gd-measurable-enabled" ${base.measurable ? 'checked' : ''} /> Track with a number (e.g. pages read, dollars saved)</label>
        <div class="goal-dialog__row" id="gd-measurable-wrap" ${base.measurable ? '' : 'hidden'}>
          <div class="field"><label for="gd-current">Current value</label><input id="gd-current" type="number" min="0" value="${base.measurable ? base.measurable.currentValue : 0}" /></div>
          <div class="field"><label for="gd-target">Target value</label><input id="gd-target" type="number" min="1" value="${base.measurable ? base.measurable.targetValue : 100}" /></div>
          <div class="field"><label for="gd-unit">Unit</label><input id="gd-unit" type="text" value="${escapeAttr(base.measurable ? base.measurable.unit : '')}" placeholder="e.g. books" /></div>
        </div>

        <div class="field"><label for="gd-tags">Tags</label><input id="gd-tags" type="text" value="${escapeAttr((base.tags || []).join(', '))}" placeholder="Comma-separated" /></div>
        <div class="field"><label for="gd-notes">Notes</label><textarea id="gd-notes" rows="2">${escapeAttr(base.notes)}</textarea></div>

        <div class="goal-dialog__row goal-dialog__row--links">
          <div class="field"><label for="gd-link-projects">Linked projects</label>
            <select id="gd-link-projects" multiple size="4">${multiSelectOptions(projects, base.linkedProjectIds, (p) => p.title)}</select>
          </div>
          <div class="field"><label for="gd-link-habits">Linked habits</label>
            <select id="gd-link-habits" multiple size="4">${multiSelectOptions(habits, base.linkedHabitIds, (h) => h.title)}</select>
          </div>
          <div class="field"><label for="gd-link-notes">Linked notes</label>
            <select id="gd-link-notes" multiple size="4">${multiSelectOptions(notes, base.linkedNoteIds, (n) => n.title)}</select>
          </div>
        </div>
        <p class="goal-dialog__hint">Cmd/Ctrl-click to select more than one.</p>

        ${isEdit ? `<label class="goal-dialog__checkbox"><input type="checkbox" id="gd-archived" ${base.archived ? 'checked' : ''} /> Archived</label>` : ''}
      </div>

      <footer class="goal-dialog__footer">
        ${isEdit ? `<button type="button" class="btn btn--secondary" id="gd-delete">Delete</button>` : '<span></span>'}
        <div class="goal-dialog__footer-right">
          <button type="button" class="btn btn--secondary" id="gd-cancel">Cancel</button>
          <button type="submit" class="btn btn--primary" id="gd-save">Save</button>
        </div>
      </footer>
    </form>`;

  wireDialogEvents(mode, base);
  document.getElementById('gd-title').focus();
}

function wireDialogEvents(mode, base) {
  const isEdit = mode === 'edit';
  const form = document.getElementById('goal-dialog-form');
  const measurableBox = document.getElementById('gd-measurable-enabled');
  const measurableWrap = document.getElementById('gd-measurable-wrap');

  document.getElementById('gd-close').addEventListener('click', closeGoalDialog);
  document.getElementById('gd-cancel').addEventListener('click', closeGoalDialog);
  measurableBox.addEventListener('change', () => {
    measurableWrap.hidden = !measurableBox.checked;
  });

  if (isEdit) {
    document.getElementById('gd-delete').addEventListener('click', () => {
      if (!window.confirm(`Delete "${base.title}"? This can\u2019t be undone.`)) return;
      deleteGoal(base.id);
      closeGoalDialog();
      onSavedCallback?.();
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitDialog(mode, base);
  });
}

function selectedValues(selectEl) {
  return Array.from(selectEl.selectedOptions).map((o) => o.value);
}

function submitDialog(mode, base) {
  const title = document.getElementById('gd-title').value.trim();
  const titleError = document.getElementById('gd-title-error');
  titleError.hidden = Boolean(title);
  if (!title) {
    document.getElementById('gd-title').focus();
    return;
  }

  const measurableEnabled = document.getElementById('gd-measurable-enabled').checked;
  const measurable = measurableEnabled
    ? {
        currentValue: Math.max(0, Number(document.getElementById('gd-current').value) || 0),
        targetValue: Math.max(1, Number(document.getElementById('gd-target').value) || 1),
        unit: document.getElementById('gd-unit').value.trim() || 'units',
      }
    : null;

  const payload = {
    title,
    description: document.getElementById('gd-description').value.trim(),
    icon: document.getElementById('gd-icon').value.trim() || '\u{1F3AF}',
    coverColor: document.getElementById('gd-color').value,
    category: document.getElementById('gd-category').value,
    timeframe: document.getElementById('gd-timeframe').value,
    priority: document.getElementById('gd-priority').value,
    status: document.getElementById('gd-status').value,
    startDate: document.getElementById('gd-start').value || null,
    deadline: document.getElementById('gd-deadline').value || null,
    measurable,
    tags: document.getElementById('gd-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    notes: document.getElementById('gd-notes').value.trim(),
    linkedProjectIds: selectedValues(document.getElementById('gd-link-projects')),
    linkedHabitIds: selectedValues(document.getElementById('gd-link-habits')),
    linkedNoteIds: selectedValues(document.getElementById('gd-link-notes')),
  };

  if (mode === 'edit') {
    payload.archived = document.getElementById('gd-archived').checked;
    updateGoal(base.id, payload);
  } else {
    createGoal(payload);
  }

  closeGoalDialog();
  onSavedCallback?.();
}
