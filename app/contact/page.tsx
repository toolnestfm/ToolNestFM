'use client';

import { useState } from 'react';
import PageShell from '@/components/content/PageShell';
import { useUI } from '@/components/GlobalUI';

export default function ContactPage() {
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast('Please fill in all fields', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const json = (await res.json()) as { success: boolean; error?: string | null };
      if (!json.success) throw new Error(json.error || 'Failed to send message');
      toast('Message sent! We\'ll get back to you within 24 hours.', 'success');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <PageShell title="Contact Us" subtitle="We'd love to hear from you">
      <p>Email us directly at <a href="mailto:hello@toolnestfm.com">hello@toolnestfm.com</a> or use the form below.</p>
      <form onSubmit={submit} className="contact-form mt-6">
        <div className="field mb-4">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="field mb-4">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="field mb-4">
          <label htmlFor="message">Message</label>
          <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" rows={5} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send Message'}</button>
      </form>
    </PageShell>
  );
}
