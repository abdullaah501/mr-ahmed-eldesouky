import { NextResponse } from "next/server";
import { getExporter } from "../../../../../../lib/import/template/registry";

const CONTENT_TYPES = {
  json: "application/json; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const EXTENSIONS = { json: "json", docx: "docx" };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");

  const exporter = getExporter(format);
  if (!exporter) {
    return NextResponse.json(
      { error: `Invalid format. Supported: ${Object.keys(CONTENT_TYPES).join(", ")}` },
      { status: 400 }
    );
  }

  const data = await exporter();

  return new NextResponse(data, {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="repository-template.${EXTENSIONS[format]}"`,
    },
  });
}
