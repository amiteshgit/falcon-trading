"use client";
import { useScan } from "@/lib/scan-context";

export default function OrderModal() {
  const { modal, confirmModal, cancelModal } = useScan();
  if (!modal) return null;
  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-50" onClick={cancelModal}>
      <div className="bg-white dark:bg-[#151A24] rounded-2xl p-5 max-w-[420px] w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-2">{modal.title}</h3>
        {modal.lines.map(([k, v], i) => (
          <div className="kv" key={i}>
            <span className="text-gray-500 dark:text-gray-400">{k}</span>
            <span>{v}</span>
          </div>
        ))}
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-800 dark:text-amber-400 rounded-lg px-2.5 py-2 text-xs my-3">
          {modal.warn}
        </div>
        <div className="flex gap-2.5 mt-3.5">
          <button className="btn-ghost flex-1 rounded-lg px-4 py-2 text-sm font-semibold" onClick={cancelModal}>Cancel</button>
          <button className="btn flex-1" onClick={confirmModal}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
