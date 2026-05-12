const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/init');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = 1').get(username);

  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  db.prepare(`
    INSERT INTO operation_logs (user_id, action, module, detail, ip)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, 'login', 'auth', JSON.stringify({ username }), req.ip);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      realName: user.real_name,
      email: user.email
    }
  });
});

router.post('/logout', authenticateToken, (req, res) => {
  db.prepare(`
    INSERT INTO operation_logs (user_id, action, module, detail, ip)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, 'logout', 'auth', '{}', req.ip);

  res.json({ message: '登出成功' });
});

router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare(`
    SELECT id, username, role, real_name, email, phone, department, created_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  res.json(user);
});

router.post('/change-password', authenticateToken, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
  const validPassword = bcrypt.compareSync(oldPassword, user.password);

  if (!validPassword) {
    return res.status(400).json({ error: '原密码错误' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hashedPassword, req.user.id);

  res.json({ message: '密码修改成功' });
});

module.exports = router;
