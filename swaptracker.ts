import { ethers } from "ethers";

// Define Uniswap ABI for event decoding
const UNISWAP_ROUTER_ABI = [
  "event Swap(address indexed sender, address indexed fromToken, address indexed toToken, uint amountIn, uint amountOut)"
];

const INFURA_PROJECT_ID = "89ad3510465c4595b5a193efd2e03937";
const PROVIDER = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`);
const UNISWAP_ROUTER_ADDRESS = "0x2AD5275aEfb3E240aD15cD24f7Efe4948cC5A480";

// Function to get token details from transaction
async function getTokenDetails(tokenAddress: string) {
  const tokenContract = new ethers.Contract(tokenAddress, ["function name() view returns (string)", "function symbol() view returns (string)"], PROVIDER);
  const [name, symbol] = await Promise.all([tokenContract.name(), tokenContract.symbol()]);
  return { name, symbol };
}

// Function to monitor pending transactions
async function monitorPendingTransactions() {
  PROVIDER.on("pending", async (txHash) => {
    const tx = await PROVIDER.getTransaction(txHash);
    
    if (tx && tx.to === UNISWAP_ROUTER_ADDRESS) {
      try {
        const abiCoder = new ethers.AbiCoder();
        const decodedData = abiCoder.decode(
          ["address", "address", "address", "uint256", "uint256"],
          tx.data
        );
        
        const [sender, fromToken, toToken, amountIn, amountOut] = decodedData;
        const fromTokenDetails = await getTokenDetails(fromToken);
        const toTokenDetails = await getTokenDetails(toToken);

        const balanceBefore = await PROVIDER.getBalance(sender);
        // Call your function to process or wait for the transaction to be mined before fetching balance after swap

        const balanceAfter = await PROVIDER.getBalance(sender);

        const balanceDifference = ethers.formatEther(balanceAfter.sub(balanceBefore));

        console.log(`Swap detected:
          Sender: ${sender}
          From Token: ${fromTokenDetails.name} (${fromTokenDetails.symbol})
          To Token: ${toTokenDetails.name} (${toTokenDetails.symbol})
          Amount In: ${ethers.formatEther(amountIn)}
          Amount Out: ${ethers.formatEther(amountOut)}
          Balance Before: ${ethers.formatEther(balanceBefore)}
          Balance After: ${ethers.formatEther(balanceAfter)}
          Balance Difference: ${balanceDifference}
          Transaction Hash: ${txHash}`);
      } catch (error) {
        console.error("Error decoding transaction data:", error);
      }
    }
  });
}

// Start monitoring
monitorPendingTransactions().catch(console.error);
