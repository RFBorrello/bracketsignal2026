export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function decimal(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}
