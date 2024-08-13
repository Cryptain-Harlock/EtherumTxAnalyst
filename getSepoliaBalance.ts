import { ethers } from "ethers";

async function getSepoliaBalance(address: string) {
  // Connect to the Sepolia testnet via Infura provider
  const provider = new ethers.JsonRpcProvider(
    "https://sepolia.infura.io/v3/89ad3510465c4595b5a193efd2e03937"
  );

  const balance = await provider.getBalance(address);
  const balanceInEther = ethers.formatEther(balance);
  console.log(`Balance of ${address}: ${balanceInEther} SepoliaETH`);
}

const walletAddress = "0x2AD5275aEfb3E240aD15cD24f7Efe4948cC5A480";

getSepoliaBalance(walletAddress).catch(console.error);
