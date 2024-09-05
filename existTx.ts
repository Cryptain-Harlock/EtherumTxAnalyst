import { ethers } from "ethers";
import { SWAP_ABI, ERC20_ABI, POOL_ABI } from "./ABIs";

const provider = new ethers.JsonRpcProvider(
  `https://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
);

const monitoredAddresses = [
  "0xb0ba33566bd35bcb80738810b2868dc1ddd1f0e9",
  "0x3b40af8e80b09f4a54b1eb763031d4880f765bdc",
  "0xab7b44ae25af88d306dc0a5c6c39bbeb8916eabb",
  "0x49c543e8873aeda1b60c176f55a78fc62f9c9fbb",
  "0x3ccce09b4ad94968f269375c0999134a6617f795",
  "0xacbcb2724cfafb839c752d71997a8a7a16989b2e",
  "0x16d59f67bd39ac0d952e48648548217b62183403",
  "0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13",
].map((address) => address.toLowerCase());

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
    "0xbc4f5a06c3bdee8438c64ccd9b50f5ec79b4d0218fc6fdf5ffc6747568e4aa16"; // TOMMY
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
        Number(swapIface.parseLog(swapLogs[0])?.args[1]) /
        Number(Math.pow(10, Number(tokenA.decimals)));
      const amountB =
        Number(swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[4]) /
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
