import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AgentCommandRequest, AgentCommandResponse, DashboardSnapshotResponse } from "../shared/contracts";
import { parseAgentInput } from "../shared/lifeAgent";
import type { Env } from "./env";
import { getDashboardSnapshot } from "./repository";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "lifeos-worker",
    now: new Date().toISOString()
  }),
);

app.get("/api/dashboard", async (c) => {
  const snapshot = await getDashboardSnapshot(c.env.DB);
  const response: DashboardSnapshotResponse = {
    ...snapshot,
    generatedAt: new Date().toISOString()
  };
  return c.json(response);
});

app.post("/api/agent", async (c) => {
  const body = (await c.req.json()) as AgentCommandRequest;
  const snapshot = await getDashboardSnapshot(c.env.DB);
  const mutation = parseAgentInput(body.command, snapshot.data);

  const response: AgentCommandResponse = {
    accepted: true,
    mutation,
    source: snapshot.source
  };

  return c.json(response);
});

export default app;
