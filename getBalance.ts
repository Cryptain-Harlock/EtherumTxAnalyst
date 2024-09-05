import { ethers } from "ethers";

const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const WETH_ABI = ["function balanceOf(address) view returns (uint256)"];

const provider = new ethers.WebSocketProvider(
  // `https://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
  `wss://eth-mainnet.g.alchemy.com/v2/lBsnumlNVsOQUAoLYFwEFlnLkqYmkISK`
);
async function getBalance(addresses) {
  const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, provider);

  for (const address of addresses) {
    const ethBalance = await provider.getBalance(address);
    const ethBalanceInEther = ethers.formatEther(ethBalance);

    const wethBalance = await wethContract.balanceOf(address);
    const wethBalanceInEther = ethers.formatEther(wethBalance);
    console.log(
      `- ${address}: ${ethBalanceInEther} ETH / ${wethBalanceInEther} WETH`
    );
  }
}

const monitoredAddress = [
  "0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13",
  "0xb0ba33566bd35bcb80738810b2868dc1ddd1f0e9",
  "0x3b40af8e80b09f4a54b1eb763031d4880f765bdc",
  "0xab7b44ae25af88d306dc0a5c6c39bbeb8916eabb",
  "0xacbcb2724cfafb839c752d71997a8a7a16989b2e",
  "0x49c543e8873aeda1b60c176f55a78fc62f9c9fbb",
  "0x3ccce09b4ad94968f269375c0999134a6617f795",
  "0x16d59f67bd39ac0d952e48648548217b62183403",
].map((address) => address.toLowerCase());

getBalance(monitoredAddress).catch(console.error);
