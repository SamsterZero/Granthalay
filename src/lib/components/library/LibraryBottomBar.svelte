<script lang="ts">
	import { Bookmark, Library, Settings } from 'lucide-svelte';

	let {
		active,
		annotationCount = 0,
		onOpenLibrary,
		onOpenAnnotations,
		onOpenSettings
	}: {
		active: 'library' | 'annotations' | 'settings';
		annotationCount?: number;
		onOpenLibrary: () => void;
		onOpenAnnotations: () => void;
		onOpenSettings: () => void;
	} = $props();
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.08)] backdrop-blur"
	aria-label="Application navigation"
>
	<div class="mx-auto flex max-w-md items-stretch justify-around">
		<button
			type="button"
			class="flex min-w-24 flex-col items-center gap-1 rounded-md px-4 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
			class:text-primary={active === 'library'}
			class:text-muted-foreground={active !== 'library'}
			onclick={onOpenLibrary}
			aria-current={active === 'library' ? 'page' : undefined}
		>
			<Library class="h-5 w-5" aria-hidden="true" />
			Library
		</button>

		<button
			type="button"
			class="flex min-w-24 flex-col items-center gap-1 rounded-md px-4 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
			class:text-primary={active === 'annotations'}
			class:text-muted-foreground={active !== 'annotations'}
			onclick={onOpenAnnotations}
			aria-current={active === 'annotations' ? 'page' : undefined}
		>
			<span class="relative">
				<Bookmark class="h-5 w-5" aria-hidden="true" />
				{#if annotationCount > 0}
					<span
						class="absolute -top-2 -right-3 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground"
						aria-hidden="true"
					>
						{annotationCount}
					</span>
				{/if}
			</span>
			Annotations
			<span class="sr-only">, {annotationCount} saved</span>
		</button>

		<button
			type="button"
			class="flex min-w-24 flex-col items-center gap-1 rounded-md px-4 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
			class:text-primary={active === 'settings'}
			class:text-muted-foreground={active !== 'settings'}
			onclick={onOpenSettings}
			aria-current={active === 'settings' ? 'page' : undefined}
		>
			<Settings class="h-5 w-5" aria-hidden="true" />
			Settings
		</button>
	</div>
</nav>
