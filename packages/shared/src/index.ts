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

export const jobRecordSchema = z.object({
  jobId: z.string().min(1),
  topic: z.string().min(1),
  status: jobStatusSchema,
  workspaceId: z.string().min(1),
  stage: z.string().min(1),
});

export type JobRecord = z.infer<typeof jobRecordSchema>;

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
