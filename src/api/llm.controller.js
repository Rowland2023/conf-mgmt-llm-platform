import { ValidationError } from "../../../shared/errors/ApplicationErrors.js";

export class LLMController {
  constructor({ commandInterceptor, authService }) {
    if (!commandInterceptor) throw new Error("LLMController: commandInterceptor required.");
    if (!authService) throw new Error("LLMController: authService required.");
    
    this.commandInterceptor = commandInterceptor;
    this.authService = authService;
    this.chat = this.chat.bind(this);
  }

  async chat(req, res, next) {
    let heartbeat = null;
    let clientClosed = false;
    
    const abortController = new AbortController();

    const cleanup = () => {
      if (clientClosed) return; // Strict idempotency guard
      clientClosed = true;
      
      // Clear interval immediately before triggering secondary async events
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }

      // Signal upstream/downstream dependencies to dump active context allocations
      abortController.abort();
    };

    // Bind low-level network drop listeners
    req.on("close", cleanup);
    req.on("error", cleanup);

    try {
      const { message } = req.body;
      if (!message?.trim()) throw new ValidationError("LLMController: message body required");

      const user = await this.authService.getUser(req);

      // Verify the client hasn't disconnected during the async auth validation step
      if (clientClosed) return;

      // Initialize SSE Protocol Transport Channel
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Prevent TCP idle/gateway drop timeouts via standard SSE keep-alive comments
      heartbeat = setInterval(() => {
        if (!clientClosed && res.writable && !res.writableEnded) {
          res.write(": ping\n\n");
        }
      }, 15000);

      await this.commandInterceptor.interpret({
        message: message.trim(),
        userContext: {
          userId: user.id,
          tenantId: user.tenantId,
          timezone: user.timezone || 'UTC',
          roles: user.roles || []
        },
        onToken: (chunk) => {
          if (!clientClosed && res.writable && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ success: true, chunk })}\n\n`);
          }
        },
        signal: abortController.signal
      });

      // Close out the stream cleanly if the client is still listening
      if (!clientClosed && res.writable && !res.writableEnded) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } catch (error) {
      // 1. Isolate expected user-initiated network cancellation exceptions
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        // Log cleanly at a debug level if tracking infrastructure is attached
        return; 
      }

      // 2. If failure occurs before headers flash, bubble to central application middleware
      if (!res.headersSent) {
        return next(error);
      }
      
      // 3. If failure happens mid-stream, push a structured error frame so the UI can adapt cleanly
      if (!clientClosed && res.writable && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ success: false, error: error.message })}\n\n`);
        res.end();
      }
    } finally {
      // Unbind network connection event hooks to prevent event emitter memory accumulation leaks
      req.off("close", cleanup);
      req.off("error", cleanup);
      
      // Always trigger cleanup last to safely catch lingering timers
      cleanup();
    }
  }
}