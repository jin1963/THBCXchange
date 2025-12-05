// app.js - Kaojino THBC Exchange (ethers.js version)

let injected;
let provider;
let signer;
let currentAccount = null;

let usdtContract;
let exchangeContract;

const zeroAddress = "0x0000000000000000000000000000000000000000";

function $(id) {
  return document.getElementById(id);
}

/**
 * เลือก provider แบบ safe:
 *  1) ถ้ามี window.ethereum ใช้อันนี้ก่อน (MetaMask / Binance / Bitget ส่วนใหญ่แชร์ตัวนี้)
 *  2) ถ้าไม่มี ค่อยลอง BinanceChain, bitget, bitkeep
 */
function getInjectedProvider() {
  if (window.ethereum && typeof window.ethereum.request === "function") {
    return window.ethereum;
  }
  if (window.BinanceChain && typeof window.BinanceChain.request === "function") {
    return window.BinanceChain;
  }
  if (window.bitget && window.bitget.ethereum && typeof window.bitget.ethereum.request === "function") {
    return window.bitget.ethereum;
  }
  if (window.bitkeep && window.bitkeep.ethereum && typeof window.bitkeep.ethereum.request === "function") {
    return window.bitkeep.ethereum;
  }
  return null;
}

/* ====================== UI MESSAGE HELPER ===================== */

function setTxMessage(text, type) {
  const el = $("txMessage");
  if (!el) return;
  el.textContent = text || "";

  if (type === "success") {
    el.style.color = "#4CAF50"; // เขียว
  } else if (type === "error") {
    el.style.color = "#FF5252"; // แดง
  } else {
    el.style.color = "#FFFFFF"; // ขาว/default
  }
}

/* ===================== ADD THBC TO WALLET ==================== */

async function addTHBCToWallet() {
  try {
    const injectedProvider = getInjectedProvider();
    if (!injectedProvider) return;

    if (!window.THBC_CONFIG || !window.THBC_CONFIG.thbc) return;

    const tokenAddress = window.THBC_CONFIG.thbc.address;
    const tokenSymbol = "THBC";
    const tokenDecimals = 18;
    const tokenImage = "https://example.com/thbc.png"; // เปลี่ยนเป็นรูปจริงได้

    const wasAdded = await injectedProvider.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: tokenAddress,
          symbol: tokenSymbol,
          decimals: tokenDecimals,
          image: tokenImage
        }
      }
    });

    if (wasAdded) {
      setTxMessage("THBC was added to your wallet ✅", "success");
    }
  } catch (err) {
    console.error("wallet_watchAsset error:", err);
  }
}

/* ============================ INIT ============================ */

async function init() {
  injected = getInjectedProvider();
  if (!injected) {
    console.warn("No injected wallet found (MetaMask / Binance / Bitget)");
  }

  const amtInput = $("usdtAmount");
  if (amtInput) amtInput.addEventListener("input", updatePreviewTHBC);

  if ($("btnConnect")) $("btnConnect").onclick = connectWallet;
  if ($("btnApprove")) $("btnApprove").onclick = onApproveUSDT;
  if ($("btnBuy")) $("btnBuy").onclick = onBuyTHBC;
  if ($("btnCopy")) $("btnCopy").onclick = onCopyRef;
  if ($("btnAddTHBC")) $("btnAddTHBC").onclick = addTHBCToWallet;

  updatePreviewTHBC();
  updateReferralLinkUI();
}

/* ======================= CONNECT WALLET ======================= */

async function connectWallet() {
  try {
    injected = getInjectedProvider();
    if (!injected) {
      alert("ไม่พบ Wallet (MetaMask / Binance / Bitget) ในเบราว์เซอร์");
      return;
    }

    provider = new ethers.providers.Web3Provider(injected, "any");

    let accounts;
    // พยายามใช้ provider.send ก่อน (รองรับ EIP-1193 ส่วนใหญ่)
    try {
      accounts = await provider.send("eth_requestAccounts", []);
    } catch (e) {
      // ถ้า wallet แปลก ๆ ไม่รองรับ send ให้ fallback ไปใช้ injected.request
      if (typeof injected.request === "function") {
        accounts = await injected.request({ method: "eth_requestAccounts" });
      } else {
        throw e;
      }
    }

    if (!accounts || !accounts.length) {
      alert("ไม่พบบัญชีใน Wallet");
      return;
    }

    currentAccount = accounts[0];

    const network = await provider.getNetwork();
    if (network.chainId !== 56) {
      alert(
        "กรุณาเลือก BNB Smart Chain (chainId 56) ใน Wallet ก่อน\n" +
        "ปัจจุบัน chainId = " + network.chainId
      );
      throw new Error("Wrong network: " + network.chainId);
    }

    signer = provider.getSigner();

    const cfg = window.THBC_CONFIG;
    usdtContract = new ethers.Contract(cfg.usdt.address, cfg.usdt.abi, signer);
    exchangeContract = new ethers.Contract(
      cfg.exchange.address,
      cfg.exchange.abi,
      signer
    );

    if ($("btnConnect")) {
      const short =
        currentAccount.slice(0, 6) +
        "..." +
        currentAccount.slice(currentAccount.length - 4);
      $("btnConnect").textContent = short;
    }

    updateReferralLinkUI();

    if (injected && injected.on) {
      injected.on("accountsChanged", () => window.location.reload());
      injected.on("chainChanged", () => window.location.reload());
    }
  } catch (err) {
    console.error("connectWallet error:", err);
    alert("เชื่อมต่อกระเป๋าไม่สำเร็จ: " + (err.message || err));
  }
}

/* ======================= PREVIEW THBC ========================= */

function updatePreviewTHBC() {
  const amountStr = $("usdtAmount")?.value || "0";
  const num = parseFloat(amountStr) || 0;
  const rate = window.THBC_CONFIG
    ? window.THBC_CONFIG.uiRateThbcPerUsdt
    : 35;
  const thbc = num * rate;
  if ($("thbcReceive")) {
    $("thbcReceive").textContent = thbc.toFixed(2);
  }
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

    if (!usdtContract) {
      usdtContract = new ethers.Contract(
        cfg.usdt.address,
        cfg.usdt.abi,
        signer
      );
    }

    setTxMessage("Sending approve transaction...", "info");

    const max = ethers.constants.MaxUint256;
    const tx = await usdtContract.approve(cfg.exchange.address, max);

    if (!tx || !tx.hash) {
      throw new Error("Wallet did not return transaction object");
    }

    await tx.wait();

    setTxMessage("Unlimited USDT approval successful.", "success");
    if ($("btnApprove")) $("btnApprove").textContent = "Approved ✓";
  } catch (err) {
    console.error("Approve error:", err);
    setTxMessage(
      "Approve failed: " +
        (err.data?.message || err.error?.message || err.message || err),
      "error"
    );
  }
}

/* =========================== BUY THBC ========================= */

function getReferrerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && ethers.utils.isAddress(ref)) return ref;
  return zeroAddress;
}

async function onBuyTHBC() {
  setTxMessage("", "info");

  try {
    if (!signer || !currentAccount) {
      await connectWallet();
      if (!signer) return;
    }

    const amountStr = $("usdtAmount").value.trim();
    if (!amountStr || Number(amountStr) <= 0) {
      alert("กรุณาใส่จำนวน USDT ที่ต้องการใช้ซื้อ");
      return;
    }

    const usdtAmount = ethers.utils.parseUnits(amountStr, 18);
    const referrer = getReferrerFromUrl();

    const cfg = window.THBC_CONFIG;
    if (!exchangeContract) {
      exchangeContract = new ethers.Contract(
        cfg.exchange.address,
        cfg.exchange.abi,
        signer
      );
    }

    setTxMessage("Sending buy transaction...", "info");

    const tx = await exchangeContract.buyTHBCWithUSDT(usdtAmount, referrer);
    if (!tx || !tx.hash) {
      throw new Error("Wallet did not return transaction object");
    }

    await tx.wait();

    setTxMessage("Buy THBC success! ✅", "success");

    // เสนอให้เพิ่ม THBC เข้า wallet หลังซื้อสำเร็จ
    addTHBCToWallet();
  } catch (err) {
    console.error("Buy error:", err);
    setTxMessage(
      "Buy failed: " +
        (err.data?.message ||
          err.error?.message ||
          err.reason ||
          err.message ||
          err),
      "error"
    );
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
