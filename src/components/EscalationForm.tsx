'use client';

import { useState } from 'react';

interface EscalationFormProps {
  conversationId: string;
  issueSummary?: string;
  onSubmit: () => void;
}

export default function EscalationForm({
  conversationId,
  issueSummary,
  onSubmit,
}: EscalationFormProps) {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [summary, setSummary] = useState(issueSummary || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          propertyName: propertyName.trim() || undefined,
          issueSummary: summary.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit escalation');
      }

      setSubmitted(true);
      onSubmit();
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '10px 14px',
    fontSize: 13,
    border: focusedField === field ? '1.5px solid #B0122C' : '1px solid rgba(15,23,42,0.08)',
    borderRadius: 10,
    outline: 'none',
    color: '#0f172a',
    background: '#ffffff',
    transition: 'all 0.15s ease',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(176,18,44,0.08)' : 'none',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: 6,
  };

  if (submitted) {
    return (
      <div
        style={{
          borderRadius: 14,
          border: '1px solid #a7f3d0',
          background: '#ecfdf5',
          padding: 20,
          marginBottom: 14,
          animation: 'slideInUp 0.3s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#065f46' }}>
              Escalation Submitted
            </div>
            <div style={{ fontSize: 13, color: '#15803d', marginTop: 2 }}>
              Our support team will contact you shortly.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid rgba(176,18,44,0.15)',
        background: 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)',
        padding: 24,
        marginBottom: 14,
        animation: 'escalationSlideIn 0.3s ease',
        boxShadow: '0 4px 16px rgba(176,18,44,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #B0122C 0%, #D4365C 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="#ffffff" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
            Connect with Our Team
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Provide your details so we can follow up directly
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            Name <span style={{ color: '#B0122C' }}>*</span>
          </label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            style={inputStyle('name')}
            placeholder="Your full name"
            required
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              style={inputStyle('email')}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              style={inputStyle('phone')}
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Property / Building Name</label>
          <input
            type="text"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            onFocus={() => setFocusedField('property')}
            onBlur={() => setFocusedField(null)}
            style={inputStyle('property')}
            placeholder="e.g. Main Office Building"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Issue Summary</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onFocus={() => setFocusedField('summary')}
            onBlur={() => setFocusedField(null)}
            rows={2}
            style={{
              ...inputStyle('summary'),
              resize: 'none' as const,
            }}
            placeholder="Brief description of the issue"
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 13,
              color: '#ef4444',
              margin: '0 0 10px 0',
              padding: '8px 12px',
              background: 'rgba(239,68,68,0.06)',
              borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.15)',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '11px 16px',
            fontSize: 14,
            fontWeight: 600,
            color: '#ffffff',
            background: submitting ? '#B0122C' : '#B0122C',
            border: 'none',
            borderRadius: 10,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            transition: 'all 0.2s ease',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            boxShadow: '0 2px 8px rgba(176,18,44,0.2)',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Escalation Request'}
        </button>
      </form>
    </div>
  );
}
