"use client";

import Link from "next/link";
import { useState } from "react";
import { Moon, Sun, ChevronDown } from "lucide-react";

export default function Nav({ darkMode, toggleTheme, connected, onConnect, onDisconnect, availableWallets, onWalletSelect }) {
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);

  const handleConnectClick = () => {
    if (connected) {
      onDisconnect();
    } else {
      if (availableWallets && availableWallets.length > 0) {
        if (availableWallets.length === 1) {
          onWalletSelect(availableWallets[0].provider, availableWallets[0].name);
        } else {
          setShowWalletDropdown(!showWalletDropdown);
        }
      } else {
        onConnect();
      }
    }
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl text-slate-100 shadow-glow dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-200 shadow-lg shadow-sky-500/10 ring-1 ring-white/10">
            E
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-300">EzzaSwap</p>
            <p className="text-xs text-slate-500">DeFi DEX protocol</p>
          </div>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          <Link href="#swap" className="text-sm font-semibold text-slate-300 transition hover:text-sky-300">
            Swap
          </Link>
          <Link href="#pool" className="text-sm font-semibold text-slate-300 transition hover:text-sky-300">
            Pool
          </Link>
          <Link href="#liquidity" className="text-sm font-semibold text-slate-300 transition hover:text-sky-300">
            Liquidity
          </Link>
          <Link href="#analytics" className="text-sm font-semibold text-slate-300 transition hover:text-sky-300">
            Analytics
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 text-slate-100 transition hover:border-sky-300/40 hover:text-sky-200"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative">
            <button
              onClick={handleConnectClick}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition ${connected ? "bg-red-500 hover:bg-red-400 shadow-red-500/20" : "bg-sky-500 hover:bg-sky-400 shadow-sky-500/20"}`}
            >
              {connected ? "Disconnect" : "Connect Wallet"}
              {!connected && availableWallets && availableWallets.length > 1 && (
                <ChevronDown size={16} />
              )}
            </button>

            {showWalletDropdown && !connected && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-700/50 bg-slate-900/95 p-2 shadow-xl backdrop-blur-xl">
                {availableWallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={() => {
                      onWalletSelect(wallet.provider, wallet.name);
                      setShowWalletDropdown(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-800/80"
                  >
                    <span className="text-xl">{wallet.icon}</span>
                    <div>
                      <p className="font-semibold text-slate-100">{wallet.name}</p>
                      <p className="text-xs text-slate-400">Connect via browser</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
