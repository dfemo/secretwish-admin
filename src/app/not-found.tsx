import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-display text-6xl font-semibold text-plum-800">404</p>
      <p className="mt-2 text-ink-500">This page doesn&apos;t exist — or it&apos;s still a secret.</p>
      <Link href="/" className="mt-6 rounded-xl bg-plum-800 px-4 py-2 text-sm font-semibold text-ivory-50">
        Back to overview
      </Link>
    </div>
  );
}
