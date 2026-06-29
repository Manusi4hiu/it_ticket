import { useEffect, useRef } from 'react';
import { useSubmit } from 'react-router';

export function useIdleTimeout(timeoutMinutes: number = 480, isAuth: boolean = true) {
  const submit = useSubmit();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuth) return;

    const handleIdle = () => {
      const formData = new FormData();
      formData.append('intent', 'logout');
      submit(formData, { method: 'post', action: '/dashboard' });
    };

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(handleIdle, timeoutMinutes * 60 * 1000);
    };

    // Set initial timer
    resetTimer();

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart'
    ];

    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuth, timeoutMinutes, submit]);
}
