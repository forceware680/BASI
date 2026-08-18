// App.tsx — 主框架 (header + 1 layar utama).
//
// 1 layar utama: KoreksiListPage. Header 只含 aplikasi 名称.

import { KoreksiListPage } from "./pages/KoreksiListPage";

export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <header className="border-b border-zinc-200 bg-zinc-50/80 px-6 py-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight">
            SIM-BA Koreksi BMD
          </h1>
          <span className="text-sm text-zinc-500">
            Subid Penatausahaan Aset — BPKAD
          </span>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <KoreksiListPage />
      </main>
    </div>
  );
}
