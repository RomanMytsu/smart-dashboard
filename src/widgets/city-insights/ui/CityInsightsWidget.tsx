import * as SunCalc from "suncalc";
import type { WeatherState } from "@/entities/weather";
import { Panel } from "@/shared/ui/panel";
import { KHARKIV_TIME_ZONE } from "@/shared/lib/timeZone";
import {
  getEuropeanAqiCategory,
  getObservedAtTimestamp,
} from "../model/airQuality";
import { useAirQuality } from "../model/useAirQuality";
import type { AirQualityData } from "../model/airQuality";
import styles from "./CityInsightsWidget.module.scss";

function formatConcentration(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} μg/m³`;
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return /^\d{2}:\d{2}$/.test(value) ? value : "—";
}

function formatObservedAt(data: AirQualityData): string {
  const timestamp = getObservedAtTimestamp(
    data.observedAt,
    data.observedAtUtcOffsetSeconds,
  );
  if (timestamp === null) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: KHARKIV_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatFetchedAt(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function getTodayInKyiv(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: KHARKIV_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function getMoonPhase(phase: number): string {
  if (phase < 0.0625 || phase >= 0.9375) return "Новолуние";
  if (phase < 0.1875) return "Растущий серп";
  if (phase < 0.3125) return "Первая четверть";
  if (phase < 0.4375) return "Растущая Луна";
  if (phase < 0.5625) return "Полнолуние";
  if (phase < 0.6875) return "Убывающая Луна";
  if (phase < 0.8125) return "Последняя четверть";
  return "Убывающий серп";
}

function AirQualitySection({
  state,
}: {
  state: ReturnType<typeof useAirQuality>;
}) {
  const data: AirQualityData | null = state.data;
  const category = data ? getEuropeanAqiCategory(data.europeanAqi) : null;
  return (
    <section
      className={styles["city-insights__section"]}
      aria-label="Качество воздуха"
    >
      <h3 className={styles["city-insights__section-title"]}>
        Качество воздуха
      </h3>
      {data && category ? (
        <>
          <p className={styles["city-insights__primary"]}>
            AQI {Math.round(data.europeanAqi)}{" "}
            <span className={styles[`city-insights__badge--${category.color}`]}>
              {category.label}
            </span>
          </p>
          <p className={styles["city-insights__detail"]}>
            PM2.5 {formatConcentration(data.pm25)} · PM10{" "}
            {formatConcentration(data.pm10)}
          </p>
          {state.status === "stale" && (
            <p className={styles["city-insights__note"]}>
              Устаревшие данные · API: {formatObservedAt(data)} · получены
              устройством: {formatFetchedAt(data.fetchedAt)}
              {state.error ? ` · ${state.error}` : ""}
            </p>
          )}
          {state.status === "success" && state.warning && (
            <p className={styles["city-insights__note"]}>{state.warning}</p>
          )}
        </>
      ) : (
        <p className={styles["city-insights__detail"]}>
          {state.status === "loading"
            ? "Загружаем…"
            : "error" in state
              ? state.error
              : "Нет данных"}
        </p>
      )}
    </section>
  );
}

export function CityInsightsWidget({
  weatherState,
}: {
  weatherState: WeatherState;
}) {
  const airState = useAirQuality();
  const todayDate = getTodayInKyiv();
  const today =
    weatherState.status === "loading" || weatherState.status === "error"
      ? null
      : (weatherState.data.daily.find((day) => day.date === todayDate) ?? null);
  const illumination = SunCalc.getMoonIllumination(new Date());
  const moonPercent = Math.round(illumination.fraction * 100);

  return (
    <Panel
      compact
      className={styles["city-insights__panel"]}
      title="Качество воздуха и световой день"
    >
      <div className={styles["city-insights__content"]}>
        <AirQualitySection state={airState} />
        <section
          className={styles["city-insights__section"]}
          aria-label="Световой день"
        >
          <h3 className={styles["city-insights__section-title"]}>
            Световой день
          </h3>
          {today ? (
            <>
              <div className={styles["city-insights__sun-times"]}>
                <div>
                  <span>Восход</span>
                  <strong>{formatTime(today.sunrise)}</strong>
                </div>
                <div>
                  <span>Закат</span>
                  <strong>{formatTime(today.sunset)}</strong>
                </div>
              </div>
              <p className={styles["city-insights__detail"]}>
                Длительность {formatDuration(today.daylightDurationSeconds)}
              </p>
              {weatherState.status === "stale" && (
                <p className={styles["city-insights__note"]}>
                  Сохранённый прогноз
                </p>
              )}
            </>
          ) : (
            <p className={styles["city-insights__detail"]}>
              {weatherState.status === "loading"
                ? "Загружаем…"
                : weatherState.status === "error"
                  ? weatherState.error.message
                  : "Нет данных о световом дне на сегодня"}
            </p>
          )}
        </section>
        <section
          className={styles["city-insights__section"]}
          aria-label="Фаза Луны"
        >
          <h3 className={styles["city-insights__section-title"]}>Фаза Луны</h3>
          <p className={styles["city-insights__primary"]}>
            {getMoonPhase(illumination.phase)}
          </p>
          <p className={styles["city-insights__detail"]}>
            Освещённость {moonPercent}%
          </p>
        </section>
      </div>
    </Panel>
  );
}
