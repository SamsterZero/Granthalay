<script lang="ts">
	import { authState } from '$lib/api/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter
	} from '$lib/components/ui/card';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { UserPlus, AlertCircle, CheckCircle2 } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!email || !password) {
			errorMessage = 'Email and password are required.';
			return;
		}

		if (password.length < 8) {
			errorMessage = 'Password must be at least 8 characters long.';
			return;
		}

		submitting = true;
		errorMessage = null;
		successMessage = null;

		try {
			await authState.register(email, password, displayName || undefined);
			successMessage =
				'Account created successfully! Please check your email to verify your address.';
		} catch (err: unknown) {
			if (err instanceof Error) {
				errorMessage = err.message;
			} else {
				errorMessage = 'An error occurred during registration.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Create Account — Granthalay</title>
</svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<Card class="border-border">
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<UserPlus size={20} />
				Create Account
			</CardTitle>
			<CardDescription>Register a new Granthalay account.</CardDescription>
		</CardHeader>
		{#if successMessage}
			<CardContent class="space-y-4">
				<div
					class="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-200"
				>
					<CheckCircle2 size={20} class="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
					<div class="space-y-1 text-sm">
						<p class="font-medium">{successMessage}</p>
						<p class="text-xs opacity-90">
							Once verified, you can sign in to manage sessions. Your reader remain 100% local.
						</p>
					</div>
				</div>
				<div class="flex gap-2">
					<a href="/account/sign-in" class="flex-1">
						<Button class="w-full bg-[#0D5C63] text-white hover:bg-[#094A50]">Go to Sign In</Button>
					</a>
				</div>
			</CardContent>
		{:else}
			<form onsubmit={handleSubmit}>
				<CardContent class="space-y-4">
					{#if errorMessage}
						<Alert variant="destructive">
							<AlertCircle size={16} />
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					{/if}

					<div class="space-y-2">
						<Label for="displayName">Display Name (optional)</Label>
						<Input
							id="displayName"
							type="text"
							placeholder="Reader Name"
							bind:value={displayName}
							disabled={submitting}
						/>
					</div>

					<div class="space-y-2">
						<Label for="email">Email address</Label>
						<Input
							id="email"
							type="email"
							placeholder="name@example.com"
							bind:value={email}
							required
							autocomplete="email"
							disabled={submitting}
						/>
					</div>

					<div class="space-y-2">
						<Label for="password">Password (min 8 characters)</Label>
						<Input
							id="password"
							type="password"
							placeholder="••••••••"
							bind:value={password}
							required
							minlength={8}
							autocomplete="new-password"
							disabled={submitting}
						/>
					</div>
				</CardContent>
				<CardFooter class="flex flex-col gap-3">
					<Button
						type="submit"
						class="w-full bg-[#0D5C63] text-white hover:bg-[#094A50]"
						disabled={submitting || authState.isOffline}
					>
						{submitting ? 'Creating account...' : 'Create Account'}
					</Button>

					<div class="text-center text-xs text-muted-foreground">
						Already have an account?
						<a href="/account/sign-in" class="font-medium text-primary hover:underline">
							Sign in
						</a>
					</div>
				</CardFooter>
			</form>
		{/if}
	</Card>
</div>
