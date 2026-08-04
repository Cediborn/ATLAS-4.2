// Atlas — Book detail panel. Same overlay shell + open/close mechanics as
// Goals' own detail panel (goal-detail.js) \u2014 including the same choice to
// focus the close button on open rather than a full Tab-trap, since this
// panel is dense with interactive rows (session/quote/highlight/note
// actions) that need normal Tab flow through them. Sections are stacked
// (not tabbed), same layout choice Goals made \u2014 no new tab component
// needed for either module.

import { icon } from '../icons.js';
import { ProgressRing, ForecastWidget, LinkedEntityChip } from '../components.js';
import { GENRE_CONFIG, HIGHLIGHT_COLORS, MOODS, bookById } from './data.js';
import {
  computeProgress, computeReadingForecast, buildBookActivity,
  toggleFavorite, toggleArchived, duplicateBook, deleteBook, updateBook,
  setStatus, updateProgress, completeBook,
  getSessionsForBook, addSession, deleteSession,
  getQuotesForBook, addQuote, toggleQuoteFavorite, deleteQuote,
  getHighlightsForBook, addHighlight, deleteHighlight,
  getNotesForBook, addNote, toggleNotePinned, deleteNote,
  getCollectionsForBook, toggleBookInCollection,
} from './state.js';
import {
  BookStatusBadge, BookActionMenu, GenreBadge, RatingStars,
  QuoteCard, HighlightCard, BookNoteCard, SessionRow, ReviewBlock, CollectionChip, BookActivityFeed,
} from './components.js';
import { openBookDialog } from './book-dialog.js';
import { collections as allCollections } from './data.js';
import { goals } from '../goals/data.js';
import { projects } from '../projects/data.js';
import { habits } from '../habits/data.js';
import { computeStreak } from '../habits/state.js';
import { formatDate, todayKey } from '../date-utils.js';

let lastFocusedBeforeDetail = null;
let onChangeCallback = null;
let documentListenersAttached = false;

// Attached once for the whole page session, not once per renderBooks() call
// \u2014 view.js re-renders the whole page (and a fresh #book-detail-overlay
// element) on every navigation to Books, so a naive re-attach here would
// stack a new document-level listener, each closing over that render's now-
// detached overlay, on every visit. Looking the elements up fresh inside the
// handler (instead of capturing them at attach-time) avoids that entirely.
export function initBookDetail(onChange) {
  onChangeCallback = onChange;
  if (documentListenersAttached) return;
  documentListenersAttached = true;

  document.addEventListener('click', (e) => {
    const overlay = document.getElementById('book-detail-overlay');
    if (!overlay || overlay.hidden) return;
    if (e.target === overlay) {
      closeBookDetail();
      return;
    }
    const panel = document.getElementById('book-detail-panel');
    if (panel && !e.target.closest('.action-menu') && !e.target.closest('.session-row')) closeAllMenus(panel);
  });

  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('book-detail-overlay');
    if (overlay && !overlay.hidden && e.key === 'Escape') closeBookDetail();
  });
}

export function openBookDetail(bookId) {
  const b = bookById(bookId);
  if (!b) return;
  lastFocusedBeforeDetail = document.activeElement;
  renderInPlace(bookId);
  const overlay = document.getElementById('book-detail-overlay');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('book-detail-panel').querySelector('#book-detail-close').focus();
}

// Re-renders content without touching focus/visibility \u2014 same reasoning
// as goal-detail.js's renderInPlace: logging a session or adding a quote
// inside an already-open panel shouldn't yank focus back to the close button.
function renderInPlace(bookId) {
  const b = bookById(bookId);
  if (!b) return;
  const panel = document.getElementById('book-detail-panel');
  panel.innerHTML = renderDetailContent(b);
  wireDetailInteractions(b);
}

export function closeBookDetail() {
  const overlay = document.getElementById('book-detail-overlay');
  overlay.hidden = true;
  document.body.style.overflow = '';
  lastFocusedBeforeDetail?.focus?.();
}

function refresh(bookId) {
  const overlay = document.getElementById('book-detail-overlay');
  if (overlay.hidden) return;
  renderInPlace(bookId);
  onChangeCallback?.();
}

function detailSection(title, content, extraClass = '') {
  return `<section class="book-detail-panel__section ${extraClass}"><h4>${title}</h4>${content}</section>`;
}

function inlineAddForm(kind, fieldsHtml) {
  return `
    <div class="inline-add" data-inline="${kind}" hidden>
      ${fieldsHtml}
      <div class="inline-add__actions">
        <button type="button" class="btn btn--secondary" data-action="cancel-inline" data-inline="${kind}">Cancel</button>
        <button type="button" class="btn btn--primary" data-action="save-inline" data-inline="${kind}">Save</button>
      </div>
    </div>
    <button type="button" class="book-detail-panel__add-toggle" data-action="toggle-inline" data-inline="${kind}">${icon('plus', { size: 14 })}<span>Add ${kind}</span></button>`;
}

function renderDetailContent(b) {
  const progress = computeProgress(b);
  const forecast = computeReadingForecast(b);
  const cat = GENRE_CONFIG[b.genres[0]] || { color: 'slate' };
  const isActive = b.status === 'Currently Reading' || b.status === 'Re-reading';
  const canReview = b.status === 'Completed' || b.status === 'Re-reading';

  const linkedGoals = b.linkedGoalIds.map((id) => goals.find((g) => g.id === id)).filter(Boolean);
  const linkedProjects = b.linkedProjectIds.map((id) => projects.find((p) => p.id === id)).filter(Boolean);
  const linkedHabits = b.linkedHabitIds.map((id) => habits.find((h) => h.id === id)).filter(Boolean);
  const memberCollections = getCollectionsForBook(b.id);
  const activity = buildBookActivity(b);

  const sessionsList = getSessionsForBook(b.id);
  const quotesList = getQuotesForBook(b.id);
  const highlightsList = getHighlightsForBook(b.id);
  const notesList = getNotesForBook(b.id);

  return `
    <button type="button" class="icon-btn book-detail-panel__close" id="book-detail-close" aria-label="Close panel">${icon('x', { size: 18 })}</button>

    <div class="book-detail-panel__header book-detail-panel__header--${b.coverColor}">
      <span class="book-detail-panel__initial">${b.title.charAt(0).toUpperCase()}</span>
      <div class="book-detail-panel__heading">
        <h2>${b.title}</h2>
        <p class="book-detail-panel__author">${b.author}</p>
        <div class="book-detail-panel__badges">
          ${b.genres.map((g) => GenreBadge({ genre: g })).join('')}
          ${BookStatusBadge({ status: b.status })}
        </div>
      </div>
      <div class="book-detail-panel__actions">
        <button type="button" class="btn btn--secondary" id="book-detail-edit">${icon('edit', { size: 15 })}<span>Edit</span></button>
        ${BookActionMenu({ id: b.id, itemLabel: b.title, favorite: b.favorite, archived: b.archived })}
      </div>
    </div>

    <div class="book-detail-panel__scroll">
      ${b.description ? `<p class="book-detail-panel__desc">${b.description}</p>` : ''}

      <div class="book-detail-panel__status-actions">
        ${b.status === 'Want to Read' ? `<button type="button" class="btn btn--primary" data-action="start-reading">${icon('bookOpen', { size: 15 })}<span>Start reading</span></button>` : ''}
        ${isActive ? `<button type="button" class="btn btn--primary" data-action="complete-book">${icon('check', { size: 15 })}<span>Mark as completed</span></button>` : ''}
        ${b.status === 'Currently Reading' ? `<button type="button" class="btn btn--secondary" data-action="pause-book">${icon('clock', { size: 15 })}<span>Pause</span></button>` : ''}
        ${b.status === 'Completed' ? `<button type="button" class="btn btn--secondary" data-action="reread-book">${icon('repeat', { size: 15 })}<span>Re-read</span></button>` : ''}
      </div>

      <div class="book-detail-panel__progress-row">
        ${ProgressRing({ percentage: progress, color: cat.color, size: 64, showValue: true })}
        <div class="book-detail-panel__progress-copy">
          <div class="book-detail-panel__measurable">Page ${b.currentPage} / ${b.totalPages}</div>
          ${b.targetFinishDate ? `<div class="book-detail-panel__muted">Target finish ${formatDate(b.targetFinishDate)}</div>` : ''}
          ${b.dateStarted ? `<div class="book-detail-panel__muted">Started ${formatDate(b.dateStarted)}</div>` : ''}
        </div>
      </div>

      ${isActive ? detailSection('Update progress', `
        <div class="book-detail-panel__measurable-editor">
          <input type="number" id="book-detail-page-input" min="0" max="${b.totalPages}" value="${b.currentPage}" />
          <span>/ ${b.totalPages} pages</span>
          <button type="button" class="btn btn--secondary" id="book-detail-page-save">Update</button>
        </div>`) : ''}

      ${isActive ? detailSection('Forecast', ForecastWidget({ forecast, emptyLabel: 'Log a couple of reading sessions to see a pace forecast here.' })) : ''}

      ${detailSection(`Reading sessions (${sessionsList.length})`, `
        <div class="book-detail-panel__list">${sessionsList.length ? sessionsList.map((s) => SessionRow({ session: s })).join('') : '<p class="book-detail-panel__muted">No sessions logged yet.</p>'}</div>
        ${inlineAddForm('session', `
          <div class="inline-add__row">
            <input type="date" data-field="date" value="${todayKey()}" />
            <input type="time" data-field="startTime" />
            <input type="time" data-field="endTime" />
          </div>
          <div class="inline-add__row">
            <input type="number" data-field="endPage" min="0" max="${b.totalPages}" placeholder="Ended on page" />
            <select data-field="mood"><option value="">Mood (optional)</option>${MOODS.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>
          </div>`)}`)}

      ${detailSection(`Quotes (${quotesList.length})`, `
        <div class="book-detail-panel__list">${quotesList.length ? quotesList.map((q) => QuoteCard({ quote: q })).join('') : '<p class="book-detail-panel__muted">No quotes saved yet.</p>'}</div>
        ${inlineAddForm('quote', `
          <textarea data-field="text" rows="2" placeholder="Quote text\u2026"></textarea>
          <div class="inline-add__row">
            <input type="text" data-field="chapter" placeholder="Chapter (optional)" />
            <input type="number" data-field="page" min="0" placeholder="Page (optional)" />
          </div>`)}`)}

      ${detailSection(`Highlights (${highlightsList.length})`, `
        <div class="book-detail-panel__list">${highlightsList.length ? highlightsList.map((h) => HighlightCard({ highlight: h })).join('') : '<p class="book-detail-panel__muted">No highlights yet.</p>'}</div>
        ${inlineAddForm('highlight', `
          <textarea data-field="text" rows="2" placeholder="Highlighted text\u2026"></textarea>
          <div class="inline-add__row">
            <select data-field="color">${HIGHLIGHT_COLORS.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
            <input type="number" data-field="page" min="0" placeholder="Page (optional)" />
          </div>`)}`)}

      ${detailSection(`Notes (${notesList.length})`, `
        <div class="book-detail-panel__list book-detail-panel__list--notes">${notesList.length ? notesList.map((n) => BookNoteCard({ note: n })).join('') : '<p class="book-detail-panel__muted">No notes yet.</p>'}</div>
        ${inlineAddForm('note', `
          <input type="text" data-field="title" placeholder="Note title" />
          <textarea data-field="text" rows="3" placeholder="Plain text for now \u2014 the full Notes editor is on the roadmap here (see BUILD_LOG)."></textarea>`)}`)}

      ${canReview ? detailSection('Rating & review', `
        <div class="book-detail-panel__rating-editor">${RatingStars({ value: b.rating || 0, size: 20, interactive: true, bookId: b.id })}</div>
        ${ReviewBlock({ book: b })}
        ${!b.review ? `<button type="button" class="btn btn--secondary" id="book-detail-add-review">${icon('edit', { size: 14 })}<span>Write a review</span></button>` : ''}`) : ''}

      ${detailSection('Collections', `
        <div class="book-detail-panel__collections">
          ${allCollections.map((c) => `
            <button type="button" class="collection-toggle${memberCollections.some((m) => m.id === c.id) ? ' is-active' : ''}" data-action="toggle-collection" data-collection-id="${c.id}">
              ${CollectionChip({ collection: c })}
            </button>`).join('')}
        </div>`)}

      ${detailSection('Linked goals', linkedGoals.length
        ? linkedGoals.map((g) => LinkedEntityChip({ icon: 'target', title: g.title, meta: `${g.status}`, color: g.coverColor })).join('')
        : '<p class="book-detail-panel__muted">No linked goals.</p>')}

      ${detailSection('Linked projects', linkedProjects.length
        ? linkedProjects.map((p) => LinkedEntityChip({ icon: 'folder', title: p.title, meta: `${p.status} \u00b7 ${p.progress}%`, color: p.color })).join('')
        : '<p class="book-detail-panel__muted">No linked projects.</p>')}

      ${detailSection('Linked habits', linkedHabits.length
        ? linkedHabits.map((h) => LinkedEntityChip({ icon: h.icon, title: h.title, meta: `${computeStreak(h).current}d current streak`, color: h.color })).join('')
        : '<p class="book-detail-panel__muted">No linked habits.</p>')}

      ${detailSection('Notes', `<textarea class="book-detail-panel__notes" id="book-detail-scratch-notes" rows="3" placeholder="Scratch notes for this book\u2026">${b.notes || ''}</textarea>`)}

      ${detailSection('Activity', BookActivityFeed({ activity }))}
    </div>`;
}

function toggleInline(panel, kind, show) {
  const form = panel.querySelector(`.inline-add[data-inline="${kind}"]`);
  const toggleBtn = panel.querySelector(`.book-detail-panel__add-toggle[data-inline="${kind}"]`);
  if (!form) return;
  form.hidden = !show;
  if (toggleBtn) toggleBtn.hidden = show;
  if (show) form.querySelector('input, textarea, select')?.focus();
}

function readInlineFields(form) {
  const out = {};
  form.querySelectorAll('[data-field]').forEach((el) => {
    out[el.dataset.field] = el.value;
  });
  return out;
}

function wireDetailInteractions(b) {
  const panel = document.getElementById('book-detail-panel');
  panel.querySelector('#book-detail-close').addEventListener('click', closeBookDetail);
  panel.querySelector('#book-detail-edit').addEventListener('click', () => {
    openBookDialog('edit', b, () => refresh(b.id));
  });

  // ---- Status actions ----
  panel.querySelector('[data-action="start-reading"]')?.addEventListener('click', () => {
    setStatus(b.id, 'Currently Reading');
    refresh(b.id);
  });
  panel.querySelector('[data-action="complete-book"]')?.addEventListener('click', () => {
    completeBook(b.id);
    refresh(b.id);
  });
  panel.querySelector('[data-action="pause-book"]')?.addEventListener('click', () => {
    setStatus(b.id, 'Paused');
    refresh(b.id);
  });
  panel.querySelector('[data-action="reread-book"]')?.addEventListener('click', () => {
    setStatus(b.id, 'Re-reading');
    updateBook(b.id, { currentPage: 0, dateStarted: todayKey() });
    refresh(b.id);
  });

  // ---- Update progress ----
  const pageSave = panel.querySelector('#book-detail-page-save');
  if (pageSave) {
    pageSave.addEventListener('click', () => {
      const val = Number(panel.querySelector('#book-detail-page-input').value) || 0;
      updateProgress(b.id, val);
      refresh(b.id);
    });
  }

  // ---- Rating (interactive stars) ----
  panel.querySelectorAll('.rating-stars--interactive .rating-stars__hit').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateBook(b.id, { rating: Number(btn.dataset.rate) });
      refresh(b.id);
    });
  });
  panel.querySelector('#book-detail-add-review')?.addEventListener('click', () => {
    const text = window.prompt('A few sentences on the book');
    if (text && text.trim()) {
      updateBook(b.id, { review: { text: text.trim(), pros: '', cons: '', wouldRecommend: null, favoriteQuote: '' } });
      refresh(b.id);
    }
  });

  // ---- Scratch notes (blur-to-save, same pattern as goal-detail.js) ----
  const notesArea = panel.querySelector('#book-detail-scratch-notes');
  notesArea.addEventListener('blur', () => {
    if (notesArea.value !== b.notes) updateBook(b.id, { notes: notesArea.value });
  });

  // ---- Collections ----
  panel.querySelectorAll('[data-action="toggle-collection"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleBookInCollection(btn.dataset.collectionId, b.id);
      refresh(b.id);
    });
  });

  // ---- Inline add forms (session/quote/highlight/note) ----
  panel.querySelectorAll('[data-action="toggle-inline"]').forEach((btn) => {
    btn.addEventListener('click', () => toggleInline(panel, btn.dataset.inline, true));
  });
  panel.querySelectorAll('[data-action="cancel-inline"]').forEach((btn) => {
    btn.addEventListener('click', () => toggleInline(panel, btn.dataset.inline, false));
  });
  panel.querySelectorAll('[data-action="save-inline"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.inline;
      const form = panel.querySelector(`.inline-add[data-inline="${kind}"]`);
      const fields = readInlineFields(form);
      if (kind === 'session') {
        const endPage = fields.endPage ? Number(fields.endPage) : b.currentPage;
        addSession(b.id, { date: fields.date || todayKey(), startTime: fields.startTime || null, endTime: fields.endTime || null, startPage: b.currentPage, endPage, mood: fields.mood || null });
      } else if (kind === 'quote') {
        if (!fields.text?.trim()) return;
        addQuote(b.id, { text: fields.text.trim(), chapter: fields.chapter || null, page: fields.page ? Number(fields.page) : null });
      } else if (kind === 'highlight') {
        if (!fields.text?.trim()) return;
        addHighlight(b.id, { text: fields.text.trim(), color: fields.color, page: fields.page ? Number(fields.page) : null });
      } else if (kind === 'note') {
        if (!fields.text?.trim()) return;
        addNote(b.id, { title: fields.title?.trim() || 'Untitled note', text: fields.text.trim() });
      }
      refresh(b.id);
    });
  });

  // ---- Session/quote/highlight/note row-level actions ----
  panel.querySelectorAll('[data-action="delete-session"]').forEach((btn) => btn.addEventListener('click', () => { deleteSession(btn.dataset.id); refresh(b.id); }));
  panel.querySelectorAll('[data-action="favorite-quote"]').forEach((btn) => btn.addEventListener('click', () => { toggleQuoteFavorite(btn.dataset.id); refresh(b.id); }));
  panel.querySelectorAll('[data-action="delete-quote"]').forEach((btn) => btn.addEventListener('click', () => { deleteQuote(btn.dataset.id); refresh(b.id); }));
  panel.querySelectorAll('[data-action="delete-highlight"]').forEach((btn) => btn.addEventListener('click', () => { deleteHighlight(btn.dataset.id); refresh(b.id); }));
  panel.querySelectorAll('[data-action="pin-note"]').forEach((btn) => btn.addEventListener('click', () => { toggleNotePinned(btn.dataset.id); refresh(b.id); }));
  panel.querySelectorAll('[data-action="delete-note"]').forEach((btn) => btn.addEventListener('click', () => { deleteNote(btn.dataset.id); refresh(b.id); }));

  // ---- Action menu (favorite/duplicate/archive/delete) ----
  const actionTrigger = panel.querySelector('.book-detail-panel__actions .action-menu__trigger');
  const actionPanel = actionTrigger.nextElementSibling;
  actionTrigger.addEventListener('click', () => {
    const wasOpen = !actionPanel.hidden;
    closeAllMenus(panel);
    if (!wasOpen) {
      actionPanel.hidden = false;
      actionTrigger.setAttribute('aria-expanded', 'true');
    }
  });
  actionPanel.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (!item) return;
    const action = item.dataset.action;
    closeAllMenus(panel);
    if (action === 'favorite') {
      toggleFavorite(b.id);
      refresh(b.id);
    } else if (action === 'archive') {
      toggleArchived(b.id);
      refresh(b.id);
    } else if (action === 'duplicate') {
      const copy = duplicateBook(b.id);
      onChangeCallback?.();
      openBookDetail(copy.id);
    } else if (action === 'delete') {
      if (window.confirm(`Delete "${b.title}"? This can\u2019t be undone.`)) {
        deleteBook(b.id);
        closeBookDetail();
        onChangeCallback?.();
      }
    }
  });
}

function closeAllMenus(panel) {
  panel.querySelectorAll('.action-menu__panel').forEach((p) => {
    p.hidden = true;
  });
  panel.querySelectorAll('.action-menu__trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
