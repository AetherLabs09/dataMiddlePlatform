const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { authenticateToken, checkPermission, logOperation } = require('../middleware/auth');

router.get('/services', authenticateToken, (req, res) => {
  const services = db.prepare('SELECT * FROM api_services ORDER BY created_at DESC').all();
  res.json(services);
});

router.post('/services', authenticateToken, checkPermission('service'), logOperation('create', 'api_service'), (req, res) => {
  const { name, path, method, sqlQuery, params, rateLimit, isActive } = req.body;

  const existing = db.prepare('SELECT id FROM api_services WHERE path = ?').get(path);
  if (existing) {
    return res.status(400).json({ error: 'API路径已存在' });
  }

  const result = db.prepare(`
    INSERT INTO api_services (name, path, method, sql_query, params, rate_limit, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, path, method || 'GET', sqlQuery, JSON.stringify(params || {}), rateLimit || 100, isActive ? 1 : 0);

  res.json({ id: result.lastInsertRowid, message: 'API服务创建成功' });
});

router.put('/services/:id', authenticateToken, checkPermission('service'), logOperation('update', 'api_service'), (req, res) => {
  const { name, path, method, sqlQuery, params, rateLimit, isActive } = req.body;

  db.prepare(`
    UPDATE api_services 
    SET name = ?, path = ?, method = ?, sql_query = ?, params = ?, rate_limit = ?, is_active = ?
    WHERE id = ?
  `).run(name, path, method || 'GET', sqlQuery, JSON.stringify(params || {}), rateLimit || 100, isActive ? 1 : 0, req.params.id);

  res.json({ message: 'API服务更新成功' });
});

router.delete('/services/:id', authenticateToken, checkPermission('service'), logOperation('delete', 'api_service'), (req, res) => {
  db.prepare('DELETE FROM api_services WHERE id = ?').run(req.params.id);
  res.json({ message: 'API服务删除成功' });
});

router.get('/call/:path(*)', authenticateToken, async (req, res) => {
  const apiPath = '/' + req.params.path;

  const service = db.prepare('SELECT * FROM api_services WHERE path = ? AND is_active = 1').get(apiPath);
  if (!service) {
    return res.status(404).json({ error: 'API服务不存在或未启用' });
  }

  if (service.method !== 'GET') {
    return res.status(405).json({ error: '请求方法不允许' });
  }

  try {
    const result = executeApiQuery(service, req.query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'API执行失败', message: error.message });
  }
});

router.post('/call/:path(*)', authenticateToken, async (req, res) => {
  const apiPath = '/' + req.params.path;

  const service = db.prepare('SELECT * FROM api_services WHERE path = ? AND is_active = 1').get(apiPath);
  if (!service) {
    return res.status(404).json({ error: 'API服务不存在或未启用' });
  }

  if (service.method !== 'POST') {
    return res.status(405).json({ error: '请求方法不允许' });
  }

  try {
    const result = executeApiQuery(service, { ...req.query, ...req.body });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'API执行失败', message: error.message });
  }
});

router.get('/logs', authenticateToken, (req, res) => {
  const { userId, module, action, startDate, endDate, limit = 100 } = req.query;

  let sql = `
    SELECT l.*, u.username, u.real_name
    FROM operation_logs l
    LEFT JOIN users u ON l.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (userId) {
    sql += ' AND l.user_id = ?';
    params.push(userId);
  }
  if (module) {
    sql += ' AND l.module = ?';
    params.push(module);
  }
  if (action) {
    sql += ' AND l.action = ?';
    params.push(action);
  }
  if (startDate) {
    sql += ' AND l.created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND l.created_at <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY l.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

router.get('/logs/statistics', authenticateToken, (req, res) => {
  const { startDate, endDate } = req.query;

  let sql = `
    SELECT 
      module,
      action,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as user_count
    FROM operation_logs
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    sql += ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND created_at <= ?';
    params.push(endDate);
  }

  sql += ' GROUP BY module, action ORDER BY count DESC';

  const statistics = db.prepare(sql).all(...params);
  res.json(statistics);
});

function executeApiQuery(service, params) {
  let sql = service.sql_query;

  const serviceParams = JSON.parse(service.params || '{}');
  const finalParams = {};

  for (const [key, config] of Object.entries(serviceParams)) {
    if (params[key] !== undefined) {
      finalParams[key] = params[key];
    } else if (config.default !== undefined) {
      finalParams[key] = config.default;
    } else if (config.required) {
      throw new Error(`缺少必需参数: ${key}`);
    }
  }

  for (const [key, value] of Object.entries(finalParams)) {
    sql = sql.replace(new RegExp(`:${key}`, 'g'), value);
  }

  if (sql.toLowerCase().includes('select')) {
    return db.prepare(sql).all();
  } else {
    const result = db.prepare(sql).run();
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }
}

module.exports = router;
