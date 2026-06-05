"use client";

import ActivityStream from "@/components/ActivityStream";
import DealHealthPanel from "@/components/DealHealthPanel";

export default function Dashboard() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-100">
      <div className="min-w-0 flex-1 border-r border-zinc-200">
        <ActivityStream />
      </div>
      <div className="w-full max-w-md shrink-0 border-l border-zinc-200 lg:max-w-lg xl:max-w-xl">
        <DealHealthPanel />
      </div>
    </div>
  );
}
