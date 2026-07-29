/**
 * date.ts
 *
 * Utility functions untuk formatting tanggal dan waktu.
 * Terpusat agar tidak ada duplikasi di setiap route/component.
 */

/**
 * Format Date menjadi string display (locale id-ID).
 *
 * @param date - Date object atau string ISO
 * @returns Contoh: "28 Jul 2026, 08.30"
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format Date menjadi string yang kompatibel dengan input[type="datetime-local"].
 * Format output: "YYYY-MM-DDThh:mm"
 *
 * @param date - Date object
 * @returns String datetime-local, contoh: "2026-07-28T08:30"
 */
export function toDatetimeLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

/**
 * Hitung selisih waktu antara dua Date dan return string "Xh Ym".
 * Menggunakan nilai absolut sehingga urutan start/end tidak berpengaruh.
 *
 * @param start - Waktu mulai
 * @param end - Waktu selesai
 * @returns Contoh: "2h 35m"
 */
export function formatDuration(start: Date | string, end: Date | string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
  const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

/**
 * Hitung sisa waktu hingga deadline dan return string yang human-readable.
 * Jika deadline sudah terlewat, menampilkan "Xh Ym overdue".
 *
 * @param deadline - Tanggal deadline (optional)
 * @param pausedAt - Tanggal kapan SLA dipause (optional). Jika ada, waktu berhenti dihitung pada pausedAt.
 * @returns Contoh: "3h 20m" atau "1h 5m overdue" atau "Not started"
 */
export function formatTimeRemaining(deadline: Date | string | undefined, pausedAt?: Date | string): string {
  if (!deadline) return "Not started";

  const comparisonTime = pausedAt ? new Date(pausedAt) : new Date();
  const diff = new Date(deadline).getTime() - comparisonTime.getTime();
  const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
  const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));

  if (diff < 0) return `${hours}h ${minutes}m overdue`;
  return `${hours}h ${minutes}m`;
}
