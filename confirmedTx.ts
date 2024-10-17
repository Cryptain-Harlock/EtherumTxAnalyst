import { ethers } from "ethers";
import { monitoredAddresses } from "./monitoredAddresses";
import { SWAP_ABI, ERC20_ABI } from "./ABIs";

const provider = new ethers.WebSocketProvider(
  `wss://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
);

const uniswapV2RouterAddress = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";

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

provider.on("block", async (blockNumber) => {
  try {
    const block = await provider.getBlock(blockNumber);
    if (block && block.transactions.length > 0) {
      console.log(
        `\t📦 New block: ${blockNumber} | ${block?.transactions.length} txns`
      );
      for (const txHash of block.transactions) {
        const tx = await provider.getTransaction(txHash);
        if (tx?.from && monitoredAddresses.includes(tx.from.toLowerCase())) {
          console.log(
            `\tFrom: ${
              tx.from
            } | ${new Date().toISOString()}\n\t\t\t🔗 Tx Hash: ${txHash}`
          );
          if (
            tx.to &&
            tx.to.toLowerCase() === uniswapV2RouterAddress.toLowerCase()
          ) {
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
              const token1Address =
                transferLogs[transferLogs?.length - 1].address;

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
                Number(
                  swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[4]
                ) === 0
                  ? Number(
                      swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[3]
                    ) / Number(Math.pow(10, Number(tokenB.decimals)))
                  : Number(
                      swapIface.parseLog(swapLogs[swapLogs.length - 1])?.args[4]
                    ) / Number(Math.pow(10, Number(tokenB.decimals)));
              console.log("---------------------------------");
              console.log(`\t\t\t✅ Swap Detected!`);
              console.log(`\t\t\t🔗 Tx: https://etherscan.io/tx/${tx.hash}\n`);
              console.log(
                `\t\t\t💱 Swap: ${amountA} 🪙  ${tokenA.symbol.toUpperCase()}` +
                  ` -> ${amountB} 🪙  ${tokenB.symbol.toUpperCase()}`
              );
              console.log(
                `\t\t\t  |_${tokenA.tokenName}:\t` +
                  `Supply: ${tokenA.supply}\t(${tokenA.decimals})`
              );
              console.log(
                `\t\t\t  |_${tokenB.tokenName}:\t` +
                  `Supply: ${tokenB.supply}\t(${tokenB.decimals})`
              );

              console.log(`\t\t\tValue: ${ethers.formatEther(tx.value)} ETH`);
              console.log("---------------------------------");
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error processing transaction: ${e.message}`);
  }
});

function animateMonitoringMessage() {
  const messages = [
    "🔍 Monitoring wallet   ",
    "🔍 Monitoring wallet.  ",
    "🔍 Monitoring wallet.. ",
    "🔍 Monitoring wallet...",
  ];
  let index = 0;

  setInterval(() => {
    process.stdout.write(`\r${messages[index]}`);
    index = (index + 1) % messages.length;
  }, 1000);
}

animateMonitoringMessage();
