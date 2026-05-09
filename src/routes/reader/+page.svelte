<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import sanitizeHtml from 'sanitize-html';
	import { SvelteMap } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let bookTitle = $state('Unknown Book');
	let currentChapter = $state(0);
	let chapters = $state<Array<{ title: string; href: string; content: string; css: string }>>([]);
	let chapterCSS = $state('');
	let currentPage = $state(0);
	let totalPages = $state(0);
	
	let contentContainer = $state<HTMLElement | null>(null);
	let containerWidth = $state(0);
	let jumpToLastPage = $state(false);

	onMount(async () => {
		try {
			// Load the EPUB file
			const response = await fetch('/books/pg78627-images-3.epub');
			if (!response.ok) {
				throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			const zip = await import('jszip');
			const epub = await zip.default.loadAsync(arrayBuffer);

			// Parse the container.xml to find the OPF file
			const containerXml = await epub.file('META-INF/container.xml')?.async('string');
			if (!containerXml) {
				throw new Error('Invalid EPUB: No container.xml found');
			}

			// Extract OPF file path from container.xml
			const parser = new DOMParser();
			const containerDoc = parser.parseFromString(containerXml, 'application/xml');
			const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
			if (!rootfilePath) {
				throw new Error('Invalid EPUB: No rootfile found');
			}

			// Parse the OPF file to get metadata and spine
			const opfContent = await epub.file(rootfilePath)?.async('string');
			if (!opfContent) {
				throw new Error('Invalid EPUB: No OPF file found');
			}

			const opfDoc = parser.parseFromString(opfContent, 'application/xml');
			bookTitle = opfDoc.querySelector('title')?.textContent || 'Unknown Book';

			// Get the reading order (spine)
			const spineItems = opfDoc.querySelectorAll('spine itemref');
			const manifestItems = opfDoc.querySelectorAll('manifest item');

			// Create a map of manifest items for easy lookup
			const manifestMap = new SvelteMap();
			manifestItems.forEach((item) => {
				const id = item.getAttribute('id');
				const href = item.getAttribute('href');
				if (id && href) {
					manifestMap.set(id, href);
				}
			});

			// Extract chapters
			const basePath = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);
			
			// Extract and process CSS files
			const cssMap = new SvelteMap<string, string>();
			const cssItems = opfDoc.querySelectorAll('manifest item[media-type="text/css"]');
			for (const cssItem of cssItems) {
				const href = cssItem.getAttribute('href');
				if (href) {
					const cssPath = basePath + href;
					const cssContent = await epub.file(cssPath)?.async('string');
					if (cssContent) {
						// Process CSS to resolve relative URLs for fonts and images
						const processedCSS = await processCSS(cssContent, basePath, epub);
						cssMap.set(href, processedCSS);
					}
				}
			}
			for (const item of spineItems) {
				const idref = item.getAttribute('idref');
				if (idref && manifestMap.has(idref)) {
					const href = manifestMap.get(idref);
					const fullPath = basePath + href;
					const content = await epub.file(fullPath)?.async('string');
					if (content) {
						// Process HTML content and handle images
						const contentDoc = parser.parseFromString(content, 'text/html');
						const title =
							contentDoc.querySelector('title')?.textContent || `Chapter ${chapters.length + 1}`;

						// Process images in the content
						const images = contentDoc.querySelectorAll('img');
						for (const img of images) {
							const src = img.getAttribute('src');
							if (src) {
								// Convert relative image paths to blob URLs
								const imagePath = src.startsWith('./') ? src.substring(2) : src;
								const fullImagePath = src.startsWith('/') ? src.substring(1) : basePath + imagePath;

								const imageFile = epub.file(fullImagePath);
								if (imageFile) {
									const imageBlob = await imageFile.async('blob');
									const imageUrl = URL.createObjectURL(imageBlob);
									img.setAttribute('src', imageUrl);
								}
							}
						}

						// Process SVG image elements (for cover images)
						const svgImages = contentDoc.querySelectorAll('svg image');
						for (const svgImg of svgImages) {
							const href = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href');
							if (href) {
								// Convert relative image paths to blob URLs
								const imagePath = href.startsWith('./') ? href.substring(2) : href;
								const fullImagePath = href.startsWith('/') ? href.substring(1) : basePath + imagePath;

								const imageFile = epub.file(fullImagePath);
								if (imageFile) {
									const imageBlob = await imageFile.async('blob');
									const imageUrl = URL.createObjectURL(imageBlob);
									svgImg.setAttribute('xlink:href', imageUrl);
									svgImg.setAttribute('href', imageUrl);
								}
							}
						}

						// Fix SVG dimensions for better rendering
						const svgElements = contentDoc.querySelectorAll('svg');
						for (const svg of svgElements) {
							// Remove all constraints and viewBox to let image fill container
							svg.removeAttribute('height');
							svg.removeAttribute('width');
							svg.removeAttribute('viewBox');
							svg.removeAttribute('preserveAspectRatio');
							svg.setAttribute('style', 'width: 100%; height: 100%; display: block;');
							
							// Also remove constraints from the image element
							const imageElement = svg.querySelector('image');
							if (imageElement) {
								imageElement.removeAttribute('width');
								imageElement.removeAttribute('height');
								imageElement.setAttribute('style', 'width: 100%; height: 100%; object-fit: contain;');
							}
						}

						// Process CSS links in the HTML
						const cssLinks = contentDoc.querySelectorAll('link[rel="stylesheet"]');
						let combinedCSS = '';
						
						console.log('CSS links found:', cssLinks.length);
						for (const cssLink of cssLinks) {
							const href = cssLink.getAttribute('href');
							console.log('Processing CSS link:', href);
							if (href && cssMap.has(href)) {
								const css = cssMap.get(href);
								console.log('CSS found for', href, 'length:', css?.length);
								combinedCSS += css + '\n';
							}
						}

						// Get the processed HTML content and sanitize it
						const rawContent = contentDoc.body?.innerHTML || '';
						
						// If we have CSS, add it to a style tag for proper application
						let finalContent = rawContent;
						let cssForChapter = '';
						
						if (combinedCSS) {
							// Scope all CSS to .epub-content to prevent layout issues
							const scopedCSS = combinedCSS.replace(/([^{}]+){/g, '.epub-content $1{');
							cssForChapter = scopedCSS + `
								.epub-content { 
									font-family: 'Georgia', 'Times New Roman', serif;
									line-height: 1.6;
									color: #333;
									font-size: 16px;
									max-width: 100%;
									overflow-wrap: break-word;
								}
								.epub-content * {
									max-width: 100%;
									box-sizing: border-box;
								}
								.epub-content img {
									max-width: 100%;
									height: auto;
								}
								.epub-content .serif { font-family: 'Georgia', 'Times New Roman', serif; }
								.epub-content .sans-serif { font-family: 'Inter', 'Helvetica', 'Arial', sans-serif; }
								.epub-content .monospace { font-family: 'Fira Code', 'Courier New', monospace; }
							`;
							console.log('Generated scoped CSS for chapter (length:', cssForChapter.length, ')');
							console.log('CSS preview:', cssForChapter.substring(0, 200) + '...');
							finalContent = `<div class="epub-content">${rawContent}</div>`;
						} else {
							// Add default typography if no CSS
							cssForChapter = `
								.epub-content { 
									font-family: 'Georgia', 'Times New Roman', serif;
									line-height: 1.6;
									color: #333;
									font-size: 16px;
									max-width: 100%;
									overflow-wrap: break-word;
								}
								.epub-content * {
									max-width: 100%;
									box-sizing: border-box;
								}
								.epub-content img {
									max-width: 100%;
									height: auto;
								}
							`;
							console.log('Using default CSS (no combined CSS found)');
							finalContent = `<div class="epub-content">${rawContent}</div>`;
						}
						const processedContent = sanitizeHtml(finalContent, {
							allowedTags: [
								'p',
								'br',
								'strong',
								'em',
								'u',
								'i',
								'b',
								'h1',
								'h2',
								'h3',
								'h4',
								'h5',
								'h6',
								'ul',
								'ol',
								'li',
								'dl',
								'dt',
								'dd',
								'blockquote',
								'code',
								'pre',
								'img',
								'figure',
								'figcaption',
								'table',
								'thead',
								'tbody',
								'tr',
								'th',
								'td',
								'a',
								'span',
								'div',
								'svg',
								'image'
							],
							allowedAttributes: {
								'*': ['class', 'id', 'style'],
								img: ['src', 'alt', 'title', 'width', 'height'],
								a: ['href', 'title'],
								svg: ['xmlns', 'height', 'preserveAspectRatio', 'version', 'viewBox', 'width', 'xmlns:xlink'],
								image: ['width', 'height', 'xlink:href', 'href']
							},
							allowedSchemes: ['data', 'blob'],
							allowedSchemesByTag: {
								img: ['data', 'blob'],
								image: ['data', 'blob'],
								a: ['http', 'https', 'mailto']
							}
						});
						chapters.push({
							title,
							href: fullPath,
							content: processedContent,
							css: cssForChapter
						});
					}
				}
			}

			if (chapters.length > 0) {
				chapterCSS = chapters[0].css;
			} else {
				throw new Error('No readable content found in EPUB');
			}

			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load EPUB';
			loading = false;
		}
	});

	function goBack() {
		goto('/').then(() => {});
	}

	function updatePagination() {
		if (currentChapter === 0 && chapters[0]?.title === '"Cover"') {
			totalPages = 1;
			if (jumpToLastPage) {
				currentPage = 0;
				jumpToLastPage = false;
			} else if (currentPage >= totalPages) {
				currentPage = 0;
			}
			return;
		}

		if (contentContainer && containerWidth > 0) {
			const scrollWidth = contentContainer.scrollWidth;
			totalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
			
			if (jumpToLastPage) {
				currentPage = Math.max(0, totalPages - 1);
				jumpToLastPage = false;
			} else if (currentPage >= totalPages) {
				currentPage = Math.max(0, totalPages - 1);
			}
		}
	}

	$effect(() => {
		// Explicitly track dependencies so this runs on chapter changes
		// even if we navigate to the Cover page (where contentContainer is null)
		// Evaluate dependencies as arguments to setTimeout to track them reactively 
		// without triggering unused variable lint errors.
		const timer = setTimeout(
			updatePagination, 
			100, 
			chapters[currentChapter], 
			contentContainer, 
			containerWidth
		);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (contentContainer) {
			const observer = new ResizeObserver(() => {
				updatePagination();
			});
			observer.observe(contentContainer);
			return () => observer.disconnect();
		}
	});

	function goToChapter(index: number) {
		if (index >= 0 && index < chapters.length) {
			currentChapter = index;
			chapterCSS = chapters[index].css;
			
			currentPage = 0;
			console.log('Changed to chapter', index, 'CSS length:', chapters[index].css.length);
		}
	}

	// Reactive effect to inject CSS into document head
	$effect(() => {
		if (chapterCSS) {
			console.log('Injecting CSS into document head, length:', chapterCSS.length);
			
			// Remove any existing EPUB style
			const existingStyle = document.getElementById('epub-chapter-style');
			if (existingStyle) {
				existingStyle.remove();
			}
			
			// Create and inject new style
			const style = document.createElement('style');
			style.id = 'epub-chapter-style';
			style.textContent = chapterCSS;
			document.head.appendChild(style);
			
			console.log('CSS injected successfully');
		}
	});

	function nextPage() {
		if (currentPage < totalPages - 1) {
			currentPage++;
		} else if (currentChapter < chapters.length - 1) {
			// Go to next chapter if we're at the last page
			goToChapter(currentChapter + 1);
		}
	}

	function previousPage() {
		if (currentPage > 0) {
			currentPage--;
		} else if (currentChapter > 0) {
			// Go to previous chapter if we're at the first page
			goToChapter(currentChapter - 1);
			jumpToLastPage = true;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowRight':
			case ' ':
				event.preventDefault();
				nextPage();
				break;
			case 'ArrowLeft':
				event.preventDefault();
				previousPage();
				break;
		}
	}

	// Type definition for JSZip file object
	interface EpubFile {
		async(type: 'blob'): Promise<Blob>;
	}

	// Type definition for EPUB interface
	interface EpubReader {
		file(path: string): EpubFile | null;
	}

	async function processCSS(cssContent: string, basePath: string, epub: EpubReader): Promise<string> {
		// Process CSS to resolve relative URLs for fonts and images
		const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
		const urls: string[] = [];
		const replacements: string[] = [];
		
		// Find all URLs first
		let match;
		while ((match = urlRegex.exec(cssContent)) !== null) {
			const matchedUrl = match[1];
			if (!matchedUrl.startsWith('data:') && !matchedUrl.startsWith('http')) {
				urls.push(matchedUrl);
			}
		}
		
		// Process all URLs in parallel
		await Promise.all(urls.map(async (resourceUrl) => {
			const resourcePath = resourceUrl.startsWith('./') ? resourceUrl.substring(2) : resourceUrl;
			const fullPath = resourcePath.startsWith('/') ? resourcePath.substring(1) : basePath + resourcePath;
			
			console.log('Processing resource:', resourceUrl, '->', fullPath);
			const resourceFile = epub.file(fullPath);
			if (resourceFile) {
				console.log('Found resource file:', fullPath);
				const resourceBlob = await resourceFile.async('blob');
				const blobUrl = URL.createObjectURL(resourceBlob);
				console.log('Created blob URL:', blobUrl);
				replacements.push(`url("${blobUrl}")`);
			} else {
				console.log('Resource file not found:', fullPath);
				replacements.push(`url("${resourceUrl}")`);
			}
		}));
		
		// Replace URLs in the CSS
		let processedCSS = cssContent;
		let urlIndex = 0;
		processedCSS = processedCSS.replace(urlRegex, () => {
			const replacement = replacements[urlIndex];
			urlIndex++;
			return replacement;
		});
		
		return processedCSS;
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if chapterCSS}
	<div id="epub-css-container" style="display: none;"></div>
{/if}

<div class="flex h-screen flex-col bg-gray-50 font-sans">
	<!-- Header -->
	<header
		class="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm"
	>
		<Button variant="ghost" onclick={goBack} class="flex items-center gap-2">
			<ChevronLeft class="h-4 w-4" />
			<span class="hidden sm:inline">Back</span>
		</Button>

		<div class="max-w-xs truncate">
			<h1 class="text-xl font-semibold text-gray-900">{bookTitle}</h1>
			{#if chapters[currentChapter]}
				<p class="text-sm text-gray-600 truncate">{chapters[currentChapter]?.title}</p>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={previousPage}
				disabled={currentChapter === 0 && currentPage === 0}
				class="p-2"
			>
				<ChevronLeft class="h-4 w-4" />
			</Button>

			<div class="text-center">
				<div class="text-sm text-gray-600">
					Page {currentPage + 1} / {totalPages}
				</div>
			</div>

			<Button
				variant="outline"
				size="sm"
				onclick={nextPage}
				disabled={currentChapter === chapters.length - 1 && currentPage === totalPages - 1}
				class="p-2"
			>
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
	</header>

	<!-- Main Content -->
	<main class="flex-1 overflow-hidden">
		{#if loading}
			<div class="flex h-full flex-col items-center justify-center p-8">
				<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
				<p class="text-lg text-gray-600">Loading EPUB...</p>
			</div>
		{:else if error}
			<div class="flex h-full items-center justify-center p-8">
				<Alert variant="destructive" class="max-w-md">
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
					<Button onclick={goBack} class="mt-4">Go Back</Button>
				</Alert>
			</div>
		{:else}
			<div class="h-full bg-gray-50 overflow-hidden">
				{#if currentChapter === 0 && chapters[0]?.title === '"Cover"'}
					<!-- Cover page - fullscreen -->
					<div class="h-full w-full bg-white">
						<div class="prose prose-lg max-w-none h-full w-full p-0 m-0">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html chapters[currentChapter].content}
						</div>
					</div>
				{:else}
					<!-- Regular chapters - multi-column paginated -->
					<div class="h-full w-full flex justify-center">
						<div class="h-full w-full max-w-3xl overflow-hidden bg-white px-8 py-8 shadow-sm border-x border-gray-200" bind:clientWidth={containerWidth}>
							<div class="h-full w-full" style="transform: translateX(-{currentPage * containerWidth}px); transition: transform 0.3s ease-in-out;">
								<div 
									bind:this={contentContainer}
									class="h-full prose prose-lg max-w-none"
									style="column-width: {containerWidth ? `calc(${containerWidth}px - 4rem)` : '100%'}; column-gap: 4rem; column-fill: auto;"
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html chapters[currentChapter].content}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="border-t border-gray-200 bg-white px-6 py-3 text-center">
		<p class="text-sm text-gray-500">
			Use arrow keys or buttons to navigate • Space to go to next page
		</p>
	</footer>
</div>

<style>
	:global(.prose img) {
		max-width: 100%;
		height: auto;
		display: block;
		margin: 1rem auto;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}
	
	/* Cover image responsive styling */
	:global(.prose .x-ebookmaker-coverpage) {
		height: 100%;
		min-height: calc(100vh - 120px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 !important;
		margin: 0 !important;
		background: white;
	}
	
	:global(.prose .x-ebookmaker-cover) {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 !important;
		margin: 0 !important;
	}
	
	:global(.prose .x-ebookmaker-cover svg) {
		max-width: 100%;
		max-height: 100%;
		width: 100% !important;
		height: 100% !important;
		object-fit: contain;
	}
	
	/* Mobile portrait - prioritize height */
	@media (max-width: 768px) and (orientation: portrait) {
		:global(.prose .x-ebookmaker-coverpage) {
			height: calc(100vh - 150px);
		}
		
		:global(.prose .x-ebookmaker-cover svg) {
			max-width: 100%;
			max-height: 100%;
			width: 100% !important;
			height: 100% !important;
		}
	}
	
	/* Desktop - make image as large as possible */
	@media (min-width: 769px) {
		:global(.prose .x-ebookmaker-coverpage) {
			height: calc(100vh - 120px);
			width: 100vw;
			max-width: none;
			padding: 0 !important;
			margin: 0 !important;
		}
		
		:global(.prose .x-ebookmaker-cover) {
			width: 100vw;
			height: 100%;
			max-width: none;
		}
		
		:global(.prose .x-ebookmaker-cover svg) {
			width: 95vw !important;
			height: calc(100vh - 140px) !important;
			max-width: none;
			max-height: none;
		}
		
		:global(.prose .x-ebookmaker-cover svg image) {
			width: 100% !important;
			height: 100% !important;
			object-fit: contain;
		}
	}
	
	/* Landscape - balance width and height */
	@media (orientation: landscape) and (max-height: 768px) {
		:global(.prose .x-ebookmaker-coverpage) {
			height: calc(100vh - 120px);
		}
		
		:global(.prose .x-ebookmaker-cover svg) {
			max-width: 80vw;
			max-height: calc(100vh - 140px);
		}
	}
	
	:global(.prose p) {
		margin-bottom: 1rem;
		text-align: justify;
	}
	
	:global(.prose h1),
	:global(.prose h2),
	:global(.prose h3) {
		margin: 1.5rem 0 1rem 0;
		color: rgb(17, 24, 39);
		break-after: avoid;
		page-break-after: avoid;
	}

	/* Prevent elements from being split across pages/columns */
	:global(.prose > *) {
		break-inside: avoid;
		page-break-inside: avoid;
	}
	
	/* Also ensure specific elements don't break */
	:global(.prose p),
	:global(.prose img),
	:global(.prose svg),
	:global(.prose figure),
	:global(.prose blockquote),
	:global(.prose ul),
	:global(.prose ol),
	:global(.prose li),
	:global(.prose table) {
		break-inside: avoid;
		page-break-inside: avoid;
	}
</style>
