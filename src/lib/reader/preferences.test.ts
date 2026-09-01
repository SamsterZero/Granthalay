import { describe, expect, it } from 'vitest';

import {
	DEFAULT_READER_PREFERENCES,
	parseReaderPreferences,
	readerMarginPixels,
	supportsTypographyOverrides
} from './preferences';

describe('reader preferences', () => {
	it('preserves valid local preferences', () => {
		expect(
			parseReaderPreferences(
				JSON.stringify({
					fontScale: 1.25,
					lineHeight: 1.8,
					margins: 'wide',
					alignment: 'justify',
					theme: 'dark'
				})
			)
		).toEqual({
			fontScale: 1.25,
			lineHeight: 1.8,
			margins: 'wide',
			alignment: 'justify',
			theme: 'dark'
		});
	});

	it('clamps numeric overrides and rejects unsupported values', () => {
		expect(
			parseReaderPreferences(
				JSON.stringify({ fontScale: 9, lineHeight: 0, margins: 'edge', theme: 'sepia' })
			)
		).toMatchObject({ fontScale: 1.6, lineHeight: 1.2, margins: 'standard', theme: 'system' });
	});

	it('falls back safely for corrupt storage', () => {
		expect(parseReaderPreferences('{')).toEqual(DEFAULT_READER_PREFERENCES);
		expect(readerMarginPixels('narrow')).toBeLessThan(readerMarginPixels('wide'));
	});

	it('keeps typography overrides away from publisher-sensitive pages', () => {
		expect(supportsTypographyOverrides({ content: '<p>Reflowable text</p>' })).toBe(true);
		expect(supportsTypographyOverrides({ content: '<svg></svg>' })).toBe(false);
		expect(supportsTypographyOverrides({ content: '<img src="cover.png">', isCover: true })).toBe(
			false
		);
	});
});
