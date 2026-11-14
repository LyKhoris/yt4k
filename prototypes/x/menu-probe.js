// Throwaway single-player console probe, not a userscript or production adapter.
// Supply dimensions from this player's actually observed HLS master, not labels.
// Does not discover manifests, guarantee a startup cap, or handle multiple players.
window.__yt4kXMenuProbe = async function (variants, maxHeight = 2160) {
  const players = [...document.querySelectorAll('[data-testid="videoPlayer"]')];
  if (players.length !== 1 || document.querySelector('[role="dialog"]')) {
    throw new Error('Probe requires one player and no existing dialog');
  }
  if (!variants.length || variants.some(({ width, height }) =>
    !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
  )) throw new Error('All supplied variants must have known dimensions');
  const eligible = variants.filter(({ height }) => height <= maxHeight);
  if (!eligible.length) throw new Error('No eligible variant');
  const target = [...eligible].sort((a, b) => b.height - a.height || b.width - a.width)[0];
  const label = `${Math.min(target.width, target.height)}p`;
  if (variants.filter(v => `${Math.min(v.width, v.height)}p` === label).length !== 1) {
    throw new Error('Ambiguous short-side label');
  }
  const player = players[0];
  const video = player.querySelector('video');
  const trigger = player.querySelector('button[aria-label="Video Settings"]');
  if (!video || !trigger) throw new Error('Observed player controls missing');
  const waitFor = async (read) => {
    const end = performance.now() + 2000;
    do {
      const value = read();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (performance.now() < end);
    throw new Error('Observed UI did not appear');
  };
  const text = node => node.textContent.trim();
  trigger.click();
  const dialog = await waitFor(() => document.querySelector('[role="dialog"]'));
  const quality = [...dialog.querySelectorAll('[role="menuitem"]')]
    .find(node => /^Video quality(?: ·|$)/.test(text(node)));
  if (!quality) throw new Error('Observed quality menu missing');
  quality.click();
  const group = await waitFor(() => dialog.querySelector('[data-testid="radioGroupquality_level"]'));
  const radio = [...group.querySelectorAll('input[type="radio"]')].find(node => {
    const name = document.getElementById(node.getAttribute('aria-labelledby'));
    return name && text(name) === label;
  });
  if (!radio) throw new Error('Verified variant label absent');
  radio.click();
  return {
    requested: { width: target.width, height: target.height, label },
    immediateDecoded: { width: video.videoWidth, height: video.videoHeight },
    // Reopen the menu and inspect .checked independently after playback settles.
    selectionVerified: false,
  };
};
