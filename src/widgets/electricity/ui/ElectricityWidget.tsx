import { Panel } from '@/shared/ui/panel'
import styles from './ElectricityWidget.module.scss'

export function ElectricityWidget() {
  return (
    <Panel title="Электроснабжение">
      <div className={styles['electricity-widget__content']}>
        <p className={styles['electricity-widget__notice']}>
          Ожидает подключения источника данных
        </p>
        <dl className={styles['electricity-widget__details']}>
          <div className={styles['electricity-widget__row']}>
            <dt>Отключения</dt>
            <dd>—</dd>
          </div>
          <div className={styles['electricity-widget__row']}>
            <dt>Ориентировочное восстановление</dt>
            <dd>—</dd>
          </div>
          <div className={styles['electricity-widget__row']}>
            <dt>Последняя проверка</dt>
            <dd>—</dd>
          </div>
        </dl>
      </div>
    </Panel>
  )
}
