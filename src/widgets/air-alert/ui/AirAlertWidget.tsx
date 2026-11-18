import { Panel } from '@/shared/ui/panel'
import styles from './AirAlertWidget.module.scss'

export type AirAlertStatus =
  | 'unknown'
  | 'active'
  | 'clear'
  | 'unavailable'
  | 'stale'

export interface AirAlertWidgetProps {
  status?: AirAlertStatus
}

interface StatusCopy {
  label: string
  description: string
}

const statusCopy: Record<AirAlertStatus, StatusCopy> = {
  unknown: {
    label: 'Нет данных',
    description: 'Статус тревог пока не получен',
  },
  active: {
    label: 'Активная тревога',
    description: 'Показание будет поступать из источника данных',
  },
  clear: {
    label: 'Тревоги нет',
    description: 'Показание будет поступать из источника данных',
  },
  unavailable: {
    label: 'Источник недоступен',
    description: 'Не удалось получить актуальные данные',
  },
  stale: {
    label: 'Данные устарели',
    description: 'Ожидается обновление информации',
  },
}

export function AirAlertWidget({
  status = 'unknown',
}: AirAlertWidgetProps) {
  const content = statusCopy[status]

  return (
    <Panel title="Воздушная тревога">
      <div className={styles['air-alert-widget__content']}>
        <div
          aria-label={content.label}
          className={`${styles['air-alert-widget__status']} ${styles[`air-alert-widget__status--${status}`]}`}
          role="status"
        >
          <span aria-hidden="true" className={styles['air-alert-widget__marker']} />
          <span>{content.label}</span>
        </div>
        <p className={styles['air-alert-widget__description']}>
          {content.description}
        </p>
      </div>
    </Panel>
  )
}
