/* APlayer + Meting metadata integration. Preserve the original inline player. */
(function () {
  'use strict';

  // Only replace the known failing NetEase stream resolver. Never rewrite
  // arbitrary hosts, songs, or another provider's URLs.
  function normalizeTrack(track, server) {
    const result = {
      name: track.name || track.title || 'Audio name',
      artist: track.artist || track.author || 'Audio artist',
      url: track.url,
      cover: track.cover || track.pic,
      lrc: track.lrc
    };
    try {
      const stream = new URL(track.url);
      const id = stream.searchParams.get('id');
      if (server === 'netease' && stream.hostname === 'api.i-meto.com' &&
          stream.pathname === '/meting/api' && stream.searchParams.get('server') === 'netease' &&
          stream.searchParams.get('type') === 'url' && /^\d+$/.test(id || '')) {
        result.url = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
      }
    } catch (_) { /* Keep other playable URLs as supplied by the API. */ }
    return result;
  }

  // Export the pure mapping for Node tests without running browser code.
  if (typeof module === 'object' && module.exports) {
    module.exports = normalizeTrack;
    return;
  }

  async function loadPlayer(element) {
    const player = new APlayer({
      container: element,
      audio: [{ name: '音乐加载中…', artist: '', url: '' }],
      autoplay: false,
      mutex: true,
      lrcType: 3,
      listFolded: false,
      preload: 'none',
      theme: element.dataset.theme || '#ad7a86',
      loop: 'all',
      order: 'list',
      listMaxHeight: element.dataset.listmaxheight || '340px',
      storageName: 'metingjs'
    });
    window.aplayers = window.aplayers || [];
    window.aplayers.push(player);
    const request = new URL('https://api.i-meto.com/meting/api');
    request.search = new URLSearchParams({
      server: element.dataset.server, type: element.dataset.type,
      id: element.dataset.id, r: String(Math.random())
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(request, { signal: controller.signal });
      if (!response.ok) throw new Error(`Meting returned ${response.status}`);
      const tracks = await response.json();
      if (!Array.isArray(tracks) || !tracks.length) throw new Error('Meting returned no tracks');
      player.list.clear();
      player.list.add(tracks.map(track => normalizeTrack(track, element.dataset.server)));
    } catch (error) {
      player.list.clear();
      player.list.add([{ name: '音乐暂时无法加载', artist: '请稍后重试', url: '' }]);
      console.warn('Music metadata unavailable:', error);
    } finally {
      clearTimeout(timeout);
    }
  }

  function start() {
    document.querySelectorAll('.meting-tag-marker').forEach(loadPlayer);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());
