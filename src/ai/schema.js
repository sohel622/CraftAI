// The exact JSON shape Gemini must return. Sent to Gemini as `responseSchema`
// (structured output) AND re-checked locally with zod, so bad AI output never
// reaches the project files.
import { z } from 'zod';

// OpenAPI-style schema for Gemini structured output
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    plan: { type: 'STRING', description: 'Short step-by-step plan (max ~5 lines)' },
    explanation: { type: 'STRING', description: 'Concise explanation of what changed and why' },
    operations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', enum: ['create', 'update', 'delete'] },
          path: { type: 'STRING', description: 'Relative file path, e.g. src/App.jsx' },
          content: { type: 'STRING', description: 'FULL new file content (empty for delete)' },
          reason: { type: 'STRING' },
        },
        required: ['action', 'path'],
      },
    },
  },
  required: ['explanation', 'operations'],
};

// Local validation (zod)
export const operationSchema = z.object({
  action: z.enum(['create', 'update', 'delete']),
  path: z.string().min(1).max(300),
  content: z.string().optional().default(''),
  reason: z.string().optional().default(''),
});

export const aiResultSchema = z.object({
  plan: z.string().optional().default(''),
  explanation: z.string().default(''),
  operations: z.array(operationSchema).max(200),
});
