import { NextResponse } from "next/server";
import checkUser from "../../../../../../lib/checkUser";
import { createImportPresignedUrl } from "../../../../../../lib/import/storage/createPresignedUrl";

function requireAdminOrAssistant(user) {
  if (!user || (user.role !== "admin" && user.role !== "assistant")) {
    return false;
  }
  return true;
}

export async function POST(req) {
  const checkRes = await checkUser();
  if (!checkRes?.success || !requireAdminOrAssistant(checkRes.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await createImportPresignedUrl(body);

    const response = NextResponse.json(result);

    return response;
  } catch (error) {
    console.error("import presigned error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate upload URL" }, { status: 500 });
  }
}
