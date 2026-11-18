import { AirAlertWidget } from "@/widgets/air-alert";
import { ClockWidget } from "@/widgets/clock";
import { ElectricityWidget } from "@/widgets/electricity";
import { WeatherWidget } from "@/widgets/weather";
import styles from "./DashboardPage.module.scss";

export function DashboardPage() {
  return (
    <main className={styles["dashboard-page"]}>
      <header className={styles["dashboard-page__header"]}>
        <div className={styles["dashboard-page__brand"]}>
          <span aria-hidden="true" className={styles["dashboard-page__mark"]}>
            K
          </span>
          <div>
            <p className={styles["dashboard-page__eyebrow"]}>
              KHARKIV SMART HOME
            </p>
            <h1 className={styles["dashboard-page__title"]}>Домашний обзор</h1>
          </div>
        </div>
        <div className={styles["dashboard-page__header-note"]}>
          <span className={styles["dashboard-page__header-dot"]} />
          <p className={styles["dashboard-page__description"]}>
            Харьков · информационная панель
          </p>
        </div>
      </header>

      <section
        aria-label="Информация о городе"
        className={styles["dashboard-page__grid"]}
      >
        <ClockWidget />
        <WeatherWidget />
        <AirAlertWidget />
        <ElectricityWidget />
      </section>
    </main>
  );
}
