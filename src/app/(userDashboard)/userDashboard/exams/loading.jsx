export default function ExamsLoading() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
            >
              <div className="h-5 w-32 bg-gray-200 rounded" />
              <div className="h-6 w-full bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
