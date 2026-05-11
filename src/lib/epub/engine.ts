import JSZip from 'jszip';
import sanitizeHtml from 'sanitize-html';
import { SvelteMap } from 'svelte/reactivity';

export interface EpubChapter {
	title: string;
	href: string;
	content: string;
	css: string;
	isCover?: boolean;
	isFrontmatter?: boolean;
}

export interface EpubMetadata {
	title: string;
	author: string;
	description: string;
	cover: string | null;
}

export class EpubEngine {
	private epub: JSZip | null = null;
	private basePath: string = '';
	private manifestMap = new SvelteMap<string, { href: string; mediaType: string; properties?: string }>();
	private tocTitles = new SvelteMap<string, string>();
	private cssMap = new SvelteMap<string, string>();
	
	public metadata: EpubMetadata = {
		title: 'Unknown Book',
		author: '',
		description: '',
		cover: null
	};

	constructor(private arrayBuffer: ArrayBuffer) {}

	async init() {
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

		const spineItems = opfDoc.querySelectorAll('spine itemref');
		const manifestItems = opfDoc.querySelectorAll('manifest item');
		
		manifestItems.forEach((item) => {
			const id = item.getAttribute('id');
			const href = item.getAttribute('href');
			const mediaType = item.getAttribute('media-type') || '';
			const properties = item.getAttribute('properties') || '';
			if (id && href) this.manifestMap.set(id, { href, mediaType, properties });
		});

		this.basePath = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);
		
		// Cover Extraction
		await this.extractCover(opfDoc);
		
		await this.loadTOC(opfDoc);
		await this.loadCSS(opfDoc);

		const spineInfos: Array<{ href: string; mediaType: string }> = [];
		for (const item of spineItems) {
			const idref = item.getAttribute('idref');
			if (idref && this.manifestMap.has(idref)) {
				spineInfos.push(this.manifestMap.get(idref)!);
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
					const links = tocDoc.querySelectorAll('nav[epub\\:type="toc"] a, nav[role="doc-toc"] a, nav a');
					links.forEach((a: Element) => {
						const href = a.getAttribute('href');
						const title = a.textContent?.trim();
						if (href && title) {
							const tocBase = tocHref.substring(0, tocHref.lastIndexOf('/') + 1);
							const resolvedHref = (href.startsWith('/') ? href.substring(1) : tocBase + href).replace(/\\/g, '/');
							const cleanHref = resolvedHref.split('#')[0];
							if (!this.tocTitles.has(cleanHref)) this.tocTitles.set(cleanHref, title);
							this.tocTitles.set(resolvedHref, title);
						}
					});
				}
			}
		}

		if (this.tocTitles.size === 0) {
			const spineToc = opfDoc.querySelector('spine');
			const ncxId = spineToc?.getAttribute('toc');
			let ncxHref = ncxId ? this.manifestMap.get(ncxId)?.href || null : null;
			
			if (!ncxHref) {
				for (const info of this.manifestMap.values()) {
					if (info.href.endsWith('.ncx')) { ncxHref = info.href; break; }
				}
			}

			if (ncxHref) {
				const ncxContent = await this.epub!.file(this.basePath + ncxHref)?.async('string');
				if (ncxContent) {
					const ncxDoc = parser.parseFromString(ncxContent, 'application/xml');
					const navPoints = ncxDoc.querySelectorAll('navPoint');
					navPoints.forEach((np: Element) => {
						const label = np.querySelector('navLabel text')?.textContent?.trim();
						const src = np.querySelector('content')?.getAttribute('src');
						if (label && src) {
							const ncxBase = ncxHref!.substring(0, ncxHref!.lastIndexOf('/') + 1);
							const resolvedSrc = (src.startsWith('/') ? src.substring(1) : ncxBase + src).replace(/\\/g, '/');
							const cleanSrc = resolvedSrc.split('#')[0];
							if (!this.tocTitles.has(cleanSrc)) this.tocTitles.set(cleanSrc, label);
							this.tocTitles.set(resolvedSrc, label);
						}
					});
				}
			}
		}
	}

	private async loadCSS(opfDoc: Document) {
		const cssItems = opfDoc.querySelectorAll('manifest item[media-type="text/css"]');
		for (const cssItem of cssItems) {
			const href = cssItem.getAttribute('href');
			if (href) {
				const cssContent = await this.epub!.file(this.basePath + href)?.async('string');
				if (cssContent) {
					const processedCSS = await this.processCSS(cssContent);
					this.cssMap.set(href, processedCSS);
				}
			}
		}
	}

	private async processCSS(cssContent: string): Promise<string> {
		const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
		const urls: string[] = [];
		const replacements: string[] = [];
		let match;
		while ((match = urlRegex.exec(cssContent)) !== null) {
			if (!match[1].startsWith('data:') && !match[1].startsWith('http')) {
				urls.push(match[1]);
			}
		}
		
		await Promise.all(urls.map(async (resourceUrl) => {
			const fullPath = (resourceUrl.startsWith('/') ? resourceUrl.substring(1) : this.basePath + resourceUrl.replace(/^\.\//, '')).replace(/\\/g, '/');
			const resourceFile = this.epub!.file(fullPath);
			if (resourceFile) {
				const blob = await resourceFile.async('blob');
				replacements.push(`url("${URL.createObjectURL(blob)}")`);
			} else {
				replacements.push(`url("${resourceUrl}")`);
			}
		}));
		
		let urlIndex = 0;
		return cssContent.replace(urlRegex, () => replacements[urlIndex++] || '');
	}

	async parseChapters(spineInfos: Array<{ href: string; mediaType: string }>): Promise<EpubChapter[]> {
		const chapters: EpubChapter[] = [];
		const parser = new DOMParser();

		for (const { href, mediaType } of spineInfos) {
			const fullPath = this.basePath + href;
			const normalizedHref = href.replace(/\\/g, '/');
			
			if (mediaType.startsWith('image/')) {
				const imageFile = this.epub!.file(fullPath);
				if (imageFile) {
					const blob = await imageFile.async('blob');
					const url = URL.createObjectURL(blob);
					const title = this.tocTitles.get(normalizedHref) || 'Image';
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

			const content = await this.epub!.file(fullPath)?.async('string');
			if (content) {
				const contentChapters = this.extractChaptersFromContent(content, href);
				for (const contentChapter of contentChapters) {
					const contentDoc = parser.parseFromString(contentChapter.content, 'text/html');
					let title = contentChapter.title;
					if (this.tocTitles.has(contentChapter.href)) {
						title = this.tocTitles.get(contentChapter.href)!;
					} else if (this.tocTitles.has(href)) {
						title = this.tocTitles.get(href)!;
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

					await this.resolveResources(contentDoc);

					const cssLinks = contentDoc.querySelectorAll('link[rel="stylesheet"]');
					let combinedCSS = '';
					for (const cssLink of cssLinks) {
						const cssHref = cssLink.getAttribute('href');
						if (cssHref && this.cssMap.has(cssHref)) {
							const css = this.cssMap.get(cssHref);
							if (css) combinedCSS += css + '\n';
						}
					}

					const rawContent = contentDoc.body?.innerHTML || '';
					const typographyStyles = `
						.epub-content { font-family: Georgia, serif; line-height: 1.6; font-size: 16px; color: inherit; max-width: 100%; overflow-wrap: break-word; } 
						.epub-content img { max-width: 100%; height: auto; display: block; margin: 1rem auto; }
						.epub-content p { margin-bottom: 1.2em; text-align: justify; }
						.epub-content h1, .epub-content h2, .epub-content h3 { color: inherit; margin-top: 1.5em; margin-bottom: 0.5em; }
					`;

					let cssForChapter = typographyStyles;
					if (combinedCSS) {
						const scopedCSS = combinedCSS.split('}').map(rule => {
							const parts = rule.split('{');
							if (parts.length !== 2) return rule;
							const selectors = parts[0];
							const declaration = parts[1];
							const scopedSelectors = selectors.split(',').map(s => s.trim() ? `.epub-content ${s.trim()}` : '').filter(Boolean).join(', ');
							return `${scopedSelectors} { ${declaration} }`;
						}).join('\n');
						cssForChapter = scopedCSS + typographyStyles;
					}

					const processedContent = sanitizeHtml(`<div class="epub-content">${rawContent}</div>`, {
						allowedTags: ['p', 'br', 'strong', 'em', 'u', 'i', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'img', 'svg', 'image', 'div', 'span'],
						allowedAttributes: { '*': ['class', 'id', 'style'], img: ['src'], svg: ['viewBox'], image: ['xlink:href', 'href'] },
						allowedSchemes: ['data', 'blob']
					});

					chapters.push({ title, href: contentChapter.href, content: processedContent, css: cssForChapter, isCover, isFrontmatter });
				}
			}
		}
		return chapters;
	}

	private extractChaptersFromContent(content: string, href: string) {
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
					chapters.push({ title, href: `${href}#${heading.id || ''}`, content: chapterDiv.innerHTML });
				}
			}
		} else {
			chapters.push({ 
				title: doc.querySelector('title')?.textContent?.trim() || doc.querySelector('h1, h2, h3')?.textContent?.trim() || `Chapter`, 
				href, 
				content: doc.body?.innerHTML || content 
			});
		}
		return chapters;
	}

	private async resolveResources(doc: Document) {
		const images = doc.querySelectorAll('img');
		for (const img of images) {
			const src = img.getAttribute('src');
			if (src) {
				const fullImagePath = (src.startsWith('/') ? src.substring(1) : this.basePath + src.replace(/^\.\//, '')).replace(/\\/g, '/');
				const imageFile = this.epub!.file(fullImagePath);
				if (imageFile) {
					const imageBlob = await imageFile.async('blob');
					img.setAttribute('src', URL.createObjectURL(imageBlob));
				}
			}
		}

		const svgImages = doc.querySelectorAll('svg image');
		for (const svgImg of svgImages) {
			const hrefAttr = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href');
			if (hrefAttr) {
				const fullImagePath = (hrefAttr.startsWith('/') ? hrefAttr.substring(1) : this.basePath + hrefAttr.replace(/^\.\//, '')).replace(/\\/g, '/');
				const imageFile = this.epub!.file(fullImagePath);
				if (imageFile) {
					const imageBlob = await imageFile.async('blob');
					const imageUrl = URL.createObjectURL(imageBlob);
					svgImg.setAttribute('xlink:href', imageUrl);
					svgImg.setAttribute('href', imageUrl);
				}
			}
		}

		const svgElements = doc.querySelectorAll('svg');
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
	}

	private async extractCover(opfDoc: Document) {
		let coverHref: string | null = null;
		const coverItem = Array.from(this.manifestMap.values()).find(item => item.properties?.includes('cover-image'));
		if (coverItem) coverHref = coverItem.href;
		if (!coverHref) {
			const coverMeta = opfDoc.querySelector('meta[name="cover"]');
			const coverId = coverMeta?.getAttribute('content');
			if (coverId && this.manifestMap.has(coverId)) coverHref = this.manifestMap.get(coverId)!.href;
		}
		if (!coverHref && this.manifestMap.has('cover')) coverHref = this.manifestMap.get('cover')!.href;
		if (coverHref) {
			const fullPath = this.basePath + coverHref;
			const imageFile = this.epub!.file(fullPath.replace(/\\/g, '/'));
			if (imageFile) {
				const blob = await imageFile.async('blob');
				this.metadata.cover = URL.createObjectURL(blob);
			}
		}
	}
}
