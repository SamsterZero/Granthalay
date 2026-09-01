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

<div class="flex justify-between pb-4">
	<ButtonGroup aria-label="Library view">
		<Button
			variant={viewMode === 'list' ? 'default' : 'secondary'}
			// disabled={viewMode === 'list'}
			onclick={() => setViewMode('list')}
			aria-label="List view"
			aria-pressed={viewMode === 'list'}
		>
			<List size={20} />
		</Button>
		<Button
			variant={viewMode === 'comfortable' ? 'default' : 'secondary'}
			// disabled={viewMode === 'comfortable'}
			onclick={() => setViewMode('comfortable')}
			aria-label="Comfortable grid view"
			aria-pressed={viewMode === 'comfortable'}
		>
			<Grid2x2 size={20} />
		</Button>
		<Button
			variant={viewMode === 'compact' ? 'default' : 'secondary'}
			// disabled={viewMode === 'compact'}
			onclick={() => setViewMode('compact')}
			aria-label="Compact grid view"
			aria-pressed={viewMode === 'compact'}
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
			aria-label="Choose EPUB to import"
			bind:this={fileInput}
			onchange={handleFileUpload}
		/>
		<Button
			variant="default"
			size="icon"
			class="cursor-pointer rounded-full"
			onclick={() => fileInput?.click()}
			title="Upload EPUB"
			aria-label="Import EPUB"
		>
			<Plus size={20} />
		</Button>
	</div>
</div>
