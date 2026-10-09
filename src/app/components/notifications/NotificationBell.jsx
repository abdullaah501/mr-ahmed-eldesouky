"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { api } from "../../../../lib/axios/axios";
import { FiBell } from "react-icons/fi";
import MathRenderer from "../math/MathRenderer";

const TYPE_LABELS = {
  new_lecture: "محاضرة جديدة",
  new_exam: "امتحان جديد",
  exam_result: "نتيجة امتحان",
  schedule_change: "تغيير في المواعيد",
  attendance: "تحديث الحضور",
  announcement: "إعلان",
};

export default function NotificationBell() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [liveUnreadBump, setLiveUnreadBump] = useState(0);
  const seenIds = useRef(new Set());

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/api/notifications?limit=20");
      if (!res?.data?.success)
        throw new Error(res?.data?.message || "Failed to load notifications");
      return res.data.data;
    },
    refetchOnWindowFocus: false,
  });

  // Prime the seen-set so existing items don't toast on first load.
  useEffect(() => {
    for (const n of listQuery.data?.items || []) {
      seenIds.current.add(n._id);
    }
  }, [listQuery.data]);

  useEffect(() => {
    let es;
    try {
      es = new EventSource("/api/stream/notifications");
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data?.id || seenIds.current.has(data.id)) return;
          seenIds.current.add(data.id);
          setLiveUnreadBump((v) => v + 1);
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          if (data.title) {
            toast(data.title);
          }
        } catch {}
      };
      es.onerror = () => {
        // EventSource auto-reconnects; nothing to do.
      };
    } catch {}
    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, [queryClient]);

  const unread =
    (listQuery.data?.unread || 0) > 0 ? listQuery.data.unread : liveUnreadBump;

  const markAllRead = async () => {
    try {
      await api.post("/api/notifications", { action: "markRead", ids: [] });
      setLiveUnreadBump(0);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {}
  };

  const openNotification = (n) => {
    if (!n.readAt) {
      api
        .post("/api/notifications", { action: "markRead", ids: [n._id] })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        )
        .catch(() => {});
    }
    setOpen(false);
    if (n.link && n.link.startsWith("/")) router.push(n.link);
  };

  return (
    <div className="relative z-99999">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 rounded-xl bg-white border border-foreground/10 hover:bg-foreground/5 transition-colors"
        title="الإشعارات"
      >
        <FiBell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-foreground/10 rounded-2xl shadow-2xl z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
              <span className="font-semibold text-sm">الإشعارات</span>
              {(listQuery.data?.unread || 0) > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  تعليم الكل كمقروء
                </button>
              )}
            </div>
            {(listQuery.data?.items || []).length === 0 ? (
              <p className="text-center py-8 text-xs text-foreground/50">
                مفيش إشعارات
              </p>
            ) : (
              listQuery.data.items.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`w-full text-right px-4 py-3 border-b border-foreground/5 last:border-b-0 hover:bg-foreground/5 transition-colors ${
                    !n.readAt ? "bg-primary/[0.04]" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {!n.readAt && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    <span className="text-[10px] text-foreground/50">
                      {TYPE_LABELS[n.type] || ""}
                    </span>
                    <span className="text-[10px] text-foreground/40 mr-auto">
                      {n.createdAt
                        ? format(new Date(n.createdAt), "yyyy-MM-dd HH:mm")
                        : ""}
                    </span>
                  </div>
                  <div className="text-sm font-medium"><MathRenderer text={n.title} /></div>
                  {n.body && (
                    <div className="text-xs text-foreground/60 mt-0.5"><MathRenderer text={n.body} /></div>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
