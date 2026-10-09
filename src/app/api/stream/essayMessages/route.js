import connectToDatabase from "../../../../../lib/connectToDb";
import Essay from "../../../../../models/Essay";
import Session from "../../../../../models/Session";

// SSE trigger for the essay review queue. Authentication: s-i session cookie
// must resolve to an active admin/assistant session. Only a minimal signal is
// emitted — never the essay content itself.
export async function GET(req) {
  await connectToDatabase();

  const sessionCookie = req.cookies.get("s-i")?.value;
  if (!sessionCookie || !/^[a-f0-9]{24}$/i.test(sessionCookie)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionDoc = await Session.findById(sessionCookie)
    .populate("userId", "role")
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
  const role = sessionDoc.userId?.role;
  if (role !== "admin" && role !== "assistant") {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const pipeline = [{ $match: { operationType: "insert" } }];
      const changeStream = Essay.watch(pipeline, { fullDocument: false });

      changeStream.on("change", () => {
        // Minimal signal only — clients refetch the authorized queue.
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ newEssay: true })}\n\n`));
        } catch {}
      });

      changeStream.on("error", () => {
        try { controller.close(); } catch {}
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
}
