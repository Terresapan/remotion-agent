'use client';

import {FormEvent, useEffect, useState} from 'react';
import type {JobRecord} from '@remotionagent/shared';

type StepId = 'audio:manifest' | 'audio:validate' | 'typecheck' | 'validate:template' | 'build';

const STEP_OPTIONS: StepId[] = [
  'audio:manifest',
  'audio:validate',
  'typecheck',
  'validate:template',
  'build',
];

type CreateJobResponse = JobRecord & {
  hostWorkspacePath?: string;
  sandboxName?: string;
};

type RunStepSuccess = {
  job: JobRecord;
  stepId: StepId;
  command: string;
  result: {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
};

type JobRunLog = {
  at: string;
  stepId: StepId;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export default function Home() {
  const [topic, setTopic] = useState('How AI agents build videos');
  const [sourceUrl, setSourceUrl] = useState('');
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [stepByJob, setStepByJob] = useState<Record<string, StepId>>({});
  const [logsByJob, setLogsByJob] = useState<Record<string, JobRunLog[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');

  const loadJobs = async () => {
    const response = await fetch('/api/jobs', {cache: 'no-store'});
    const data = (await response.json()) as {jobs: JobRecord[]};
    setJobs(data.jobs ?? []);
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const onCreateJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const payload: Record<string, unknown> = {topic};
      if (sourceUrl.trim()) payload.sourceUrl = sourceUrl.trim();

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CreateJobResponse | {error: string; details?: string};
      if (!response.ok || 'error' in data) {
        const details = 'details' in data && data.details ? `: ${data.details}` : '';
        throw new Error(`${'error' in data ? data.error : 'Request failed'}${details}`);
      }

      setMessage(`Created job ${data.jobId}`);
      setSourceUrl('');
      await loadJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create job');
    } finally {
      setBusy(false);
    }
  };

  const onRunStep = async (jobId: string) => {
    const stepId = stepByJob[jobId] ?? 'typecheck';
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/jobs/${jobId}/run-step`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({stepId}),
      });
      const data = (await response.json()) as RunStepSuccess | {error: string; details?: string};

      if (!response.ok || 'error' in data) {
        const details = 'details' in data && data.details ? `: ${data.details}` : '';
        throw new Error(`${'error' in data ? data.error : 'Request failed'}${details}`);
      }

      setMessage(`Ran ${data.stepId} for ${jobId} (exit ${data.result.exitCode})`);
      const newLog: JobRunLog = {
        at: new Date().toISOString(),
        stepId: data.stepId,
        command: data.command,
        exitCode: data.result.exitCode,
        stdout: data.result.stdout,
        stderr: data.result.stderr,
      };
      setLogsByJob((prev) => ({
        ...prev,
        [jobId]: [newLog, ...(prev[jobId] ?? [])].slice(0, 10),
      }));
      await loadJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to run step');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{padding: 32, fontFamily: 'sans-serif', maxWidth: 960, margin: '0 auto'}}>
      <h1 style={{marginBottom: 8}}>Remotion Agent</h1>
      <p style={{marginTop: 0, color: '#555'}}>
        Create jobs and run sandboxed worker steps from this control plane.
      </p>

      <section
        style={{
          display: 'grid',
          gap: 12,
          padding: 16,
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 12,
          marginTop: 24,
        }}
      >
        <h2 style={{margin: 0}}>Create Job</h2>
        <form onSubmit={onCreateJob} style={{display: 'grid', gap: 12}}>
          <label style={{display: 'grid', gap: 4}}>
            <span>Topic</span>
            <input
              name="topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              style={{padding: 10, borderRadius: 8, border: '1px solid #ccc'}}
            />
          </label>
          <label style={{display: 'grid', gap: 4}}>
            <span>Source URL</span>
            <input
              name="sourceUrl"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.com"
              style={{padding: 10, borderRadius: 8, border: '1px solid #ccc'}}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            style={{
              width: 'fit-content',
              padding: '10px 14px',
              borderRadius: 8,
              border: 0,
              background: '#111',
              color: '#fff',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Working…' : 'Create job'}
          </button>
        </form>
      </section>

      <section
        style={{
          display: 'grid',
          gap: 12,
          padding: 16,
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 12,
          marginTop: 24,
        }}
      >
        <h2 style={{margin: 0}}>Jobs</h2>
        {message ? <p style={{margin: 0, color: '#333'}}>{message}</p> : null}
        <button
          type="button"
          onClick={() => void loadJobs()}
          style={{
            width: 'fit-content',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #ccc',
            background: '#f8f8f8',
          }}
        >
          Refresh
        </button>
        {jobs.length === 0 ? (
          <p style={{margin: 0, color: '#666'}}>No jobs yet.</p>
        ) : (
          <div style={{display: 'grid', gap: 10}}>
            {jobs.map((job) => (
              <article
                key={job.jobId}
                style={{
                  border: '1px solid #e2e2e2',
                  borderRadius: 10,
                  padding: 12,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{display: 'grid', gap: 2}}>
                  <strong>{job.topic}</strong>
                  <span style={{fontSize: 13, color: '#555'}}>jobId: {job.jobId}</span>
                  <span style={{fontSize: 13, color: '#555'}}>workspaceId: {job.workspaceId}</span>
                  <span style={{fontSize: 13, color: '#555'}}>
                    status: {job.status} | stage: {job.stage}
                  </span>
                </div>
                <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
                  <select
                    value={stepByJob[job.jobId] ?? 'typecheck'}
                    onChange={(event) =>
                      setStepByJob((prev) => ({
                        ...prev,
                        [job.jobId]: event.target.value as StepId,
                      }))
                    }
                    style={{padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc'}}
                  >
                    {STEP_OPTIONS.map((step) => (
                      <option key={step} value={step}>
                        {step}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void onRunStep(job.jobId)}
                    disabled={busy}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 0,
                      background: '#111',
                      color: '#fff',
                      opacity: busy ? 0.7 : 1,
                    }}
                  >
                    Run step
                  </button>
                </div>
                <div
                  style={{
                    border: '1px solid #ececec',
                    borderRadius: 8,
                    padding: 10,
                    background: '#fafafa',
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <strong style={{fontSize: 13}}>Step Logs</strong>
                  {(logsByJob[job.jobId] ?? []).length === 0 ? (
                    <p style={{margin: 0, fontSize: 13, color: '#666'}}>No logs yet.</p>
                  ) : (
                    <div style={{display: 'grid', gap: 8}}>
                      {(logsByJob[job.jobId] ?? []).map((log, index) => (
                        <div
                          key={`${log.at}-${index}`}
                          style={{
                            border: '1px solid #e4e4e4',
                            borderRadius: 6,
                            padding: 8,
                            display: 'grid',
                            gap: 6,
                            background: '#fff',
                          }}
                        >
                          <span style={{fontSize: 12, color: '#555'}}>
                            {log.at} | {log.stepId} | exit {log.exitCode}
                          </span>
                          <code
                            style={{
                              fontSize: 12,
                              background: '#f3f3f3',
                              borderRadius: 4,
                              padding: '4px 6px',
                              overflowX: 'auto',
                            }}
                          >
                            {log.command}
                          </code>
                          {log.stdout ? (
                            <pre
                              style={{
                                margin: 0,
                                padding: 8,
                                borderRadius: 6,
                                background: '#f7fbf7',
                                border: '1px solid #d7e9d7',
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {log.stdout}
                            </pre>
                          ) : null}
                          {log.stderr ? (
                            <pre
                              style={{
                                margin: 0,
                                padding: 8,
                                borderRadius: 6,
                                background: '#fff7f7',
                                border: '1px solid #efd7d7',
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {log.stderr}
                            </pre>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
