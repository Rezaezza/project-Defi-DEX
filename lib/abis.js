export const tokenAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)"
];

export const dexAbi = [
  "function getReserves() view returns (uint256,uint256)",
  "function getPriceAtoB() view returns (uint256)",
  "function addLiquidity(uint256,uint256) returns (uint256)",
  "function removeLiquidity(uint256) returns (uint256,uint256)",
  "function swapAForB(uint256,uint256) returns (uint256)",
  "function liquidity(address) view returns (uint256)",
  "function totalLiquidity() view returns (uint256)"
];
