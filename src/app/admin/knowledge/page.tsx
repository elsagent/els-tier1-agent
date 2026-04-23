'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───
interface VectorFile {
  id: string;
  filename: string;
  bytes: number;
  created_at: number;
  status: string;
}

interface VectorStoreInfo {
  id: string;
  name: string;
  status: string;
  file_counts: { total: number; completed: number; in_progress: number; failed: number };
  usage_bytes: number;
  created_at: number;
}

interface KnowledgeData {
  tier: string;
  label: string;
  vector_store: VectorStoreInfo;
  files: VectorFile[];
}

// ─── Constants ───
const TIERS = [
  { key: 'tier1', label: 'Tier 1 — Customer Support', color: '#C8102E', bgLight: '#fdf2f4', icon: '👥' },
  { key: 'tier2', label: 'Tier 2 — Technical Support', color: '#1e40af', bgLight: '#eff6ff', icon: '🔧' },
];

const SECRET_KEY = 'els_admin_secret';

// ─── Helpers ───
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Main Page ───
export default function KnowledgeBasePage() {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTier, setActiveTier] = useState('tier1');
  const [data, setData] = useState<Record<string, KnowledgeData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore secret from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SECRET_KEY);
      if (saved) {
        setSecret(saved);
        setAuthenticated(true);
      }
    } catch { /* ignore */ }
  }, []);

  const getSecret = useCallback(() => {
    try { return sessionStorage.getItem(SECRET_KEY) || secret; } catch { return secret; }
  }, [secret]);

  // Fetch data for a tier
  const fetchTier = useCallback(async (tier: string) => {
    const s = getSecret();
    if (!s) return;
    setLoading(prev => ({ ...prev, [tier]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/knowledge?tier=${tier}&secret=${encodeURIComponent(s)}`);
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem(SECRET_KEY);
        setError('Invalid admin secret');
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(prev => ({ ...prev, [tier]: json }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(prev => ({ ...prev, [tier]: false }));
    }
  }, [getSecret]);

  // Fetch both on auth
  useEffect(() => {
    if (authenticated) {
      fetchTier('tier1');
      fetchTier('tier2');
    }
  }, [authenticated, fetchTier]);

  // Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    try { sessionStorage.setItem(SECRET_KEY, secret); } catch { /* ignore */ }
    setAuthenticated(true);
  };

  // Upload
  const handleUpload = async (files: FileList | File[]) => {
    const s = getSecret();
    if (!files.length || !s) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('secret', s);
      formData.append('tier', activeTier);
      Array.from(files).forEach(f => formData.append('files', f));

      const res = await fetch('/api/admin/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Upload failed');
      }

      const json = await res.json();
      setSuccessMsg(`Uploaded ${json.uploaded.length} file(s) successfully`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchTier(activeTier);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete
  const handleDelete = async (fileId: string, filename: string) => {
    const s = getSecret();
    if (!s) return;
    if (!confirm(`Remove "${filename}" from the knowledge base?\n\nThis cannot be undone.`)) return;

    setDeleting(fileId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/knowledge?tier=${activeTier}&fileId=${fileId}&secret=${encodeURIComponent(s)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Delete failed');
      }
      setSuccessMsg(`Removed "${filename}"`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await fetchTier(activeTier);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  };

  // ─── LOGIN SCREEN ───
  if (!authenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #fdf2f4 0%, #f8fafc 50%, #eff6ff 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <form onSubmit={handleLogin} style={{
          background: '#fff', borderRadius: 16, padding: '40px 36px',
          boxShadow: '0 4px 24px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.04)',
          width: 400, maxWidth: '90vw',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Knowledge Base Admin</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Enter your admin secret to manage files</p>
          </div>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16,
            }}>{error}</div>
          )}
          <input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            style={{
              width: '100%', padding: '12px 16px', fontSize: 14, border: '1.5px solid #e2e8f0',
              borderRadius: 10, outline: 'none', transition: 'border-color 0.15s',
              background: '#f8fafc',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#C8102E'}
            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
            autoFocus
          />
          <button type="submit" style={{
            width: '100%', marginTop: 16, padding: '12px 0', fontSize: 14, fontWeight: 700,
            background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
            onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
          >
            Sign In
          </button>
        </form>
      </div>
    );
  }

  // ─── MAIN DASHBOARD ───
  const tierData = data[activeTier];
  const tierConfig = TIERS.find(t => t.key === activeTier)!;
  const isLoading = loading[activeTier];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #fdf2f4 0%, #f8fafc 50%, #eff6ff 100%)',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ─── Header ─── */}
      <header style={{
        background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.06)',
        padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/el-logo.png" alt="ELS" style={{ width: 40, height: 'auto' }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Electronic Locksmith</span>
        </a>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Knowledge Base Manager</span>
        <button
          onClick={() => { setAuthenticated(false); sessionStorage.removeItem(SECRET_KEY); }}
          style={{
            background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#64748b',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8102E'; e.currentTarget.style.color = '#C8102E'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
        >
          Sign Out
        </button>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* ─── Tier Tabs ─── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          {TIERS.map(tier => {
            const isActive = activeTier === tier.key;
            const tierInfo = data[tier.key];
            return (
              <button
                key={tier.key}
                onClick={() => setActiveTier(tier.key)}
                style={{
                  flex: 1, padding: '20px 24px', borderRadius: 14, border: 'none',
                  background: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                  boxShadow: isActive ? `0 2px 12px rgba(15,23,42,0.08), 0 0 0 2px ${tier.color}20` : '0 1px 3px rgba(15,23,42,0.04)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  transform: isActive ? 'translateY(-1px)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{tier.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: isActive ? tier.color : '#475569' }}>{tier.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
                  {tierInfo ? (
                    <>
                      <span><strong style={{ color: '#334155' }}>{tierInfo.vector_store.file_counts.total}</strong> files</span>
                      <span>{formatBytes(tierInfo.vector_store.usage_bytes)}</span>
                      <span style={{
                        color: tierInfo.vector_store.status === 'completed' ? '#16a34a' : '#f59e0b',
                        fontWeight: 600,
                      }}>● {tierInfo.vector_store.status}</span>
                    </>
                  ) : (
                    <span>{loading[tier.key] ? 'Loading…' : '—'}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ─── Alerts ─── */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '12px 18px', fontSize: 13, color: '#dc2626', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚠️</span> {error}
            <button onClick={() => setError(null)} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: '#dc2626', fontWeight: 700, fontSize: 16, padding: '0 4px',
            }}>×</button>
          </div>
        )}
        {successMsg && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
            padding: '12px 18px', fontSize: 13, color: '#16a34a', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeIn 0.3s ease',
          }}>
            <span>✅</span> {successMsg}
          </div>
        )}

        {/* ─── Upload Zone ─── */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            background: dragOver ? tierConfig.bgLight : '#fff',
            border: `2px dashed ${dragOver ? tierConfig.color : '#e2e8f0'}`,
            borderRadius: 14, padding: '28px 24px', marginBottom: 24,
            textAlign: 'center', transition: 'all 0.2s', cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,.md,.txt,.pdf,.csv,.docx"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files?.length) handleUpload(e.target.files);
            }}
          />
          {uploading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{
                width: 20, height: 20, border: `3px solid ${tierConfig.color}30`,
                borderTopColor: tierConfig.color, borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: tierConfig.color }}>Uploading…</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                Drop files here or <span style={{ color: tierConfig.color, textDecoration: 'underline' }}>browse</span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Supports JSON, Markdown, TXT, PDF, CSV, DOCX • Uploads to <strong>{tierConfig.label}</strong>
              </div>
            </>
          )}
        </div>

        {/* ─── File List ─── */}
        <div style={{
          background: '#fff', borderRadius: 14,
          boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.02)',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 100px 180px 80px',
            padding: '14px 24px', background: '#f8fafc',
            borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 700,
            color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>Filename</span>
            <span>Size</span>
            <span>Uploaded</span>
            <span style={{ textAlign: 'center' }}>Actions</span>
          </div>

          {isLoading ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{
                width: 28, height: 28, border: '3px solid #e2e8f030',
                borderTopColor: tierConfig.color, borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
              }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Loading files…</span>
            </div>
          ) : !tierData?.files.length ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>No files in this knowledge base</div>
            </div>
          ) : (
            tierData.files.map((file, i) => (
              <div
                key={file.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 180px 80px',
                  padding: '14px 24px', alignItems: 'center',
                  borderBottom: i < tierData.files.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                  background: deleting === file.id ? '#fef2f2' : 'transparent',
                }}
                onMouseEnter={e => { if (deleting !== file.id) e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={e => { if (deleting !== file.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {file.filename.endsWith('.json') ? '📋' :
                     file.filename.endsWith('.md') ? '📝' :
                     file.filename.endsWith('.pdf') ? '📕' :
                     file.filename.endsWith('.csv') ? '📊' : '📄'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: '#0f172a',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {file.filename}
                    </div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: 'monospace' }}>
                      {file.id}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: '#64748b' }}>{formatBytes(file.bytes)}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(file.created_at)}</span>
                <div style={{ textAlign: 'center' }}>
                  {deleting === file.id ? (
                    <div style={{
                      width: 16, height: 16, border: '2px solid #fecaca',
                      borderTopColor: '#dc2626', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite', margin: '0 auto',
                    }} />
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(file.id, file.filename); }}
                      title={`Remove ${file.filename}`}
                      style={{
                        background: 'none', border: '1px solid transparent', borderRadius: 6,
                        padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#94a3b8',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#dc2626';
                        e.currentTarget.style.borderColor = '#fecaca';
                        e.currentTarget.style.background = '#fef2f2';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = '#94a3b8';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Footer */}
          {tierData && (
            <div style={{
              padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                {tierData.files.length} file{tierData.files.length !== 1 ? 's' : ''} • {formatBytes(tierData.vector_store.usage_bytes)} total
              </span>
              <button
                onClick={() => fetchTier(activeTier)}
                style={{
                  background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
                  padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#64748b',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#94a3b8'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                ↻ Refresh
              </button>
            </div>
          )}
        </div>

        {/* ─── Store Info ─── */}
        {tierData && (
          <div style={{
            marginTop: 20, padding: '16px 24px', background: 'rgba(255,255,255,0.6)',
            borderRadius: 10, fontSize: 12, color: '#94a3b8',
            display: 'flex', gap: 24, flexWrap: 'wrap',
          }}>
            <span>Vector Store: <code style={{ color: '#64748b', fontSize: 11 }}>{tierData.vector_store.id}</code></span>
            <span>Name: <strong style={{ color: '#64748b' }}>{tierData.vector_store.name}</strong></span>
            <span>Status: <strong style={{ color: tierData.vector_store.status === 'completed' ? '#16a34a' : '#f59e0b' }}>
              {tierData.vector_store.status}
            </strong></span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
