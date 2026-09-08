<script lang="ts">
	import { Bookmark, Library, ShoppingBag, User } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let {
		active,
		annotationCount = 0,
		onOpenLibrary = () => goto(resolve('/')),
		onOpenStore = () => goto(resolve('/store')),
		onOpenAnnotations = () => goto(resolve('/annotations')),
		onOpenSettings = () => goto(resolve('/settings'))
	}: {
		active: 'library' | 'store' | 'annotations' | 'settings' | 'account';
		annotationCount?: number;
		onOpenLibrary?: () => void;
		onOpenStore?: () => void;
		onOpenAnnotations?: () => void;
		onOpenSettings?: () => void;
	} = $props();
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.08)] backdrop-blur"
	aria-label="Application navigation"
>
	<div class="mx-auto flex max-w-md items-stretch justify-around">
		<button
			type="button"
			class="flex min-w-16 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
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
			class="flex min-w-16 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
			class:text-primary={active === 'store'}
			class:text-muted-foreground={active !== 'store'}
			onclick={onOpenStore}
			aria-current={active === 'store' ? 'page' : undefined}
		>
			<ShoppingBag class="h-5 w-5" aria-hidden="true" />
			Store
		</button>

		<button
			type="button"
			class="flex min-w-16 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
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
			class="flex min-w-16 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
			class:text-primary={active === 'settings' || active === 'account'}
			class:text-muted-foreground={active !== 'settings' && active !== 'account'}
			onclick={onOpenSettings}
			aria-current={active === 'settings' || active === 'account' ? 'page' : undefined}
		>
			<User class="h-5 w-5" aria-hidden="true" />
			Profile
		</button>
	</div>
</nav>
