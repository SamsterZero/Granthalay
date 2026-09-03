<script lang="ts">
	import { Bookmark, SlidersHorizontal } from 'lucide-svelte';
	import ReaderAnnotations from './ReaderAnnotations.svelte';
	import ReaderAppearance from './ReaderAppearance.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tabs from '$lib/components/ui/tabs';
	import type { BookAnnotation } from '$lib/reader/annotations';
	import type { ReaderPreferences } from '$lib/reader/preferences';

	let {
		preferences,
		annotations,
		bookmarked,
		onUpdatePreferences,
		onResetPreferences,
		onToggleBookmark,
		onNavigateAnnotation,
		onRemoveAnnotation
	}: {
		preferences: ReaderPreferences;
		annotations: BookAnnotation[];
		bookmarked: boolean;
		onUpdatePreferences: (update: Partial<ReaderPreferences>) => void;
		onResetPreferences: () => void;
		onToggleBookmark: () => void;
		onNavigateAnnotation: (annotation: BookAnnotation) => void;
		onRemoveAnnotation: (annotation: BookAnnotation) => void;
	} = $props();
</script>

<section id="reader-settings" class="z-40 border-b border-border bg-background shadow-sm">
	<Tabs.Root value="appearance" class="gap-0">
		<div class="border-b border-border px-4 pt-3">
			<Tabs.List aria-label="Reader settings sections">
				<Tabs.Trigger value="appearance">
					<SlidersHorizontal data-icon="inline-start" /> Appearance
				</Tabs.Trigger>
				<Tabs.Trigger value="annotations">
					<Bookmark data-icon="inline-start" /> Annotations
					{#if annotations.length > 0}
						<span class="text-xs tabular-nums" aria-label={`${annotations.length} saved`}>
							{annotations.length}
						</span>
					{/if}
				</Tabs.Trigger>
			</Tabs.List>
		</div>

		<Tabs.Content value="appearance">
			<ReaderAppearance
				{preferences}
				onUpdate={onUpdatePreferences}
				onReset={onResetPreferences}
				resetLabel="Use global defaults"
				heading="Reading appearance"
				embedded
			/>
		</Tabs.Content>

		<Tabs.Content value="annotations" class="p-4">
			<div class="mx-auto max-w-3xl">
				<Button
					variant={bookmarked ? 'secondary' : 'outline'}
					onclick={onToggleBookmark}
					aria-pressed={bookmarked}
				>
					<Bookmark class="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
					{bookmarked ? 'Remove bookmark here' : 'Bookmark current location'}
				</Button>
			</div>
			<ReaderAnnotations
				{annotations}
				onNavigate={onNavigateAnnotation}
				onRemove={onRemoveAnnotation}
				embedded
			/>
		</Tabs.Content>
	</Tabs.Root>
</section>
