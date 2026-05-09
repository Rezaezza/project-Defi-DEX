// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleDEX {
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    mapping(address => uint256) public liquidity;
    uint256 public totalLiquidity;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityBurned);
    event Swapped(address indexed buyer, uint256 amountA, uint256 amountB);

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    function getReserves() public view returns (uint256 reserveA, uint256 reserveB) {
        reserveA = tokenA.balanceOf(address(this));
        reserveB = tokenB.balanceOf(address(this));
    }

    function getPriceAtoB() external view returns (uint256) {
        (uint256 reserveA, uint256 reserveB) = getReserves();
        if (reserveA == 0) {
            return 0;
        }
        return (reserveB * 1e18) / reserveA;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 liquidityMinted) {
        require(amountA > 0 && amountB > 0, "Amounts must be greater than zero");

        (uint256 reserveA, uint256 reserveB) = getReserves();

        if (totalLiquidity > 0) {
            require(reserveA * amountB == reserveB * amountA, "Deposit must match current ratio");
            liquidityMinted = (amountA * totalLiquidity) / reserveA;
        } else {
            liquidityMinted = amountA + amountB;
            require(liquidityMinted > 0, "Invalid liquidity amount");
        }

        require(tokenA.transferFrom(msg.sender, address(this), amountA), "TransferA failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "TransferB failed");

        liquidity[msg.sender] += liquidityMinted;
        totalLiquidity += liquidityMinted;

        emit LiquidityAdded(msg.sender, amountA, amountB, liquidityMinted);
    }

    function removeLiquidity(uint256 amount) external returns (uint256 amountA, uint256 amountB) {
        require(amount > 0 && liquidity[msg.sender] >= amount, "Invalid liquidity amount");

        (uint256 reserveA, uint256 reserveB) = getReserves();
        amountA = (reserveA * amount) / totalLiquidity;
        amountB = (reserveB * amount) / totalLiquidity;

        liquidity[msg.sender] -= amount;
        totalLiquidity -= amount;

        require(tokenA.transfer(msg.sender, amountA), "TransferA failed");
        require(tokenB.transfer(msg.sender, amountB), "TransferB failed");

        emit LiquidityRemoved(msg.sender, amountA, amountB, amount);
    }

    function swapAForB(uint256 amountA, uint256 minAmountB) external returns (uint256 amountB) {
        require(amountA > 0, "Amount must be greater than zero");

        (uint256 reserveA, uint256 reserveB) = getReserves();
        require(reserveA > 0 && reserveB > 0, "No liquidity available");

        require(tokenA.transferFrom(msg.sender, address(this), amountA), "TransferA failed");

        amountB = (amountA * reserveB) / (reserveA + amountA);
        require(amountB >= minAmountB, "Insufficient output amount");

        require(tokenB.transfer(msg.sender, amountB), "TransferB failed");

        emit Swapped(msg.sender, amountA, amountB);
    }
}
