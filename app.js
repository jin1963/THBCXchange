// app.js - Kaojino THBC Exchange (ethers.js) - Bitget/MetaMask safe version

let injected;
let provider;
let signer;
let currentAccount = null;

let usdtContract;
let thbcContract;
let exchangeContract;

const zeroAddress = "0x0000000000000000000000000000000000000000";

function $(id) {
  return document.getElementById(id);
}

/**
 * เลือก provider ให้รองรับ Bitget / Bitkeep / MetaMask
 * - Bitget ก่อน
 * - Bitkeep รองลงมา
 * - สุดท้าย MetaMask (window.ethereum)
 */
function getInjectedProvider() {
  if (window.bitget && window.bitget.ethereum) return window.bitget.ethereum;
  if (window.bitkeep && window.bitkeep.ethereum) return window.bitkeep.ethereum;
  if (window.ethereum) return window.ethereum;
  return null;
}

/* ====================== UI MESSAGE HELPER ===================== */

function setTxMessage(text, type = "info") {
  const el = $("txMessage");
  if (!el) return;
  el.textContent = text || "";

  if (type === "success") el.style.color = "#4CAF50";
  else if (type === "error") el.style.color = "#FF5252";
  else el.style.color = "#FFFFFF";
}

function shortAddr(a) {
  if (!a) return "-";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

/* ============================ INIT ============================ */

async function init() {
  injected = getInjectedProvider();
  if (!injected) console.warn("No injected wallet found (MetaMask / Bitget)");

  const amtInput = $("usdtAmount");
  if (amtInput) amtInput.addEventListener("input", updatePreviewTHBC);

  if ($("btnConnect")) $("btnConnect").onclick = connectWallet;
  if ($("btnApprove")) $("btnApprove").onclick = onApproveUSDT;
  if ($("btnBuy")) $("btnBuy").onclick = onBuyTHBC;
  if ($("btnCopy")) $("btnCopy").onclick = onCopyRef;

  updatePreviewTHBC();
  updateReferralLinkUI();
}

/* ======================= CONNECT WALLET ======================= */

async function connectWallet() {
  try {
    injected = getInjectedProvider();
    if (!injected) {
      alert("ไม่พบ Wallet (MetaMask / Bitget) ในเบราว์เซอร์");
      return;
    }

    provider = new ethers.providers.Web3Provider(injected, "any");

    const accounts = await injected.request({ method: "eth_requestAccounts" });
    if (!accounts || !accounts.length) {
      alert("ไม่พบบัญชีใน Wallet");
      return;
    }

    currentAccount = accounts[0];

    // เช็ค network ต้องเป็น BSC mainnet (56)
    const network = await provider.getNetwork();
    if (network.chainId !== 56) {
      alert("กรุณาเลือก BNB Smart Chain (chainId 56) ใน Wallet ก่อน");
      throw new Error("Wrong network: " + network.chainId);
    }

    signer = provider.getSigner();

    const cfg = window.THBC_CONFIG;

    usdtContract = new ethers.Contract(cfg.usdt.address, cfg.usdt.abi, signer);
    thbcContract = new ethers.Contract(cfg.thbc.address, cfg.thbc.abi, signer);
    exchangeContract = new ethers.Contract(cfg.exchange.address, cfg.exchange.abi, signer);

    if ($("btnConnect")) $("btnConnect").textContent = shortAddr(currentAccount);

    updateReferralLinkUI();
    updatePreviewTHBC();

    // optional UI fields (ถ้ามี)
    await refreshBalancesSafe();
    await refreshApproveStateSafe();

    // reload on change
    if (injected && injected.on) {
      injected.on("accountsChanged", () => window.location.reload());
      injected.on("chainChanged", () => window.location.reload());
    }

    setTxMessage("Wallet connected ✓", "success");
  } catch (err) {
    console.error("connectWallet error:", err);
    alert("เชื่อมต่อกระเป๋าไม่สำเร็จ: " + (err.message || err));
  }
}

/* ======================= PREVIEW THBC ========================= */

function updatePreviewTHBC() {
  const amountStr = $("usdtAmount")?.value || "0";
  const num = parseFloat(amountStr) || 0;
  const rate = window.THBC_CONFIG ? window.THBC_CONFIG.uiRateThbcPerUsdt : 35;
  const thbc = num * rate;

  if ($("thbcReceive")) $("thbcReceive").textContent = thbc.toFixed(2);
}

/* ========================= REFERRER =========================== */

function getReferrerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && ethers.utils.isAddress(ref)) {
    // กันแนะนำตัวเอง
    if (currentAccount && ref.toLowerCase() === currentAccount.toLowerCase()) return zeroAddress;
    return ref;
  }
  return zeroAddress;
}

/* ========================= ALLOWANCE ========================== */

async function ensureAllowance(requiredWei) {
  const cfg = window.THBC_CONFIG;

  const allowance = await usdtContract.allowance(currentAccount, cfg.exchange.address);
  if (allowance.gte(requiredWei)) return;

  setTxMessage("Approving USDT (required)...", "info");

  const gasPrice = await provider.getGasPrice();
  const tx = await usdtContract.approve(cfg.exchange.address, ethers.constants.MaxUint256, {
    gasLimit: 120000,
    gasPrice
  });

  if (!tx || !tx.hash) throw new Error("Wallet did not return transaction object (approve)");

  await tx.wait();

  setTxMessage("USDT approved ✓", "success");
  if ($("btnApprove")) $("btnApprove").textContent = "Approved ✓";
}

/* ========================= APPROVE USDT ======================= */

async function onApproveUSDT() {
  setTxMessage("", "info");

  try {
    if (!signer || !currentAccount) {
      await connectWallet();
      if (!signer) return;
    }

    const cfg = window.THBC_CONFIG;

    setTxMessage("Sending approve transaction...", "info");

    const gasPrice = await provider.getGasPrice();
    const tx = await usdtContract.approve(cfg.exchange.address, ethers.constants.MaxUint256, {
      gasLimit: 120000,
      gasPrice
    });

    if (!tx || !tx.hash) throw new Error("Wallet did not return transaction object");

    await tx.wait();

    setTxMessage("Unlimited USDT approval successful.", "success");
    if ($("btnApprove")) $("btnApprove").textContent = "Approved ✓";
  } catch (err) {
    console.error("Approve error:", err);
    setTxMessage(
      "Approve failed: " + (err.data?.message || err.error?.message || err.message || err),
      "error"
    );
  }
}

/* =========================== BUY THBC ========================= */

async function onBuyTHBC() {
  setTxMessage("", "info");

  try {
    if (!signer || !currentAccount) {
      await connectWallet();
      if (!signer) return;
    }

    const amountStr = $("usdtAmount")?.value?.trim();
    if (!amountStr || Number(amountStr) <= 0) {
      alert("กรุณาใส่จำนวน USDT ที่ต้องการใช้ซื้อ");
      return;
    }

    // USDT BSC = 18 decimals
    const usdtAmountWei = ethers.utils.parseUnits(amountStr, 18);

    // referrer
    const referrer = getReferrerFromUrl();

    // ✅ ป้องกัน Bitget revert: ensure allowance ก่อนซื้อ
    await ensureAllowance(usdtAmountWei);

    setTxMessage("Sending buy transaction...", "info");

    // ✅ Bitget friendly overrides
    const gasPrice = await provider.getGasPrice();
    const tx = await exchangeContract.buyTHBCWithUSDT(usdtAmountWei, referrer, {
      gasLimit: 600000,
      gasPrice
    });

    if (!tx || !tx.hash) throw new Error("Wallet did not return transaction object");

    await tx.wait();

    setTxMessage("Buy THBC success!", "success");

    await refreshBalancesSafe();
    await refreshApproveStateSafe();
  } catch (err) {
    console.error("Buy error:", err);
    setTxMessage(
      "Buy failed: " +
        (err.data?.message || err.error?.message || err.reason || err.message || err),
      "error"
    );
  }
}

/* ========================= OPTIONAL UI ======================== */

async function refreshBalancesSafe() {
  try {
    if (!currentAccount || !usdtContract || !thbcContract) return;

    // ถ้าใน index.html มี element เหล่านี้จะอัปเดตให้ (ไม่มีก็ไม่เป็นไร)
    const usdtBalEl = $("usdtBalance");
    const thbcBalEl = $("thbcBalance");

    const [usdtBal, thbcBal] = await Promise.all([
      usdtContract.balanceOf(currentAccount),
      thbcContract.balanceOf(currentAccount)
    ]);

    if (usdtBalEl) usdtBalEl.textContent = ethers.utils.formatUnits(usdtBal, 18);
    if (thbcBalEl) thbcBalEl.textContent = ethers.utils.formatUnits(thbcBal, 18);
  } catch (e) {
    // ไม่ต้องทำอะไร
  }
}

async function refreshApproveStateSafe() {
  try {
    if (!currentAccount || !usdtContract || !provider) return;
    const cfg = window.THBC_CONFIG;

    const allowance = await usdtContract.allowance(currentAccount, cfg.exchange.address);
    // ถ้า allowance > 0 ให้ขึ้นว่า Approved
    if ($("btnApprove")) {
      if (allowance.gt(0)) $("btnApprove").textContent = "Approved ✓";
      else $("btnApprove").textContent = "อนุมัติ USDT";
    }
  } catch (e) {
    // ignore
  }
}

/* ========================= REFERRAL LINK ====================== */

function updateReferralLinkUI() {
  const base = window.location.origin + window.location.pathname;
  const link = currentAccount ? `${base}?ref=${currentAccount}` : base;
  if ($("refLink")) $("refLink").value = link;
}

function onCopyRef() {
  const input = $("refLink");
  if (!input) return;
  input.select();
  document.execCommand("copy");
  alert("Copied referral link");
}

/* ============================ START =========================== */

window.addEventListener("load", init);
