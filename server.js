const express = require('express');
const path = require('path');
const store = require('./src/task-store');

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// REST API: task records are stored in data/tasks.json, not in process memory.
app.get('/api/tasks', async (req, res, next) => {
  try {
    res.json({ tasks: await store.listTasks() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await store.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', async (req, res, next) => {
  try {
    const task = await store.createTask(req.body);
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

app.put('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await store.updateTask(req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tasks/:id/complete', async (req, res, next) => {
  try {
    const task = await store.setTaskCompletion(req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const deleted = await store.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Task not found.' });
    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use(express.static(publicDir, { etag: true, maxAge: '1h' }));
app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }
  console.error('Request failed:', error.message);
  res.status(500).json({ error: 'Something went wrong while processing the request.' });
});

async function start() {
  await store.ensureDataFile();
  app.listen(port, '0.0.0.0', () => {
    console.log(`TaskFlow is running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Could not start TaskFlow:', error);
  process.exit(1);
});
