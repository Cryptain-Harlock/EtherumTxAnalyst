import { ethers } from "ethers";

// Connect to an Ethereum provider
const provider = new ethers.JsonRpcProvider("YOUR_INFURA_OR_ALCHEMY_ENDPOINT");

// ERC-20 token ABI with the name and symbol methods
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

async function fetchPendingTransactions() {
  try {
    // Fetch the pending transactions manually (this might not be supported by all providers)
    const pendingTransactions = await provider.send(
      "eth_pendingTransactions",
      []
    );

    for (const tx of pendingTransactions) {
      // Check if the transaction is a swap (based on known function signatures)
      const methodId = tx.input.slice(0, 10); // First 4 bytes

      if (methodId === "0x38ed1739" || methodId === "0x18cbafe5") {
        // Example: swapExactTokensForTokens or swapExactETHForTokens
        const decoded = ethers.defaultAbiCoder.decode(
          ["uint256", "uint256", "address[]", "address", "uint256"],
          ethers.hexDataSlice(tx.input, 4)
        );

        const amountIn = decoded[0];
        const path: string[] = decoded[2];

        // Get details of the input token (first token in the path)
        const inputTokenAddress = path[0];
        const outputTokenAddress = path[path.length - 1];

        // Create contract instances for input and output tokens
        const inputTokenContract = new ethers.Contract(
          inputTokenAddress,
          ERC20_ABI,
          provider
        );
        const outputTokenContract = new ethers.Contract(
          outputTokenAddress,
          ERC20_ABI,
          provider
        );

        // Fetch the token names and symbols
        const [
          inputTokenName,
          inputTokenSymbol,
          outputTokenName,
          outputTokenSymbol,
        ] = await Promise.all([
          inputTokenContract.name(),
          inputTokenContract.symbol(),
          outputTokenContract.name(),
          outputTokenContract.symbol(),
        ]);

        console.log(
          `Pending Swap Detected: ${amountIn.toString()} of ${inputTokenName} (${inputTokenSymbol}) to ${outputTokenName} (${outputTokenSymbol})`
        );
      }
    }
  } catch (error) {
    console.error("Error fetching pending transactions:", error);
  }
}

// Polling function to fetch pending transactions every 10 seconds
setInterval(fetchPendingTransactions, 1000);

console.log("Polling for pending transactions...");
