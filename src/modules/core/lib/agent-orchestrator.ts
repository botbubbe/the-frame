/**
 * Agent Orchestrator — Foundation for all AI agents in The Frame.
 * Registers agents, runs them, tracks runs in agent_runs table, logs to reporting_logs.
 */
import { db, sqlite } from "@/lib/db";
import { agentRuns, reportingLogs } from "@/modules/core/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// ── Types ──

export interface AgentConfig {
  /** AI model to use (e.g., "gpt-4o", "claude-3-5-sonnet") */
  model?: string;
  /** Max tokens for LLM calls */
  maxTokens?: number;
  /** Cost limit in cents per run */
  costLimitCents?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Whether this agent uses LLM or is rule-based */
  mode: "rules" | "llm" | "hybrid";
}

export interface AgentInput {
  [key: string]: unknown;
}

export interface AgentOutput {
  success: boolean;
  data?: unknown;
  error?: string;
  tokensUsed?: number;
  costCents?: number;
}

export type AgentHandler = (input: AgentInput, config: AgentConfig) => Promise<AgentOutput>;

interface RegisteredAgent {
  name: string;
  module: string;
  handler: AgentHandler;
  config: AgentConfig;
}

// ── Orchestrator ──

class AgentOrchestrator {
  private agents = new Map<string, RegisteredAgent>();

  /**
   * Register an agent with the orchestrator.
   */
  registerAgent(
    name: string,
    module: string,
    handler: AgentHandler,
    config: AgentConfig
  ): void {
    this.agents.set(name, { name, module, handler, config });
  }

  /**
   * Get list of registered agents.
   */
  listAgents(): { name: string; module: string; config: AgentConfig }[] {
    return Array.from(this.agents.values()).map(a => ({
      name: a.name,
      module: a.module,
      config: a.config,
    }));
  }

  /**
   * Run an agent. Creates a tracking record, executes handler, updates record.
   * Returns the run ID for status checking.
   */
  async runAgent(name: string, input: AgentInput): Promise<string> {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`Agent "${name}" not registered`);

    const runId = crypto.randomUUID();
    const startTime = Date.now();

    // Create run record
    db.insert(agentRuns).values({
      id: runId,
      agentName: agent.name,
      module: agent.module,
      status: "running",
      input: input as Record<string, unknown>,
    }).run();

    // Execute handler (non-blocking for batch operations)
    this.executeAgent(runId, agent, input, startTime).catch(err => {
      console.error(`[AgentOrchestrator] Unhandled error in agent ${name}:`, err);
    });

    return runId;
  }

  /**
   * Run an agent synchronously (blocks until done). Returns the output directly.
   */
  async runAgentSync(name: string, input: AgentInput): Promise<AgentOutput> {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`Agent "${name}" not registered`);

    const runId = crypto.randomUUID();
    const startTime = Date.now();

    // Create run record
    db.insert(agentRuns).values({
      id: runId,
      agentName: agent.name,
      module: agent.module,
      status: "running",
      input: input as Record<string, unknown>,
    }).run();

    return this.executeAgent(runId, agent, input, startTime);
  }

  /**
   * Get status of an agent run.
   */
  getAgentStatus(runId: string): typeof agentRuns.$inferSelect | null {
    return db.select().from(agentRuns).where(eq(agentRuns.id, runId)).get() ?? null;
  }

  // ── Private ──

  private async executeAgent(
    runId: string,
    agent: RegisteredAgent,
    input: AgentInput,
    startTime: number
  ): Promise<AgentOutput> {
    try {
      // Apply timeout if configured
      let result: AgentOutput;
      if (agent.config.timeoutMs) {
        result = await Promise.race([
          agent.handler(input, agent.config),
          new Promise<AgentOutput>((_, reject) =>
            setTimeout(() => reject(new Error("Agent timeout")), agent.config.timeoutMs)
          ),
        ]);
      } else {
        result = await agent.handler(input, agent.config);
      }

      const durationMs = Date.now() - startTime;

      // Update run record
      db.update(agentRuns).set({
        status: result.success ? "completed" : "failed",
        output: result.data as Record<string, unknown> | null,
        tokensUsed: result.tokensUsed ?? null,
        cost: result.costCents ?? null,
        durationMs,
        error: result.error ?? null,
        completedAt: new Date().toISOString(),
      }).where(eq(agentRuns.id, runId)).run();

      // Log to reporting
      logger.logEvent("agent_run", agent.module, {
        agent: agent.name,
        runId,
        status: result.success ? "completed" : "failed",
        durationMs,
        tokensUsed: result.tokensUsed,
        costCents: result.costCents,
      });

      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      db.update(agentRuns).set({
        status: "failed",
        error: errorMsg,
        durationMs,
        completedAt: new Date().toISOString(),
      }).where(eq(agentRuns.id, runId)).run();

      logger.logError("error", `agent:${agent.name}`, errorMsg);

      return { success: false, error: errorMsg };
    }
  }
}

// Singleton
export const agentOrchestrator = new AgentOrchestrator();
