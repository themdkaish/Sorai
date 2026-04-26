const express = require('express');
const router = express.Router();
const musicController = require('../controllers/musicController');

// Search for songs
router.get('/search', musicController.search);

// Get stream URL for a video
router.get('/stream/:videoId', musicController.getStream);

// Get home screen data (trending, categories)
router.get('/home', musicController.getHome);

// Get playlist/album songs
router.get('/playlist/:id', musicController.getPlaylist);

module.exports = router;
