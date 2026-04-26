const youtubeService = require('../services/youtubeService');
const ytDlp = require('../utils/ytDlp');
const NodeCache = require('node-cache');

const searchCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
const streamCache = new NodeCache({ stdTTL: 18000 }); // 5 hours

const search = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Check cache
    const cacheKey = `search:${q.toLowerCase().trim()}`;
    const cached = searchCache.get(cacheKey);
    if (cached) {
      console.log(`📦 Cache hit for search: "${q}"`);
      return res.json(cached);
    }

    console.log(`🔍 Searching YouTube for: "${q}"`);
    const results = await youtubeService.search(q);

    // Cache results
    searchCache.set(cacheKey, results);

    res.json(results);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Failed to search. Please try again.' });
  }
};

const getStream = async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Check cache
    const cacheKey = `stream:${videoId}`;
    const cached = streamCache.get(cacheKey);
    if (cached) {
      console.log(`📦 Cache hit for stream: ${videoId}`);
      return res.json(cached);
    }

    console.log(`🎵 Getting stream URL for: ${videoId}`);
    const streamData = await ytDlp.getAudioUrl(videoId);

    // Cache the result
    streamCache.set(cacheKey, streamData);

    res.json(streamData);
  } catch (error) {
    console.error('Stream error:', error.message);
    res.status(500).json({ error: 'Failed to get stream URL. Please try again.' });
  }
};

const getHome = async (req, res) => {
  try {
    // Check cache
    const cacheKey = 'home:data';
    const cached = searchCache.get(cacheKey); // Reuse searchCache for home data
    if (cached) {
      console.log('📦 Cache hit for home data');
      return res.json(cached);
    }

    console.log('🏠 Fetching fresh home category data...');
    const homeData = await youtubeService.getHomeCategories();

    // Cache for 4 hours
    searchCache.set(cacheKey, homeData, 14400);

    res.json(homeData);
  } catch (error) {
    console.error('Home data error:', error.message);
    res.status(500).json({ error: 'Failed to fetch home data' });
  }
};

const getPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    // Check cache
    const cacheKey = `playlist:${id}`;
    const cached = streamCache.get(cacheKey); // Use larger cache for playlists
    if (cached) {
      console.log(`📦 Cache hit for playlist: ${id}`);
      return res.json(cached);
    }

    console.log(`📜 Fetching playlist details for: ${id}`);
    const playlistData = await youtubeService.getPlaylistSongs(id);

    if (!playlistData) {
      return res.status(404).json({ error: 'Playlist not found or empty' });
    }

    // Cache for 12 hours
    streamCache.set(cacheKey, playlistData, 43200);

    res.json(playlistData);
  } catch (error) {
    console.error('Playlist error:', error.message);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
};

module.exports = { search, getStream, getHome, getPlaylist };
