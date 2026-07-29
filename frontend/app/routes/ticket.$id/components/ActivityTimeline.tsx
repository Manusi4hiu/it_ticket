/**
 * ActivityTimeline.tsx
 *
 * Komponen timeline untuk menampilkan activity log dan internal notes
 * pada halaman ticket detail.
 * Hanya ditampilkan untuk user yang sudah login (disembunyikan dari public view).
 */

import { MessageSquare } from "lucide-react";
import type { TicketNote } from "~/services/ticket.service";
import { formatDate } from "~/utils/date";
import styles from "../style.module.css";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ActivityTimelineProps {
  /** Daftar notes/activity dari ticket */
  notes: TicketNote[];
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

/**
 * ActivityTimeline
 *
 * Menampilkan daftar notes dalam format timeline.
 * Internal notes diberi styling berbeda dan label "Internal Only".
 * Mendukung attachment gambar per note.
 *
 * @example
 * <ActivityTimeline notes={ticket.notes} />
 */
export function ActivityTimeline({ notes }: ActivityTimelineProps) {
  const filteredNotes = notes.filter(note => !note.content.includes('Status changed'));

  return (
    <div className={styles.section} id="activity">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <MessageSquare className={styles.sectionIcon} />
          Activity &amp; Notes
        </h2>
      </div>

      <div className={styles.sectionContent}>
        {filteredNotes.length === 0 ? (
          <EmptyNotes />
        ) : (
          <div className={styles.timeline}>
            {filteredNotes.map((note) => (
              <TimelineItem key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components (internal, tidak di-export)
// ─────────────────────────────────────────────

/** Tampilan ketika belum ada notes sama sekali. */
function EmptyNotes() {
  return (
    <div className={styles.emptyNotes}>
      <MessageSquare className={styles.emptyNotesIcon} />
      <p>No notes or activity yet</p>
    </div>
  );
}

/** Satu item dalam timeline notes. */
function TimelineItem({ note }: { note: TicketNote }) {
  return (
    <div
      className={`${styles.timelineItem} ${
        note.isInternal ? styles.timelineItemInternal : ""
      }`}
    >
      <div
        className={`${styles.timelineContent} ${
          note.isInternal ? styles.timelineContentInternal : ""
        }`}
      >
        <div className={styles.timelineHeader}>
          <span className={styles.timelineAuthor}>{note.author}</span>
          <span className={styles.timelineTime}>{formatDate(note.createdAt)}</span>
          {note.isInternal && (
            <span className={styles.internalBadge}>Internal Only</span>
          )}
        </div>

        <p className={styles.timelineText}>{note.content}</p>

        {note.imageUrl && (
          <div className={styles.noteImageContainer}>
            <a
              href={`${BACKEND_URL}${note.imageUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={`${BACKEND_URL}${note.imageUrl}`}
                alt="Documentation"
                className={styles.noteImage}
              />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
