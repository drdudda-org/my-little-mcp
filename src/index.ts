#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";

// Helper functions
function getCurrentTime(format: string = "locale"): string {
  const now = new Date();
  
  switch (format) {
    case "iso":
      return now.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T") + ".000Z";
    case "timestamp":
      return now.getTime().toString();
    case "locale":
    default:
      return now.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit", 
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "long"
      });
  }
}

function getRandomNumber(min: number = 1, max: number = 50): number {
  // Ensure min and max are within bounds
  min = Math.max(1, Math.min(min, 100));
  max = Math.max(1, Math.min(max, 100));
  
  // Ensure min <= max
  if (min > max) {
    [min, max] = [max, min];
  }
  
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Create server
function createServer() {
  const server = new McpServer({
    name: "My Little MCP Server",
    version: "0.1.0",
  });

  // Add current time tool
  server.registerTool(
    "get_current_time",
    {
      title: "현재 시간 조회",
      description: "현재 시간을 알려주는 도구입니다. 한국 시간(KST)으로 현재 날짜와 시간을 반환합니다.",
      inputSchema: {
        format: z.enum(["locale", "iso", "timestamp"]).optional().describe("시간 포맷 (기본값: locale)")
      }
    },
    async ({ format = "locale" }) => {
      const currentTime = getCurrentTime(format);
      return {
        content: [{ 
          type: "text", 
          text: `현재 시간: ${currentTime}` 
        }]
      };
    }
  );

  // Add random number tool
  server.registerTool(
    "get_random_number",
    {
      title: "랜덤 숫자 생성",
      description: "1부터 50 사이의 랜덤한 숫자를 하나 뽑아주는 도구입니다.",
      inputSchema: {
        min: z.number().min(1).max(100).optional().describe("최소값 (기본값: 1)"),
        max: z.number().min(1).max(100).optional().describe("최대값 (기본값: 50)")
      }
    },
    async ({ min = 1, max = 50 }) => {
      const randomNumber = getRandomNumber(min, max);
      return {
        content: [{ 
          type: "text", 
          text: `랜덤 숫자 (${min}~${max}): ${randomNumber}` 
        }]
      };
    }
  );

  return server;
}

// Run with stdio transport
async function runStdioServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("My Little MCP Server running on stdio");
}

// Run with HTTP transport
async function runHttpServer(port: number = 8004) {
  const app = express();
  
  // CORS configuration
  app.use(cors({
    origin: '*',
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'mcp-session-id'],
  }));
  
  app.use(express.json());

  // Store transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      server: 'my-little-mcp-server',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    });
  });

  // Documentation endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'My Little MCP Server',
      version: '0.1.0',
      description: '현재 시간과 랜덤 숫자를 제공하는 간단한 MCP 서버',
      transport: 'HTTP (Streamable)',
      endpoints: {
        health: 'GET /health - 서버 상태 확인',
        mcp: 'POST /mcp - MCP 프로토콜 엔드포인트',
        documentation: 'GET / - 이 문서'
      },
      tools: [
        {
          name: 'get_current_time',
          description: '현재 시간을 알려줍니다 (한국 시간)'
        },
        {
          name: 'get_random_number', 
          description: '1-50 사이의 랜덤 숫자를 뽑습니다'
        }
      ]
    });
  });

  // MCP endpoint with session management
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    try {
      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
      } else {
        // Create new transport for new session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            transports[sessionId] = transport;
          },
          // 개발 환경에서는 DNS rebinding protection 비활성화
          enableDnsRebindingProtection: false,
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        // Create and connect server
        const server = createServer();
        await server.connect(transport);
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Start HTTP server
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 My Little MCP Server running on http://0.0.0.0:${port}`);
    console.log(`📚 Documentation: http://localhost:${port}/`);
    console.log(`💚 Health Check: http://localhost:${port}/health`);
    console.log(`🔧 MCP Endpoint: http://localhost:${port}/mcp`);
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
const transportArg = args.find(arg => arg.startsWith('--transport='))?.split('=')[1];
const portArg = args.find(arg => arg.startsWith('--port='))?.split('=')[1];

const transport = transportArg || 'stdio';
// Use PORT environment variable first (Smithery compatibility), then CLI args, then default
const port = parseInt(process.env.PORT || portArg || '8081');

// Run server
if (transport === 'http') {
  runHttpServer(port).catch((error) => {
    console.error("Fatal error running HTTP server:", error);
    process.exit(1);
  });
} else {
  runStdioServer().catch((error) => {
    console.error("Fatal error running stdio server:", error);
    process.exit(1);
  });
}