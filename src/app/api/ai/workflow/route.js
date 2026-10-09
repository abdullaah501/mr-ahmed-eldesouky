import crypto from "crypto";
import { ai } from "../../../../../lib/ai/index";
import { getImportObject } from "../../../../../lib/import/storage/fetchObject";
import { createTaskEmitter, TaskEvent } from "../../../../../lib/ai/engine/taskEvents";
import { authorizeAiRequest, authResponse } from "../_shared/auth";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

function encodeEvent(encoder, event, data) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function resolveInput(input) {
  if (!input || !input.fileKey) return input;
  const object = await getImportObject(input.fileKey);
  return {
    name: input.filename || "ai-resource",
    type: input.filetype || object.contentType || "application/octet-stream",
    size: input.filesize ?? object.contentLength,
    arrayBuffer: async () => object.bytes.buffer,
  };
}

export async function POST(req) {
  const auth = await authorizeAiRequest(req);
  if (!auth.ok) return authResponse(auth);

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.type) {
    return Response.json({ success: false, message: "Workflow type is required" }, { status: 400 });
  }

  const requestId = body.requestId || crypto.randomUUID();
  const taskId = body.taskId || requestId;
  const emitter = createTaskEmitter();
  const runAbortController = new AbortController();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let heartbeat;

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        for (const event of Object.values(TaskEvent)) emitter.removeAllListeners(event);
        try { controller.close(); } catch { /* already closed */ }
      };

      const send = (event, payload) => {
        if (closed) return;
        try {
          controller.enqueue(encodeEvent(encoder, event, { requestId, ...payload }));
        } catch {
          close();
        }
      };

      const forwardedEvents = [
        TaskEvent.TASK_STARTED,
        TaskEvent.STAGE_STARTED,
        TaskEvent.STAGE_FINISHED,
        TaskEvent.TASK_RETRY,
        TaskEvent.TASK_FALLBACK,
        TaskEvent.ARTIFACT,
      ];
      for (const event of forwardedEvents) {
        emitter.on(event, (payload) => send(event, payload || {}));
      }

      heartbeat = setInterval(() => send("ping", {}), 15_000);
      req.signal?.addEventListener("abort", () => {
        runAbortController.abort();
        close();
      }, { once: true });

      void (async () => {
        try {
          const task = {
            ...body,
            taskId,
            requestId,
            userId: auth.userId,
            input: await resolveInput(body.input),
            emitter,
            signal: runAbortController.signal,
          };
          const result = await ai(task);
          if (!closed) {
            const metadata = {
              provider: result?.provider || null,
              model: result?.model || null,
              cost: result?.cost ?? null,
              cacheHit: Boolean(result?.cacheHit),
              retries: result?.retries || 0,
              promptVersion: result?.promptVersion || null,
              timings: result?.timings || [],
              totalDurationMs: result?.totalDurationMs || null,
              errors: result?.errors || [],
              warnings: result?.warnings || [],
            };
            if (result?.status === "failed") {
              send(TaskEvent.TASK_FAILED, { status: "failed", result, ...metadata });
            } else {
              send(TaskEvent.TASK_COMPLETED, { status: result?.status || "ok", result, ...metadata });
            }
          }
        } catch (error) {
          send(TaskEvent.TASK_FAILED, {
            status: "failed",
            error: { code: error?.code || "AI_WORKFLOW_FAILED", message: error?.message || "Workflow failed" },
          });
        } finally {
          close();
        }
      })();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
