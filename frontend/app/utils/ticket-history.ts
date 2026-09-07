/**
 * ticket-history.ts — Parser & formatter untuk system notes (Ticket History).
 *
 * System notes yang dihasilkan backend (format HTML tetap, author sistem):
 * - <p><strong>Status changed from X to Y</strong></p><p><em>Reason:</em> Z</p>
 * - <p><strong>Ticket transferred from A to B</strong></p><p><em>Reason:</em> Z</p>
 * - <p><strong>Ticket taken by X</strong></p>
 * - <p><strong>Admin changed Kategori ...</strong></p> (future-proof)
 * - <p><strong>Prioritas diganti dari 'X' menjadi 'Y'</strong></p>
 *
 * Ticket History menampilkan SEMUA perubahan (status + assignee + kategori)
 * dalam format rapi — bukan HTML mentah. Activity & Notes hanya chat/staff notes.
 */

export interface HistoryEntry {
  id: number | string;
  kind: "status" | "assignee" | "category" | "other";
  /** Ringkasan perubahan, mis. "Status: Assigned → In Progress" */
  label: string;
  /** Detail tambahan (from → to) */
  detail?: string;
  reason?: string;
  author?: string;
  createdAt: Date | string;
}

interface RawNote {
  id: number | string;
  content: string;
  author: string;
  createdAt: Date | string;
}

// ─────────────────────────────────────────────
// Deteksi system note
// ─────────────────────────────────────────────

const SYSTEM_NOTE_PATTERNS = [
  /Status changed from/i,
  /Status changed to/i,
  /Ticket transferred from/i,
  /Ticket taken by/i,
  /Ticket resolved on/i,
  /Kategori diganti/i,
  /Status diganti/i,
  /Assignee diganti/i,
  /Prioritas diganti/i,
  /Priority changed/i,
];

/** Apakah note adalah system note (perubahan status/assignee/kategori, bukan chat staff)? */
export function isSystemNote(content: string): boolean {
  const text = String(content || "");
  return SYSTEM_NOTE_PATTERNS.some((p) => p.test(text));
}

// ─────────────────────────────────────────────
// Parser system note → HistoryEntry rapi
// ─────────────────────────────────────────────

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReason(content: string): string | undefined {
  const m = content.match(/<em>Reason:\s*<\/em>\s*(.*?)\s*<\/p>/i);
  if (m) return stripHtml(m[1]);
  const m2 = content.match(/Reason:\s*(.*?)(?:<\/p>|$)/i);
  if (m2) return stripHtml(m2[1]);
  return undefined;
}

/** Parse system note HTML → HistoryEntry terstruktur (null jika bukan system note). */
export function parseSystemNote(note: RawNote): HistoryEntry | null {
  const content = String(note.content || "");
  const reason = extractReason(content);

  // 1. Status: "Status changed from X to Y"
  let m = content.match(/Status changed from\s*(.*?)\s*to\s*(.*?)<\/strong>/i);
  if (m) {
    return {
      id: note.id,
      kind: "status",
      label: "Status Diubah",
      detail: `${stripHtml(m[1])} → ${stripHtml(m[2])}`,
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // 1b. Resolved: "Ticket resolved on <tanggal>" — tanpa reason (alasan di Resolution Summary).
  //     Timestamp entry memakai note.createdAt (set backend = tanggal resolved custom).
  m = content.match(/Ticket resolved on\s*(.*?)<\/strong>/i);
  if (m) {
    return {
      id: note.id,
      kind: "status",
      label: "Tiket Diselesaikan (Resolved)",
      detail: stripHtml(m[1]),
      reason: undefined, // sengaja tanpa alasan — sudah ada di Resolution Summary
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // 2. Status (tanpa from): "Status changed to X"
  m = content.match(/Status changed to\s*(.*?)<\/strong>/i);
  if (m) {
    return {
      id: note.id,
      kind: "status",
      label: "Status Diubah",
      detail: `→ ${stripHtml(m[1])}`,
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // 3. Transfer/oper: "Ticket transferred from A to B"
  m = content.match(/Ticket transferred from\s*(.*?)\s*to\s*(.*?)<\/strong>/i);
  if (m) {
    return {
      id: note.id,
      kind: "assignee",
      label: "Tiket Dioper",
      detail: `${stripHtml(m[1])} → ${stripHtml(m[2])}`,
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // 4. Take: "Ticket taken by X"
  m = content.match(/Ticket taken by\s*(.*?)<\/strong>/i);
  if (m) {
    return {
      id: note.id,
      kind: "assignee",
      label: "Tiket Diambil",
      detail: stripHtml(m[1]),
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // 5. Kategori: "Kategori diganti dari 'X' menjadi 'Y'"
  m = content.match(/Kategori diganti dari\s*'(.*?)'\s*menjadi\s*'(.*?)'/i);
  if (m) {
    return {
      id: note.id,
      kind: "category",
      label: "Kategori Diubah",
      detail: `${m[1]} → ${m[2]}`,
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // 6. Kategori (varian tanpa quote): "Kategori diganti dari X menjadi Y"
  m = content.match(/Kategori diganti dari\s*(.*?)\s*menjadi\s*(.*?)(?:<\/strong>|<\/p>|$)/i);
  if (m) {
    return {
      id: note.id,
      kind: "category",
      label: "Kategori Diubah",
      detail: `${stripHtml(m[1])} → ${stripHtml(m[2])}`,
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // 7. Prioritas: "Prioritas diganti dari 'X' menjadi 'Y'"
  m = content.match(/Prioritas diganti dari\s*'(.*?)'\s*menjadi\s*'(.*?)'/i);
  if (m) {
    return {
      id: note.id,
      kind: "other",
      label: "Prioritas Diubah",
      detail: `${m[1]} → ${m[2]}`,
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // 7b. Prioritas (varian tanpa quote): "Prioritas diganti dari X menjadi Y"
  m = content.match(/Prioritas diganti dari\s*(.*?)\s*menjadi\s*(.*?)(?:<\/strong>|<\/p>|$)/i);
  if (m) {
    return {
      id: note.id,
      kind: "other",
      label: "Prioritas Diubah",
      detail: `${stripHtml(m[1])} → ${stripHtml(m[2])}`,
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  // Fallback: system note lain → tampil generik (tanpa HTML mentah)
  if (isSystemNote(content)) {
    return {
      id: note.id,
      kind: "other",
      label: "Perubahan Tiket",
      detail: stripHtml(content).slice(0, 140),
      reason,
      author: note.author,
      createdAt: note.createdAt,
    };
  }

  return null;
}

/** Ambil semua system notes → daftar HistoryEntry terurut terbaru-dulu. */
export function buildTicketHistory(notes: RawNote[]): HistoryEntry[] {
  return notes
    .map((n) => parseSystemNote(n))
    .filter((e): e is HistoryEntry => e !== null)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}
