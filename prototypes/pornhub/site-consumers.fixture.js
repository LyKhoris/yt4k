// Sanitized source-only fixture, NOT a Pornhub player or a supported adapter.
// Functions below are excerpts of first-party consumers, not implementations
// of MGP. Only the surrounding fixture declarations have been added.
// ph-footer.js?cache=2026111202 SHA-256:
// f984479cb2c5a980761964f55370a935cb9904a83f4a44f5f15ccb4870bc6e2f
var e = [];
function n(){var t=Object.keys(playerObjList)[0],i=MGP.players[t];if(void 0!==t&&document.getElementById(t)&&void 0!==i&&i.isPlaying()){var n=i.getCurrentTime();return e.push(5*Math.floor(n/5)),e}}

// v-flag-modal.js?cache=2026111202 SHA-256:
// c8be58c7d26cc6f3f3d6dee4bc69571f9f32e3a24464960f7eb14637f8f26f23
var flagTimestamp = function(){if("undefined"!=typeof VIDEO_SHOW){var t="pc"==this.platform?VIDEO_SHOW.videoId:VIDEO_SHOW.playerId;if(MGP.players[t])return MGP.players[t].getCurrentTime()}};
