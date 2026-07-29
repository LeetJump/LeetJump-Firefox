// content.js: Same-origin redirect fallback.

(async () => {
	const match = location.pathname.match(/^\/(?:p|problems?)\/(\d+)\/?$/);
	if (!match) return;

	const id = match[1];
	const STORAGE_KEY = 'lc_problem_mapping';
	const origin = location.origin;
	console.log(`[LC Redirect] Content script detected ID ${id} on ${origin}`);

	// Helper for redirecting while preserving domain.
	const doRedirect = (slug) => {
		console.log(`[LC Redirect] Redirecting ${id} -> ${slug}`);
		location.replace(`${origin}/problems/${slug}/`);
	};

	// 1. Check cached mapping.
	try {
		const cached = await chrome.storage.local.get(STORAGE_KEY);
		const slug = cached?.[STORAGE_KEY]?.mapping?.[id];
		if (slug) {
			console.log(`[LC Redirect] Cache hit: ${id} -> ${slug}`);
			doRedirect(slug);
			return;
		}
	} catch (err) {
		console.warn('[LC Redirect] Storage read failed:', err);
	}

	// 2. Fetch from REST API (GET, no CSRF needed, absolute URL).
	try {
		console.log('[LC Redirect] Fetching from REST API...');
		const res = await fetch(`${origin}/api/problems/all/`, {
			credentials: 'include',
		});
		if (res.ok) {
			const json = await res.json();
			const pairs = json?.stat_status_pairs;
			if (Array.isArray(pairs) && pairs.length > 0) {
				const mapping = {};
				for (const entry of pairs) {
					const fid = entry?.stat?.frontend_question_id;
					const slug = entry?.stat?.question__title_slug;
					if (fid != null && slug) mapping[String(fid)] = slug;
				}
				console.log(
					`[LC Redirect] REST returned ${Object.keys(mapping).length} problems`,
				);
				await chrome.storage.local.set({
					[STORAGE_KEY]: { mapping, updatedAt: Date.now() },
				});
				if (mapping[id]) {
					doRedirect(mapping[id]);
					return;
				}
			}
		}
	} catch (err) {
		console.warn('[LC Redirect] REST API fetch failed:', err);
	}

	// 3. Fetch from GraphQL (absolute URL).
	try {
		console.log('[LC Redirect] Fetching from GraphQL...');
		const res = await fetch(`${origin}/graphql`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
          problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
            questions: data { frontendQuestionId: questionFrontendId, titleSlug }
          }
        }`,
				variables: {
					categorySlug: '',
					skip: 0,
					limit: 5000,
					filters: {},
				},
			}),
		});
		if (res.ok) {
			const json = await res.json();
			const questions = json?.data?.problemsetQuestionList?.questions;
			if (Array.isArray(questions) && questions.length > 0) {
				const mapping = {};
				for (const q of questions) {
					if (q.frontendQuestionId != null && q.titleSlug) {
						mapping[String(q.frontendQuestionId)] = q.titleSlug;
					}
				}
				console.log(
					`[LC Redirect] GraphQL returned ${Object.keys(mapping).length} problems`,
				);
				await chrome.storage.local.set({
					[STORAGE_KEY]: { mapping, updatedAt: Date.now() },
				});
				if (mapping[id]) {
					doRedirect(mapping[id]);
					return;
				}
			}
		}
	} catch (err) {
		console.warn('[LC Redirect] GraphQL fetch failed:', err);
	}

	// 4. Fetch from Remote fallback.json.
	try {
		console.log('[LC Redirect] Fetching from Remote fallback.json...');
		const res = await fetch(
			'https://raw.githubusercontent.com/LeetJump/fallback/main/fallback.json',
		);
		if (res.ok) {
			const mapping = await res.json();
			if (mapping && typeof mapping === 'object') {
				console.log(
					`[LC Redirect] Remote fallback returned ${Object.keys(mapping).length} problems`,
				);
				await chrome.storage.local.set({
					[STORAGE_KEY]: { mapping, updatedAt: Date.now() },
				});
				if (mapping[id]) {
					doRedirect(mapping[id]);
					return;
				}
			}
		}
	} catch (err) {
		console.warn('[LC Redirect] Remote fallback fetch failed:', err);
	}
})();
