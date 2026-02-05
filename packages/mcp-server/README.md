# Denigma MCP Server

A production-ready Model Context Protocol (MCP) server for Denigma, deployed on Render.com. This server enables AI assistants like ChatGPT to interact with Denigma's knowledge base through a standardized protocol.

## Overview

The Denigma MCP Server implements the [Model Context Protocol](https://modelcontextprotocol.io) using Server-Sent Events (SSE) transport. It provides AI assistants with tools to:

- Search and retrieve content from Denigma's knowledge graph
- Navigate hierarchical relationships between concepts
- Access contextual information for better understanding
- Suggest improvements and additions to the knowledge base

## Features

### Core Tools

| Tool | Description |
|------|-------------|
| `denigma_search` | Search for concepts, entities, and content in the knowledge base |
| `denigma_get_concept` | Retrieve detailed information about a specific concept |
| `denigma_get_relations` | Get relationships and connections for a given concept |
| `denigma_get_context` | Gather surrounding context for a concept or query |
| `denigma_suggest` | Submit suggestions for knowledge base improvements |

### Transport

- **SSE (Server-Sent Events)**: Real-time bidirectional communication over HTTP
- **JSON-RPC 2.0**: Standardized message format for tool invocations
- **Session Management**: Unique session IDs for each client connection
- **CORS Support**: Configurable cross-origin resource sharing

## Quick Start

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 9+

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.template .env
   # Edit .env with your configuration
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`.

### Testing the Connection

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{ "status": "ok", "timestamp": "2024-01-15T10:30:00.000Z" }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment (development, production, test) |
| `PORT` | `3000` | HTTP server port |
| `DATA_DIR` | `./data` | Path to data storage directory |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins (comma-separated or `*`) |
| `DENIGMA_API_KEY` | - | API key for Denigma backend access |
| `RATE_LIMIT_REQUESTS` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | Rate limit window in milliseconds |

## Deployment to Render.com

### Option 1: Using Render Dashboard (Blueprints)

1. **Fork/clone the repository** to your GitHub account

2. **Update `render.yaml`** with your repository URL:
   ```yaml
   repo: https://github.com/YOUR_USERNAME/denigma
   ```

3. **Go to [Render Dashboard](https://dashboard.render.com)**

4. **Click "Blueprints"** in the left sidebar

5. **Click "New Blueprint Instance"**

6. **Connect your GitHub repository**

7. **Review and apply** the configuration

8. **Wait for deployment** to complete

### Option 2: Manual Web Service Creation

1. **Go to [Render Dashboard](https://dashboard.render.com)**

2. **Click "New +"** → **"Web Service"**

3. **Connect your repository** and select the `denigma` repo

4. **Configure the service**:
   - **Name**: `denigma-mcp-server`
   - **Runtime**: `Docker`
   - **Docker Context**: `.`
   - **Dockerfile Path**: `packages/mcp-server/Dockerfile`
   - **Plan**: `Starter` (or higher for production)

5. **Add environment variables**:
   ```
   NODE_ENV=production
   PORT=3000
   DATA_DIR=/data
   LOG_LEVEL=info
   ALLOWED_ORIGINS=*
   ```

6. **Add Disk** (for persistent storage):
   - **Name**: `data`
   - **Mount Path**: `/data`
   - **Size**: `1 GB`

7. **Click "Create Web Service"**

### Verify Deployment

Once deployed, test your server:

```bash
# Replace with your Render URL
curl https://denigma-mcp-server.onrender.com/health
```

## Custom GPT Integration

To connect this MCP server to a Custom GPT:

### 1. Get Your Server URL

After deployment, note your Render URL:
```
https://denigma-mcp-server.onrender.com
```

### 2. Configure Custom GPT

In ChatGPT's GPT builder:

1. **Go to Configure** → **Actions**

2. **Add authentication** (if needed):
   - Type: `API Key`
   - Location: `Header`
   - Name: `Authorization`

3. **Add the MCP schema**:
   ```yaml
   openapi: 3.1.0
   info:
     title: Denigma MCP Server
     version: 1.0.0
   servers:
     - url: https://denigma-mcp-server.onrender.com
   paths:
     /sse:
       get:
         operationId: connectSSE
         summary: Connect to SSE stream
         responses:
           '200':
             description: SSE stream established
     /messages:
       post:
         operationId: sendMessage
         summary: Send JSON-RPC message
         requestBody:
           required: true
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   jsonrpc:
                     type: string
                     enum: ['2.0']
                   method:
                     type: string
                   params:
                     type: object
                   id:
                     oneOf:
                       - type: string
                       - type: number
         responses:
           '200':
             description: JSON-RPC response
   ```

4. **Test the connection** using the GPT's testing interface

### 3. Example GPT Instructions

Add these instructions to your GPT:

```
You have access to Denigma's knowledge base through the Model Context Protocol.

Available tools:
- `denigma_search`: Search for concepts and information
- `denigma_get_concept`: Get detailed information about a specific concept
- `denigma_get_relations`: Discover relationships between concepts
- `denigma_get_context`: Get contextual information
- `denigma_suggest`: Suggest improvements to the knowledge base

When users ask about technical concepts, use these tools to provide accurate, contextual answers based on Denigma's knowledge graph.
```

## MCP Tool Reference

### denigma_search

Search for concepts, entities, and content in the knowledge base.

**Input:**
```json
{
  "query": "string",
  "limit": 10,
  "filters": {
    "type": ["concept", "entity", "document"],
    "category": "string"
  }
}
```

**Output:**
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "string",
      "type": "concept",
      "description": "string",
      "relevance": 0.95
    }
  ],
  "total": 42,
  "query": "original query"
}
```

**Example:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "denigma_search",
    "arguments": {
      "query": "machine learning algorithms",
      "limit": 5
    }
  },
  "id": "1",
  "jsonrpc": "2.0"
}
```

### denigma_get_concept

Retrieve detailed information about a specific concept.

**Input:**
```json
{
  "id": "uuid",
  "includeRelations": true,
  "includeMetadata": true
}
```

**Output:**
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "type": "concept",
  "metadata": {},
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### denigma_get_relations

Get relationships and connections for a given concept.

**Input:**
```json
{
  "id": "uuid",
  "relationTypes": ["parent", "child", "related"],
  "depth": 2
}
```

**Output:**
```json
{
  "conceptId": "uuid",
  "relations": [
    {
      "type": "parent",
      "targetId": "uuid",
      "targetName": "string",
      "strength": 0.85
    }
  ],
  "totalRelations": 15
}
```

### denigma_get_context

Gather surrounding context for a concept or query.

**Input:**
```json
{
  "query": "string",
  "conceptId": "uuid",
  "radius": 3,
  "includeContent": true
}
```

**Output:**
```json
{
  "centerConcept": {},
  "neighbors": [],
  "paths": [],
  "content": []
}
```

### denigma_suggest

Submit suggestions for knowledge base improvements.

**Input:**
```json
{
  "type": "new_concept|edit|relationship",
  "title": "string",
  "description": "string",
  "suggestedBy": "string"
}
```

**Output:**
```json
{
  "suggestionId": "uuid",
  "status": "pending",
  "submittedAt": "2024-01-15T10:30:00.000Z"
}
```

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "sessions": 5
}
```

### GET /sse

Establish a Server-Sent Events connection for MCP communication.

**Headers:**
- `Accept: text/event-stream`
- `Cache-Control: no-cache`

**Events:**
- `endpoint`: Initial connection event with message URL
  ```
  event: endpoint
  data: /messages?sessionId=<uuid>
  ```
- `message`: MCP JSON-RPC messages from server
  ```
  event: message
  data: {"jsonrpc":"2.0",...}
  ```

**Example:**
```bash
curl -N -H "Accept: text/event-stream" \
  http://localhost:3000/sse
```

### POST /messages

Send JSON-RPC messages to the MCP server.

**Query Parameters:**
- `sessionId` (required): The session ID from the SSE connection

**Request Body:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "denigma_search",
    "arguments": {
      "query": "neural networks"
    }
  },
  "id": "1"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [...]
  }
}
```

**Example:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  "http://localhost:3000/messages?sessionId=<uuid>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "denigma_search",
      "arguments": {"query": "test"}
    },
    "id": "1"
  }'
```

## Development

### Build Commands

```bash
# Build the project
npm run build

# Build in watch mode
npm run build:watch

# Clean build artifacts
npm run clean
```

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Development Server

```bash
# Start with hot reload
npm run dev

# Start with debugger
npm run debug
```

### Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to SSE endpoint
- **Check**: Verify the server is running with `curl http://localhost:3000/health`
- **Check**: Ensure no firewall is blocking port 3000
- **Check**: Verify CORS settings in `ALLOWED_ORIGINS`

**Problem**: Session not found errors
- **Check**: Ensure you're using the correct `sessionId` from the SSE `endpoint` event
- **Check**: Session may have expired; reconnect to GET /sse

### Deployment Issues

**Problem**: Build fails on Render
- **Check**: Ensure `Dockerfile` path is correct in service settings
- **Check**: Verify all dependencies are in `package.json`
- **Check**: Check Render build logs for specific errors

**Problem**: Service starts but health check fails
- **Check**: Verify `PORT` environment variable matches exposed port
- **Check**: Ensure the server binds to `0.0.0.0`, not just `localhost`
- **Check**: Check service logs for startup errors

### Performance Issues

**Problem**: Slow response times
- **Solution**: Upgrade Render plan for more resources
- **Solution**: Implement caching for frequently accessed data
- **Solution**: Optimize database queries

**Problem**: High memory usage
- **Solution**: Implement pagination for large result sets
- **Solution**: Use streaming for large data transfers
- **Solution**: Monitor and limit concurrent sessions

### MCP-Specific Issues

**Problem**: Tools not appearing in Custom GPT
- **Check**: Verify MCP server is accessible from OpenAI's servers
- **Check**: Ensure tools are properly registered in the MCP server
- **Check**: Review GPT's action schema configuration

**Problem**: JSON-RPC errors
- **Check**: Verify request follows JSON-RPC 2.0 specification
- **Check**: Ensure `jsonrpc: "2.0"` field is present
- **Check**: Check server logs for detailed error messages

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/denigma/issues)
- **Documentation**: [Full Docs](../../docs)
- **Discord**: [Join our community](https://discord.gg/denigma)
