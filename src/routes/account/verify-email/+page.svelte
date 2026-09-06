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
	import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-svelte';

	let token = $state('');
	let verifying = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	onMount(() => {
		const paramToken = page.url.searchParams.get('token');
		if (paramToken) {
			token = paramToken;
			executeVerification(paramToken);
		}
	});

	async function executeVerification(tokenToVerify: string) {
		if (!tokenToVerify) return;
		verifying = true;
		errorMessage = null;
		successMessage = null;

		try {
			await authState.verifyEmail(tokenToVerify);
			successMessage = 'Your email address has been verified successfully!';
		} catch (err: unknown) {
			if (err instanceof Error) {
				errorMessage = err.message;
			} else {
				errorMessage = 'Failed to verify email token.';
			}
		} finally {
			verifying = false;
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		executeVerification(token);
	}
</script>

<svelte:head>
	<title>Verify Email — Granthalay</title>
</svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<Card class="border-border">
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<ShieldCheck size={20} />
				Email Verification
			</CardTitle>
			<CardDescription>Confirm your email address token.</CardDescription>
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
				<a href="/account">
					<Button class="w-full bg-[#0D5C63] text-white hover:bg-[#094A50]">Back to Account</Button>
				</a>
			{:else}
				{#if errorMessage}
					<Alert variant="destructive">
						<AlertCircle size={16} />
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				{/if}

				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="space-y-2">
						<Label for="token">Verification Token</Label>
						<Input
							id="token"
							type="text"
							placeholder="Paste token from verification email"
							bind:value={token}
							required
							disabled={verifying}
						/>
					</div>

					<Button
						type="submit"
						class="w-full bg-[#0D5C63] text-white hover:bg-[#094A50]"
						disabled={verifying || !token || authState.isOffline}
					>
						{verifying ? 'Verifying...' : 'Verify Email'}
					</Button>
				</form>
			{/if}
		</CardContent>
	</Card>
</div>
