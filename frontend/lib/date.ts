export function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return [start, end];
}

export function yearRange(year: string): [string, string] {
  return [`${year}-01-01`, `${Number(year) + 1}-01-01`];
}

export function prevMonthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  return monthRange(`${prevY}-${String(prevM).padStart(2, "0")}`);
}
