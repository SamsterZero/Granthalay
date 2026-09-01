// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { isInteractiveReaderTarget, readerKeyboardAction } from './keyboard';

describe('reader keyboard navigation', () => {
	it.each([
		['ArrowRight', 'next'],
		['PageDown', 'next'],
		[' ', 'next'],
		['ArrowLeft', 'previous'],
		['PageUp', 'previous'],
		['Home', 'first'],
		['End', 'last']
	] as const)('maps %s to %s', (key, action) => {
		expect(readerKeyboardAction({ key })).toBe(action);
	});

	it('ignores unknown, repeated, modified, and interactive keystrokes', () => {
		expect(readerKeyboardAction({ key: 'Escape' })).toBeNull();
		expect(readerKeyboardAction({ key: 'ArrowRight', repeat: true })).toBeNull();
		expect(readerKeyboardAction({ key: 'ArrowRight', modified: true })).toBeNull();
		expect(readerKeyboardAction({ key: ' ', interactive: true })).toBeNull();
	});

	it('recognizes controls and editable descendants as interactive', () => {
		const button = document.createElement('button');
		const icon = document.createElement('span');
		button.append(icon);
		expect(isInteractiveReaderTarget(icon)).toBe(true);
		expect(isInteractiveReaderTarget(document.createElement('p'))).toBe(false);
	});
});
