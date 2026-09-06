<script lang="ts">
	import { goto } from '$app/navigation';
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
	import { LogIn, AlertCircle } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!email || !password) {
			errorMessage = 'Please enter both email and password.';
			return;
		}

		submitting = true;
		errorMessage = null;

		try {
			await authState.signIn(email, password);
			goto('/account');
		} catch (err: unknown) {
			if (err instanceof Error) {
				errorMessage = err.message;
			} else {
				errorMessage = 'An unexpected error occurred during sign in.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign In — Granthalay</title>
</svelte:head>

<div class="mx-auto max-w-md space-y-6">
	<Card class="border-border">
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<LogIn size={20} />
				Sign In
			</CardTitle>
			<CardDescription>Sign into your Granthalay account.</CardDescription>
		</CardHeader>
		<form onsubmit={handleSubmit}>
			<CardContent class="space-y-4">
				{#if errorMessage}
					<Alert variant="destructive">
						<AlertCircle size={16} />
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				{/if}

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
					<div class="flex items-center justify-between">
						<Label for="password">Password</Label>
						<a href="/account/password-reset" class="text-xs text-primary hover:underline">
							Forgot password?
						</a>
					</div>
					<Input
						id="password"
						type="password"
						placeholder="••••••••"
						bind:value={password}
						required
						autocomplete="current-password"
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
					{submitting ? 'Signing in...' : 'Sign In'}
				</Button>

				<div class="text-center text-xs text-muted-foreground">
					Don't have an account?
					<a href="/account/register" class="font-medium text-primary hover:underline">
						Create one
					</a>
				</div>
			</CardFooter>
		</form>
	</Card>
</div>
