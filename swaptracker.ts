import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  "https://mainnet.infura.io/v3/89ad3510465c4595b5a193efd2e03937"
);

const routerAddresses = {
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2: Router 2",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
};

const getDexRouter = (accountAddresses: string[]) => {
  return accountAddresses
    .filter((item) => routerAddresses[item.toLowerCase()])
    .map((item) => routerAddresses[item.toLowerCase()]);
};

const SWAP_EVENT_SIGNATURE = ethers.id(
  "Swap(address,uint256,uint256,uint256,uint256,address)"
);

const monitoredAddress = "";

async function getTransactionDetails(txHash: string) {
  try {
    const transaction = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!transaction || !receipt) {
      console.log("Transaction not found or receipt not yet available");
      return;
    }

    console.log("✅ Transaction Details:");
    console.log(`Hash: ${transaction.hash}`);
    console.log(`From: ${transaction.from}`);
    console.log(`To: ${transaction.to}`);
    console.log(`Value: ${ethers.formatEther(transaction.value)} ETH`);
    console.log(
      `Gas Price: ${ethers.formatUnits(transaction.gasPrice, "gwei")} Gwei`
    );
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

    // Identify the router used
    const routerUsed =
      getDexRouter([transaction.to || ""])[0] || "Unknown Router";
    console.log(`Router: ${routerUsed} (${transaction.to})`);

    // Parsing logs to identify events
    console.log("Logs:");
    for (const log of receipt.logs) {
      const eventSignature = log.topics[0];

      if (eventSignature === SWAP_EVENT_SIGNATURE) {
        console.log("Event: Swap");
      } else {
        console.log("Event: Other");
      }

      console.log(`Address: ${log.address}`);
      console.log("---");
    }
  } catch (error) {
    console.error("Error fetching transaction details:", error);
  }
}

const txHash =
  "0xcd6ecb96d676915a273af77eed9517891ebfcb39357fbe036319623f5a9a4a5c";

getTransactionDetails(txHash);
