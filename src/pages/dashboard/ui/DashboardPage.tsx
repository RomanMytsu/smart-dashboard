import { AirAlertWidget } from "@/widgets/air-alert";
import { ClockWidget } from "@/widgets/clock";
import { CityInsightsWidget } from "@/widgets/city-insights";
import { WeatherWidget, useWeather } from "@/widgets/weather";
import styles from "./DashboardPage.module.scss";

export function DashboardPage() {
  const weather = useWeather();
  return (
    <main className={styles["dashboard-page"]}>
      <header className={styles["dashboard-page__header"]}>
        <div className={styles["dashboard-page__brand"]}>
          <span aria-hidden="true" className={styles["dashboard-page__mark"]}>
            K
          </span>
          <div>
            <h1 className={styles["dashboard-page__title"]}>Домашняя станция</h1>
          </div>
        </div>
      </header>

      <section
        aria-label="Информация о городе"
        className={styles["dashboard-page__grid"]}
      >
        <ClockWidget />
        <WeatherWidget diagnostic={weather.diagnostic} refresh={weather.refresh} state={weather.state} />
        <AirAlertWidget />
        <CityInsightsWidget weatherState={weather.state} />
      </section>
    </main>
  );
}
