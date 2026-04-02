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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    outline: 'none',
    color: '#0f172a',
    background: '#ffffff',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: '#0f172a',
    marginBottom: 4,
  };

  if (submitted) {
    return (
      <div
        style={{
          margin: '0 14px 14px 14px',
          borderRadius: 12,
          border: '1px solid #bbf7d0',
          background: '#f0fdf4',
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="#16a34a"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#166534' }}>
            Escalation Submitted
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#15803d', margin: 0 }}>
          Our support team will contact you shortly. Thank you for your patience.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: '0 14px 14px 14px',
        borderRadius: 12,
        border: '1px solid #fecaca',
        background: '#fee2e2',
        padding: 16,
      }}
    >
      <h3
        style={{
          margin: '0 0 4px 0',
          fontWeight: 600,
          fontSize: 14,
          color: '#991b1b',
        }}
      >
        Connect with Our Support Team
      </h3>
      <p
        style={{
          margin: '0 0 14px 0',
          fontSize: 13,
          color: '#64748b',
        }}
      >
        Please provide your contact details so our team can follow up.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>
            Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            style={inputStyle}
            placeholder="Your full name"
            required
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              style={inputStyle}
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Property / Building Name</label>
          <input
            type="text"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            style={inputStyle}
            placeholder="e.g. Main Office Building"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Issue Summary</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            style={{
              ...inputStyle,
              resize: 'none' as const,
            }}
            placeholder="Brief description of the issue"
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#ef4444', margin: '0 0 8px 0' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: '#ffffff',
            background: '#991b1b',
            border: 'none',
            borderRadius: 10,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Escalation'}
        </button>
      </form>
    </div>
  );
}
