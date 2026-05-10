import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import Nav from "../components/Nav";
import { tokenAbi, uniswapRouterAbi } from "../lib/abis";
import addresses from "../data/contractAddresses.json";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEADLINE_SECONDS = 300;
const ROUTER_FEE = 3000;

const formatDisplay = (value, decimals = 18) => {
  if (value === null || value === undefined) return "0";
  try {
    const formatted = Number(ethers.formatUnits(value, decimals));
    if (Number.isNaN(formatted)) return "0";
    return formatted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  } catch {
    return "0";
  }
};

const isValidAddress = (address) => {
  return typeof address === "string" && address !== "" && address !== ZERO_ADDRESS;
};

const getShortAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const buildSwapPath = (tokenIn, tokenOut) => {
  if (!tokenIn || !tokenOut) return null;
  return {
    tokenIn,
    tokenOut,
    fee: ROUTER_FEE,
    recipient: null,
    deadline: Math.floor(Date.now() / 1000) + DEADLINE_SECONDS,
    amountIn: null,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };
};

export default function SwapPage() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [networkName, setNetworkName] = useState("");
  const [selectedNetworkId, setSelectedNetworkId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedNetworkId") || "baseSepolia";
    }
    return "baseSepolia";
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [toasts, setToasts] = useState([]);
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [priceImpact, setPriceImpact] = useState("—");
  const [estimatedGas, setEstimatedGas] = useState(null);
  const [allowance, setAllowance] = useState("0");
  const [fromTokenKey, setFromTokenKey] = useState("ETH");
  const [toTokenKey, setToTokenKey] = useState("USDC");
  const [balances, setBalances] = useState({ ETH: "0", USDC: "0", USDT: "0", TKA: "0", TKB: "0" });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const networkConfig = addresses[selectedNetworkId] || {};
  const currentNetwork = useMemo(
    () => addresses.supportedNetworks?.find((net) => net.id === selectedNetworkId) || {},
    [selectedNetworkId]
  );

  const tokenOptions = useMemo(() => {
    const tokens = [
      { key: "ETH", label: `${currentNetwork.icon} ${currentNetwork.name} ETH`, symbol: "ETH", decimals: 18, icon: "Ξ", isNative: true, address: ZERO_ADDRESS },
      { key: "USDC", label: `${currentNetwork.icon} ${currentNetwork.name} USDC`, symbol: "USDC", decimals: 6, icon: "💵", address: networkConfig.usdc || ZERO_ADDRESS, isNative: false },
      { key: "USDT", label: `${currentNetwork.icon} ${currentNetwork.name} USDT`, symbol: "USDT", decimals: 6, icon: "💴", address: networkConfig.usdt || ZERO_ADDRESS, isNative: false },
    ];
    if (isValidAddress(networkConfig.tokenA)) {
      tokens.push({ key: "TKA", label: `${currentNetwork.icon} ${currentNetwork.name} TKA`, symbol: "TKA", decimals: 18, icon: "🔷", address: networkConfig.tokenA, isNative: false });
    }
    if (isValidAddress(networkConfig.tokenB)) {
      tokens.push({ key: "TKB", label: `${currentNetwork.icon} ${currentNetwork.name} TKB`, symbol: "TKB", decimals: 18, icon: "🔶", address: networkConfig.tokenB, isNative: false });
    }
    return tokens;
  }, [networkConfig, currentNetwork]);

  const fromToken = tokenOptions.find((token) => token.key === fromTokenKey) || tokenOptions[0];
  const toToken = tokenOptions.find((token) => token.key === toTokenKey) || tokenOptions[1];

  const connected = Boolean(account && signer);
  const onSelectedNetwork = chainId === currentNetwork.chainId;
  const needsSwitchNetwork = connected && !onSelectedNetwork;
  const hasRouter = isValidAddress(networkConfig.uniswapRouter);
  const hasNativeBaseBalance = Boolean(balances.ETH && balances.ETH !== "0");
  const fromBalance = parseFloat(balances[fromToken.key] || "0");
  const inputAmount = parseFloat(amountIn || "0");
  const readyToSwap = connected && hasRouter && onSelectedNetwork && fromToken.key !== toToken.key && inputAmount > 0 && inputAmount <= fromBalance;
  const needsApprove = !fromToken.isNative && connected && readyToSwap && parseFloat(allowance || "0") < inputAmount;
  const swapButtonLabel = needsApprove ? "Approve" : "Swap";

  const addToast = (type, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 4200);
  };

  const loadProviderBalances = async (userAddress, useRpcFallback = false) => {
    if (!userAddress || !ethers.isAddress(userAddress)) {
      console.warn("⚠️  Invalid wallet address:", userAddress);
      return { ETH: "0", USDC: "0", USDT: "0", TKA: "0", TKB: "0" };
    }

    setIsLoadingBalances(true);
    console.log("📊 Loading balances for address:", userAddress);
    console.log("   ChainId:", chainId, "SelectedNetwork:", selectedNetworkId);
    console.log("   RPC URL:", networkConfig.rpcUrl);

    const getBalanceWithTimeout = async (provider, address, timeoutMs = 8000) => {
      return Promise.race([
        provider.getBalance(address),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Balance fetch timeout")), timeoutMs)
        )
      ]);
    };

    const getTokenBalanceWithTimeout = async (contract, address, timeoutMs = 8000) => {
      return Promise.race([
        contract.balanceOf(address),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Token balance fetch timeout")), timeoutMs)
        )
      ]);
    };

    try {
      // Determine which provider to use
      let baseProvider;
      let providerType = "unknown";
      
      if (useRpcFallback || !provider) {
        console.log("   Using JsonRpcProvider (public RPC)");
        baseProvider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
        providerType = "JsonRpcProvider";
      } else {
        console.log("   Using BrowserProvider (MetaMask)")
        baseProvider = provider;
        providerType = "BrowserProvider";
      }

      // Validate provider is ready
      if (!baseProvider) {
        throw new Error("Provider not available");
      }

      // Get ETH balance with retry logic
      console.log("   🔄 Fetching ETH balance with", providerType);
      let ethBalance;
      let ethRetries = 0;
      
      while (ethRetries < 2) {
        try {
          ethBalance = await getBalanceWithTimeout(baseProvider, userAddress, 8000);
          console.log("   ✓ ETH raw balance:", ethBalance.toString());
          break;
        } catch (balanceError) {
          ethRetries++;
          console.warn(`   ⚠️  ETH balance fetch attempt ${ethRetries} failed:`, balanceError.message);
          
          if (ethRetries < 2 && useRpcFallback === false && provider) {
            // Try fallback to RPC if BrowserProvider fails
            console.log("   🔄 Retrying with public RPC...");
            baseProvider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
            providerType = "JsonRpcProvider (fallback)";
          } else if (ethRetries >= 2) {
            throw balanceError;
          }
        }
      }

      const formattedEth = ethers.formatEther(ethBalance);
      console.log("   ✓ ETH formatted:", formattedEth);

      const tokenBalances = { ETH: formattedEth, USDC: "0", USDT: "0", TKA: "0", TKB: "0" };

      // Get ERC20 token balances
      for (const token of tokenOptions) {
        if (token.isNative) continue;
        if (!isValidAddress(token.address)) {
          console.log(`   ⊘ ${token.symbol}: Invalid address`);
          continue;
        }

        try {
          console.log(`   🔄 Fetching ${token.symbol} at ${token.address.slice(0, 10)}...`);
          const tokenContract = new ethers.Contract(token.address, tokenAbi, baseProvider);
          const rawBalance = await getTokenBalanceWithTimeout(tokenContract, userAddress, 6000);
          const formattedBalance = ethers.formatUnits(rawBalance, token.decimals);
          tokenBalances[token.key] = formattedBalance;
          console.log(`   ✓ ${token.symbol}: ${formattedBalance}`);
        } catch (tokenError) {
          console.warn(`   ⚠️  ${token.symbol} balance fetch failed:`, tokenError.message);
          tokenBalances[token.key] = "0";
        }
      }

      console.log("✅ Balance loading complete:", tokenBalances);
      setBalances(tokenBalances);
      return tokenBalances;
    } catch (error) {
      console.error("❌ Failed to load balances:", error.message);
      setBalances({ ETH: "0", USDC: "0", USDT: "0", TKA: "0", TKB: "0" });
      return { ETH: "0", USDC: "0", USDT: "0", TKA: "0", TKB: "0" };
    } finally {
      setIsLoadingBalances(false);
    }
  };

  const loadAllowance = async () => {
    if (!connected || fromToken.isNative || !isValidAddress(fromToken.address) || !hasRouter) {
      setAllowance("0");
      return;
    }

    try {
      const tokenContract = new ethers.Contract(fromToken.address, tokenAbi, provider);
      const currentAllowance = await tokenContract.allowance(account, networkConfig.uniswapRouter);
      setAllowance(Number(ethers.formatUnits(currentAllowance, fromToken.decimals)).toString());
    } catch (error) {
      console.error("Allowance fetch failed:", error);
      setAllowance("0");
    }
  };

  const connectWallet = async (requestAccounts = true) => {
    if (typeof window === "undefined" || !window.ethereum) {
      setStatusMessage("MetaMask tidak terdeteksi. Silakan install MetaMask.");
      addToast("error", "MetaMask tidak ditemukan.");
      return;
    }

    try {
      setIsConnecting(true);
      setErrorMessage("");
      const accounts = await window.ethereum.request({ method: requestAccounts ? "eth_requestAccounts" : "eth_accounts" });
      if (!accounts || accounts.length === 0) {
        setStatusMessage("Pengguna belum memilih akun.");
        return;
      }

      const activeAccount = accounts[0];
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = await web3Provider.getSigner();
      const network = await web3Provider.getNetwork();
      const walletAddress = await signerInstance.getAddress();

      console.log("🔗 Connected wallet address:", walletAddress);
      console.log("   ChainId:", Number(network.chainId));
      console.log("   Network Name:", network.name);

      setProvider(web3Provider);
      setSigner(signerInstance);
      setAccount(walletAddress);
      setChainId(Number(network.chainId));
      setNetworkName(network.name || "Unknown");
      setStatusMessage(`Connected: ${getShortAddress(walletAddress)} (${network.name || network.chainId})`);
      addToast("success", "Wallet terhubung.");
      
      // Load balances immediately using BrowserProvider
      // IMPORTANT: Pass web3Provider directly, do NOT rely on state which hasn't updated yet
      console.log("🔄 Loading balances immediately after connect...");
      const netConfig = addresses[selectedNetworkId] || {};
      await loadProviderBalances(walletAddress, false, netConfig.rpcUrl, selectedNetworkId);
    } catch (error) {
      console.error("Wallet connect failed:", error);
      setErrorMessage(error?.message || "Gagal menghubungkan wallet.");
      addToast("error", error?.message || "Gagal menghubungkan wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToSelectedNetwork = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      setIsSwitching(true);
      setIsLoadingBalances(true);
      const chainHex = `0x${currentNetwork.chainId.toString(16)}`;
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
      addToast("success", `Switch to ${currentNetwork.name} berhasil.`);
      // Balances will be loaded via handleChainChanged
    } catch (error) {
      setIsLoadingBalances(false);
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: chainHex,
              chainName: currentNetwork.name,
              rpcUrls: [currentNetwork.rpcUrl],
              blockExplorerUrls: [currentNetwork.explorerUrl],
            }],
          });
          addToast("success", `${currentNetwork.name} berhasil ditambahkan ke wallet.`);
        } catch (innerError) {
          console.error("Add chain failed:", innerError);
          setErrorMessage(`Gagal menambahkan ${currentNetwork.name} ke wallet.`);
        }
      } else {
        console.error("Switch chain failed:", error);
        setErrorMessage("Gagal switch network. Pastikan MetaMask terinstal.");
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (!accounts || accounts.length === 0) {
      setAccount("");
      setSigner(null);
      setProvider(null);
      setStatusMessage("MetaMask disconnected.");
      addToast("info", "Akun MetaMask diputuskan.");
      return;
    }
    const newAccount = accounts[0];
    setAccount(newAccount);
    if (provider) {
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      setNetworkName(network.name || "Unknown");
      const signerInstance = await provider.getSigner();
      const walletAddress = await signerInstance.getAddress();
      console.log("Account changed to:", walletAddress);
      setSigner(signerInstance);
    }
    addToast("info", "Akun MetaMask berubah.");
    await loadProviderBalances(newAccount, chainId !== currentNetwork.chainId);
  };

  const handleChainChanged = async (chainHex) => {
    const newChainId = Number(chainHex);
    console.log("🔗 Chain changed to:", newChainId);
    setChainId(newChainId);
    
    const networkLabel = addresses.supportedNetworks?.find((net) => net.chainId === newChainId)?.name || `Chain ${chainHex}`;
    const newNetworkId = addresses.supportedNetworks?.find((net) => net.chainId === newChainId)?.id;
    setNetworkName(networkLabel);
    setStatusMessage(`Network berubah ke ${networkLabel}`);
    addToast("info", `Network berubah ke ${networkLabel}`);
    
    if (account) {
      const newNetConfig = newNetworkId ? (addresses[newNetworkId] || {}) : {};
      const shouldUseFallback = false; // Use BrowserProvider since we're changing networks
      console.log("📊 Chain changed - loading balances for new chain:", newNetworkId, "chainId:", newChainId);
      await loadProviderBalances(account, shouldUseFallback, newNetConfig.rpcUrl, newNetworkId);
    }
  };

  const getRouterContract = (useSigner = false) => {
    const rpcProvider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    const signerOrProvider = useSigner && signer ? signer : rpcProvider;
    return new ethers.Contract(networkConfig.uniswapRouter, uniswapRouterAbi, signerOrProvider);
  };

  const estimateSwap = async () => {
    if (!connected || !amountIn || Number(amountIn) <= 0 || !hasRouter || fromToken.key === toToken.key) {
      setAmountOut("");
      setEstimatedGas(null);
      setPriceImpact("—");
      return;
    }

    if (!isValidAddress(fromToken.address) && !fromToken.isNative) {
      setAmountOut("0");
      return;
    }
    if (!isValidAddress(toToken.address) && !toToken.isNative) {
      setAmountOut("0");
      return;
    }

    try {
      const swapProvider = onSelectedNetwork && provider ? provider : new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const router = new ethers.Contract(networkConfig.uniswapRouter, uniswapRouterAbi, swapProvider);
      const tokenIn = fromToken.isNative ? networkConfig.weth : fromToken.address;
      const tokenOut = toToken.isNative ? networkConfig.weth : toToken.address;
      if (!isValidAddress(tokenIn) || !isValidAddress(tokenOut)) {
        setAmountOut("0");
        return;
      }
      const amountInUnits = ethers.parseUnits(amountIn, fromToken.decimals);
      const params = {
        tokenIn,
        tokenOut,
        fee: ROUTER_FEE,
        recipient: account,
        deadline: Math.floor(Date.now() / 1000) + DEADLINE_SECONDS,
        amountIn: amountInUnits,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      };

      const callOptions = fromToken.isNative ? { value: amountInUnits } : {};
      const quotedOut = await router.callStatic.exactInputSingle(params, callOptions);
      setAmountOut(ethers.formatUnits(quotedOut, toToken.decimals));

      if (swapProvider && router.estimateGas) {
        try {
          const estimated = await router.estimateGas.exactInputSingle(params, callOptions);
          setEstimatedGas(estimated.toString());
        } catch {
          setEstimatedGas(null);
        }
      }

      setPriceImpact("Low");
    } catch (error) {
      console.debug("Swap estimate failed:", error);
      setAmountOut("0");
      setEstimatedGas(null);
      setPriceImpact("Tidak tersedia");
    }
  };

  const fetchAllowance = async () => {
    if (!connected || fromToken.isNative || !isValidAddress(fromToken.address) || !hasRouter) return;
    try {
      const tokenContract = new ethers.Contract(fromToken.address, tokenAbi, provider);
      const rawAllowance = await tokenContract.allowance(account, networkConfig.uniswapRouter);
      setAllowance(Number(ethers.formatUnits(rawAllowance, fromToken.decimals)).toString());
    } catch (error) {
      console.error("fetchAllowance", error);
      setAllowance("0");
    }
  };

  const approveSwap = async () => {
    if (!connected || !signer || fromToken.isNative || !hasRouter) return;
    try {
      setIsApproving(true);
      setErrorMessage("");
      setStatusMessage("Menunggu approval token...");
      const amountInUnits = ethers.parseUnits(amountIn, fromToken.decimals);
      const tokenContract = new ethers.Contract(fromToken.address, tokenAbi, signer);
      const tx = await tokenContract.approve(networkConfig.uniswapRouter, amountInUnits);
      await tx.wait();
      await fetchAllowance();
      setStatusMessage("Approval berhasil. Siap swap.");
      addToast("success", "Token sudah disetujui.");
    } catch (error) {
      console.error("approveSwap", error);
      setErrorMessage(error?.message || "Approval gagal.");
      addToast("error", error?.message || "Approval gagal.");
    } finally {
      setIsApproving(false);
    }
  };

  const executeSwap = async (event) => {
    event.preventDefault();
    if (!connected || !signer || !hasRouter || amountIn === "" || Number(amountIn) <= 0) return;
    if (!onSelectedNetwork) {
      setErrorMessage(`Silakan switch ke jaringan ${currentNetwork.name} terlebih dahulu.`);
      return;
    }
    if (inputAmount > fromBalance) {
      setErrorMessage("Saldo tidak mencukupi untuk swap ini.");
      return;
    }
    if (needsApprove) {
      await approveSwap();
      return;
    }

    try {
      setIsSwapping(true);
      setErrorMessage("");
      setStatusMessage("Memproses swap...");
      const router = new ethers.Contract(networkConfig.uniswapRouter, uniswapRouterAbi, signer);
      const tokenIn = fromToken.isNative ? networkConfig.weth : fromToken.address;
      const tokenOut = toToken.isNative ? networkConfig.weth : toToken.address;
      const amountInUnits = ethers.parseUnits(amountIn, fromToken.decimals);
      const slippagePct = Math.max(0, Math.min(100, parseFloat(slippage) || 0));
      const minOut = amountOut && Number(amountOut) > 0
        ? ethers.parseUnits((Number(amountOut) * (1 - slippagePct / 100)).toFixed(toToken.decimals), toToken.decimals)
        : 0;
      const params = {
        tokenIn,
        tokenOut,
        fee: ROUTER_FEE,
        recipient: account,
        deadline: Math.floor(Date.now() / 1000) + DEADLINE_SECONDS,
        amountIn: amountInUnits,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: 0,
      };
      const txOptions = fromToken.isNative ? { value: amountInUnits } : {};
      const tx = await router.exactInputSingle(params, txOptions);
      setStatusMessage("Transaksi dikirim. Menunggu konfirmasi...");
      await tx.wait();
      setStatusMessage("✅ Swap berhasil.");
      addToast("success", "Swap selesai.");
      setAmountIn("");
      setAmountOut("");
      await loadProviderBalances(account);
      await fetchAllowance();
    } catch (error) {
      console.error("executeSwap", error);
      const message = error?.reason || error?.data?.message || error?.message || "Swap gagal.";
      setErrorMessage(message);
      setStatusMessage("Swap gagal.");
      addToast("error", message);
    } finally {
      setIsSwapping(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.ethereum) return;
    const ethereum = window.ethereum;
    connectWallet(false);
    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connected && account && ethers.isAddress(account)) {
      console.log("⏱️  Effect triggered: Reloading balances...");
      console.log("   connected:", connected, "account:", account);
      const netConfig = addresses[selectedNetworkId] || {};
      loadProviderBalances(account, !onSelectedNetwork, netConfig.rpcUrl, selectedNetworkId)
        .then(() => {
          console.log("⏱️  Effect: Balances loaded, fetching allowance");
          fetchAllowance();
        })
        .catch(err => {
          console.error("⏱️  Effect: Error loading balances", err);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, selectedNetworkId]);

  useEffect(() => {
    if (!connected || !account || !ethers.isAddress(account)) return;

    const interval = setInterval(() => {
      if (onSelectedNetwork) {
        console.log("⏱️  Polling balances (on network)...");
        loadProviderBalances(account, false);
      }
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [connected, account, selectedNetworkId, onSelectedNetwork]);

  useEffect(() => {
    estimateSwap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountIn, fromTokenKey, toTokenKey, connected, chainId]);

  return (
    <div className={"min-h-screen bg-slate-950 text-slate-100"}>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/95 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Swap</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Swap {currentNetwork.name}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Tukar ETH, USDC, USDT dan Token A (jika tersedia) di {currentNetwork.name} dengan koneksi MetaMask yang modern.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-[1.75rem] border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-100">Status</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-cyan-300">{connected ? "Connected" : "Disconnected"}</span>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-1 text-xs">
                  <span className="text-slate-500">Wallet</span>
                  <span className="font-medium text-white">{connected ? getShortAddress(account) : "Belum terhubung"}</span>
                </div>
                <div className="grid gap-1 text-xs">
                  <span className="text-slate-500">Network</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedNetworkId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedNetworkId(newId);
                        localStorage.setItem("selectedNetworkId", newId);
                        setFromTokenKey("ETH");
                        setToTokenKey("USDC");
                        setBalances({ ETH: "0", USDC: "0", USDT: "0", TKA: "0", TKB: "0" });
                        setIsLoadingBalances(true);
                        setAllowance("0");
                      }}
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-white"
                    >
                      {addresses.supportedNetworks?.map((net) => (
                        <option key={net.id} value={net.id}>
                          {net.icon} {net.name}
                        </option>
                      ))}
                    </select>
                    <span className="font-medium text-white">{connected ? networkName || `Chain ${chainId}` : "-"}</span>
                  </div>
                </div>
                <div className="grid gap-1 text-xs">
                  <span className="text-slate-500">{currentNetwork.name}</span>
                  <span className="font-medium text-white">{onSelectedNetwork ? "✅ Connected" : "❌ Not Connected"}</span>
                </div>
                {needsSwitchNetwork && (
                  <button
                    onClick={switchToSelectedNetwork}
                    disabled={isSwitching}
                    className="mt-3 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSwitching ? "Switching..." : `Switch to ${currentNetwork.name}`}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <form onSubmit={executeSwap} className="space-y-6 rounded-[1.75rem] border border-slate-800 bg-slate-950/80 p-6 shadow-xl">
              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/90 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-300">From</p>
                    <p className="mt-2 text-lg font-semibold text-white">{fromToken.label}</p>
                  </div>
                  <span className="text-xs text-slate-400">Balance {formatDisplay(balances[fromToken.key], fromToken.decimals)} {fromToken.symbol}</span>
                </div>
                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <input
                    type="number"
                    step="any"
                    value={amountIn}
                    onChange={(e) => setAmountIn(e.target.value)}
                    className="w-full rounded-3xl border border-slate-800 bg-slate-950 px-5 py-4 text-3xl font-semibold text-white outline-none focus:border-cyan-400"
                    placeholder="0.0"
                  />
                  <select
                    value={fromToken.key}
                    onChange={(e) => setFromTokenKey(e.target.value)}
                    className="w-full shrink-0 rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-base font-semibold text-white outline-none focus:border-cyan-400 sm:w-48"
                  >
                    {tokenOptions.map((token) => (
                      <option key={token.key} value={token.key}>{token.symbol}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mx-auto w-fit rounded-full bg-slate-800 p-3 text-slate-300 shadow-sm">
                <span className="text-sm">⇅</span>
              </div>

              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/90 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-300">To</p>
                    <p className="mt-2 text-lg font-semibold text-white">{toToken.label}</p>
                  </div>
                  <span className="text-xs text-slate-400">Balance {formatDisplay(balances[toToken.key], toToken.decimals)} {toToken.symbol}</span>
                </div>
                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    disabled
                    value={amountOut}
                    className="w-full rounded-3xl border border-slate-800 bg-slate-950 px-5 py-4 text-3xl font-semibold text-white outline-none"
                    placeholder="0.0"
                  />
                  <select
                    value={toToken.key}
                    onChange={(e) => setToTokenKey(e.target.value)}
                    className="w-full shrink-0 rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-base font-semibold text-white outline-none focus:border-cyan-400 sm:w-48"
                  >
                    {tokenOptions.map((token) => (
                      <option key={token.key} value={token.key}>{token.symbol}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 rounded-[1.75rem] border border-slate-800 bg-slate-900/90 p-5">
                <div className="grid gap-2 text-sm text-slate-400">
                  <label className="flex items-center justify-between gap-3">
                    <span>Slippage tolerance</span>
                    <span className="text-white">{slippage}%</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="grid gap-2 text-sm text-slate-400">
                  <p className="flex items-center justify-between gap-3">
                    <span>Estimated output</span>
                    <span className="font-semibold text-white">{amountOut || "0"} {toToken.symbol}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span>Price impact</span>
                    <span className="font-semibold text-white">{priceImpact}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span>Gas estimate</span>
                    <span className="font-semibold text-white">{estimatedGas ? `${estimatedGas}` : "—"}</span>
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={!connected || !hasRouter || !onSelectedNetwork || isSwapping || inputAmount <= 0 || inputAmount > fromBalance}
                className={`w-full rounded-3xl px-6 py-4 text-base font-semibold text-slate-950 transition ${!connected || !hasRouter || !onSelectedNetwork || inputAmount <= 0 || inputAmount > fromBalance ? "bg-slate-600 cursor-not-allowed" : "bg-cyan-400 hover:bg-cyan-300"}`}
              >
                {isSwapping ? "Swapping..." : needsApprove ? "Approve" : swapButtonLabel}
              </button>

              {errorMessage && (
                <div className="rounded-3xl bg-rose-500/10 p-4 text-sm text-rose-200">{errorMessage}</div>
              )}
              {statusMessage && (
                <div className="rounded-3xl bg-cyan-500/10 p-4 text-sm text-cyan-100">{statusMessage}</div>
              )}
            </form>

            <aside className="space-y-6 rounded-[1.75rem] border border-slate-800 bg-slate-950/95 p-6 shadow-xl">
              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/95 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{currentNetwork.name} Info</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Network</span>
                    <strong>{currentNetwork.name}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Chain ID</span>
                    <strong>{currentNetwork.chainId}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Router</span>
                    <strong className="text-emerald-300">{hasRouter ? "Ready" : "Konfigurasi diperlukan"}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/95 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Your balances</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  {tokenOptions.map((token) => (
                    <div key={token.key} className="flex items-center justify-between rounded-3xl bg-slate-950 px-4 py-3">
                      <span>{token.symbol}</span>
                      <strong>
                        {isLoadingBalances ? (
                          <span className="animate-pulse">Loading...</span>
                        ) : (
                          formatDisplay(balances[token.key], token.decimals)
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {!hasRouter && (
                <div className="rounded-[1.75rem] border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-100">
                  <p className="font-semibold">Router belum terkonfigurasi.</p>
                  <p className="mt-2">Pastikan alamat router {currentNetwork.name} sudah diisi di <code>data/contractAddresses.json</code>.</p>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>

      <div className="fixed right-4 top-24 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-3xl px-4 py-3 text-sm shadow-xl ${toast.type === "success" ? "bg-emerald-500 text-slate-950" : toast.type === "error" ? "bg-rose-500 text-white" : "bg-slate-700 text-white"}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
