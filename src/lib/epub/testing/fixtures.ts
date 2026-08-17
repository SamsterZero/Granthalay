import JSZip from 'jszip';

const PNG_PIXEL = Uint8Array.from(
	Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
		'base64'
	)
);

const CONTAINER = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

function addRequiredFiles(zip: JSZip) {
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
	zip.file('META-INF/container.xml', CONTAINER);
}

export async function createEpub2Fixture(): Promise<ArrayBuffer> {
	const zip = new JSZip();
	addRequiredFiles(zip);
	zip.file(
		'OEBPS/content.opf',
		`<?xml version="1.0"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Minimal EPUB 2</dc:title><dc:creator>Granthalay</dc:creator>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="cover-image" href="images/cover.png" media-type="image/png"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-one" href="text/chapter-one.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-two" href="text/chapter-two.xhtml" media-type="application/xhtml+xml"/>
    <item id="styles" href="styles/book.css" media-type="text/css"/>
  </manifest>
  <spine toc="ncx"><itemref idref="cover"/><itemref idref="chapter-one"/><itemref idref="chapter-two"/></spine>
  <guide><reference type="text" title="Start" href="text/chapter-one.xhtml"/></guide>
</package>`
	);
	zip.file(
		'OEBPS/toc.ncx',
		`<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint id="cover"><navLabel><text>Cover</text></navLabel><content src="cover.xhtml"/></navPoint>
    <navPoint id="one"><navLabel><text>Chapter One</text></navLabel><content src="text/chapter-one.xhtml"/></navPoint>
    <navPoint id="two"><navLabel><text>Chapter Two</text></navLabel><content src="text/chapter-two.xhtml"/></navPoint>
  </navMap>
</ncx>`
	);
	zip.file(
		'OEBPS/cover.xhtml',
		'<html><body><img src="images/cover.png" alt="Minimal cover"/></body></html>'
	);
	zip.file(
		'OEBPS/text/chapter-one.xhtml',
		'<html><head><link rel="stylesheet" href="../styles/book.css"/></head><body><h1>One</h1><p>Original fixture text.</p></body></html>'
	);
	zip.file(
		'OEBPS/text/chapter-two.xhtml',
		'<html><body><h1>Two</h1><p>Second chapter.</p></body></html>'
	);
	zip.file('OEBPS/styles/book.css', 'h1 { color: navy; }');
	zip.file('OEBPS/images/cover.png', PNG_PIXEL);
	return zip.generateAsync({ type: 'arraybuffer', mimeType: 'application/epub+zip' });
}

export async function createEpub3Fixture(): Promise<ArrayBuffer> {
	const zip = new JSZip();
	addRequiredFiles(zip);
	zip.file(
		'OEBPS/content.opf',
		`<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Minimal EPUB 3</dc:title><dc:creator>Granthalay</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover-image" href="media/pixel.png" media-type="image/png" properties="cover-image"/>
    <item id="intro" href="text/intro.xhtml" media-type="application/xhtml+xml"/>
    <item id="art" href="text/art.xhtml" media-type="application/xhtml+xml"/>
    <item id="styles" href="styles/book.css" media-type="text/css"/>
  </manifest>
  <spine><itemref idref="intro"/><itemref idref="art"/></spine>
</package>`
	);
	zip.file(
		'OEBPS/nav.xhtml',
		`<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>
  <li><a href="text/intro.xhtml">Introduction</a></li>
  <li><a href="text/art.xhtml">Illustration</a></li>
</ol></nav></body></html>`
	);
	zip.file(
		'OEBPS/text/intro.xhtml',
		'<html><head><link rel="stylesheet" href="../styles/book.css"/></head><body><h1>Introduction</h1><p class="accent">EPUB 3 fixture.</p><img src="../media/pixel.png" alt="Pixel"/></body></html>'
	);
	zip.file(
		'OEBPS/text/art.xhtml',
		'<html><body><svg viewBox="0 0 1 1"><image href="../media/pixel.png" width="1" height="1"/></svg></body></html>'
	);
	zip.file('OEBPS/styles/book.css', '.accent { background-image: url("../media/pixel.png"); }');
	zip.file('OEBPS/media/pixel.png', PNG_PIXEL);
	return zip.generateAsync({ type: 'arraybuffer', mimeType: 'application/epub+zip' });
}

export async function createRemoteResourceFixture(): Promise<ArrayBuffer> {
	const zip = new JSZip();
	addRequiredFiles(zip);
	zip.file(
		'OEBPS/content.opf',
		`<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Remote resources</dc:title></metadata>
  <manifest>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
    <item id="styles" href="book.css" media-type="text/css"/>
    <item id="pixel" href="pixel.png" media-type="image/png"/>
  </manifest>
  <spine><itemref idref="chapter"/></spine>
</package>`
	);
	zip.file(
		'OEBPS/chapter.xhtml',
		`<html><head><link rel="stylesheet" href="book.css"/></head><body>
  <img src="https://tracker.invalid/read?id=1" alt="Remote tracker"/>
  <img src="pixel.png" alt="Packaged image"/>
  <img src="missing.png" alt="Missing image"/>
  <svg><image href="//tracker.invalid/svg"/></svg>
  <p style="background-image: url('https://tracker.invalid/inline')">Private reading</p>
  <iframe src="https://tracker.invalid/frame"></iframe>
</body></html>`
	);
	zip.file(
		'OEBPS/book.css',
		`@import url("https://tracker.invalid/import.css");
.remote { background: url(https://tracker.invalid/cover.png); }
.packaged { background: url("pixel.png"); }
.missing { background: url("missing.png"); }
.set { background-image: image-set("https://tracker.invalid/two.png" 2x); }`
	);
	zip.file('OEBPS/pixel.png', PNG_PIXEL);
	return zip.generateAsync({ type: 'arraybuffer', mimeType: 'application/epub+zip' });
}

export async function createMalformedEpubFixture(
	kind: 'missing-container' | 'missing-rootfile' | 'missing-opf'
): Promise<ArrayBuffer> {
	const zip = new JSZip();
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

	if (kind === 'missing-rootfile') {
		zip.file('META-INF/container.xml', '<container><rootfiles/></container>');
	} else if (kind === 'missing-opf') {
		zip.file('META-INF/container.xml', CONTAINER);
	}

	return zip.generateAsync({ type: 'arraybuffer', mimeType: 'application/epub+zip' });
}
