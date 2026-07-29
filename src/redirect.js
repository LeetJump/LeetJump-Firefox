// redirect.js: URL matching and redirect logic.

import { lookupSlug } from './cache.js';

// Known LeetCode routes that must not be intercepted.
const PASSTHROUGH_PREFIXES = new Set([
	'problems',
	'problemset',
	'contest',
	'explore',
	'discuss',
	'store',
	'playground',
	'accounts',
	'profile',
	'submissions',
	'subscription',
	'progress',
	'studyplan',
	'company',
	'tag',
	'interview',
	'assessment',
	'list',
]);

// Extract numeric frontend ID from URL.
export function extractFrontendId(urlString) {
	let url;
	try {
		url = new URL(urlString);
	} catch {
		return null;
	}

	const validHosts = new Set([
		'leetcode.com',
		'www.leetcode.com',
		'leetcode.cn',
		'www.leetcode.cn',
	]);

	if (!validHosts.has(url.hostname)) {
		return null;
	}

	const segments = url.pathname.split('/').filter((s) => s.length > 0);
	if (segments.length === 0) return null;

	const first = segments[0].toLowerCase();

	// /p/<id>, /problem/<id>, or /problems/<id>: intercept numeric IDs before passthrough check.
	if (
		(first === 'p' || first === 'problem' || first === 'problems') &&
		segments.length >= 2 &&
		/^\d+$/.test(segments[1])
	) {
		return segments[1];
	}

	if (PASSTHROUGH_PREFIXES.has(first)) return null;

	return null;
}

// Handle a webNavigation event: redirect if a mapping exists.
export async function handleNavigation(details) {
	if (details.frameId !== 0) return;

	const frontendId = extractFrontendId(details.url);
	if (!frontendId) return;

	const slug = await lookupSlug(frontendId);
	if (!slug) {
		console.log(`[LC Redirect] No mapping for ID ${frontendId}. Skipping.`);
		return;
	}

	const url = new URL(details.url);
	const targetUrl = `https://${url.hostname}/problems/${slug}/`;
	console.log(
		`[LC Redirect] Redirecting ${frontendId} -> ${slug} on ${url.hostname}`,
	);

	try {
		await chrome.tabs.update(details.tabId, { url: targetUrl });
	} catch (err) {
		console.warn('[LC Redirect] tabs.update failed:', err.message);
	}
}
