import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { usersApi } from "~/services/api.service";
import { Coffee, Clock } from "lucide-react";

export function GlobalBreakModal({ userId }: { userId: string | number }) {
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartedAt, setBreakStartedAt] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const checkBreakStatus = async () => {
    if (!userId) return;
    try {
      const res = await usersApi.getById(String(userId));
      if (res.success && res.data?.user) {
        setIsOnBreak(res.data.user.isOnBreak || res.data.user.presenceStatus === 'break');
        setBreakStartedAt(res.data.user.breakStartedAt || null);
      }
    } catch (e) {
      console.error("Failed to check break status:", e);
    }
  };

  useEffect(() => {
    if (!userId) return;
    
    // Check immediately on mount
    void checkBreakStatus();

    // Poll every 10 seconds to catch changes
    const interval = setInterval(checkBreakStatus, 10000);

    const handleToggle = () => checkBreakStatus();
    window.addEventListener('break-toggled', handleToggle);

    return () => {
      clearInterval(interval);
      window.removeEventListener('break-toggled', handleToggle);
    };
  }, [userId]);

  useEffect(() => {
    if (!isOnBreak) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOnBreak]);

  const elapsedSeconds = useMemo(() => {
    if (!isOnBreak || !breakStartedAt) return 0;
    const start = new Date(breakStartedAt).getTime();
    return Math.max(0, Math.floor((nowTick - start) / 1000));
  }, [isOnBreak, breakStartedAt, nowTick]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndBreak = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const res = await usersApi.toggleBreak(String(userId));
      if (res.success && res.data?.id) {
        setIsOnBreak(res.data.isOnBreak || false);
      }
      await checkBreakStatus();
    } catch (e) {
      console.error("Failed to end break:", e);
    } finally {
      setIsToggling(false);
    }
  };

  if (!isOnBreak) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div 
          style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: 'rgba(251, 146, 60, 0.1)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 24px auto'
          }}
        >
          <Coffee size={40} color="#fb923c" />
        </div>
        
        <h2 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '24px', fontWeight: 600 }}>
          Sedang Istirahat
        </h2>
        
        {breakStartedAt && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '16px',
            color: '#fb923c',
            fontWeight: 'bold',
            fontSize: '18px',
            background: 'rgba(251, 146, 60, 0.1)',
            padding: '8px 16px',
            borderRadius: '20px',
            width: 'fit-content',
            margin: '0 auto 24px auto'
          }}>
            <Clock size={20} />
            {formatTime(elapsedSeconds)}
          </div>
        )}

        <p style={{ color: '#94a3b8', marginBottom: '32px', fontSize: '15px', lineHeight: '1.6' }}>
          Anda saat ini dalam status Break. Selesaikan waktu istirahat Anda untuk kembali menerima dan mengerjakan tiket.
        </p>

        <button
          onClick={handleEndBreak}
          disabled={isToggling}
          style={{
            width: '100%',
            padding: '14px 24px',
            backgroundColor: '#fb923c',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: isToggling ? 'not-allowed' : 'pointer',
            opacity: isToggling ? 0.7 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {isToggling ? 'Menyelesaikan...' : 'Selesai Break'}
        </button>
      </div>
    </div>
  );
}
