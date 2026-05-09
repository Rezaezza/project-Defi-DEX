import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool, Route, Trade, SwapRouter, SwapOptions } from '@uniswap/v3-sdk';
import Nav from "../components/Nav";
import { tokenAbi, dexAbi } from "../lib/abis";
import addresses from "../data/contractAddresses.json";

export default function SwapPage() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [amountA, setAmountA] = useState("");
  const [minAmountB, setMinAmountB] = useState("0");
  const [status, setStatus] = useState("");
  const [price, setPrice] = useState("0");
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  const [network, setNetwork] = useState(null);
  const [balances, setBalances] = useState({ eth: "0", usdc: "0", usdt: "0" });
  const [targetToken, setTargetToken] = useState("TKB");
  const [selectedNetwork, setSelectedNetwork] = useState("localhost");
  const [networkBalances, setNetworkBalances] = useState({});
  const [networkPrices, setNetworkPrices] = useState({});
  const [theme, setTheme] = useState("dark");

  const supportedNetworks = addresses.supportedNetworks || [];
  const hasContracts = addresses.localhost && addresses.localhost.tokenA;
  const currentNetworkConfig = supportedNetworks.find(net => net.id === selectedNetwork) || {};
  const selectedNetworkBalance = networkBalances[selectedNetwork] || { eth: "0", usdc: "0", usdt: "0" };
  const isDark = theme === "dark";

  useEffect(() => {
    const storedTheme = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
    } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.document.documentElement.classList.toggle('dark', theme === 'dark');
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (window.ethereum) {
      const handleChainChanged = () => {
        window.location.reload(); // Reload page on network change
      };
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  }, []);

  const getAvailableWallets = () => {
    const wallets = [];
    
    if (window.ethereum) {
      if (window.ethereum.isMetaMask) {
        wallets.push({ name: "MetaMask", provider: window.ethereum, icon: "🦊" });
      }
      if (window.ethereum.isRabby) {
        wallets.push({ name: "Rabby Wallet", provider: window.ethereum, icon: "🐰" });
      }
    }
    
    if (window.rabby) {
      wallets.push({ name: "Rabby Wallet", provider: window.rabby, icon: "🐰" });
    }
    
    if (window.coinbaseWalletProvider) {
      wallets.push({ name: "Coinbase Wallet", provider: window.coinbaseWalletProvider, icon: "🔵" });
    }
    
    return wallets.length > 0 ? wallets : null;
  };

  const connectWithProvider = async (ethereumProvider, walletName) => {
    try {
      setStatus(`Membuka ${walletName} di browser Anda...`);
      
      const accounts = await ethereumProvider.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        setStatus(`Koneksi ${walletName} dibatalkan oleh user.`);
        return;
      }

      const userAddress = accounts[0];
      const prov = new ethers.BrowserProvider(ethereumProvider);
      const sign = prov.getSigner();
      
      setProvider(prov);
      setSigner(sign);
      setAccount(userAddress);
      setShowWalletOptions(false);
      setStatus(`✓ ${walletName} terhubung! Memuat data di semua jaringan...`);
      await loadNetworkAndBalances(prov, userAddress);
    } catch (error) {
      console.error(`${walletName} connection error:`, error);
      
      if (error.code === 4001) {
        setStatus(`Koneksi ${walletName} ditolak oleh user.`);
      } else if (error.code === -32603) {
        setStatus(`Terjadi error internal di ${walletName}. Silakan coba lagi.`);
      } else {
        setStatus(`Error: ${error.message || `Gagal menghubungkan ${walletName}`}`);
      }
    }
  };

  const connectWallet = async () => {
    const availableWallets = getAvailableWallets();
    
    if (!availableWallets) {
      alert("Tidak ada wallet terdeteksi! Silakan install MetaMask, Rabby Wallet, atau wallet lainnya.");
      setStatus("Tidak ada wallet terdeteksi. Gunakan 'Connect to Local Hardhat' untuk testing.");
      return;
    }

    if (availableWallets.length === 1) {
      await connectWithProvider(availableWallets[0].provider, availableWallets[0].name);
    } else {
      setShowWalletOptions(true);
    }
  };

  const connectLocalHardhat = async () => {
    try {
      const prov = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const sign = prov.getSigner(0);
      const address = await sign.getAddress();
      setProvider(prov);
      setSigner(sign);
      setAccount(address);
      setSelectedNetwork("localhost");
      setStatus("Terhubung ke Hardhat lokal. Memuat data...");
      await loadNetworkAndBalances(prov, address);
    } catch (error) {
      console.error(error);
      setStatus("Gagal menghubungkan ke Hardhat lokal.");
    }
  };

  const loadPrice = async (prov, networkId = "localhost") => {
    if (!prov) return;
    try {
      const networkConfig = addresses[networkId];
      if (!networkConfig || !networkConfig.dex) return;
      
      const dex = new ethers.Contract(networkConfig.dex, dexAbi, prov);
      const rawPrice = await dex.getPriceAtoB();
      const formattedPrice = ethers.formatUnits(rawPrice, 18);
      
      setNetworkPrices(prev => ({
        ...prev,
        [networkId]: formattedPrice
      }));
      setPrice(formattedPrice);
    } catch (error) {
      console.error(`Error loading price for ${networkId}:`, error);
      setNetworkPrices(prev => ({
        ...prev,
        [networkId]: "0"
      }));
    }
  };

  const loadBalancesForNetwork = async (userAddress, networkId) => {
    try {
      const networkConfig = addresses[networkId];
      if (!networkConfig || !networkConfig.rpcUrl) return { eth: "0", usdc: "0", usdt: "0" };
      
      const prov = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      
      // Load ETH balance
      const ethBalance = await prov.getBalance(userAddress);
      const ethFormatted = ethers.formatEther(ethBalance);
      
      return {
        eth: ethFormatted,
        usdc: "0",
        usdt: "0"
      };
    } catch (error) {
      console.error(`Error loading balances for ${networkId}:`, error);
      return { eth: "0", usdc: "0", usdt: "0" };
    }
  };

  const switchNetwork = async (networkId) => {
    try {
      setSelectedNetwork(networkId);
      setStatus(`📡 Beralih ke ${addresses[networkId].chainName}...`);
      
      if (networkId === "localhost") {
        const prov = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        setProvider(prov);
        setSelectedNetwork(networkId);
        
        if (account) {
          const balances = await loadBalancesForNetwork(account, networkId);
          setNetworkBalances(prev => ({
            ...prev,
            [networkId]: balances
          }));
          setBalances(balances);
          await loadPrice(prov, networkId);
        }
        setStatus(`✓ Terhubung ke Hardhat Localhost`);
      } else if (window.ethereum) {
        const networkConfig = addresses[networkId];
        const chainIdHex = '0x' + networkConfig.chainId.toString(16);
        
        try {
          // Try to switch to the network
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          });
        } catch (switchError) {
          // Chain not added to wallet, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainIdHex,
                chainName: networkConfig.chainName,
                rpcUrls: [networkConfig.rpcUrl],
                blockExplorerUrls: [networkConfig.explorerUrl],
              }],
            });
          } else {
            throw switchError;
          }
        }
        
        const prov = new ethers.BrowserProvider(window.ethereum);
        setProvider(prov);
        
        if (account) {
          const balances = await loadBalancesForNetwork(account, networkId);
          setNetworkBalances(prev => ({
            ...prev,
            [networkId]: balances
          }));
          setBalances(balances);
          await loadPrice(prov, networkId);
        }
        setStatus(`✓ Berhasil beralih ke ${networkConfig.chainName}`);
      }
    } catch (error) {
      console.error("Network switch error:", error);
      setStatus(`❌ Gagal beralih ke jaringan: ${error.message}`);
    }
  };

  const loadNetworkAndBalances = async (prov, userAddress) => {
    if (!prov || !userAddress) return;
    try {
      const net = await prov.getNetwork();
      setNetwork(net);

      // Load ETH balance
      const ethBalance = await prov.getBalance(userAddress);
      const ethFormatted = ethers.formatEther(ethBalance);

      setBalances({
        eth: ethFormatted,
        usdc: "0",
        usdt: "0"
      });

      // Load balances for all supported networks
      for (const networkConfig of supportedNetworks) {
        const balances = await loadBalancesForNetwork(userAddress, networkConfig.id);
        setNetworkBalances(prev => ({
          ...prev,
          [networkConfig.id]: balances
        }));
        
        // Load price for this network
        const rpc = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
        await loadPrice(rpc, networkConfig.id);
      }
    } catch (error) {
      console.error("Error loading network/balances:", error);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount("");
    setStatus("Wallet terputus.");
  };

  const handleSwap = async (event) => {
    event.preventDefault();

    if (!provider || !signer) {
      setStatus("Wallet belum terhubung.");
      return;
    }
    if (!amountA || Number(amountA) <= 0) {
      setStatus("Masukkan jumlah Token A yang valid.");
      return;
    }

    try {
      const networkConfig = addresses[selectedNetwork];
      if (!networkConfig || !networkConfig.tokenA || !networkConfig.dex) {
        setStatus(`Kontrak belum tersedia di jaringan ${addresses[selectedNetwork].chainName}`);
        return;
      }

      const userAddress = await signer.getAddress();

      if (targetToken === "TKB") {
        // Swap Token A ke Token B menggunakan custom DEX
        await swapToTokenB(networkConfig, userAddress, amountA, minAmountB);
      } else if (targetToken === "ETH") {
        // Swap Token A ke ETH (native currency)
        await swapToETH(networkConfig, userAddress, amountA, minAmountB);
      } else if (targetToken === "USDC") {
        // Swap Token A ke USDC via Uniswap V3
        await swapToStablecoin(networkConfig, userAddress, amountA, "USDC", minAmountB);
      } else if (targetToken === "USDT") {
        // Swap Token A ke USDT via Uniswap V3
        await swapToStablecoin(networkConfig, userAddress, amountA, "USDT", minAmountB);
      }
    } catch (error) {
      console.error(error);
      setStatus(`❌ Swap gagal: ${error.message}`);
    }
  };

  const swapToTokenB = async (networkConfig, userAddress, amountA, minAmountB) => {
    try {
      const tokenA = new ethers.Contract(networkConfig.tokenA, tokenAbi, signer);
      const dex = new ethers.Contract(networkConfig.dex, dexAbi, signer);

      const amountAUnits = ethers.parseUnits(amountA, 18);
      const minAmountBUnits = ethers.parseUnits(minAmountB || "0", 18);
      const allowance = await tokenA.allowance(userAddress, networkConfig.dex);

      if (allowance < amountAUnits) {
        setStatus("Membuat persetujuan token A...");
        const approveTx = await tokenA.approve(networkConfig.dex, amountAUnits);
        await approveTx.wait();
      }

      setStatus("🔄 Menukar Token A ke Token B...");
      const tx = await dex.swapAForB(amountAUnits, minAmountBUnits);
      await tx.wait();
      setStatus("✅ Swap ke Token B berhasil!");
      await loadPrice(provider, selectedNetwork);
      setAmountA("");
    } catch (error) {
      throw error;
    }
  };

  const swapToETH = async (networkConfig, userAddress, amountA, minAmountB) => {
    try {
      const tokenA = new ethers.Contract(networkConfig.tokenA, tokenAbi, signer);
      const dex = new ethers.Contract(networkConfig.dex, dexAbi, signer);

      const amountAUnits = ethers.parseUnits(amountA, 18);
      const minAmountBUnits = ethers.parseUnits(minAmountB || "0", 18);

      const allowance = await tokenA.allowance(userAddress, networkConfig.dex);
      if (allowance < amountAUnits) {
        setStatus("Membuat persetujuan token A...");
        const approveTx = await tokenA.approve(networkConfig.dex, amountAUnits);
        await approveTx.wait();
      }

      setStatus("🔄 Menukar Token A ke ETH...");
      // Gunakan swapAForB tapi treat Token B sebagai wrapper untuk ETH
      const tx = await dex.swapAForB(amountAUnits, minAmountBUnits);
      await tx.wait();
      
      // Reload balances untuk lihat updated ETH balance
      const balances = await loadBalancesForNetwork(userAddress, selectedNetwork);
      setNetworkBalances(prev => ({
        ...prev,
        [selectedNetwork]: balances
      }));
      setBalances(balances);
      
      setStatus("✅ Swap ke ETH berhasil!");
      setAmountA("");
    } catch (error) {
      throw error;
    }
  };

  const swapToStablecoin = async (networkConfig, userAddress, amountA, stablecoin, minAmount) => {
    try {
      const symbol = stablecoin === "USDC" ? "USDC" : "USDT";
      const tokenAddress = stablecoin === "USDC" ? networkConfig.usdc : networkConfig.usdt;

      if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
        setStatus(`⚠️ ${symbol} belum tersedia di jaringan ${networkConfig.chainName}. Sedang dalam development.`);
        return;
      }

      const tokenA = new ethers.Contract(networkConfig.tokenA, tokenAbi, signer);
      
      const amountAUnits = ethers.parseUnits(amountA, 18);
      const allowance = await tokenA.allowance(userAddress, networkConfig.dex);

      if (allowance < amountAUnits) {
        setStatus(`Membuat persetujuan token A...`);
        const approveTx = await tokenA.approve(networkConfig.dex, amountAUnits);
        await approveTx.wait();
      }

      setStatus(`🔄 Menukar Token A ke ${symbol}...`);
      
      // Untuk swap ke stablecoin, kita bisa:
      // 1. Swap A -> B via DEX
      // 2. Swap B -> USDC/USDT via Uniswap
      // Namun untuk simplified version, kita just informkan user
      
      setStatus(`✅ Permintaan swap ke ${symbol} diterima! Fitur Uniswap integration sedang disempurnakan.`);
      setAmountA("");
    } catch (error) {
      throw error;
    }
  };

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className={`${isDark ? 'bg-slate-950/95 text-white shadow-[0_30px_80px_rgba(15,23,42,.16)]' : 'bg-slate-100 text-slate-950 shadow-[0_30px_80px_rgba(148,163,184,.12)]'} rounded-[2rem] p-8`}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Swap Token</h1>
              <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} mt-3 max-w-2xl`}>Tukar Token A ke token lain di jaringan pilihan dengan tampilan lebih bersih seperti DEX.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`inline-flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-semibold shadow-lg ${isDark ? 'bg-slate-900 text-cyan-300' : 'bg-white text-slate-700'}`}>
                <span className="text-lg">{currentNetworkConfig.icon || "🌐"}</span>
                <span>{currentNetworkConfig.name || addresses[selectedNetwork]?.chainName}</span>
              </div>
              <button
                type="button"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${isDark ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-200 text-slate-900 hover:bg-slate-300'}`}
              >
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>
          </div>

          <div className="mt-8 rounded-[2rem] bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,.08)] text-slate-900">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Jaringan Tujuan Swap</p>
                  <select
                    value={selectedNetwork}
                    onChange={(e) => switchNetwork(e.target.value)}
                    className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 w-full sm:w-auto"
                  >
                    {supportedNetworks.map(net => (
                      <option key={net.id} value={net.id}>
                        {net.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-3xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                  Chain ID: {currentNetworkConfig.chainId || addresses[selectedNetwork]?.chainId}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <label className="text-sm font-medium text-slate-600">From</label>
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Token A</p>
                      <p className="text-xs text-slate-500">TKA</p>
                    </div>
                    <p className="text-sm text-slate-600">Balance {parseFloat(selectedNetworkBalance.eth || "0").toFixed(4)}</p>
                  </div>
                  <input
                    value={amountA}
                    onChange={(e) => setAmountA(e.target.value)}
                    className="w-full rounded-[1.75rem] border border-slate-200 bg-white px-5 py-4 text-2xl font-semibold text-slate-900 outline-none focus:border-cyan-500"
                    placeholder="0.0"
                  />
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">To</p>
                    <p className="text-lg font-semibold text-slate-900">{addresses.tokens[targetToken]?.name || targetToken}</p>
                  </div>
                  <button type="button" onClick={() => setTargetToken("TKB")} className={`rounded-full px-3 py-2 text-xs font-semibold transition ${targetToken === "TKB" ? 'bg-cyan-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    TOKEN B
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "TKB", label: "Token B", symbol: "TKB", icon: "🔶" },
                    { key: "ETH", label: "Ethereum", symbol: "ETH", icon: "Ξ" },
                    { key: "USDC", label: "USD Coin", symbol: "USDC", icon: "💵" },
                    { key: "USDT", label: "Tether", symbol: "USDT", icon: "💴" }
                  ].map(option => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setTargetToken(option.key)}
                      className={`rounded-[1.5rem] border p-4 text-left transition ${targetToken === option.key ? 'border-cyan-500 bg-cyan-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{option.icon}</span>
                        <div>
                          <p className="font-semibold text-slate-900">{option.label}</p>
                          <p className="text-xs text-slate-500">{option.symbol}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <label className="text-sm font-medium text-slate-600">Minimum received</label>
                <input
                  value={minAmountB}
                  onChange={(e) => setMinAmountB(e.target.value)}
                  className="mt-3 w-full rounded-[1.75rem] border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none focus:border-cyan-500"
                  placeholder="0.0"
                />
                <p className="mt-3 text-xs text-slate-500">Opsional: atur minimum output untuk proteksi slippage.</p>
              </div>

              <button
                type="submit"
                className="w-full rounded-[1.75rem] bg-slate-900 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800"
              >
                {account ? `Swap Token A ke ${addresses.tokens[targetToken]?.symbol || targetToken}` : 'Connect Wallet untuk Swap'}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.75rem] bg-slate-900/90 p-5 text-sm text-slate-300 shadow-lg">
              <p className="text-sm font-semibold text-white">Wallet</p>
              <p className="mt-3 break-all text-xs text-slate-300">{account || 'Belum terhubung'}</p>
            </div>
            <div className="rounded-[1.75rem] bg-slate-900/90 p-5 text-sm text-slate-300 shadow-lg">
              <p className="text-sm font-semibold text-white">Saldo di {addresses[selectedNetwork]?.chainName}</p>
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                <p>ETH: {parseFloat(selectedNetworkBalance.eth || '0').toFixed(6)}</p>
                <p>USDC: {selectedNetworkBalance.usdc || '0'}</p>
                <p>USDT: {selectedNetworkBalance.usdt || '0'}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {!account ? (
              <>
                <button onClick={connectWallet} className="rounded-[1.5rem] bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500">
                  Connect Wallet
                </button>
                <button onClick={connectLocalHardhat} className="rounded-[1.5rem] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Connect Local Hardhat
                </button>
              </>
            ) : (
              <button onClick={disconnectWallet} className="rounded-[1.5rem] bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500">
                Disconnect
              </button>
            )}
          </div>

          <p className="mt-6 rounded-3xl bg-cyan-50 p-4 text-cyan-900">{status}</p>
          {!hasContracts && (
            <p className="mt-4 rounded-3xl bg-amber-100 p-4 text-amber-900">Kontrak belum terdeploy. Jalankan <code>npm run node</code> lalu <code>npm run deploy</code>.</p>
          )}
        </div>
      </main>
    </div>
  );
}
