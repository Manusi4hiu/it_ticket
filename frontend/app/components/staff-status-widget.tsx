import { useState, useEffect, useRef } from "react";
import { Users, Search, RefreshCw, X } from "lucide-react";
import { usersApi } from "~/services/api.service";
import type { Agent } from "~/types/user.types";

const PRESENCE_COLORS: Record<string, string> = {
  online: '#22c55e',
  idle: '#f59e0b',
  dnd: '#ef4444',
  invisible: '#94a3b8',
  break: '#fb923c',
};

export function StaffStatusWidget() {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAgents();
      if (res.success && res.data?.agents) {
        setAgents(res.data.agents);
      }
    } catch (e) {
      console.error("Failed to load agents:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    // Fetch immediately when opened
    void fetchAgents();

    // Auto-refresh every 30 seconds while open
    const interval = setInterval(() => {
      void fetchAgents();
    }, 30000);

    return () => clearInterval(interval);
  }, [open]);

  const handleMouseEnter = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeout.current = setTimeout(() => {
      setOpen(false);
    }, 300);
  };

  const filteredAgents = agents.filter(a =>
    a.isActive !== false &&
    a.presenceStatus !== 'invisible' &&
    (
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.username.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div
      style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        title="Staff List"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <Users size={24} />
      </button>

      {/* Popup Panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '70px', // above the button
            right: '0',
            width: '280px',
            background: 'rgba(10, 15, 30, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeInUp 0.2s ease-out'
          }}
        >
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#f1f5f9' }}>Staff List</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={fetchAgents} disabled={loading} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  outline: 'none',
                  fontSize: '12px'
                }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px 12px' }}>
            {loading && agents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>Loading...</div>
            ) : filteredAgents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>No staff found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredAgents.map(agent => {
                  const status = agent.presenceStatus || 'online';
                  const color = PRESENCE_COLORS[status] || PRESENCE_COLORS.online;
                  return (
                    <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd', fontWeight: 600, fontSize: '14px' }}>
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: color, border: '2px solid #0a0f1e' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {agent.name}
                        </div>
                        {agent.customStatusMessage ? (
                          <div style={{ fontSize: '11px', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            💬 {agent.customStatusMessage}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'capitalize' }}>
                            {status}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
