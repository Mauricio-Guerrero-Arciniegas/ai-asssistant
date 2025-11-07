'use client';

import { useState } from 'react';
import styles from './styles/Home.module.scss';

interface ApiResponse {
  answer?: string;
  error?: string;
  summary?: string;
  text?: string;
  filename?: string | null;
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // upload
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [uploadedText, setUploadedText] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data: ApiResponse = await res.json();
      if (data.error) throw new Error(data.error);
      setAnswer(data.answer || 'No answer received.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);
    setUploadedText(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: form,
      });

      const data: ApiResponse = await res.json();
      if (data.error) throw new Error(data.error);
      setSummary(data.summary || null);
      setUploadedText(data.text || null);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('Upload failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>AI Knowledge Assistant</h1>

      <section className={styles.card}>
        <h2>Upload document</h2>
        <form onSubmit={handleUpload} className={styles.form}>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Processing...' : 'Upload & Summarize'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        {summary && (
          <div className={styles.answer}>
            <h3>Summary ({file?.name}):</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{summary}</p>
          </div>
        )}
      </section>

      <hr style={{ margin: '2rem 0' }} />

      <section className={styles.card}>
        <h2>Ask a question</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            className={styles.textarea}
            placeholder="Ask me anything..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
          />
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>

        {answer && (
          <div className={styles.answer}>
            <h3>Answer:</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{answer}</p>
          </div>
        )}
      </section>
    </main>
  );
}