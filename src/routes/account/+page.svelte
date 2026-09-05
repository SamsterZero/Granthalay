<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	onMount(() => {
		goto(`${resolve('/settings')}#account`, { replaceState: true });
	});
</script>

<svelte:head>
	<title>Account & Security — Granthalay</title>
</svelte:head>

<div class="flex items-center justify-center py-12 text-muted-foreground">
	<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
</div>
