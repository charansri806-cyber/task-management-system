const $ = (selector) => document.querySelector(selector);
const taskList = $('#task-list');
const dialog = $('#task-dialog');
const taskForm = $('#task-form');
const filterSelect = $('#filter-select');
const searchInput = $('#search-input');
const sortSelect = $('#sort-select');
let tasks = [];
let activeFilter = 'all';
let toastTimer;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  let data = {};
  try { data = await response.json(); } catch { /* A JSON response is expected from the API. */ }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('toast-error', isError);
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2700);
}

function formatDate(dateString, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!dateString) return '';
  const date = new Date(`${dateString.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, options).format(date);
}

function isPastDue(task) {
  if (!task.dueDate || task.status === 'completed') return false;
  const due = new Date(`${task.dueDate}T23:59:59`);
  return due.getTime() < Date.now();
}

function renderStats() {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const pending = tasks.length - completed;
  const high = tasks.filter((task) => task.priority === 'high').length;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  $('#stat-total').textContent = tasks.length;
  $('#stat-completed').textContent = completed;
  $('#stat-pending').textContent = pending;
  $('#stat-high').textContent = high;
  $('#progress-percent').textContent = `${percent}%`;
  $('#progress-fill').style.width = `${percent}%`;
  $('#progress-bar').setAttribute('aria-valuenow', percent);
  $('#nav-total').textContent = tasks.length;
  $('#nav-pending').textContent = pending;
}

function visibleTasks() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  let filtered = tasks.filter((task) => {
    const matchesSearch = task.title.toLocaleLowerCase().includes(query);
    const matchesFilter = activeFilter === 'all'
      || task.status === activeFilter
      || task.priority === activeFilter;
    return matchesSearch && matchesFilter;
  });
  const priorityRank = { high: 0, medium: 1, low: 2 };
  switch (sortSelect.value) {
    case 'oldest': filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
    case 'due': filtered.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }); break;
    case 'priority': filtered.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]); break;
    default: filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return filtered;
}

function renderTasks() {
  const visible = visibleTasks();
  $('#visible-count').textContent = visible.length;
  $('#clear-search').hidden = !searchInput.value;
  if (!visible.length) {
    const hasTasks = tasks.length > 0;
    taskList.innerHTML = `<div class="empty-state"><span class="empty-icon">${hasTasks ? '⌕' : '✓'}</span><h3>${hasTasks ? 'Nothing matches just yet' : 'A fresh start.'}</h3><p>${hasTasks ? 'Try another search or switch up your filters.' : 'Add your first task and make today count.'}</p>${hasTasks ? '' : '<button type="button" class="button button-primary" data-action="add">＋ Add your first task</button>'}</div>`;
    return;
  }
  taskList.innerHTML = visible.map((task) => {
    const dueLabel = task.dueDate ? formatDate(task.dueDate, { month: 'short', day: 'numeric' }) : 'No due date';
    const dueClass = isPastDue(task) ? 'due-overdue' : (task.dueDate === new Date().toISOString().slice(0, 10) ? 'due-today' : '');
    const statusLabel = task.status === 'completed' ? 'Completed' : 'Pending';
    const priorityLabel = task.priority[0].toUpperCase() + task.priority.slice(1);
    return `<article class="task-card ${task.status === 'completed' ? 'is-completed' : ''}" data-id="${escapeHtml(task.id)}">
      <input class="task-check" type="checkbox" aria-label="Mark ${escapeHtml(task.title)} ${task.status === 'completed' ? 'pending' : 'completed'}" ${task.status === 'completed' ? 'checked' : ''} data-action="toggle">
      <div class="task-main"><div class="task-title-row"><span class="task-title">${escapeHtml(task.title)}</span><span class="priority-badge priority-${escapeHtml(task.priority)}">${priorityLabel}</span><span class="status-badge ${task.status === 'completed' ? 'done' : ''}">${statusLabel}</span></div>
      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
      <div class="task-meta"><span class="meta-item"><span class="meta-icon">▧</span> Created ${formatDate(task.createdAt)}</span><span class="meta-item ${dueClass}"><span class="meta-icon">◷</span> ${dueLabel}${isPastDue(task) ? ' · overdue' : ''}</span></div></div>
      <div class="task-actions"><button class="icon-button" type="button" aria-label="Edit ${escapeHtml(task.title)}" title="Edit task" data-action="edit">✎</button><button class="icon-button delete-button" type="button" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task" data-action="delete">×</button></div>
    </article>`;
  }).join('');
}

function render() {
  renderStats();
  renderTasks();
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === activeFilter);
  });
  filterSelect.value = activeFilter;
}

async function refreshTasks() {
  const result = await api('/api/tasks');
  tasks = result.tasks;
  render();
}

function resetForm() {
  taskForm.reset();
  $('#task-id').value = '';
  $('#task-priority').value = 'medium';
  $('#task-status').value = 'pending';
  $('#dialog-title').textContent = 'Add a task';
  $('#save-task').textContent = 'Add task';
  $('#form-error').textContent = '';
  $('#title-error').textContent = '';
}

function openCreateDialog() {
  resetForm();
  dialog.showModal();
  $('#task-title').focus();
}

function openEditDialog(task) {
  resetForm();
  $('#task-id').value = task.id;
  $('#task-title').value = task.title;
  $('#task-description').value = task.description;
  $('#task-due').value = task.dueDate;
  $('#task-priority').value = task.priority;
  $('#task-status').value = task.status;
  $('#dialog-title').textContent = 'Edit task';
  $('#save-task').textContent = 'Save changes';
  dialog.showModal();
  $('#task-title').focus();
}

$('#add-task-button').addEventListener('click', openCreateDialog);
document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#title-error').textContent = '';
  $('#form-error').textContent = '';
  const title = $('#task-title').value.trim();
  if (!title) {
    $('#title-error').textContent = 'Please enter a task title.';
    $('#task-title').focus();
    return;
  }
  const id = $('#task-id').value;
  const body = {
    title,
    description: $('#task-description').value.trim(),
    dueDate: $('#task-due').value,
    priority: $('#task-priority').value,
    status: $('#task-status').value
  };
  const saveButton = $('#save-task');
  saveButton.disabled = true;
  try {
    await api(id ? `/api/tasks/${encodeURIComponent(id)}` : '/api/tasks', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(body)
    });
    dialog.close();
    await refreshTasks();
    showToast(id ? 'Task updated.' : 'Task added.');
  } catch (error) {
    $('#form-error').textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

taskList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'add') return openCreateDialog();
  const card = button.closest('[data-id]');
  if (!card) return;
  const task = tasks.find((item) => item.id === card.dataset.id);
  if (!task) return;
  if (action === 'edit') return openEditDialog(task);
  if (action === 'delete') {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    button.disabled = true;
    try {
      await api(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
      await refreshTasks();
      showToast('Task deleted.');
    } catch (error) {
      button.disabled = false;
      showToast(error.message, true);
    }
  }
});

taskList.addEventListener('change', async (event) => {
  if (!event.target.matches('[data-action="toggle"]')) return;
  const card = event.target.closest('[data-id]');
  const task = tasks.find((item) => item.id === card?.dataset.id);
  if (!task) return;
  event.target.disabled = true;
  try {
    await api(`/api/tasks/${encodeURIComponent(task.id)}/complete`, {
      method: 'PATCH', body: JSON.stringify({ completed: event.target.checked })
    });
    await refreshTasks();
    showToast(event.target.checked ? 'Task completed. Nice work.' : 'Task marked pending.');
  } catch (error) {
    event.target.checked = !event.target.checked;
    event.target.disabled = false;
    showToast(error.message, true);
  }
});

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  render();
}));
filterSelect.addEventListener('change', () => { activeFilter = filterSelect.value; render(); });
searchInput.addEventListener('input', renderTasks);
sortSelect.addEventListener('change', renderTasks);
$('#clear-search').addEventListener('click', () => { searchInput.value = ''; renderTasks(); searchInput.focus(); });
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

const now = new Date();
$('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
const hour = now.getHours();
$('#greeting').textContent = hour < 12 ? 'A FRESH START' : (hour < 18 ? 'YOUR DAILY SPACE' : 'A MOMENT TO RESET');
refreshTasks().catch((error) => {
  taskList.innerHTML = `<div class="empty-state"><span class="empty-icon">!</span><h3>We couldn't load your tasks.</h3><p>${escapeHtml(error.message)} Refresh the page to try again.</p></div>`;
  showToast('Could not connect to the task service.', true);
});
