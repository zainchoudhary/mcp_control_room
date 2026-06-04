export function getFileTypeInfo(filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return { ext: 'PDF', tone: 'pdf' }
  if (ext === 'docx' || ext === 'doc') return { ext: 'DOC', tone: 'doc' }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { ext: ext.toUpperCase(), tone: 'image' }
  if (['txt', 'md'].includes(ext)) return { ext: ext.toUpperCase(), tone: 'text' }
  if (['csv', 'json', 'xml', 'xlsx', 'xls'].includes(ext)) return { ext: ext.toUpperCase(), tone: 'data' }
  return { ext: ext.toUpperCase() || 'FILE', tone: 'default' }
}

export function shortFileName(name, max = 28) {
  if (!name || name.length <= max) return name
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  const base = name.slice(0, name.length - ext.length)
  const keep = max - ext.length - 3
  return `${base.slice(0, Math.max(keep, 8))}...${ext}`
}
