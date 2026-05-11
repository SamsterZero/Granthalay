import JSZip from 'jszip';

export interface EpubMeta {
	title: string;
	cover: string | null;
}

export interface EpubChapter {
	id: string;
	title: string;
	href: string;
}

export interface EpubDetail extends EpubMeta {
	author: string;
	description: string;
	chapters: EpubChapter[];
}

const DC_NS = 'http://purl.org/dc/elements/1.1/';

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

/** Walk all elements in a document to find the first with matching localName and (optional) namespace */
function findEl(doc: Document, localName: string, namespace: string | null = null): Element | null {
	const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
	let node: Node | null;
	while ((node = walker.nextNode())) {
		const el = node as Element;
		if (el.localName === localName) {
			if (!namespace || el.namespaceURI === namespace) {
				return el;
			}
		}
	}
	return null;
}

/** Find first element matching localName whose attribute includes a value */
function findElByAttrIncludes(
	doc: Document,
	localName: string,
	attr: string,
	includes: string
): Element | null {
	const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
	let node: Node | null;
	while ((node = walker.nextNode())) {
		const el = node as Element;
		if (el.localName === localName) {
			const val = el.getAttribute(attr);
			if (val && val.includes(includes)) return el;
		}
	}
	return null;
}

export async function extractEpubMeta(buffer: ArrayBuffer): Promise<EpubMeta> {
	try {
		const zip = await JSZip.loadAsync(buffer);

		// 1. Find OPF via container.xml
		const containerXml = await zip.file('META-INF/container.xml')?.async('string');
		if (!containerXml) {
			console.warn('[epub-meta] No container.xml found');
			return { title: 'Unknown Book', cover: null };
		}

		const parser = new DOMParser();
		const containerDoc = parser.parseFromString(containerXml, 'application/xml');
		const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
		if (!rootfilePath) {
			console.warn('[epub-meta] No rootfile path found');
			return { title: 'Unknown Book', cover: null };
		}

		// 2. Parse OPF
		const opfContent = await zip.file(rootfilePath)?.async('string');
		if (!opfContent) {
			console.warn('[epub-meta] No OPF content found');
			return { title: 'Unknown Book', cover: null };
		}

		const opfDoc = parser.parseFromString(opfContent, 'application/xml');

		// 3. Extract title (namespace-aware)
		let title = 'Unknown Book';
		const dcTitle = findEl(opfDoc, 'title', DC_NS);
		if (dcTitle?.textContent) {
			title = dcTitle.textContent.trim();
		} else {
			const fallbackTitle = findEl(opfDoc, 'title', null);
			if (fallbackTitle?.textContent) {
				title = fallbackTitle.textContent.trim();
			}
		}
		console.debug('[epub-meta] title:', title);

		// 4. Find cover image href
		const basePath = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);
		let coverHref: string | null = null;

		// Method 1: <meta name="cover" content="..." />  (EPUB2 style)
		const coverMeta = findEl(opfDoc, 'meta', null);
		if (coverMeta && coverMeta.getAttribute('name') === 'cover') {
			const coverId = coverMeta.getAttribute('content');
			if (coverId) {
				const coverItem = findElByAttrIncludes(opfDoc, 'item', 'id', coverId);
				if (coverItem) {
					coverHref = coverItem.getAttribute('href');
					console.debug('[epub-meta] cover found via meta name=cover:', coverHref);
				}
			}
		}

		// Method 2: <item properties="cover-image" ... />  (EPUB3)
		if (!coverHref) {
			const coverItem = findElByAttrIncludes(opfDoc, 'item', 'properties', 'cover-image');
			if (coverItem) {
				coverHref = coverItem.getAttribute('href');
				console.debug('[epub-meta] cover found via properties=cover-image:', coverHref);
			}
		}

		// Method 3: <item id="cover" ... /> fallback
		if (!coverHref) {
			const coverItem = findElByAttrIncludes(opfDoc, 'item', 'id', 'cover');
			if (coverItem) {
				const mediaType = coverItem.getAttribute('media-type') || '';
				if (mediaType.startsWith('image/')) {
					coverHref = coverItem.getAttribute('href');
					console.debug('[epub-meta] cover found via id=cover:', coverHref);
				}
			}
		}

		// Method 4: first image in manifest
		if (!coverHref) {
			const walker = opfDoc.createTreeWalker(opfDoc.documentElement, NodeFilter.SHOW_ELEMENT);
			let node: Node | null;
			while ((node = walker.nextNode())) {
				const el = node as Element;
				if (el.localName === 'item') {
					const mt = el.getAttribute('media-type') || '';
					if (mt.startsWith('image/')) {
						coverHref = el.getAttribute('href');
						console.debug('[epub-meta] cover found via first image item:', coverHref);
						break;
					}
				}
			}
		}

		// 5. Extract cover image bytes → data URL
		let coverDataUrl: string | null = null;
		if (coverHref) {
			let fullPath = coverHref;
			if (!coverHref.startsWith('/')) {
				fullPath = basePath + coverHref;
			}
			// Normalize path separators for JSZip
			fullPath = fullPath.replace(/\\/g, '/');
			const imageFile = zip.file(fullPath);
			if (imageFile) {
				const imageBlob = await imageFile.async('blob');
				coverDataUrl = await blobToDataUrl(imageBlob);
				console.debug('[epub-meta] cover loaded, dataUrl length:', coverDataUrl.length);
			} else {
				console.warn('[epub-meta] cover file not found in zip:', fullPath);
			}
		}

		return { title, cover: coverDataUrl };
	} catch (e) {
		console.error('[epub-meta] extraction failed:', e);
		return { title: 'Unknown Book', cover: null };
	}
}

export async function extractEpubDetail(buffer: ArrayBuffer): Promise<EpubDetail> {
	try {
		const zip = await JSZip.loadAsync(buffer);
		const parser = new DOMParser();

		const containerXml = await zip.file('META-INF/container.xml')?.async('string');
		if (!containerXml) {
			return { title: 'Unknown Book', cover: null, author: '', description: '', chapters: [] };
		}

		const containerDoc = parser.parseFromString(containerXml, 'application/xml');
		const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
		if (!rootfilePath) {
			return { title: 'Unknown Book', cover: null, author: '', description: '', chapters: [] };
		}

		const opfContent = await zip.file(rootfilePath)?.async('string');
		if (!opfContent) {
			return { title: 'Unknown Book', cover: null, author: '', description: '', chapters: [] };
		}

		const opfDoc = parser.parseFromString(opfContent, 'application/xml');
		const basePath = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);

		// Title
		let title = 'Unknown Book';
		const dcTitle = findEl(opfDoc, 'title', DC_NS);
		if (dcTitle?.textContent) {
			title = dcTitle.textContent.trim();
		} else {
			const fallbackTitle = findEl(opfDoc, 'title', null);
			if (fallbackTitle?.textContent) {
				title = fallbackTitle.textContent.trim();
			}
		}

		// Author
		let author = '';
		const dcCreator = findEl(opfDoc, 'creator', DC_NS);
		if (dcCreator?.textContent) {
			author = dcCreator.textContent.trim();
		}

		// Description
		let description = '';
		const dcDesc = findEl(opfDoc, 'description', DC_NS);
		if (dcDesc?.textContent) {
			description = dcDesc.textContent.trim();
		}

		// Cover
		let coverHref: string | null = null;

		const coverMeta = findEl(opfDoc, 'meta', null);
		if (coverMeta && coverMeta.getAttribute('name') === 'cover') {
			const coverId = coverMeta.getAttribute('content');
			if (coverId) {
				const coverItem = findElByAttrIncludes(opfDoc, 'item', 'id', coverId);
				if (coverItem) {
					coverHref = coverItem.getAttribute('href');
				}
			}
		}

		if (!coverHref) {
			const coverItem = findElByAttrIncludes(opfDoc, 'item', 'properties', 'cover-image');
			if (coverItem) {
				coverHref = coverItem.getAttribute('href');
			}
		}

		if (!coverHref) {
			const coverItem = findElByAttrIncludes(opfDoc, 'item', 'id', 'cover');
			if (coverItem) {
				const mediaType = coverItem.getAttribute('media-type') || '';
				if (mediaType.startsWith('image/')) {
					coverHref = coverItem.getAttribute('href');
				}
			}
		}

		if (!coverHref) {
			const walker = opfDoc.createTreeWalker(opfDoc.documentElement, NodeFilter.SHOW_ELEMENT);
			let node: Node | null;
			while ((node = walker.nextNode())) {
				const el = node as Element;
				if (el.localName === 'item') {
					const mt = el.getAttribute('media-type') || '';
					if (mt.startsWith('image/')) {
						coverHref = el.getAttribute('href');
						break;
					}
				}
			}
		}

		let coverDataUrl: string | null = null;
		if (coverHref) {
			let fullPath = coverHref;
			if (!coverHref.startsWith('/')) {
				fullPath = basePath + coverHref;
			}
			fullPath = fullPath.replace(/\\/g, '/');
			const imageFile = zip.file(fullPath);
			if (imageFile) {
				const imageBlob = await imageFile.async('blob');
				coverDataUrl = await blobToDataUrl(imageBlob);
			}
		}

		// Chapters - try TOC first for proper names
		const spineItems = opfDoc.querySelectorAll('spine itemref');
		const manifestItems = opfDoc.querySelectorAll('manifest item');
		const manifestMap = new Map<string, { href: string; properties: string }>();
		manifestItems.forEach((item) => {
			const id = item.getAttribute('id');
			const href = item.getAttribute('href');
			const props = item.getAttribute('properties') || '';
			if (id && href) manifestMap.set(id, { href, properties: props });
		});

		// Detect cover href(s) to skip
		const coverHrefs = new Set<string>();
		for (const item of manifestItems) {
			const props = item.getAttribute('properties') || '';
			const id = item.getAttribute('id') || '';
			if (props.includes('cover-image') || id.toLowerCase() === 'cover') {
				const href = item.getAttribute('href');
				if (href) coverHrefs.add(href.replace(/\\/g, '/'));
			}
		}

		// Build spine order array, skipping linear="no" and cover items
		const spineHrefs: string[] = [];
		for (const item of spineItems) {
			const linear = item.getAttribute('linear');
			if (linear === 'no') continue;

			const idref = item.getAttribute('idref');
			if (idref && manifestMap.has(idref)) {
				const { href } = manifestMap.get(idref)!;
				const normHref = href.replace(/\\/g, '/');
				// Skip if this is the cover image itself
				if (coverHrefs.has(normHref)) continue;
				spineHrefs.push(href);
			}
		}

		// Try to find TOC file
		const tocTitles = new Map<string, string>();

		// EPUB3: nav document
		const navItem = findElByAttrIncludes(opfDoc, 'item', 'properties', 'nav');
		if (navItem) {
			const tocHref = navItem.getAttribute('href');
			if (tocHref) {
				const tocPath = basePath + tocHref;
				const tocContent = await zip.file(tocPath)?.async('string');
				if (tocContent) {
					const tocDoc = parser.parseFromString(tocContent, 'text/html');
					const navEls = tocDoc.querySelectorAll('nav');
					for (const nav of navEls) {
						const epubType = nav.getAttribute('epub:type') || nav.getAttributeNS('http://www.idpf.org/2007/ops', 'type');
						if (!epubType || epubType.includes('toc')) {
							const links = nav.querySelectorAll('a');
							for (const a of links) {
								const href = a.getAttribute('href');
								if (href) {
									const tocBase = tocHref.substring(0, tocHref.lastIndexOf('/') + 1);
									const resolvedHref = href.startsWith('/') ? href.substring(1) : tocBase + href;
									const text = a.textContent?.trim();
									if (text) {
										// Use the full href with fragment to preserve all chapters
										tocTitles.set(resolvedHref.replace(/\\/g, '/'), text);
									}
								}
							}
						}
					}
				}
			}
		}

		// EPUB2: NCX fallback
		if (tocTitles.size === 0) {
			const spineToc = opfDoc.querySelector('spine');
			const tocAttr = spineToc?.getAttribute('toc');
			let ncxHref: string | null = null;
			if (tocAttr && manifestMap.has(tocAttr)) {
				ncxHref = manifestMap.get(tocAttr)!.href;
			} else {
				for (const item of manifestItems) {
					const href = item.getAttribute('href');
					if (href && href.endsWith('.ncx')) {
						ncxHref = href;
						break;
					}
				}
			}
			if (ncxHref) {
				const ncxPath = basePath + ncxHref;
				const ncxContent = await zip.file(ncxPath)?.async('string');
				if (ncxContent) {
					const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
					// Get ALL navPoints, including nested ones
					const navPoints = ncxDoc.querySelectorAll('navPoint');
					for (const np of navPoints) {
						const labelEl = np.querySelector('navLabel > text');
						const contentEl = np.querySelector('content');
						if (labelEl && contentEl) {
							const label = labelEl.textContent?.trim();
							const src = contentEl.getAttribute('src');
							if (label && src) {
								const cleanSrc = src.split('#')[0];
								const ncxBase = ncxHref.substring(0, ncxHref.lastIndexOf('/') + 1);
								const resolvedSrc = cleanSrc.startsWith('/') ? cleanSrc.substring(1) : ncxBase + cleanSrc;
								if (!tocTitles.has(resolvedSrc)) {
									tocTitles.set(resolvedSrc.replace(/\\/g, '/'), label);
								}
							}
						}
					}
				}
			}
		}

		// Build chapters: prioritize TOC entries over spine items
		const chapters: EpubChapter[] = [];
		let chapterIndex = 0;
		const seenHrefs = new Set<string>();

		console.debug('[epub-meta] Chapter extraction starting');
		console.debug('[epub-meta] Total spine hrefs:', spineHrefs.length);
		console.debug('[epub-meta] Spine hrefs:', spineHrefs);
		console.debug('[epub-meta] TOC titles found:', tocTitles.size);
		console.debug('[epub-meta] TOC entries:', Array.from(tocTitles.entries()));

		// If we have TOC entries, use them as the primary source of chapters
		if (tocTitles.size > 0) {
			console.debug('[epub-meta] Using TOC entries as primary chapter source');
			
			// Create a map of spine items for validation
			const spineMap = new Map<string, string>();
			for (const href of spineHrefs) {
				const normalizedHref = href.replace(/\\/g, '/');
				const fullPath = (basePath + href).replace(/\\/g, '/');
				spineMap.set(normalizedHref, fullPath);
				spineMap.set(fullPath, normalizedHref);
				
				// Also add filename-only mapping
				const fileName = normalizedHref.split('/').pop();
				if (fileName) {
					spineMap.set(fileName, normalizedHref);
				}
			}
			
			// Process TOC entries in order
			for (const [tocHref, tocTitle] of tocTitles) {
				console.debug(`[epub-meta] Processing TOC entry: "${tocTitle}" -> ${tocHref}`);
				
				// Extract the base href (remove fragment) for spine matching
				const [baseHref] = tocHref.split('#');
				
				// Try to find the actual spine href that matches this TOC entry
				let actualHref = null;
				
				// Direct match
				if (spineMap.has(baseHref)) {
					actualHref = spineMap.get(baseHref);
				}
				// Try with base path
				else if (spineMap.has(basePath + baseHref)) {
					actualHref = spineMap.get(basePath + baseHref);
				}
				// Try filename matching
				else {
					const fileName = baseHref.split('/').pop();
					if (fileName && spineMap.has(fileName)) {
						actualHref = spineMap.get(fileName);
					}
				}
				
				if (!actualHref) {
					console.debug(`[epub-meta] No spine match found for TOC entry "${tocTitle}", using TOC href directly`);
					actualHref = baseHref;
				}
				
				// Skip if this looks like a cover or title page
				const titleLower = tocTitle.toLowerCase();
				if (titleLower.includes('cover') || (titleLower.includes('title') && chapterIndex === 0)) {
					console.debug(`[epub-meta] Skipping cover/title page: "${tocTitle}"`);
					continue;
				}
				
				// Use the full TOC href (including fragment) to avoid duplicates
				const normalizedTocHref = tocHref.replace(/\\/g, '/');
				if (seenHrefs.has(normalizedTocHref)) {
					console.debug(`[epub-meta] Skipping duplicate TOC href: ${normalizedTocHref}`);
					continue;
				}
				
				console.debug(`[epub-meta] Adding chapter ${chapterIndex + 1}: "${tocTitle}" (${tocHref})`);
				seenHrefs.add(normalizedTocHref);
				chapters.push({
					id: String(chapterIndex),
					title: tocTitle,
					href: tocHref
				});
				chapterIndex++;
			}
		} else {
			// Fallback to spine-based extraction if no TOC
			console.debug('[epub-meta] No TOC found, falling back to spine-based extraction');
			
			for (const href of spineHrefs) {
				const normalizedHref = href.replace(/\\/g, '/');
				let chapterTitle = tocTitles.get(normalizedHref);

				console.debug(`[epub-meta] Processing spine item ${chapterIndex + 1}: ${normalizedHref}`);

				if (!chapterTitle) {
					// Try resolving against basePath for TOC match
					const fullPath = (basePath + href).replace(/\\/g, '/');
					chapterTitle = tocTitles.get(fullPath);
					console.debug(`[epub-meta] Tried full path "${fullPath}": ${chapterTitle ? 'found' : 'not found'}`);
				}

				if (!chapterTitle) {
					// Try matching by filename only (TOC may use different relative path)
					const fileName = normalizedHref.split('/').pop();
					if (fileName) {
						for (const [tocHref, tocTitle] of tocTitles) {
							if (tocHref.endsWith('/' + fileName) || tocHref === fileName) {
								chapterTitle = tocTitle;
								console.debug(`[epub-meta] Found match by filename "${fileName}": "${tocTitle}"`);
								break;
							}
						}
					}
				}

				if (!chapterTitle) {
					// Fall back to HTML <title>
					const fullPath = basePath + href;
					const content = await zip.file(fullPath)?.async('string');
					if (content) {
						const contentDoc = parser.parseFromString(content, 'text/html');
						chapterTitle = contentDoc.querySelector('title')?.textContent?.trim();
						console.debug(`[epub-meta] Used HTML title for "${href}": "${chapterTitle}"`);
					}
				}

				if (!chapterTitle) {
					chapterTitle = `Chapter ${chapterIndex + 1}`;
					console.debug(`[epub-meta] Using fallback title for "${href}": "${chapterTitle}"`);
				}

				// Skip duplicate hrefs and cover pages
				if (!seenHrefs.has(normalizedHref)) {
					// Also skip if title looks like a cover
					const titleLower = chapterTitle.toLowerCase();
					if (titleLower.includes('cover') && chapterIndex === 0) {
						console.debug(`[epub-meta] Skipping cover page: "${chapterTitle}" (${normalizedHref})`);
						seenHrefs.add(normalizedHref);
						continue;
					}
					console.debug(`[epub-meta] Adding chapter ${chapterIndex + 1}: "${chapterTitle}" (${normalizedHref})`);
					seenHrefs.add(normalizedHref);
					chapters.push({
						id: String(chapterIndex),
						title: chapterTitle,
						href
					});
					chapterIndex++;
				} else {
					console.debug(`[epub-meta] Skipping duplicate href: ${normalizedHref}`);
				}
			}
		}

		console.debug(`[epub-meta] Chapter extraction complete. Total chapters: ${chapters.length}`);

		return { title, cover: coverDataUrl, author, description, chapters };
	} catch (e) {
		console.error('[epub-meta] detail extraction failed:', e);
		return { title: 'Unknown Book', cover: null, author: '', description: '', chapters: [] };
	}
}
