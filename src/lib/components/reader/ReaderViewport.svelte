<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import type { EpubChapter } from '$lib/epub/engine';
	import type { ReaderNavigation, ReaderPreferences } from '$lib/reader/preferences';

	let {
		loading,
		error,
		chapter,
		isCalculating,
		isNovelMode,
		typographyOverridesAllowed,
		preferences,
		activeReaderPadding,
		currentPage,
		navigation,
		contentContainer = $bindable(null),
		containerWidth = $bindable(0),
		scrollContainer = $bindable(null),
		onBack,
		onContentClick,
		onTouchStart,
		onTouchEnd,
		onWheel
	}: {
		loading: boolean;
		error: string | null;
		chapter: EpubChapter | undefined;
		isCalculating: boolean;
		isNovelMode: boolean;
		typographyOverridesAllowed: boolean;
		preferences: ReaderPreferences;
		activeReaderPadding: number;
		currentPage: number;
		navigation: ReaderNavigation;
		contentContainer?: HTMLElement | null;
		containerWidth?: number;
		scrollContainer?: HTMLElement | null;
		onBack: () => void;
		onContentClick: (event: MouseEvent) => void;
		onTouchStart: (event: TouchEvent) => void;
		onTouchEnd: (event: TouchEvent) => void;
		onWheel: (event: WheelEvent) => void;
	} = $props();
</script>

<main class="flex-1 overflow-hidden" aria-label="Book reader">
	{#if loading}
		<div class="flex h-full flex-col items-center justify-center p-8" role="status">
			<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
			<p class="text-lg text-muted-foreground">Loading EPUB...</p>
		</div>
	{:else if error}
		<div class="flex h-full items-center justify-center p-8">
			<Alert variant="destructive" class="max-w-md">
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>{error}</AlertDescription>
				<Button onclick={onBack} class="mt-4">Go Back</Button>
			</Alert>
		</div>
	{:else if chapter}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={scrollContainer}
			class="relative h-full bg-background"
			class:overflow-hidden={navigation !== 'scroll'}
			class:overflow-y-auto={navigation === 'scroll'}
			aria-label="Reading area"
			onclick={onContentClick}
			ontouchstart={onTouchStart}
			ontouchend={onTouchEnd}
			onwheel={onWheel}
		>
			{#if isCalculating}
				<div
					class="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs transition-opacity duration-200"
					role="status"
					aria-live="polite"
				>
					<div class="flex flex-col items-center gap-3">
						<div
							class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
						></div>
						<p class="animate-pulse text-xs font-medium text-muted-foreground">
							Arranging pages...
						</p>
					</div>
				</div>
			{/if}

			<div class="h-full w-full">
				{#if chapter.isCover}
					<div
						class="flex h-full w-full items-center justify-center bg-background transition-opacity duration-300"
						style:opacity={isCalculating ? 0 : 1}
					>
						<div
							class="cover-container m-0 flex h-full w-full items-center justify-center overflow-hidden p-0"
						>
							<!-- Content is sanitized by EpubEngine before it reaches the reader. -->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html chapter.content}
						</div>
					</div>
				{:else}
					<div class="flex w-full justify-center" class:h-full={navigation !== 'scroll'}>
						<div
							class="w-full max-w-3xl border-x border-border bg-background py-8 shadow-sm"
							class:h-full={navigation !== 'scroll'}
							class:overflow-hidden={navigation !== 'scroll'}
							style:padding-left={`${activeReaderPadding}px`}
							style:padding-right={`${activeReaderPadding}px`}
							bind:clientWidth={containerWidth}
						>
							<div
								class="w-full"
								class:h-full={navigation !== 'scroll'}
								style:transform={navigation === 'scroll'
									? 'none'
									: `translateX(-${currentPage * containerWidth}px)`}
								style:transition={navigation === 'scroll' || isCalculating
									? 'none'
									: 'transform 0.3s ease-in-out'}
								style:opacity={isCalculating ? 0 : 1}
							>
								<div
									bind:this={contentContainer}
									class="prose prose-lg max-w-none"
									class:h-full={navigation !== 'scroll'}
									class:is-novel-layout={isNovelMode && navigation !== 'scroll'}
									class:is-illustrated-layout={!isNovelMode}
									class:is-scroll-layout={navigation === 'scroll'}
									class:reader-font-override={typographyOverridesAllowed &&
										preferences.fontScale !== 1}
									class:reader-line-height-override={typographyOverridesAllowed &&
										preferences.lineHeight !== null}
									class:reader-align-left={typographyOverridesAllowed &&
										preferences.alignment === 'left'}
									class:reader-align-justify={typographyOverridesAllowed &&
										preferences.alignment === 'justify'}
									style:column-width={isNovelMode && navigation !== 'scroll'
										? `calc(${containerWidth}px - ${activeReaderPadding * 2}px)`
										: 'none'}
									style:column-gap={isNovelMode && navigation !== 'scroll'
										? `${activeReaderPadding * 2}px`
										: '0'}
									style:column-fill="auto"
									style:--reader-font-scale={`${preferences.fontScale * 100}%`}
									style:--reader-line-height={preferences.lineHeight ?? 1.6}
								>
									<!-- Content is sanitized by EpubEngine before it reaches the reader. -->
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html chapter.content}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</main>

<style>
	:global(.prose img, .epub-content img) {
		max-width: 100%;
		max-height: calc(100vh - 200px) !important;
		height: auto !important;
		width: auto !important;
		display: block;
		margin: 0 auto;
		border-radius: 0.5rem;
		object-fit: contain;
	}
	:global(.is-novel-layout .epub-content) {
		height: 100%;
		color: inherit;
	}
	:global(.is-scroll-layout .epub-content) {
		height: auto;
	}
	:global(.reader-font-override .epub-content) {
		font-size: var(--reader-font-scale) !important;
	}
	:global(.reader-font-override .epub-content :is(p, li, blockquote, td, th, figcaption)) {
		font-size: inherit !important;
	}
	:global(.reader-line-height-override .epub-content),
	:global(.reader-line-height-override .epub-content *) {
		line-height: var(--reader-line-height) !important;
	}
	:global(.reader-align-left .epub-content) {
		text-align: left !important;
	}
	:global(.reader-align-justify .epub-content) {
		text-align: justify !important;
	}
	:global(.is-illustrated-layout .epub-content) {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	:global(.epub-illustrated-page) {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		width: 100%;
		max-height: calc(100vh - 200px) !important;
		overflow: hidden;
	}
	:global(.epub-content svg),
	:global(.epub-illustrated-page img) {
		max-width: 100% !important;
		max-height: 100% !important;
		width: auto !important;
		height: auto !important;
	}
	:global(.prose p) {
		margin-bottom: 1rem;
		text-align: justify;
	}
	:global(.prose h1, .prose h2, .prose h3) {
		margin: 1.5rem 0 1rem 0;
		break-after: avoid;
	}
	:global(.prose > *) {
		break-inside: avoid;
	}
	:global(.prose) {
		color: inherit;
	}
	:global(.dark .prose),
	:global(.dark .prose *),
	:global(.dark .epub-content *) {
		color: hsl(var(--foreground)) !important;
	}
</style>
