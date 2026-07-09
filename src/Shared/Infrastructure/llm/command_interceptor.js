import { performance } from 'perf_hooks';

// Definitive custom error abstractions for high-fidelity logs
export class LLMAuthorizationError extends Error { 
  constructor(message) {
    super(message);
    this.name = 'LLM_AUTHORIZATION_ERROR';
  }
}

export class LLMFeatureDisabledError extends Error { 
  constructor(message) {
    super(message);
    this.name = 'LLM_FEATURE_DISABLED_ERROR';
  }
}

export class LLMUseCaseMappingError extends Error { 
  constructor(message) {
    super(message);
    this.name = 'LLM_USE_CASE_MAPPING_ERROR';
  }
}

/**
 * Enterprise Ingress Guardrail Interceptor
 * Dynamically enforces corporate governance, compliance, and metrics 
 * over passive LLM function-calling declarations.
 */
export class LLMCommandInterceptor {
  /**
   * @param {Object} deps
   * @param {Map<string, Object>} deps.useCaseRegistry - Maps useCase string names to execution instances
   * @param {Array<Object>} deps.toolDefinitions - The array containing your tool configs (like createEventToolDef)
   * @param {Object} deps.featureFlags - Feature flagging provider (e.g., LaunchDarkly wrapper)
   * @param {Object} deps.telemetryEngine - Systems metrics aggregator (e.g., Prometheus/OpenTelemetry client)
   */
  constructor(deps) {
    if (!deps.useCaseRegistry || !deps.toolDefinitions || !deps.featureFlags || !deps.telemetryEngine) {
      throw new Error('LLMCommandInterceptor initialization error: Missing required system dependencies.');
    }

    this.useCaseRegistry = deps.useCaseRegistry;
    this.featureFlags = deps.featureFlags;
    this.telemetry = deps.telemetryEngine;
    
    // Index tool definitions by tool string name for O(1) runtime lookups
    this.toolDefinitions = new Map(
      deps.toolDefinitions.map(def => [def.name, def])
    );
  }

  /**
   * Orchestrates the active enforcement and execution lifecycle of an AI intent
   * @param {Object} parsedIntent - The parsed object emitted by your OpenAIClient
   * @param {string} parsedIntent.useCase - Name of the chosen tool
   * @param {Object} parsedIntent.payload - The validated Zod arguments payload
   * @param {Object} userContext - Current authenticated actor session metadata
   * @param {string} userContext.id - User UUID
   * @param {string} userContext.tenantId - Enterprise tenant grouping identifier
   * @param {Array<string>} userContext.roles - Assigned security roles (e.g., ['attendee', 'organizer'])
   */
  async process(parsedIntent, userContext) {
    const { useCase: toolName, payload } = parsedIntent;
    const toolDef = this.toolDefinitions.get(toolName);

    if (!toolDef) {
      this.telemetry.counter('llm_unmapped_tool_failures', 1, { attemptedTool: toolName });
      throw new LLMUseCaseMappingError(`System Configuration Fault: No tool definition found for '${toolName}'.`);
    }

    // 1. Feature Flag Guardrail Enforcement
    const isEnabled = await this.featureFlags.isEnabled(toolDef.featureFlag, userContext.tenantId);
    if (!isEnabled) {
      this.telemetry.counter('llm_feature_gate_rejections', 1, { tool: toolDef.name });
      throw new LLMFeatureDisabledError(`Access Denied: The tool feature policy '${toolDef.featureFlag}' is disabled.`);
    }

    // 2. Role-Based Access Control (RBAC) Verification
    const hasPermission = toolDef.requiresRole.some(role => userContext.roles.includes(role));
    if (!hasPermission) {
      this.telemetry.emitAlert('UNAUTHORIZED_LLM_COMMAND_EXPLOIT_ATTEMPT', {
        tool: toolDef.name,
        userId: userContext.id,
        userRoles: userContext.roles
      });
      throw new LLMAuthorizationError(`Security Rejection: Footprint insufficient for target useCase capability.`);
    }

    // 3. Forward execution to monitored core domain channel
    return await this.executeWithTelemetry(toolDef, payload, userContext);
  }

  /**
   * Private executor that runs the pure application usecase wrapped inside latency and financial tracking bounds
   * @private
   */
  async executeWithTelemetry(toolDef, payload, userContext) {
    const startTime = performance.now();
    const useCaseInstance = this.useCaseRegistry.get(toolDef.useCase);

    if (!useCaseInstance) {
      throw new LLMUseCaseMappingError(`Infrastructure Link Failure: Target usecase execution handler '${toolDef.useCase}' unbonded.`);
    }

    try {
      // Execute pure application business use case boundary
      const result = await useCaseInstance.execute(payload, userContext);
      
      const durationMs = performance.now() - startTime;

      // Emit high-precision Prometheus/Grafana metrics
      this.telemetry.histogram('llm_tool_execution_duration_ms', durationMs, { tool: toolDef.name });
      this.telemetry.counter('llm_financial_burn_cents', toolDef.costCents, { tool: toolDef.name });

      // Service Level Agreement (SLA) Monitoring Deficit Alerting
      if (durationMs > toolDef.slaMs) {
        console.warn(`[SLA_BREACH] UseCase: ${toolDef.name} Latency: ${durationMs.toFixed(2)}ms | Threshold Target: ${toolDef.slaMs}ms`);
        this.telemetry.counter('llm_sla_breach_count', 1, { tool: toolDef.name });
      }

      return result;

    } catch (error) {
      this.telemetry.counter('llm_tool_execution_failures', 1, { 
        tool: toolDef.name, 
        errorClass: error.name || 'UnknownError' 
      });
      throw error;
    }
  }
}