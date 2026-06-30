<script lang="ts">
	import { Grid2x2, Grid3x3, List, Plus } from 'lucide-svelte';
	import { ButtonGroup } from '../ui/button-group';
	import { Button } from '../ui/button';

	type ViewMode = 'list' | 'compact' | 'comfortable';

	interface Props {
		viewMode: ViewMode;
		fileInput?: HTMLInputElement;
		setViewMode: (vieMode: ViewMode) => void;
		handleFileUpload: (event: Event) => void;
	}

	let { viewMode, fileInput, setViewMode, handleFileUpload }: Props = $props();
</script>

<div class="pb-4 flex justify-between">
	<ButtonGroup aria-label="Button group">
		<Button
			variant={viewMode === 'list' ? 'default' : 'secondary'}
			// disabled={viewMode === 'list'}
			onclick={() => setViewMode('list')}
		>
			<List size={20} />
		</Button>
		<Button
			variant={viewMode === 'comfortable' ? 'default' : 'secondary'}
			// disabled={viewMode === 'comfortable'}
			onclick={() => setViewMode('comfortable')}
		>
			<Grid2x2 size={20} />
		</Button>
		<Button
			variant={viewMode === 'compact' ? 'default' : 'secondary'}
			// disabled={viewMode === 'compact'}
			onclick={() => setViewMode('compact')}
		>
			<Grid3x3 size={20} />
		</Button>
	</ButtonGroup>
	<div>
		<input
			type="file"
			accept=".epub"
			class="hidden"
			style="display: none;"
			bind:this={fileInput}
			onchange={handleFileUpload}
		/>
		<Button
			variant="default"
			size="icon"
			class="rounded-full cursor-pointer"
			onclick={() => fileInput?.click()}
			title="Upload EPUB"
		>
			<Plus size={20} />
		</Button>
	</div>
</div>

<style>
	.selected {
		background: var(--accent);
		color: var(--accent-foreground);
	}
</style>
