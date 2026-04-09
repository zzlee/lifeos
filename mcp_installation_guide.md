# Installing LifeOS MCP Server

To use the LifeOS MCP Server with AI assistants like Claude Desktop, Cursor, or Gemini CLI, you can connect to the deployed Cloudflare worker. Since standard MCP clients support the Server-Sent Events (SSE) transport, you can configure them using the endpoint `/api/mcp`.

## Claude Desktop / Cursor Setup

Because LifeOS requires authentication via an HTTP cookie (`lifeos_session`), standard automated clients might struggle to connect if they do not support injecting cookies or headers out-of-the-box, or you'll need to use a proxy that injects your session cookie.

For clients that support HTTP/SSE connection with headers, configure it as follows:

```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/inspector", "http://your-lifeos-worker-url.workers.dev/api/mcp"]
    }
  }
}
```

*Note: Since standard `mcpServers` configurations in Claude/Cursor usually expect a local command that uses standard I/O (stdio) rather than HTTP SSE directly, you may need an SSE-to-stdio proxy like `mcp-proxy` or `supergateway` that forwards standard IO from the CLI to your remote HTTP Server-Sent Events endpoint, along with the `Cookie: lifeos_session=YOUR_COOKIE` header.*

Example using an SSE-to-stdio proxy:
```json
{
  "mcpServers": {
    "lifeos": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-proxy",
        "https://your-lifeos-worker-url.workers.dev/api/mcp",
        "--header",
        "Cookie: lifeos_session=YOUR_SESSION_COOKIE_HERE"
      ]
    }
  }
}
```

## Gemini CLI Setup

If you are using Gemini CLI or a custom client that supports SSE directly, simply point the client to:

`https://your-lifeos-worker-url.workers.dev/api/mcp`

Ensure you pass your active `lifeos_session` cookie in the request headers for authentication.
