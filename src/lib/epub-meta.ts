import JSZip from 'jszip';

export interface EpubMeta {
	title: string;
	cover: string | null;
}

export interface EpubChapter {
	id: string;
	title: string;
	href: string;
	isFrontmatter?: boolean;
}

export interface EpubDetail extends EpubMeta {
	author: string;
	description: string;
	chapters: EpubChapter[];
}

const DC_NS = 'http://purl.org/dc/elements/1.1/';

function extractChaptersFromContent(content: string, href: string): EpubChapter[] {
	const parser = new DOMParser();
	const doc = parser.parseFromString(content, 'text/html');
	const chapters: EpubChapter[] = [];
	
	// Use headings (h1, h2) as potential chapter boundaries within a single file
	const headings = doc.querySelectorAll('h1, h2');
	
	if (headings.length > 1) {
		for (let i = 0; i < headings.length; i++) {
			const heading = headings[i];
			const title = heading.textContent?.trim();
			if (title) {
				chapters.push({
					id: `${href}_${i}`,
					title,
					href: `${href}#${heading.id || ''}`
				});
			}
		}
	} else {
		// Single heading or no headings - treat the whole file as one chapter
		const title = doc.querySelector('title')?.textContent?.trim() || 
					  doc.querySelector('h1, h2, h3')?.textContent?.trim() || 
					  `Chapter`;
		chapters.push({
			id: href,
			title,
			href
		});
	}
	
	return chapters;
}

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
				if (coverItem) coverHref = coverItem.getAttribute('href');
			}
		}
		if (!coverHref) {
			const coverItem = findElByAttrIncludes(opfDoc, 'item', 'properties', 'cover-image');
			if (coverItem) coverHref = coverItem.getAttribute('href');
		}
		if (!coverHref) {
			const coverItem = findElByAttrIncludes(opfDoc, 'item', 'id', 'cover');
			if (coverItem) {
				const mediaType = coverItem.getAttribute('media-type') || '';
				if (mediaType.startsWith('image/')) coverHref = coverItem.getAttribute('href');
			}
		}

		let coverDataUrl: string | null = null;
		if (coverHref) {
			let fullPath = coverHref;
			if (!coverHref.startsWith('/')) fullPath = basePath + coverHref;
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
		const manifestMap = new Map<string, { href: string; properties: string; mediaType: string }>();
		manifestItems.forEach((item) => {
			const id = item.getAttribute('id');
			const href = item.getAttribute('href');
			const props = item.getAttribute('properties') || '';
			const mediaType = item.getAttribute('media-type') || '';
			if (id && href) manifestMap.set(id, { href, properties: props, mediaType });
		});

		const spineHrefs: Array<{ href: string; mediaType: string }> = [];
		for (const item of spineItems) {
			const linear = item.getAttribute('linear');
			if (linear === 'no') continue;
			const idref = item.getAttribute('idref');
			if (idref && manifestMap.has(idref)) {
				const info = manifestMap.get(idref)!;
				spineHrefs.push({ href: info.href, mediaType: info.mediaType });
			}
		}

		// Try to find TOC file
		const tocTitles = new Map<string, string>();
		const navItem = opfDoc.querySelector('item[properties~="nav"]');
		if (navItem) {
			const tocHref = navItem.getAttribute('href');
			if (tocHref) {
				const tocPath = basePath + tocHref;
				const tocContent = await zip.file(tocPath)?.async('string');
				if (tocContent) {
					const tocDoc = parser.parseFromString(tocContent, 'text/html');
					const links = tocDoc.querySelectorAll('nav[epub\\:type="toc"] a, nav[role="doc-toc"] a, nav a');
					for (const a of links) {
						const href = a.getAttribute('href');
						const text = a.textContent?.trim();
						if (href && text) {
							const tocBase = tocHref.substring(0, tocHref.lastIndexOf('/') + 1);
							const resolvedHref = (href.startsWith('/') ? href.substring(1) : tocBase + href).replace(/\\/g, '/');
							const cleanHref = resolvedHref.split('#')[0];
							if (!tocTitles.has(cleanHref)) tocTitles.set(cleanHref, text);
							tocTitles.set(resolvedHref, text);
						}
					}
				}
			}
		}

		if (tocTitles.size === 0) {
			const spineToc = opfDoc.querySelector('spine');
			const ncxId = spineToc?.getAttribute('toc');
			let ncxHref = ncxId ? manifestMap.get(ncxId)?.href || null : null;
			if (!ncxHref) {
				for (const item of manifestItems) {
					const href = item.getAttribute('href');
					if (href && href.endsWith('.ncx')) { ncxHref = href; break; }
				}
			}
			if (ncxHref) {
				const ncxPath = basePath + ncxHref;
				const ncxContent = await zip.file(ncxPath)?.async('string');
				if (ncxContent) {
					const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
					const navPoints = ncxDoc.querySelectorAll('navPoint');
					for (const np of navPoints) {
						const label = np.querySelector('navLabel > text')?.textContent?.trim();
						const src = np.querySelector('content')?.getAttribute('src');
						if (label && src) {
							const ncxBase = ncxHref.substring(0, ncxHref.lastIndexOf('/') + 1);
							const resolvedSrc = (src.startsWith('/') ? src.substring(1) : ncxBase + src).replace(/\\/g, '/');
							const cleanSrc = resolvedSrc.split('#')[0];
							if (!tocTitles.has(cleanSrc)) tocTitles.set(cleanSrc, label);
							tocTitles.set(resolvedSrc, label);
						}
					}
				}
			}
		}

		const chapters: EpubChapter[] = [];
		let chapterIndex = 0;
		for (const { href, mediaType } of spineHrefs) {
			const normalizedHref = href.replace(/\\/g, '/');
			const fullPath = basePath + href;
			
			if (mediaType.startsWith('image/')) {
				// Handle image-only spine item
				let chapterTitle = 'Image';
				if (tocTitles.has(normalizedHref)) {
					chapterTitle = tocTitles.get(normalizedHref)!;
				}
				
				chapters.push({
					id: String(chapterIndex),
					title: chapterTitle,
					href: normalizedHref,
					isFrontmatter: chapterTitle.toLowerCase().includes('cover') || chapterIndex === 0
				});
				chapterIndex++;
				continue;
			}

			const content = await zip.file(fullPath)?.async('string');
			if (content) {
				const contentChapters = extractChaptersFromContent(content, href);
				for (const contentChapter of contentChapters) {
					let chapterTitle = contentChapter.title;
					if (tocTitles.has(contentChapter.href)) {
						chapterTitle = tocTitles.get(contentChapter.href)!;
					} else if (tocTitles.has(normalizedHref)) {
						chapterTitle = tocTitles.get(normalizedHref)!;
					}

					const titleLower = chapterTitle.toLowerCase();
					const isFrontmatter = titleLower.includes('cover') || 
										  titleLower.includes('title page') || 
										  titleLower.includes('half title') ||
										  titleLower.includes('dedication') ||
										  titleLower.includes('preface') ||
										  titleLower.includes('author\'s note') ||
										  titleLower.includes('introduction');

					chapters.push({
						...contentChapter,
						title: chapterTitle,
						id: String(chapterIndex),
						isFrontmatter
					});
					chapterIndex++;
				}
			}
		}

		return { title, cover: coverDataUrl, author, description, chapters };
	} catch (e) {
		console.error('[epub-meta] detail extraction failed:', e);
		return { title: 'Unknown Book', cover: null, author: '', description: '', chapters: [] };
	}
}
