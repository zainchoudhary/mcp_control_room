export const BG_OPTIONS = [
  { id: '', label: 'Default', swatch: 'var(--bg-primary)' },
  { id: 'subtle-dots', label: 'Dots', swatch: 'radial-gradient(circle, var(--border-default) 1px, transparent 1px)' },
  { id: 'subtle-grid', label: 'Grid', swatch: 'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)' },
  { id: 'gradient-warm', label: 'Warm', swatch: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%)' },
  { id: 'gradient-cool', label: 'Cool', swatch: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 50%, #3b82f6 100%)' },
  { id: 'gradient-accent', label: 'Accent', swatch: 'linear-gradient(135deg, var(--accent-light) 0%, rgba(var(--accent-rgb), 0.3) 100%)' },
]

export function applyCustomBg(bgId) {
  const root = document.documentElement
  if (!bgId) {
    root.removeAttribute('data-custom-bg')
  } else {
    root.setAttribute('data-custom-bg', bgId)
  }
}
