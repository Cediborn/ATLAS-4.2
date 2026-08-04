// Atlas — Book create/edit dialog. Same shell pattern as
// goals/goal-dialog.js and habits/habit-dialog.js: independent
// implementation, since each form shares nothing with the others but the
// container shape.

import { icon } from '../icons.js';
import { GENRES, STATUSES, BOOK_COLORS } from './data.js';
import { createBook, updateBook, deleteBook } from './state.js';
import { goals } from '../goals/data.js';
import { projects } from '../projects/data.js';
import { habits } from '../habits/data.js';

let els = null;
let lastFocused = null;
let onSavedCallback = null;

function ensureShell() {
  if (els) return;
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div class="overlay book-dialog-overlay" id="book-dialog-overlay" hidden><div class="book-dialog-shell" id="book-dialog-shell" role="dialog" aria-modal="true"></div></div>'
  );
  els = { overlay: document.getElementById('book-dialog-overlay'), shell: document.getElementById('book-dialog-shell') };
  els.overlay.addEventListener('click', (e) => {
    if (e.target === els.overlay) closeBookDialog();
  });
  document.addEventListener('keydown', (e) => {
    if (els.overlay.hidden) return;
    if (e.key === 'Escape') closeBookDialog();
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

export function closeBookDialog() {
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

export function openBookDialog(mode, existingOrNull, onSaved) {
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

function genreCheckboxes(selected) {
  return GENRES.map(
    (g) => `<label class="menu__item filter-checkbox"><input type="checkbox" data-genre="${g}" ${selected.includes(g) ? 'checked' : ''} /><span>${g}</span></label>`
  ).join('');
}

function renderDialog(mode, existing) {
  const isEdit = mode === 'edit';
  const base = isEdit
    ? existing
    : {
        id: null, title: '', subtitle: '', author: '', coverColor: 'blue', description: '',
        publisher: '', publicationYear: '', isbn: '', language: 'English', totalPages: 300,
        genres: [], tags: [], status: 'Want to Read', currentPage: 0,
        dateStarted: '', dateCompleted: '', targetFinishDate: '',
        favorite: false, archived: false, notes: '',
        linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [],
      };

  els.shell.setAttribute('aria-label', isEdit ? 'Edit book' : 'Add book');
  els.shell.innerHTML = `
    <form class="book-dialog" id="book-dialog-form" novalidate>
      <header class="book-dialog__header">
        <h2>${isEdit ? 'Edit book' : 'Add book'}</h2>
        <button type="button" class="icon-btn" id="bd-close" aria-label="Close">${icon('x', { size: 18 })}</button>
      </header>

      <div class="book-dialog__body">
        <div class="field"><label for="bd-title">Title</label><input id="bd-title" type="text" value="${escapeAttr(base.title)}" placeholder="e.g. Atomic Focus" required /></div>
        <p class="book-dialog__error" id="bd-title-error" hidden>Title is required.</p>

        <div class="book-dialog__row">
          <div class="field" style="flex:1"><label for="bd-subtitle">Subtitle</label><input id="bd-subtitle" type="text" value="${escapeAttr(base.subtitle)}" /></div>
          <div class="field" style="flex:1"><label for="bd-author">Author</label><input id="bd-author" type="text" value="${escapeAttr(base.author)}" required /></div>
        </div>
        <p class="book-dialog__error" id="bd-author-error" hidden>Author is required.</p>

        <div class="field"><label for="bd-description">Description</label><textarea id="bd-description" rows="2">${escapeAttr(base.description)}</textarea></div>

        <div class="book-dialog__row">
          <div class="field"><label for="bd-status">Status</label>
            <select id="bd-status">${STATUSES.map((s) => `<option value="${s}" ${s === base.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field"><label for="bd-color">Cover color</label>
            <select id="bd-color">${BOOK_COLORS.map((c) => `<option value="${c}" ${c === base.coverColor ? 'selected' : ''}>${c[0].toUpperCase()}${c.slice(1)}</option>`).join('')}</select>
          </div>
        </div>

        <div class="book-dialog__row">
          <div class="field"><label for="bd-pages">Total pages</label><input id="bd-pages" type="number" min="1" value="${base.totalPages}" /></div>
          <div class="field"><label for="bd-current-page">Current page</label><input id="bd-current-page" type="number" min="0" value="${base.currentPage}" /></div>
        </div>

        <div class="field"><label>Genres</label>
          <div class="menu menu--inline menu--wide">${genreCheckboxes(base.genres)}</div>
        </div>

        <div class="field"><label for="bd-tags">Tags</label><input id="bd-tags" type="text" value="${escapeAttr((base.tags || []).join(', '))}" placeholder="Comma-separated" /></div>

        <div class="book-dialog__row">
          <div class="field"><label for="bd-publisher">Publisher</label><input id="bd-publisher" type="text" value="${escapeAttr(base.publisher)}" /></div>
          <div class="field"><label for="bd-year">Publication year</label><input id="bd-year" type="text" value="${escapeAttr(base.publicationYear)}" maxlength="4" /></div>
          <div class="field"><label for="bd-isbn">ISBN</label><input id="bd-isbn" type="text" value="${escapeAttr(base.isbn)}" /></div>
        </div>

        <div class="book-dialog__row">
          <div class="field"><label for="bd-started">Date started</label><input id="bd-started" type="date" value="${base.dateStarted || ''}" /></div>
          <div class="field"><label for="bd-completed">Date completed</label><input id="bd-completed" type="date" value="${base.dateCompleted || ''}" /></div>
          <div class="field"><label for="bd-target">Target finish</label><input id="bd-target" type="date" value="${base.targetFinishDate || ''}" /></div>
        </div>

        <div class="field"><label for="bd-notes">Notes</label><textarea id="bd-notes" rows="2" placeholder="Scratch notes for this book\u2026">${escapeAttr(base.notes)}</textarea></div>

        <div class="book-dialog__row book-dialog__row--links">
          <div class="field"><label for="bd-link-goals">Linked goals</label>
            <select id="bd-link-goals" multiple size="4">${multiSelectOptions(goals, base.linkedGoalIds, (g) => g.title)}</select>
          </div>
          <div class="field"><label for="bd-link-projects">Linked projects</label>
            <select id="bd-link-projects" multiple size="4">${multiSelectOptions(projects, base.linkedProjectIds, (p) => p.title)}</select>
          </div>
          <div class="field"><label for="bd-link-habits">Linked habits</label>
            <select id="bd-link-habits" multiple size="4">${multiSelectOptions(habits, base.linkedHabitIds, (h) => h.title)}</select>
          </div>
        </div>
        <p class="book-dialog__hint">Cmd/Ctrl-click to select more than one.</p>

        <label class="book-dialog__checkbox"><input type="checkbox" id="bd-favorite" ${base.favorite ? 'checked' : ''} /> Favorite</label>
        ${isEdit ? `<label class="book-dialog__checkbox"><input type="checkbox" id="bd-archived" ${base.archived ? 'checked' : ''} /> Archived</label>` : ''}
      </div>

      <footer class="book-dialog__footer">
        ${isEdit ? `<button type="button" class="btn btn--secondary" id="bd-delete">Delete</button>` : '<span></span>'}
        <div class="book-dialog__footer-right">
          <button type="button" class="btn btn--secondary" id="bd-cancel">Cancel</button>
          <button type="submit" class="btn btn--primary" id="bd-save">Save</button>
        </div>
      </footer>
    </form>`;

  wireDialogEvents(mode, base);
  document.getElementById('bd-title').focus();
}

function wireDialogEvents(mode, base) {
  const isEdit = mode === 'edit';
  const form = document.getElementById('book-dialog-form');

  document.getElementById('bd-close').addEventListener('click', closeBookDialog);
  document.getElementById('bd-cancel').addEventListener('click', closeBookDialog);

  if (isEdit) {
    document.getElementById('bd-delete').addEventListener('click', () => {
      if (!window.confirm(`Delete "${base.title}"? This can\u2019t be undone.`)) return;
      deleteBook(base.id);
      closeBookDialog();
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
  const title = document.getElementById('bd-title').value.trim();
  const author = document.getElementById('bd-author').value.trim();
  const titleError = document.getElementById('bd-title-error');
  const authorError = document.getElementById('bd-author-error');
  titleError.hidden = Boolean(title);
  authorError.hidden = Boolean(author);
  if (!title) {
    document.getElementById('bd-title').focus();
    return;
  }
  if (!author) {
    document.getElementById('bd-author').focus();
    return;
  }

  const totalPages = Math.max(1, Number(document.getElementById('bd-pages').value) || 1);
  const currentPage = Math.max(0, Math.min(totalPages, Number(document.getElementById('bd-current-page').value) || 0));
  const genres = Array.from(document.querySelectorAll('[data-genre]:checked')).map((cb) => cb.dataset.genre);

  const payload = {
    title, author,
    subtitle: document.getElementById('bd-subtitle').value.trim() || null,
    description: document.getElementById('bd-description').value.trim(),
    status: document.getElementById('bd-status').value,
    coverColor: document.getElementById('bd-color').value,
    totalPages, currentPage,
    genres,
    tags: document.getElementById('bd-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    publisher: document.getElementById('bd-publisher').value.trim() || null,
    publicationYear: document.getElementById('bd-year').value.trim() || null,
    isbn: document.getElementById('bd-isbn').value.trim() || null,
    dateStarted: document.getElementById('bd-started').value || null,
    dateCompleted: document.getElementById('bd-completed').value || null,
    targetFinishDate: document.getElementById('bd-target').value || null,
    notes: document.getElementById('bd-notes').value.trim(),
    favorite: document.getElementById('bd-favorite').checked,
    linkedGoalIds: selectedValues(document.getElementById('bd-link-goals')),
    linkedProjectIds: selectedValues(document.getElementById('bd-link-projects')),
    linkedHabitIds: selectedValues(document.getElementById('bd-link-habits')),
  };

  if (mode === 'edit') {
    payload.archived = document.getElementById('bd-archived').checked;
    updateBook(base.id, payload);
  } else {
    createBook(payload);
  }

  closeBookDialog();
  onSavedCallback?.();
}
