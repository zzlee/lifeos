import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getApiUrl, getApiKey } from "./config";
import chalk from "chalk";

export async function runMcpProxy() {
  const apiKey = getApiKey();
  const apiUrl = getApiUrl();

  if (!apiKey) {
    console.error(chalk.red("Error: API Key not found. Please login first."));
    process.exit(1);
  }

  const mcpUrl = new URL("/api/mcp", apiUrl);

  // Set up SSE client to remote server
  const clientTransport = new SSEClientTransport(new URL(mcpUrl.toString()), {
    requestInit: {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    }
  });

  // Set up standard stdio server to local client
  const serverTransport = new StdioServerTransport();

  clientTransport.onmessage = (message) => {
    serverTransport.send(message).catch(err => {
      console.error(chalk.red("Error sending to client:"), err);
    });
  };

  serverTransport.onmessage = (message) => {
    clientTransport.send(message).catch(err => {
      console.error(chalk.red("Error sending to server:"), err);
    });
  };

  clientTransport.onclose = () => {
    serverTransport.close();
    process.exit(0);
  };
  serverTransport.onclose = () => {
    clientTransport.close();
    process.exit(0);
  };

  try {
    await serverTransport.start();
    await clientTransport.start();
  } catch (error) {
    console.error(chalk.red("Failed to start proxy:"), error);
    process.exit(1);
  }
}
