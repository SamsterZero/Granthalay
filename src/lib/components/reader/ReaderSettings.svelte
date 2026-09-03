<script lang="ts">
	import { Bookmark, SlidersHorizontal } from 'lucide-svelte';
	import ReaderAnnotations from './ReaderAnnotations.svelte';
	import ReaderAppearance from './ReaderAppearance.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import type { BookAnnotation } from '$lib/reader/annotations';
	import type { ReaderPreferences } from '$lib/reader/preferences';

	let {
		preferences,
		annotations,
		onUpdatePreferences,
		onResetPreferences,
		onNavigateAnnotation,
		onRemoveAnnotation
	}: {
		preferences: ReaderPreferences;
		annotations: BookAnnotation[];
		onUpdatePreferences: (update: Partial<ReaderPreferences>) => void;
		onResetPreferences: () => void;
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
			<ReaderAnnotations
				{annotations}
				onNavigate={onNavigateAnnotation}
				onRemove={onRemoveAnnotation}
				embedded
			/>
		</Tabs.Content>
	</Tabs.Root>
</section>
