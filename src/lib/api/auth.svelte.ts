import { apiFetch, ApiError, ApiOfflineError } from './client';

export interface UserAccount {
	id: string;
	email: string;
	displayName?: string | null;
	emailVerified: boolean;
	createdAt?: string;
}

export interface SessionInfo {
	id: string;
	userAgent?: string | null;
	ipAddress?: string | null;
	lastSeenAt?: string;
	current?: boolean;
}

class AuthStore {
	user = $state<UserAccount | null>(null);
	sessions = $state<SessionInfo[]>([]);
	isLoading = $state<boolean>(true);
	isOffline = $state<boolean>(false);
	error = $state<string | null>(null);

	async checkSession(): Promise<boolean> {
		this.isLoading = true;
		this.error = null;
		try {
			const res = await apiFetch<Record<string, unknown>>('/auth/me');
			this.isOffline = false;
			this.user = {
				id: String(res.id || ''),
				email: String(res.email || ''),
				displayName: (res.displayName ?? res.display_name ?? null) as string | null,
				emailVerified: Boolean(res.emailVerified ?? res.isEmailVerified ?? res.email_verified),
				createdAt: (res.createdAt ?? res.created_at) as string | undefined
			};

			const rawSessions = (res.activeSessions || res.active_sessions) as
				Array<Record<string, unknown>> | undefined;
			if (Array.isArray(rawSessions)) {
				this.sessions = rawSessions.map((s) => ({
					id: String(s.id || ''),
					userAgent: (s.userAgent ?? s.user_agent ?? null) as string | null,
					ipAddress: (s.ipAddress ?? s.ip_address ?? null) as string | null,
					lastSeenAt: (s.lastSeenAt ?? s.last_seen_at) as string | undefined,
					current: Boolean(s.current)
				}));
			} else {
				this.sessions = [];
			}
			return true;
		} catch (err: unknown) {
			if (err instanceof ApiOfflineError) {
				this.isOffline = true;
				this.user = null;
			} else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
				this.isOffline = false;
				this.user = null;
			} else {
				this.isOffline = false;
				this.user = null;
			}
			return false;
		} finally {
			this.isLoading = false;
		}
	}

	async register(email: string, password: string, displayName?: string) {
		this.error = null;
		try {
			const body: Record<string, string> = { email, password };
			if (displayName) body.displayName = displayName;
			const res = await apiFetch<Record<string, unknown>>('/auth/register', {
				method: 'POST',
				body: JSON.stringify(body)
			});
			return res;
		} catch (err: unknown) {
			if (err instanceof ApiOfflineError) {
				this.isOffline = true;
				throw new Error('API is currently offline. Please try again when back online.');
			}
			if (err instanceof ApiError) {
				this.error = err.message;
			}
			throw err;
		}
	}

	async verifyEmail(token: string) {
		this.error = null;
		try {
			const res = await apiFetch<Record<string, unknown>>('/auth/verify-email', {
				method: 'POST',
				body: JSON.stringify({ token })
			});
			await this.checkSession();
			return res;
		} catch (err: unknown) {
			if (err instanceof ApiOfflineError) {
				this.isOffline = true;
				throw new Error('API is currently offline.');
			}
			if (err instanceof ApiError) {
				this.error = err.message;
			}
			throw err;
		}
	}

	async signIn(email: string, password: string) {
		this.error = null;
		try {
			const res = await apiFetch<Record<string, unknown>>('/auth/sign-in', {
				method: 'POST',
				body: JSON.stringify({ email, password })
			});
			await this.checkSession();
			return res;
		} catch (err: unknown) {
			if (err instanceof ApiOfflineError) {
				this.isOffline = true;
				throw new Error(
					'API is currently offline. Reader functions remain fully available local-first.'
				);
			}
			if (err instanceof ApiError) {
				this.error = err.message;
			}
			throw err;
		}
	}

	async signOut() {
		this.error = null;
		try {
			await apiFetch<Record<string, unknown>>('/auth/sign-out', { method: 'POST' });
		} catch (err: unknown) {
			if (err instanceof ApiOfflineError) {
				this.isOffline = true;
			}
		} finally {
			this.user = null;
			this.sessions = [];
		}
	}

	async revokeAllSessions() {
		this.error = null;
		try {
			await apiFetch<Record<string, unknown>>('/auth/revoke-sessions', { method: 'POST' });
			await this.checkSession();
		} catch (err: unknown) {
			if (err instanceof ApiOfflineError) {
				this.isOffline = true;
				throw new Error('API is currently offline.');
			}
			if (err instanceof ApiError) {
				this.error = err.message;
			}
			throw err;
		}
	}

	async requestPasswordReset(email: string) {
		this.error = null;
		try {
			return await apiFetch<Record<string, unknown>>('/auth/request-password-reset', {
				method: 'POST',
				body: JSON.stringify({ email })
			});
		} catch (err: unknown) {
			if (err instanceof ApiOfflineError) {
				this.isOffline = true;
				throw new Error('API is currently offline.');
			}
			if (err instanceof ApiError) {
				this.error = err.message;
			}
			throw err;
		}
	}

	async resetPassword(token: string, newPassword: string) {
		this.error = null;
		try {
			return await apiFetch<Record<string, unknown>>('/auth/reset-password', {
				method: 'POST',
				body: JSON.stringify({ token, newPassword })
			});
		} catch (err: unknown) {
			if (err instanceof ApiOfflineError) {
				this.isOffline = true;
				throw new Error('API is currently offline.');
			}
			if (err instanceof ApiError) {
				this.error = err.message;
			}
			throw err;
		}
	}
}

export const authState = new AuthStore();
