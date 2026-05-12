# Samster Reader

A premium, local-first EPUB reader built with SvelteKit and Svelte 5.

![Reader Mockup](https://raw.githubusercontent.com/SamsterZero/reader/main/static/icon-512.png)

## Features

- **Dual-Mode Layout**: Automatically switches between multi-column pagination for novels and "Fit-to-Screen" mode for illustrated books (e.g., Diary of a Wimpy Kid).
- **High-Fidelity Rendering**: Advanced SVG support with coordinate preservation (viewBox) and real-time resource resolution for all book assets.
- **Local-First**: All your books stay in your browser using IndexedDB. No accounts, no tracking.
- **Modern UI**: Clean, aesthetic interface with dark mode, skeleton loaders, and smooth transitions.
- **Smart Progress**: Tracks position at both the chapter and global book level, with a dedicated "Resume/Start" workflow.
- **PWA**: Installable as a native app on iOS, Android, and Desktop.

## Tech Stack

- **Framework**: SvelteKit 2.0 (Svelte 5 Runes)
- **Database**: Dexie.js (IndexedDB)
- **Styling**: Vanilla CSS + Tailwind Typography
- **Icons**: Lucide Svelte

## Getting Started

### Development

```bash
# Install dependencies
bun install

# Run dev server
bun run dev
```

### Building for Production

```bash
bun run build
```

## Documentation

Detailed specifications can be found in the `/spec` directory:

- [Architecture](./spec/architecture.md)
- [Features](./spec/features.md)
- [Data Model](./spec/data_model.md)

## License

MIT
