import JSZip from 'jszip';
import sanitizeHtml from 'sanitize-html';

export interface EpubChapter {
	title: string;
	href: string;
	content: string;
	css: string;
	isCover?: boolean;
	isFrontmatter?: boolean;
	error?: string;
}

export interface EpubMetadata {
	title: string;
	author: string;
	description: string;
	cover: string | Blob | null;
}

export class EpubEngine {
	private epub: JSZip | null = null;
	private basePath: string = '';
	private manifestMap = new Map<string, { href: string; mediaType: string; properties?: string }>();
	private tocTitles = new Map<string, string>();
	private cssMap = new Map<string, string>();
	private blobUrls: string[] = [];
	private textStartId: string | null = null;
	
	public metadata: EpubMetadata = {
		title: 'Unknown Book',
		author: '',
		description: '',
		cover: null
	};

	constructor(private arrayBuffer: ArrayBuffer) {}

	public destroy() {
		this.blobUrls.forEach(url => URL.revokeObjectURL(url));
		this.blobUrls = [];
	}

	private createObjectURL(blob: Blob): string {
		const url = URL.createObjectURL(blob);
		this.blobUrls.push(url);
		return url;
	}

	async init(metadataOnly = false) {
		this.epub = await JSZip.loadAsync(this.arrayBuffer);

		const containerXml = await this.epub!.file('META-INF/container.xml')?.async('string');
		if (!containerXml) throw new Error('Invalid EPUB: No container.xml found');

		const parser = new DOMParser();
		const containerDoc = parser.parseFromString(containerXml, 'application/xml');
		const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
		if (!rootfilePath) throw new Error('Invalid EPUB: No rootfile found');

		const opfContent = await this.epub!.file(rootfilePath)?.async('string');
		if (!opfContent) throw new Error('Invalid EPUB: No OPF file found');

		const opfDoc = parser.parseFromString(opfContent, 'application/xml');
		
		// Basic Metadata

		this.metadata.title = opfDoc.querySelector('title')?.textContent || 'Unknown Book';
		this.metadata.author = opfDoc.querySelector('creator')?.textContent || '';
		this.metadata.description = opfDoc.querySelector('description')?.textContent || '';

		// CRITICAL: basePath must be set BEFORE resolving guide/TOC/CSS paths
		this.basePath = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);
		
		// Identify where the "actual" content starts (EPUB 2 Guide)
		const guideText = opfDoc.querySelector('reference[type="text"]');
		if (guideText) {
			const guideHref = guideText.getAttribute('href')?.split('#')[0];
			if (guideHref) {
				// Normalize path relative to the OPF file's location
				this.textStartId = this.resolvePath(rootfilePath, guideHref);
			}
		}

		// Cover Extraction
		await this.extractCover(opfDoc);
		
		if (metadataOnly) return;
		
		await this.loadTOC(opfDoc);
		await this.loadCSS(opfDoc);

		const spineItems = opfDoc.querySelectorAll('spine itemref');
		const manifestItems = opfDoc.querySelectorAll('manifest item');
		
		manifestItems.forEach((item) => {
			const id = item.getAttribute('id');
			const href = item.getAttribute('href');
			const mediaType = item.getAttribute('media-type') || '';
			const properties = item.getAttribute('properties') || '';
			if (id && href) this.manifestMap.set(id, { href, mediaType, properties });
		});

		// Cover Extraction
		await this.extractCover(opfDoc);
		
		await this.loadTOC(opfDoc);
		await this.loadCSS(opfDoc);

		const spineInfos: Array<{ href: string; mediaType: string; linear: boolean }> = [];
		for (const item of spineItems) {
			const idref = item.getAttribute('idref');
			const linear = item.getAttribute('linear') !== 'no';
			if (idref && this.manifestMap.has(idref)) {
				spineInfos.push({ ...this.manifestMap.get(idref)!, linear });
			}
		}

		return spineInfos;
	}

	private async loadTOC(opfDoc: Document) {
		const parser = new DOMParser();
		const navItem = opfDoc.querySelector('item[properties~="nav"]');
		if (navItem) {
			const tocHref = navItem.getAttribute('href');
			if (tocHref) {
				const tocPath = this.basePath + tocHref;
				const tocContent = await this.epub!.file(tocPath)?.async('string');
				if (tocContent) {
					const tocDoc = parser.parseFromString(tocContent, 'text/html');
					// Only get top-level links from the primary TOC list
					const tocNav = tocDoc.querySelector('nav[epub\\:type="toc"], nav[role="doc-toc"], nav');
					const links = tocNav ? tocNav.querySelectorAll(':scope > ol > li > a, :scope > ul > li > a') : [];
					
					// If we didn't find top-level links with strict selectors, fallback to first-level 'a' tags
					const finalLinks = links.length > 0 ? links : tocDoc.querySelectorAll('nav a, ol > li > a');

					finalLinks.forEach((a: Element) => {
						const href = a.getAttribute('href');
						const title = a.textContent?.trim();
						if (href && title) {
							const resolvedPath = this.resolvePath(tocPath, href);
							const cleanHref = resolvedPath.split('#')[0];
							
							if (!this.tocTitles.has(cleanHref)) this.tocTitles.set(cleanHref, title);
							this.tocTitles.set(resolvedPath, title);
						}
					});
				}
			}
		}

		// Fallback to NCX if EPUB3 TOC is missing or sparse
		if (this.tocTitles.size < 3) {
			const spineToc = opfDoc.querySelector('spine');
			const ncxId = spineToc?.getAttribute('toc');
			let ncxHref = ncxId ? this.manifestMap.get(ncxId)?.href || null : null;
			
			if (!ncxHref) {
				for (const info of this.manifestMap.values()) {
					if (info.href.endsWith('.ncx')) { ncxHref = info.href; break; }
				}
			}

			if (ncxHref) {
				const ncxPath = this.basePath + ncxHref;
				const ncxContent = await this.epub!.file(ncxPath)?.async('string');
				if (ncxContent) {
					const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
					// Only get top-level navPoints from the navMap
					const navMap = ncxDoc.querySelector('navMap');
					const navPoints = navMap ? navMap.querySelectorAll(':scope > navPoint') : ncxDoc.getElementsByTagName('navPoint');
					
					Array.from(navPoints).forEach((np: Element) => {
						const labelEl = np.getElementsByTagName('text')[0];
						const contentEl = np.getElementsByTagName('content')[0];
						const label = labelEl?.textContent?.trim();
						const src = contentEl?.getAttribute('src');
						
						if (label && src) {
							const resolvedPath = this.resolvePath(ncxPath, src);
							const cleanHref = resolvedPath.split('#')[0];
							
							if (!this.tocTitles.has(cleanHref)) this.tocTitles.set(cleanHref, label);
							this.tocTitles.set(resolvedPath, label);
						}
					});
				}
			}
		}
	}

	private resolvePath(currentPath: string, relativePath: string): string {
		if (relativePath.startsWith('data:') || relativePath.includes('://')) return relativePath;
		const baseParts = currentPath.split('/').filter(p => p && p !== '.');
		baseParts.pop(); // Remove the filename
		const relParts = relativePath.split('/').filter(p => p && p !== '.');
		for (const part of relParts) {
			if (part === '..') baseParts.pop();
			else baseParts.push(part);
		}
		return baseParts.join('/');
	}

	private async loadCSS(opfDoc: Document) {
		const cssItems = opfDoc.querySelectorAll('manifest item[media-type="text/css"]');
		for (const cssItem of cssItems) {
			const href = cssItem.getAttribute('href');
			if (href) {
				const fullPath = this.basePath + href;
				try {
					const cssContent = await this.epub!.file(fullPath)?.async('string');
					if (cssContent) {
						const processedCSS = await this.processCSS(cssContent, fullPath);
						this.cssMap.set(fullPath, processedCSS);
					}
				} catch (e) {
					console.error(`[EpubEngine] Failed to load CSS: ${fullPath}`, e);
				}
			}
		}
	}

	private async processCSS(cssContent: string, cssFilePath: string): Promise<string> {
		const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
		const replacements = new Map<string, string>();
		const matches = Array.from(cssContent.matchAll(urlRegex));
		
		await Promise.all(matches.map(async (match) => {
			const resourceUrl = match[1];
			if (resourceUrl.startsWith('data:') || resourceUrl.startsWith('http')) return;
			
			const fullPath = this.resolvePath(cssFilePath, resourceUrl);
			try {
				const resourceFile = this.epub!.file(fullPath);
				if (resourceFile) {
					const blob = await resourceFile.async('blob');
					replacements.set(resourceUrl, `url("${this.createObjectURL(blob)}")`);
				}
			} catch (e) {
				console.warn(`[EpubEngine] CSS resource failed: ${fullPath}`, e);
			}
		}));
		
		return cssContent.replace(urlRegex, (match, url) => replacements.get(url) || match);
	}

	async parseChapters(spineInfos: Array<{ href: string; mediaType: string; linear?: boolean }>): Promise<EpubChapter[]> {
		const chapters: EpubChapter[] = [];
		const parser = new DOMParser();
		let hasReachedTextStart = false;

		// Track current logical title for "continued" grouping
		let currentLogicalTitle = 'Frontmatter';

		for (const { href, mediaType, linear } of spineInfos) {
			if (linear === false) continue;

			const fullPath = this.basePath + href;
			const normalizedHref = fullPath.replace(/\\/g, '/');
			
			if (this.textStartId && normalizedHref === this.textStartId) {
				hasReachedTextStart = true;
			}
			
			// Get the TOC title for this physical file
			const tocTitle = this.tocTitles.get(normalizedHref);
			if (tocTitle) {
				currentLogicalTitle = tocTitle;
			}

			try {
				if (mediaType.startsWith('image/')) {
					const imageFile = this.epub!.file(fullPath);
					if (imageFile) {
						const blob = await imageFile.async('blob');
						const url = this.createObjectURL(blob);
						const isCover = currentLogicalTitle.toLowerCase().includes('cover') || chapters.length === 0;
						
						chapters.push({
							title: chapters.some(c => c.title === currentLogicalTitle) ? `${currentLogicalTitle} (cont.)` : currentLogicalTitle,
							href: normalizedHref,
							content: `<div class="epub-content epub-illustrated-page">
								<img src="${url}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
							</div>`,
							css: '',
							isCover,
							isFrontmatter: !hasReachedTextStart && chapters.length === 0
						});
					}
				} else {
					const content = await this.epub!.file(fullPath)?.async('string');
					if (content) {
						const doc = parser.parseFromString(content, 'text/html');
						
						// Identify cover files
						const titleLower = currentLogicalTitle.toLowerCase();
						const isFirstChapter = chapters.length === 0;
						const isCover = !!(titleLower.includes('cover') || (isFirstChapter && doc.querySelector('svg, img') && !titleLower.includes('chapter')));

						await this.resolveResources(doc, fullPath);

						// Extract and scope CSS
						const css = this.extractAndScopeCSS(doc, fullPath);

						// Sanitize content
						const sanitized = sanitizeHtml(doc.body.innerHTML, {
							allowedTags: [
								'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
								'ul', 'ol', 'li', 'blockquote', 'img', 'svg', 'image', 'div', 'span',
								'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption',
								'figure', 'figcaption', 'ruby', 'rt', 'rp', 'section', 'article', 'main'
							],
							allowedAttributes: { 
								'*': ['class', 'id', 'style'], 
								'img': ['src', 'alt'], 
								'svg': ['viewBox', 'preserveAspectRatio', 'width', 'height', 'version', 'xmlns', 'xmlns:xlink', 'x', 'y'],
								'image': ['xlink:href', 'href', 'width', 'height', 'x', 'y', 'preserveAspectRatio']
							},
							allowedSchemes: ['data', 'blob', 'http', 'https']
						});

						chapters.push({
							title: chapters.some(c => c.title === currentLogicalTitle) ? `${currentLogicalTitle} (cont.)` : currentLogicalTitle,
							href: normalizedHref,
							content: `<div class="epub-content">${sanitized}</div>`,
							css: css,
							isCover,
							isFrontmatter: !hasReachedTextStart && chapters.length === 0
						});
					}
				}
			} catch (e) {
				console.error(`[EpubEngine] Failed to parse item: ${fullPath}`, e);
			}
		}

		// Final pass: Global styles and safety
		const globalStyles = `
			.epub-content { font-family: Georgia, serif; line-height: 1.6; font-size: 16px; color: inherit; }
			.epub-content img { max-width: 100%; height: auto; display: block; margin: 1rem auto; }
			.epub-content svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
		`;

		return chapters.map(ch => ({
			...ch,
			css: globalStyles + ch.css
		}));
	}

	private extractAndScopeCSS(doc: Document, fullPath: string): string {
		const cssLinks = doc.querySelectorAll('link[rel="stylesheet"]');
		let combinedCSS = '';
		for (const cssLink of cssLinks) {
			const cssHref = cssLink.getAttribute('href');
			if (cssHref) {
				const fullCssPath = this.resolvePath(fullPath, cssHref);
				const css = this.cssMap.get(fullCssPath);
				if (css) combinedCSS += css + '\n';
			}
		}
		return combinedCSS ? this.scopeCSS(combinedCSS, '.epub-content') : '';
	}

	private splitByAnchors(doc: Document, anchors: Array<{ anchor: string, title: string }>) {
		const results: Array<{ title: string, anchor: string, doc: Document }> = [];
		
		for (let i = 0; i < anchors.length; i++) {
			const current = anchors[i];
			const next = anchors[i + 1];
			
			const newDoc = document.implementation.createHTMLDocument();
			const startEl = doc.getElementById(current.anchor);
			
			if (startEl) {
				let node: Node | null = startEl;
				while (node) {
					if (next && node instanceof Element && node.id === next.anchor) break;
					newDoc.body.appendChild(node.cloneNode(true));
					node = node.nextSibling;
				}
			}
			
			results.push({ title: current.title, anchor: current.anchor, doc: newDoc });
		}
		
		return results;
	}


	private async resolveResources(doc: Document, contentFilePath: string) {
		const images = doc.querySelectorAll('img');
		for (const img of images) {
			const src = img.getAttribute('src');
			if (src) {
				const fullImagePath = this.resolvePath(contentFilePath, src);
				const imageFile = this.epub!.file(fullImagePath);
				if (imageFile) {
					const imageBlob = await imageFile.async('blob');
					img.setAttribute('src', this.createObjectURL(imageBlob));
				}
			}
		}

		const svgImages = doc.querySelectorAll('svg image');
		for (const svgImg of svgImages) {
			const hrefAttr = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href');
			if (hrefAttr) {
				const fullImagePath = this.resolvePath(contentFilePath, hrefAttr);
				const imageFile = this.epub!.file(fullImagePath);
				if (imageFile) {
					const imageBlob = await imageFile.async('blob');
					const imageUrl = this.createObjectURL(imageBlob);
					svgImg.setAttribute('xlink:href', imageUrl);
					svgImg.setAttribute('href', imageUrl);
				}
			}
		}

		const svgElements = doc.querySelectorAll('svg');
		for (const svg of svgElements) {
			const imageElement = svg.querySelector('image');
			if (imageElement) {
				// We MUST keep viewBox and preserveAspectRatio for illustrated books to render correctly
				svg.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 0 auto;');
				
				// Ensure the image inside fills its container logically
				if (!imageElement.getAttribute('preserveAspectRatio')) {
					imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
				}
			}
		}
	}

	private async extractCover(opfDoc: Document) {
		// 1. Try standard EPUB 3 manifest properties
		let coverItem = opfDoc.querySelector('manifest item[properties~="cover-image"]') || 
						opfDoc.querySelector('manifest item[properties="cover-image"]');
		
		// 2. Try common EPUB 2 ID patterns
		if (!coverItem) {
			coverItem = opfDoc.querySelector('manifest item[id="cover-image"]') || 
						opfDoc.querySelector('manifest item[id="cover"]') ||
						opfDoc.querySelector('manifest item[id="coverimage"]');
		}

		let coverHref = coverItem?.getAttribute('href');
		
		// 3. Try metadata meta tag (common in older books)
		if (!coverHref) {
			const metaCoverId = opfDoc.querySelector('metadata meta[name="cover"]')?.getAttribute('content');
			if (metaCoverId) coverHref = this.manifestMap.get(metaCoverId)?.href;
		}

		// 4. Final Fallback: Look for any image in the manifest that has "cover" in its ID or filename
		if (!coverHref) {
			const allItems = Array.from(opfDoc.querySelectorAll('manifest item'));
			const fallbackItem = allItems.find(item => {
				const id = item.getAttribute('id')?.toLowerCase() || '';
				const href = item.getAttribute('href')?.toLowerCase() || '';
				const type = item.getAttribute('media-type') || '';
				return type.startsWith('image/') && (id.includes('cover') || href.includes('cover'));
			});
			coverHref = fallbackItem?.getAttribute('href');
		}

		if (coverHref) {
			const fullPath = this.resolvePath(this.basePath + 'opf', coverHref);
			const imageFile = this.epub!.file(fullPath);
			if (imageFile) {
				this.metadata.cover = await imageFile.async('blob');
			}
		}
	}

	private scopeCSS(css: string, scopeSelector: string): string {
		// NOTE: This is not a full CSS parser. It handles most EPUB stylesheets 
		// but may misfire on complex attribute selectors or certain minified edge cases.
		
		// Remove comments to simplify processing
		const cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '');
		
		// This regex finds CSS rules while avoiding @-rules and handling nested blocks roughly
		// It's still not a full parser, but much more resilient than splitting by '}'
		return cleanCSS.replace(/([^\r\n,{}]+)(?=[^{]*\{)/g, (match) => {
			const trimmed = match.trim();
			if (!trimmed || trimmed.startsWith('@') || trimmed.startsWith('from') || trimmed.startsWith('to') || /^\d/.test(trimmed)) {
				return match;
			}
			return trimmed.split(',').map(s => `${scopeSelector} ${s.trim()}`).join(', ');
		});
	}
}
