import Link from "next/link";

export default function Nav() {
  return (
    <nav className="bg-slate-900 text-white px-6 py-4 shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="text-lg font-semibold">Simple DEX</div>
        <div className="flex gap-4">
          <Link href="/" className="hover:text-cyan-300">Home</Link>
          <Link href="/swap" className="hover:text-cyan-300">Swap</Link>
          <Link href="/liquidity" className="hover:text-cyan-300">Liquidity</Link>
        </div>
      </div>
    </nav>
  );
}
