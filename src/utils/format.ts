export function formatFCFA(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2).replace('.', ',')} M FCFA`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${Math.round(value / 1000)} k FCFA`;
    }
  }
  return `${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function relativeDayLabel(dayIndex: number, total: number): string {
  const offset = total - 1 - dayIndex;
  if (offset === 0) return "Aujourd'hui";
  return `J-${offset}`;
}
