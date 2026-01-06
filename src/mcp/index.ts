import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'
import { window, workspace } from 'vscode'
import { cors } from './cors'
import { startServer } from './startServer'
import { addLspTools } from './tools'

export function startMcp() {
  const config = workspace.getConfiguration('lsp-mcp')
  const isMcpEnabled = config.get('enabled', true)
  const mcpPort = config.get('port', 9527)
  const maxRetries = config.get('maxRetries', 10)

  // CORS 配置
  const corsEnabled = config.get('cors.enabled', true)
  const allowOriginsStr: string = config.get('cors.allowOrigins', '*')
  const withCredentials = config.get('cors.withCredentials', false)
  const exposeHeadersStr: string = config.get('cors.exposeHeaders', 'Mcp-Session-Id')

  if (!isMcpEnabled) {
    window.showInformationMessage('LSP MCP server is disabled by configuration.')
    return
  }
  const app = express()

  // 应用 CORS 中间件（必须在其他中间件之前）
  if (corsEnabled) {
    const allowOrigins = allowOriginsStr === '*'
      ? '*'
      : allowOriginsStr.split(',').map(origin => origin.trim())

    const exposeHeaders = exposeHeadersStr.split(',').map(header => header.trim())

    app.use(cors(allowOrigins, withCredentials, exposeHeaders))
  }

  app.use(express.json())

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    // Stateless mode: create new transport for each request
    // This is compatible with clients that don't manage sessions (like Claude Code)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
      allowedHosts: ['127.0.0.1', 'localhost'],
    })

    const server = new McpServer({
      name: 'lsp-server',
      version: '0.0.2',
    })

    // Add LSP tools to the server
    addLspTools(server)

    // Connect to the MCP server
    await server.connect(transport)

    // Bypass initialization check for stateless mode
    // eslint-disable-next-line ts/no-explicit-any
    const webTransport = (transport as any)._webStandardTransport
    if (webTransport && !webTransport._initialized) {
      webTransport._initialized = true
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body)
  })

  // 尝试启动服务器，处理端口冲突
  startServer(app, mcpPort, maxRetries)
}
