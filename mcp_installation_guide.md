# Installing LifeOS MCP Server

To use the LifeOS MCP Server with AI assistants like Claude Desktop, Cursor, OpenCode, or Gemini CLI, you can connect to the deployed Cloudflare worker. Since standard MCP clients support the Server-Sent Events (SSE) transport, you can configure them using the endpoint `/api/mcp`.

## Authentication

LifeOS MCP endpoints are secured. It is highly recommended to authenticate using an **API Key**.
1. Generate an API Key from your LifeOS web dashboard (Settings page) or via the CLI.
2. Authenticate the CLI by running:
   ```bash
   lifeos auth login <YOUR_API_KEY>
   ```

## Claude Desktop / Cursor / OpenCode Setup

Standard `mcpServers` configurations in Claude, Cursor, and OpenCode usually expect a local command that uses standard I/O (stdio). We provide a built-in proxy in the `lifeos` CLI tool to securely forward standard I/O to the remote HTTP SSE endpoint.

Assuming you have installed the CLI globally (`npm link` from the `/cli` folder), configure your `mcpServers` JSON (e.g. `claude_desktop_config.json`) as follows:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "lifeos",
      "args": ["mcp"]
    }
  }
}
```

The CLI will automatically use your saved API key to authenticate with the remote server.

## Direct SSE Clients

If you are using a custom client that natively supports connecting directly to remote SSE MCP servers, simply point the client to the URL and provide the header manually:

**URL:** `https://your-lifeos-worker-url.workers.dev/api/mcp`
**Headers:**
```
Authorization: Bearer YOUR_API_KEY_HERE
```
