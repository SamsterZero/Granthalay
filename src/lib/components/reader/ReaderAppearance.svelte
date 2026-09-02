<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { ReaderPreferences } from '$lib/reader/preferences';

	let {
		preferences,
		onUpdate,
		onReset
	}: {
		preferences: ReaderPreferences;
		onUpdate: (update: Partial<ReaderPreferences>) => void;
		onReset: () => void;
	} = $props();
</script>

<section
	id="reader-appearance"
	class="z-40 grid gap-4 border-b border-border bg-background p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
	aria-labelledby="reader-appearance-heading"
>
	<div class="flex items-center justify-between sm:col-span-2 lg:col-span-5">
		<h2 id="reader-appearance-heading" class="text-sm font-semibold">Reader appearance</h2>
		<Button variant="ghost" size="sm" onclick={onReset}>Use publication defaults</Button>
	</div>

	<label class="grid gap-1 text-sm">
		<span>Type scale</span>
		<select
			class="rounded-md border border-border bg-background px-2 py-1.5"
			value={preferences.fontScale ?? 'publisher'}
			onchange={(event) =>
				onUpdate({
					fontScale:
						event.currentTarget.value === 'publisher' ? null : Number(event.currentTarget.value)
				})}
		>
			<option value="publisher">Publication</option>
			<option value="0.8">80%</option>
			<option value="1">100%</option>
			<option value="1.2">120%</option>
			<option value="1.4">140%</option>
			<option value="1.6">160%</option>
		</select>
	</label>

	<label class="grid gap-1 text-sm">
		<span>Line height</span>
		<select
			class="rounded-md border border-border bg-background px-2 py-1.5"
			value={preferences.lineHeight ?? 'publisher'}
			onchange={(event) =>
				onUpdate({
					lineHeight:
						event.currentTarget.value === 'publisher' ? null : Number(event.currentTarget.value)
				})}
		>
			<option value="publisher">Publication</option>
			<option value="1.2">Compact</option>
			<option value="1.6">Comfortable</option>
			<option value="1.9">Relaxed</option>
			<option value="2.2">Extra relaxed</option>
		</select>
	</label>

	<label class="grid gap-1 text-sm">
		<span>Margins</span>
		<select
			class="rounded-md border border-border bg-background px-2 py-1.5"
			value={preferences.margins}
			onchange={(event) =>
				onUpdate({ margins: event.currentTarget.value as ReaderPreferences['margins'] })}
		>
			<option value="narrow">Narrow</option>
			<option value="standard">Standard</option>
			<option value="wide">Wide</option>
		</select>
	</label>

	<label class="grid gap-1 text-sm">
		<span>Alignment</span>
		<select
			class="rounded-md border border-border bg-background px-2 py-1.5"
			value={preferences.alignment}
			onchange={(event) =>
				onUpdate({ alignment: event.currentTarget.value as ReaderPreferences['alignment'] })}
		>
			<option value="publisher">Publication</option>
			<option value="left">Left</option>
			<option value="justify">Justified</option>
		</select>
	</label>

	<label class="grid gap-1 text-sm">
		<span>Theme</span>
		<select
			class="rounded-md border border-border bg-background px-2 py-1.5"
			value={preferences.theme}
			onchange={(event) =>
				onUpdate({ theme: event.currentTarget.value as ReaderPreferences['theme'] })}
		>
			<option value="system">System</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
		</select>
	</label>

	<p class="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">
		Typography overrides apply only to reflowable text. Covers and illustrated pages retain their
		publication layout.
	</p>
</section>
