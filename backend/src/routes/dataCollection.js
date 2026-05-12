const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const cron = require('node-cron');
const { db } = require('../database/init');
const { authenticateToken, checkPermission, logOperation } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const scheduledTasks = new Map();

router.get('/sources', authenticateToken, (req, res) => {
  const sources = db.prepare('SELECT * FROM data_sources ORDER BY created_at DESC').all();
  res.json(sources);
});

router.post('/sources', authenticateToken, checkPermission('collection'), logOperation('create', 'collection'), (req, res) => {
  const { name, type, config, syncMode, syncInterval } = req.body;

  const result = db.prepare(`
    INSERT INTO data_sources (name, type, config, sync_mode, sync_interval)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, type, JSON.stringify(config || {}), syncMode || 'manual', syncInterval || 3600);

  res.json({ id: result.lastInsertRowid, message: '数据源创建成功' });
});

router.put('/sources/:id', authenticateToken, checkPermission('collection'), logOperation('update', 'collection'), (req, res) => {
  const { name, type, config, syncMode, syncInterval, status } = req.body;

  db.prepare(`
    UPDATE data_sources 
    SET name = ?, type = ?, config = ?, sync_mode = ?, sync_interval = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, type, JSON.stringify(config || {}), syncMode, syncInterval, status, req.params.id);

  res.json({ message: '数据源更新成功' });
});

router.delete('/sources/:id', authenticateToken, checkPermission('collection'), logOperation('delete', 'collection'), (req, res) => {
  db.prepare('DELETE FROM data_sources WHERE id = ?').run(req.params.id);
  res.json({ message: '数据源删除成功' });
});

router.get('/tasks', authenticateToken, (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, s.name as source_name, s.type as source_type
    FROM collection_tasks t
    LEFT JOIN data_sources s ON t.source_id = s.id
    ORDER BY t.created_at DESC
  `).all();
  res.json(tasks);
});

router.post('/tasks', authenticateToken, checkPermission('collection'), logOperation('create', 'collection'), (req, res) => {
  const { sourceId, name, type, config, schedule } = req.body;

  const result = db.prepare(`
    INSERT INTO collection_tasks (source_id, name, type, config, schedule, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(sourceId, name, type, JSON.stringify(config || {}), schedule || null);

  res.json({ id: result.lastInsertRowid, message: '采集任务创建成功' });
});

router.post('/tasks/:id/start', authenticateToken, checkPermission('collection'), async (req, res) => {
  const task = db.prepare(`
    SELECT t.*, s.type as source_type, s.config as source_config
    FROM collection_tasks t
    LEFT JOIN data_sources s ON t.source_id = s.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  db.prepare('UPDATE collection_tasks SET status = ? WHERE id = ?').run('running', req.params.id);

  const syncRecord = db.prepare(`
    INSERT INTO sync_records (task_id, source_id, status, start_time)
    VALUES (?, ?, 'running', CURRENT_TIMESTAMP)
  `).run(task.id, task.source_id);

  try {
    let recordsCount = 0;

    if (task.source_type === 'file') {
      const taskConfig = JSON.parse(task.config || '{}');
      if (taskConfig.filePath) {
        recordsCount = await processFile(taskConfig.filePath, task.source_id, task.table_name || 'imported_data');
      }
    } else if (task.source_type === 'database') {
      recordsCount = await syncDatabase(JSON.parse(task.source_config || '{}'), task.source_id);
    }

    db.prepare(`
      UPDATE sync_records SET status = ?, records_count = ?, end_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('success', recordsCount, syncRecord.lastInsertRowid);

    db.prepare(`
      UPDATE collection_tasks SET status = ?, last_run_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('completed', req.params.id);

    db.prepare(`
      UPDATE data_sources SET last_sync_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(task.source_id);

    res.json({ message: '任务执行成功', recordsCount });
  } catch (error) {
    db.prepare(`
      UPDATE sync_records SET status = ?, error_message = ?, end_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('failed', error.message, syncRecord.lastInsertRowid);

    db.prepare('UPDATE collection_tasks SET status = ? WHERE id = ?').run('failed', req.params.id);

    res.status(500).json({ error: '任务执行失败', message: error.message });
  }
});

router.post('/tasks/:id/stop', authenticateToken, checkPermission('collection'), (req, res) => {
  db.prepare('UPDATE collection_tasks SET status = ? WHERE id = ?').run('stopped', req.params.id);

  if (scheduledTasks.has(parseInt(req.params.id))) {
    scheduledTasks.get(parseInt(req.params.id)).stop();
    scheduledTasks.delete(parseInt(req.params.id));
  }

  res.json({ message: '任务已停止' });
});

router.post('/upload', authenticateToken, checkPermission('collection'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  res.json({
    message: '文件上传成功',
    filePath: req.file.path,
    fileName: req.file.originalname,
    size: req.file.size
  });
});

async function processFile(filePath, sourceId, tableName) {
  const ext = path.extname(filePath).toLowerCase();
  let records = [];

  if (ext === '.csv') {
    records = await new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  } else if (ext === '.json') {
    const content = fs.readFileSync(filePath, 'utf8');
    records = JSON.parse(content);
  }

  const insertStmt = db.prepare(`
    INSERT INTO raw_data (source_id, table_name, data, hash)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      const hash = require('crypto').createHash('md5').update(JSON.stringify(item)).digest('hex');
      insertStmt.run(sourceId, tableName, JSON.stringify(item), hash);
    }
  });

  insertMany(records);
  return records.length;
}

async function syncDatabase(config, sourceId) {
  return 0;
}

router.get('/sync-records', authenticateToken, (req, res) => {
  const { taskId, sourceId, limit = 50 } = req.query;

  let sql = `
    SELECT r.*, t.name as task_name, s.name as source_name
    FROM sync_records r
    LEFT JOIN collection_tasks t ON r.task_id = t.id
    LEFT JOIN data_sources s ON r.source_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (taskId) {
    sql += ' AND r.task_id = ?';
    params.push(taskId);
  }
  if (sourceId) {
    sql += ' AND r.source_id = ?';
    params.push(sourceId);
  }

  sql += ' ORDER BY r.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const records = db.prepare(sql).all(...params);
  res.json(records);
});

module.exports = router;
