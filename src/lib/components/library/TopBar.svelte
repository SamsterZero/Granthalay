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

<nav class="flex items-center justify-between mb-4 text-foreground">
	<div class="w-10 h-10 rounded bg-[#0D5C63] flex items-center justify-center">
		<span class="text-white font-semibold">ग्रं</span>
	</div>
	<div class="flex items-center gap-3">
		{#if showInstall}
			<Button
				class="bg-[#0D5C63] text-white rounded-full hover:bg-[#094A50] cursor-pointer"
				onclick={onInstall}
			>
				<Download size={20} />
			</Button>
		{/if}
		<Button
			variant="outline"
			size="icon"
			class="rounded-full cursor-pointer"
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
