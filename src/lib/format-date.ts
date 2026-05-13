const DISPLAY_TIME_ZONE = "Asia/Shanghai"

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const dateTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

function getParts(
  formatter: Intl.DateTimeFormat,
  value: string | null | undefined
) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )
}

export function formatDisplayDate(value: string | null | undefined) {
  const parts = getParts(datePartsFormatter, value)
  if (!parts) return "-"

  return `${parts.year}/${parts.month}/${parts.day}`
}

export function formatDisplayDateTime(value: string | null | undefined) {
  const parts = getParts(dateTimePartsFormatter, value)
  if (!parts) return "-"

  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}
