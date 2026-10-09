import mongoose from "mongoose";
import connectToDatabase from "../../../../../lib/connectToDb";
import Session from "../../../../../models/Session";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
  setContextFields,
  emit,
  nowIso,
} from "../../../../../lib/trace/index.js";

export async function GET(req) {
  return withCaller("sse_is_new_device", () =>
    withTracePhase("sse_handshake", () =>
      withHttpTrace(req, "sse_is_new_device", async () => {
        await connectToDatabase();

        const sessionCookie = req.cookies.get("s-i")?.value;
        setContextFields({ session_id: sessionCookie || null });

        console.log("sessionCookie", sessionCookie);

        if (!sessionCookie) {
          return new Response("Unauthorized", { status: 401 });
        }

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            const pipeline = [
              {
                $match: {
                  operationType: "update",
                  "documentKey._id": new mongoose.Types.ObjectId(sessionCookie),
                  "updateDescription.updatedFields.isExp": { $exists: true },
                },
              },
            ];

            const changeStream = Session.watch(pipeline, { fullDocument: "updateLookup" });

            changeStream.on("change", (change) => {
              const data = JSON.stringify({
                isExp: change.fullDocument.isExp,
              });
              emit("sse_change_event", {
                session_id: sessionCookie,
                isExp_before: null,
                isExp_after: change.fullDocument.isExp,
                expiredAt: change.fullDocument.expiredAt
                  ? new Date(change.fullDocument.expiredAt).toISOString()
                  : null,
                parent_change_id: change._id ? String(change._id) : null,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            });

            req.signal?.addEventListener("abort", () => {
              changeStream.close();
              controller.close();
            });
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      })
    )
  );
}
