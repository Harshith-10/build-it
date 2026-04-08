export function getLocalTimeZoneName(
  dateInput: Date | string | number = new Date(),
) {
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).formatToParts(date);

    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function getLocalTimeZoneId() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

export function formatLocalDateTime(
  dateInput: Date | string | number,
  options: Intl.DateTimeFormatOptions,
) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, options).format(date);
}
