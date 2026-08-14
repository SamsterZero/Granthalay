<script lang="ts">
	interface Props {
		coverUrl: string | null;
		title: string;
		author: string;
		description: string;
	}
	let { coverUrl, title, author, description }: Props = $props();
	function getInitials(name: string): string {
		return name.charAt(0).toUpperCase();
	}
</script>

<div class="relative overflow-hidden lg:h-full lg:min-h-0 lg:w-1/3 lg:max-w-md lg:border-r">
	{#if coverUrl}
		<!-- Blurred background -->
		<div class="absolute inset-0">
			<img src={coverUrl} alt="" class="h-full w-full object-cover blur" />
			<div
				class="absolute inset-0 bg-linear-to-b from-transparent via-background/80 to-background"
			></div>
		</div>
	{:else}
		<div class="absolute inset-0 bg-linear-to-br from-[#0D5C63] to-[#094a50]"></div>
	{/if}
	<!-- Content -->
	<div class="relative z-10 h-full overflow-y-auto p-6 lg:p-8">
		<div class="mx-auto max-w-sm lg:mx-0">
			<div class="mx-auto mb-6 aspect-2/3 max-w-[240px] overflow-hidden rounded-lg shadow-lg">
				{#if coverUrl}
					<img src={coverUrl} alt={title} class="h-full w-full object-cover" />
				{:else}
					<div
						class="flex h-full w-full items-center justify-center bg-linear-to-br from-[#0D5C63] to-[#094a50] text-5xl font-bold text-white"
					>
						{getInitials(title)}
					</div>
				{/if}
			</div>
			<h2 class="mb-2 text-xl font-bold">{title}</h2>
			{#if author}
				<p class="mb-4 text-muted-foreground">by {author}</p>
			{/if}
			{#if description}
				<p class="text-sm leading-relaxed text-muted-foreground">{description}</p>
			{/if}
		</div>
	</div>
</div>
