import JSZip from 'jszip';

export interface EpubMeta {
	title: string;
	cover: string | null;
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
