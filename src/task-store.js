const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const dataFile = path.join(__dirname, '..', 'data', 'tasks.json');
const priorities = new Set(['high', 'medium', 'low']);
const statuses = new Set(['pending', 'completed']);

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

async function ensureDataFile() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, '[]\n', 'utf8');
  }
}

async function readTasks() {
  await ensureDataFile();
  const text = await fs.readFile(dataFile, 'utf8');
  let tasks;
  try {
    tasks = JSON.parse(text);
  } catch {
    throw new Error('Task data file is not valid JSON. Restore it from a backup or reset it to [].');
  }
  if (!Array.isArray(tasks)) throw new Error('Task data file must contain a JSON array.');
  return tasks;
}

async function writeTasks(tasks) {
  const temporaryFile = `${dataFile}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryFile, dataFile);
}

function normalizeTask(input, existing = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('A task object is required.');
  }

  const title = typeof input.title === 'string' ? input.title.trim() : (existing.title || '');
  const description = typeof input.description === 'string'
    ? input.description.trim()
    : (existing.description || '');
  const priority = input.priority === undefined ? (existing.priority || 'medium') : input.priority;
  const status = input.status === undefined ? (existing.status || 'pending') : input.status;
  const dueDate = input.dueDate === undefined ? (existing.dueDate || '') : input.dueDate;

  if (!title) throw new ValidationError('Task title is required.');
  if (title.length > 120) throw new ValidationError('Task title must be 120 characters or fewer.');
  if (description.length > 1000) throw new ValidationError('Description must be 1,000 characters or fewer.');
  if (!priorities.has(priority)) throw new ValidationError('Priority must be high, medium, or low.');
  if (!statuses.has(status)) throw new ValidationError('Status must be pending or completed.');
  if (typeof dueDate !== 'string') throw new ValidationError('Due date must be a date string.');
  if (dueDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
    const parsed = match && new Date(`${dueDate}T00:00:00.000Z`);
    if (!match || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) {
      throw new ValidationError('Due date must be a valid date in YYYY-MM-DD format.');
    }
  }

  return { title, description, dueDate, priority, status };
}

async function listTasks() {
  const tasks = await readTasks();
  return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getTask(id) {
  return (await readTasks()).find((task) => task.id === id) || null;
}

async function createTask(input) {
  const fields = normalizeTask(input);
  const now = new Date().toISOString();
  const task = { id: randomUUID(), ...fields, createdAt: now, updatedAt: now };
  const tasks = await readTasks();
  tasks.unshift(task);
  await writeTasks(tasks);
  return task;
}

async function updateTask(id, input) {
  const tasks = await readTasks();
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;
  const fields = normalizeTask(input, tasks[index]);
  const updated = { ...tasks[index], ...fields, updatedAt: new Date().toISOString() };
  tasks[index] = updated;
  await writeTasks(tasks);
  return updated;
}

async function setTaskCompletion(id, input) {
  if (!input || typeof input !== 'object' || typeof input.completed !== 'boolean') {
    throw new ValidationError('Provide completed as true or false.');
  }
  return updateTask(id, { status: input.completed ? 'completed' : 'pending' });
}

async function deleteTask(id) {
  const tasks = await readTasks();
  const remaining = tasks.filter((task) => task.id !== id);
  if (remaining.length === tasks.length) return false;
  await writeTasks(remaining);
  return true;
}

module.exports = { ensureDataFile, listTasks, getTask, createTask, updateTask, setTaskCompletion, deleteTask };
