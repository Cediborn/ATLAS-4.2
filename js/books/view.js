// Atlas — Books page view. Same page shape as goals/view.js: header +
// toolbar (search/new/filter/sort popovers) + stat row + main grid +
// insights aside + a detail-panel overlay mounted as part of the page.
//
// The toolbar (search input, filter/sort popovers) renders once per visit
// to the page and is never rebuilt after that \u2014 only the stats/grid/
// insights region (#books-dynamic) re-renders on every filter, sort, or
// CRUD change. An earlier version of this file re-rendered the *entire*
// page on every checkbox click, which would have silently discarded the
// filter popover's own open-state listeners (createPopover's document-level
// outside-click/Escape handlers) every time, and dropped keyboard focus out
// of the search input on every debounced keystroke. Caught during this
// milestone's validation pass \u2014 see BUILD_LOG \u00a77.

import { icon } from '../icons.js';
import { StatCard, SectionCard, HeatmapGrid } from '../components.js';
import { createPopover } from '../popover.js';
import { books as allBooks, STATUSES, GENRES, bookById } from './data.js';
import {
  getState, setState, resetFilters,
  getVisibleBooks,
  computeBookDashboardStats, genreBreakdown, buildReadingHeatmapMonth,
  getCurrentlyReadingPreview, getRecentlyCompleted, getRecentQuotes,
  computeProgress, SORT_OPTIONS,
  toggleFavorite, toggleArchived, duplicateBook, deleteBook,
} from './state.js';
import { BookCard, BookSkeleton, BooksEmptyState } from './components.js';
import { openBookDialog } from './book-dialog.js';
import { openBookDetail, initBookDetail } from './book-detail.js';
import { formatDate, addMonths } from '../date-utils.js';

let heatmapMonth = new Date();
heatmapMonth.setDate(1);
heatmapMonth.setHours(0, 0, 0, 0);

export function renderBooksSkeleton(root) {
  root.innerHTML = `
    <div class="books-page">
      <header class="books-header">
        <div class="books-header__top">
          <div>
            <h2>Books</h2>
            <p class="books-header__date">Loading your library\u2026</p>
          </div>
        </div>
      </header>
      <div class="books-grid">${BookSkeleton({ count: 8 })}</div>
    </div>`;
}

export function renderBooks(root) {
  root.innerHTML = renderStaticShell();
  wireStaticInteractions();
  renderDynamic();
  initBookDetail(() => renderDynamic());
}

// ================= Static shell (rendered once per page visit) =================
function renderStaticShell() {
  const f = getState();
  const stats = computeBookDashboardStats();
  return `
    <div class="books-page">
      <header class="books-header">
        <div class="books-header__top">
          <div>
            <h2>Books</h2>
            <p class="books-header__date">${new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
          </div>
          <div class="header-summary">
            <span class="header-summary__item"><strong>${stats.currentlyReadingCount}</strong>currently reading</span>
            <span class="header-summary__item"><strong>${stats.readingStreak}d</strong>reading streak</span>
            <span class="header-summary__item"><strong>${stats.booksThisYear}</strong>finished this year</span>
          </div>
        </div>
        <div class="books-toolbar">
          <label class="toolbar-search" for="books-search">
            ${icon('search', { size: 16 })}
            <input type="text" id="books-search" placeholder="Search title, author, or tag\u2026" autocomplete="off" value="${f.search}" />
          </label>
          <button type="button" class="btn btn--primary" id="books-new">${icon('plus', { size: 16 })}<span>Add book</span></button>
          <div class="toolbar-spacer"></div>
          <div class="toolbar-popover">
            <button type="button" class="btn btn--secondary" id="books-filter-trigger">${icon('filter', { size: 15 })}<span>Filter</span><span class="badge badge--accent" id="books-filter-count" ${activeFilterCount(f) ? '' : 'hidden'}>${activeFilterCount(f)}</span></button>
            <div class="menu menu--wide" id="books-filter-panel" hidden></div>
          </div>
          <div class="toolbar-popover">
            <button type="button" class="btn btn--secondary" id="books-sort-trigger">${icon('sort', { size: 15 })}<span>Sort</span></button>
            <div class="menu" id="books-sort-panel" hidden></div>
          </div>
        </div>
      </header>

      <div id="books-dynamic"></div>
    </div>

    <div class="overlay book-detail-overlay" id="book-detail-overlay" hidden>
      <aside class="book-detail-panel" id="book-detail-panel" role="dialog" aria-modal="true" aria-label="Book details"></aside>
    </div>`;
}

function activeFilterCount(f) {
  return f.statusFilter.size + f.genreFilter.size + (f.favoritesOnly ? 1 : 0);
}

function wireStaticInteractions() {
  document.getElementById('books-new').addEventListener('click', () => {
    openBookDialog('create', null, () => renderDynamic());
  });

  const searchInput = document.getElementById('books-search');
  let searchDebounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      setState({ search: searchInput.value });
      renderDynamic();
    }, 200);
  });

  const filterTrigger = document.getElementById('books-filter-trigger');
  const filterPanel = document.getElementById('books-filter-panel');
  const filterPopover = createPopover({
    trigger: filterTrigger, panel: filterPanel,
    onOpenRender: () => {
      filterPanel.innerHTML = renderFilterPanel(getState());
      filterPanel.querySelectorAll('[data-filter]').forEach((input) => {
        input.addEventListener('change', () => {
          const state = getState();
          const kind = input.dataset.filter;
          if (kind === 'status') {
            const set = new Set(state.statusFilter);
            input.checked ? set.add(input.value) : set.delete(input.value);
            setState({ statusFilter: set });
          } else if (kind === 'genre') {
            const set = new Set(state.genreFilter);
            input.checked ? set.add(input.value) : set.delete(input.value);
            setState({ genreFilter: set });
          } else if (kind === 'favorites') {
            setState({ favoritesOnly: input.checked });
          } else if (kind === 'archived') {
            setState({ showArchived: input.checked });
          }
          updateFilterBadge();
          renderDynamic();
        });
      });
      filterPanel.querySelector('[data-action="clear-filters"]')?.addEventListener('click', () => {
        resetFilters();
        updateFilterBadge();
        filterPopover.close();
        renderDynamic();
      });
    },
  });

  const sortTrigger = document.getElementById('books-sort-trigger');
  const sortPanel = document.getElementById('books-sort-panel');
  const sortPopover = createPopover({
    trigger: sortTrigger, panel: sortPanel,
    onOpenRender: () => {
      sortPanel.innerHTML = renderSortPanel(getState());
      sortPanel.querySelectorAll('[data-sort]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setState({ sortBy: btn.dataset.sort });
          sortPopover.close();
          renderDynamic();
        });
      });
    },
  });
}

function updateFilterBadge() {
  const f = getState();
  const badge = document.getElementById('books-filter-count');
  if (!badge) return;
  const count = activeFilterCount(f);
  badge.textContent = count;
  badge.hidden = !count;
}

function renderFilterPanel(f) {
  return `
    <div class="filter-panel__group">
      <span class="filter-panel__label">Status</span>
      ${STATUSES.map((s) => `<label class="menu__item filter-checkbox"><input type="checkbox" data-filter="status" value="${s}" ${f.statusFilter.has(s) ? 'checked' : ''} /><span>${s}</span></label>`).join('')}
    </div>
    <div class="menu__divider"></div>
    <div class="filter-panel__group">
      <span class="filter-panel__label">Genre</span>
      ${GENRES.map((g) => `<label class="menu__item filter-checkbox"><input type="checkbox" data-filter="genre" value="${g}" ${f.genreFilter.has(g) ? 'checked' : ''} /><span>${g}</span></label>`).join('')}
    </div>
    <div class="menu__divider"></div>
    <label class="menu__item filter-checkbox"><input type="checkbox" data-filter="favorites" ${f.favoritesOnly ? 'checked' : ''} /><span>Favorites only</span></label>
    <label class="menu__item filter-checkbox"><input type="checkbox" data-filter="archived" ${f.showArchived ? 'checked' : ''} /><span>Show archived</span></label>
    <div class="menu__divider"></div>
    <button type="button" class="menu__item" data-action="clear-filters">${icon('x', { size: 14 })}<span>Clear filters</span></button>`;
}

function renderSortPanel(f) {
  return SORT_OPTIONS.map((o) => `<button type="button" class="menu__item" data-sort="${o.id}">${f.sortBy === o.id ? icon('check', { size: 14 }) : `<span style="width:14px;display:inline-block"></span>`}<span>${o.label}</span></button>`).join('');
}

// ================= Dynamic content (re-rendered on every filter/sort/CRUD change) =================
function renderDynamic() {
  const container = document.getElementById('books-dynamic');
  if (!container) return;
  const f = getState();
  const stats = computeBookDashboardStats();
  const visible = getVisibleBooks(allBooks, f);
  const hasFilters = Boolean(f.search || f.statusFilter.size || f.genreFilter.size || f.favoritesOnly);

  container.innerHTML = `
    ${renderStatsRow(stats, f)}
    <div class="books-layout">
      <div class="books-main">
        ${visible.length ? `<div class="books-grid">${visible.map((b) => BookCard({ book: b })).join('')}</div>` : BooksEmptyState({ hasFilters })}
      </div>
      ${renderInsights()}
    </div>`;

  wireDynamicInteractions(container);
}

function statShortcut({ title, value, icon: iconName, filter, active }) {
  return `<button type="button" class="stat-card-btn${active ? ' is-active' : ''}" data-stat-filter='${JSON.stringify(filter)}'>${StatCard({ title, value, icon: iconName })}</button>`;
}

function renderStatsRow(stats, f) {
  const items = [
    { title: 'Books read', value: stats.booksRead, icon: 'trophy', filter: { statusFilter: ['Completed'] } },
    { title: 'Currently reading', value: stats.currentlyReadingCount, icon: 'bookOpen', filter: { statusFilter: ['Currently Reading', 'Re-reading'] } },
    { title: 'Wishlist', value: stats.wishlistCount, icon: 'target', filter: { statusFilter: ['Want to Read'] } },
    { title: 'Favorites', value: stats.favoritesCount, icon: 'star', filter: { favoritesOnly: true } },
    { title: 'Reading streak', value: `${stats.readingStreak}d`, icon: 'flame', filter: null },
    { title: 'Pages this year', value: stats.pagesReadThisYear, icon: 'trendingUp', filter: null },
    { title: 'Avg. rating', value: stats.averageRating ? stats.averageRating.toFixed(1) : '\u2014', icon: 'star', filter: null },
    { title: 'Completion rate', value: `${stats.completionRate}%`, icon: 'checklist', filter: null },
  ];
  return `<div class="books-dashboard">${items
    .map((it) => {
      const isActive = it.filter && it.filter.statusFilter
        ? it.filter.statusFilter.every((s) => f.statusFilter.has(s)) && f.statusFilter.size === it.filter.statusFilter.length
        : Boolean(it.filter && it.filter.favoritesOnly && f.favoritesOnly);
      return it.filter ? statShortcut({ ...it, active: isActive }) : StatCard({ title: it.title, value: it.value, icon: it.icon });
    })
    .join('')}</div>`;
}

function renderInsights() {
  const currentlyReading = getCurrentlyReadingPreview(4);
  const recentlyCompleted = getRecentlyCompleted(4);
  const recentQuotes = getRecentQuotes(4);
  const genres = genreBreakdown().slice(0, 6);
  const maxGenreCount = Math.max(1, ...genres.map((g) => g.count));
  const heatmapCells = buildReadingHeatmapMonth(heatmapMonth);
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(heatmapMonth);

  return `
    <aside class="books-insights">
      ${SectionCard({
        title: 'Currently reading',
        content: currentlyReading.length
          ? currentlyReading.map((b) => `<button type="button" class="insight-row" data-open-book="${b.id}"><span class="insight-row__title">${b.title}</span><span class="insight-row__meta">${computeProgress(b)}%</span></button>`).join('')
          : `<p class="book-detail-panel__muted">Nothing in progress.</p>`,
      })}
      ${SectionCard({
        title: 'Recently completed',
        content: recentlyCompleted.length
          ? recentlyCompleted.map((b) => `<button type="button" class="insight-row" data-open-book="${b.id}"><span class="insight-row__title">${b.title}</span><span class="insight-row__meta">${formatDate(b.dateCompleted)}</span></button>`).join('')
          : `<p class="book-detail-panel__muted">Nothing finished yet.</p>`,
      })}
      ${SectionCard({
        title: 'Recent quotes',
        content: recentQuotes.length
          ? recentQuotes.map((q) => `<button type="button" class="insight-row insight-row--quote" data-open-book="${q.bookId}"><span class="insight-row__title">\u201c${q.text.length > 70 ? `${q.text.slice(0, 70)}\u2026` : q.text}\u201d</span></button>`).join('')
          : `<p class="book-detail-panel__muted">No quotes saved yet.</p>`,
      })}
      ${SectionCard({
        title: 'Reading heatmap',
        content: HeatmapGrid({ cells: heatmapCells, monthLabel }),
      })}
      ${SectionCard({
        title: 'Genre breakdown',
        content: genres.length
          ? `<div class="genre-breakdown">${genres.map((g) => `
              <div class="genre-breakdown__row">
                <span class="genre-breakdown__label">${g.genre}</span>
                <div class="genre-breakdown__bar-track"><div class="genre-breakdown__bar genre-breakdown__bar--${g.color}" style="width:${(g.count / maxGenreCount) * 100}%"></div></div>
                <span class="genre-breakdown__count">${g.count}</span>
              </div>`).join('')}</div>`
          : `<p class="book-detail-panel__muted">Add a few books to see this.</p>`,
      })}
    </aside>`;
}

function wireDynamicInteractions(container) {
  // ---- Stat-card filter shortcuts ----
  container.querySelectorAll('[data-stat-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const patch = JSON.parse(btn.dataset.statFilter);
      const next = {};
      if (patch.statusFilter) next.statusFilter = new Set(patch.statusFilter);
      if (patch.favoritesOnly !== undefined) next.favoritesOnly = patch.favoritesOnly;
      setState(next);
      renderDynamic();
    });
  });

  // ---- Card clicks open detail (ignore clicks on the action menu itself) ----
  container.querySelectorAll('.book-card[data-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.action-menu')) return;
      openBookDetail(card.dataset.id);
    });
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.action-menu')) {
        e.preventDefault();
        openBookDetail(card.dataset.id);
      }
    });
  });

  // ---- Insight-row clicks open detail ----
  container.querySelectorAll('[data-open-book]').forEach((btn) => {
    btn.addEventListener('click', () => openBookDetail(btn.dataset.openBook));
  });

  // ---- Card action menus (grid-level, one instance per card, all scoped
  // to this container \u2014 rebuilt fresh every renderDynamic() call, which
  // is safe here because the OLD container content (and every listener on
  // it) is discarded in the same innerHTML assignment that creates the new
  // one; nothing outside this container (the toolbar's popovers, the
  // document-level Escape/outside-click handlers) is touched. ----
  container.querySelectorAll('.book-card .action-menu').forEach((menuEl) => {
    const trigger = menuEl.querySelector('.action-menu__trigger');
    const panel = menuEl.querySelector('.action-menu__panel');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = !panel.hidden;
      container.querySelectorAll('.action-menu__panel').forEach((p) => {
        p.hidden = true;
      });
      container.querySelectorAll('.action-menu__trigger').forEach((t) => t.setAttribute('aria-expanded', 'false'));
      if (!wasOpen) {
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
    panel.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('[data-action]');
      if (!item) return;
      handleCardAction(item.dataset.action, trigger.dataset.id);
    });
  });
  document.addEventListener('click', closeCardMenusOnOutsideClick);

  // ---- Heatmap month navigation ----
  container.querySelectorAll('[data-heatmap-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      heatmapMonth = addMonths(heatmapMonth, btn.dataset.heatmapNav === 'next' ? 1 : -1);
      renderDynamic();
    });
  });
}

// One delegated listener would be cleaner than re-adding this every render,
// but since renderDynamic() replaces #books-dynamic's entire subtree each
// time (menus included), any listener added here is discarded along with it
// \u2014 duplicates never accumulate the way a *document*-level listener would.
function closeCardMenusOnOutsideClick(e) {
  if (e.target.closest('.action-menu')) return;
  document.querySelectorAll('#books-dynamic .action-menu__panel').forEach((p) => {
    p.hidden = true;
  });
}

function handleCardAction(action, bookId) {
  const b = bookById(bookId);
  if (!b) return;
  if (action === 'edit') {
    openBookDialog('edit', b, () => renderDynamic());
  } else if (action === 'duplicate') {
    duplicateBook(bookId);
    renderDynamic();
  } else if (action === 'favorite') {
    toggleFavorite(bookId);
    renderDynamic();
  } else if (action === 'archive') {
    toggleArchived(bookId);
    renderDynamic();
  } else if (action === 'delete') {
    if (window.confirm(`Delete "${b.title}"? This can\u2019t be undone.`)) {
      deleteBook(bookId);
      renderDynamic();
    }
  }
}
