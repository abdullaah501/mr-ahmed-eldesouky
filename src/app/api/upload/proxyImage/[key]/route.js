import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import checkUser from "../../../../../../lib/checkUser";
import {
  withCaller,
  withHttpTrace,
  withTracePhase,
  setContextFields,
  emitCookie,
  hashToken,
  nowIso,
} from "../../../../../../lib/trace/index.js";

const s3 = new S3Client({
  region: process.env.IDRIVE_REGION,
  endpoint: process.env.IDRIVE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.IDRIVE_KEY,
    secretAccessKey: process.env.IDRIVE_SECRET,
  },
});

const allowedImageExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

export async function GET(request, { params }) {
  return withCaller("api_upload_proxy_image", () =>
    withTracePhase("api_route", () =>
      withHttpTrace(request, "api_upload_proxy_image", async () => {
  const { searchParams } = new URL(request.url);
  const { key } = await params;
  const secure = searchParams.get("secure");
  const rangeHeader = request.headers.get("range");

  if (!key || key === "undefined") {
    return new NextResponse("Missing key", { status: 400 });
  }

  const checkRes = await checkUser();

  if (secure === "true") {
    const referer = request.headers.get("referer");
    if (
      !checkRes?.success ||
      !referer ||
      !referer.startsWith(process.env.NEXT_PUBLIC_BASE_URL)
    ) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.IDRIVE_BUCKET,
      Key: key,
      Range: rangeHeader || undefined,
    });

    const s3Response = await s3.send(command);

    const headers = new Headers();

    if (s3Response.ContentRange) {
      headers.set("Content-Range", s3Response.ContentRange);
      headers.set("Accept-Ranges", "bytes");
      headers.set(
        "Content-Length",
        s3Response.ContentLength?.toString() || "0"
      );
    } else {
      headers.set(
        "Content-Length",
        s3Response.ContentLength?.toString() || "0"
      );
    }

    // If image → inline
    const isImage = allowedImageExt.some(ext =>
      key.toLowerCase().endsWith(ext)
    );

    headers.set("Content-Type", s3Response.ContentType || "application/octet-stream");

    if (isImage) {
      headers.set("Content-Disposition", "inline"); // for display
    } else {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(key.split("/").pop())}"`
      ); // for download
    }

    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(s3Response.Body, {
      status: s3Response.ContentRange ? 206 : 200,
      headers,
    });
  } catch (error) {
    console.error("Proxy file error:", error);
    return new NextResponse("File not found", { status: 404 });
  }
      })
    )
  );
}
