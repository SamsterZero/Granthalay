<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { authState } from '$lib/api/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-svelte';

	let token = $state('');
	let email = $state('');
	let newPassword = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	onMount(() => {
		const paramToken = page.url.searchParams.get('token');
		if (paramToken) {
			token = paramToken;
		}
	});

	async function handleRequestReset(e: SubmitEvent) {
		e.preventDefault();
		if (!email) return;

		submitting = true;
		errorMessage = null;
		successMessage = null;

		try {
			await authState.requestPasswordReset(email);
			successMessage =
				'If an account exists for that email, password reset instructions have been sent.';
		} catch (err: unknown) {
			if (err instanceof Error) {
				errorMessage = err.message;
			} else {
				errorMessage = 'Failed to request password reset.';
			}
		} finally {
			submitting = false;
		}
	}

	async function handleResetPassword(e: SubmitEvent) {
		e.preventDefault();
		if (!token || !newPassword) return;

		if (newPassword.length < 8) {
			errorMessage = 'New password must be at least 8 characters long.';
			return;
		}

		submitting = true;
		errorMessage = null;
		successMessage = null;

		try {
			await authState.resetPassword(token, newPassword);
			successMessage = 'Your password has been reset successfully. You can now sign in.';
		} catch (err: unknown) {
			if (err instanceof Error) {
				errorMessage = err.message;
			} else {
				errorMessage = 'Failed to reset password.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password — Granthalay</title>
</svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<Card class="border-border">
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<KeyRound size={20} />
				Reset Password
			</CardTitle>
			<CardDescription>
				{#if token}
					Enter your new password below.
				{:else}
					Request a password reset link for your Granthalay account.
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if successMessage}
				<div
					class="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-200"
				>
					<CheckCircle2 size={20} class="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
					<div class="space-y-1 text-sm">
						<p class="font-medium">{successMessage}</p>
					</div>
				</div>
				<a href="/account/sign-in">
					<Button class="w-full bg-[#0D5C63] text-white hover:bg-[#094A50]">Go to Sign In</Button>
				</a>
			{:else}
				{#if errorMessage}
					<Alert variant="destructive">
						<AlertCircle size={16} />
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				{/if}

				{#if token}
					<form onsubmit={handleResetPassword} class="space-y-4">
						<div class="space-y-2">
							<Label for="token">Reset Token</Label>
							<Input id="token" type="text" bind:value={token} required disabled={submitting} />
						</div>

						<div class="space-y-2">
							<Label for="newPassword">New Password (min 8 characters)</Label>
							<Input
								id="newPassword"
								type="password"
								placeholder="••••••••"
								bind:value={newPassword}
								required
								minlength={8}
								disabled={submitting}
							/>
						</div>

						<Button
							type="submit"
							class="w-full bg-[#0D5C63] text-white hover:bg-[#094A50]"
							disabled={submitting || authState.isOffline}
						>
							{submitting ? 'Resetting password...' : 'Set New Password'}
						</Button>
					</form>
				{:else}
					<form onsubmit={handleRequestReset} class="space-y-4">
						<div class="space-y-2">
							<Label for="email">Account Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="name@example.com"
								bind:value={email}
								required
								disabled={submitting}
							/>
						</div>

						<Button
							type="submit"
							class="w-full bg-[#0D5C63] text-white hover:bg-[#094A50]"
							disabled={submitting || authState.isOffline}
						>
							{submitting ? 'Sending instructions...' : 'Send Reset Link'}
						</Button>
					</form>
				{/if}
			{/if}
		</CardContent>
	</Card>
</div>
