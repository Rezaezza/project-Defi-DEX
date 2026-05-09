import { useEffect, useState } from "react";
import { ethers } from "ethers";
import Nav from "../components/Nav";
import { tokenAbi, dexAbi } from "../lib/abis";
import addresses from "../data/contractAddresses.json";

function formatNumber(value) {
  return Number(value).toFixed(4);
}

export default function Home() {
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
  const [showWalletOptions, setShowWalletOptions] = useState(false);

  const hasContracts = addresses.tokenA && addresses.tokenB && addresses.dex;

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
      setMessage(`Membuka ${walletName} di browser Anda...`);
      
      const accounts = await ethereumProvider.request({
        method: "eth_requestAccounts",
      });

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
      setShowWalletOptions(false);
      setMessage(`✓ ${walletName} terhubung! Memuat data...`);
      
      await loadData(prov, userAddress);
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
      // Jika hanya ada 1 wallet, langsung connect
      await connectWithProvider(availableWallets[0].provider, availableWallets[0].name);
    } else {
      // Jika ada lebih dari 1 wallet, tampilkan pilihan
      setShowWalletOptions(true);
    }
  };

  const connectLocalHardhat = async () => {
    try {
      setMessage("Menghubungkan ke Hardhat lokal...");
      const prov = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const sign = prov.getSigner(0); // Gunakan akun pertama Hardhat
      const address = await sign.getAddress();
      setProvider(prov);
      setSigner(sign);
      setAccount(address);
      setIsConnected(true);
      setMessage("Terhubung ke Hardhat lokal. Memuat data...");
      await loadData(prov, address);
    } catch (error) {
      console.error("Hardhat connection error:", error);
      setMessage("Gagal menghubungkan ke Hardhat lokal. Pastikan 'npx hardhat node' berjalan.");
    }
  };

  const loadData = async (provider, userAddress) => {
    if (!hasContracts) {
      return;
    }

    try {
      const tokenA = new ethers.Contract(addresses.tokenA, tokenAbi, provider);
      const tokenB = new ethers.Contract(addresses.tokenB, tokenAbi, provider);
      const dex = new ethers.Contract(addresses.dex, dexAbi, provider);

      const [rawA, rawB] = await Promise.all([
        tokenA.balanceOf(userAddress),
        tokenB.balanceOf(userAddress)
      ]);

      const [reserveAResult, priceResult] = await Promise.all([
        dex.getReserves(),
        dex.getPriceAtoB()
      ]);

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
    if (!hasContracts) {
      return;
    }

    try {
      const prov = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const dex = new ethers.Contract(addresses.dex, dexAbi, prov);

      const [reserveAResult, priceResult] = await Promise.all([
        dex.getReserves(),
        dex.getPriceAtoB()
      ]);

      setReserveA(ethers.formatUnits(reserveAResult[0], 18));
      setReserveB(ethers.formatUnits(reserveAResult[1], 18));
      setPriceAtoB(ethers.formatUnits(priceResult, 18));
    } catch (error) {
      console.error("Gagal memuat data publik:", error);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      loadPublicData(); // Load reserves dan price tanpa connect
    }
  }, []);

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-8 rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Simple DEX</h1>
          <p className="mt-3 text-slate-600">Aplikasi DEX sederhana menggunakan Next.js, Tailwind CSS, Hardhat, dan Solidity.</p>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Alamat akun</p>
              <p className="mt-1 font-medium text-slate-800">{account || "Belum terhubung"}</p>
              {isConnected && (
                <p className="mt-1 text-sm text-green-600">✓ Terhubung</p>
              )}
            </div>
            <div className="flex gap-2">
              {!isConnected ? (
                <>
                  <button onClick={connectWallet} className="rounded-2xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-700">
                    Connect Wallet
                  </button>
                  <button onClick={connectLocalHardhat} className="rounded-2xl bg-cyan-600 px-6 py-3 text-white transition hover:bg-cyan-500">
                    Connect Local Hardhat
                  </button>
                </>
              ) : (
                <button onClick={disconnectWallet} className="rounded-2xl bg-red-600 px-6 py-3 text-white transition hover:bg-red-500">
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </section>

        {showWalletOptions && (
          <section className="mb-8 rounded-3xl bg-white p-8 shadow-sm border-2 border-cyan-500">
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
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Saldo Token</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Token A (TKA)</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(balanceA)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Token B (TKB)</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(balanceB)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Harga & Likuiditas</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Reserve Token A</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(reserveA)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Reserve Token B</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(reserveB)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-cyan-50 p-4">
                <p className="text-sm text-slate-500">Harga Token A ke Token B</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatNumber(priceAtoB)} TKB</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Status</h2>
          <p className="mt-3 text-slate-600">{message}</p>
          {!hasContracts && (
            <p className="mt-3 rounded-2xl bg-amber-100 p-4 text-amber-900">
              Belum ada alamat kontrak. Jalankan <code className="rounded bg-slate-100 px-2 py-1">npm run node</code> lalu <code className="rounded bg-slate-100 px-2 py-1">npm run deploy</code>.
            </p>
          )}
          {typeof window !== 'undefined' && !window.ethereum && (
            <p className="mt-3 rounded-2xl bg-blue-100 p-4 text-blue-900">
              MetaMask tidak terdeteksi. Gunakan <strong>Connect to Local Hardhat</strong> untuk testing di Codespaces.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
