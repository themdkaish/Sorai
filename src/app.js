const express = require('express');
const cors = require('cors');
const musicRoutes = require('./routes/musicRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Music routes
app.use('/api', musicRoutes);

// Diagnostic endpoint
app.get('/api/test-yt-dlp', async (req, res) => {
  const { exec } = require('child_process');
  const ytDlpPath = process.env.YT_DLP_PATH || './yt-dlp';
  
  exec(`${ytDlpPath} --version`, (error, stdout, stderr) => {
    res.json({
      workingDirectory: process.cwd(),
      ytDlpPath,
      exists: require('fs').existsSync(ytDlpPath),
      version: stdout ? stdout.trim() : null,
      error: error ? error.message : null,
      stderr: stderr || null
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Music backend running on http://0.0.0.0:${PORT}`);
});
