const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);

  const TokenA = await ethers.deployContract("TokenA");
  await TokenA.waitForDeployment();

  const TokenB = await ethers.deployContract("TokenB");
  await TokenB.waitForDeployment();

  const SimpleDEX = await ethers.deployContract("SimpleDEX", [TokenA.target, TokenB.target]);
  await SimpleDEX.waitForDeployment();

  const initialAmount = ethers.parseUnits("1000", 18);
  await TokenA.approve(SimpleDEX.target, initialAmount);
  await TokenB.approve(SimpleDEX.target, initialAmount);
  await SimpleDEX.addLiquidity(initialAmount, initialAmount);

  const addresses = {
    tokenA: TokenA.target,
    tokenB: TokenB.target,
    dex: SimpleDEX.target
  };

  const filePath = path.join(__dirname, "../data/contractAddresses.json");
  fs.writeFileSync(filePath, JSON.stringify(addresses, null, 2));

  console.log("TokenA deployed to:", TokenA.target);
  console.log("TokenB deployed to:", TokenB.target);
  console.log("SimpleDEX deployed to:", SimpleDEX.target);
  console.log(`Saved addresses to ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
