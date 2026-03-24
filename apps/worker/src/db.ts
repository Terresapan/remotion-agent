import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {
  ChatMessage,
  JobPhase,
  JobRecord,
  PhaseDocument,
} from '@remotionagent/shared';

// ---------------------------------------------------------------------------
// Database initialisation
// ---------------------------------------------------------------------------

function resolveDbPath(): string {
  if (process.env.WORKER_DB_PATH) {
    return process.env.WORKER_DB_PATH;
  }
  // apps/worker/src/db.ts → go up 3 levels to repo root
  const fileUrl = import.meta.url;
  const filePath = new URL(fileUrl).pathname;
  const repoRoot = path.resolve(path.dirname(filePath), '..', '..', '..');
  return path.join(repoRoot, 'worker.db');
}

const db = new DatabaseSync(resolveDbPath());

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    job_id        TEXT PRIMARY KEY,
    topic         TEXT NOT NULL,
    status        TEXT NOT NULL,
    workspace_id  TEXT NOT NULL,
    stage         TEXT NOT NULL,
    current_phase TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    message_id TEXT PRIMARY KEY,
    job_id     TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS phase_documents (
    id         TEXT PRIMARY KEY,
    job_id     TEXT NOT NULL,
    phase      TEXT NOT NULL,
    filename   TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

interface JobRow {
  job_id: string;
  topic: string;
  status: string;
  workspace_id: string;
  stage: string;
  current_phase: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJobRecord(row: JobRow): JobRecord {
  return {
    jobId: row.job_id,
    topic: row.topic,
    status: row.status as JobRecord['status'],
    workspaceId: row.workspace_id,
    stage: row.stage,
    currentPhase: (row.current_phase ?? null) as JobRecord['currentPhase'],
  };
}

export function dbInsertJob(job: JobRecord): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO jobs (job_id, topic, status, workspace_id, stage, current_phase, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(job.jobId, job.topic, job.status, job.workspaceId, job.stage, job.currentPhase ?? null, now, now);
}

export function dbUpdateJob(
  jobId: string,
  fields: Partial<Pick<JobRecord, 'status' | 'stage' | 'currentPhase'>>
): void {
  const now = new Date().toISOString();
  const setClauses: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (fields.status !== undefined) {
    setClauses.push('status = ?');
    values.push(fields.status);
  }
  if (fields.stage !== undefined) {
    setClauses.push('stage = ?');
    values.push(fields.stage);
  }
  if ('currentPhase' in fields) {
    setClauses.push('current_phase = ?');
    values.push(fields.currentPhase ?? null);
  }

  values.push(jobId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.prepare(`UPDATE jobs SET ${setClauses.join(', ')} WHERE job_id = ?`).run(...(values as any[]));
}

export function dbGetJob(jobId: string): JobRecord | null {
  const row = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId) as unknown as JobRow | undefined;
  return row ? rowToJobRecord(row) : null;
}

export function dbListJobs(): JobRecord[] {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at ASC').all() as unknown as JobRow[];
  return rows.map(rowToJobRecord);
}

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

interface ChatMessageRow {
  message_id: string;
  job_id: string;
  role: string;
  content: string;
  created_at: string;
}

function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    messageId: row.message_id,
    jobId: row.job_id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    createdAt: row.created_at,
  };
}

export function dbInsertChatMessage(msg: ChatMessage): void {
  db.prepare(`
    INSERT INTO chat_messages (message_id, job_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(msg.messageId, msg.jobId, msg.role, msg.content, msg.createdAt);
}

export function dbGetChatMessages(jobId: string): ChatMessage[] {
  const rows = db
    .prepare('SELECT * FROM chat_messages WHERE job_id = ? ORDER BY created_at ASC')
    .all(jobId) as unknown as ChatMessageRow[];
  return rows.map(rowToChatMessage);
}

// ---------------------------------------------------------------------------
// Phase documents
// ---------------------------------------------------------------------------

interface PhaseDocumentRow {
  id: string;
  job_id: string;
  phase: string;
  filename: string;
  content: string;
  created_at: string;
}

function rowToPhaseDocument(row: PhaseDocumentRow): PhaseDocument {
  return {
    phase: row.phase as PhaseDocument['phase'],
    filename: row.filename,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function dbInsertPhaseDocument(jobId: string, doc: PhaseDocument): void {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO phase_documents (id, job_id, phase, filename, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, jobId, doc.phase, doc.filename, doc.content, doc.createdAt);
}

export function dbGetPhaseDocuments(jobId: string): PhaseDocument[] {
  const rows = db
    .prepare('SELECT * FROM phase_documents WHERE job_id = ? ORDER BY created_at ASC')
    .all(jobId) as unknown as PhaseDocumentRow[];
  return rows.map(rowToPhaseDocument);
}

export function dbGetLatestPhaseDocument(jobId: string, phase: JobPhase): PhaseDocument | null {
  const row = db
    .prepare(
      'SELECT * FROM phase_documents WHERE job_id = ? AND phase = ? ORDER BY created_at DESC LIMIT 1'
    )
    .get(jobId, phase) as unknown as PhaseDocumentRow | undefined;
  return row ? rowToPhaseDocument(row) : null;
}
