import { describe, expect, it } from 'vitest';

import {
	normalizeLocation,
	pageToProgression,
	progressionToPage,
	repaginatePage
} from './pagination';

describe('semantic pagination', () => {
	it('preserves the nearest reading position when the page count grows', () => {
		expect(repaginatePage(2, 5, 9)).toBe(4);
	});

	it('preserves the nearest reading position when the page count shrinks', () => {
		expect(repaginatePage(6, 9, 5)).toBe(3);
	});

	it('keeps the first and last positions anchored', () => {
		expect(pageToProgression(0, 8)).toBe(0);
		expect(pageToProgression(7, 8)).toBe(1);
		expect(progressionToPage(1, 3)).toBe(2);
	});

	it('handles invalid and single-page layouts without blank pages', () => {
		expect(repaginatePage(20, 0, 0)).toBe(0);
		expect(progressionToPage(Number.NaN, 5)).toBe(0);
		expect(progressionToPage(0.75, Number.POSITIVE_INFINITY)).toBe(0);
	});

	it('clamps stale saved locations after chapters are removed', () => {
		expect(normalizeLocation({ chapter: 12, progression: 1.5 }, 3)).toEqual({
			chapter: 2,
			progression: 1
		});
		expect(normalizeLocation({ chapter: -2, progression: -1 }, 3)).toEqual({
			chapter: 0,
			progression: 0
		});
	});

	it('falls back safely when saved locations or chapter counts are invalid', () => {
		expect(
			normalizeLocation({ chapter: Number.NaN, progression: Number.POSITIVE_INFINITY }, Number.NaN)
		).toEqual({ chapter: 0, progression: 0 });
	});
});
