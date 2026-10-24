export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** "25000" -> "25.000" (untuk tampilan input). */
export function formatThousands(value: string): string {
  const digits = digitsOnly(value);

  return digits ? Number(digits).toLocaleString('id-ID') : '';
}

export function formatRupiah(value: number): string {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

/** "Sabtu, 10 Oktober" */
export function formatDateLong(date: Date = new Date()): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
