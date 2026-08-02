// Atlas — Goals components. Presentation-only, same rule as
// projects/components.js and habits/components.js: no DOM queries, no
// event listeners. view.js and goal-detail.js wire behavior on top.

import { icon } from '../icons.js';
import { Badge, Progress, ProgressRing, PriorityBadge, DeadlineBadge, Tag, emptyState } from '../components.js';
import { CATEGORY_CONFIG } from './data.js';
import { formatDate, timeAgo } from '../date-utils.js';

// ---- GoalStatusBadge — same pattern as Projects' ProjectStatusBadge, own
// copy rather than a forced shared abstraction: the two status vocabularies
// only partly overlap (Goals has Paused/Cancelled, Projects has Review),
// so promoting this one would need a union type neither module actually wants. ----
export function GoalStatusBadge({ status, statusConfig }) {
  const cfg = statusConfig[status] || { color: 'neutral' };
  return `<span class="goal-status goal-status--${cfg.color}">${status}</span>`;
}

// ---- GoalActionMenu — Edit/Duplicate/Favorite/Archive/Delete, same shape
// as HabitActionMenu (the shared ActionMenu's Pin action doesn't apply here either) ----
export function GoalActionMenu({ id, itemLabel, favorite, archived }) {
  return `
    <div class="action-menu">
      <button type="button" class="icon-btn action-menu__trigger" data-id="${id}" aria-label="Actions for ${itemLabel}" aria-haspopup="true" aria-expanded="false">
        ${icon('moreHorizontal', { size: 16 })}
      </button>
      <div class="menu action-menu__panel" hidden>
        <button type="button" class="menu__item" data-action="edit">${icon('edit', { size: 16 })}<span>Edit</span></button>
        <button type="button" class="menu__item" data-action="duplicate">${icon('copy', { size: 16 })}<span>Duplicate</span></button>
        <button type="button" class="menu__item" data-action="favorite">${icon('star', { size: 16 })}<span>${favorite ? 'Remove from favorites' : 'Add to favorites'}</span></button>
        <div class="menu__divider"></div>
        <button type="button" class="menu__item" data-action="archive">${icon('archive', { size: 16 })}<span>${archived ? 'Unarchive' : 'Archive'}</span></button>
        <button type="button" class="menu__item menu__item--danger" data-action="delete">${icon('trash', { size: 16 })}<span>Delete</span></button>
      </div>
    </div>`;
}

// ---- ForecastPill — compact, for the grid card. Risk 'unknown' (no
// deadline set, so there's nothing to be at risk against) renders neutral,
// not a 4th alarming color. ----
export function ForecastPill({ forecast }) {
  if (forecast.risk === 'unknown') return `<span class="forecast-pill forecast-pill--neutral">${icon('compass', { size: 12 })}<span>No deadline set</span></span>`;
  const label = forecast.risk === 'high' ? 'At risk' : forecast.risk === 'medium' ? 'Behind pace' : 'On track';
  return `<span class="forecast-pill forecast-pill--${forecast.risk}">${icon('trendingUp', { size: 12 })}<span>${label}</span></span>`;
}

// ---- ForecastWidget — the full detail-panel version, every number spelled out ----
export function ForecastWidget({ forecast }) {
  if (forecast.risk === 'unknown' && !forecast.likelyCompletionDate) {
    return `<div class="forecast-widget forecast-widget--empty">${icon('compass', { size: 16 })}<p>Not enough recent progress history yet to forecast this one.</p></div>`;
  }
  return `
    <div class="forecast-widget">
      <div class="forecast-widget__row">
        <span class="forecast-widget__label">Likely completion</span>
        <span class="forecast-widget__value">${forecast.likelyCompletionDate ? formatDate(forecast.likelyCompletionDate) : '\u2014'}</span>
      </div>
      <div class="forecast-widget__row">
        <span class="forecast-widget__label">Confidence</span>
        <span class="forecast-widget__value">${forecast.confidence}%</span>
      </div>
      <div class="forecast-widget__row">
        <span class="forecast-widget__label">Current pace</span>
        <span class="forecast-widget__value">${forecast.velocityPerDay.toFixed(2)}%/day</span>
      </div>
      ${forecast.requiredPacePerDay !== null ? `
      <div class="forecast-widget__row">
        <span class="forecast-widget__label">Required pace</span>
        <span class="forecast-widget__value">${forecast.requiredPacePerDay.toFixed(2)}%/day</span>
      </div>` : ''}
      <div class="forecast-widget__row">
        <span class="forecast-widget__label">Risk</span>
        <span class="forecast-widget__value forecast-widget__value--${forecast.risk}">${forecast.risk}</span>
      </div>
    </div>`;
}

export function GoalInsightCard({ insight }) {
  return `<div class="goal-insight goal-insight--${insight.tone}">${icon('lightbulb', { size: 15 })}<p>${insight.message}</p></div>`;
}

// ---- GoalCard — the grid card ----
export function GoalCard({ goal, progress, forecast }) {
  const cat = CATEGORY_CONFIG[goal.category];
  const linkedCount = goal.linkedProjectIds.length + goal.linkedHabitIds.length + goal.linkedNoteIds.length;
  return `
    <article class="goal-card" data-id="${goal.id}" tabindex="0">
      <div class="goal-card__cover goal-card__cover--${goal.coverColor}">
        <span class="goal-card__icon">${goal.icon}</span>
        ${goal.favorite ? `<span class="goal-card__fav">${icon('star', { size: 14 })}</span>` : ''}
      </div>
      <div class="goal-card__body">
        <div class="goal-card__top">
          <span class="goal-card__category"><span class="goal-card__category-dot goal-card__category-dot--${cat.color}"></span>${cat.label}</span>
          ${GoalActionMenu({ id: goal.id, itemLabel: goal.title, favorite: goal.favorite, archived: goal.archived })}
        </div>
        <h3 class="goal-card__title">${goal.title}</h3>
        <div class="goal-card__badges">
          ${PriorityBadge({ priority: goal.priority })}
          ${DeadlineBadge({ deadline: goal.deadline })}
        </div>
        <div class="goal-card__progress">
          ${ProgressRing({ percentage: progress, color: cat.color, size: 40, showValue: true })}
          <div class="goal-card__progress-meta">
            <span class="goal-card__progress-label">Progress</span>
            ${ForecastPill({ forecast })}
          </div>
        </div>
        ${linkedCount > 0 ? `<div class="goal-card__linked">${icon('layers', { size: 12 })}<span>${linkedCount} linked</span></div>` : ''}
      </div>
    </article>`;
}

// ---- MilestoneRow — used inside the detail panel; subtasks render inline ----
export function MilestoneRow({ goalId, milestone, progress }) {
  return `
    <div class="milestone-row${milestone.completed ? ' is-completed' : ''}" data-milestone-id="${milestone.id}">
      <div class="milestone-row__header">
        <button type="button" class="milestone-row__check" data-action="toggle-milestone" role="checkbox" aria-checked="${milestone.completed}" aria-label="Mark ${milestone.title} ${milestone.completed ? 'incomplete' : 'complete'}">
          ${milestone.completed ? icon('check', { size: 13 }) : ''}
        </button>
        <span class="milestone-row__title">${milestone.title}</span>
        ${PriorityBadge({ priority: milestone.priority })}
        ${milestone.deadline ? DeadlineBadge({ deadline: milestone.deadline }) : ''}
        <button type="button" class="icon-btn milestone-row__menu-trigger" data-action="milestone-menu" aria-label="More actions" aria-haspopup="true" aria-expanded="false">${icon('moreHorizontal', { size: 15 })}</button>
      </div>
      <div class="menu milestone-row__menu-panel" hidden>
        <button type="button" class="menu__item" data-action="duplicate-milestone">${icon('copy', { size: 15 })}<span>Duplicate</span></button>
        <button type="button" class="menu__item menu__item--danger" data-action="delete-milestone">${icon('trash', { size: 15 })}<span>Delete</span></button>
      </div>
      ${Progress({ percentage: progress, color: milestone.completed ? 'success' : 'accent' })}
      <div class="milestone-row__subtasks">
        ${milestone.subtasks
          .map(
            (s) => `
          <label class="milestone-row__subtask${s.done ? ' is-done' : ''}">
            <input type="checkbox" data-action="toggle-subtask" data-subtask-id="${s.id}" ${s.done ? 'checked' : ''} />
            <span>${s.title}</span>
          </label>`
          )
          .join('')}
        <button type="button" class="milestone-row__add-subtask" data-action="add-subtask">${icon('plus', { size: 13 })}<span>Add subtask</span></button>
      </div>
    </div>`;
}

// ---- Linked entity chip — same markup, three different data sources
// (Project / Habit / Note) supplied by the caller ----
export function LinkedEntityChip({ icon: iconName, title, meta, color = 'slate' }) {
  return `
    <div class="linked-chip">
      <span class="linked-chip__icon linked-chip__icon--${color}">${icon(iconName, { size: 14 })}</span>
      <span class="linked-chip__body">
        <span class="linked-chip__title">${title}</span>
        ${meta ? `<span class="linked-chip__meta">${meta}</span>` : ''}
      </span>
    </div>`;
}

export function GoalActivityFeed({ activity }) {
  if (!activity.length) return `<p class="goal-activity__empty">No activity yet.</p>`;
  return `
    <div class="goal-activity">
      ${activity
        .slice()
        .reverse()
        .map(
          (a) => `
        <div class="goal-activity__row">
          <span class="goal-activity__dot goal-activity__dot--${a.type}"></span>
          <span class="goal-activity__message">${a.message}</span>
          <span class="goal-activity__time">${timeAgo(a.date)}</span>
        </div>`
        )
        .join('')}
    </div>`;
}

export function GoalSkeleton({ count = 6 }) {
  return Array.from(
    { length: count },
    () => `
    <div class="goal-card goal-card--skeleton" aria-hidden="true">
      <div class="skeleton-block" style="height:64px;border-radius:var(--radius-md) var(--radius-md) 0 0;"></div>
      <div class="goal-card__body">
        <div class="skeleton-block skeleton-block--title"></div>
        <div class="skeleton-block skeleton-block--text" style="width:70%"></div>
        <div class="skeleton-block skeleton-block--footer"></div>
      </div>
    </div>`
  ).join('');
}

export function GoalsEmptyState({ hasFilters }) {
  return hasFilters
    ? emptyState({ icon: 'search', title: 'No goals match', description: 'Try adjusting your filters or search.', size: 'md' })
    : emptyState({ icon: 'target', title: 'No goals yet', description: 'Set your first goal to start tracking progress toward it.', size: 'md' });
}
