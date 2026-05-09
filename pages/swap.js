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
  const [targetToken, setTargetToken] = useState("TKB"); // TKB, USDC, USDT

  const hasContracts = addresses.tokenA && addresses.tokenB && addresses.dex;

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
      setStatus(`✓ ${walletName} terhubung! Siap untuk swap.`);
      await loadPrice(prov);
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
      setStatus("Terhubung ke Hardhat lokal.");
      await loadPrice(prov);
      await loadNetworkAndBalances(prov, address);
    } catch (error) {
      console.error(error);
      setStatus("Gagal menghubungkan ke Hardhat lokal.");
    }
  };

  const loadPrice = async (prov) => {
    if (!hasContracts || !prov) return;
    try {
      const dex = new ethers.Contract(addresses.dex, dexAbi, prov);
      const rawPrice = await dex.getPriceAtoB();
      setPrice(ethers.formatUnits(rawPrice, 18));
    } catch (error) {
      console.error(error);
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

      // For demo, set USDC/USDT to 0 since we don't have contracts
      // In real DEX, you'd load from actual token contracts
      setBalances({
        eth: ethFormatted,
        usdc: "0", // Placeholder
        usdt: "0"  // Placeholder
      });
    } catch (error) {
      console.error("Error loading network/balances:", error);
    }
  };

  const switchToMainnet = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }], // Ethereum mainnet
      });
      // Reload network and balances after switch
      const prov = new ethers.BrowserProvider(window.ethereum);
      const userAddress = await prov.getSigner().getAddress();
      await loadNetworkAndBalances(prov, userAddress);
      setStatus("Berhasil switch ke Ethereum Mainnet.");
    } catch (error) {
      console.error(error);
      setStatus("Gagal switch network.");
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
      const userAddress = await signer.getAddress();

      if (targetToken === "TKB") {
        // Swap using custom DEX
        const tokenA = new ethers.Contract(addresses.tokenA, tokenAbi, signer);
        const dex = new ethers.Contract(addresses.dex, dexAbi, signer);

        const amountAUnits = ethers.parseUnits(amountA, 18);
        const minAmountBUnits = ethers.parseUnits(minAmountB || "0", 18);
        const allowance = await tokenA.allowance(userAddress, addresses.dex);

        if (allowance < amountAUnits) {
          setStatus("Membuat persetujuan token A...");
          const approveTx = await tokenA.approve(addresses.dex, amountAUnits);
          await approveTx.wait();
        }

        setStatus("Menukar Token A ke Token B...");
        const tx = await dex.swapAForB(amountAUnits, minAmountBUnits);
        await tx.wait();
        setStatus("Swap berhasil! Cek saldo Anda di halaman Home.");
        await loadPrice(provider);
      } else if (targetToken === "USDC" || targetToken === "USDT") {
        if (network.chainId !== 1) {
          setStatus(`Untuk swap ke ${targetToken}, silakan switch ke Ethereum Mainnet terlebih dahulu.`);
          return;
        }
        // Placeholder for Uniswap swap
        setStatus(`Swap ke ${targetToken} menggunakan Uniswap sedang dalam pengembangan. Fitur ini akan segera hadir.`);
      }
    } catch (error) {
      console.error(error);
      setStatus("Swap gagal. Pastikan Anda memiliki token dan jaringan yang benar.");
    }
  };

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Swap Token</h1>
          <p className="mt-3 text-slate-600">Tukar Token A (TKA) menjadi Token B (TKB) menggunakan simple DEX.</p>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Harga saat ini:</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">1 TKA ≈ {price || "0"} TKB</p>
          </div>

          {network && (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Jaringan:</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{network.name} (Chain ID: {network.chainId})</p>
            </div>
          )}

          {account && (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Saldo di Jaringan:</p>
              <div className="mt-2 space-y-1">
                <p className="text-slate-900">ETH: {parseFloat(balances.eth).toFixed(4)}</p>
                <p className="text-slate-900">USDC: {balances.usdc}</p>
                <p className="text-slate-900">USDT: {balances.usdt}</p>
              </div>
              {network && network.chainId !== 1 && (targetToken === "USDC" || targetToken === "USDT") && (
                <button
                  onClick={() => switchToMainnet()}
                  className="mt-3 rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-500"
                >
                  Switch to Ethereum Mainnet
                </button>
              )}
            </div>
          )}

          {showWalletOptions && (
            <div className="mt-6 rounded-3xl bg-white p-8 shadow-sm border-2 border-cyan-500">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">Pilih Wallet</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {getAvailableWallets()?.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={() => connectWithProvider(wallet.provider, wallet.name)}
                    className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-500 hover:bg-cyan-50"
                  >
                    <span className="text-2xl">{wallet.icon}</span>
                    <div className="text-left">
                      <p className="font-semibold text-slate-900">{wallet.name}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowWalletOptions(false)}
                className="mt-4 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-2 text-slate-700 transition hover:bg-slate-200"
              >
                Batal
              </button>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSwap}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Jumlah Token A (TKA)</label>
              <input
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500"
                placeholder="Contoh: 5"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Token Tujuan</label>
              <select
                value={targetToken}
                onChange={(e) => setTargetToken(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500"
              >
                <option value="TKB">Token B (TKB)</option>
                <option value="USDC">USDC</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Minimum Token B yang diterima</label>
              <input
                value={minAmountB}
                onChange={(e) => setMinAmountB(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500"
                placeholder="Contoh: 4.5"
              />
            </div>
            <button type="submit" className="w-full rounded-2xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-700">
              Swap sekarang
            </button>
          </form>

          <div className="mt-6 rounded-3xl bg-slate-50 p-5 text-slate-700">
            <p className="text-sm">Akun Wallet:</p>
            <p className="mt-2 break-all text-slate-900">{account || "Belum terhubung"}</p>
            <p className="mt-4 text-sm text-slate-500">Alamat kontrak DEX: {addresses.dex || "Belum tersedia"}</p>
            <div className="mt-4 flex gap-2 flex-wrap">
              {!account ? (
                <>
                  <button onClick={connectWallet} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700">
                    Connect Wallet
                  </button>
                  <button onClick={connectLocalHardhat} className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm text-white transition hover:bg-cyan-500">
                    Connect Local Hardhat
                  </button>
                </>
              ) : (
                <button onClick={disconnectWallet} className="rounded-2xl bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-500">
                  Disconnect
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 rounded-2xl bg-cyan-50 p-4 text-cyan-900">{status}</p>
          {!hasContracts && (
            <p className="mt-4 rounded-2xl bg-amber-100 p-4 text-amber-900">Kontrak belum terdeploy. Jalankan <code>npm run node</code> lalu <code>npm run deploy</code>.</p>
          )}
        </div>
      </main>
    </div>
  );
}
