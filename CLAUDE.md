# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VSCode LSP MCP is a Visual Studio Code extension that exposes Language Server Protocol (LSP) features through the Model Context Protocol (MCP). It allows AI assistants to access VSCode's language intelligence (hover info, definitions, references, completions, rename) via HTTP endpoints.

## Build Commands

```bash
pnpm install          # Install dependencies
pnpm run build        # Build with tsup (produces dist/index.js)
pnpm run dev          # Watch mode with sourcemaps
pnpm run lint         # ESLint with auto-fix
pnpm run typecheck    # TypeScript type checking
pnpm run vsix         # Package as .vsix file
```

To debug: Press F5 in VSCode to launch Extension Development Host.

## Architecture

The extension uses `reactive-vscode` for the VSCode extension framework.

### Entry Point
- `src/index.ts` - Extension activation, calls `startMcp()` on startup

### MCP Server Layer (`src/mcp/`)
- `index.ts` - Main server setup: Express app, CORS middleware, MCP transport configuration. Creates stateless HTTP transport for each request.
- `tools.ts` - Registers MCP tools (`get_hover`, `get_definition`, `get_completions`, `get_references`, `rename_symbol`) using `@modelcontextprotocol/sdk`
- `startServer.ts` - Port conflict handling with automatic retry
- `cors.ts` - CORS middleware implementation

### LSP Wrappers (`src/lsp/`)
Each file wraps a VSCode LSP command:
- `hover.ts` → `vscode.executeHoverProvider`
- `definition.ts` → `vscode.executeDefinitionProvider`
- `completion.ts` → `vscode.executeCompletionItemProvider`
- `references.ts` → `vscode.executeReferenceProvider`
- `rename.ts` → `vscode.executeDocumentRenameProvider`
- `tools.ts` - Helper to get document objects from URIs

### Data Flow
1. HTTP POST to `/mcp` endpoint
2. Express creates `StreamableHTTPServerTransport` (stateless mode)
3. `McpServer` receives tool call
4. Tool handler calls corresponding LSP wrapper
5. LSP wrapper uses `vscode.commands.executeCommand()` to invoke VSCode's language server
6. Result returned as JSON through MCP transport

## Key Technical Details

- **Stateless MCP**: Each request creates a new transport/server instance (no session management)
- **URI Format**: Tools expect file URIs with proper encoding (e.g., `file:///c%3A/path/file.ts` on Windows)
- **Build**: tsup bundles all dependencies except `vscode` into a single CJS file
- **Port**: Default 9527, auto-increments on conflict (configurable via `lsp-mcp.maxRetries`)
- **Disabled by default**: Extension must be enabled via `lsp-mcp.enabled: true` in settings
