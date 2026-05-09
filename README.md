# Simple DeFi DEX

Proyek ini adalah DEX sederhana seperti Uniswap yang dibangun dengan:

- Next.js
- Tailwind CSS
- Solidity ^0.8.20
- Hardhat
- ethers.js
- OpenZeppelin

## Fitur

- Connect Wallet (MetaMask, Rabby, Coinbase, dll.)
- Tampilkan jaringan blockchain dan Chain ID
- Tampilkan saldo ETH, USDC, USDT di jaringan tersebut
- Swap Token A (TKA) ke Token B (TKB) menggunakan DEX custom
- Swap ke USDC/USDT menggunakan Uniswap (dalam pengembangan)
- Add Liquidity
- Remove Liquidity
- Tampilkan saldo token
- Tampilkan harga token
- Switch network ke Ethereum Mainnet untuk swap stablecoin

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

1. Di aplikasi web, klik tombol **"Connect to Local Hardhat"** (untuk testing tanpa MetaMask)
2. Atau gunakan MetaMask dengan jaringan localhost:8545
3. Coba fitur:
   - Lihat saldo dan harga di halaman Home
   - Di halaman Swap: lihat jaringan, saldo ETH/USDC/USDT, pilih token tujuan (TKB/USDC/USDT)
   - Swap Token A ke Token B di halaman Swap
   - Add/Remove liquidity di halaman Liquidity
   - Switch ke Ethereum Mainnet untuk fitur Uniswap (dalam pengembangan)

## Catatan MetaMask

Untuk menggunakan MetaMask dengan Hardhat node, tambahkan jaringan baru di MetaMask:

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`

Kemudian import salah satu private key yang ditampilkan di terminal `npx hardhat node`.

## Kontrak

- `TokenA.sol` - ERC20 token A
- `TokenB.sol` - ERC20 token B
- `SimpleDEX.sol` - DEX sederhana dengan swap, add liquidity, remove liquidity

## Troubleshooting

- Jika alamat kontrak tidak tersedia, pastikan `scripts/deploy.js` dijalankan dan `data/contractAddresses.json` terisi.
- Jika MetaMask tidak terhubung, periksa apakah jaringan `localhost:8545` sudah aktif dan akun sudah diimport.
