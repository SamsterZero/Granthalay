# Data Model Specification

## IndexedDB (via Dexie)

### Books Table
| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (UUID). |
| `title` | `string` | Book title extracted from OPF. |
| `author` | `string` | Author name. |
| `cover` | `string (blob)` | Data URL of the cover image. |
| `buffer` | `ArrayBuffer` | The raw EPUB file data. |
| `currentChapter` | `number` | Index of the last read chapter. |
| `currentPage` | `number` | Index of the last read page within that chapter. |
| `progress` | `number` | Total reading progress (0.0 to 1.0). |
| `totalBookPages` | `number` | Total calculated pages in the book. |

## EPUB Engine Internal Data

### EpubMetadata
```typescript
{
  title: string;
  author: string;
  description: string;
  cover: string | null;
}
```

### EpubChapter
```typescript
{
  title: string;
  href: string;      // The relative path inside the ZIP
  content: string;   // Sanitized HTML
  css: string;       // Scoped CSS rules
  isCover?: boolean;
  isFrontmatter?: boolean;
}
```
