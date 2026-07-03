import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://toolnestfm.com';

const bearerSecurity = [{ bearerAuth: [] as string[] }];

const envelope = (dataSchema: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: dataSchema,
    error: { type: 'string', nullable: true },
    meta: {
      type: 'object',
      properties: { requestId: { type: 'string' }, timestamp: { type: 'string' } },
    },
  },
});

const credits = {
  type: 'object',
  properties: { spent: { type: 'integer' }, remaining: { type: 'integer' } },
};

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'ToolNest API',
    version: '1.0.0',
    description:
      'AI and utility endpoints. Authenticate with `Authorization: Bearer tn_live_...` — create keys at ' +
      `${BASE}/dashboard/api-keys. AI endpoints cost 1 credit per call (auto-refunded on failure); utility endpoints are free.`,
  },
  servers: [{ url: `${BASE}/api/v1` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'tn_live_...' },
    },
  },
  paths: {
    '/chat': {
      post: {
        summary: 'AI chat completion (1 credit)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['messages'],
                properties: {
                  messages: {
                    type: 'array',
                    maxItems: 50,
                    items: {
                      type: 'object',
                      required: ['role', 'content'],
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' },
                      },
                    },
                  },
                  system: { type: 'string', maxLength: 4000 },
                  model: { type: 'string', example: 'gemini-2.0-flash' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Reply',
            content: {
              'application/json': {
                schema: envelope({
                  type: 'object',
                  properties: { reply: { type: 'string' }, credits },
                }),
              },
            },
          },
          '401': { description: 'Invalid or revoked API key' },
          '402': { description: 'Insufficient credits' },
          '429': { description: 'Rate limited — respect Retry-After header' },
        },
      },
    },
    '/summarize': {
      post: {
        summary: 'Summarize text (1 credit)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', maxLength: 100000 },
                  length: { type: 'string', enum: ['short', 'medium', 'long'], default: 'medium' },
                  language: { type: 'string', example: 'English' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Summary',
            content: {
              'application/json': {
                schema: envelope({ type: 'object', properties: { summary: { type: 'string' }, credits } }),
              },
            },
          },
        },
      },
    },
    '/translate': {
      post: {
        summary: 'Translate text (1 credit)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text', 'to'],
                properties: {
                  text: { type: 'string', maxLength: 100000 },
                  to: { type: 'string', example: 'Hindi' },
                  from: { type: 'string', example: 'English' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Translation',
            content: {
              'application/json': {
                schema: envelope({
                  type: 'object',
                  properties: { translation: { type: 'string' }, to: { type: 'string' }, credits },
                }),
              },
            },
          },
        },
      },
    },
    '/write': {
      post: {
        summary: 'Generate content from a brief (1 credit)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['brief'],
                properties: {
                  brief: { type: 'string', maxLength: 20000 },
                  tone: { type: 'string', default: 'professional' },
                  format: { type: 'string', default: 'article', example: 'blog post' },
                  words: { type: 'integer', minimum: 50, maximum: 3000, default: 300 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Content',
            content: {
              'application/json': {
                schema: envelope({ type: 'object', properties: { content: { type: 'string' }, credits } }),
              },
            },
          },
        },
      },
    },
    '/qr': {
      post: {
        summary: 'Generate a QR code (free)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string' },
                  size: { type: 'integer', minimum: 64, maximum: 2048, default: 512 },
                  format: { type: 'string', enum: ['png', 'svg'], default: 'png' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'QR image',
            content: {
              'application/json': {
                schema: envelope({ type: 'object', properties: { dataUrl: { type: 'string' } } }),
              },
            },
          },
        },
      },
    },
    '/hash': {
      post: {
        summary: 'Hash text (free)',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', maxLength: 1000000 },
                  algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512'], default: 'sha256' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Hash',
            content: {
              'application/json': {
                schema: envelope({
                  type: 'object',
                  properties: { algorithm: { type: 'string' }, hash: { type: 'string' } },
                }),
              },
            },
          },
        },
      },
    },
    '/uuid': {
      get: {
        summary: 'Generate UUID v4s (free)',
        security: bearerSecurity,
        parameters: [
          { name: 'count', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 1 } },
        ],
        responses: {
          '200': {
            description: 'UUIDs',
            content: {
              'application/json': {
                schema: envelope({
                  type: 'object',
                  properties: { uuids: { type: 'array', items: { type: 'string' } } },
                }),
              },
            },
          },
        },
      },
    },
    '/tools': {
      get: {
        summary: 'Full tool catalog (free, no key required)',
        parameters: [{ name: 'category', in: 'query', schema: { type: 'string', example: 'pdf' } }],
        responses: { '200': { description: 'Tool list' } },
      },
    },
    '/me': {
      get: {
        summary: 'Key info, credit balance and price list (free)',
        security: bearerSecurity,
        responses: { '200': { description: 'Account info' } },
      },
    },
    '/usage': {
      get: {
        summary: 'Last 100 API calls with credit amounts (free)',
        security: bearerSecurity,
        responses: { '200': { description: 'Usage ledger' } },
      },
    },
  },
} as const;

/** GET /api/v1/openapi.json — machine-readable OpenAPI 3.0 spec for the public API. */
export async function GET() {
  return NextResponse.json(spec, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
