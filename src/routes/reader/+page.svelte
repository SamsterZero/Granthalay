<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve, assets } from '$app/paths';
	import sanitizeHtml from 'sanitize-html';
	import { SvelteMap } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, Moon, Sun } from 'lucide-svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { getBookById } from '$lib/db';

function extractChaptersFromContent(content: string, href: string): Array<{ title: string; href: string; content: string }> {
	const parser = new DOMParser();
	const doc = parser.parseFromString(content, 'text/html');
	const chapters: Array<{ title: string; href: string; content: string }> = [];
	
	// Look for chapter headings (h1, h2, h3) that could be chapter boundaries
	const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
	
	if (headings.length > 1) {
		// Multiple headings found - treat each as a potential chapter
		for (let i = 0; i < headings.length; i++) {
			const heading = headings[i];
			const title = heading.textContent?.trim();
			if (title && !title.toLowerCase().includes('cover') && !title.toLowerCase().includes('title page')) {
				// Create a temporary div to extract content between this heading and the next
				const tempDiv = document.createElement('div');
				let currentElement = heading;
				
				// Add all content from this heading until the next heading of same or higher level
				const currentLevel = parseInt(heading.tagName.substring(1));
				let nextElement = heading.nextSibling;
				
				while (nextElement) {
					if (nextElement.nodeType === Node.ELEMENT_NODE) {
						const element = nextElement as Element;
						if (element.tagName.match(/^H[1-6]$/)) {
							const elementLevel = parseInt(element.tagName.substring(1));
							if (elementLevel <= currentLevel) {
								break; // Stop at next heading of same or higher level
							}
						}
					}
					
					if (nextElement.nodeType === Node.ELEMENT_NODE || nextElement.nodeType === Node.TEXT_NODE) {
						tempDiv.appendChild(nextElement.cloneNode(true));
					}
					
					nextElement = nextElement.nextSibling;
				}
				
				// Also include the heading itself
				const chapterDiv = document.createElement('div');
				chapterDiv.appendChild(heading.cloneNode(true));
				chapterDiv.innerHTML += tempDiv.innerHTML;
				
				chapters.push({
					title,
					href,
					content: chapterDiv.innerHTML
				});
			}
		}
	} else {
		// Single heading or no headings - treat the whole file as one chapter
		const title = doc.querySelector('title')?.textContent?.trim() || `Chapter`;
		chapters.push({
			title,
			href,
			content: doc.body?.innerHTML || content
		});
	}
	
	return chapters;
}

	let loading = $state(true);
	let error = $state<string | null>(null);
	let bookTitle = $state('Unknown Book');
	let currentChapter = $state(0);
	let chapters = $state<Array<{ title: string; href: string; content: string; css: string }>>([]);
	let chapterCSS = $state('');
	let currentPage = $state(0);
	let totalPages = $state(0);
	let darkMode = $state(false);

	let contentContainer = $state<HTMLElement | null>(null);
	let containerWidth = $state(0);
	let jumpToLastPage = $state(false);

	onMount(async () => {
		// Initialize theme
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			darkMode = true;
			document.documentElement.classList.add('dark');
		}

		try {
			const params = new URLSearchParams(window.location.search);
			const bookId = params.get('bookId') || 'default';
			const chapterParam = params.get('chapter');
			const targetChapter = chapterParam ? parseInt(chapterParam, 10) : 0;

			let arrayBuffer: ArrayBuffer;

			if (bookId === 'default') {
				const response = await fetch(`${assets}/books/pg78627-images-3.epub`);
				if (!response.ok) {
					throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
				}
				arrayBuffer = await response.arrayBuffer();
			} else {
				const book = await getBookById(bookId);
				if (!book) {
					throw new Error('Book not found in library');
				}
				arrayBuffer = book.buffer;
			}

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

			// Build spine hrefs for chapter extraction
			const spineHrefs: string[] = [];
			for (const item of spineItems) {
				const idref = item.getAttribute('idref');
				if (idref && manifestMap.has(idref)) {
					const href = manifestMap.get(idref);
					if (href) {
						spineHrefs.push(href);
					}
				}
			}

			// Extract chapters using the same logic as epub-meta.ts
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
			for (const href of spineHrefs) {
				const fullPath = basePath + href;
				const content = await epub.file(fullPath)?.async('string');
				if (content) {
					// Extract actual chapters from this content
					const contentChapters = extractChaptersFromContent(content, href);
					
					for (const contentChapter of contentChapters) {
						// Skip cover pages
						const titleLower = contentChapter.title.toLowerCase();
						if (titleLower.includes('cover') || titleLower.includes('title page')) {
							continue;
						}
						
						// Use the pre-extracted content for this chapter
						const chapterContent = contentChapter.content;
						
						// Process HTML content and handle images
						const contentDoc = parser.parseFromString(chapterContent, 'text/html');
						const title = contentChapter.title;

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
							const hrefAttr = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href');
							if (hrefAttr) {
								// Convert relative image paths to blob URLs
								const imagePath = hrefAttr.startsWith('./') ? hrefAttr.substring(2) : hrefAttr;
								const fullImagePath = hrefAttr.startsWith('/') ? hrefAttr.substring(1) : basePath + imagePath;

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
						
						for (const cssLink of cssLinks) {
							const cssHref = cssLink.getAttribute('href');
							if (cssHref && cssMap.has(cssHref)) {
								const css = cssMap.get(cssHref);
								if (css) {
									combinedCSS += css + '\n';
								}
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
							href: contentChapter.href,
							content: processedContent,
							css: cssForChapter
						});
					}
				}
			}

			if (chapters.length > 0) {
				// Set initial chapter based on URL parameter
				const initialChapter = Math.min(Math.max(0, targetChapter), chapters.length - 1);
				currentChapter = initialChapter;
				chapterCSS = chapters[initialChapter].css;
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
		goto(resolve('/')).then(() => {});
	}

	function toggleDarkMode() {
		darkMode = !darkMode;
		if (darkMode) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
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
			currentPage = 0;
			console.log('Changed to chapter', index, 'Title:', chapters[index].title);
		}
	}

	// Reactive effect to update chapter CSS when currentChapter changes
	$effect(() => {
		if (chapters[currentChapter]) {
			chapterCSS = chapters[currentChapter].css;
			console.log('Updated chapterCSS for chapter', currentChapter, 'Title:', chapters[currentChapter].title);
		}
	});

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

	let touchStartX = $state(0);
	let touchEndX = $state(0);

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
	}

	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].screenX;
		handleSwipe();
	}

	function handleSwipe() {
		const swipeThreshold = 50;
		if (touchEndX < touchStartX - swipeThreshold) {
			nextPage();
		} else if (touchEndX > touchStartX + swipeThreshold) {
			previousPage();
		}
	}

	function handleContentClick(e: MouseEvent) {
		const selection = window.getSelection();
		if (selection && selection.toString().length > 0) return;

		const target = e.target as HTMLElement;
		if (target.closest('a') || target.closest('button')) return;

		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		const width = rect.width;
		
		if (x > width * 0.7) {
			nextPage();
		} else if (x < width * 0.3) {
			previousPage();
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

<div class="flex h-screen flex-col bg-background font-sans">
	<!-- Header -->
	<header
		class="flex items-center justify-between border-b border-border bg-background px-6 py-4 shadow-sm"
	>
		<Button variant="ghost" onclick={goBack} class="flex items-center gap-2">
			<ChevronLeft class="h-4 w-4" />
			<span class="hidden sm:inline">Back</span>
		</Button>

		<div class="max-w-xs text-left sm:text-center">
			<h1 class="truncate text-xl font-semibold text-foreground">{bookTitle}</h1>
			{#if chapters[currentChapter]}
				<p class="truncate text-sm text-muted-foreground">{chapters[currentChapter]?.title}</p>
			{/if}
		</div>

		<Button 
			variant="outline"
			size="icon"
			class="rounded-full cursor-pointer"
			onclick={toggleDarkMode}
			title="Toggle theme"
		>
			{#if darkMode}
				<Sun size={20} />
			{:else}
				<Moon size={20} />
			{/if}
		</Button>
	</header>

	<!-- Main Content -->
	<main class="flex-1 overflow-hidden">
		{#if loading}
			<div class="flex h-full flex-col items-center justify-center p-8">
				<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
				<p class="text-lg text-muted-foreground">Loading EPUB...</p>
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
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div 
				class="h-full bg-background overflow-hidden"
				ontouchstart={handleTouchStart}
				ontouchend={handleTouchEnd}
				onclick={handleContentClick}
			>
				{#if currentChapter === 0 && chapters[0]?.title === '"Cover"'}
					<!-- Cover page - fullscreen -->
					<div class="h-full w-full bg-background">
						<div class="prose prose-lg max-w-none h-full w-full p-0 m-0">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html chapters[currentChapter].content}
						</div>
					</div>
				{:else}
					<!-- Regular chapters - multi-column paginated -->
					<div class="h-full w-full flex justify-center">
						<div class="h-full w-full max-w-3xl overflow-hidden bg-background px-8 py-8 shadow-sm border-x border-border" bind:clientWidth={containerWidth}>
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
	<footer class="border-t border-border bg-background px-6 py-3 text-center">
		<p class="text-sm text-muted-foreground">
			Page {currentPage + 1} / {totalPages} • Chapter {currentChapter + 1} of {chapters.length}
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
		background: hsl(var(--background));
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
		color: hsl(var(--foreground));
	}

	/* Dark theme support for EPUB content */
	:global(.prose) {
		color: hsl(var(--foreground));
	}

	:global(.prose div),
	:global(.prose span),
	:global(.prose strong),
	:global(.prose em),
	:global(.prose blockquote),
	:global(.prose ul),
	:global(.prose ol),
	:global(.prose li) {
		color: hsl(var(--foreground));
	}
	
	:global(.prose h1),
	:global(.prose h2),
	:global(.prose h3) {
		margin: 1.5rem 0 1rem 0;
		color: hsl(var(--foreground));
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
