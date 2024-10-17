import { ethers } from "ethers";
import { SWAP_ABI, ERC20_ABI, POOL_ABI } from "./ABIs";

const provider = new ethers.JsonRpcProvider(
  `https://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
);

const swapIface = new ethers.Interface(SWAP_ABI);

async function getTokenDetails(tokenAddress: string) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const [tokenName, symbol, decimals, totalSupply] = await Promise.all([
    tokenContract.name(),
    tokenContract.symbol(),
    tokenContract.decimals(),
    tokenContract.totalSupply(),
  ]);

  const formattedSupply = Number(ethers.formatUnits(totalSupply, decimals));

  return {
    tokenName: tokenName || "Unknown",
    symbol: symbol || "Unknown",
    supply: formattedSupply || 0,
    decimals: decimals || 18,
    address: tokenAddress,
  };
}

async function fetchConfirmedTx() {
  const txhash =
    // "0x2f6ff1f6230bff664cd5d3701611f61758fb482a295ec70ddb48ea706e50d3fa"; // Three tokens path
    "0x4232b1f580cc1e7a597364a83efe99053255a14c5384f8224745e2124be8d2d5"; // TOMMY
  // "0xd001258f9e03b1486bf0b2f5ae626cff11bb68b74ee7e370f2c1293473a2f844"; // Jared bot
  const tx = await provider.getTransaction(txhash);
  if (tx) {
    const receipt = await provider.getTransactionReceipt(tx.hash);
    const transferEventTopic =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const swapEventTopic =
      "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";

    const transferLogs = receipt?.logs.filter(
      (log) => log.topics[0] === transferEventTopic
    );
    const swapLogs = receipt?.logs.filter(
      (log) => log.topics[0] === swapEventTopic
    );

    if (transferLogs && swapLogs) {
      const token0Address = transferLogs[0].address;
      const token1Address = transferLogs[transferLogs?.length - 1].address;

      const [tokenA, tokenB] = await Promise.all([
        getTokenDetails(token0Address),
        getTokenDetails(token1Address),
      ]);

      const amountA =
        Number(swapIface.parseLog(swapLogs[0])?.args[1]) === 0
          ? Number(swapIface.parseLog(swapLogs[0])?.args[2]) /
            Number(Math.pow(10, Number(tokenA.decimals)))
          : Number(swapIface.parseLog(swapLogs[0])?.args[1]) /
            Number(Math.pow(10, Number(tokenA.decimals)));
      const amountB =
        Number(swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[4]) === 0
          ? Number(swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[3]) /
            Number(Math.pow(10, Number(tokenB.decimals)))
          : Number(swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[4]) /
            Number(Math.pow(10, Number(tokenB.decimals)));

      console.log(`✅ Swap Detected!`);
      console.log(
        `- Swap: ${amountA} ${tokenA.symbol.toUpperCase()}` +
          ` -> ${amountB} ${tokenB.symbol.toUpperCase()}`
      );
      console.log(
        `  |_${tokenA.tokenName}:\t` +
          `Supply: ${tokenA.supply}\t(${tokenA.decimals})`
      );
      console.log(
        `  |_${tokenB.tokenName}:\t` +
          `Supply: ${tokenB.supply}\t(${tokenB.decimals})`
      );

      console.log(`Value: ${ethers.formatEther(tx.value)} ETH`);
      console.log(`🔗 Tx: https://etherscan.io/tx/${tx.hash}`);
      console.log("---------------------------------");
    }
  }
}

fetchConfirmedTx();
