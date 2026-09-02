<script lang="ts">
	import { AlignJustify, AlignLeft, ArrowLeft, ArrowRight, ScrollText, Type } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { ReaderPreferences } from '$lib/reader/preferences';

	let {
		preferences,
		onUpdate,
		onReset,
		heading = 'Reader settings',
		resetLabel = 'Use defaults'
	}: {
		preferences: ReaderPreferences;
		onUpdate: (update: Partial<ReaderPreferences>) => void;
		onReset: () => void;
		heading?: string;
		resetLabel?: string;
	} = $props();
</script>

<section
	id="reader-appearance"
	class="z-40 grid gap-4 border-b border-border bg-background p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
	aria-labelledby="reader-appearance-heading"
>
	<div class="flex items-center justify-between sm:col-span-2 lg:col-span-5">
		<h2 id="reader-appearance-heading" class="text-sm font-semibold">{heading}</h2>
		<Button variant="ghost" size="sm" onclick={onReset}>{resetLabel}</Button>
	</div>

	<label class="grid gap-2 text-sm sm:col-span-2">
		<span class="flex items-center justify-between gap-3">
			<span>Font size</span>
			<output class="text-muted-foreground tabular-nums">
				{preferences.fontScale === 1 ? 'Default · ' : ''}{Math.round(preferences.fontScale * 100)}%
			</output>
		</span>
		<input
			type="range"
			class="w-full accent-primary"
			min="0.8"
			max="1.6"
			step="0.05"
			value={preferences.fontScale}
			list="reader-font-scale-points"
			oninput={(event) => onUpdate({ fontScale: Number(event.currentTarget.value) })}
			aria-label="Font size percentage"
		/>
		<datalist id="reader-font-scale-points">
			<option value="0.8"></option>
			<option value="0.9"></option>
			<option value="1"></option>
			<option value="1.1"></option>
			<option value="1.2"></option>
			<option value="1.3"></option>
			<option value="1.4"></option>
			<option value="1.5"></option>
			<option value="1.6"></option>
		</datalist>
	</label>

	<label class="grid gap-2 text-sm">
		<span class="flex items-center justify-between gap-3">
			<span>Line height</span>
			<output class="text-muted-foreground tabular-nums">
				{preferences.lineHeight === null ? 'Default' : preferences.lineHeight.toFixed(1)}
			</output>
		</span>
		<input
			type="range"
			class="w-full accent-primary"
			min="1.2"
			max="2.2"
			step="0.1"
			value={preferences.lineHeight ?? 1.6}
			list="reader-line-height-points"
			oninput={(event) => {
				const value = Number(event.currentTarget.value);
				onUpdate({ lineHeight: value === 1.6 ? null : value });
			}}
			aria-label="Line height"
		/>
		<datalist id="reader-line-height-points">
			<option value="1.2"></option><option value="1.4"></option>
			<option value="1.6"></option><option value="1.8"></option>
			<option value="2"></option><option value="2.2"></option>
		</datalist>
	</label>

	<label class="grid gap-2 text-sm">
		<span class="flex items-center justify-between gap-3">
			<span>Margins</span>
			<output class="text-muted-foreground capitalize">
				{preferences.margins === 'standard' ? 'Default' : preferences.margins}
			</output>
		</span>
		<input
			type="range"
			class="w-full accent-primary"
			min="0"
			max="2"
			step="1"
			value={['narrow', 'standard', 'wide'].indexOf(preferences.margins)}
			list="reader-margin-points"
			oninput={(event) =>
				onUpdate({
					margins: ['narrow', 'standard', 'wide'][
						Number(event.currentTarget.value)
					] as ReaderPreferences['margins']
				})}
			aria-label="Page margins"
		/>
		<datalist id="reader-margin-points">
			<option value="0"></option><option value="1"></option><option value="2"></option>
		</datalist>
	</label>

	<fieldset class="grid gap-1 text-sm">
		<legend>Alignment</legend>
		<div class="flex gap-1" role="group" aria-label="Text alignment">
			<Button
				variant={preferences.alignment === 'publisher' ? 'secondary' : 'outline'}
				size="icon"
				onclick={() => onUpdate({ alignment: 'publisher' })}
				title="Default alignment"
				aria-label="Default alignment"
				aria-pressed={preferences.alignment === 'publisher'}><Type class="h-4 w-4" /></Button
			>
			<Button
				variant={preferences.alignment === 'left' ? 'secondary' : 'outline'}
				size="icon"
				onclick={() => onUpdate({ alignment: 'left' })}
				title="Align left"
				aria-label="Align left"
				aria-pressed={preferences.alignment === 'left'}><AlignLeft class="h-4 w-4" /></Button
			>
			<Button
				variant={preferences.alignment === 'justify' ? 'secondary' : 'outline'}
				size="icon"
				onclick={() => onUpdate({ alignment: 'justify' })}
				title="Justify text"
				aria-label="Justify text"
				aria-pressed={preferences.alignment === 'justify'}><AlignJustify class="h-4 w-4" /></Button
			>
		</div>
	</fieldset>

	<fieldset class="grid gap-2 text-sm sm:col-span-2 lg:col-span-2">
		<legend>Theme</legend>
		<div class="grid grid-cols-3 gap-2" role="group" aria-label="Reader theme">
			<button
				type="button"
				class="grid gap-1.5 rounded-md border p-1.5 text-xs transition-colors"
				class:border-primary={preferences.theme === 'system'}
				class:ring-2={preferences.theme === 'system'}
				class:ring-primary={preferences.theme === 'system'}
				class:border-border={preferences.theme !== 'system'}
				onclick={() => onUpdate({ theme: 'system' })}
				aria-label="Use system theme"
				aria-pressed={preferences.theme === 'system'}
			>
				<svg class="mx-auto h-10 w-10 rounded-lg" viewBox="0 0 40 40" aria-hidden="true">
					<defs>
						<clipPath id="system-theme-left"><rect width="20" height="40" /></clipPath>
						<clipPath id="system-theme-right"><rect x="20" width="20" height="40" /></clipPath>
					</defs>
					<rect width="40" height="40" rx="8" fill="#ffffff" />
					<path d="M20 0h12a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H20z" fill="#0f172a" />
					<text
						x="20"
						y="28"
						text-anchor="middle"
						font-size="22"
						font-weight="700"
						fill="#334155"
						clip-path="url(#system-theme-left)">A</text
					>
					<text
						x="20"
						y="28"
						text-anchor="middle"
						font-size="22"
						font-weight="700"
						fill="#e2e8f0"
						clip-path="url(#system-theme-right)">A</text
					>
					<rect
						x=".5"
						y=".5"
						width="39"
						height="39"
						rx="7.5"
						fill="none"
						stroke="#64748b"
						stroke-opacity=".35"
					/>
				</svg>
				<span>System</span>
			</button>

			<button
				type="button"
				class="grid gap-1.5 rounded-md border p-1.5 text-xs transition-colors"
				class:border-primary={preferences.theme === 'light'}
				class:ring-2={preferences.theme === 'light'}
				class:ring-primary={preferences.theme === 'light'}
				class:border-border={preferences.theme !== 'light'}
				onclick={() => onUpdate({ theme: 'light' })}
				aria-label="Use light theme"
				aria-pressed={preferences.theme === 'light'}
			>
				<span
					class="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-black/15 bg-white text-xl font-bold text-slate-700"
					aria-hidden="true">A</span
				>
				<span>Light</span>
			</button>

			<button
				type="button"
				class="grid gap-1.5 rounded-md border p-1.5 text-xs transition-colors"
				class:border-primary={preferences.theme === 'dark'}
				class:ring-2={preferences.theme === 'dark'}
				class:ring-primary={preferences.theme === 'dark'}
				class:border-border={preferences.theme !== 'dark'}
				onclick={() => onUpdate({ theme: 'dark' })}
				aria-label="Use dark theme"
				aria-pressed={preferences.theme === 'dark'}
			>
				<span
					class="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-white/15 bg-slate-900 text-xl font-bold text-slate-200"
					aria-hidden="true">A</span
				>
				<span>Dark</span>
			</button>
		</div>
	</fieldset>

	<fieldset class="grid gap-1 text-sm sm:col-span-2 lg:col-span-5">
		<legend>Book navigation</legend>
		<div class="flex gap-1" role="group" aria-label="Book navigation mode">
			<Button
				variant={preferences.navigation === 'rtl' ? 'secondary' : 'outline'}
				size="icon"
				onclick={() => onUpdate({ navigation: 'rtl' })}
				title="RTL page turns: swipe right for next"
				aria-label="RTL page turns, swipe right for next"
				aria-pressed={preferences.navigation === 'rtl'}
			>
				<ArrowRight class="h-4 w-4" />
			</Button>
			<Button
				variant={preferences.navigation === 'ltr' ? 'secondary' : 'outline'}
				size="icon"
				onclick={() => onUpdate({ navigation: 'ltr' })}
				title="LTR page turns: swipe left for next"
				aria-label="LTR page turns, swipe left for next"
				aria-pressed={preferences.navigation === 'ltr'}
			>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<Button
				variant={preferences.navigation === 'scroll' ? 'secondary' : 'outline'}
				size="icon"
				onclick={() => onUpdate({ navigation: 'scroll' })}
				title="Vertical scrolling"
				aria-label="Vertical scrolling"
				aria-pressed={preferences.navigation === 'scroll'}
			>
				<ScrollText class="h-4 w-4" />
			</Button>
		</div>
	</fieldset>

	<p class="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">
		Typography overrides apply only to reflowable text. Covers and illustrated pages retain their
		publication layout.
	</p>
</section>
