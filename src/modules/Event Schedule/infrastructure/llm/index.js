import { OpenAIClient } from './OpenAIClient.js';
import { ToolRegistry } from './ToolRegistry.js';
import { ToolExecutor } from './ToolExecutor.js';
import { LLMCommandInterceptor } from './command_interceptor.js';

export function initLLM({
  openAIConfig,
  featureFlags,
  domainServices,
  uowFactory,
  logger,
  telemetry
}) {
  const toolRegistry = new ToolRegistry({
    featureFlags,
    domainServices
  });

  const toolExecutor = new ToolExecutor({
    uowFactory,
    domainServices,
    logger
  });

  const openAIClient = new OpenAIClient(openAIConfig);

  const commandInterceptor = new LLMCommandInterceptor({
    useCaseRegistry: toolExecutor.handlers,
    toolDefinitions: toolRegistry.listAll(),
    featureFlags,
    telemetryEngine: telemetry
  });

  return {
    openAIClient,
    toolRegistry,
    toolExecutor,
    commandInterceptor
  };
}