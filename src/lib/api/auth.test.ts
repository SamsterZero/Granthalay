import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError, ApiOfflineError } from './client';
import { authState } from './auth.svelte';

afterEach(() => {
	vi.unstubAllGlobals();
	authState.user = null;
	authState.sessions = [];
	authState.isOffline = false;
	authState.isLoading = false;
	authState.error = null;
});

describe('API client and Auth store', () => {
	it('attaches X-XSRF-TOKEN and credentials: include on mutation requests', async () => {
		vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=test-csrf-token-123' });
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'Content-Type': 'application/json' }),
			json: vi.fn().mockResolvedValue({ message: 'success' })
		});
		vi.stubGlobal('fetch', mockFetch);

		const res = await apiFetch<{ message: string }>('/auth/sign-in', {
			method: 'POST',
			body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
		});

		expect(res).toEqual({ message: 'success' });
		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe('/api/v1/auth/sign-in');
		expect(init.credentials).toBe('include');
		expect(init.headers.get('X-XSRF-TOKEN')).toBe('test-csrf-token-123');
	});

	it('handles 204 No Content response gracefully', async () => {
		vi.stubGlobal('document', { cookie: '' });
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 204,
			headers: new Headers()
		});
		vi.stubGlobal('fetch', mockFetch);

		const res = await apiFetch<void>('/auth/sign-out', { method: 'POST' });
		expect(res).toBeUndefined();
	});

	it('throws ApiError with problem details on 400 Bad Request', async () => {
		vi.stubGlobal('document', { cookie: '' });
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			headers: new Headers({ 'Content-Type': 'application/problem+json' }),
			json: vi.fn().mockResolvedValue({
				type: 'https://granthalay.app/problems/invalid-input',
				title: 'Invalid Input',
				status: 400,
				detail: 'Email is required'
			})
		});
		vi.stubGlobal('fetch', mockFetch);

		await expect(apiFetch('/auth/register', { method: 'POST' })).rejects.toThrow(ApiError);
	});

	it('throws ApiOfflineError when fetch fails due to network error', async () => {
		vi.stubGlobal('document', { cookie: '' });
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		await expect(apiFetch('/auth/me')).rejects.toThrow(ApiOfflineError);
	});

	it('checkSession populates user and active sessions on 200 OK', async () => {
		vi.stubGlobal('document', { cookie: '' });
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				headers: new Headers({ 'Content-Type': 'application/json' }),
				json: vi.fn().mockResolvedValue({
					id: 'usr_123',
					email: 'reader@example.com',
					displayName: 'Book Reader',
					emailVerified: true,
					activeSessions: [
						{
							id: 'sess_1',
							userAgent: 'Firefox',
							ipAddress: '127.0.0.1',
							current: true
						}
					]
				})
			})
		);

		const loggedIn = await authState.checkSession();
		expect(loggedIn).toBe(true);
		expect(authState.user?.id).toBe('usr_123');
		expect(authState.user?.email).toBe('reader@example.com');
		expect(authState.user?.displayName).toBe('Book Reader');
		expect(authState.sessions).toHaveLength(1);
		expect(authState.sessions[0].current).toBe(true);
		expect(authState.isOffline).toBe(false);
	});

	it('checkSession sets user to null on 401 Unauthorized without treating app as offline', async () => {
		vi.stubGlobal('document', { cookie: '' });
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				headers: new Headers({ 'Content-Type': 'application/problem+json' }),
				json: vi.fn().mockResolvedValue({ status: 401, title: 'Unauthorized' })
			})
		);

		const loggedIn = await authState.checkSession();
		expect(loggedIn).toBe(false);
		expect(authState.user).toBeNull();
		expect(authState.isOffline).toBe(false);
	});

	it('checkSession sets isOffline to true when API network call fails', async () => {
		vi.stubGlobal('document', { cookie: '' });
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		const loggedIn = await authState.checkSession();
		expect(loggedIn).toBe(false);
		expect(authState.user).toBeNull();
		expect(authState.isOffline).toBe(true);
	});
});
