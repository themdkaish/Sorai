const { exec } = require('child_process');

/**
 * Uses yt-dlp to extract the best audio stream URL from a YouTube video.
 * Requires yt-dlp to be installed: `brew install yt-dlp`
 */
function getAudioUrl(videoId) {
  return new Promise((resolve, reject) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Get audio URL and metadata in JSON
    // Using full path to ensure it's found even if not in the process PATH
    const ytDlpPath = '/Library/Frameworks/Python.framework/Versions/3.14/bin/yt-dlp';
    const cmd = `${ytDlpPath} -f bestaudio --no-playlist --no-warnings -j "${videoUrl}"`;

    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp error:', error.message);

        // Fallback: try just getting the URL
        const fallbackCmd = `${ytDlpPath} -f bestaudio -g --no-playlist --no-warnings "${videoUrl}"`;
        exec(fallbackCmd, { timeout: 30000 }, (err2, stdout2) => {
          if (err2) {
            return reject(new Error('Failed to extract audio URL'));
          }
          resolve({
            streamUrl: stdout2.trim(),
            title: 'Unknown',
            artist: 'Unknown',
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            duration: 0,
          });
        });
        return;
      }

      try {
        const info = JSON.parse(stdout);
        resolve({
          streamUrl: info.url,
          title: info.title || 'Unknown',
          artist: info.uploader?.replace(' - Topic', '') || info.channel || 'Unknown',
          thumbnail:
            info.thumbnail ||
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: info.duration || 0,
        });
      } catch (parseError) {
        reject(new Error('Failed to parse yt-dlp output'));
      }
    });
  });
}

module.exports = { getAudioUrl };
