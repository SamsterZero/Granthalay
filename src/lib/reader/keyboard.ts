export type ReaderKeyboardAction = 'next' | 'previous' | 'first' | 'last';

export interface ReaderKeyboardInput {
	key: string;
	modified?: boolean;
	repeat?: boolean;
	interactive?: boolean;
}

export function readerKeyboardAction({
	key,
	modified = false,
	repeat = false,
	interactive = false
}: ReaderKeyboardInput): ReaderKeyboardAction | null {
	if (modified || repeat || interactive) return null;

	switch (key) {
		case 'ArrowRight':
		case 'PageDown':
		case ' ':
			return 'next';
		case 'ArrowLeft':
		case 'PageUp':
			return 'previous';
		case 'Home':
			return 'first';
		case 'End':
			return 'last';
		default:
			return null;
	}
}

export function isInteractiveReaderTarget(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		Boolean(
			target.closest(
				'a, button, input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="menuitem"], [role="option"]'
			)
		)
	);
}
