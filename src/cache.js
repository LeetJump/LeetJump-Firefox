// cache.js: Caching layer for problem ID to slug mapping.

import {
	fetchMapping,
	fetchMappingFromREST,
	fetchMappingFromRemoteFallback,
} from './graphql.js';

const STORAGE_KEY = 'lc_problem_mapping';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let memoryCache = null;

async function readStorage() {
	try {
		const result = await chrome.storage.local.get(STORAGE_KEY);
		return result[STORAGE_KEY] ?? null;
	} catch (err) {
		console.warn('[LC Redirect] Storage read failed:', err.message);
		return null;
	}
}

async function writeStorage(mapping) {
	try {
		await chrome.storage.local.set({
			[STORAGE_KEY]: { mapping, updatedAt: Date.now() },
		});
		console.log('[LC Redirect] Cache saved to storage.');
	} catch (err) {
		console.warn('[LC Redirect] Storage write failed:', err.message);
	}
}

function isFresh(entry) {
	if (!entry || !entry.mapping || !entry.updatedAt) return false;
	return Date.now() - entry.updatedAt < CACHE_TTL_MS;
}

// Priority: GraphQL -> REST API -> Remote fallback.json.
async function fetchFreshMapping() {
	try {
		return await fetchMapping();
	} catch (err) {
		console.warn('[LC Redirect] GraphQL failed:', err.message);
	}

	try {
		return await fetchMappingFromREST();
	} catch (err) {
		console.warn('[LC Redirect] REST API failed:', err.message);
	}

	return await fetchMappingFromRemoteFallback();
}

async function refreshInBackground() {
	try {
		const mapping = await fetchFreshMapping();
		await writeStorage(mapping);
		memoryCache = mapping;
		console.log(
			`[LC Redirect] Cache refreshed (${Object.keys(mapping).length} problems).`,
		);
	} catch (err) {
		console.warn('[LC Redirect] Background refresh failed:', err.message);
	}
}

export async function getMapping() {
	if (memoryCache) return memoryCache;

	const stored = await readStorage();
	if (stored && stored.mapping) {
		console.log('[LC Redirect] Cache loaded.');
		memoryCache = stored.mapping;
		if (!isFresh(stored)) refreshInBackground();
		return memoryCache;
	}

	// No cache: try remote sources (GraphQL -> REST -> Remote Fallback).
	try {
		const mapping = await fetchFreshMapping();
		await writeStorage(mapping);
		memoryCache = mapping;
		console.log(
			`[LC Redirect] Mapping fetched and cached (${Object.keys(mapping).length} problems).`,
		);
		return memoryCache;
	} catch (err) {
		console.warn('[LC Redirect] All remote fetches failed:', err.message);
	}

	return null;
}

export async function lookupSlug(frontendId) {
	const mapping = await getMapping();
	return mapping?.[frontendId] ?? null;
}
