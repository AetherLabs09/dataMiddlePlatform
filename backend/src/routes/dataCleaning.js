const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../database/init');
const { authenticateToken, checkPermission, logOperation } = require('../middleware/auth');

router.get('/raw-data', authenticateToken, (req, res) => {
  const { sourceId, tableName, page = 1, pageSize = 20 } = req.query;
  const offset = (page - 1) * pageSize;

  let sql = 'SELECT * FROM raw_data WHERE status = 1';
  const params = [];

  if (sourceId) {
    sql += ' AND source_id = ?';
    params.push(sourceId);
  }
  if (tableName) {
    sql += ' AND table_name = ?';
    params.push(tableName);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = db.prepare(countSql).get(...params).total;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  const data = db.prepare(sql).all(...params).map(item => ({
    ...item,
    data: JSON.parse(item.data || '{}')
  }));

  res.json({ data, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.post('/clean', authenticateToken, checkPermission('cleaning'), logOperation('clean', 'cleaning'), (req, res) => {
  const { sourceId, tableName, rules } = req.body;
  const cleaningRules = rules || {
    removeDuplicates: true,
    fillMissing: true,
    removeInvalid: true
  };

  let sql = 'SELECT * FROM raw_data WHERE status = 1';
  const params = [];

  if (sourceId) {
    sql += ' AND source_id = ?';
    params.push(sourceId);
  }
  if (tableName) {
    sql += ' AND table_name = ?';
    params.push(tableName);
  }

  const rawData = db.prepare(sql).all(...params);

  if (rawData.length === 0) {
    return res.json({ message: '没有需要清洗的数据', cleaned: 0 });
  }

  const processedData = [];
  const seen = new Set();

  for (const item of rawData) {
    let data = JSON.parse(item.data || '{}');

    if (cleaningRules.removeDuplicates) {
      const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
      if (seen.has(hash)) continue;
      seen.add(hash);
    }

    if (cleaningRules.fillMissing) {
      for (const key in data) {
        if (data[key] === null || data[key] === undefined || data[key] === '') {
          data[key] = getDefaultValue(key, data);
        }
      }
    }

    if (cleaningRules.removeInvalid) {
      let isValid = true;
      for (const key in data) {
        if (!validateData(key, data[key])) {
          isValid = false;
          break;
        }
      }
      if (!isValid) continue;
    }

    const qualityScore = calculateQualityScore(data);

    processedData.push({
      rawDataId: item.id,
      tableName: item.table_name,
      data: JSON.stringify(data),
      qualityScore
    });
  }

  const insertStmt = db.prepare(`
    INSERT INTO cleaned_data (raw_data_id, table_name, data, layer, quality_score)
    VALUES (?, ?, ?, 'detail', ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertStmt.run(item.rawDataId, item.tableName, item.data, item.qualityScore);
    }
  });

  insertMany(processedData);

  res.json({
    message: '数据清洗完成',
    cleaned: processedData.length,
    original: rawData.length,
    removed: rawData.length - processedData.length
  });
});

router.get('/cleaned-data', authenticateToken, (req, res) => {
  const { tableName, layer, page = 1, pageSize = 20 } = req.query;
  const offset = (page - 1) * pageSize;

  let sql = 'SELECT * FROM cleaned_data WHERE 1=1';
  const params = [];

  if (tableName) {
    sql += ' AND table_name = ?';
    params.push(tableName);
  }
  if (layer) {
    sql += ' AND layer = ?';
    params.push(layer);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = db.prepare(countSql).get(...params).total;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  const data = db.prepare(sql).all(...params).map(item => ({
    ...item,
    data: JSON.parse(item.data || '{}')
  }));

  res.json({ data, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.post('/aggregate', authenticateToken, checkPermission('cleaning'), logOperation('aggregate', 'cleaning'), (req, res) => {
  const { tableName, groupBy, aggregations } = req.body;

  const detailData = db.prepare('SELECT * FROM cleaned_data WHERE table_name = ? AND layer = ?')
    .all(tableName, 'detail');

  if (detailData.length === 0) {
    return res.status(400).json({ error: '没有明细层数据' });
  }

  const groups = {};

  for (const item of detailData) {
    const data = JSON.parse(item.data || '{}');
    const groupKey = groupBy.map(field => data[field]).join('-');

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(data);
  }

  const aggregatedData = [];

  for (const groupKey in groups) {
    const items = groups[groupKey];
    const result = {};

    for (const field of groupBy) {
      result[field] = items[0][field];
    }

    for (const agg of aggregations) {
      const { field, type, alias } = agg;
      const values = items.map(item => item[field]).filter(v => v !== null && v !== undefined);

      switch (type) {
        case 'sum':
          result[alias || `${field}_sum`] = values.reduce((a, b) => a + Number(b), 0);
          break;
        case 'avg':
          result[alias || `${field}_avg`] = values.length > 0 ? values.reduce((a, b) => a + Number(b), 0) / values.length : 0;
          break;
        case 'count':
          result[alias || `${field}_count`] = values.length;
          break;
        case 'max':
          result[alias || `${field}_max`] = Math.max(...values.map(Number));
          break;
        case 'min':
          result[alias || `${field}_min`] = Math.min(...values.map(Number));
          break;
      }
    }

    aggregatedData.push(result);
  }

  const insertStmt = db.prepare(`
    INSERT INTO cleaned_data (table_name, data, layer, quality_score)
    VALUES (?, ?, 'summary', 1.0)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertStmt.run(`${tableName}_summary`, JSON.stringify(item));
    }
  });

  insertMany(aggregatedData);

  res.json({
    message: '数据汇总完成',
    aggregated: aggregatedData.length
  });
});

router.get('/lineage', authenticateToken, (req, res) => {
  const { tableName } = req.query;

  let sql = 'SELECT * FROM data_lineage';
  const params = [];

  if (tableName) {
    sql += ' WHERE source_table = ? OR target_table = ?';
    params.push(tableName, tableName);
  }

  const lineage = db.prepare(sql).all(...params);
  res.json(lineage);
});

router.post('/lineage', authenticateToken, checkPermission('cleaning'), (req, res) => {
  const { sourceTable, sourceColumn, targetTable, targetColumn, transformation } = req.body;

  const result = db.prepare(`
    INSERT INTO data_lineage (source_table, source_column, target_table, target_column, transformation)
    VALUES (?, ?, ?, ?, ?)
  `).run(sourceTable, sourceColumn, targetTable, targetColumn, transformation || null);

  res.json({ id: result.lastInsertRowid, message: '数据血缘关系创建成功' });
});

function getDefaultValue(key, data) {
  if (key.includes('time') || key.includes('date')) {
    return new Date().toISOString();
  }
  if (key.includes('count') || key.includes('amount') || key.includes('num')) {
    return 0;
  }
  return '';
}

function validateData(key, value) {
  if (key.includes('email') && value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  if (key.includes('phone') && value) {
    return /^1[3-9]\d{9}$/.test(value);
  }
  return true;
}

function calculateQualityScore(data) {
  const keys = Object.keys(data);
  if (keys.length === 0) return 0;

  let score = 0;
  for (const key of keys) {
    const value = data[key];
    if (value !== null && value !== undefined && value !== '') {
      score += 1;
    }
  }

  return score / keys.length;
}

module.exports = router;
