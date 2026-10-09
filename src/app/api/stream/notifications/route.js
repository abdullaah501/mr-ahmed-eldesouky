import mongoose from "mongoose";
import connectToDatabase from "../../../../../lib/connectToDb";
import Session from "../../../../../models/Session";
import Notification from "../../../../../models/Notification";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
} from "../../../../../lib/trace/index.js";

// Authenticated SSE stream for the current user's notifications.
// Authentication: s-i session cookie must resolve to an active (non-revoked,
// non-expired) session — the userId is derived server-side, never from the
// client. Change events are filtered to that userId only.
export async function GET(req) {
  return withCaller("sse_notifications", () =>
    withTracePhase("sse_handshake", () =>
      withHttpTrace(req, "sse_notifications", async () => {
        await connectToDatabase();

        const sessionCookie = req.cookies.get("s-i")?.value;
        if (!sessionCookie || !/^[a-f0-9]{24}$/i.test(sessionCookie)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const sessionDoc = await Session.findById(sessionCookie)
          .select("userId isExp expiresAt")
          .lean();
        if (!sessionDoc || sessionDoc.isExp) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (
          sessionDoc.expiresAt &&
          new Date(sessionDoc.expiresAt).getTime() <= Date.now()
        ) {
          return new Response("Unauthorized", { status: 401 });
        }

        const userId = sessionDoc.userId;

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            const pipeline = [
              {
                $match: {
                  operationType: { $in: ["insert", "update"] },
                  "fullDocument.userId": new mongoose.Types.ObjectId(userId),
                },
              },
            ];

            let changeStream;
            try {
              changeStream = Notification.watch(pipeline, {
                fullDocument: "updateLookup",
              });
            } catch (err) {
              controller.close();
              return;
            }

            changeStream.on("change", (change) => {
              const doc = change.fullDocument || {};
              try {
                const data = JSON.stringify({
                  id: doc._id ? String(doc._id) : null,
                  type: doc.type,
                  title: doc.title,
                  body: doc.body,
                  link: doc.link,
                  readAt: doc.readAt || null,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } catch {}
            });

            changeStream.on("error", () => {
              try {
                controller.close();
              } catch {}
            });

            req.signal?.addEventListener("abort", () => {
              try {
                changeStream.close();
              } catch {}
              try {
                controller.close();
              } catch {}
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
