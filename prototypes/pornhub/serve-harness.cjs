'use strict';

// Local-only server. External first-party assets and generated media stay in /tmp/opencode.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const assets = '/tmp/opencode/yt4k-ph-harness';
const wrapper = '/tmp/opencode/yt4k-ph-desktop-player-9.2.7.js';
const expectedHash = '40340f0ce9623729dab1b08d48a97611190a5d943a4bd7922bca03a2d2692cd9';
if (crypto.createHash('sha256').update(fs.readFileSync(wrapper)).digest('hex') !== expectedHash) {
  throw new Error('Wrapper changed; inspect it again before running the harness');
}
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let file;
  if (url.pathname === '/' || url.pathname === '/view_video.php') file = path.join(__dirname, 'wrapper-harness.html');
  else if (url.pathname === '/desktop-player.min.js') file = wrapper;
  else if (url.pathname === '/core.js') file = path.join(root, 'src/core.js');
  else if (url.pathname === '/adapter.js') file = path.join(root, 'src/platforms/pornhub.js');
  else if (/^\/(media\/[\w.-]+|desktop-player\.min\.css|external-libraries\/[\w.-]+)$/.test(url.pathname)) {
    file = path.join(assets, url.pathname);
  }
  if (!file || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.mp4': 'video/mp4', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}).listen(9034, '127.0.0.1', () => console.log('Non-explicit wrapper harness: http://127.0.0.1:9034/view_video.php'));
