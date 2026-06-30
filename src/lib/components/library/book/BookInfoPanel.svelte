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

<div class="lg:w-1/3 lg:max-w-md lg:h-full lg:min-h-0 relative overflow-hidden lg:border-r">
	{#if coverUrl}
		<!-- Blurred background -->
		<div class="absolute inset-0">
			<img src={coverUrl} alt="" class="w-full h-full object-cover blur" />
			<div
				class="absolute inset-0 bg-linear-to-b from-transparent via-background/80 to-background"
			></div>
		</div>
	{:else}
		<div class="absolute inset-0 bg-linear-to-br from-[#0D5C63] to-[#094a50]"></div>
	{/if}
	<!-- Content -->
	<div class="relative z-10 p-6 lg:p-8 h-full overflow-y-auto">
		<div class="max-w-sm mx-auto lg:mx-0">
			<div class="aspect-2/3 max-w-[240px] mx-auto rounded-lg overflow-hidden shadow-lg mb-6">
				{#if coverUrl}
					<img src={coverUrl} alt={title} class="w-full h-full object-cover" />
				{:else}
					<div
						class="w-full h-full flex items-center justify-center bg-linear-to-br from-[#0D5C63] to-[#094a50] text-white text-5xl font-bold"
					>
						{getInitials(title)}
					</div>
				{/if}
			</div>
			<h2 class="text-xl font-bold mb-2">{title}</h2>
			{#if author}
				<p class="text-muted-foreground mb-4">by {author}</p>
			{/if}
			{#if description}
				<p class="text-sm text-muted-foreground leading-relaxed">{description}</p>
			{/if}
		</div>
	</div>
</div>
