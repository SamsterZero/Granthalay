export interface ProblemDetails {
	type?: string;
	title?: string;
	status?: number;
	detail?: string;
	instance?: string;
	invalidParams?: Array<{ name: string; reason: string }>;
	[key: string]: unknown;
}

export class ApiError extends Error {
	status: number;
	problem?: ProblemDetails;

	constructor(status: number, message: string, problem?: ProblemDetails) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.problem = problem;
	}
}

export class ApiOfflineError extends Error {
	constructor(message = 'Granthalay API is offline or unreachable') {
		super(message);
		this.name = 'ApiOfflineError';
	}
}

export function getXsrfToken(): string | null {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : null;
}

const getBaseUrl = (): string => {
	if (
		typeof import.meta !== 'undefined' &&
		import.meta.env &&
		import.meta.env.VITE_PUBLIC_API_URL
	) {
		return import.meta.env.VITE_PUBLIC_API_URL as string;
	}
	return '/api/v1';
};

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
	const baseUrl = getBaseUrl();
	const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
	const headers = new Headers(options.headers || {});

	if (!headers.has('Accept')) {
		headers.set('Accept', 'application/json, application/problem+json');
	}

	if (options.body && !headers.has('Content-Type') && typeof options.body === 'string') {
		headers.set('Content-Type', 'application/json');
	}

	const method = (options.method || 'GET').toUpperCase();
	if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
		const xsrfToken = getXsrfToken();
		if (xsrfToken) {
			headers.set('X-XSRF-TOKEN', xsrfToken);
		}
	}

	try {
		const response = await fetch(url, {
			...options,
			headers,
			credentials: 'include'
		});

		if (response.status === 204) {
			return undefined as unknown as T;
		}

		const contentType = response.headers.get('Content-Type') || '';
		let data: unknown = null;

		if (
			contentType.includes('application/json') ||
			contentType.includes('application/problem+json')
		) {
			data = await response.json();
		} else {
			const text = await response.text();
			if (text) {
				try {
					data = JSON.parse(text);
				} catch {
					data = { detail: text };
				}
			}
		}

		if (!response.ok) {
			const problem = data as ProblemDetails | undefined;
			const detailMessage =
				problem?.detail || problem?.title || `Request failed with status ${response.status}`;
			throw new ApiError(response.status, detailMessage, problem);
		}

		return data as T;
	} catch (err: unknown) {
		if (err instanceof ApiError) {
			throw err;
		}
		if (
			err instanceof TypeError ||
			(err as { name?: string })?.name === 'TypeError' ||
			(err as { message?: string })?.message?.includes('Failed to fetch') ||
			(err as { message?: string })?.message?.includes('NetworkError')
		) {
			throw new ApiOfflineError();
		}
		throw err;
	}
}
