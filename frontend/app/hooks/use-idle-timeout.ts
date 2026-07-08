import { useEffect, useRef, useState, useCallback } from 'react';
import { useSubmit } from 'react-router';
import { clearAuthToken } from '~/services/api.service';

/**
 * useIdleTimeout — mendeteksi inaktivitas user dan menampilkan warning
 * sebelum melakukan auto-logout.
 *
 * @param timeoutMinutes   Total menit idle sebelum auto-logout (default: 480 = 8 jam)
 * @param isAuth           Aktifkan hook hanya jika user sudah login
 * @param warningMinutes   Berapa menit sebelum logout warning ditampilkan (default: 2)
 */
export function useIdleTimeout(
  timeoutMinutes: number = 480,
  isAuth: boolean = true,
  warningMinutes: number = 2
) {
  const submit = useSubmit();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(warningMinutes * 60);

  const handleLogout = useCallback(() => {
    setShowWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    clearAuthToken(); // Bersihkan token in-memory sebelum redirect
    const formData = new FormData();
    formData.append('intent', 'logout');
    submit(formData, { method: 'post', action: '/dashboard' });
  }, [submit]);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    const totalSeconds = warningMinutes * 60;
    setSecondsLeft(totalSeconds);

    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningMinutes]);

  /** Reset semua timer — dipanggil saat ada aktivitas user atau user klik "Lanjutkan Sesi" */
  const resetTimer = useCallback(() => {
    setShowWarning(false);
    clearAllTimers();

    const warningDelay = (timeoutMinutes - warningMinutes) * 60 * 1000;
    const logoutDelay = timeoutMinutes * 60 * 1000;

    // Tampilkan warning {warningMinutes} menit sebelum logout
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, warningDelay);

    // Auto logout setelah timeout penuh
    timeoutRef.current = setTimeout(handleLogout, logoutDelay);
  }, [timeoutMinutes, warningMinutes, handleLogout, clearAllTimers, startCountdown]);

  useEffect(() => {
    if (!isAuth) return;

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    // Reset timer hanya jika warning belum tampil
    // Saat warning tampil, aktivitas tidak lagi reset timer
    const handleActivity = () => {
      setShowWarning((isWarning) => {
        if (!isWarning) resetTimer();
        return isWarning;
      });
    };

    events.forEach((event) => document.addEventListener(event, handleActivity));

    return () => {
      clearAllTimers();
      events.forEach((event) => document.removeEventListener(event, handleActivity));
    };
  }, [isAuth, resetTimer, clearAllTimers]);

  return {
    showWarning,
    secondsLeft,
    extendSession: resetTimer,
    logoutNow: handleLogout,
  };
}
