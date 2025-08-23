import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 min-h-[calc(100vh-96px)] flex flex-col items-center justify-center">
      <h1 className="text-2xl sm:text-3xl font-semibold text-center">
        Wählen Sie bitte einen Bereich aus
      </h1>

      <div className="mt-8 flex items-center justify-center gap-4">
        <Link
          href="/patient"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Anfordern
        </Link>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md bg-gray-100 px-6 py-3 text-gray-900 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Aufträge
        </button>
      </div>
    </main>
  );
}
