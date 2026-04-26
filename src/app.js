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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Music backend running on http://0.0.0.0:${PORT}`);
});
