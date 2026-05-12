const jwt = require('jsonwebtoken');
const { db } = require('../database/init');

const JWT_SECRET = process.env.JWT_SECRET || 'data-platform-secret-key-2024';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }

    const userRecord = db.prepare('SELECT * FROM users WHERE id = ? AND status = 1').get(user.id);
    if (!userRecord) {
      return res.status(403).json({ error: '用户不存在或已禁用' });
    }

    req.user = {
      id: userRecord.id,
      username: userRecord.username,
      role: userRecord.role,
      realName: userRecord.real_name
    };
    next();
  });
}

function checkPermission(permission) {
  return (req, res, next) => {
    if (req.user.role === 'admin') {
      return next();
    }

    const role = db.prepare('SELECT permissions FROM roles WHERE name = ?').get(req.user.role);
    if (!role) {
      return res.status(403).json({ error: '角色不存在' });
    }

    try {
      const permissions = JSON.parse(role.permissions);
      if (permissions.permissions && permissions.permissions.includes('all')) {
        return next();
      }
      if (permissions.permissions && permissions.permissions.includes(permission)) {
        return next();
      }
      return res.status(403).json({ error: '权限不足' });
    } catch (e) {
      return res.status(403).json({ error: '权限配置错误' });
    }
  };
}

function logOperation(action, module) {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
      if (req.user) {
        try {
          db.prepare(`
            INSERT INTO operation_logs (user_id, action, module, detail, ip)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            req.user.id,
            action,
            module,
            JSON.stringify({ params: req.params, body: req.body, query: req.query }),
            req.ip
          );
        } catch (e) {
          console.error('记录操作日志失败:', e);
        }
      }
      originalSend.call(this, data);
    };
    next();
  };
}

module.exports = { authenticateToken, checkPermission, logOperation, JWT_SECRET };
