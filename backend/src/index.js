require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const { authMiddleware } = require('./middleware/auth');
const { adminMiddleware } = require('./middleware/admin');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const folderRoutes = require('./routes/folders');
const snippetRoutes = require('./routes/snippets');
const tagRoutes = require('./routes/tags');
const validateEmailRoutes = require('./routes/validate-email');
const generateRoutes = require('./routes/generate');
const whatsappRoutes = require('./routes/whatsapp');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Attach prisma to requests
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Public routes
app.use('/api/auth', authRoutes);

// Authenticated routes
app.use('/api/admin', authMiddleware, adminMiddleware, adminRoutes);
app.use('/api/folders', authMiddleware, folderRoutes);
app.use('/api/snippets', authMiddleware, snippetRoutes);
app.use('/api/tags', authMiddleware, tagRoutes);
app.use('/api/validate-email', authMiddleware, validateEmailRoutes);
app.use('/api/generate', authMiddleware, generateRoutes);
app.use('/api/prompts', authMiddleware, generateRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve admin panel static files (built by Vite, copied into public/admin)
const adminBuildPath = path.join(__dirname, '..', 'public', 'admin');
app.use('/admin', express.static(adminBuildPath));

// SPA catch-all: any /admin/* route that isn't a static file returns index.html
app.get('/admin/{*splat}', (req, res) => {
  res.sendFile(path.join(adminBuildPath, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, prisma };
