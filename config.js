// =======================================================
// config.js - Kaojino THBC Exchange (BSC Mainnet)
// =======================================================

// ----------------- Network -----------------
const BSC_CHAIN_ID = 56;
const BSC_CHAIN_NAME = "BNB Smart Chain";

// ----------------- USDT (BEP20) -----------------
// USDT บน BSC = 18 decimals (สำคัญมาก)
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

// ----------------- THBC Token -----------------
const THBC_ADDRESS = "0xe8d4687b77B5611eF1828FDa7428034FA12a1Beb";

const THBC_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

// ----------------- Exchange Contract -----------------
/*
  Contract: KaojinoTHBCExchange
  ฟังก์ชันหลัก:
  - buyTHBCWithUSDT(uint256 usdtAmount, address referrer)
*/
const EXCHANGE_ADDRESS = "0xe584224ec67a1e6CC52B83023fc5336b12664a3d";

const EXCHANGE_ABI = [
  "function buyTHBCWithUSDT(uint256 usdtAmount, address referrer)",
  "function getReferralRates() view returns (uint256 level1Bps, uint256 level2Bps, uint256 level3Bps)",
  "function getReferrers(address user) view returns (address ref1, address ref2, address ref3)"
];

// ----------------- UI / Business Logic -----------------
/*
  uiRateThbcPerUsdt
  ใช้สำหรับ:
  - คำนวณแสดงผลหน้าเว็บ
  - ต้องตรงกับ logic ใน contract
*/
const UI_RATE_THBC_PER_USDT = 35;

// ----------------- EXPORT TO WINDOW -----------------
window.THBC_CONFIG = {
  network: {
    chainId: BSC_CHAIN_ID,
    name: BSC_CHAIN_NAME
  },

  uiRateThbcPerUsdt: UI_RATE_THBC_PER_USDT,

  usdt: {
    address: USDT_ADDRESS,
    abi: USDT_ABI,
    decimals: 18
  },

  thbc: {
    address: THBC_ADDRESS,
    abi: THBC_ABI,
    decimals: 18
  },

  exchange: {
    address: EXCHANGE_ADDRESS,
    abi: EXCHANGE_ABI
  }
};
