// Atlas — Goal detail panel. Same overlay shell + open/close mechanics as
// Projects' own detail panel (projects/view.js) — including the same
// choice to focus the close button on open rather than a full Tab-trap,
// since this panel is dense with interactive rows (milestone checkboxes,
// subtask checkboxes, menu triggers) that need normal Tab flow through
// them. Kept in its own file purely because of size: Projects' equivalent
// is ~80 lines; this one is several times that once milestones, subtasks,
// forecast, three kinds of linked entities, and the activity feed are all
// in it. Same layer as view.js, just split out.

import { icon } from '../icons.js';
import { PriorityBadge, DeadlineBadge, Progress, ProgressRing } from '../components.js';
import { CATEGORY_CONFIG, STATUS_CONFIG, TIMEFRAME_CONFIG, goalById } from './data.js';
import {
  computeGoalProgress, computeMilestoneProgress, computeForecast, generateInsight,
  toggleFavorite, toggleArchived, duplicateGoal, deleteGoal, updateGoal,
  addMilestone, toggleMilestoneComplete, deleteMilestone, duplicateMilestone,
  addSubtask, toggleSubtask,
} from './state.js';
import { GoalStatusBadge, GoalActionMenu, ForecastWidget, GoalInsightCard, MilestoneRow, LinkedEntityChip, GoalActivityFeed } from './components.js';
import { openGoalDialog } from './goal-dialog.js';
import { projects } from '../projects/data.js';
import { habits } from '../habits/data.js';
import { computeStreak } from '../habits/state.js';
import { notes } from '../notes/data.js';
import { formatDate, timeAgo } from '../date-utils.js';

let lastFocusedBeforeDetail = null;
let onChangeCallback = null;

export function initGoalDetail(onChange) {
  onChangeCallback = onChange;
  const overlay = document.getElementById('goal-detail-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGoalDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeGoalDetail();
  });
  // One listener for the panel's whole lifetime, not one per refresh —
  // wireDetailInteractions() re-runs on every interaction (see refresh()),
  // so anything added there instead would accumulate a duplicate listener
  // per click, forever.
  document.addEventListener('click', (e) => {
    if (overlay.hidden) return;
    const panel = document.getElementById('goal-detail-panel');
    if (!e.target.closest('.action-menu') && !e.target.closest('.milestone-row__menu-trigger')) closeAllMenus(panel);
  });
}

export function openGoalDetail(goalId) {
  const g = goalById(goalId);
  if (!g) return;
  lastFocusedBeforeDetail = document.activeElement;
  renderInPlace(goalId);
  const overlay = document.getElementById('goal-detail-overlay');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('goal-detail-panel').querySelector('#goal-detail-close').focus();
}

// Re-renders the panel's content without touching focus or the overlay's
// visibility — used after an interaction inside an already-open panel
// (toggling a subtask, etc.), where re-focusing the close button every
// time would yank keyboard focus away mid-flow (e.g. checking off several
// subtasks in a row).
function renderInPlace(goalId) {
  const g = goalById(goalId);
  if (!g) return;
  const panel = document.getElementById('goal-detail-panel');
  panel.innerHTML = renderDetailContent(g);
  wireDetailInteractions(g);
}

export function closeGoalDetail() {
  const overlay = document.getElementById('goal-detail-overlay');
  overlay.hidden = true;
  document.body.style.overflow = '';
  lastFocusedBeforeDetail?.focus?.();
}

function refresh(goalId) {
  const overlay = document.getElementById('goal-detail-overlay');
  if (overlay.hidden) return;
  renderInPlace(goalId);
  onChangeCallback?.();
}

function detailSection(title, content, extraClass = '') {
  return `<section class="goal-detail-panel__section ${extraClass}"><h4>${title}</h4>${content}</section>`;
}

function renderDetailContent(g) {
  const progress = computeGoalProgress(g);
  const forecast = computeForecast(g);
  const insight = generateInsight(g);
  const cat = CATEGORY_CONFIG[g.category];

  const linkedProjects = g.linkedProjectIds.map((id) => projects.find((p) => p.id === id)).filter(Boolean);
  const linkedHabits = g.linkedHabitIds.map((id) => habits.find((h) => h.id === id)).filter(Boolean);
  const linkedNotes = g.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);

  return `
    <button type="button" class="icon-btn goal-detail-panel__close" id="goal-detail-close" aria-label="Close panel">${icon('x', { size: 18 })}</button>

    <div class="goal-detail-panel__header goal-detail-panel__header--${g.coverColor}">
      <span class="goal-detail-panel__icon">${g.icon}</span>
      <div class="goal-detail-panel__heading">
        <h2>${g.title}</h2>
        <div class="goal-detail-panel__badges">
          <span class="goal-card__category"><span class="goal-card__category-dot goal-card__category-dot--${cat.color}"></span>${cat.label}</span>
          <span class="goal-card__category">${TIMEFRAME_CONFIG[g.timeframe].label}</span>
          ${GoalStatusBadge({ status: g.status, statusConfig: STATUS_CONFIG })}
          ${PriorityBadge({ priority: g.priority })}
        </div>
      </div>
      <div class="goal-detail-panel__actions">
        <button type="button" class="btn btn--secondary" id="goal-detail-edit">${icon('edit', { size: 15 })}<span>Edit</span></button>
        ${GoalActionMenu({ id: g.id, itemLabel: g.title, favorite: g.favorite, archived: g.archived })}
      </div>
    </div>

    <div class="goal-detail-panel__scroll">
      ${g.description ? `<p class="goal-detail-panel__desc">${g.description}</p>` : ''}

      <div class="goal-detail-panel__progress-row">
        ${ProgressRing({ percentage: progress, color: cat.color, size: 64, showValue: true })}
        <div class="goal-detail-panel__progress-copy">
          ${g.measurable ? `<div class="goal-detail-panel__measurable"><span>${g.measurable.currentValue} / ${g.measurable.targetValue} ${g.measurable.unit}</span></div>` : ''}
          ${DeadlineBadge({ deadline: g.deadline })}
          ${g.startDate ? `<div class="goal-detail-panel__muted">Started ${formatDate(g.startDate)}</div>` : ''}
        </div>
      </div>

      ${GoalInsightCard({ insight })}

      ${detailSection('Forecast', ForecastWidget({ forecast }))}

      ${g.measurable ? detailSection('Update progress', `
        <div class="goal-detail-panel__measurable-editor">
          <input type="number" id="goal-detail-measurable-input" min="0" value="${g.measurable.currentValue}" />
          <span>/ ${g.measurable.targetValue} ${g.measurable.unit}</span>
          <button type="button" class="btn btn--secondary" id="goal-detail-measurable-save">Update</button>
        </div>`) : ''}

      ${detailSection('Milestones', `
        <div class="goal-detail-panel__milestones">
          ${g.milestones.length
            ? g.milestones.map((m) => MilestoneRow({ goalId: g.id, milestone: m, progress: computeMilestoneProgress(m) })).join('')
            : '<p class="goal-detail-panel__muted">No milestones yet.</p>'}
          <button type="button" class="btn btn--secondary" id="goal-detail-add-milestone">${icon('plus', { size: 15 })}<span>Add milestone</span></button>
        </div>`)}

      ${detailSection('Linked projects', linkedProjects.length
        ? linkedProjects.map((p) => LinkedEntityChip({ icon: 'folder', title: p.title, meta: `${p.status} \u00b7 ${p.progress}%`, color: p.color })).join('')
        : '<p class="goal-detail-panel__muted">No linked projects.</p>')}

      ${detailSection('Linked habits', linkedHabits.length
        ? linkedHabits.map((h) => LinkedEntityChip({ icon: h.icon, title: h.title, meta: `${computeStreak(h).current}d current streak`, color: h.color })).join('')
        : '<p class="goal-detail-panel__muted">No linked habits.</p>')}

      ${detailSection('Linked notes', linkedNotes.length
        ? linkedNotes.map((n) => LinkedEntityChip({ icon: 'fileText', title: n.title, meta: `Updated ${timeAgo(n.updatedAt)}`, color: 'slate' })).join('')
        : '<p class="goal-detail-panel__muted">No linked notes.</p>')}

      ${detailSection('Notes', `<textarea class="goal-detail-panel__notes" id="goal-detail-notes" rows="3" placeholder="Scratch notes for this goal\u2026">${g.notes || ''}</textarea>`)}

      ${detailSection('Activity', GoalActivityFeed({ activity: g.activity }))}
    </div>`;
}

function wireDetailInteractions(g) {
  const panel = document.getElementById('goal-detail-panel');
  panel.querySelector('#goal-detail-close').addEventListener('click', closeGoalDetail);
  panel.querySelector('#goal-detail-edit').addEventListener('click', () => {
    openGoalDialog('edit', g, () => refresh(g.id));
  });

  const measurableSave = panel.querySelector('#goal-detail-measurable-save');
  if (measurableSave) {
    measurableSave.addEventListener('click', () => {
      const val = Number(panel.querySelector('#goal-detail-measurable-input').value) || 0;
      updateGoal(g.id, { measurable: { ...g.measurable, currentValue: Math.max(0, val) } });
      refresh(g.id);
    });
  }

  const notesArea = panel.querySelector('#goal-detail-notes');
  notesArea.addEventListener('blur', () => {
    if (notesArea.value !== g.notes) updateGoal(g.id, { notes: notesArea.value });
  });

  panel.querySelector('#goal-detail-add-milestone').addEventListener('click', () => {
    const title = window.prompt('Milestone title');
    if (title && title.trim()) {
      addMilestone(g.id, { title: title.trim() });
      refresh(g.id);
    }
  });

  // Action menu (favorite/duplicate/archive/delete)
  const actionTrigger = panel.querySelector('.goal-detail-panel__actions .action-menu__trigger');
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
      toggleFavorite(g.id);
      refresh(g.id);
    } else if (action === 'archive') {
      toggleArchived(g.id);
      refresh(g.id);
    } else if (action === 'duplicate') {
      const copy = duplicateGoal(g.id);
      onChangeCallback?.();
      openGoalDetail(copy.id);
    } else if (action === 'delete') {
      if (window.confirm(`Delete "${g.title}"? This can\u2019t be undone.`)) {
        deleteGoal(g.id);
        closeGoalDetail();
        onChangeCallback?.();
      }
    }
  });

  // Milestone rows: toggle complete, per-row menu, subtasks
  panel.querySelectorAll('.milestone-row').forEach((row) => {
    const milestoneId = row.dataset.milestoneId;
    row.querySelector('[data-action="toggle-milestone"]').addEventListener('click', () => {
      toggleMilestoneComplete(g.id, milestoneId);
      refresh(g.id);
    });
    const menuTrigger = row.querySelector('[data-action="milestone-menu"]');
    const menuPanel = row.querySelector('.milestone-row__menu-panel');
    menuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = !menuPanel.hidden;
      closeAllMenus(panel);
      if (!wasOpen) {
        menuPanel.hidden = false;
        menuTrigger.setAttribute('aria-expanded', 'true');
      }
    });
    menuPanel.addEventListener('click', (e) => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      if (item.dataset.action === 'duplicate-milestone') duplicateMilestone(g.id, milestoneId);
      else if (item.dataset.action === 'delete-milestone') deleteMilestone(g.id, milestoneId);
      refresh(g.id);
    });
    row.querySelectorAll('[data-action="toggle-subtask"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        toggleSubtask(g.id, milestoneId, cb.dataset.subtaskId);
        refresh(g.id);
      });
    });
    row.querySelector('[data-action="add-subtask"]').addEventListener('click', () => {
      const title = window.prompt('Subtask title');
      if (title && title.trim()) {
        addSubtask(g.id, milestoneId, title.trim());
        refresh(g.id);
      }
    });
  });
}

function closeAllMenus(panel) {
  panel.querySelectorAll('.action-menu__panel, .milestone-row__menu-panel').forEach((p) => {
    p.hidden = true;
  });
  panel.querySelectorAll('.action-menu__trigger, .milestone-row__menu-trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
