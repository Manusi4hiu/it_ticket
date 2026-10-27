/**
 * date.ts
 *
 * Utility functions untuk formatting tanggal dan waktu,
 * serta kalkulasi SLA jam kerja operasional (08:00 - 17:00 WIB, Senin - Jumat, libur dikecualikan).
 */

export interface HolidayLike {
  holidayDate: string; // YYYY-MM-DD
  isRecurring?: boolean;
  name?: string;
  [key: string]: any;
}

interface HolidayLookup {
  exact: Map<string, HolidayLike>;
  recurring: HolidayLike[];
}

const holidayLookupCache = new WeakMap<HolidayLike[], HolidayLookup>();

export function getHolidayLookup(holidays?: HolidayLike[]): HolidayLookup | null {
  if (!holidays || holidays.length === 0) return null;
  let cached = holidayLookupCache.get(holidays);
  if (!cached) {
    const exact = new Map<string, HolidayLike>();
    const recurring: HolidayLike[] = [];
    for (const h of holidays) {
      if (h.isActive === false || h.isHoliday === false) {
        continue;
      }
      if (h.isRecurring) {
        recurring.push(h);
      } else if (h.holidayDate) {
        exact.set(h.holidayDate, h);
      }
    }
    cached = { exact, recurring };
    holidayLookupCache.set(holidays, cached);
  }
  return cached;
}

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
 * Dapatkan data hari libur nasional / cuti bersama khusus pada tanggal tertentu jika ada.
 * Mengembalikan objek HolidayLike atau undefined jika bukan hari libur nasional/cuti bersama.
 */
export function getSpecialHoliday(date: Date, holidays?: HolidayLike[]): HolidayLike | undefined {
  if (!holidays || holidays.length === 0) return undefined;
  const lookup = getHolidayLookup(holidays);
  if (!lookup) return undefined;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dStr = String(date.getDate()).padStart(2, "0");
  const dateKey = `${year}-${month}-${dStr}`;

  const match = lookup.exact.get(dateKey);
  if (match) return match;

  if (lookup.recurring.length > 0) {
    const monthDayKey = `${month}-${dStr}`;
    return lookup.recurring.find((h) => h.holidayDate?.endsWith(monthDayKey));
  }

  return undefined;
}

/**
 * Periksa apakah tanggal tertentu merupakan hari kerja (Senin - Jumat) dan bukan hari libur nasional.
 */
export function isWorkingDay(date: Date, holidays?: HolidayLike[]): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    // 0 = Minggu, 6 = Sabtu
    return false;
  }

  return !getSpecialHoliday(date, holidays);
}

/**
 * Periksa apakah saat ini berada dalam jam operasional kerja (08:00 - 17:00 pada hari kerja).
 */
export function isWithinWorkingHours(date: Date = new Date(), holidays?: HolidayLike[]): boolean {
  if (!isWorkingDay(date, holidays)) return false;
  const hours = date.getHours();
  return hours >= 8 && hours < 17;
}

/**
 * Hitung durasi kerja operasional (dalam menit) antara start dan end,
 * hanya menghitung jam 08:00 - 17:00 pada hari kerja (Senin - Jumat, skipping hari libur).
 *
 * Contoh:
 * - Start Senin 13:45, End Selasa 11:25:
 *   Senin: 13:45 - 17:00 = 195 menit
 *   Selasa: 08:00 - 11:25 = 205 menit
 *   Total: 400 menit (6 jam 40 menit).
 */
export function calculateBusinessDurationMinutes(
  start: Date | string,
  end: Date | string,
  holidays?: HolidayLike[],
): number {
  if (!start || !end) return 0;
  let cur = new Date(start);
  const target = new Date(end);
  if (isNaN(cur.getTime()) || isNaN(target.getTime()) || target <= cur) return 0;

  let elapsed = 0;
  const maxIterations = 365 * 2; // Guard anti infinite loop
  let iter = 0;

  while (cur < target && iter++ < maxIterations) {
    if (!isWorkingDay(cur, holidays)) {
      // Lompat ke hari berikutnya jam 08:00
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 8, 0, 0, 0);
      continue;
    }

    const workStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 8, 0, 0, 0);
    const workEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 17, 0, 0, 0);

    if (cur < workStart) cur = workStart;
    if (cur >= workEnd) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 8, 0, 0, 0);
      continue;
    }

    const windowEnd = target < workEnd ? target : workEnd;
    if (cur < windowEnd) {
      elapsed += Math.floor((windowEnd.getTime() - cur.getTime()) / (1000 * 60));
      cur = new Date(windowEnd);
    }

    if (cur >= workEnd) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 8, 0, 0, 0);
    }
  }

  return elapsed;
}

/**
 * Hitung selisih waktu kerja antara dua Date dan return string "Xh Ym".
 * Hanya menghitung jam kerja operasional (08:00 - 17:00 WIB, hari kerja).
 *
 * @param start - Waktu mulai (diambil / assigned)
 * @param end - Waktu selesai (resolved)
 * @param holidays - Daftar hari libur dari master data
 * @returns Contoh: "6h 40m"
 */
export function formatDuration(start: Date | string, end: Date | string, holidays?: HolidayLike[]): string {
  const mins = calculateBusinessDurationMinutes(start, end, holidays);
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${minutes}m`;
}

/**
 * Hitung sisa waktu hingga deadline SLA dan return string yang human-readable.
 * Mengikuti jam operasional:
 * - Jika sedang di luar jam kerja (malam/akhir pekan/libur), status ditampilkan "(Paused)".
 * - Jika deadline sudah lewat, menampilkan "Xh Ym overdue".
 *
 * @param deadline - Tanggal deadline SLA
 * @param pausedAt - Tanggal kapan SLA dipause oleh status tiket (optional)
 * @param holidays - Daftar hari libur dari master data
 */
export function formatTimeRemaining(
  deadline: Date | string | undefined,
  pausedAt?: Date | string,
  holidays?: HolidayLike[],
): string {
  if (!deadline) return "Not started";

  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) return "Not started";

  const comparisonTime = pausedAt ? new Date(pausedAt) : new Date();

  // Jika deadline sudah lewat
  if (comparisonTime > deadlineDate) {
    const overdueMins = calculateBusinessDurationMinutes(deadlineDate, comparisonTime, holidays);
    const hours = Math.floor(overdueMins / 60);
    const minutes = overdueMins % 60;
    return `${hours}h ${minutes}m overdue`;
  }

  // Masih dalam batas waktu: hitung sisa menit jam kerja
  const remainingMins = calculateBusinessDurationMinutes(comparisonTime, deadlineDate, holidays);
  const hours = Math.floor(remainingMins / 60);
  const minutes = remainingMins % 60;

  // Cek apakah saat ini sedang di luar jam kerja atau hari libur
  const isPausedTime = pausedAt ? true : !isWithinWorkingHours(comparisonTime, holidays);
  if (isPausedTime) {
    return `${hours}h ${minutes}m (Paused)`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Validasi apakah input tanggal dan jam resolusi valid sesuai aturan bisnis:
 * 1. Tidak boleh di masa depan (maksimal sekarang).
 * 2. Hanya bisa di hari kerja (Senin - Jumat).
 * 3. Tidak boleh di hari libur nasional.
 * 4. Jam harus berada dalam rentang 08:00 - 17:00 WIB.
 */
export function validateWorkingHoursDateTime(
  dateInput: Date | string,
  holidays?: HolidayLike[],
): { valid: boolean; error?: string } {
  if (!dateInput) {
    return { valid: false, error: "Waktu penyelesaian wajib diisi." };
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return { valid: false, error: "Format tanggal tidak valid." };
  }

  const now = new Date();
  if (d.getTime() > now.getTime() + 60000) {
    return { valid: false, error: "Waktu penyelesaian tidak boleh di masa depan (maksimal sekarang)." };
  }

  const day = d.getDay();
  if (day === 0 || day === 6) {
    const dayName = day === 0 ? "Minggu" : "Sabtu";
    return { valid: false, error: `Hari ${dayName} adalah hari libur di luar jam operasional kerja.` };
  }

  if (holidays && holidays.length > 0) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dStr = String(d.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${dStr}`;
    const monthDayKey = `${month}-${dStr}`;

    const isHol = holidays.some((h) => {
      if (h.isActive === false || h.isHoliday === false) return false;
      if (h.isRecurring) {
        return h.holidayDate.endsWith(monthDayKey);
      }
      return h.holidayDate === dateKey;
    });

    if (isHol) {
      return { valid: false, error: "Tanggal ini jatuh pada hari libur nasional." };
    }
  }

  const hours = d.getHours();
  const minutes = d.getMinutes();
  const totalMins = hours * 60 + minutes;
  const startMins = 8 * 60; // 08:00
  const endMins = 17 * 60; // 17:00

  if (totalMins < startMins || totalMins > endMins) {
    const formattedHour = String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
    return {
      valid: false,
      error: `Jam penyelesaian hanya bisa di jam kerja (08:00 - 17:00 WIB). Jam yang dipilih: ${formattedHour}.`,
    };
  }

  return { valid: true };
}

/**
 * Mengambil default datetime yang valid di dalam jam kerja (clamped ke 08:00 - 17:00).
 * Jika sekarang malam / weekend / libur, mundurkan ke jam 17:00 hari kerja terakhir.
 */
export function getInitialWorkingDateTime(date: Date = new Date(), holidays?: HolidayLike[]): string {
  let d = new Date(date);

  // Jika jam >= 17, clamp ke 17:00 hari ini
  if (d.getHours() >= 17) {
    d.setHours(17, 0, 0, 0);
  }
  // Jika jam < 8, clamp ke 17:00 hari sebelumnya
  else if (d.getHours() < 8) {
    d.setDate(d.getDate() - 1);
    d.setHours(17, 0, 0, 0);
  }

  // Mundurkan jika hari libur atau weekend
  let guard = 0;
  while (!isWorkingDay(d, holidays) && guard++ < 30) {
    d.setDate(d.getDate() - 1);
    d.setHours(17, 0, 0, 0);
  }

  return toDatetimeLocalString(d);
}
