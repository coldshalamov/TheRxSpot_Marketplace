/**
 * SSE Transport Layer for MCP Server
 * 
 * Implements Server-Sent Events transport for MCP (Model Context Protocol)
 * communication over HTTP.
 */

import { Express, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Session interface representing a connected MCP client
 */
export interface Session {
  id: string;
  res: Response;
  createdAt: Date;
}

/**
 * JSON-RPC request type
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC response type
 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Type for MCP message handler
 */
export type MCPMessageHandler = (request: JSONRPCRequest) => Promise<JSONRPCResponse> | JSONRPCResponse;

// Store sessions in a Map for efficient lookup
const sessions = new Map<string, Session>();

/**
 * Get a session by ID
 * @param sessionId - The session ID to look up
 * @returns The session if found, undefined otherwise
 */
export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

/**
 * Send an SSE event to a specific response
 * @param res - Express response object
 * @param event - Event name
 * @param data - Event data (will be JSON serialized)
 */
function sendSSEEvent(res: Response, event: string, data: unknown): void {
  const formattedData = typeof data === 'string' ? data : JSON.stringify(data);
  res.write(`event: ${event}\n`);
  res.write(`data: ${formattedData}\n\n`);
}

/**
 * Send a message to a specific session
 * @param sessionId - The target session ID
 * @param message - The message to send
 * @returns true if sent successfully, false if session not found
 */
export function sendToSession(sessionId: string, message: unknown): boolean {
  const session = sessions.get(sessionId);
  if (!session) {
    return false;
  }

  try {
    sendSSEEvent(session.res, 'message', message);
    return true;
  } catch (error) {
    console.error(`Failed to send message to session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Broadcast a message to all connected clients
 * @param message - The message to broadcast
 * @returns Number of clients the message was sent to
 */
export function broadcastToAll(message: unknown): number {
  let sentCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    try {
      sendSSEEvent(session.res, 'message', message);
      sentCount++;
    } catch (error) {
      console.error(`Failed to broadcast to session ${sessionId}:`, error);
      // Remove dead sessions
      sessions.delete(sessionId);
    }
  }

  return sentCount;
}

/**
 * Close all sessions and clean up
 * @returns Number of sessions closed
 */
export function closeAllSessions(): number {
  const count = sessions.size;

  for (const [sessionId, session] of sessions.entries()) {
    try {
      session.res.end();
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }

  sessions.clear();
  return count;
}

/**
 * Generate a unique session ID
 * @returns A unique session ID string
 */
function generateSessionId(): string {
  return randomUUID();
}

/**
 * Validate session ID format
 * @param sessionId - The session ID to validate
 * @returns true if valid, false otherwise
 */
function isValidSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && sessionId.length > 0;
}

/**
 * CORS middleware configuration
 */
function setupCORS(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Create SSE transport for MCP server
 * @param app - Express application instance
 * @param messageHandler - Handler for MCP JSON-RPC messages
 * @returns Object with helper methods for session management
 */
export function createSSETransport(
  app: Express,
  messageHandler?: MCPMessageHandler
): {
  getSession: (sessionId: string) => Session | undefined;
  sendToSession: (sessionId: string, message: unknown) => boolean;
  broadcastToAll: (message: unknown) => number;
  closeAllSessions: () => number;
  getSessionsCount: () => number;
} {
  // GET /sse - Establish SSE connection
  app.get('/sse', (req: Request, res: Response) => {
    // Setup CORS headers
    setupCORS(res);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Generate unique session ID
    const sessionId = generateSessionId();

    // Create and store session
    const session: Session = {
      id: sessionId,
      res,
      createdAt: new Date(),
    };
    sessions.set(sessionId, session);

    console.log(`[SSE] Client connected: ${sessionId} (total: ${sessions.size})`);

    // Send initial endpoint event with message URL
    sendSSEEvent(res, 'endpoint', `/messages?sessionId=${sessionId}`);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`[SSE] Client disconnected: ${sessionId}`);
      sessions.delete(sessionId);
    });

    // Handle errors
    req.on('error', (error) => {
      console.error(`[SSE] Error for session ${sessionId}:`, error);
      sessions.delete(sessionId);
    });

    res.on('error', (error) => {
      console.error(`[SSE] Response error for session ${sessionId}:`, error);
      sessions.delete(sessionId);
    });

    // Keep connection alive with periodic ping (optional)
    const pingInterval = setInterval(() => {
      if (!sessions.has(sessionId)) {
        clearInterval(pingInterval);
        return;
      }
      try {
        res.write(': ping\n\n'); // Comment line as SSE ping
      } catch {
        clearInterval(pingInterval);
        sessions.delete(sessionId);
      }
    }, 30000); // 30 second ping

    // Clean up interval on close
    req.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  // POST /messages - Receive JSON-RPC messages from client
  app.post('/messages', async (req: Request, res: Response) => {
    // Setup CORS headers
    setupCORS(res);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Get session ID from query parameter
    const sessionId = req.query.sessionId as string;

    // Validate session ID
    if (!sessionId || !isValidSessionId(sessionId)) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid Request: missing or invalid sessionId',
        },
      });
      return;
    }

    // Check if session exists
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'Session not found',
        },
      });
      return;
    }

    // Parse JSON-RPC request body
    let rpcRequest: JSONRPCRequest;
    try {
      if (typeof req.body === 'string') {
        rpcRequest = JSON.parse(req.body);
      } else if (typeof req.body === 'object' && req.body !== null) {
        rpcRequest = req.body as JSONRPCRequest;
      } else {
        throw new Error('Invalid request body');
      }
    } catch (error) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: Invalid JSON',
        },
      });
      return;
    }

    // Validate JSON-RPC structure
    if (rpcRequest.jsonrpc !== '2.0' || !rpcRequest.method) {
      res.status(400).json({
        jsonrpc: '2.0',
        id: rpcRequest.id ?? null,
        error: {
          code: -32600,
          message: 'Invalid Request: not valid JSON-RPC 2.0',
        },
      });
      return;
    }

    // Process message if handler is provided
    if (messageHandler) {
      try {
        const rpcResponse = await messageHandler(rpcRequest);
        res.json(rpcResponse);
      } catch (error) {
        console.error(`[SSE] Error handling message for session ${sessionId}:`, error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: rpcRequest.id ?? null,
          error: {
            code: -32603,
            message: 'Internal error: ' + (error instanceof Error ? error.message : 'Unknown error'),
          },
        });
      }
    } else {
      // No handler configured - acknowledge receipt
      res.json({
        jsonrpc: '2.0',
        id: rpcRequest.id ?? null,
        result: null,
      });
    }
  });

  // Return helper functions
  return {
    getSession,
    sendToSession,
    broadcastToAll,
    closeAllSessions,
    getSessionsCount: () => sessions.size,
  };
}

// Export sessions map for testing/advanced use cases
export { sessions };
