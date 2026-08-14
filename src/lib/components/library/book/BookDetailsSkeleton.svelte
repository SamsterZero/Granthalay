<script>
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
	<!-- Left Panel Skeleton -->
	<div
		class="relative overflow-hidden p-6 lg:h-full lg:min-h-0 lg:w-1/3 lg:max-w-md lg:border-r lg:p-8"
	>
		<div class="mx-auto max-w-sm lg:mx-0">
			<Skeleton class="mx-auto mb-6 aspect-2/3 max-w-[240px] rounded-lg" />
			<Skeleton class="mb-2 h-8 w-3/4" />
			<Skeleton class="mb-4 h-4 w-1/2" />
			<Skeleton class="h-20 w-full" />
		</div>
	</div>
	<!-- Right Panel Skeleton -->
	<div class="flex flex-1 flex-col overflow-hidden bg-muted/30 lg:h-full">
		<div class="border-b bg-background p-6">
			<Skeleton class="h-10 w-32" />
		</div>
		<div class="flex-1 space-y-4 p-6">
			{#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
				<div class="flex items-center gap-4">
					<Skeleton class="h-12 w-full rounded-lg" />
				</div>
			{/each}
		</div>
	</div>
</div>
