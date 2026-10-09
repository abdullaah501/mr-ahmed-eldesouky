import { NextResponse } from "next/server";
import checkUser from "../../../../lib/checkUser";
import connectToDatabase from "../../../../lib/connectToDb";
import { getAdminAnalyticsData } from "../../../../lib/services/adminAnalyticsService";

export async function GET() {
  try {
    const { success, user } = await checkUser();
    if (!success || !user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const tabsData = await getAdminAnalyticsData();

    return NextResponse.json({ success: true, tabsData });
  } catch (error) {
    console.error("Error in getAdminAnalytics:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
