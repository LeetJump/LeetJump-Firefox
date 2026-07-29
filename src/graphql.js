// graphql.js: Isolated module for fetching LeetCode problem mappings.
// Update the query/parseResponse if LeetCode changes their schema.

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const LEETCODE_REST_URL = 'https://leetcode.com/api/problems/all/';

const PROBLEMS_QUERY = `
  query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      total: totalNum
      questions: data {
        frontendQuestionId: questionFrontendId
        titleSlug
      }
    }
  }
`;

const QUERY_VARIABLES = {
	categorySlug: '',
	skip: 0,
	limit: 5000,
	filters: {},
};

function parseGraphQLResponse(json) {
	const questions = json?.data?.problemsetQuestionList?.questions;

	if (!Array.isArray(questions)) {
		throw new Error(
			"Unexpected GraphQL response: 'questions' array not found.",
		);
	}

	const mapping = {};
	for (const q of questions) {
		const id = q.frontendQuestionId;
		const slug = q.titleSlug;
		if (id != null && slug) mapping[String(id)] = slug;
	}

	if (Object.keys(mapping).length === 0) {
		throw new Error('GraphQL returned an empty problem list.');
	}

	return mapping;
}

function parseRESTResponse(json) {
	const pairs = json?.stat_status_pairs;

	if (!Array.isArray(pairs)) {
		throw new Error(
			"Unexpected REST response: 'stat_status_pairs' not found.",
		);
	}

	const mapping = {};
	for (const entry of pairs) {
		const id = entry?.stat?.frontend_question_id;
		const slug = entry?.stat?.question__title_slug;
		if (id != null && slug) mapping[String(id)] = slug;
	}

	if (Object.keys(mapping).length === 0) {
		throw new Error('REST API returned an empty problem list.');
	}

	return mapping;
}

// Primary: fetch via GraphQL.
export async function fetchMapping() {
	console.log('[LC Redirect] Fetching mapping from GraphQL...');

	const response = await fetch(LEETCODE_GRAPHQL_URL, {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			Referer: 'https://leetcode.com/problemset/',
			Origin: 'https://leetcode.com',
		},
		body: JSON.stringify({
			query: PROBLEMS_QUERY,
			variables: QUERY_VARIABLES,
		}),
	});

	if (!response.ok) {
		throw new Error(
			`GraphQL request failed: HTTP ${response.status} ${response.statusText}`,
		);
	}

	const json = await response.json();

	if (json.errors?.length > 0) {
		const messages = json.errors.map((e) => e.message).join('; ');
		throw new Error(`GraphQL errors: ${messages}`);
	}

	return parseGraphQLResponse(json);
}

// Secondary: fetch via REST API (/api/problems/all/).
export async function fetchMappingFromREST() {
	console.log('[LC Redirect] Fetching mapping from REST API...');

	const response = await fetch(LEETCODE_REST_URL, {
		credentials: 'include',
		headers: {
			Referer: 'https://leetcode.com/problemset/',
			Origin: 'https://leetcode.com',
		},
	});

	if (!response.ok) {
		throw new Error(
			`REST request failed: HTTP ${response.status} ${response.statusText}`,
		);
	}

	const json = await response.json();
	return parseRESTResponse(json);
}

// Configurable URL for remote fallback.json hosted on GitHub raw CDN.
export const REMOTE_FALLBACK_URL =
	'https://raw.githubusercontent.com/LeetJump/fallback/main/fallback.json';

// Tertiary: fetch remote fallback JSON file.
export async function fetchMappingFromRemoteFallback() {
	console.log('[LC Redirect] Fetching mapping from remote fallback JSON...');

	const response = await fetch(REMOTE_FALLBACK_URL);

	if (!response.ok) {
		throw new Error(
			`Remote fallback fetch failed: HTTP ${response.status} ${response.statusText}`,
		);
	}

	const json = await response.json();
	if (
		typeof json !== 'object' ||
		json === null ||
		Object.keys(json).length === 0
	) {
		throw new Error('Remote fallback returned empty or invalid JSON.');
	}

	return json;
}
