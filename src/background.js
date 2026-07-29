// background.js: Service worker entry point.

import { handleNavigation } from './redirect.js';
import { getMapping } from './cache.js';

chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation, {
	url: [
		{ hostEquals: 'leetcode.com' },
		{ hostEquals: 'www.leetcode.com' },
		{ hostEquals: 'leetcode.cn' },
		{ hostEquals: 'www.leetcode.cn' },
	],
});

// Warm cache on service worker start.
getMapping()
	.then(() =>
		console.log('[LC Redirect] Service worker initialised. Cache is warm.'),
	)
	.catch((err) =>
		console.warn('[LC Redirect] Initial cache warm failed:', err.message),
	);
