<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve, assets } from '$app/paths';
	import sanitizeHtml from 'sanitize-html';
	import { SvelteMap } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, Moon, Sun } from 'lucide-svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { getBookById, updateBookProgress, type BookRecord } from '$lib/db';

function extractChaptersFromContent(content: string, href: string): Array<{ title: string; href: string; content: string }> {
	const parser = new DOMParser();
	const doc = parser.parseFromString(content, 'text/html');
	const chapters: Array<{ title: string; href: string; content: string }> = [];
	
	const headings = doc.querySelectorAll('h1, h2');
	
	if (headings.length > 1) {
		for (let i = 0; i < headings.length; i++) {
			const heading = headings[i];
			const title = heading.textContent?.trim();
			
			if (title) {
				const tempDiv = document.createElement('div');
				let nextElement = heading.nextSibling;
				const currentLevel = parseInt(heading.tagName.substring(1));
				
				while (nextElement) {
					if (nextElement.nodeType === Node.ELEMENT_NODE) {
						const element = nextElement as Element;
						if (element.tagName.match(/^H[1-2]$/)) {
							const elementLevel = parseInt(element.tagName.substring(1));
							if (elementLevel <= currentLevel) break;
						}
					}
					tempDiv.appendChild(nextElement.cloneNode(true));
					nextElement = nextElement.nextSibling;
				}
				
				const chapterDiv = document.createElement('div');
				chapterDiv.appendChild(heading.cloneNode(true));
				chapterDiv.innerHTML += tempDiv.innerHTML;
				
				chapters.push({
					title,
					href: `${href}#${heading.id || ''}`,
					content: chapterDiv.innerHTML
				});
			}
		}
	} else {
		const title = doc.querySelector('title')?.textContent?.trim() || 
					  doc.querySelector('h1, h2, h3')?.textContent?.trim() || 
					  `Chapter`;
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
	let chapters = $state<Array<{ title: string; href: string; content: string; css: string; isCover?: boolean; isFrontmatter?: boolean }>>([]);
	let chapterCSS = $state('');
	let currentPage = $state(0);
	let totalPages = $state(0);
	let darkMode = $state(false);

	let contentContainer = $state<HTMLElement | null>(null);
	let containerWidth = $state(0);
	let jumpToLastPage = $state(false);
	let isCalculating = $state(false);
	let chapterPageCounts = $state<number[]>([]);
	let totalBookPages = $state(0);
	let pagesRead = $derived.by(() => {
		let count = 0;
		for (let i = 0; i < currentChapter; i++) {
			count += chapterPageCounts[i] || 1;
		}
		count += currentPage + 1;
		return count;
	});

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			darkMode = true;
			document.documentElement.classList.add('dark');
		}

		try {
			const params = new URLSearchParams(window.location.search);
			const bookId = params.get('bookId') || 'default';
			const chapterParam = params.get('chapter');
			const pageParam = params.get('page');
			let targetChapter = chapterParam ? parseInt(chapterParam, 10) : 0;
			let targetPage = pageParam ? parseInt(pageParam, 10) : 0;

			let arrayBuffer: ArrayBuffer;
			let storedRecord: Partial<BookRecord> | null = null;

			if (bookId === 'default') {
				const response = await fetch(`${assets}/books/pg78627-images-3.epub`);
				if (!response.ok) throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
				arrayBuffer = await response.arrayBuffer();
				
				if (!chapterParam) {
					const stored = localStorage.getItem('book-progress-default');
					if (stored) {
						storedRecord = JSON.parse(stored);
					}
				}
			} else {
				const book = await getBookById(bookId);
				if (!book) throw new Error('Book not found in library');
				arrayBuffer = book.buffer;
				if (!chapterParam) {
					storedRecord = book;
				}
			}

			if (storedRecord) {
				if (storedRecord.currentChapter !== undefined) targetChapter = storedRecord.currentChapter;
				if (storedRecord.currentPage !== undefined) targetPage = storedRecord.currentPage;
			}

			const zip = await import('jszip');
			const epub = await zip.default.loadAsync(arrayBuffer);

			const containerXml = await epub.file('META-INF/container.xml')?.async('string');
			if (!containerXml) throw new Error('Invalid EPUB: No container.xml found');

			const parser = new DOMParser();
			const containerDoc = parser.parseFromString(containerXml, 'application/xml');
			const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
			if (!rootfilePath) throw new Error('Invalid EPUB: No rootfile found');

			const opfContent = await epub.file(rootfilePath)?.async('string');
			if (!opfContent) throw new Error('Invalid EPUB: No OPF file found');

			const opfDoc = parser.parseFromString(opfContent, 'application/xml');
			bookTitle = opfDoc.querySelector('title')?.textContent || 'Unknown Book';

			const spineItems = opfDoc.querySelectorAll('spine itemref');
			const manifestItems = opfDoc.querySelectorAll('manifest item');
			const manifestMap = new SvelteMap<string, { href: string; mediaType: string }>();
			manifestItems.forEach((item) => {
				const id = item.getAttribute('id');
				const href = item.getAttribute('href');
				const mediaType = item.getAttribute('media-type') || '';
				if (id && href) manifestMap.set(id, { href, mediaType });
			});

			const basePath = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);
			const spineInfos: Array<{ href: string; mediaType: string }> = [];
			for (const item of spineItems) {
				const idref = item.getAttribute('idref');
				if (idref && manifestMap.has(idref)) {
					spineInfos.push(manifestMap.get(idref)!);
				}
			}

			const tocTitles = new SvelteMap<string, string>();
			const navItem = opfDoc.querySelector('item[properties~="nav"]');
			if (navItem) {
				const tocHref = navItem.getAttribute('href');
				if (tocHref) {
					const tocPath = basePath + tocHref;
					const tocContent = await epub.file(tocPath)?.async('string');
					if (tocContent) {
						const tocDoc = parser.parseFromString(tocContent, 'text/html');
						const links = tocDoc.querySelectorAll('nav[epub\\:type="toc"] a, nav[role="doc-toc"] a, nav a');
						links.forEach(a => {
							const href = a.getAttribute('href');
							const title = a.textContent?.trim();
							if (href && title) {
								const tocBase = tocHref.substring(0, tocHref.lastIndexOf('/') + 1);
								const resolvedHref = (href.startsWith('/') ? href.substring(1) : tocBase + href).replace(/\\/g, '/');
								const cleanHref = resolvedHref.split('#')[0];
								if (!tocTitles.has(cleanHref)) tocTitles.set(cleanHref, title);
								tocTitles.set(resolvedHref, title);
							}
						});
					}
				}
			}

			if (tocTitles.size === 0) {
				const spineToc = opfDoc.querySelector('spine');
				const ncxId = spineToc?.getAttribute('toc');
				let ncxHref = ncxId ? manifestMap.get(ncxId)?.href || null : null;
				
				if (!ncxHref) {
					for (const info of manifestMap.values()) {
						if (info.href.endsWith('.ncx')) { ncxHref = info.href; break; }
					}
				}

				if (ncxHref) {
					const ncxContent = await epub.file(basePath + ncxHref)?.async('string');
					if (ncxContent) {
						const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
						const navPoints = ncxDoc.querySelectorAll('navPoint');
						navPoints.forEach(np => {
							const label = np.querySelector('navLabel text')?.textContent?.trim();
							const src = np.querySelector('content')?.getAttribute('src');
							if (label && src) {
								const ncxBase = ncxHref!.substring(0, ncxHref!.lastIndexOf('/') + 1);
								const resolvedSrc = (src.startsWith('/') ? src.substring(1) : ncxBase + src).replace(/\\/g, '/');
								const cleanSrc = resolvedSrc.split('#')[0];
								if (!tocTitles.has(cleanSrc)) tocTitles.set(cleanSrc, label);
								tocTitles.set(resolvedSrc, label);
							}
						});
					}
				}
			}

			const cssMap = new SvelteMap<string, string>();
			const cssItems = opfDoc.querySelectorAll('manifest item[media-type="text/css"]');
			for (const cssItem of cssItems) {
				const href = cssItem.getAttribute('href');
				if (href) {
					const cssContent = await epub.file(basePath + href)?.async('string');
					if (cssContent) {
						const processedCSS = await processCSS(cssContent, basePath, epub);
						cssMap.set(href, processedCSS);
					}
				}
			}

			for (const { href, mediaType } of spineInfos) {
				const fullPath = basePath + href;
				const normalizedHref = href.replace(/\\/g, '/');
				
				if (mediaType.startsWith('image/')) {
					const imageFile = epub.file(fullPath);
					if (imageFile) {
						const blob = await imageFile.async('blob');
						const url = URL.createObjectURL(blob);
						let title = tocTitles.get(normalizedHref) || 'Image';
						const isCover = title.toLowerCase().includes('cover') || chapters.length === 0;
						
						chapters.push({
							title,
							href: normalizedHref,
							content: `<div class="epub-content x-ebookmaker-cover"><img src="${url}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" /></div>`,
							css: '.epub-content { display: flex; align-items: center; justify-content: center; height: 100%; }',
							isCover,
							isFrontmatter: true
						});
					}
					continue;
				}

				const content = await epub.file(fullPath)?.async('string');
				if (content) {
					const contentChapters = extractChaptersFromContent(content, href);
					for (const contentChapter of contentChapters) {
						const contentDoc = parser.parseFromString(contentChapter.content, 'text/html');
						let title = contentChapter.title;
						if (tocTitles.has(contentChapter.href)) {
							title = tocTitles.get(contentChapter.href)!;
						} else if (tocTitles.has(href)) {
							title = tocTitles.get(href)!;
						}

						const titleLower = title.toLowerCase();
						const isCover = titleLower.includes('cover') || 
										(chapters.length === 0 && contentDoc.querySelector('svg, img') !== null && !titleLower.includes('chapter'));
						
						const isFrontmatter = isCover || 
											  titleLower.includes('title page') || 
											  titleLower.includes('half title') ||
											  titleLower.includes('dedication') ||
											  titleLower.includes('preface') ||
											  titleLower.includes('author\'s note') ||
											  titleLower.includes('introduction');

						const images = contentDoc.querySelectorAll('img');
						for (const img of images) {
							const src = img.getAttribute('src');
							if (src) {
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

						const svgImages = contentDoc.querySelectorAll('svg image');
						for (const svgImg of svgImages) {
							const hrefAttr = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href');
							if (hrefAttr) {
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

						const svgElements = contentDoc.querySelectorAll('svg');
						for (const svg of svgElements) {
							svg.removeAttribute('height'); svg.removeAttribute('width'); svg.removeAttribute('viewBox');
							svg.removeAttribute('preserveAspectRatio');
							svg.setAttribute('style', 'width: 100%; height: 100%; display: block;');
							const imageElement = svg.querySelector('image');
							if (imageElement) {
								imageElement.removeAttribute('width'); imageElement.removeAttribute('height');
								imageElement.setAttribute('style', 'width: 100%; height: 100%; object-fit: contain;');
							}
						}

						const cssLinks = contentDoc.querySelectorAll('link[rel="stylesheet"]');
						let combinedCSS = '';
						for (const cssLink of cssLinks) {
							const cssHref = cssLink.getAttribute('href');
							if (cssHref && cssMap.has(cssHref)) {
								const css = cssMap.get(cssHref);
								if (css) combinedCSS += css + '\n';
							}
						}

						const rawContent = contentDoc.body?.innerHTML || '';
						let finalContent = rawContent;
						let cssForChapter = '';
						
						// Use dynamic variables for colors to support dark mode
						const typographyStyles = `
							.epub-content { 
								font-family: Georgia, serif; 
								line-height: 1.6; 
								font-size: 16px; 
								color: inherit; 
								max-width: 100%; 
								overflow-wrap: break-word; 
							} 
							.epub-content img { max-width: 100%; height: auto; display: block; margin: 1rem auto; }
							.epub-content p { margin-bottom: 1.2em; text-align: justify; }
							.epub-content h1, .epub-content h2, .epub-content h3 { color: inherit; margin-top: 1.5em; margin-bottom: 0.5em; }
						`;

						if (combinedCSS) {
							// Robust CSS scoping that handles comma-separated selectors
							const scopedCSS = combinedCSS
								.split('}')
								.map(rule => {
									const parts = rule.split('{');
									if (parts.length !== 2) return rule;
									const selectors = parts[0];
									const declaration = parts[1];
									const scopedSelectors = selectors
										.split(',')
										.map(s => s.trim() ? `.epub-content ${s.trim()}` : '')
										.filter(Boolean)
										.join(', ');
									return `${scopedSelectors} { ${declaration} }`;
								})
								.join('\n');
								
							cssForChapter = scopedCSS + typographyStyles;
							finalContent = `<div class="epub-content">${rawContent}</div>`;
						} else {
							cssForChapter = typographyStyles;
							finalContent = `<div class="epub-content">${rawContent}</div>`;
						}

						const processedContent = sanitizeHtml(finalContent, {
							allowedTags: ['p', 'br', 'strong', 'em', 'u', 'i', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'img', 'svg', 'image', 'div', 'span'],
							allowedAttributes: { '*': ['class', 'id', 'style'], img: ['src'], svg: ['viewBox'], image: ['xlink:href', 'href'] },
							allowedSchemes: ['data', 'blob']
						});

						chapters.push({ title, href: contentChapter.href, content: processedContent, css: cssForChapter, isCover, isFrontmatter });
					}
				}
			}

			if (chapters.length > 0) {
				const initialChapter = Math.min(Math.max(0, targetChapter), chapters.length - 1);
				currentChapter = initialChapter;
				currentPage = targetPage; // Will be clamped by updatePagination if needed
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

	function goBack() { goto(resolve('/')).then(() => {}); }
	function toggleDarkMode() {
		darkMode = !darkMode;
		if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
		else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
	}

	function updatePagination() {
		if (chapters[currentChapter]?.isCover || (chapters[currentChapter]?.content.length < 1000 && chapters[currentChapter]?.content.includes('<img'))) {
			totalPages = 1;
			currentPage = 0;
			isCalculating = false;
			return;
		}
		if (contentContainer && containerWidth > 0) {
			const scrollWidth = contentContainer.scrollWidth;
			totalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
			if (jumpToLastPage) { 
				currentPage = Math.max(0, totalPages - 1); 
				jumpToLastPage = false; 
			}
			
			// Stay in calculating state for a tiny bit longer to ensure
			// the snap-to-page transform is applied before we show the content
			setTimeout(() => {
				isCalculating = false;
			}, 100);
		}
	}

	$effect(() => {
		const timer = setTimeout(updatePagination, 2000, chapters[currentChapter], contentContainer, containerWidth);
		return () => clearTimeout(timer);
	});

	async function calculateChapterPageCounts() {
		if (!containerWidth || chapters.length === 0 || chapterPageCounts.length > 0) return;
		
		const calcDiv = document.createElement('div');
		// Match the reader's layout exactly for accurate calculation
		calcDiv.className = 'prose prose-lg max-w-none';
		calcDiv.style.width = `${containerWidth}px`;
		calcDiv.style.columnWidth = `${containerWidth - 64}px`; // 64px = px-8 total padding
		calcDiv.style.columnGap = '64px';
		calcDiv.style.columnFill = 'auto';
		calcDiv.style.position = 'fixed';
		calcDiv.style.left = '-9999px';
		calcDiv.style.visibility = 'hidden';
		calcDiv.style.maxHeight = 'calc(100vh - 160px)'; // Approximate main area height
		document.body.appendChild(calcDiv);
		
		const counts: number[] = [];
		let total = 0;
		
		// Run in chunks to avoid blocking the main thread too much
		for (let i = 0; i < chapters.length; i++) {
			if (chapters[i].isCover) {
				counts.push(1);
				total += 1;
				continue;
			}
			
			calcDiv.innerHTML = chapters[i].content;
			// Small delay to let browser layout (though usually synchronous for scrollWidth)
			const count = Math.max(1, Math.ceil(calcDiv.scrollWidth / containerWidth));
			counts.push(count);
			total += count;
			
			// Yield every few chapters
			if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
		}
		
		document.body.removeChild(calcDiv);
		chapterPageCounts = counts;
		totalBookPages = total;
	}

	$effect(() => {
		if (containerWidth > 0 && !loading && chapters.length > 0) {
			calculateChapterPageCounts();
		}
	});

	$effect(() => {
		if (!loading && chapters.length > 0 && !isCalculating && totalBookPages > 0) {
			const progress = pagesRead / totalBookPages;
			const params = new URLSearchParams(window.location.search);
			const bookId = params.get('bookId') || 'default';
			updateBookProgress(bookId, progress, currentChapter, currentPage, totalBookPages);
		}
	});

	function goToChapter(index: number) { 
		if (index >= 0 && index < chapters.length) { 
			isCalculating = true;
			currentChapter = index; 
			currentPage = 0; 
		} 
	}

	$effect(() => {
		if (chapters[currentChapter]) {
			chapterCSS = chapters[currentChapter].css;
		}
	});

	$effect(() => {
		if (chapterCSS) {
			const existingStyle = document.getElementById('epub-chapter-style');
			if (existingStyle) existingStyle.remove();
			const style = document.createElement('style');
			style.id = 'epub-chapter-style';
			style.textContent = chapterCSS;
			document.head.appendChild(style);
		}
	});

	function nextPage() { 
		if (currentPage < totalPages - 1) {
			currentPage++; 
		} else if (currentChapter < chapters.length - 1) {
			goToChapter(currentChapter + 1);
		}
	}
	
	function previousPage() { 
		if (currentPage > 0) {
			currentPage--; 
		} else if (currentChapter > 0) { 
			jumpToLastPage = true;
			goToChapter(currentChapter - 1); 
		} 
	}

	function handleKeydown(event: KeyboardEvent) { if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); nextPage(); } else if (event.key === 'ArrowLeft') { event.preventDefault(); previousPage(); } }

	function handleContentClick(e: MouseEvent) {
		const selection = window.getSelection(); if (selection && selection.toString().length > 0) return;
		const target = e.target as HTMLElement; if (target.closest('a') || target.closest('button')) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (x > rect.width * 0.7) nextPage(); else if (x < rect.width * 0.3) previousPage();
	}

	let touchStartX = 0;
	let touchStartY = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const dx = touchEndX - touchStartX;
		const dy = touchEndY - touchStartY;

		// Require more horizontal than vertical movement and a minimum distance
		if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
			if (dx > 0) previousPage();
			else nextPage();
		}
	}

	interface EpubReader { file(path: string): { async(type: 'blob'): Promise<Blob>; async(type: 'string'): Promise<string>; } | null; }

	async function processCSS(cssContent: string, basePath: string, epub: EpubReader): Promise<string> {
		const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
		const urls: string[] = [];
		const replacements: string[] = [];
		let match;
		while ((match = urlRegex.exec(cssContent)) !== null) { if (!match[1].startsWith('data:') && !match[1].startsWith('http')) urls.push(match[1]); }
		await Promise.all(urls.map(async (resourceUrl) => {
			const fullPath = (resourceUrl.startsWith('/') ? resourceUrl.substring(1) : basePath + resourceUrl.replace(/^\.\//, '')).replace(/\\/g, '/');
			const resourceFile = epub.file(fullPath);
			if (resourceFile) {
				const blob = await resourceFile.async('blob');
				replacements.push(`url("${URL.createObjectURL(blob)}")`);
			} else replacements.push(`url("${resourceUrl}")`);
		}));
		let urlIndex = 0;
		return cssContent.replace(urlRegex, () => replacements[urlIndex++] || '');
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex h-screen flex-col bg-background font-sans">
	<header class="flex items-center justify-between border-b border-border bg-background px-6 py-4 shadow-sm">
		<Button variant="ghost" onclick={goBack} class="flex items-center gap-2"><ChevronLeft class="h-4 w-4" /></Button>
		<div class="max-w-xs text-left sm:text-center">
			<h1 class="truncate text-xl font-semibold text-foreground">{bookTitle}</h1>
			{#if chapters[currentChapter]}<p class="truncate text-sm text-muted-foreground">{chapters[currentChapter]?.title}</p>{/if}
		</div>
		<Button variant="outline" size="icon" class="rounded-full cursor-pointer" onclick={toggleDarkMode}>
			{#if darkMode}<Sun size={20} />{:else}<Moon size={20} />{/if}
		</Button>
	</header>

	<main class="flex-1 overflow-hidden">
		{#if loading}
			<div class="flex h-full flex-col items-center justify-center p-8"><div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div><p class="text-lg text-muted-foreground">Loading EPUB...</p></div>
		{:else if error}
			<div class="flex h-full items-center justify-center p-8"><Alert variant="destructive" class="max-w-md"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription><Button onclick={goBack} class="mt-4">Go Back</Button></Alert></div>
		{:else}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div 
					class="h-full bg-background overflow-hidden relative" 
					onclick={handleContentClick}
					ontouchstart={handleTouchStart}
					ontouchend={handleTouchEnd}
				>
					{#if isCalculating}
						<div class="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs transition-opacity duration-200">
							<div class="flex flex-col items-center gap-3">
								<div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
								<p class="text-xs font-medium text-muted-foreground animate-pulse">Arranging pages...</p>
							</div>
						</div>
					{/if}

					<div class="h-full w-full">
						{#if chapters[currentChapter]?.isCover}
							<div 
								class="h-full w-full bg-background transition-opacity duration-300 flex items-center justify-center"
								style="opacity: {isCalculating ? 0 : 1}"
							>
								<div class="h-full w-full p-0 m-0 flex items-center justify-center overflow-hidden cover-container">
									{@html chapters[currentChapter].content}
								</div>
							</div>
						{:else}
							<div class="h-full w-full flex justify-center">
								<div 
									class="h-full w-full max-w-3xl overflow-hidden bg-background px-8 py-8 shadow-sm border-x border-border" 
									bind:clientWidth={containerWidth}
								>
									<div 
										class="h-full w-full" 
										style="transform: translateX(-{currentPage * containerWidth}px); transition: {isCalculating ? 'none' : 'transform 0.3s ease-in-out'}; opacity: {isCalculating ? 0 : 1};"
									>
										<div 
											bind:this={contentContainer} 
											class="h-full prose prose-lg max-w-none" 
											style="column-width: {containerWidth ? `calc(${containerWidth}px - 4rem)` : '100%'}; column-gap: 4rem; column-fill: auto;"
										>
											{@html chapters[currentChapter].content}
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
		{/if}
	</main>

	<footer class="border-t border-border bg-background px-6 py-3 text-center">
		<p class="text-sm text-muted-foreground">
			Page {currentPage + 1} / {totalPages}
		</p>
	</footer>
</div>

<style>
	:global(.prose img) { max-width: 100%; height: auto; display: block; margin: 1rem auto; border-radius: 0.5rem; }
	:global(.prose .x-ebookmaker-coverpage), :global(.prose .x-ebookmaker-cover), :global(.cover-container .epub-content) { height: 100% !important; width: 100% !important; display: flex; align-items: center; justify-content: center; padding: 0 !important; margin: 0 !important; }
	:global(.cover-container img), :global(.cover-container svg) { max-width: 100% !important; max-height: 100% !important; width: auto !important; height: auto !important; object-fit: contain !important; margin: 0 auto !important; display: block !important; }
	:global(.prose p) { margin-bottom: 1rem; text-align: justify; }
	:global(.prose h1, .prose h2, .prose h3) { margin: 1.5rem 0 1rem 0; break-after: avoid; }
	:global(.prose > *) { break-inside: avoid; }
	
	/* Theming: Set base color but allow book CSS to override via specificity */
	:global(.prose) {
		color: hsl(var(--foreground));
	}
	
	:global(.epub-content) {
		color: inherit;
	}

	/* Force text colors in dark mode to prevent "gray" text from being unreadable */
	:global(.dark .prose), :global(.dark .prose *), :global(.dark .epub-content *) {
		color: hsl(var(--foreground)) !important;
	}
</style>
