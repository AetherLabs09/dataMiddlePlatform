const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../database/init');
const { authenticateToken, checkPermission, logOperation } = require('../middleware/auth');

router.get('/list', authenticateToken, checkPermission('all'), (req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, real_name, email, phone, department, status, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();
  res.json(users);
});

router.post('/create', authenticateToken, checkPermission('all'), logOperation('create', 'user'), (req, res) => {
  const { username, password, role, realName, email, phone, department } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const result = db.prepare(`
    INSERT INTO users (username, password, role, real_name, email, phone, department)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(username, hashedPassword, role || 'user', realName, email, phone, department);

  res.json({ id: result.lastInsertRowid, message: '用户创建成功' });
});

router.put('/:id', authenticateToken, checkPermission('all'), logOperation('update', 'user'), (req, res) => {
  const { role, realName, email, phone, department, status } = req.body;

  db.prepare(`
    UPDATE users 
    SET role = ?, real_name = ?, email = ?, phone = ?, department = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(role, realName, email, phone, department, status, req.params.id);

  res.json({ message: '用户更新成功' });
});

router.delete('/:id', authenticateToken, checkPermission('all'), logOperation('delete', 'user'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '不能删除自己' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: '用户删除成功' });
});

router.post('/:id/reset-password', authenticateToken, checkPermission('all'), logOperation('reset_password', 'user'), (req, res) => {
  const { newPassword } = req.body;
  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hashedPassword, req.params.id);

  res.json({ message: '密码重置成功' });
});

router.get('/roles', authenticateToken, (req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY created_at').all();
  res.json(roles);
});

router.post('/roles', authenticateToken, checkPermission('all'), logOperation('create', 'role'), (req, res) => {
  const { name, description, permissions } = req.body;

  const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(name);
  if (existing) {
    return res.status(400).json({ error: '角色名已存在' });
  }

  const result = db.prepare(`
    INSERT INTO roles (name, description, permissions)
    VALUES (?, ?, ?)
  `).run(name, description, JSON.stringify(permissions || {}));

  res.json({ id: result.lastInsertRowid, message: '角色创建成功' });
});

router.put('/roles/:id', authenticateToken, checkPermission('all'), logOperation('update', 'role'), (req, res) => {
  const { name, description, permissions } = req.body;

  db.prepare(`
    UPDATE roles SET name = ?, description = ?, permissions = ?
    WHERE id = ?
  `).run(name, description, JSON.stringify(permissions || {}), req.params.id);

  res.json({ message: '角色更新成功' });
});

router.delete('/roles/:id', authenticateToken, checkPermission('all'), logOperation('delete', 'role'), (req, res) => {
  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(req.params.id);
  if (!role) {
    return res.status(404).json({ error: '角色不存在' });
  }

  if (['admin', 'user'].includes(role.name)) {
    return res.status(400).json({ error: '系统内置角色不能删除' });
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(role.name);
  if (userCount.count > 0) {
    return res.status(400).json({ error: '角色下还有用户，不能删除' });
  }

  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  res.json({ message: '角色删除成功' });
});

router.get('/permissions', authenticateToken, (req, res) => {
  const permissions = [
    { code: 'all', name: '全部权限', description: '拥有所有权限' },
    { code: 'view', name: '查看', description: '查看数据权限' },
    { code: 'collection', name: '数据采集', description: '数据采集操作权限' },
    { code: 'cleaning', name: '数据清洗', description: '数据清洗操作权限' },
    { code: 'governance', name: '数据治理', description: '数据治理操作权限' },
    { code: 'statistics', name: '统计分析', description: '统计分析操作权限' },
    { code: 'service', name: 'API服务', description: 'API服务管理权限' },
    { code: 'export', name: '数据导出', description: '数据导出权限' }
  ];

  res.json(permissions);
});

module.exports = router;
