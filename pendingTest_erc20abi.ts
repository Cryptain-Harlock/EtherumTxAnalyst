import { ethers } from "ethers";
import ERC20_ABI from "./erc20_abi";
import { FACTORY_ABI, UNISWAP_FACTORY_ADDRESS } from "./factory_abi";
import { poolABI } from "./pool_abi";

const provider = new ethers.WebSocketProvider(
  `wss://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
);

const monitoredAddress = [
  "0xb0ba33566bd35bcb80738810b2868dc1ddd1f0e9",
  "0x3b40af8e80b09f4a54b1eb763031d4880f765bdc",
  "0xab7b44ae25af88d306dc0a5c6c39bbeb8916eabb",
  "0x49c543e8873aeda1b60c176f55a78fc62f9c9fbb",
  "0x3ccce09b4ad94968f269375c0999134a6617f795",
  "0xacbcb2724cfafb839c752d71997a8a7a16989b2e",
  "0x16d59f67bd39ac0d952e48648548217b62183403",
  "0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13",
].map((address) => address.toLowerCase());

const processedTransactions = new Set<string>();
const pendingTransactionsTime = new Map<string, number>();

async function getTokenDetails(tokenAddress: string) {
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    );

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
  } catch (error) {
    console.error("Error fetching token details:", error);
    return { tokenName: "Unknown", symbol: "Unknown", supply: 0, decimals: 18 };
  }
}

async function getPrice(tokenAddressA: any, tokenAddressB: any) {
  const factoryContract = new ethers.Contract(
    UNISWAP_FACTORY_ADDRESS,
    FACTORY_ABI,
    provider
  );

  const addressAForInput =
    tokenAddressA === ethers.ZeroAddress
      ? "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
      : tokenAddressA;
  const addressBForInput =
    tokenAddressB === ethers.ZeroAddress
      ? "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
      : tokenAddressB;

  const pairAddress = await factoryContract.getPair(
    addressAForInput,
    addressBForInput
  );

  if (pairAddress === ethers.ZeroAddress) {
    console.log("No pools exists for these tokens pair.");
    return null;
  }

  const pairContract = new ethers.Contract(pairAddress, poolABI, provider);

  const [reserve0, reserve1] = await pairContract.getReserves();
  const token0 = await pairContract.token0();
  const token1 = await pairContract.token1();

  let price: number;
  if (token0.toLowerCase() === token0.toLowerCase()) {
    price = Number(reserve1 * 1.0) / Number(reserve0);
  } else {
    price = Number(reserve0 * 1.0) / Number(reserve1);
  }

  console.log(
    `Price of ${tokenAddressA} in terms of ${tokenAddressB}: ${price}`
  );
  return price;
}

async function decodeInputData(tx: string): Promise<{
  swapType: string;
  path: string[];
}> {
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
    return { swapType: "Unknown", path: [] };
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
        };
      } else {
        return {
          swapType: functionName,
          path: decodedData[2],
        };
      }
    } catch (e) {
      continue;
    }
  }

  return { swapType: "Not a Swap!", path: [] };
}

async function checkPendingTransactions() {
  const pendingTransactions = await provider.send("eth_subscribe", [
    "newPendingTransactions",
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

        const { swapType, path } = await decodeInputData(tx.hash);
        if (path.length >= 2) {
          const tokenA = await getTokenDetails(path[0]);
          const tokenB = await getTokenDetails(path[path.length - 1]);
          const gasFeeETH =
            Number(ethers.formatUnits(tx.gasPrice, "ether")) *
            Number(tx.gasLimit);
          console.log("Gas Limit: ", tx.gasUsed);
          const wETH = await getTokenDetails(
            "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
          );
          // const gasFeeUSD = Number(gasFeeETH) * Number(wETH.price);
          // const gasFeeUSD =
          //   Number(ethers.formatEther(tx.maxFeePerGas)) * Number(wETH.price);

          console.log(`✅ ${swapType}`);
          console.log(`From: ${tx.from}`);
          console.log(
            // `- Swap: ${amountInExact} (${tokenA.symbol.toUpperCase()}) -> ` +
            `- Swap: (${tokenA.symbol.toUpperCase()}) -> ` +
              `(${tokenB.symbol.toUpperCase()})`
          );
          console.log(
            // `  |_${tokenA.tokenName}:\tCurrent Price: $${tokenA.price}, ` +
            `  |_${tokenA.tokenName}:\tCurrent Price: $, ` +
              `Supply: ${tokenA.supply}\t`
          );
          console.log(
            // `  |_${tokenB.tokenName}:\tCurrent Price: $${tokenB.price}, ` +
            `  |_${tokenB.tokenName}:\tCurrent Price: $, ` +
              `Supply: ${tokenB.supply}\t`
          );
          const price = await getPrice(tokenA.address, tokenB.address);
          // console.log(`Price: $${price.toFixed(2)}`);
          // console.log(`Gas Fee: $${gasFeeUSD.toFixed(2)} Estimated`);
          // console.log(`Value: ${ethers.formatEther(tx.value)} ETH`);
        } else {
          console.log(`🚫 ${swapType}`);
        }
        console.log(`🔗 Tx: https://etherscan.io/tx/${tx.hash}`);
        console.log("---------------------------------\n");

        // const checkReceipt = async () => {
        //   const receipt = await provider.getTransactionReceipt(tx.hash);
        //   if (receipt) {
        //     const pendingTime =
        //       Date.now() - pendingTransactionsTime.get(tx.hash)!;
        //     console.log(
        //       `\n🕒 Transaction was pending for ${(pendingTime / 1000).toFixed(
        //         2
        //       )} seconds`
        //     );
        //     console.log(
        //       `Transaction Status: ${
        //         receipt.status === 1 ? "Success" : "Failed"
        //       }`
        //     );
        //     console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

        //     if (receipt.logs.length > 0) {
        //       receipt.logs.forEach((log) => {});
        //     }
        //     console.log("====================================================");
        //   } else {
        //     setTimeout(checkReceipt, 1000);
        //   }
        // };
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
