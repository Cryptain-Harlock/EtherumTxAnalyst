import { ethers } from "ethers";
import { Interface } from "@ethersproject/abi";

// WebSocket provider URL
const provider = new ethers.WebSocketProvider(
  "wss://mainnet.infura.io/ws/v3/89ad3510465c4595b5a193efd2e03937"
);

// ABI interfaces for ERC20, ERC721, and ERC1155
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const ERC1155_ABI = [
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
];

const erc20Interface = new Interface(ERC20_ABI);
const erc721Interface = new Interface(ERC721_ABI);
const erc1155Interface = new Interface(ERC1155_ABI);

// List of addresses to monitor
const monitoredAddresses = ["0x2AD5275aEfb3E240aD15cD24f7Efe4948cC5A480"];

// Generic function to get balance (handles both ERC20 and ERC721)
async function getBalance(
  tokenAddress: string,
  walletAddress: string,
  isNFT: boolean = false,
  tokenId?: string
) {
  let contract, balance;
  if (isNFT) {
    contract = new ethers.Contract(
      tokenAddress,
      tokenId ? ERC1155_ABI : ERC721_ABI,
      provider
    );
    balance = tokenId
      ? await contract.balanceOf(walletAddress, tokenId)
      : await contract.balanceOf(walletAddress);
  } else {
    contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    balance = await contract.balanceOf(walletAddress);
  }
  return balance;
}

// Listen for pending transactions
provider.on("pending", async (txHash) => {
  //   console.log(`Monitoring pending transactions: ${txHash}`);
  try {
    const tx = await provider.getTransaction(txHash);

    if (
      tx &&
      (monitoredAddresses.includes(tx.from) ||
        monitoredAddresses.includes(tx.to || ""))
    ) {
      console.log(`Monitored Address Transaction: ${txHash}`);

      if (tx.data !== "0x") {
        // Check if the transaction has input data
        let decodedInput;
        let isERC20 = false;
        let isERC721 = false;
        let isERC1155 = false;

        try {
          decodedInput = erc20Interface.parseTransaction({
            data: tx.data,
            value: tx.value,
          });
          isERC20 = true;
        } catch {}

        if (!isERC20) {
          try {
            decodedInput = erc721Interface.parseTransaction({
              data: tx.data,
              value: tx.value,
            });
            isERC721 = true;
          } catch {}
        }

        if (!isERC20 && !isERC721) {
          try {
            decodedInput = erc1155Interface.parseTransaction({
              data: tx.data,
              value: tx.value,
            });
            isERC1155 = true;
          } catch {}
        }

        const from = tx.from;
        const to = decodedInput.args[0]; // Recipient address
        const tokenAddress = tx.to || ""; // Assuming `to` is the token or NFT contract address

        if (isERC20) {
          const preBalanceFrom = await getBalance(tokenAddress, from, false);
          const preBalanceTo = await getBalance(tokenAddress, to, false);

          const receipt = await provider.waitForTransaction(txHash);
          if (receipt && receipt.status === 1) {
            const postBalanceFrom = await getBalance(tokenAddress, from, false);
            const postBalanceTo = await getBalance(tokenAddress, to, false);

            console.log(`ERC20 Swap Detected`);
            console.log(`Swapped Token: ${tokenAddress}`);
            console.log(`From: ${from}`);
            console.log(`To: ${to}`);
            console.log(
              `Pre-Balance (From): ${ethers.formatUnits(preBalanceFrom, 18)}`
            );
            console.log(
              `Post-Balance (From): ${ethers.formatUnits(postBalanceFrom, 18)}`
            );
            console.log(
              `Pre-Balance (To): ${ethers.formatUnits(preBalanceTo, 18)}`
            );
            console.log(
              `Post-Balance (To): ${ethers.formatUnits(postBalanceTo, 18)}`
            );
            console.log(`Transaction Link: https://etherscan.io/tx/${txHash}`);
          }
        } else if (isERC721) {
          const tokenId = decodedInput.args[2];
          const preBalanceFrom = await getBalance(tokenAddress, from, true);
          const preBalanceTo = await getBalance(tokenAddress, to, true);

          const receipt = await provider.waitForTransaction(txHash);
          if (receipt && receipt.status === 1) {
            const postBalanceFrom = await getBalance(tokenAddress, from, true);
            const postBalanceTo = await getBalance(tokenAddress, to, true);

            console.log(`ERC721 Transfer Detected`);
            console.log(`NFT Contract: ${tokenAddress}`);
            console.log(`From: ${from}`);
            console.log(`To: ${to}`);
            console.log(`Token ID: ${tokenId}`);
            console.log(`Pre-Balance (From): ${preBalanceFrom}`);
            console.log(`Post-Balance (From): ${postBalanceFrom}`);
            console.log(`Pre-Balance (To): ${preBalanceTo}`);
            console.log(`Post-Balance (To): ${postBalanceTo}`);
            console.log(`Transaction Link: https://etherscan.io/tx/${txHash}`);
          }
        } else if (isERC1155) {
          const tokenId = decodedInput.args[2];
          const preBalanceFrom = await getBalance(
            tokenAddress,
            from,
            true,
            tokenId
          );
          const preBalanceTo = await getBalance(
            tokenAddress,
            to,
            true,
            tokenId
          );

          const receipt = await provider.waitForTransaction(txHash);
          if (receipt && receipt.status === 1) {
            const postBalanceFrom = await getBalance(
              tokenAddress,
              from,
              true,
              tokenId
            );
            const postBalanceTo = await getBalance(
              tokenAddress,
              to,
              true,
              tokenId
            );

            console.log(`ERC1155 Transfer Detected`);
            console.log(`NFT Contract: ${tokenAddress}`);
            console.log(`From: ${from}`);
            console.log(`To: ${to}`);
            console.log(`Token ID: ${tokenId}`);
            console.log(`Pre-Balance (From): ${preBalanceFrom}`);
            console.log(`Post-Balance (From): ${postBalanceFrom}`);
            console.log(`Pre-Balance (To): ${preBalanceTo}`);
            console.log(`Post-Balance (To): ${postBalanceTo}`);
            console.log(`Transaction Link: https://etherscan.io/tx/${txHash}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error processing transaction ${txHash}:`, error);
  }
});

provider.on("error", (err) => {
  console.error("WebSocket Error: ", err);
});
