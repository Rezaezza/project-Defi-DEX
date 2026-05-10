export const tokenAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)"
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

// Uniswap V3 Router ABI (minimal)
export const uniswapRouterAbi = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)"
];
