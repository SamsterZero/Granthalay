<script lang="ts">
	import { Download, Moon, Sun } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		darkMode: boolean;
		showInstall: boolean;
		onTheme: () => void;
		onInstall: () => void;
	}

	let { darkMode, showInstall, onTheme, onInstall }: Props = $props();
</script>

<nav class="mb-4 flex items-center justify-between text-foreground">
	<div class="flex h-10 w-10 items-center justify-center rounded bg-[#0D5C63]">
		<span class="font-semibold text-white">ग्रं</span>
	</div>
	<div class="flex items-center gap-3">
		{#if showInstall}
			<Button
				class="cursor-pointer rounded-full bg-[#0D5C63] text-white hover:bg-[#094A50]"
				onclick={onInstall}
			>
				<Download size={20} />
			</Button>
		{/if}
		<Button
			variant="outline"
			size="icon"
			class="cursor-pointer rounded-full"
			onclick={onTheme}
			title="Toggle theme"
		>
			{#if darkMode}
				<Sun size={20} />
			{:else}
				<Moon size={20} />
			{/if}
		</Button>
	</div>
</nav>
