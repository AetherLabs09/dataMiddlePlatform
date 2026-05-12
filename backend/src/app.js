const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const dataCollectionRoutes = require('./routes/dataCollection');
const dataCleaningRoutes = require('./routes/dataCleaning');
const dataGovernanceRoutes = require('./routes/dataGovernance');
const statisticsRoutes = require('./routes/statistics');
const apiServiceRoutes = require('./routes/apiService');
const userRoutes = require('./routes/user');

const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/collection', dataCollectionRoutes);
app.use('/api/cleaning', dataCleaningRoutes);
app.use('/api/governance', dataGovernanceRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/service', apiServiceRoutes);
app.use('/api/user', userRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const frontendPath = path.join(__dirname, '../../frontend/dist');
if (require('fs').existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`数据中台后端服务运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
