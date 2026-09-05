<script lang="ts">
	import { authState } from '$lib/api/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import {
		User,
		ShieldCheck,
		ShieldAlert,
		LogOut,
		Laptop,
		CheckCircle2,
		KeyRound,
		WifiOff
	} from 'lucide-svelte';

	let revoking = $state(false);
	let revokeSuccess = $state<string | null>(null);
	let revokeError = $state<string | null>(null);

	async function handleSignOut() {
		await authState.signOut();
	}

	async function handleRevokeAll() {
		revoking = true;
		revokeSuccess = null;
		revokeError = null;
		try {
			await authState.revokeAllSessions();
			revokeSuccess = 'All other active sessions have been revoked.';
		} catch (err: unknown) {
			revokeError = err instanceof Error ? err.message : 'Failed to revoke sessions';
		} finally {
			revoking = false;
		}
	}
</script>

<div class="space-y-6 px-4 pb-4">
	<div>
		<h2 class="text-base font-semibold">Account & Security</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Manage your Granthalay session, account details, and security.
		</p>
	</div>

	{#if authState.isOffline}
		<div
			class="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200"
		>
			<WifiOff size={20} class="shrink-0 text-amber-600 dark:text-amber-400" />
			<div class="text-xs sm:text-sm">
				<span class="font-semibold">Backend API Offline:</span> Account features are temporarily
				unreachable.
				<strong class="font-medium text-amber-950 dark:text-amber-100">
					Your EPUB imports, bookmarks, reading history, and highlights remain 100% local and
					fully accessible.
				</strong>
			</div>
		</div>
	{/if}

	{#if authState.isLoading}
		<div class="flex items-center justify-center py-12 text-muted-foreground">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
		</div>
	{:else if authState.user}
		<Card class="border-border">
			<CardHeader>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div
							class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
						>
							<User size={24} />
						</div>
						<div>
							<CardTitle>{authState.user.displayName || authState.user.email}</CardTitle>
							<CardDescription>{authState.user.email}</CardDescription>
						</div>
					</div>
					{#if authState.user.emailVerified}
						<Badge
							variant="outline"
							class="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
						>
							<ShieldCheck size={14} />
							Verified
						</Badge>
					{:else}
						<Badge
							variant="outline"
							class="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
						>
							<ShieldAlert size={14} />
							Unverified Email
						</Badge>
					{/if}
				</div>
			</CardHeader>
			<CardContent class="space-y-4">
				{#if !authState.user.emailVerified}
					<div
						class="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 sm:text-sm dark:text-amber-200"
					>
						<span>Your email is not verified yet.</span>
						<a
							href="/account/verify-email"
							class="font-medium underline hover:text-amber-950 dark:hover:text-amber-100"
						>
							Verify Email
						</a>
					</div>
				{/if}

				<div class="grid gap-2 border-t border-border pt-4 text-sm">
					<div class="flex justify-between py-1">
						<span class="text-muted-foreground">User ID</span>
						<span class="font-mono text-xs">{authState.user.id}</span>
					</div>
					{#if authState.user.createdAt}
						<div class="flex justify-between py-1">
							<span class="text-muted-foreground">Account Created</span>
							<span>{new Date(authState.user.createdAt).toLocaleDateString()}</span>
						</div>
					{/if}
				</div>
			</CardContent>
			<CardFooter class="flex justify-between border-t border-border pt-4">
				<a href="/account/password-reset">
					<Button variant="outline" size="sm" class="gap-1.5">
						<KeyRound size={16} />
						Reset Password
					</Button>
				</a>
				<Button variant="destructive" size="sm" onclick={handleSignOut} class="gap-1.5">
					<LogOut size={16} />
					Sign Out
				</Button>
			</CardFooter>
		</Card>

		<!-- Active Sessions -->
		<Card class="border-border">
			<CardHeader>
				<div class="flex items-center justify-between">
					<div>
						<CardTitle class="text-lg">Active Sessions</CardTitle>
						<CardDescription
							>Sessions logged into your Granthalay account across devices.</CardDescription
						>
					</div>
					{#if authState.sessions.length > 1}
						<Button
							variant="outline"
							size="sm"
							onclick={handleRevokeAll}
							disabled={revoking || authState.isOffline}
						>
							{revoking ? 'Revoking...' : 'Revoke Other Sessions'}
						</Button>
					{/if}
				</div>
			</CardHeader>
			<CardContent class="space-y-3">
				{#if revokeSuccess}
					<p class="text-xs text-emerald-600 dark:text-emerald-400">{revokeSuccess}</p>
				{/if}
				{#if revokeError}
					<p class="text-xs text-destructive">{revokeError}</p>
				{/if}

				{#if authState.sessions.length === 0}
					<p class="text-sm text-muted-foreground">Current session is active.</p>
				{:else}
					<div class="divide-y divide-border rounded-lg border border-border">
						{#each authState.sessions as session}
							<div class="flex items-center justify-between p-3 text-sm">
								<div class="flex items-center gap-3">
									<Laptop size={18} class="text-muted-foreground" />
									<div>
										<div class="font-medium">
											{session.userAgent || 'Unknown Device'}
											{#if session.current}
												<Badge variant="secondary" class="ml-2 text-[10px]">This Device</Badge>
											{/if}
										</div>
										{#if session.ipAddress}
											<div class="text-xs text-muted-foreground">IP: {session.ipAddress}</div>
										{/if}
									</div>
								</div>
								{#if session.lastSeenAt}
									<span class="text-xs text-muted-foreground">
										{new Date(session.lastSeenAt).toLocaleString()}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	{:else}
		<Card class="border-border">
			<CardHeader>
				<CardTitle>Sign In or Register</CardTitle>
				<CardDescription>
					Create an optional account to manage secure sessions and prepare for cross-device
					features.
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="flex flex-col gap-3 sm:flex-row">
					<a href="/account/sign-in" class="flex-1">
						<Button class="w-full bg-[#0D5C63] text-white hover:bg-[#094A50]">Sign In</Button>
					</a>
					<a href="/account/register" class="flex-1">
						<Button variant="outline" class="w-full">Create Account</Button>
					</a>
				</div>

				<div
					class="space-y-2 rounded-lg border border-border bg-muted p-4 text-xs text-muted-foreground sm:text-sm"
				>
					<div class="flex items-center gap-2 font-semibold text-foreground">
						<CheckCircle2 size={16} class="text-emerald-500" />
						Local-First Reader Guarantee
					</div>
					<p>
						Your imported EPUB books, reading progress, highlights, and bookmarks remain 100% stored
						on your device in your browser. An account is completely optional and never required for
						reading.
					</p>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
