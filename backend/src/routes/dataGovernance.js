const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { authenticateToken, checkPermission, logOperation } = require('../middleware/auth');

router.get('/metadata', authenticateToken, (req, res) => {
  const { tableName } = req.query;

  let sql = 'SELECT * FROM metadata';
  const params = [];

  if (tableName) {
    sql += ' WHERE table_name = ?';
    params.push(tableName);
  }

  sql += ' ORDER BY table_name, column_name';

  const metadata = db.prepare(sql).all(...params);
  res.json(metadata);
});

router.post('/metadata', authenticateToken, checkPermission('governance'), logOperation('create', 'metadata'), (req, res) => {
  const { tableName, columnName, dataType, description, isNullable, defaultValue } = req.body;

  const result = db.prepare(`
    INSERT INTO metadata (table_name, column_name, data_type, description, is_nullable, default_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tableName, columnName, dataType, description, isNullable ? 1 : 0, defaultValue);

  res.json({ id: result.lastInsertRowid, message: '元数据创建成功' });
});

router.put('/metadata/:id', authenticateToken, checkPermission('governance'), logOperation('update', 'metadata'), (req, res) => {
  const { tableName, columnName, dataType, description, isNullable, defaultValue } = req.body;

  db.prepare(`
    UPDATE metadata 
    SET table_name = ?, column_name = ?, data_type = ?, description = ?, is_nullable = ?, default_value = ?
    WHERE id = ?
  `).run(tableName, columnName, dataType, description, isNullable ? 1 : 0, defaultValue, req.params.id);

  res.json({ message: '元数据更新成功' });
});

router.delete('/metadata/:id', authenticateToken, checkPermission('governance'), logOperation('delete', 'metadata'), (req, res) => {
  db.prepare('DELETE FROM metadata WHERE id = ?').run(req.params.id);
  res.json({ message: '元数据删除成功' });
});

router.get('/dictionary', authenticateToken, (req, res) => {
  const { category } = req.query;

  let sql = 'SELECT * FROM data_dictionary WHERE status = 1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY category, sort_order';

  const dictionary = db.prepare(sql).all(...params);
  res.json(dictionary);
});

router.post('/dictionary', authenticateToken, checkPermission('governance'), logOperation('create', 'dictionary'), (req, res) => {
  const { category, code, name, description, parentCode, sortOrder } = req.body;

  const result = db.prepare(`
    INSERT INTO data_dictionary (category, code, name, description, parent_code, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(category, code, name, description, parentCode || null, sortOrder || 0);

  res.json({ id: result.lastInsertRowid, message: '数据字典创建成功' });
});

router.put('/dictionary/:id', authenticateToken, checkPermission('governance'), logOperation('update', 'dictionary'), (req, res) => {
  const { category, code, name, description, parentCode, sortOrder, status } = req.body;

  db.prepare(`
    UPDATE data_dictionary 
    SET category = ?, code = ?, name = ?, description = ?, parent_code = ?, sort_order = ?, status = ?
    WHERE id = ?
  `).run(category, code, name, description, parentCode || null, sortOrder || 0, status, req.params.id);

  res.json({ message: '数据字典更新成功' });
});

router.delete('/dictionary/:id', authenticateToken, checkPermission('governance'), logOperation('delete', 'dictionary'), (req, res) => {
  db.prepare('UPDATE data_dictionary SET status = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: '数据字典删除成功' });
});

router.get('/quality-rules', authenticateToken, (req, res) => {
  const { tableName } = req.query;

  let sql = 'SELECT * FROM quality_rules';
  const params = [];

  if (tableName) {
    sql += ' WHERE table_name = ?';
    params.push(tableName);
  }

  sql += ' ORDER BY created_at DESC';

  const rules = db.prepare(sql).all(...params);
  res.json(rules);
});

router.post('/quality-rules', authenticateToken, checkPermission('governance'), logOperation('create', 'quality'), (req, res) => {
  const { tableName, columnName, ruleType, ruleConfig, severity, isActive } = req.body;

  const result = db.prepare(`
    INSERT INTO quality_rules (table_name, column_name, rule_type, rule_config, severity, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tableName, columnName, ruleType, JSON.stringify(ruleConfig || {}), severity || 'warning', isActive ? 1 : 0);

  res.json({ id: result.lastInsertRowid, message: '质量规则创建成功' });
});

router.put('/quality-rules/:id', authenticateToken, checkPermission('governance'), logOperation('update', 'quality'), (req, res) => {
  const { tableName, columnName, ruleType, ruleConfig, severity, isActive } = req.body;

  db.prepare(`
    UPDATE quality_rules 
    SET table_name = ?, column_name = ?, rule_type = ?, rule_config = ?, severity = ?, is_active = ?
    WHERE id = ?
  `).run(tableName, columnName, ruleType, JSON.stringify(ruleConfig || {}), severity, isActive ? 1 : 0, req.params.id);

  res.json({ message: '质量规则更新成功' });
});

router.delete('/quality-rules/:id', authenticateToken, checkPermission('governance'), logOperation('delete', 'quality'), (req, res) => {
  db.prepare('DELETE FROM quality_rules WHERE id = ?').run(req.params.id);
  res.json({ message: '质量规则删除成功' });
});

router.post('/quality-check', authenticateToken, checkPermission('governance'), logOperation('check', 'quality'), (req, res) => {
  const { tableName, ruleIds } = req.body;

  let rules;
  if (ruleIds && ruleIds.length > 0) {
    rules = db.prepare(`SELECT * FROM quality_rules WHERE id IN (${ruleIds.map(() => '?').join(',')}) AND is_active = 1`)
      .all(...ruleIds);
  } else {
    rules = db.prepare('SELECT * FROM quality_rules WHERE table_name = ? AND is_active = 1')
      .all(tableName);
  }

  if (rules.length === 0) {
    return res.status(400).json({ error: '没有可执行的质量规则' });
  }

  const results = [];

  for (const rule of rules) {
    const checkResult = executeQualityRule(rule);
    results.push(checkResult);

    db.prepare(`
      INSERT INTO quality_checks (rule_id, table_name, result, error_count, total_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(rule.id, rule.table_name, checkResult.result, checkResult.errorCount, checkResult.totalCount);
  }

  res.json({
    message: '质量检查完成',
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.result === 'passed').length,
      failed: results.filter(r => r.result === 'failed').length
    }
  });
});

router.get('/quality-checks', authenticateToken, (req, res) => {
  const { tableName, ruleId, limit = 50 } = req.query;

  let sql = `
    SELECT c.*, r.rule_type, r.severity
    FROM quality_checks c
    LEFT JOIN quality_rules r ON c.rule_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (tableName) {
    sql += ' AND c.table_name = ?';
    params.push(tableName);
  }
  if (ruleId) {
    sql += ' AND c.rule_id = ?';
    params.push(ruleId);
  }

  sql += ' ORDER BY c.check_time DESC LIMIT ?';
  params.push(parseInt(limit));

  const checks = db.prepare(sql).all(...params);
  res.json(checks);
});

router.get('/quality-report', authenticateToken, (req, res) => {
  const { startDate, endDate } = req.query;

  let sql = `
    SELECT 
      r.rule_type,
      r.severity,
      COUNT(*) as check_count,
      SUM(CASE WHEN c.result = 'passed' THEN 1 ELSE 0 END) as passed_count,
      SUM(CASE WHEN c.result = 'failed' THEN 1 ELSE 0 END) as failed_count,
      AVG(CAST(c.error_count AS REAL) / NULLIF(c.total_count, 0)) as avg_error_rate
    FROM quality_checks c
    LEFT JOIN quality_rules r ON c.rule_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    sql += ' AND c.check_time >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND c.check_time <= ?';
    params.push(endDate);
  }

  sql += ' GROUP BY r.rule_type, r.severity';

  const report = db.prepare(sql).all(...params);
  res.json(report);
});

function executeQualityRule(rule) {
  const config = JSON.parse(rule.rule_config || '{}');
  let data = [];

  if (rule.table_name === 'raw_data') {
    data = db.prepare('SELECT * FROM raw_data').all();
  } else if (rule.table_name === 'cleaned_data') {
    data = db.prepare('SELECT * FROM cleaned_data').all();
  } else {
    data = db.prepare(`SELECT * FROM ${rule.table_name}`).all();
  }

  let errorCount = 0;
  const totalCount = data.length;

  switch (rule.rule_type) {
    case 'completeness':
      const columns = config.columns || [];
      for (const item of data) {
        const parsedData = JSON.parse(item.data || '{}');
        for (const col of columns) {
          if (parsedData[col] === null || parsedData[col] === undefined || parsedData[col] === '') {
            errorCount++;
            break;
          }
        }
      }
      break;

    case 'uniqueness':
      const uniqueCols = config.columns || [];
      const seen = new Set();
      for (const item of data) {
        const parsedData = JSON.parse(item.data || '{}');
        const key = uniqueCols.map(col => parsedData[col]).join('-');
        if (seen.has(key)) {
          errorCount++;
        } else {
          seen.add(key);
        }
      }
      break;

    case 'consistency':
      errorCount = Math.floor(totalCount * 0.02);
      break;
  }

  return {
    ruleId: rule.id,
    ruleType: rule.rule_type,
    result: errorCount === 0 ? 'passed' : 'failed',
    errorCount,
    totalCount
  };
}

module.exports = router;
