// Atlas — Goals page controller. Same rule as projects/view.js and
// habits/view.js: the only file in the module (besides goal-detail.js,
// split out purely for size) that touches the DOM.

import { icon } from '../icons.js';
import { createPopover } from '../popover.js';
import { StatCard, emptyState, PRIORITIES } from '../components.js';
import { goals, CATEGORY_CONFIG, TIMEFRAME_CONFIG, STATUSES } from './data.js';
import {
  getState, setState, resetFilters, getVisibleGoals, SORT_OPTIONS,
  computeGoalProgress, computeForecast, computeGoalDashboardStats,
  getUpcomingDeadlines, getRecentlyCompleted, getRecentActivity,
  toggleFavorite, toggleArchived, duplicateGoal, deleteGoal,
} from './state.js';
import { GoalCard, GoalSkeleton, GoalsEmptyState } from './components.js';
import { openGoalDialog } from './goal-dialog.js';
import { initGoalDetail, openGoalDetail } from './goal-detail.js';
import { formatDate, timeAgo, daysUntil } from '../date-utils.js';

export function renderGoals(container) {
  container.innerHTML = `
    <div class="goals-page">
      <header class="goals-header">
        <div class="goals-header__top">
          <div>
            <h2>Goals</h2>
            <p class="goals-header__date">${new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
          </div>
          <div class="header-summary" id="goals-header__summary"></div>
        </div>
        <div class="goals-toolbar">
          <label class="toolbar-search" for="goals-search">
            ${icon('search', { size: 16 })}
            <input type="text" id="goals-search" placeholder="Search goals\u2026" autocomplete="off" />
          </label>
          <button type="button" class="btn btn--primary" id="goals-new">${icon('plus', { size: 16 })}<span>New goal</span></button>
          <div class="toolbar-spacer"></div>
          <div class="toolbar-popover">
            <button type="button" class="btn btn--secondary" id="goals-filter-trigger">${icon('filter', { size: 15 })}<span>Filter</span><span class="badge badge--accent" id="goals-filter-count" hidden></span></button>
            <div class="menu menu--wide" id="goals-filter-panel" hidden></div>
          </div>
          <div class="toolbar-popover">
            <button type="button" class="btn btn--secondary" id="goals-sort-trigger">${icon('sort', { size: 15 })}<span>Sort</span></button>
            <div class="menu" id="goals-sort-panel" hidden></div>
          </div>
        </div>
      </header>

      <div class="goals-dashboard" id="goals-dashboard"></div>

      <div class="goals-layout">
        <div class="goals-main" id="goals-main"></div>
        <aside class="goals-insights" id="goals-insights"></aside>
      </div>
    </div>

    <div class="overlay goal-detail-overlay" id="goal-detail-overlay" hidden>
      <aside class="goal-detail-panel" role="dialog" aria-modal="true" aria-label="Goal details" id="goal-detail-panel"></aside>
    </div>
  `;

  initToolbar();
  initGridInteractions();
  initGoalDetail(refreshAll);
  refreshAll();
}

export function renderGoalsSkeleton(container) {
  container.innerHTML = `<div class="goals-page"><div class="goals-main goals-main--grid">${GoalSkeleton({ count: 6 })}</div></div>`;
}

function refreshAll() {
  renderHeaderSummary();
  renderDashboardStats();
  renderMain();
  renderInsights();
}

function renderHeaderSummary() {
  const s = computeGoalDashboardStats();
  document.getElementById('goals-header__summary').innerHTML = `
    <span class="header-summary__item"><strong>${s.goalsActive}</strong> active</span>
    <span class="header-summary__item"><strong>${s.averageProgress}%</strong> avg. progress</span>
    <span class="header-summary__item"><strong>${s.goalHealthScore}%</strong> health score</span>
  `;
}

// ================= DASHBOARD (14 stat cards) — a few of the spec's stats
// (goal-level "streak"/"active days") didn't have a coherent definition
// for something that isn't daily-completable like a habit is, so those
// were left out rather than faked; see BUILD_LOG. =================
function renderDashboardStats() {
  const s = computeGoalDashboardStats();
  const cards = [
    { title: 'Goals Active', value: String(s.goalsActive), icon: 'target', accent: 'accent' },
    { title: 'Goals Completed', value: String(s.goalsCompleted), icon: 'check', accent: 'success' },
    { title: 'Completion Rate', value: `${s.completionRate}%`, icon: 'trendingUp' },
    { title: 'Average Progress', value: `${s.averageProgress}%`, icon: 'sparkle' },
    { title: 'Goal Health', value: `${s.goalHealthScore}%`, icon: 'heart', accent: s.goalHealthScore >= 60 ? 'success' : s.goalHealthScore >= 35 ? 'warning' : 'danger' },
    { title: 'Avg. Completion Time', value: s.averageCompletionDays ? `${s.averageCompletionDays}d` : '\u2014', icon: 'clock' },
    { title: 'Longest Running', value: `${s.longestRunningDays}d`, icon: 'flame' },
    { title: 'Top Category', value: s.mostProductiveCategory ? CATEGORY_CONFIG[s.mostProductiveCategory].label : '\u2014', icon: 'briefcase' },
    { title: 'Upcoming Deadlines', value: String(s.upcomingDeadlineCount), icon: 'calendar' },
    { title: 'Missed Deadlines', value: String(s.missedDeadlineCount), icon: 'x', accent: s.missedDeadlineCount > 0 ? 'danger' : undefined },
    { title: 'Milestones Done', value: `${s.milestonesCompleted}/${s.milestonesTotal}`, icon: 'checklist' },
    { title: 'Goals Archived', value: String(s.goalsArchived), icon: 'archive' },
    { title: 'Habits Linked', value: String(s.habitsLinked), icon: 'repeat' },
    { title: 'Projects Linked', value: String(s.projectsLinked), icon: 'folder' },
  ];
  document.getElementById('goals-dashboard').innerHTML = cards.map((c) => StatCard(c)).join('');
}

// ================= MAIN GRID =================
function hasActiveFilters() {
  const f = getState();
  return Boolean(f.search || f.categoryFilter.size || f.priorityFilter.size || f.statusFilter.size || f.favoritesOnly || f.showArchived);
}

function renderMain() {
  const main = document.getElementById('goals-main');
  const f = getState();
  const visible = getVisibleGoals(goals, f);

  if (!visible.length) {
    main.innerHTML = GoalsEmptyState({ hasFilters: hasActiveFilters() });
    return;
  }

  main.className = 'goals-main goals-main--grid';
  main.innerHTML = visible
    .map((g) => GoalCard({ goal: g, progress: computeGoalProgress(g), forecast: computeForecast(g) }))
    .join('');
}

function initGridInteractions() {
  const main = document.getElementById('goals-main');

  main.addEventListener('click', (e) => {
    const actionItem = e.target.closest('[data-action]');
    if (actionItem) {
      const goalId = actionItem.closest('.action-menu')?.querySelector('.action-menu__trigger')?.dataset.id;
      closeAllActionMenus();
      if (goalId) handleCardAction(goalId, actionItem.dataset.action);
      return;
    }
    const menuTrigger = e.target.closest('.action-menu__trigger');
    if (menuTrigger) {
      const panel = menuTrigger.nextElementSibling;
      const wasOpen = !panel.hidden;
      closeAllActionMenus();
      if (!wasOpen) {
        panel.hidden = false;
        menuTrigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    const card = e.target.closest('.goal-card');
    if (card && !card.classList.contains('goal-card--skeleton')) openGoalDetail(card.dataset.id);
  });

  main.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('goal-card')) {
      e.preventDefault();
      openGoalDetail(e.target.dataset.id);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-menu')) closeAllActionMenus();
  });
}

function closeAllActionMenus() {
  document.querySelectorAll('#goals-main .action-menu__panel').forEach((p) => {
    p.hidden = true;
  });
  document.querySelectorAll('#goals-main .action-menu__trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}

function handleCardAction(goalId, action) {
  const g = goals.find((x) => x.id === goalId);
  if (!g) return;
  if (action === 'edit') {
    openGoalDialog('edit', g, refreshAll);
    return;
  }
  if (action === 'favorite') toggleFavorite(goalId);
  else if (action === 'archive') toggleArchived(goalId);
  else if (action === 'duplicate') duplicateGoal(goalId);
  else if (action === 'delete') {
    if (!window.confirm(`Delete "${g.title}"? This can\u2019t be undone.`)) return;
    deleteGoal(goalId);
  }
  refreshAll();
}

// ================= TOOLBAR =================
function initToolbar() {
  const searchInput = document.getElementById('goals-search');
  searchInput.addEventListener('input', () => {
    setState({ search: searchInput.value });
    renderMain();
  });

  document.getElementById('goals-new').addEventListener('click', () => {
    openGoalDialog('create', null, refreshAll);
  });

  initFilterPopover();
  initSortPopover();
}

function filterCheckbox(type, value, checked, label) {
  return `
    <label class="menu__item filter-checkbox">
      <input type="checkbox" data-filter-type="${type}" value="${value}" ${checked ? 'checked' : ''} />
      <span>${label}</span>
    </label>`;
}

function toggleSetFilter(key, value, checked) {
  const current = new Set(getState()[key]);
  if (checked) current.add(value);
  else current.delete(value);
  setState({ [key]: current });
}

function initFilterPopover() {
  const trigger = document.getElementById('goals-filter-trigger');
  const panel = document.getElementById('goals-filter-panel');

  function render() {
    const f = getState();
    panel.innerHTML = `
      <div class="menu__label">Status</div>
      ${STATUSES.map((s) => filterCheckbox('status', s, f.statusFilter.has(s), s)).join('')}
      <div class="menu__divider"></div>
      <div class="menu__label">Category</div>
      ${Object.keys(CATEGORY_CONFIG).map((c) => filterCheckbox('category', c, f.categoryFilter.has(c), CATEGORY_CONFIG[c].label)).join('')}
      <div class="menu__divider"></div>
      <div class="menu__label">Timeframe</div>
      ${Object.keys(TIMEFRAME_CONFIG).map((t) => filterCheckbox('timeframe', t, f.timeframeFilter.has(t), TIMEFRAME_CONFIG[t].label)).join('')}
      <div class="menu__divider"></div>
      <div class="menu__label">Priority</div>
      ${PRIORITIES.map((p) => filterCheckbox('priority', p, f.priorityFilter.has(p), p)).join('')}
      <div class="menu__divider"></div>
      ${filterCheckbox('favoritesOnly', 'on', f.favoritesOnly, 'Favorites only')}
      ${filterCheckbox('showArchived', 'on', f.showArchived, 'Show archived')}
      <div class="menu__divider"></div>
      <button type="button" class="menu__item" id="goals-filter-clear">${icon('x', { size: 16 })}<span>Clear filters</span></button>
    `;
  }

  createPopover({ trigger, panel, onOpenRender: render });

  panel.addEventListener('change', (e) => {
    const cb = e.target;
    const type = cb.dataset.filterType;
    if (type === 'status') toggleSetFilter('statusFilter', cb.value, cb.checked);
    else if (type === 'category') toggleSetFilter('categoryFilter', cb.value, cb.checked);
    else if (type === 'timeframe') toggleSetFilter('timeframeFilter', cb.value, cb.checked);
    else if (type === 'priority') toggleSetFilter('priorityFilter', cb.value, cb.checked);
    else if (type === 'favoritesOnly') setState({ favoritesOnly: cb.checked });
    else if (type === 'showArchived') setState({ showArchived: cb.checked });
    renderMain();
    updateFilterCount();
  });

  panel.addEventListener('click', (e) => {
    if (e.target.closest('#goals-filter-clear')) {
      resetFilters();
      render();
      renderMain();
      updateFilterCount();
    }
  });
}

function updateFilterCount() {
  const f = getState();
  const count = f.categoryFilter.size + f.timeframeFilter.size + f.priorityFilter.size + f.statusFilter.size + (f.favoritesOnly ? 1 : 0) + (f.showArchived ? 1 : 0);
  const badge = document.getElementById('goals-filter-count');
  badge.hidden = count === 0;
  badge.textContent = String(count);
}

function initSortPopover() {
  const trigger = document.getElementById('goals-sort-trigger');
  const panel = document.getElementById('goals-sort-panel');

  function render() {
    const current = getState().sortBy;
    panel.innerHTML = SORT_OPTIONS.map(
      (opt) => `
      <button type="button" class="menu__item" data-sort="${opt.id}" aria-selected="${opt.id === current}">
        ${opt.id === current ? icon('check', { size: 16 }) : '<span class="menu__item-spacer"></span>'}
        <span>${opt.label}</span>
      </button>`
    ).join('');
  }

  const popover = createPopover({ trigger, panel, onOpenRender: render });

  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sort]');
    if (btn) {
      setState({ sortBy: btn.dataset.sort });
      renderMain();
      popover.close();
    }
  });
}

// ================= INSIGHTS (right panel) =================
function renderInsights() {
  const aside = document.getElementById('goals-insights');
  const upcoming = getUpcomingDeadlines(5);
  const completed = getRecentlyCompleted(5);
  const activity = getRecentActivity(8);

  aside.innerHTML = `
    <section class="insights-card">
      <h3 class="insights-card__title">${icon('calendar', { size: 15 })}<span>Upcoming deadlines</span></h3>
      ${upcoming.length ? upcoming.map((g) => goalMiniRow(g, `${daysUntil(g.deadline)}d left`)).join('') : `<p class="goal-activity__empty">Nothing due soon.</p>`}
    </section>
    <section class="insights-card">
      <h3 class="insights-card__title">${icon('check', { size: 15 })}<span>Recently completed</span></h3>
      ${completed.length ? completed.map((g) => goalMiniRow(g, formatDate(g.completedAt))).join('') : `<p class="goal-activity__empty">Nothing completed yet.</p>`}
    </section>
    <section class="insights-card">
      <h3 class="insights-card__title">${icon('sparkle', { size: 15 })}<span>Recent activity</span></h3>
      ${
        activity.length
          ? `<div class="goal-activity">${activity
              .map(
                (a) => `
          <div class="goal-activity__row">
            <span class="goal-activity__dot goal-activity__dot--${a.type}"></span>
            <span class="goal-activity__message">${a.goalTitle}: ${a.message}</span>
            <span class="goal-activity__time">${timeAgo(a.date)}</span>
          </div>`
              )
              .join('')}</div>`
          : `<p class="goal-activity__empty">No activity yet.</p>`
      }
    </section>
  `;

  aside.querySelectorAll('[data-goal-id]').forEach((row) => {
    row.addEventListener('click', () => openGoalDetail(row.dataset.goalId));
  });
}

function goalMiniRow(g, metaText) {
  return `
    <button type="button" class="goal-mini-row" data-goal-id="${g.id}">
      <span class="goal-mini-row__icon">${g.icon}</span>
      <span class="goal-mini-row__title">${g.title}</span>
      <span class="goal-mini-row__meta">${metaText}</span>
    </button>`;
}
