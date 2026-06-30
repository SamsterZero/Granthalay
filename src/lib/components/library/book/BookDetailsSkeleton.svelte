<script>
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
	<!-- Left Panel Skeleton -->
	<div
		class="lg:w-1/3 lg:max-w-md lg:h-full lg:min-h-0 relative overflow-hidden lg:border-r p-6 lg:p-8"
	>
		<div class="max-w-sm mx-auto lg:mx-0">
			<Skeleton class="aspect-2/3 max-w-[240px] mx-auto rounded-lg mb-6" />
			<Skeleton class="h-8 w-3/4 mb-2" />
			<Skeleton class="h-4 w-1/2 mb-4" />
			<Skeleton class="h-20 w-full" />
		</div>
	</div>
	<!-- Right Panel Skeleton -->
	<div class="flex-1 lg:h-full overflow-hidden flex flex-col bg-muted/30">
		<div class="p-6 border-b bg-background">
			<Skeleton class="h-10 w-32" />
		</div>
		<div class="flex-1 p-6 space-y-4">
			{#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
				<div class="flex items-center gap-4">
					<Skeleton class="h-12 w-full rounded-lg" />
				</div>
			{/each}
		</div>
	</div>
</div>
