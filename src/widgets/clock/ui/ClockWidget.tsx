import { useEffect, useState } from "react";
import { Panel } from "@/shared/ui/panel";
import { KHARKIV_TIME_ZONE } from "@/shared/lib/timeZone";
import styles from "./ClockWidget.module.scss";

function createKyivFormatter(
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("ru-RU", {
    ...options,
    timeZone: KHARKIV_TIME_ZONE,
  });
}

const timeFormatter = createKyivFormatter({
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const weekdayFormatter = createKyivFormatter({ weekday: "long" });
const dateFormatter = createKyivFormatter({
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function ClockWidget() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const timeParts = timeFormatter.formatToParts(currentTime);
  const hours = timeParts.find((part) => part.type === "hour")?.value ?? "00";
  const minutes =
    timeParts.find((part) => part.type === "minute")?.value ?? "00";
  const seconds =
    timeParts.find((part) => part.type === "second")?.value ?? "00";

  return (
    <Panel className={styles["clock-widget__panel"]} title="Время">
      <div className={styles["clock-widget__content"]}>
        <time
          aria-label={timeFormatter.format(currentTime)}
          className={styles["clock-widget__time"]}
          dateTime={currentTime.toISOString()}
        >
          <span>{hours}</span>
          <span className={styles["clock-widget__separator"]}>:</span>
          <span>{minutes}</span>
          <span className={styles["clock-widget__seconds"]}>:{seconds}</span>
        </time>
        <p className={styles["clock-widget__weekday"]}>
          {weekdayFormatter.format(currentTime)}
        </p>
        <p className={styles["clock-widget__date"]}>
          {dateFormatter.format(currentTime)}
        </p>
      </div>
    </Panel>
  );
}
