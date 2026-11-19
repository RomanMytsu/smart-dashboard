import { Panel } from '@/shared/ui/panel'
import { useAirAlertStatus } from '../model/useAirAlertStatus'
import styles from './AirAlertWidget.module.scss'

interface StatusCopy {
  label: string
  description: string
  style: string
}

function getStatusCopy(state: ReturnType<typeof useAirAlertStatus>): StatusCopy {
  if (state.status === 'loading') {
    return {
      label: 'Проверяем статус',
      description: 'Получаем данные о воздушной тревоге в Харькове',
      style: 'loading',
    }
  }

  if (state.status === 'unavailable') {
    return {
      label: 'Данные временно недоступны',
      description: 'Не удалось получить статус воздушной тревоги',
      style: 'unavailable',
    }
  }

  if (state.data.status === 'partial') {
    return {
      label: 'Частичная тревога',
      description: 'Тревога объявлена не во всей городской громаде',
      style: 'partial',
    }
  }

  if (state.data.status === 'inactive') {
    return {
      label: 'Тревоги нет',
      description: 'По данным источника активная тревога не объявлена',
      style: 'clear',
    }
  }

  return state.data.level === 'yellow'
    ? {
        label: 'Предварительная угроза',
        description: 'Объявлен жёлтый уровень предупреждения',
        style: 'yellow',
      }
    : {
        label: 'Воздушная тревога',
        description: 'Объявлен красный уровень тревоги',
        style: 'active',
      }
}

export function AirAlertWidget() {
  const state = useAirAlertStatus()
  const content = getStatusCopy(state)

  return (
    <Panel title="Воздушная тревога">
      <div className={styles['air-alert-widget__content']}>
        <div
          aria-label={content.label}
          className={`${styles['air-alert-widget__status']} ${styles[`air-alert-widget__status--${content.style}`]}`}
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
