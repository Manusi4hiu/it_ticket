import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usersApi } from "~/services/api.service";
import { Coffee } from "lucide-react";

export function GlobalBreakModal({ userId }: { userId: string | number }) {
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const checkBreakStatus = async () => {
    if (!userId) return;
    try {
      const res = await usersApi.getById(String(userId));
      if (res.success && res.data?.user) {
        setIsOnBreak(res.data.user.isOnBreak || res.data.user.presenceStatus === 'break');
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
