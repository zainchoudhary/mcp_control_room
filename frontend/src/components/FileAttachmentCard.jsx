import { X, FileText } from 'lucide-react'
import { getFileTypeInfo, shortFileName } from '../utils/fileAttachmentUi.js'
import styles from './FileAttachmentCard.module.css'

function badgeClass(tone) {
  const map = {
    pdf: styles.badgePdf,
    doc: styles.badgeDoc,
    text: styles.badgeText,
    data: styles.badgeData,
    image: styles.badgeImage,
    default: styles.badgeDefault,
  }
  return `${styles.badge} ${map[tone] || map.default}`
}

export function FileAttachmentSkeleton({ name, kind = 'document', variant = 'composer' }) {
  const isImage = kind === 'image'
  if (isImage) {
    return (
      <div className={`${styles.card} ${styles.skeletonCard} ${styles[variant] || ''} ${styles.uploading}`}>
        <div className={styles.skeletonImage} />
      </div>
    )
  }
  return (
    <div className={`${styles.card} ${styles.skeletonCard} ${styles[variant] || ''} ${styles.uploading}`}>
      <div className={styles.docBody}>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonLines}>
          <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
          <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
        </div>
      </div>
    </div>
  )
}

export function FileAttachmentCard({
  name,
  kind = 'document',
  previewUrl,
  uploading = false,
  onRemove,
  variant = 'composer',
  disabled = false,
}) {
  if (uploading) {
    return <FileAttachmentSkeleton name={name} kind={kind} variant={variant} />
  }

  const typeInfo = getFileTypeInfo(name)
  const isImage = kind === 'image'
  const showRemove = variant === 'composer' && onRemove

  if (isImage) {
    return (
      <div className={`${styles.card} ${styles.imageCard} ${styles[variant] || ''}`}>
        <div className={styles.imageWrap}>
          {previewUrl ? (
            <img src={previewUrl} alt="" className={styles.imagePreview} />
          ) : (
            <div
              className={styles.imageWrap}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}
            >
              <FileText size={24} color="var(--text-tertiary)" />
            </div>
          )}
        </div>
        <div className={styles.imageMeta} title={name}>
          {shortFileName(name, 18)}
        </div>
        {showRemove && (
          <button
            type="button"
            className={styles.removeBtn}
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove ${name}`}
          >
            <X size={12} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`${styles.card} ${styles[variant] || ''}`}>
      <div className={styles.docBody}>
        <div className={badgeClass(typeInfo.tone)}>{typeInfo.ext}</div>
        <div className={styles.meta}>
          <div className={styles.fileName} title={name}>
            {shortFileName(name)}
          </div>
          <div className={styles.fileType}>{typeInfo.ext} document</div>
        </div>
      </div>
      {showRemove && (
        <button
          type="button"
          className={styles.removeBtn}
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${name}`}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
