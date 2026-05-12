const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { authenticateToken, checkPermission, logOperation } = require('../middleware/auth');

router.get('/indicators', authenticateToken, (req, res) => {
  const indicators = db.prepare('SELECT * FROM indicators ORDER BY created_at DESC').all();
  res.json(indicators);
});

router.post('/indicators', authenticateToken, checkPermission('statistics'), logOperation('create', 'indicators'), (req, res) => {
  const { name, code, category, formula, unit, description, dataSource } = req.body;

  const result = db.prepare(`
    INSERT INTO indicators (name, code, category, formula, unit, description, data_source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, code, category, formula || null, unit, description, dataSource || null);

  res.json({ id: result.lastInsertRowid, message: '指标创建成功' });
});

router.put('/indicators/:id', authenticateToken, checkPermission('statistics'), logOperation('update', 'indicators'), (req, res) => {
  const { name, code, category, formula, unit, description, dataSource } = req.body;

  db.prepare(`
    UPDATE indicators 
    SET name = ?, code = ?, category = ?, formula = ?, unit = ?, description = ?, data_source = ?
    WHERE id = ?
  `).run(name, code, category, formula || null, unit, description, dataSource, req.params.id);

  res.json({ message: '指标更新成功' });
});

router.delete('/indicators/:id', authenticateToken, checkPermission('statistics'), logOperation('delete', 'indicators'), (req, res) => {
  db.prepare('DELETE FROM indicators WHERE id = ?').run(req.params.id);
  res.json({ message: '指标删除成功' });
});

router.get('/indicator-values', authenticateToken, (req, res) => {
  const { indicatorId, dimension, timePeriod, startDate, endDate } = req.query;

  let sql = `
    SELECT v.*, i.name as indicator_name, i.code as indicator_code, i.unit
    FROM indicator_values v
    LEFT JOIN indicators i ON v.indicator_id = i.id
    WHERE 1=1
  `;
  const params = [];

  if (indicatorId) {
    sql += ' AND v.indicator_id = ?';
    params.push(indicatorId);
  }
  if (dimension) {
    sql += ' AND v.dimension = ?';
    params.push(dimension);
  }
  if (timePeriod) {
    sql += ' AND v.time_period = ?';
    params.push(timePeriod);
  }
  if (startDate) {
    sql += ' AND v.created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND v.created_at <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY v.created_at DESC';

  const values = db.prepare(sql).all(...params);
  res.json(values);
});

router.post('/indicator-values', authenticateToken, checkPermission('statistics'), logOperation('create', 'indicator_values'), (req, res) => {
  const { indicatorId, value, dimension, timePeriod } = req.body;

  const result = db.prepare(`
    INSERT INTO indicator_values (indicator_id, value, dimension, time_period)
    VALUES (?, ?, ?, ?)
  `).run(indicatorId, value, dimension || null, timePeriod || null);

  res.json({ id: result.lastInsertRowid, message: '指标值创建成功' });
});

router.post('/calculate', authenticateToken, checkPermission('statistics'), logOperation('calculate', 'statistics'), (req, res) => {
  const { indicatorId, dimension, timePeriod } = req.body;

  const indicator = db.prepare('SELECT * FROM indicators WHERE id = ?').get(indicatorId);
  if (!indicator) {
    return res.status(404).json({ error: '指标不存在' });
  }

  let value = 0;

  if (indicator.code === 'daily_visits') {
    const result = db.prepare('SELECT COUNT(*) as count FROM raw_data WHERE date(created_at) = date(?)').get(timePeriod);
    value = result ? result.count : 0;
  } else if (indicator.code === 'active_users') {
    const result = db.prepare(`
      SELECT COUNT(DISTINCT json_extract(data, '$.user_id')) as count 
      FROM raw_data 
      WHERE date(created_at) = date(?)
    `).get(timePeriod);
    value = result ? result.count : 0;
  } else if (indicator.code === 'monthly_revenue') {
    const result = db.prepare(`
      SELECT SUM(json_extract(data, '$.amount')) as total 
      FROM raw_data 
      WHERE strftime('%Y-%m', created_at) = ?
    `).get(timePeriod);
    value = result && result.total ? result.total : 0;
  } else if (indicator.code === 'avg_visit_freq') {
    const result = db.prepare(`
      SELECT AVG(cnt) as avg_freq FROM (
        SELECT COUNT(*) as cnt 
        FROM raw_data 
        WHERE date(created_at) = date(?)
        GROUP BY json_extract(data, '$.user_id')
      )
    `).get(timePeriod);
    value = result && result.avg_freq ? result.avg_freq : 0;
  }

  const insertResult = db.prepare(`
    INSERT INTO indicator_values (indicator_id, value, dimension, time_period)
    VALUES (?, ?, ?, ?)
  `).run(indicatorId, value, dimension || null, timePeriod);

  res.json({
    message: '指标计算完成',
    indicator: indicator.name,
    value,
    timePeriod,
    id: insertResult.lastInsertRowid
  });
});

router.get('/chart-data', authenticateToken, (req, res) => {
  const { indicatorIds, dimension, startDate, endDate, chartType } = req.query;

  const indicatorIdList = indicatorIds ? indicatorIds.split(',').map(Number) : [];
  if (indicatorIdList.length === 0) {
    return res.status(400).json({ error: '请选择至少一个指标' });
  }

  const indicators = db.prepare(`
    SELECT * FROM indicators WHERE id IN (${indicatorIdList.map(() => '?').join(',')})
  `).all(...indicatorIdList);

  const chartData = {
    indicators: indicators.map(i => ({ id: i.id, name: i.name, unit: i.unit })),
    data: []
  };

  for (const indicator of indicators) {
    let sql = `
      SELECT value, dimension, time_period, created_at
      FROM indicator_values
      WHERE indicator_id = ?
    `;
    const params = [indicator.id];

    if (dimension) {
      sql += ' AND dimension = ?';
      params.push(dimension);
    }
    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY created_at';

    const values = db.prepare(sql).all(...params);
    chartData.data.push({
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      values: values.map(v => ({
        value: v.value,
        dimension: v.dimension,
        timePeriod: v.time_period,
        time: v.created_at
      }))
    });
  }

  res.json(chartData);
});

router.get('/comparison', authenticateToken, (req, res) => {
  const { indicatorId, timePeriod, comparisonType } = req.query;

  const currentValue = db.prepare(`
    SELECT value, time_period 
    FROM indicator_values 
    WHERE indicator_id = ? AND time_period = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(indicatorId, timePeriod);

  if (!currentValue) {
    return res.status(404).json({ error: '未找到当前指标值' });
  }

  let comparisonPeriod;
  let comparisonValue = null;

  if (comparisonType === 'yoy') {
    comparisonPeriod = getYearAgoPeriod(timePeriod);
    comparisonValue = db.prepare(`
      SELECT value FROM indicator_values 
      WHERE indicator_id = ? AND time_period = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(indicatorId, comparisonPeriod);
  } else if (comparisonType === 'mom') {
    comparisonPeriod = getMonthAgoPeriod(timePeriod);
    comparisonValue = db.prepare(`
      SELECT value FROM indicator_values 
      WHERE indicator_id = ? AND time_period = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(indicatorId, comparisonPeriod);
  }

  const current = currentValue.value;
  const previous = comparisonValue ? comparisonValue.value : 0;
  const change = current - previous;
  const changeRate = previous !== 0 ? ((current - previous) / previous * 100) : 0;

  res.json({
    current,
    previous,
    change,
    changeRate: changeRate.toFixed(2),
    comparisonType,
    comparisonPeriod
  });
});

router.get('/export', authenticateToken, checkPermission('export'), logOperation('export', 'statistics'), (req, res) => {
  const { indicatorIds, startDate, endDate, format = 'json' } = req.query;

  const indicatorIdList = indicatorIds ? indicatorIds.split(',').map(Number) : [];

  let sql = `
    SELECT v.*, i.name as indicator_name, i.code as indicator_code, i.unit, i.category
    FROM indicator_values v
    LEFT JOIN indicators i ON v.indicator_id = i.id
    WHERE 1=1
  `;
  const params = [];

  if (indicatorIdList.length > 0) {
    sql += ` AND v.indicator_id IN (${indicatorIdList.map(() => '?').join(',')})`;
    params.push(...indicatorIdList);
  }
  if (startDate) {
    sql += ' AND v.created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND v.created_at <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY v.indicator_id, v.created_at';

  const data = db.prepare(sql).all(...params);

  if (format === 'json') {
    res.json(data);
  } else if (format === 'csv') {
    const csv = convertToCSV(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=statistics_export.csv');
    res.send(csv);
  }
});

function getYearAgoPeriod(period) {
  if (period.includes('-')) {
    const parts = period.split('-');
    if (parts.length === 2) {
      return `${parseInt(parts[0]) - 1}-${parts[1]}`;
    } else if (parts.length === 3) {
      return `${parseInt(parts[0]) - 1}-${parts[1]}-${parts[2]}`;
    }
  }
  return period;
}

function getMonthAgoPeriod(period) {
  if (period.includes('-')) {
    const parts = period.split('-');
    if (parts.length === 2) {
      let year = parseInt(parts[0]);
      let month = parseInt(parts[1]) - 1;
      if (month === 0) {
        year--;
        month = 12;
      }
      return `${year}-${month.toString().padStart(2, '0')}`;
    }
  }
  return period;
}

function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = ['指标名称', '指标编码', '分类', '值', '维度', '时间周期', '单位', '创建时间'];
  const rows = data.map(item => [
    item.indicator_name,
    item.indicator_code,
    item.category,
    item.value,
    item.dimension || '',
    item.time_period || '',
    item.unit,
    item.created_at
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

module.exports = router;
