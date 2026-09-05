<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, WifiOff, UserCheck } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { authState } from '$lib/api/auth.svelte';

	let { children } = $props();

	onMount(() => {
		authState.checkSession();
	});
</script>

<div class="min-h-screen bg-background text-foreground">
	<header class="border-b border-border bg-card">
		<div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
			<a
				href="/"
				class="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft size={18} />
				Back to Library
			</a>
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded bg-[#0D5C63] text-white">
					<span class="text-sm font-semibold">ग्रं</span>
				</div>
				<span class="font-semibold">Granthalay Account</span>
			</div>
		</div>
	</header>

	{#if authState.isOffline}
		<div
			class="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-900 dark:text-amber-200"
		>
			<div class="mx-auto flex max-w-4xl items-center gap-3">
				<WifiOff size={20} class="shrink-0 text-amber-600 dark:text-amber-400" />
				<div class="text-xs sm:text-sm">
					<span class="font-semibold">Backend API Offline:</span> Granthalay account features are
					temporarily unreachable.
					<strong class="font-medium text-amber-950 dark:text-amber-100">
						Your EPUB imports, bookmarks, reading history, and highlights remain 100% local and
						fully accessible.
					</strong>
				</div>
			</div>
		</div>
	{/if}

	<main class="mx-auto max-w-4xl px-4 py-8 pb-24">
		{@render children()}
	</main>
</div>
