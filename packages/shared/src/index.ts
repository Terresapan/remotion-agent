import {z} from 'zod';

export const createJobSchema = z.object({
  topic: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceText: z.string().min(1).optional(),
  targetLength: z.number().int().positive().optional()
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const jobStatusSchema = z.enum([
  'queued',
  'provisioning',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobPhaseSchema = z.enum([
  'research',
  'brief',
  'art_direction',
  'storyboard',
  'scene_implementation',
  'validation',
  'build',
]);
export type JobPhase = z.infer<typeof jobPhaseSchema>;

export const jobRecordSchema = z.object({
  jobId: z.string().min(1),
  topic: z.string().min(1),
  status: jobStatusSchema,
  workspaceId: z.string().min(1),
  stage: z.string().min(1),
  currentPhase: jobPhaseSchema.nullable().optional(),
});

export type JobRecord = z.infer<typeof jobRecordSchema>;

export const phaseDocumentSchema = z.object({
  phase: jobPhaseSchema,
  filename: z.string(), // e.g. 'research.md', 'brief.md'
  content: z.string(),  // full text content
  createdAt: z.string(), // ISO timestamp
});
export type PhaseDocument = z.infer<typeof phaseDocumentSchema>;

export const chatRoleSchema = z.enum(['user', 'agent']);
export const chatMessageSchema = z.object({
  messageId: z.string(),
  jobId: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  createdAt: z.string(), // ISO timestamp
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const approvePhaseSchema = z.object({
  decision: z.enum(['approve', 'revise']),
  note: z.string().optional(), // user's revision instructions if decision === 'revise'
});
export type ApprovePhaseInput = z.infer<typeof approvePhaseSchema>;

export const runJobStepSchema = z.object({
  stepId: z.enum([
    'audio:manifest',
    'audio:validate',
    'typecheck',
    'validate:template',
    'build',
  ]),
  timeoutMs: z.number().int().positive().max(60 * 60_000).optional(),
});

export type RunJobStepInput = z.infer<typeof runJobStepSchema>;

export const uploadJobAssetSchema = z.object({
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  mimeType: z.string().min(1).max(255).optional(),
});

export type UploadJobAssetInput = z.infer<typeof uploadJobAssetSchema>;
