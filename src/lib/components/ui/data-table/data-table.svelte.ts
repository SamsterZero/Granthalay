import {
	constructTable,
	type RowData,
	stockFeatures,
	tableFeatures,
	type TableOptions
} from '@tanstack/table-core';
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings';

const features = tableFeatures({
	...stockFeatures,
	coreReactivityFeature: storeReactivityBindings()
});

type SvelteTableOptions<TData extends RowData> = Omit<
	TableOptions<typeof features, TData>,
	'features'
>;

/**
 * Creates a reactive TanStack table object for Svelte.
 * @param options Table options to create the table with.
 * @returns A reactive table object.
 * @example
 * ```svelte
 * <script>
 *   const table = createSvelteTable({ ... })
 * </script>
 *
 * <table>
 *   <thead>
 *     {#each table.getHeaderGroups() as headerGroup}
 *       <tr>
 *         {#each headerGroup.headers as header}
 *           <th colspan={header.colSpan}>
 *         	   <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
 *         	 </th>
 *         {/each}
 *       </tr>
 *     {/each}
 *   </thead>
 * 	 <!-- ... -->
 * </table>
 * ```
 */
export function createSvelteTable<TData extends RowData>(options: SvelteTableOptions<TData>) {
	const resolvedOptions: TableOptions<typeof features, TData> = mergeObjects(
		{
			features,
			mergeOptions: (
				defaultOptions: TableOptions<typeof features, TData>,
				options: Partial<TableOptions<typeof features, TData>>
			) => {
				return mergeObjects(defaultOptions, options);
			}
		},
		options
	);

	const table = constructTable(resolvedOptions);
	let revision = $state(0);
	const subscription = table.store.subscribe(() => {
		revision += 1;
	});

	function updateOptions() {
		table.setOptions(() => {
			return mergeObjects(resolvedOptions, options);
		});
	}

	updateOptions();

	$effect.pre(() => {
		updateOptions();
	});
	$effect(() => () => subscription.unsubscribe());

	return new Proxy(table, {
		get(target, property, receiver) {
			void revision;
			return Reflect.get(target, property, receiver);
		}
	});
}

type MaybeThunk<T extends object> = T | (() => T | null | undefined);
type Intersection<T extends readonly unknown[]> = (T extends [infer H, ...infer R]
	? H & Intersection<R>
	: unknown) & {};

/**
 * Lazily merges several objects (or thunks) while preserving
 * getter semantics from every source.
 *
 * Proxy-based to avoid known WebKit recursion issue.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeObjects<Sources extends readonly MaybeThunk<any>[]>(
	...sources: Sources
): Intersection<{ [K in keyof Sources]: Sources[K] }> {
	const resolve = <T extends object>(src: MaybeThunk<T>): T | undefined =>
		typeof src === 'function' ? (src() ?? undefined) : src;

	const findSourceWithKey = (key: PropertyKey) => {
		for (let i = sources.length - 1; i >= 0; i--) {
			const obj = resolve(sources[i]);
			if (obj && key in obj) return obj;
		}
		return undefined;
	};

	return new Proxy(Object.create(null), {
		get(_, key) {
			const src = findSourceWithKey(key);

			return src?.[key as never];
		},

		has(_, key) {
			return !!findSourceWithKey(key);
		},

		ownKeys(): (string | symbol)[] {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const all = new Set<string | symbol>();
			for (const s of sources) {
				const obj = resolve(s);
				if (obj) {
					for (const k of Reflect.ownKeys(obj) as (string | symbol)[]) {
						all.add(k);
					}
				}
			}
			return [...all];
		},

		getOwnPropertyDescriptor(_, key) {
			const src = findSourceWithKey(key);
			if (!src) return undefined;
			return {
				configurable: true,
				enumerable: true,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				value: (src as any)[key],
				writable: true
			};
		}
	}) as Intersection<{ [K in keyof Sources]: Sources[K] }>;
}
