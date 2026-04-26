const axios = require('axios');

/**
 * Internal search function used by both search API and home data fetcher.
 */
/**
 * Internal search function used by both search API and home data fetcher.
 * Uses heuristics to prioritize music content.
 */
async function _searchYoutube(query, limit = 20) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const html = response.data;
    const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (!dataMatch) return [];

    const data = JSON.parse(dataMatch[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const results = [];
    for (const item of contents) {
      const video = item?.videoRenderer;
      if (!video) continue;

      const title = (video?.title?.runs?.[0]?.text || '').toLowerCase();
      const artistRaw = (video?.ownerText?.runs?.[0]?.text || '');
      const artist = artistRaw.replace(' - Topic', '').replace('official', '').trim();
      const channelName = artistRaw.toLowerCase();
      const durationSimple = video?.lengthText?.simpleText || '';
      
      // Music Heuristics:
      // 1. Duration filter: Most songs are < 11 mins. Reject long compilations/podcasts.
      const durationParts = durationSimple.split(':');
      const minutes = durationParts.length === 2 ? parseInt(durationParts[0]) : (durationParts.length === 3 ? parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]) : 0);
      if (minutes > 11) continue;

      // 2. Keyword check: Reject non-music content
      const blacklist = ['vlog', 'tutorial', 'gameplay', 'how to', 'review', 'reaction', 'episode', 'full movie', 'unboxing', 'live stream'];
      if (blacklist.some(word => title.includes(word))) continue;

      // 3. Channel check: Prefer music channels (Topic, VEVO, Official)
      const isLikelyMusic = 
        channelName.includes('topic') || 
        channelName.includes('vevo') || 
        title.includes('official audio') || 
        title.includes('official music video') ||
        title.includes('lyric video') ||
        title.includes('official video') ||
        title.includes('audio') ||
        title.includes('song');

      // We still include it if it's not strictly "likely music" but passes the blacklist, 
      // but we might prioritize or filter more strictly if needed.
      // For now, let's just make sure we are conservative.
      if (!isLikelyMusic && !query.toLowerCase().includes(artist.toLowerCase())) {
        // If it doesn't look like music and the search query wasn't specifically for this artist, skip.
        // This helps filter out random videos that just happen to have a keyword.
        if (minutes === 0) continue; // Skip if no duration (live streams etc)
      }

      results.push({
        videoId: video.videoId,
        title: video?.title?.runs?.[0]?.text || 'Unknown',
        artist: artist || 'Unknown Artist',
        thumbnail: video?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '',
        duration: durationSimple,
      });

      if (results.length >= limit) break;
    }

    return results;
  } catch (error) {
    console.error(`YouTube search error for "${query}":`, error.message);
    return [];
  }
}

/**
 * Public search API handler.
 * Appends " music" to improve relevance.
 */
async function search(query) {
  // Append "official audio" or "music" to the query to guide YouTube's ranking
  return _searchYoutube(query + ' official audio', 20);
}

/**
 * Searches for playlists (albums).
 */
async function _searchPlaylists(query, limit = 5) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw%3D%3D`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const html = response.data;
    const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (!dataMatch) return [];

    const data = JSON.parse(dataMatch[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const results = [];
    for (const item of contents) {
      let playlistId, title, artist, thumbnail;

      if (item.playlistRenderer) {
        const p = item.playlistRenderer;
        playlistId = p.playlistId;
        title = p?.title?.simpleText || 'Unknown Album';
        artist = p?.shortBylineText?.runs?.[0]?.text || 'Various Artists';
        thumbnail = p?.thumbnails?.[0]?.thumbnails?.slice(-1)?.[0]?.url || '';
      } else if (item.lockupViewModel) {
        const vm = item.lockupViewModel;
        // Extract ID from navigation command
        playlistId = vm?.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId || 
                     vm?.contentId;
        
        // Ensure ID is a playlist ID (usually starts with PL)
        if (!playlistId || !playlistId.startsWith('PL')) continue;

        title = vm?.metadata?.lockupMetadataViewModel?.title?.content || 'Unknown Album';
        artist = vm?.metadata?.lockupMetadataViewModel?.subtitle?.content || 'Various Artists';
        thumbnail = vm?.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources?.slice(-1)?.[0]?.url || '';
      }

      if (playlistId) {
        results.push({
          playlistId,
          title,
          artist,
          thumbnail,
          isPlaylist: true,
        });
      }

      if (results.length >= limit) break;
    }

    return results;
  } catch (error) {
    console.error(`Playlist search error for ${query}:`, error.message);
    return [];
  }
}

/**
 * Fetches multiple categories of music for the Home screen.
 * Focuses on Indian trending categories and albums.
 */
async function getHomeCategories() {
  const categories = [
    { id: 'trendingHindi', query: 'latest hindi songs 2024 hits', label: 'Hindi Top Hits', limit: 8 },
    { id: 'topAlbums', query: 'hindi album songs 2024 playlist', label: 'Recommended Albums', type: 'playlist', limit: 6 },
    { id: 'trendingPunjabi', query: 'trending punjabi songs 2024', label: 'Punjabi Hits', limit: 8 },
    { id: 'trendingTamil', query: 'trending tamil songs 2024', label: 'Tamil Trending', limit: 8 },
    { id: 'globalTrending', query: 'latest music hits 2024 official', label: 'Global Trending', limit: 10 },
  ];

  const results = {};

  await Promise.all(
    categories.map(async (cat) => {
      let items;
      if (cat.type === 'playlist') {
        items = await _searchPlaylists(cat.query, cat.limit);
      } else {
        items = await _searchYoutube(cat.query, cat.limit);
      }
      
      results[cat.id] = {
        label: cat.label,
        items
      };
    })
  );

  return results;
}

/**
 * Scrapes a YouTube playlist to get all songs.
 */
async function getPlaylistSongs(playlistId) {
  try {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const html = response.data;
    const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (!dataMatch) return null;

    const data = JSON.parse(dataMatch[1]);
    
    // Extract metadata
    const metadata = data?.header?.playlistHeaderRenderer;
    const title = metadata?.title?.simpleText || 'Unknown Album';
    const thumbnail = metadata?.playlistHeaderBanner?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || 
                    metadata?.numVideosText?.runs?.[0]?.text || '';
    const artist = metadata?.ownerText?.runs?.[0]?.text || 'YouTube Music';

    // Extract videos
    const videoList = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents || [];

    const songs = [];
    for (const item of videoList) {
      const video = item?.playlistVideoRenderer;
      if (!video) continue;

      songs.push({
        videoId: video.videoId,
        title: video?.title?.runs?.[0]?.text || 'Unknown',
        artist: video?.shortBylineText?.runs?.[0]?.text?.replace(' - Topic', '') || artist,
        thumbnail: video?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '',
        duration: video?.lengthText?.simpleText || '',
      });
    }

    return {
      playlistId,
      title,
      artist,
      thumbnail,
      songs,
    };
  } catch (error) {
    console.error(`Playlist fetch error for ${playlistId}:`, error.message);
    return null;
  }
}

module.exports = { search, getHomeCategories, getPlaylistSongs };
