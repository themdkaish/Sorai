const { exec } = require('child_process');
const fs = require('fs');

/**
 * Uses yt-dlp to extract the best audio stream URL from a YouTube video.
 * Requires yt-dlp to be installed: `brew install yt-dlp`
 */
function getAudioUrl(videoId) {
  return new Promise((resolve, reject) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Get audio URL and metadata in JSON
    // Use './yt-dlp' if it exists (common for portable installs), otherwise use system 'yt-dlp'
    const ytDlpPath = fs.existsSync('./yt-dlp') ? './yt-dlp' : 'yt-dlp';
    
    // Using cookies.txt and a flexible format selection (ba/b) to ensure playback
    const cookiesExist = fs.existsSync('cookies.txt');
    const cookiesFlag = cookiesExist ? '--cookies cookies.txt' : '';
    
    // Improved flags for cloud environments like Render:
    // 1. player_client=ios,android,web: Bypasses some IP-based blocks
    // 2. js-runtimes node: Uses the existing Node.js environment to solve signature challenges
    const baseFlags = [
      cookiesFlag,
      '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"',
      '--referer "https://www.youtube.com/"',
      '--extractor-args "youtube:player_client=ios,android,web"',
      '--js-runtimes node',
      '--no-playlist',
      '--no-warnings'
    ].filter(Boolean).join(' ');

    const cmd = `${ytDlpPath} ${baseFlags} -f "ba/b" -j "${videoUrl}"`;

    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ yt-dlp primary error: ${error.message}`);
        if (stderr) console.error(`Stderr: ${stderr}`);

        // Debug: Log all available formats to see what YouTube is offering
        exec(`${ytDlpPath} -F "${videoUrl}"`, (fErr, fStdout) => {
          console.log(`📋 Available formats for ${videoId}:\n${fStdout || 'None'}`);
        });

        // Fallback 1: try just getting the URL with current flags
        console.log('🔄 Attempting fallback 1 (get URL only)...');
        const fallbackCmd = `${ytDlpPath} ${baseFlags} -f bestaudio -g "${videoUrl}"`;
        exec(fallbackCmd, { timeout: 30000 }, (err2, stdout2) => {
          if (err2) {
            console.error(`❌ yt-dlp fallback 1 error: ${err2.message}`);
            
            // Fallback 2: try WITHOUT cookies if they were used
            if (cookiesExist) {
              console.log('🔄 Attempting fallback 2 (no cookies)...');
              const noCookiesFlags = baseFlags.replace('--cookies cookies.txt', '').trim();
              const lastResortCmd = `${ytDlpPath} ${noCookiesFlags} -f "ba/b" -g "${videoUrl}"`;
              
              exec(lastResortCmd, { timeout: 30000 }, (err3, stdout3) => {
                if (err3) {
                  console.error(`❌ yt-dlp fallback 2 error: ${err3.message}`);
                  
                  // Fallback 3: Super-robust Android-VR client (highest success rate on cloud)
                  console.log('🛡️ Attempting super-fallback (Android-VR client)...');
                  const superFallbackCmd = `${ytDlpPath} --extractor-args "youtube:player_client=android_vr" -f "ba/b" -g "${videoUrl}"`;
                  
                  exec(superFallbackCmd, { timeout: 30000 }, (err4, stdout4) => {
                    if (err4) {
                       console.error('yt-dlp super-fallback error:', err4.message);
                       return reject(new Error('YouTube is blocking this server IP. Please try again later or use a different video.'));
                    }
                    resolve({
                      streamUrl: stdout4.trim(),
                      title: 'Unknown (Extracted via VR)',
                      artist: 'Unknown',
                      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                      duration: 0,
                    });
                  });
                  return;
                }
                resolve({
                  streamUrl: stdout3.trim(),
                  title: 'Unknown',
                  artist: 'Unknown',
                  thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                  duration: 0,
                });
              });
            } else {
              return reject(new Error('Failed to extract audio URL'));
            }
            return;
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
