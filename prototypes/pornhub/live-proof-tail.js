// Append to the unchanged src/core.js + src/platforms/pornhub.js inside one
// page-world IIFE. Read-only technical observations; no media/frame capture.
// Install frame-hiding CSS/DOM init and block images BEFORE site navigation.
// This file itself neither bypasses gates nor opens/starts site media.
const liveEvents = [];
function readQualityPreference() {
  try {
    const value = JSON.parse(localStorage.getItem('mgp_player') || '{}').quality;
    return { readable: true, serialized: JSON.stringify(value), present: value !== undefined };
  } catch (_) { return { readable: false }; }
}
const preferenceBefore = readQualityPreference();
YT4K.config.debug = true;
YT4K.log = (event, dimensions) => liveEvents.push({ event, ...dimensions });
YT4K.warn = event => liveEvents.push({ event });
window.__yt4kLiveRead = () => {
  const mgp = window.MGP;
  const roots = [...document.querySelectorAll('.original.mainPlayerDiv .playerFlvContainer[id^="playerDiv_"]')];
  const preferenceNow = readQualityPreference();
  return {
    events: liveEvents.slice(),
    qualityPreferenceReadable: preferenceBefore.readable && preferenceNow.readable,
    qualityPreferenceInitiallyPresent: preferenceBefore.present,
    qualityPreferenceUnchanged: preferenceBefore.readable && preferenceNow.readable &&
      preferenceBefore.serialized === preferenceNow.serialized,
    pageHidden: getComputedStyle(document.documentElement).opacity === '0',
    registryCount: Object.keys(mgp?.players || {}).length,
    build: mgp?.buildInfo ? {
      name: mgp.buildInfo.playerName, version: mgp.buildInfo.playerVersion,
      library: mgp.buildInfo.libraryName, libraryVersion: mgp.buildInfo.libraryVersion,
    } : null,
    roots: roots.map(root => {
      const player = mgp?.players?.[root.id];
      const settings = player?.settings?.();
      const definitions = mgp?.inspectOriginal?.(root.id)?.mainRoll?.mediaDefinition;
      const video = root.querySelector('video.mgp_videoElement');
      const state = player?.getCurrentState?.();
      return {
        keyedWrapper: !!player, settingsOwner: settings?.playerId === root.id,
        videoCount: root.querySelectorAll('video.mgp_videoElement').length,
        videoOwned: !!video && root.contains(video),
        videoHidden: !!video && getComputedStyle(video).visibility === 'hidden' &&
          getComputedStyle(video).opacity === '0',
        muted: video?.muted, sourceReady: player?.isSourceReady?.(),
        adReady: state?.adRollReady, adStarted: state?.adRollStarted,
        settingsSourcesRedacted: settings?.mainRoll?.mediaDefinition?.length === 0,
        qualities: player?.quality?.get?.({ list: true }), selected: player?.quality?.get?.(),
        width: video?.videoWidth, height: video?.videoHeight,
        readyState: video?.readyState, paused: video?.paused, time: video?.currentTime,
        blob: video?.currentSrc.startsWith('blob:'),
        definitions: definitions?.map(({ format, width, height, quality, remote }) =>
          ({ format, width, height, quality, remote })),
      };
    }),
  };
};
void YT4K.start(location.hostname);
