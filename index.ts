import { ethers } from "ethers";
import fetch from "node-fetch";

const provider = new ethers.JsonRpcProvider(
  `https://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
);

const monitoredAddress = [
  "0xb0ba33566bd35bcb80738810b2868dc1ddd1f0e9",
  "0x3b40af8e80b09f4a54b1eb763031d4880f765bdc",
  "0xab7b44ae25af88d306dc0a5c6c39bbeb8916eabb",
  "0x49c543e8873aeda1b60c176f55a78fc62f9c9fbb",
  "0x3ccce09b4ad94968f269375c0999134a6617f795",
  "0xacbcb2724cfafb839c752d71997a8a7a16989b2e",
  "0x16d59f67bd39ac0d952e48648548217b62183403",
].map((address) => address.toLowerCase());

const processedTransactions = new Set<string>();
const pendingTransactionsTime = new Map<string, number>();

async function getTokenDetails(tokenAddress: string) {
  const url = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${tokenAddress}`;
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-cg-demo-api-key": "CG-AyeKotUVrJVWTJaLagAazEYb",
    },
  };

  interface CoinGeckoTokenData {
    name: string;
    symbol: string;
    market_data: {
      circulating_supply: number;
      current_price: {
        usd: number;
      };
    };
    detail_platforms: {
      ethereum: {
        decimal_place: number;
      };
    };
  }
  try {
    const response = await fetch(url, options);
    const data = (await response.json()) as CoinGeckoTokenData;
    if (data && data.name && data.symbol) {
      return {
        tokenName: data.name,
        symbol: data.symbol,
        supply: data.market_data.circulating_supply,
        decimals: data.detail_platforms.ethereum.decimal_place,
        price: data.market_data.current_price.usd,
      };
    } else {
      console.error(
        `Token not found on CoinGecko for address: ${tokenAddress}`
      );
      return { tokenName: "Unknown", symbol: "Unknown", supply: "Unknown" };
    }
  } catch (error) {
    console.error("Error fetching token details:", error);
    return { tokenName: "Unknown", symbol: "Unknown", supply: "Unknown" };
  }
}

async function decodeInputData(
  tx: string
): Promise<{ swapType: string; path: string[]; amountIn: number }> {
  const uniswapRouterAbi = [
    "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
    "function swapTokensForExactTokens(uint256,uint256,address[],address,uint256)",
    "function swapExactETHForTokens(uint256,address[],address,uint256)",
    "function swapTokensForExactETH(uint256,uint256,address[],address,uint256)",
    "function swapExactTokensForETH(uint256,uint256,address[],address,uint256)",
    "function swapETHForExactTokens(uint256,address[],address,uint256)",
    "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
  ];

  const iface = new ethers.Interface(uniswapRouterAbi);
  const transaction = await provider.getTransaction(tx);

  if (!transaction) {
    console.error("Transaction not found");
    return { swapType: "Unknown", path: [], amountIn: NaN };
  }

  for (const functionSignature of uniswapRouterAbi) {
    const functionName = functionSignature.split(" ")[1].split("(")[0];

    try {
      const decodedData = iface.decodeFunctionData(
        functionName,
        transaction.data
      );
      if (
        functionName == "swapETHForExactTokens" ||
        functionName == "swapExactETHForTokens" ||
        functionName == "swapExactETHForTokensSupportingFeeOnTransferTokens"
      ) {
        return {
          swapType: functionName,
          path: decodedData[1],
          amountIn: decodedData[0],
        };
      } else {
        return {
          swapType: functionName,
          path: decodedData[2],
          amountIn: decodedData[0],
        };
      }
    } catch (e) {
      continue;
    }
  }

  return { swapType: "Not a Swap!", path: [], amountIn: NaN };
}

async function checkPendingTransactions() {
  const pendingTransactions = await provider.send("eth_getBlockByNumber", [
    "pending",
    true,
  ]);

  // Comment this part for pending tx
  if (pendingTransactions && pendingTransactions.transactions) {
    for (const tx of pendingTransactions.transactions) {
      if (
        monitoredAddress.includes(tx.from.toLowerCase()) &&
        !processedTransactions.has(tx.hash)
      ) {
        pendingTransactionsTime.set(tx.hash, Date.now());
        processedTransactions.add(tx.hash);

        const now = new Date();
        const formattedUTC = now.toLocaleString(undefined, { timeZone: "UTC" });

        console.log(`💡 Gotcha!\n`);
        console.log(formattedUTC);

        const { swapType, path, amountIn } = await decodeInputData(tx.hash);
        if (path.length >= 2) {
          const tokenA = await getTokenDetails(path[0]);
          const tokenB = await getTokenDetails(path[path.length - 1]);
          const amountInExact =
            tx.value == 0
              ? Number(amountIn) / Math.pow(10, Number(tokenA.decimals))
              : tx.vlaue;
          const poolRate = Number(tokenA.price) / Number(tokenB.price);
          const amountOut = Number(amountInExact) * Number(poolRate);
          const gasFeeETH =
            Number(ethers.formatUnits(tx.gasPrice, "ether")) *
            Number(tx.gasLimit);
          const wETH = await getTokenDetails(
            "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
          );
          const gasFeeUSD = gasFeeETH * Number(wETH.price);
          console.log(`✅ ${swapType}`);
          console.log(`From: ${tx.from}`);
          console.log(
            `- Swap: ${amountInExact} (${tokenA.symbol.toUpperCase()}) -> ` +
              `${amountOut} (${tokenB.symbol.toUpperCase()})`
          );
          console.log(
            `  |_${tokenA.tokenName}:\tCurrent Price: $${tokenA.price}, ` +
              `Supply: ${tokenA.supply}\t`
          );
          console.log(
            `  |_${tokenB.tokenName}:\tCurrent Price: $${tokenB.price}, ` +
              `Supply: ${tokenB.supply}\t`
          );
          console.log(`Gas Fee: $${gasFeeUSD.toFixed(2)}
          )}`);
          // console.log(`Value: ${ethers.formatEther(tx.value)} ETH`);
        } else {
          console.log(`🚫 ${swapType}`);
        }
        console.log(`🔗 Tx: https://etherscan.io/tx/${tx.hash}`);
        console.log("---------------------------------\n");
      }
    }
  }
}

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
checkPendingTransactions();

setInterval(checkPendingTransactions, 1000);
