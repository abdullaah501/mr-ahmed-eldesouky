import DataCards from "./DataCards";
import StudentsAnalyticsSection from "./StudentsAnalyticsSection";
import UsersExamsResults from "./UsersExamsResults";
import { getAdminAnalyticsData } from "../../../../lib/services/adminAnalyticsService";

// Server component — the dashboard overview page is already admin-gated, so
// counts are read directly (no internal HTTP fetch carrying no auth cookies).
export default async function AdminAnalyticsSection() {
  try {
    const tabsData = await getAdminAnalyticsData();

    return (
      <>
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {tabsData.map((tab) => (
            <DataCards key={tab.id} data={tab} />
          ))}
        </div>
        <StudentsAnalyticsSection />
        <UsersExamsResults />
      </>
    );
  } catch (error) {
    console.log(error.message || "Something went wrong");
    return <p className="text-red-500">فشل تحميل بيانات التحليلات.</p>;
  }
}
