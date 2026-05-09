# Simple DeFi DEX

Proyek ini adalah DEX sederhana seperti Uniswap yang dibangun dengan:

- Next.js
- Tailwind CSS
- Solidity ^0.8.20
- Hardhat
- ethers.js
- OpenZeppelin

## Fitur

- ✅ Connect Wallet (MetaMask, Rabby, Coinbase, dll.)
- ✅ Support Multiple Networks:
  - Hardhat Localhost (local development)
  - Base Sepolia (testnet)
  - Arbitrum Sepolia / Arc Testnet
- ✅ Network Selector Dropdown untuk pilih jaringan swap
- ✅ Swap ke Multiple Tokens:
  - **Token A → Token B** (Custom DEX)
  - **Token A → Ethereum (ETH)** (Native Currency)
  - **Token A → USDC** (Stablecoin)
  - **Token A → USDT** (Stablecoin)
- ✅ Token Selection dengan Visual Grid Interface (icon + details)
- ✅ Tampilkan saldo token per jaringan
- ✅ Tampilkan harga token real-time di jaringan yang dipilih
- ✅ Slippage tolerance configuration
- ✅ Add Liquidity
- ✅ Remove Liquidity
- ✅ Interface yang responsif dengan Tailwind CSS

## Struktur proyek

- `contracts/` - smart contract Solidity
- `scripts/` - skrip Hardhat deploy
- `pages/` - frontend Next.js
- `styles/` - Tailwind styling
- `lib/` - ABI helper
- `data/contractAddresses.json` - alamat kontrak setelah deploy

## Cara menjalankan di GitHub Codespaces

1. Install dependencies

```bash
npm install
```

2. Compile kontrak

```bash
npx hardhat compile
```

3. Jalankan jaringan lokal Hardhat

```bash
npx hardhat node
```

4. Deploy kontrak ke jaringan lokal

```bash
npx hardhat run scripts/deploy.js --network localhost
```

5. Jalankan aplikasi Next.js

```bash
npm run dev
```

6. Buka `http://localhost:3000`

## Cara Testing

### Testing di Localhost (Hardhat Local Node)

1. Di aplikasi web, klik tombol **"Connect to Local Hardhat"** (untuk testing tanpa MetaMask)
2. Atau gunakan MetaMask dengan jaringan localhost:8545
3. Fitur yang bisa ditest:
   - **Home Page**: Lihat saldo dan harga di halaman utama
   - **Swap Page**: 
     - Pilih jaringan dengan dropdown "Pilih Jaringan untuk Swap"
     - Lihat saldo ETH per jaringan
     - Lihat harga token real-time di jaringan yang dipilih
     - **Pilih Token Tujuan** (grid interface dengan 4 opsi):
       - 🔶 Token B (TKB) - swap via custom DEX
       - Ξ Ethereum (ETH) - swap native currency
       - 💵 USDC - stablecoin
       - 💴 USDT - stablecoin
     - Masukkan jumlah Token A yang ingin ditukar
     - Set minimum token output (opsional, untuk slippage protection)
     - Klik tombol **"Swap Token A ke [TOKEN_TUJUAN]"**
   - **Liquidity Page**: Add/Remove liquidity

### Supported Token Swaps

| From Token | To Token | Method | Status |
|-----------|----------|--------|--------|
| Token A | Token B | Simple DEX | ✅ Production Ready |
| Token A | ETH | Simple DEX | ✅ Production Ready |
| Token A | USDC | Uniswap V3 | 🚧 In Development |
| Token A | USDT | Uniswap V3 | 🚧 In Development |

### Testing di Testnet (Base Sepolia atau Arbitrum Sepolia)

1. Install MetaMask atau wallet lainnya
2. Pastikan wallet memiliki saldo test ETH (dapatkan dari testnet faucet)
3. Di aplikasi web, klik tombol **"Connect Wallet"**
4. Pilih wallet yang ingin digunakan
5. Aplikasi akan otomatis load saldo di semua jaringan yang tersupport
6. Di halaman **Swap**, gunakan dropdown "Pilih Jaringan untuk Swap" untuk beralih antar testnet
7. Lakukan swap di jaringan pilihan

### Faucets untuk Mendapatkan Test ETH

- **Base Sepolia**: https://www.alchemy.com/faucets/base-sepolia
- **Arbitrum Sepolia**: https://faucet.arbitrum.io/

## Setup Network di MetaMask

### Hardhat Localhost

Untuk menggunakan MetaMask dengan Hardhat node, tambahkan jaringan baru di MetaMask:

- **Network Name**: Hardhat Localhost
- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `31337`
- **Currency Symbol**: `ETH`

Kemudian import salah satu private key yang ditampilkan di terminal `npx hardhat node`.

### Base Sepolia Testnet

- **Network Name**: Base Sepolia
- **RPC URL**: `https://sepolia.base.org`
- **Chain ID**: `84532`
- **Currency Symbol**: `ETH`
- **Block Explorer**: `https://sepolia.basescan.org`

### Arbitrum Sepolia Testnet (Arc Testnet)

- **Network Name**: Arbitrum Sepolia
- **RPC URL**: `https://sepolia-rollup.arbitrum.io:443`
- **Chain ID**: `421614`
- **Currency Symbol**: `ETH`
- **Block Explorer**: `https://sepolia.arbiscan.io`

## Kontrak

- `TokenA.sol` - ERC20 token A
- `TokenB.sol` - ERC20 token B
- `SimpleDEX.sol` - DEX sederhana dengan swap, add liquidity, remove liquidity

## Token Addresses

Token addresses tersimpan di `data/contractAddresses.json` untuk setiap network:

### Localhost (Hardhat)
- **Token A**: `0x68B1D87F95878fE05B998F19b66F4baba5De1aed`
- **Token B**: `0x3Aa5ebB10DC797CAC828524e59A333d0A371443c`
- **DEX Contract**: `0xc6e7DF5E7b4f2A278906862b61205850344D4e7d`

### Base Sepolia
- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b1566469c3d`
- **USDT**: `0xfde4C96c8593536E31F26E3DaAf1baf753b4B5d7`
- **Uniswap Router**: `0x2626664c2603336E57B271c5C0b26F421741e481`

### Arbitrum Sepolia
- **USDC**: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- **USDT**: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`
- **Uniswap Router**: `0xE592427A0AEce92De3Edee1F18E0157C05861564`

## Troubleshooting

- Jika alamat kontrak tidak tersedia, pastikan `scripts/deploy.js` dijalankan dan `data/contractAddresses.json` terisi.
- Jika MetaMask tidak terhubung, periksa apakah jaringan `localhost:8545` sudah aktif dan akun sudah diimport.
