/**
 * form-validation.ts — Utilitas validasi form dengan feedback error eksplisit.
 *
 * Masalah UX yang diperbaiki: form yang return diam (silent return) saat input
 * tidak valid — user klik Submit/Create tapi tidak terjadi apa-apa dan tidak
 * tahu field mana yang salah.
 *
 * Pemakaian:
 *   1. Buat state error:  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({})
 *   2. Validasi di handler submit:
 *      const errs = validateFields({ title: [addTaskTitle, [required("Judul")]] });
 *      if (hasErrors(errs)) { setFieldErrors(errs); focusFirstError(errs); return; }
 *   3. Render: <FieldError message={fieldErrors.title} />
 *      Input error otomatis ter-highlight via helper fieldErrorStyle().
 */

import React from "react";

// ─────────────────────────────────────────────
// Rule validators
// ─────────────────────────────────────────────

export type FieldKey = string;
export type FieldValue = string | undefined | null;

/** Wajib diisi, tidak boleh kosong / hanya spasi. */
export function required(label: string) {
  return {
    test: (v: FieldValue) => String(v ?? "").trim().length > 0,
    message: `${label} wajib diisi (tidak boleh kosong atau hanya spasi).`,
  };
}

/** Wajib diisi + panjang minimum (dihitung setelah trim). */
export function minLength(label: string, min: number) {
  return {
    test: (v: FieldValue) => String(v ?? "").trim().length >= min,
    message: `${label} minimal ${min} karakter (tidak boleh kosong atau hanya spasi).`,
  };
}

/** Wajib diisi + panjang maksimum. */
export function maxLength(label: string, max: number) {
  return {
    test: (v: FieldValue) => String(v ?? "").trim().length <= max,
    message: `${label} maksimal ${max} karakter.`,
  };
}

/** Optional tapi jika diisi harus valid email. */
export function emailFormat(label: string, requiredField = false) {
  return {
    test: (v: FieldValue) => {
      const s = String(v ?? "").trim();
      if (!s) return !requiredField;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    },
    message: `Format ${label} tidak valid. Contoh benar: nama@company.com`,
  };
}

/** Optional tapi jika diisi hanya angka/spasi/+/-/(). */
export function phoneFormat(label: string) {
  return {
    test: (v: FieldValue) => {
      const s = String(v ?? "").trim();
      if (!s) return true;
      return /^[\d\s+\-()]{6,20}$/.test(s);
    },
    message: `${label} hanya boleh angka, spasi, dan simbol + - ( ) (6-20 karakter).`,
  };
}

// ─────────────────────────────────────────────
// Validate helper
// ─────────────────────────────────────────────

interface Rule {
  test: (v: FieldValue) => boolean;
  message: string;
}

/**
 * Validasi beberapa field sekaligus.
 * @param fields - { [fieldName]: [value, [rule1, rule2, ...]] }
 * @returns Record fieldName -> pesan error PERTAMA yang gagal (kosong jika lolos semua).
 */
export function validateFields(
  fields: Record<FieldKey, [FieldValue, Rule[]]>
): Record<FieldKey, string> {
  const errors: Record<FieldKey, string> = {};
  for (const [key, [value, rules]] of Object.entries(fields)) {
    for (const rule of rules) {
      if (!rule.test(value)) {
        errors[key] = rule.message;
        break; // pesan pertama yang gagal saja per field
      }
    }
  }
  return errors;
}

export function hasErrors(errors: Record<FieldKey, string>): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Fokus + highlight input pertama yang error.
 * Konvensi: elemen input diberi attribute data-error-field="<fieldName>"
 * atau id sama dengan fieldName.
 */
export function focusFirstError(errors: Record<FieldKey, string>) {
  for (const key of Object.keys(errors)) {
    const el =
      (document.querySelector(`[data-error-field="${key}"]`) as HTMLElement | null) ??
      (document.getElementById(key) as HTMLElement | null);
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Visual pulse — pastikan user melihat field yang bermasalah
      el.style.outline = "2px solid #ef4444";
      el.style.outlineOffset = "1px";
      setTimeout(() => {
        el.style.outline = "";
        el.style.outlineOffset = "";
      }, 2500);
      return;
    }
  }
}

// ─────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────

/** Pesan error merah di bawah field. Render null bila tidak ada error. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        marginTop: 6,
        fontSize: "0.75rem",
        lineHeight: 1.4,
        color: "#fca5a5",
        background: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.25)",
        borderRadius: 8,
        padding: "6px 10px",
      }}
    >
      <span style={{ fontWeight: 700, flexShrink: 0 }}>!</span>
      <span>{message}</span>
    </p>
  );
}

/** Style border merah untuk input yang error. */
export function fieldErrorStyle(message?: string): React.CSSProperties {
  if (!message) return {};
  return {
    borderColor: "#ef4444",
    boxShadow: "0 0 0 1px rgba(239, 68, 68, 0.4)",
  };
}
