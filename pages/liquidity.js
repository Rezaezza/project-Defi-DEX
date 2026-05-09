import { useState, useEffect } from "react";
import { ethers } from "ethers";
import Nav from "../components/Nav";
import { tokenAbi, dexAbi } from "../lib/abis";
import addresses from "../data/contractAddresses.json";

export default function LiquidityPage() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [removeAmount, setRemoveAmount] = useState("");
  const [liquidity, setLiquidity] = useState("0");
  const [status, setStatus] = useState("");
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
      setStatus(`✓ ${walletName} terhubung! Siap untuk add/remove liquidity.`);
      await loadLiquidity(prov, userAddress);
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
      await loadLiquidity(prov, address);
    } catch (error) {
      console.error(error);
      setStatus("Gagal menghubungkan ke Hardhat lokal.");
    }
  };

  const loadLiquidity = async (prov, userAddress) => {
    if (!hasContracts || !prov) return;
    try {
      const dex = new ethers.Contract(addresses.dex, dexAbi, prov);
      const rawLiquidity = await dex.liquidity(userAddress);
      setLiquidity(ethers.formatUnits(rawLiquidity, 18));
    } catch (error) {
      console.error(error);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount("");
    setStatus("Wallet terputus.");
  };

  const handleAddLiquidity = async (event) => {
    event.preventDefault();
    if (!provider || !signer) {
      setStatus("Wallet belum terhubung.");
      return;
    }
    if (!amountA || !amountB || Number(amountA) <= 0 || Number(amountB) <= 0) {
      setStatus("Masukkan jumlah Token A dan Token B yang valid.");
      return;
    }

    try {
      const userAddress = await signer.getAddress();
      const tokenA = new ethers.Contract(addresses.tokenA, tokenAbi, signer);
      const tokenB = new ethers.Contract(addresses.tokenB, tokenAbi, signer);
      const dex = new ethers.Contract(addresses.dex, dexAbi, signer);

      const amountAUnits = ethers.parseUnits(amountA, 18);
      const amountBUnits = ethers.parseUnits(amountB, 18);

      const allowanceA = await tokenA.allowance(userAddress, addresses.dex);
      const allowanceB = await tokenB.allowance(userAddress, addresses.dex);

      if (allowanceA < amountAUnits) {
        const approveA = await tokenA.approve(addresses.dex, amountAUnits);
        await approveA.wait();
      }
      if (allowanceB < amountBUnits) {
        const approveB = await tokenB.approve(addresses.dex, amountBUnits);
        await approveB.wait();
      }

      setStatus("Menambahkan likuiditas...");
      const tx = await dex.addLiquidity(amountAUnits, amountBUnits);
      await tx.wait();
      setStatus("Likuiditas berhasil ditambahkan.");
      await loadLiquidity(provider, userAddress);
    } catch (error) {
      console.error(error);
      setStatus("Gagal menambahkan likuiditas. Pastikan rasio A:B sesuai.");
    }
  };

  const handleRemoveLiquidity = async (event) => {
    event.preventDefault();
    if (!provider || !signer) {
      setStatus("Wallet belum terhubung.");
      return;
    }
    if (!removeAmount || Number(removeAmount) <= 0) {
      setStatus("Masukkan jumlah likuiditas yang valid untuk dihapus.");
      return;
    }

    try {
      const userAddress = await signer.getAddress();
      const dex = new ethers.Contract(addresses.dex, dexAbi, signer);

      const removeUnits = ethers.parseUnits(removeAmount, 18);
      setStatus("Menghapus likuiditas...");
      const tx = await dex.removeLiquidity(removeUnits);
      await tx.wait();
      setStatus("Likuiditas berhasil dihapus.");
      await loadLiquidity(provider, userAddress);
    } catch (error) {
      console.error(error);
      setStatus("Gagal menghapus likuiditas. Pastikan jumlah likuiditas Anda cukup.");
    }
  };

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Liquidity</h1>
          <p className="mt-3 text-slate-600">Tambah atau hapus likuiditas untuk Token A (TKA) dan Token B (TKB).</p>

          {showWalletOptions && (
            <div className="mt-6 rounded-3xl bg-slate-50 p-6 border-2 border-cyan-500">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">Pilih Wallet</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {getAvailableWallets()?.map((wallet) => (
                  <button
                    key={wallet.name}
                    onClick={() => connectWithProvider(wallet.provider, wallet.name)}
                    className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 transition hover:border-cyan-500 hover:bg-cyan-50"
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

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Tambah Likuiditas</h2>
              <form className="space-y-4" onSubmit={handleAddLiquidity}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Token A (TKA)</label>
                  <input
                    value={amountA}
                    onChange={(e) => setAmountA(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500"
                    placeholder="Contoh: 10"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Token B (TKB)</label>
                  <input
                    value={amountB}
                    onChange={(e) => setAmountB(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500"
                    placeholder="Contoh: 10"
                  />
                </div>
                <button type="submit" className="w-full rounded-2xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-700">
                  Tambah Likuiditas
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">Hapus Likuiditas</h2>
              <form className="space-y-4" onSubmit={handleRemoveLiquidity}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Jumlah likuiditas</label>
                  <input
                    value={removeAmount}
                    onChange={(e) => setRemoveAmount(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500"
                    placeholder="Contoh: 5"
                  />
                </div>
                <button type="submit" className="w-full rounded-2xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-700">
                  Hapus Likuiditas
                </button>
              </form>
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-slate-50 p-6 text-slate-700">
            <p className="text-sm">Saldo likuiditas Anda:</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{liquidity}</p>
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
