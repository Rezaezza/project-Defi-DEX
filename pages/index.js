"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { ArrowRight, ChevronDown, Moon, Sparkles, Sun } from "lucide-react";
import Nav from "../components/Nav";
import { tokenAbi, dexAbi } from "../lib/abis";
import addresses from "../data/contractAddresses.json";

const formatNumber = (value) => Number(value).toFixed(4);

export default function Home() {
  const [darkMode, setDarkMode] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("swap");
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [balanceA, setBalanceA] = useState("0");
  const [balanceB, setBalanceB] = useState("0");
  const [reserveA, setReserveA] = useState("0");
  const [reserveB, setReserveB] = useState("0");
  const [priceAtoB, setPriceAtoB] = useState("0");
  const [message, setMessage] = useState("Connect wallet untuk melihat saldo dan harga.");
  const [isConnected, setIsConnected] = useState(false);
  const [fromAmount, setFromAmount] = useState("1.0000");
  const [toAmount, setToAmount] = useState("0.8123");
  const [fromNetwork, setFromNetwork] = useState("base-sepolia");
  const [toNetwork, setToNetwork] = useState("base-sepolia");
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDC");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [walletBalances, setWalletBalances] = useState({});
  const [connectedNetwork, setConnectedNetwork] = useState(null);
  const [availableWallets, setAvailableWallets] = useState(null);

  const chainIdToNetwork = {
    84532: "base-sepolia",
    84531: "base-sepolia",
    421614: "arc-testnet",
    42170: "arc-testnet",
    37714555429: "arc-testnet"
  };

  const networkConfig = {
    "base-sepolia": {
      addressKey: "baseSepolia",
      chainId: 84532,
      chainHex: "0x14A38",
      chainName: "Base Sepolia",
      rpcUrls: ["https://sepolia.base.org"],
      explorerUrl: "https://sepolia.basescan.org"
    },
    "arc-testnet": {
      addressKey: "arbitrumSepolia",
      chainId: 421614,
      chainHex: "0x66E76",
      chainName: "Arc Testnet",
      rpcUrls: ["https://sepolia-rollup.arbitrum.io:443"],
      explorerUrl: "https://sepolia.arbiscan.io"
    }
  };

  const getNetworkName = (chainId) => chainIdToNetwork[Number(chainId)] || null;

  const balances = {
    "base-sepolia": { ETH: "2.5", USDC: "150.00", USDT: "75.50" },
    "arc-testnet": { ETH: "1.8", USDC: "200.00", USDT: "120.25" }
  };

  const networks = [
    { id: "base-sepolia", name: "Base Sepolia", icon: "🔷" },
    { id: "arc-testnet", name: "Arc Testnet", icon: "🟣" }
  ];

  const tokens = {
    "base-sepolia": [
      { symbol: "ETH", name: "Ethereum", icon: "⟠" },
      { symbol: "USDC", name: "USD Coin", icon: "$" },
      { symbol: "USDT", name: "Tether", icon: "₮" }
    ],
    "arc-testnet": [
      { symbol: "ETH", name: "Ethereum", icon: "⟠" },
      { symbol: "USDC", name: "USD Coin", icon: "$" },
      { symbol: "USDT", name: "Tether", icon: "₮" }
    ]
  };

  const getCurrentBalance = (network, token) => {
    if (walletBalances[network] && walletBalances[network][token] !== undefined) {
      return walletBalances[network][token];
    }
    if (isConnected) {
      return "0.0000";
    }
    return balances[network]?.[token] || "0.0000";
  };

  const hasContracts = addresses.tokenA && addresses.tokenB && addresses.dex;

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ezzaswap-theme") : null;
    if (stored) {
      setDarkMode(stored === "dark");
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && typeof window !== "undefined") {
      localStorage.setItem("ezzaswap-theme", darkMode ? "dark" : "light");
      document.documentElement.classList.toggle("dark", darkMode);
    }
  }, [darkMode, isHydrated]);

  const getAvailableWallets = () => {
    const wallets = [];
    if (typeof window === "undefined") return null;

    if (window.ethereum) {
      if (window.ethereum.isMetaMask) wallets.push({ name: "MetaMask", provider: window.ethereum, icon: "🦊" });
      if (window.ethereum.isRabby) wallets.push({ name: "Rabby Wallet", provider: window.ethereum, icon: "🐰" });
    }
    if (window.rabby) wallets.push({ name: "Rabby Wallet", provider: window.rabby, icon: "🐰" });
    if (window.coinbaseWalletProvider) wallets.push({ name: "Coinbase Wallet", provider: window.coinbaseWalletProvider, icon: "🔵" });
    return wallets.length > 0 ? wallets : null;
  };

  const loadWalletBalances = async (prov, userAddress) => {
    try {
      const network = await prov.getNetwork();
      const networkName = getNetworkName(network.chainId);
      setConnectedNetwork(networkName);

      if (!networkName) {
        setMessage("Jaringan tidak didukung. Silakan gunakan Base Sepolia atau Arc Testnet.");
        return;
      }

      const ethBalance = await prov.getBalance(userAddress);
      const formattedEth = Number(ethers.formatEther(ethBalance)).toFixed(4);

      const balanceUpdates = {
        ETH: formattedEth,
        USDC: "0.0000",
        USDT: "0.0000"
      };

      const addressKey = networkConfig[networkName]?.addressKey;
      const networkAddresses = addressKey ? addresses[addressKey] : null;

      if (networkAddresses) {
        for (const tokenSymbol of ["USDC", "USDT"]) {
          const tokenAddress = networkAddresses[tokenSymbol.toLowerCase()];
          if (tokenAddress && tokenAddress !== ethers.ZeroAddress) {
            try {
              const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, prov);
              const decimals = Number(await tokenContract.decimals());
              const rawTokenBalance = await tokenContract.balanceOf(userAddress);
              balanceUpdates[tokenSymbol] = Number(ethers.formatUnits(rawTokenBalance, decimals)).toFixed(4);
            } catch (error) {
              console.warn(`Gagal mengambil saldo ${tokenSymbol} pada jaringan ${networkName}:`, error.message);
            }
          }
        }
      } else {
        console.warn(`Alamat token tidak tersedia untuk jaringan ${networkName}`);
      }

      setWalletBalances((prev) => ({
        ...prev,
        [networkName]: {
          ...prev[networkName],
          ...balanceUpdates
        }
      }));

      if (fromNetwork !== networkName) {
        setFromNetwork(networkName);
      }
      if (toNetwork !== networkName) {
        setToNetwork(networkName);
      }
      if (fromToken !== tokens[networkName][0].symbol) {
        setFromToken(tokens[networkName][0].symbol);
      }
      if (toToken !== tokens[networkName][1].symbol) {
        setToToken(tokens[networkName][1].symbol);
      }
    } catch (error) {
      console.error("Gagal memuat saldo wallet:", error);
      setMessage("Gagal memuat saldo wallet. Periksa koneksi jaringan dan wallet Anda.");
    }
  };

  const switchWalletNetwork = async (networkId) => {
    if (!provider || !window.ethereum) return false;
    const targetConfig = networkConfig[networkId];
    if (!targetConfig) return false;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetConfig.chainHex }]
      });
      return true;
    } catch (switchError) {
      console.warn("Gagal beralih jaringan wallet:", switchError);
      return false;
    }
  };

  const connectWithProvider = async (ethereumProvider, walletName) => {
    try {
      setMessage(`Membuka ${walletName} di browser Anda...`);
      const accounts = await ethereumProvider.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        setMessage(`Koneksi ${walletName} dibatalkan oleh user.`);
        return;
      }
      const userAddress = accounts[0];
      const prov = new ethers.BrowserProvider(ethereumProvider);
      const sign = prov.getSigner();
      setProvider(prov);
      setSigner(sign);
      setAccount(userAddress);
      setIsConnected(true);
      setMessage(`✓ ${walletName} terhubung! Memuat data...`);
      await loadData(prov, userAddress);
      await loadWalletBalances(prov, userAddress);
    } catch (error) {
      console.error(`${walletName} connection error:`, error);
      if (error.code === 4001) {
        setMessage(`Koneksi ${walletName} ditolak oleh user.`);
      } else if (error.code === -32603) {
        setMessage(`Terjadi error internal di ${walletName}. Silakan coba lagi.`);
      } else {
        setMessage(`Error: ${error.message || `Gagal menghubungkan ${walletName}`}`);
      }
    }
  };

  const connectWallet = async () => {
    const availableWallets = getAvailableWallets();
    if (!availableWallets) {
      alert("Tidak ada wallet terdeteksi! Silakan install MetaMask, Rabby Wallet, atau wallet lainnya.");
      setMessage("Tidak ada wallet terdeteksi. Gunakan 'Connect to Local Hardhat' untuk testing di Codespaces.");
      return;
    }
    if (availableWallets.length === 1) {
      await connectWithProvider(availableWallets[0].provider, availableWallets[0].name);
    }
  };

  const connectLocalHardhat = async () => {
    try {
      setMessage("Menghubungkan ke Hardhat lokal...");
      const prov = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const sign = prov.getSigner(0);
      const address = await sign.getAddress();
      setProvider(prov);
      setSigner(sign);
      setAccount(address);
      setIsConnected(true);
      setMessage("Terhubung ke Hardhat lokal. Memuat data...");
      await loadData(prov, address);
      await loadWalletBalances(prov, address);
    } catch (error) {
      console.error("Hardhat connection error:", error);
      setMessage("Gagal menghubungkan ke Hardhat lokal. Pastikan 'npx hardhat node' berjalan.");
    }
  };

  const loadData = async (provider, userAddress) => {
    if (!hasContracts) return;
    try {
      const tokenA = new ethers.Contract(addresses.tokenA, tokenAbi, provider);
      const tokenB = new ethers.Contract(addresses.tokenB, tokenAbi, provider);
      const dex = new ethers.Contract(addresses.dex, dexAbi, provider);
      const [rawA, rawB] = await Promise.all([tokenA.balanceOf(userAddress), tokenB.balanceOf(userAddress)]);
      const [reserveAResult, priceResult] = await Promise.all([dex.getReserves(), dex.getPriceAtoB()]);
      setBalanceA(ethers.formatUnits(rawA, 18));
      setBalanceB(ethers.formatUnits(rawB, 18));
      setReserveA(ethers.formatUnits(reserveAResult[0], 18));
      setReserveB(ethers.formatUnits(reserveAResult[1], 18));
      setPriceAtoB(ethers.formatUnits(priceResult, 18));
      setMessage("Data DEX berhasil dimuat.");
    } catch (error) {
      console.error(error);
      setMessage("Gagal memuat data dari kontrak. Pastikan alamat kontrak sudah terdeploy.");
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount("");
    setIsConnected(false);
    setBalanceA("0");
    setBalanceB("0");
    setMessage("Wallet terputus. Connect wallet untuk melihat saldo dan harga.");
  };

  const loadPublicData = async () => {
    if (!hasContracts) return;
    try {
      const prov = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const dex = new ethers.Contract(addresses.dex, dexAbi, prov);
      const [reserveAResult, priceResult] = await Promise.all([dex.getReserves(), dex.getPriceAtoB()]);
      setReserveA(ethers.formatUnits(reserveAResult[0], 18));
      setReserveB(ethers.formatUnits(reserveAResult[1], 18));
      setPriceAtoB(ethers.formatUnits(priceResult, 18));
    } catch (error) {
      console.error("Gagal memuat data publik:", error);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      loadPublicData();
      setAvailableWallets(getAvailableWallets());
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowFromDropdown(false);
        setShowToDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_30%),linear-gradient(180deg,#dbeafe_0%,#e0f2fe_50%,#e0f7ff_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#071426_55%,#0f172a_100%)] min-h-screen transition-all duration-700">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-72 w-72 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>
      <Nav
        darkMode={darkMode}
        toggleTheme={() => setDarkMode((value) => !value)}
        connected={isConnected}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        availableWallets={availableWallets}
        onWalletSelect={connectWithProvider}
      />
      <main className="relative mx-auto max-w-7xl px-6 py-12">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/80 px-8 py-10 shadow-glow backdrop-blur-xl transition duration-700 dark:border-slate-700/40 dark:bg-slate-950/60 md:px-12">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-sky-300/20 to-transparent blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                DeFi Protocol · Powered by Uniswap V3
              </div>
              <div className="space-y-4">
                <h1 className="text-5xl font-semibold tracking-[-0.04em] text-slate-950 drop-shadow-sm dark:text-slate-50 md:text-6xl">EzzaSwap</h1>
                <p className="max-w-xl text-xl text-slate-600 dark:text-slate-300">
                  Swap, Earn, and Provide Liquidity with a clean Web3 experience.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-sky-500/5 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/65">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Wallet Status</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-100">{isConnected ? "Connected" : "Disconnected"}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{isConnected ? account : "Hubungkan wallet untuk melihat saldo"}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-200/70 bg-slate-950/10 p-6 backdrop-blur-xl shadow-2xl shadow-slate-500/10 dark:border-slate-700/60 dark:bg-slate-900/80">
              <div className="flex items-center justify-between rounded-3xl bg-slate-50/80 p-3 shadow-inner shadow-slate-200/60 dark:bg-slate-950/70">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Live status</p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Live
                  </div>
                </div>
                <Sparkles className="text-sky-400" />
              </div>
              <div className="mt-8 space-y-4 text-slate-900 dark:text-slate-100">
                <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-950/80">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Reserve Token A</p>
                  <p className="mt-2 text-3xl font-semibold">{formatNumber(reserveA)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-950/80">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Reserve Token B</p>
                  <p className="mt-2 text-3xl font-semibold">{formatNumber(reserveB)}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-sky-500/10 p-4 shadow-sm dark:border-slate-700/70 dark:bg-sky-500/10">
                  <p className="text-sm text-slate-500 dark:text-slate-300">Harga A → B</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{formatNumber(priceAtoB)} TKB</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="swap" className="mt-10 grid gap-8 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/85 p-6 shadow-glow backdrop-blur-xl transition duration-700 dark:border-slate-700/60 dark:bg-slate-950/80">
            <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Trading panel</p>
                  <h2 className="text-3xl font-semibold text-slate-950 dark:text-white">Swap Tokens</h2>
                </div>
                <div className="inline-flex rounded-full bg-slate-100/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:bg-slate-900/80 dark:text-slate-200">
                  Active: {activeTab === "swap" ? "Swap Tokens" : "Add Liquidity"}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 rounded-3xl bg-slate-100/80 p-1 text-sm dark:bg-slate-900/80">
                {[
                  { key: "swap", label: "Swap Tokens" },
                  { key: "liquidity", label: "Add Liquidity" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-3xl px-4 py-3 transition ${activeTab === tab.key ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : "text-slate-600 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-800/80"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-5">
                <div className="rounded-[2rem] border border-slate-200/80 bg-white/95 p-5 shadow-sm dark:border-slate-700/75 dark:bg-slate-950/90">
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>From</span>
                    <span>Balance: {formatNumber(getCurrentBalance(fromNetwork, fromToken))} {fromToken}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-[1.75rem] border border-slate-200/80 bg-slate-50 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/90">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-200">
                        {tokens[fromNetwork].find(t => t.symbol === fromToken)?.icon || fromToken[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{fromToken}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{networks.find(n => n.id === fromNetwork)?.name}</p>
                      </div>
                    </div>
                    <div className="relative ml-auto dropdown-container">
                      <button
                        onClick={() => setShowFromDropdown(!showFromDropdown)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        <span>Change</span>
                        <ChevronDown size={16} />
                      </button>
                      {showFromDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-700/50 bg-slate-900/95 p-3 shadow-xl backdrop-blur-xl z-10">
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-slate-200 mb-2">Select Network</p>
                            <div className="grid grid-cols-1 gap-2">
                              {networks.map((network) => (
                                <button
                                  key={network.id}
                                  onClick={async () => {
                                    if (!isConnected || network.id === fromNetwork) {
                                      setFromNetwork(network.id);
                                      setFromToken(tokens[network.id][0].symbol);
                                      setShowFromDropdown(false);
                                      return;
                                    }
                                    const switched = await switchWalletNetwork(network.id);
                                    if (switched) {
                                      setFromNetwork(network.id);
                                      setToNetwork(network.id);
                                      setFromToken(tokens[network.id][0].symbol);
                                      setToToken(tokens[network.id][1].symbol);
                                      await loadWalletBalances(provider, account);
                                    }
                                    setShowFromDropdown(false);
                                  }}
                                  className={`flex items-center gap-3 rounded-xl p-3 text-left transition ${
                                    fromNetwork === network.id ? "bg-sky-500/20 border border-sky-400/50" : "hover:bg-slate-800/80"
                                  }`}
                                >
                                  <span className="text-lg">{network.icon}</span>
                                  <span className="font-semibold text-slate-100">{network.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-200 mb-2">Select Token</p>
                            <div className="grid grid-cols-1 gap-2">
                              {tokens[fromNetwork].map((token) => (
                                <button
                                  key={token.symbol}
                                  onClick={() => {
                                    setFromToken(token.symbol);
                                    setShowFromDropdown(false);
                                  }}
                                  className={`flex items-center gap-3 rounded-xl p-3 text-left transition ${
                                    fromToken === token.symbol ? "bg-sky-500/20 border border-sky-400/50" : "hover:bg-slate-800/80"
                                  }`}
                                >
                                  <span className="text-lg">{token.icon}</span>
                                  <div>
                                    <p className="font-semibold text-slate-100">{token.symbol}</p>
                                    <p className="text-xs text-slate-400">{token.name}</p>
                                  </div>
                                  <span className="ml-auto text-sm text-slate-400">
                                    {formatNumber(getCurrentBalance(fromNetwork, token.symbol))}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="mt-4 w-full rounded-3xl border border-slate-200/80 bg-slate-50 px-5 py-4 text-3xl font-semibold text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-lg shadow-slate-500/10 dark:bg-slate-800 dark:text-slate-300">
                    <ArrowRight size={24} />
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200/80 bg-white/95 p-5 shadow-sm dark:border-slate-700/75 dark:bg-slate-950/90">
                  <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>To</span>
                    <span>Balance: {formatNumber(getCurrentBalance(toNetwork, toToken))} {toToken}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-[1.75rem] border border-slate-200/80 bg-slate-50 px-4 py-4 dark:border-slate-700/70 dark:bg-slate-900/90">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-200">
                        {tokens[toNetwork].find(t => t.symbol === toToken)?.icon || toToken[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{toToken}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{networks.find(n => n.id === toNetwork)?.name}</p>
                      </div>
                    </div>
                    <div className="relative ml-auto dropdown-container">
                      <button
                        onClick={() => setShowToDropdown(!showToDropdown)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        <span>Change</span>
                        <ChevronDown size={16} />
                      </button>
                      {showToDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-700/50 bg-slate-900/95 p-3 shadow-xl backdrop-blur-xl z-10">
                          <div className="mb-3">
                            <p className="text-sm font-semibold text-slate-200 mb-2">Select Network</p>
                            <div className="grid grid-cols-1 gap-2">
                              {networks.map((network) => (
                                <button
                                  key={network.id}
                                  onClick={async () => {
                                    if (!isConnected || network.id === toNetwork) {
                                      setToNetwork(network.id);
                                      setToToken(tokens[network.id][0].symbol);
                                      setShowToDropdown(false);
                                      return;
                                    }
                                    const switched = await switchWalletNetwork(network.id);
                                    if (switched) {
                                      setFromNetwork(network.id);
                                      setToNetwork(network.id);
                                      setFromToken(tokens[network.id][0].symbol);
                                      setToToken(tokens[network.id][1].symbol);
                                      await loadWalletBalances(provider, account);
                                    }
                                    setShowToDropdown(false);
                                  }}
                                  className={`flex items-center gap-3 rounded-xl p-3 text-left transition ${
                                    toNetwork === network.id ? "bg-sky-500/20 border border-sky-400/50" : "hover:bg-slate-800/80"
                                  }`}
                                >
                                  <span className="text-lg">{network.icon}</span>
                                  <span className="font-semibold text-slate-100">{network.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-200 mb-2">Select Token</p>
                            <div className="grid grid-cols-1 gap-2">
                              {tokens[toNetwork].map((token) => (
                                <button
                                  key={token.symbol}
                                  onClick={() => {
                                    setToToken(token.symbol);
                                    setShowToDropdown(false);
                                  }}
                                  className={`flex items-center gap-3 rounded-xl p-3 text-left transition ${
                                    toToken === token.symbol ? "bg-sky-500/20 border border-sky-400/50" : "hover:bg-slate-800/80"
                                  }`}
                                >
                                  <span className="text-lg">{token.icon}</span>
                                  <div>
                                    <p className="font-semibold text-slate-100">{token.symbol}</p>
                                    <p className="text-xs text-slate-400">{token.name}</p>
                                  </div>
                                  <span className="ml-auto text-sm text-slate-400">
                                    {formatNumber(getCurrentBalance(toNetwork, token.symbol))}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={toAmount}
                    onChange={(e) => setToAmount(e.target.value)}
                    className="mt-4 w-full rounded-3xl border border-slate-200/80 bg-slate-50 px-5 py-4 text-3xl font-semibold text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div className="space-y-4">
                  <button className="w-full rounded-3xl bg-sky-500 px-6 py-5 text-lg font-semibold text-white shadow-xl shadow-sky-500/30 transition hover:bg-sky-400">
                    Swap Now
                  </button>
                  <button onClick={connectWallet} className="w-full rounded-3xl border border-slate-200 bg-white px-6 py-5 text-lg font-semibold text-slate-900 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    {isConnected ? "Wallet Connected" : "Connect Wallet"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/85 p-6 shadow-glow backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-950/80">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Saldo Wallet</p>
              <h3 className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">Hubungkan wallet untuk melihat saldo</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Klik Connect Wallet di pojok kanan atas untuk mengaktifkan saldo dan riwayat token Anda.</p>
              <div className="mt-6 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 text-slate-700 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/90 dark:text-slate-200">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Tip</p>
                <p className="mt-2 text-sm">Setelah terhubung, dapatkan akses penuh ke swap dan likuiditas.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-950/85 p-6 shadow-glow backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/85">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Harga & Likuiditas</p>
                  <p className="mt-1 text-2xl font-semibold text-white">Market overview</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-semibold text-emerald-300">Live</span>
              </div>
              <div className="mt-6 space-y-4 text-slate-200">
                <div className="flex items-center justify-between rounded-3xl border border-slate-700/50 bg-slate-950/60 px-4 py-4">
                  <span className="text-sm text-slate-400">Reserve A</span>
                  <span className="font-semibold">{formatNumber(reserveA)}</span>
                </div>
                <div className="flex items-center justify-between rounded-3xl border border-slate-700/50 bg-slate-950/60 px-4 py-4">
                  <span className="text-sm text-slate-400">Reserve B</span>
                  <span className="font-semibold">{formatNumber(reserveB)}</span>
                </div>
                <div className="flex items-center justify-between rounded-3xl border border-slate-700/50 bg-slate-950/60 px-4 py-4">
                  <span className="text-sm text-slate-400">Harga A → B</span>
                  <span className="font-semibold text-cyan-300">{formatNumber(priceAtoB)}</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-10 rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-sm shadow-slate-300/10 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-950/85">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Informasi Sistem</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">{message}</p>
            </div>
            <div className="flex items-center justify-end gap-3 text-sm text-slate-500 dark:text-slate-400">
              {hasContracts ? (
                <span>Kontrak DEX terpasang</span>
              ) : (
                <span>Alamat kontrak belum diatur</span>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
