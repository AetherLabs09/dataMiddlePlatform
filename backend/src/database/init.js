const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../db/platform.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDatabase() {
  return new Promise((resolve, reject) => {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          real_name TEXT,
          email TEXT,
          phone TEXT,
          department TEXT,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          permissions TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS data_sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT,
          status INTEGER DEFAULT 1,
          sync_mode TEXT DEFAULT 'manual',
          sync_interval INTEGER DEFAULT 3600,
          last_sync_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS collection_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id INTEGER,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          config TEXT,
          status TEXT DEFAULT 'pending',
          schedule TEXT,
          last_run_time DATETIME,
          next_run_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS raw_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id INTEGER,
          table_name TEXT,
          data TEXT,
          hash TEXT,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cleaned_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          raw_data_id INTEGER,
          table_name TEXT,
          data TEXT,
          layer TEXT DEFAULT 'detail',
          quality_score REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          column_name TEXT NOT NULL,
          data_type TEXT,
          description TEXT,
          is_nullable INTEGER DEFAULT 1,
          default_value TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS data_dictionary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          parent_code TEXT,
          sort_order INTEGER DEFAULT 0,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS quality_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          column_name TEXT,
          rule_type TEXT NOT NULL,
          rule_config TEXT,
          severity TEXT DEFAULT 'warning',
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS quality_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_id INTEGER,
          table_name TEXT,
          result TEXT,
          error_count INTEGER DEFAULT 0,
          total_count INTEGER DEFAULT 0,
          check_time DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS indicators (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          category TEXT,
          formula TEXT,
          unit TEXT,
          description TEXT,
          data_source TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS indicator_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          indicator_id INTEGER,
          value REAL,
          dimension TEXT,
          time_period TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS api_services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          path TEXT UNIQUE NOT NULL,
          method TEXT DEFAULT 'GET',
          sql_query TEXT,
          params TEXT,
          rate_limit INTEGER DEFAULT 100,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS operation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          module TEXT,
          detail TEXT,
          ip TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS data_lineage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_table TEXT NOT NULL,
          source_column TEXT,
          target_table TEXT NOT NULL,
          target_column TEXT,
          transformation TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sync_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER,
          source_id INTEGER,
          records_count INTEGER DEFAULT 0,
          status TEXT,
          error_message TEXT,
          start_time DATETIME,
          end_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
      if (userCount.count === 0) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        
        db.prepare(`
          INSERT INTO users (username, password, role, real_name, email, department)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('admin', hashedPassword, 'admin', '系统管理员', 'admin@example.com', '技术部');

        db.prepare(`
          INSERT INTO roles (name, description, permissions) VALUES 
          ('admin', '系统管理员', '{"permissions":["all"]}'),
          ('analyst', '数据分析师', '{"permissions":["view","export","statistics"]}'),
          ('operator', '数据运维', '{"permissions":["view","collection","cleaning"]}'),
          ('user', '普通用户', '{"permissions":["view"]}')
        `).run();

        db.prepare(`
          INSERT INTO data_dictionary (category, code, name, description, sort_order) VALUES 
          ('数据源类型', 'database', '数据库', '关系型数据库', 1),
          ('数据源类型', 'api', 'API接口', '第三方API接口', 2),
          ('数据源类型', 'file', '文件', '本地文件', 3),
          ('数据源类型', 'log', '日志', '系统日志', 4),
          ('数据状态', 'active', '有效', '数据有效', 1),
          ('数据状态', 'inactive', '无效', '数据无效', 2),
          ('同步模式', 'manual', '手动', '手动同步', 1),
          ('同步模式', 'schedule', '定时', '定时同步', 2),
          ('同步模式', 'realtime', '实时', '实时同步', 3)
        `).run();

        db.prepare(`
          INSERT INTO indicators (name, code, category, unit, description) VALUES 
          ('日访问量', 'daily_visits', '流量指标', '次', '每日网站访问次数'),
          ('月营收', 'monthly_revenue', '营收指标', '元', '每月总营收金额'),
          ('活跃用户数', 'active_users', '用户指标', '人', '活跃用户数量'),
          ('平均访问频次', 'avg_visit_freq', '频次指标', '次', '用户平均访问频次')
        `).run();

        db.prepare(`
          INSERT INTO quality_rules (table_name, rule_type, rule_config, severity) VALUES 
          ('raw_data', 'completeness', '{"columns":["id","name"]}', 'error'),
          ('raw_data', 'uniqueness', '{"columns":["id"]}', 'error'),
          ('cleaned_data', 'consistency', '{"check_type":"format"}', 'warning')
        `).run();

        console.log('初始数据插入完成');
      }

      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { db, initDatabase };
