import type { ReactNode } from 'react'
import styles from './Panel.module.scss'

export interface PanelProps {
  title: string
  children: ReactNode
  className?: string
  titleClassName?: string
  compact?: boolean
}

export function Panel({ title, children, className, titleClassName, compact = false }: PanelProps) {
  const panelClassName = [
    styles.panel,
    compact ? styles['panel--compact'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section aria-label={title} className={panelClassName}>
      <h2 className={[styles['panel__title'], titleClassName ?? ''].filter(Boolean).join(' ')}>{title}</h2>
      <div className={styles['panel__content']}>{children}</div>
    </section>
  )
}
