import { Router } from "express";

/**
 * Presentation Layer Routing Matrix
 * Binds structural network paths directly to controller execution handlers.
 * 
 * @param {Object} dependencies
 * @param {Object} dependencies.llmController - Target execution controller instance
 * @param {Function} dependencies.authenticate - Application HTTP Auth extraction middleware
 * @returns {Router}
 */
export function createLLMRouter({ llmController, authenticate }) {
    if (!llmController) throw new Error("createLLMRouter Critical Failure: llmController instance required.");
    if (!authenticate) throw new Error("createLLMRouter Critical Failure: authenticate middleware required.");

    const router = Router();

    /**
     * @openapi
     * /api/v1/assistant/chat
     * Method: POST
     * Description: Accepts complex natural language prompts inside a secure request body 
     *              and establishes a non-blocking Server-Sent Events (SSE) response stream.
     */
    router.post(
        "/chat",
        authenticate,
        llmController.chat
    );

    return router;
}