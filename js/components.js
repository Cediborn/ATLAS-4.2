// Atlas — Reusable UI components.
// Every dashboard section is assembled from these; nothing here is a one-off.
// These are plain functions returning markup today; each becomes one React
// component (same prop shape) when Atlas moves to Next.js (Foundation §4).

import { icon } from './icons.js';
import { daysUntil, formatDate } from './date-utils.js';

// ---- Badge --------------------------------------------------------------
// Maps common status words to a semantic color automatically; pass `variant`
// to override when a label doesn't match (e.g. a custom tag).
const BADGE_VARIANT_MAP = {
  active: 'success',
  completed: 'success',
  'in progress': 'accent',
  paused: 'neutral',
  'not started': 'neutral',
  planning: 'planning',
  archived: 'archived',
  blocked: 'danger',
  review: 'warning',
  'high priority': 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

export function Badge({ label, variant }) {
  const resolved = variant || BADGE_VARIANT_MAP[String(label).toLowerCase()] || 'neutral';
  return `<span class="badge badge--${resolved}">${label}</span>`;
}

// ---- Progress -------------------------------------------------------------
export function Progress({ percentage, label, color = 'accent' }) {
  const pct = Math.max(0, Math.min(100, percentage));
  return `
    <div class="progress-component">
      ${label ? `<div class="progress-component__label"><span>${label}</span><span>${pct}%</span></div>` : ''}
      <div class="progress progress--${color}"><div class="progress__fill" style="width:${pct}%"></div></div>
    </div>`;
}

// ---- ProgressRing — originally only existed as one branch of Projects'
// own ProjectProgress('ring'); promoted here once Habits needed the exact
// same ring (several, on its header) rather than a second implementation.
// Projects' ProjectProgress now delegates to this for its 'ring' variant.
export function ProgressRing({ percentage, label, color = 'accent', size = 44, showValue = true }) {
  const pct = Math.max(0, Math.min(100, percentage));
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return `
    <div class="progress-ring-component">
      <svg class="progress-ring progress-ring--${color}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label ? `${label}: ` : ''}${pct}% complete">
        <circle class="progress-ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" />
        <circle class="progress-ring__fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
          transform="rotate(-90 ${size / 2} ${size / 2})" />
        ${showValue && size >= 32 ? `<text x="50%" y="51%" text-anchor="middle" dominant-baseline="middle" class="progress-ring__label">${pct}</text>` : ''}
      </svg>
      ${label ? `<span class="progress-ring-component__label">${label}</span>` : ''}
    </div>`;
}

// ---- PriorityBadge — originally only existed as Projects' own
// ProjectPriority; promoted here once Goals needed the identical
// Low/Medium/High/Critical system. Projects now delegates to this.
// Critical reuses High's hue rendered solid instead of tinted — escalates
// by weight, not by adding a fifth color.
export const PRIORITY_CONFIG = {
  Low: { color: 'neutral', solid: false },
  Medium: { color: 'warning', solid: false },
  High: { color: 'danger', solid: false },
  Critical: { color: 'danger', solid: true },
};
export const PRIORITIES = Object.keys(PRIORITY_CONFIG);

export function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || { color: 'neutral', solid: false };
  const solid = cfg.solid ? ' priority-badge--solid' : '';
  return `<span class="priority-badge priority-badge--${cfg.color}${solid}"><span class="priority-badge__dot"></span>${priority}</span>`;
}

// ---- DeadlineBadge — originally only existed as Projects' own
// ProjectDeadline; promoted here once Goals needed the identical
// none/normal/soon/overdue proximity display. Projects now delegates to this. ----
export function DeadlineBadge({ deadline }) {
  if (!deadline) {
    return `<span class="deadline-badge deadline-badge--none">${icon('calendar', { size: 13 })}<span>No deadline</span></span>`;
  }
  const days = daysUntil(deadline);
  const urgency = days < 0 ? 'overdue' : days <= 3 ? 'soon' : 'normal';
  const relative = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `${days}d left`;
  return `
    <span class="deadline-badge deadline-badge--${urgency}" title="${formatDate(deadline)}">
      ${icon('calendar', { size: 13 })}<span>${relative}</span>
    </span>`;
}

export function GoalItem({ id, title, deadline, progress }) {
  return `
    <div class="project-item" data-id="${id}">
      <div class="project-item__top">
        <span class="project-item__title">${title}</span>
        ${DeadlineBadge({ deadline })}
      </div>
      ${typeof progress === 'number' ? Progress({ percentage: progress }) : ''}
    </div>`;
}

// ---- Empty state (one component, two sizes: full-page vs inside a card) --
export function emptyState({ icon: iconName, title, description, size = 'md', badge }) {
  const sizeClass = size === 'sm' ? ' empty-state--sm' : '';
  return `
    <div class="empty-state${sizeClass}">
      <span class="empty-state__icon">${icon(iconName, { size: size === 'sm' ? 20 : 26 })}</span>
      <h2>${title}</h2>
      ${description ? `<p>${description}</p>` : ''}
      ${badge || ''}
    </div>`;
}

// ---- StatCard ---------------------------------------------------------
export function StatCard({ title, value, icon: iconName, trend, accent }) {
  const accentClass = accent ? ` stat-card--${accent}` : '';
  return `
    <div class="stat-card${accentClass}">
      <div class="stat-card__top">
        <span class="stat-card__icon">${icon(iconName, { size: 17 })}</span>
        ${trend ? `<span class="stat-card__trend">${trend}</span>` : ''}
      </div>
      <span class="stat-card__value">${value}</span>
      <span class="stat-card__label">${title}</span>
    </div>`;
}

// ---- SectionCard — the one wrapper every dashboard section uses ---------
export function SectionCard({ title, description, action, content }) {
  return `
    <section class="section-card">
      <header class="section-card__header">
        <div class="section-card__heading">
          <h3>${title}</h3>
          ${description ? `<p class="section-card__desc">${description}</p>` : ''}
        </div>
        ${action || ''}
      </header>
      <div class="section-card__body">${content}</div>
    </section>`;
}

export function sectionAction(routeId, label = 'View all') {
  return `<a href="#/${routeId}" class="section-card__action">${label}</a>`;
}

// ---- Quick Action Button ------------------------------------------------
export function QuickActionButton({ icon: iconName, label, id }) {
  return `
    <button type="button" class="quick-action" data-action="${id}">
      <span class="quick-action__icon">${icon(iconName, { size: 18 })}</span>
      <span class="quick-action__label">${label}</span>
    </button>`;
}

// ---- Tag — a generic clickable pill, shared by Projects and Notes ----
export function Tag({ label, active = false }) {
  return `<button type="button" class="tag-chip${active ? ' is-active' : ''}" data-tag="${label}">${label}</button>`;
}

// ---- ActionMenu — favorite/pin/archive quick actions, shared by Projects
// and Notes (identical logic; the caller supplies the item's id/label/flags)
export function ActionMenu({ id, itemLabel, favorite, pinned, archived }) {
  return `
    <div class="action-menu">
      <button type="button" class="icon-btn action-menu__trigger" data-id="${id}" aria-label="Actions for ${itemLabel}" aria-haspopup="true" aria-expanded="false">
        ${icon('moreHorizontal', { size: 16 })}
      </button>
      <div class="menu action-menu__panel" hidden>
        <button type="button" class="menu__item" data-action="favorite">${icon('star', { size: 16 })}<span>${favorite ? 'Remove from favorites' : 'Add to favorites'}</span></button>
        <button type="button" class="menu__item" data-action="pin">${icon('pin', { size: 16 })}<span>${pinned ? 'Unpin' : 'Pin to top'}</span></button>
        <div class="menu__divider"></div>
        <button type="button" class="menu__item" data-action="archive">${icon('archive', { size: 16 })}<span>${archived ? 'Unarchive' : 'Archive'}</span></button>
      </div>
    </div>`;
}

// ---- List items -----------------------------------------------------------

export function TaskItem({ id, title, category, priority, dueTime, done }) {
  return `
    <div class="task-item${done ? ' is-done' : ''}" data-id="${id}" role="checkbox" aria-checked="${done}" aria-label="${title}" tabindex="0">
      <span class="task-item__check">${icon('check', { size: 11 })}</span>
      <span class="task-item__body">
        <span class="task-item__title">${title}</span>
        <span class="task-item__meta">
          ${priority ? `<span class="task-item__priority task-item__priority--${priority}" title="${priority} priority"></span>` : ''}
          <span>${category}</span>
          ${dueTime ? `<span class="task-item__due">${dueTime}</span>` : ''}
        </span>
      </span>
    </div>`;
}

export function EventItem({ id, time, title, location, color = 'accent' }) {
  return `
    <div class="event-item" data-id="${id}">
      <span class="event-item__color event-item__color--${color}" aria-hidden="true"></span>
      <span class="event-item__time">${time}</span>
      <span class="event-item__body">
        <span class="event-item__title">${title}</span>
        ${location ? `<span class="event-item__location">${location}</span>` : ''}
      </span>
    </div>`;
}

export function ProjectItem({ id, name, status, lastUpdated, progress }) {
  return `
    <div class="project-item" data-id="${id}">
      <div class="project-item__top">
        <span class="project-item__title">${name}</span>
        ${Badge({ label: status })}
      </div>
      <div class="project-item__meta">Updated ${lastUpdated}</div>
      ${typeof progress === 'number' ? Progress({ percentage: progress }) : ''}
    </div>`;
}

export function NoteItem({ id, title, editedDate, tag }) {
  return `
    <div class="note-item" data-id="${id}">
      <span class="note-item__file-icon">${icon('fileText', { size: 17 })}</span>
      <span class="note-item__body">
        <span class="note-item__title">${title}</span>
        <span class="note-item__meta">${editedDate}</span>
      </span>
      ${tag ? Badge({ label: tag, variant: 'neutral' }) : ''}
    </div>`;
}

// ---- HeatmapGrid — originally only existed as Habits' own component
// (its monthly completion heatmap); promoted here once Books needed the
// exact same GitHub-style month grid for its reading heatmap. Habits'
// components.js now re-exports this instead of keeping a second copy. ----
export function HeatmapGrid({ cells, monthLabel }) {
  const weekdayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return `
    <div class="heatmap">
      <div class="heatmap__header">
        <button type="button" class="icon-btn" data-heatmap-nav="prev" aria-label="Previous month">${icon('chevronRight', { size: 15, className: 'heatmap__chevron-left' })}</button>
        <span class="heatmap__month">${monthLabel}</span>
        <button type="button" class="icon-btn" data-heatmap-nav="next" aria-label="Next month">${icon('chevronRight', { size: 15 })}</button>
      </div>
      <div class="heatmap__weekdays" aria-hidden="true">${weekdayHeaders.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="heatmap__grid">
        ${cells
          .map((c) => {
            const showData = c.inCurrentMonth && c.completionPct !== null;
            const label = showData ? (c.label || `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(c.date)}: ${c.completionPct}% (${c.doneCount}/${c.dueCount})`) : '';
            return `<span class="heatmap__cell heatmap__cell--${c.inCurrentMonth ? c.level || 'none' : 'outside'}" data-date="${c.key}" ${showData ? `tabindex="0" title="${label}" aria-label="${label}"` : 'aria-hidden="true"'}></span>`;
          })
          .join('')}
      </div>
      <div class="heatmap__legend">
        <span>Less</span>
        <span class="heatmap__cell heatmap__cell--none"></span>
        <span class="heatmap__cell heatmap__cell--low"></span>
        <span class="heatmap__cell heatmap__cell--medium"></span>
        <span class="heatmap__cell heatmap__cell--high"></span>
        <span class="heatmap__cell heatmap__cell--perfect"></span>
        <span>More</span>
      </div>
    </div>`;
}

// ---- LinkedEntityChip — originally only existed as Goals' own component
// (Project/Habit/Note cross-links); promoted here once Books needed the
// identical chip for its own Goal/Project/Habit cross-links. Goals'
// components.js now re-exports this instead of keeping a second copy. ----
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

// ---- ForecastPill / ForecastWidget — originally only existed as Goals'
// own components (its progress-velocity forecast); promoted here once
// Books needed the identical shape for its reading-pace forecast. Goals'
// components.js now re-exports both instead of keeping a second copy.
// Both read a `forecast` object: {risk, likelyCompletionDate, confidence,
// velocityPerDay, requiredPacePerDay}. `risk: 'unknown'` (no target set,
// so there's nothing to be at risk against) renders neutral, not a 4th
// alarming color. ----
export function ForecastPill({ forecast }) {
  if (forecast.risk === 'unknown') return `<span class="forecast-pill forecast-pill--neutral">${icon('compass', { size: 12 })}<span>No target set</span></span>`;
  const label = forecast.risk === 'high' ? 'At risk' : forecast.risk === 'medium' ? 'Behind pace' : 'On track';
  return `<span class="forecast-pill forecast-pill--${forecast.risk}">${icon('trendingUp', { size: 12 })}<span>${label}</span></span>`;
}

export function ForecastWidget({ forecast, emptyLabel = 'Not enough recent progress history yet to forecast this one.' }) {
  if (forecast.risk === 'unknown' && !forecast.likelyCompletionDate) {
    return `<div class="forecast-widget forecast-widget--empty">${icon('compass', { size: 16 })}<p>${emptyLabel}</p></div>`;
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
        <span class="forecast-widget__value">${forecast.velocityLabel || `${forecast.velocityPerDay.toFixed(2)}%/day`}</span>
      </div>
      ${forecast.requiredPacePerDay !== null && forecast.requiredPacePerDay !== undefined ? `
      <div class="forecast-widget__row">
        <span class="forecast-widget__label">Required pace</span>
        <span class="forecast-widget__value">${forecast.requiredPaceLabel || `${forecast.requiredPacePerDay.toFixed(2)}%/day`}</span>
      </div>` : ''}
      <div class="forecast-widget__row">
        <span class="forecast-widget__label">Risk</span>
        <span class="forecast-widget__value forecast-widget__value--${forecast.risk}">${forecast.risk}</span>
      </div>
    </div>`;
}

export function HabitItem({ id, name, icon: iconName = 'flame', streak, completedToday, weeklyProgress }) {
  const hasCheck = typeof completedToday === 'boolean';
  return `
    <div class="habit-item" data-id="${id}">
      <span class="habit-item__icon">${icon(iconName, { size: 17 })}</span>
      <span class="habit-item__body">
        <span class="habit-item__title">${name}</span>
        <span class="habit-item__meta">${streak}</span>
        ${typeof weeklyProgress === 'number' ? Progress({ percentage: weeklyProgress, color: 'warning' }) : ''}
      </span>
      ${
        hasCheck
          ? `<button type="button" class="habit-item__check${completedToday ? ' is-done' : ''}" role="checkbox" aria-checked="${completedToday}" aria-label="Mark ${name} done today">
              ${icon('check', { size: 12 })}
            </button>`
          : ''
      }
    </div>`;
}
