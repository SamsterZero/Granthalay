# UI & UX Design Specification

## Design Philosophy
- **Aesthetic First**: Use vibrant colors (like the Teal #0D5C63 accent) and sleek dark modes.
- **Glassmorphism**: Subtle usage of blurs and transparency for a premium feel.
- **Micro-animations**: Smooth transitions for page flipping and opening books.

## Color Palette
- **Primary Accent**: `#0D5C63` (Teal)
- **Background (Light)**: `#FFFFFF` / `hsl(var(--background))`
- **Background (Dark)**: `#0F172A` (Slate 900)
- **Muted Elements**: `hsl(var(--muted))`

## Typography
- **UI Text**: System Sans-serif (Inter/Roboto) for clarity.
- **Book Content**: Serif fonts (Georgia/Times New Roman) for long-form readability.

## Interaction Model
- **Library**: Grid view with "Compact" and "Comfortable" modes.
- **Reader**: 
  - 100ms layout stabilization timeout.
  - 0.3s opacity and transform transitions.
  - Z-index layers: 
    - Content: 0
    - Overlay/Controls: 50
    - Modals: 100
