import { NextResponse } from "next/server";
import { listPlugins } from "../../../../../../lib/import/registry/pluginRegistry";
import "../../../../../../lib/import/plugins";

export async function GET() {
  const plugins = listPlugins()
    .filter((p) => p.implemented)
    .map((p) => ({
      id: p.id,
      label: p.label,
      version: p.version,
      extensions: p.extensions,
      mimeTypes: p.mimeTypes || [],
      capabilities: p.capabilities || {},
    }));

  return NextResponse.json(plugins);
}
