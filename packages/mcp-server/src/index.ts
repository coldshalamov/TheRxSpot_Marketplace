/**
 * Denigma MCP Server
 * 
 * A Model Context Protocol server implementation for Denigma,
 * providing AI assistants with access to Denigma's knowledge base.
 */

import express, { Request, Response } from 'express';
import { createSSETransport, JSONRPCRequest, JSONRPCResponse } from './transport';

// Configuration from environment variables
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || './data';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

// Logger utility
const logger = {
  debug: (...args: unknown[]) => LOG_LEVEL === 'debug' && console.log('[DEBUG]', ...args),
  info: (...args: unknown[]) => ['debug', 'info'].includes(LOG_LEVEL) && console.log('[INFO]', ...args),
  warn: (...args: unknown[]) => ['debug', 'info', 'warn'].includes(LOG_LEVEL) && console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
};

// MCP Tool definitions
const tools = [
  {
    name: 'denigma_search',
    description: 'Search for concepts, entities, and content in the Denigma knowledge base',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
        },
        filters: {
          type: 'object',
          description: 'Optional filters for search results',
          properties: {
            type: {
              type: 'array',
              items: { enum: ['concept', 'entity', 'document'] },
            },
            category: { type: 'string' },
          },
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'denigma_get_concept',
    description: 'Retrieve detailed information about a specific concept from the knowledge base',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier of the concept',
        },
        includeRelations: {
          type: 'boolean',
          description: 'Whether to include related concepts',
          default: true,
        },
        includeMetadata: {
          type: 'boolean',
          description: 'Whether to include metadata',
          default: true,
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'denigma_get_relations',
    description: 'Get relationships and connections for a given concept',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Unique identifier of the concept',
        },
        relationTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of relations to include (parent, child, related)',
          default: ['parent', 'child', 'related'],
        },
        depth: {
          type: 'number',
          description: 'How many levels of relations to traverse',
          default: 1,
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'denigma_get_context',
    description: 'Gather surrounding context for a concept or query',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Context query string',
        },
        conceptId: {
          type: 'string',
          description: 'Specific concept ID to get context for',
        },
        radius: {
          type: 'number',
          description: 'Context radius (number of hops)',
          default: 2,
        },
        includeContent: {
          type: 'boolean',
          description: 'Whether to include full content',
          default: true,
        },
      },
    },
  },
  {
    name: 'denigma_suggest',
    description: 'Submit suggestions for knowledge base improvements',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['new_concept', 'edit', 'relationship'],
          description: 'Type of suggestion',
        },
        title: {
          type: 'string',
          description: 'Title of the suggestion',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the suggestion',
        },
        suggestedBy: {
          type: 'string',
          description: 'Name or identifier of the suggester',
        },
      },
      required: ['type', 'title', 'description'],
    },
  },
];

// Tool handlers
const toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  denigma_search: async (args) => {
    logger.info('Executing denigma_search:', args.query);
    // Mock implementation - replace with actual Denigma API call
    return {
      results: [
        {
          id: 'mock-concept-1',
          name: `Result for "${args.query}"`,
          type: 'concept',
          description: 'This is a mock search result. Connect to Denigma API for real data.',
          relevance: 0.95,
        },
      ],
      total: 1,
      query: args.query,
    };
  },

  denigma_get_concept: async (args) => {
    logger.info('Executing denigma_get_concept:', args.id);
    return {
      id: args.id,
      name: 'Mock Concept',
      description: 'This is a mock concept. Connect to Denigma API for real data.',
      type: 'concept',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  denigma_get_relations: async (args) => {
    logger.info('Executing denigma_get_relations:', args.id);
    return {
      conceptId: args.id,
      relations: [],
      totalRelations: 0,
    };
  },

  denigma_get_context: async (args) => {
    logger.info('Executing denigma_get_context:', args.query || args.conceptId);
    return {
      centerConcept: null,
      neighbors: [],
      paths: [],
      content: [],
    };
  },

  denigma_suggest: async (args) => {
    logger.info('Executing denigma_suggest:', args.title);
    return {
      suggestionId: `sugg-${Date.now()}`,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
  },
};

// MCP message handler
async function handleMCPMessage(request: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { method, params, id } = request;

  logger.debug('Received MCP message:', method, params);

  // Handle initialize
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'denigma-mcp-server',
          version: '1.0.0',
        },
      },
    };
  }

  // Handle tools/list
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools,
      },
    };
  }

  // Handle tools/call
  if (method === 'tools/call') {
    const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
    
    const handler = toolHandlers[name];
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Tool not found: ${name}`,
        },
      };
    }

    try {
      const result = await handler(args);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      logger.error('Tool execution error:', error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
    }
  }

  // Method not found
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`,
    },
  };
}

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.text());

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

// Set up SSE transport
const transport = createSSETransport(app, handleMCPMessage);

// Root endpoint with info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Denigma MCP Server',
    version: '1.0.0',
    description: 'Model Context Protocol server for Denigma knowledge base',
    endpoints: {
      health: '/health',
      sse: '/sse',
      messages: '/messages',
    },
    tools: tools.map(t => t.name),
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info('='.repeat(50));
  logger.info('Denigma MCP Server');
  logger.info('='.repeat(50));
  logger.info(`Server running on http://0.0.0.0:${PORT}`);
  logger.info(`Data directory: ${DATA_DIR}`);
  logger.info(`Log level: ${LOG_LEVEL}`);
  logger.info(`Allowed origins: ${ALLOWED_ORIGINS}`);
  logger.info('');
  logger.info('Endpoints:');
  logger.info(`  - Health:  http://localhost:${PORT}/health`);
  logger.info(`  - SSE:     http://localhost:${PORT}/sse`);
  logger.info(`  - Messages: http://localhost:${PORT}/messages`);
  logger.info('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  transport.closeAllSessions();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  transport.closeAllSessions();
  process.exit(0);
});
