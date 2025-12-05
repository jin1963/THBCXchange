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
 * เลือก provider ให้รองรับ Bitget / Bitkeep / Binance / MetaMask
 */
function getInjectedProvider() {
  // Bitget / Bitkeep (ใช้ window.bitkeep.ethereum ตาม docs)
  if (window.bitkeep && window.bitkeep.ethereum) {
    return window.bitkeep.ethereum;
  }

  // Bitget (บางตัวใช้ window.bitget.ethereum)
  if (window.bitget && window.bitget.ethereum) {
    return window.bitget.ethereum;
  }

  // Binance Extension / Dapp Browser
  if (window.BinanceChain) {
    return window.BinanceChain;
  }

  // MetaMask / wallet อื่น ๆ
  if (window.ethereum) {
    return window.ethereum;
  }

  return null;
}

/* ====================== UI MESSAGE HELPER ===================== */

function setTxMessage(text, type) {
  const el = $("txMessage");
  if (!el) return;
  el.textContent = text || "";

  // type: "success" | "error" | "info"
  if (type === "success") {
    el.style.color = "#4CAF50"; // เขียว
  } else if (type === "error") {
    el.style.color = "#FF5252"; // แดง
  } else {
    el.style.color = "#FFFFFF"; // ขาว
  }
}

/* ============================ INIT ============================ */

async function init() {
  injected = getInjectedProvider();
  if (!injected) {
    console.warn("No injected wallet found (MetaMask / Bitget / Binance)");
  }

  // ให้ input คำนวน THBC ทันทีเวลาพิมพ์
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
      alert("ไม่พบ Wallet (MetaMask / Bitget / Binance) ในเบราว์เซอร์");
      return;
    }

    // ---- ตรงนี้คือจุดสำคัญ: รองรับทั้ง request() และ enable() ----
    let accounts;
    if (typeof injected.request === "function") {
      accounts = await injected.request({ method: "eth_requestAccounts" });
    } else if (typeof injected.enable === "function") {
      accounts = await injected.enable(); // สำหรับ Bitget / wallet รุ่นเก่า
    } else {
      throw new Error("Wallet provider ไม่รองรับ eth_requestAccounts หรือ enable()");
    }
    // ----------------------------------------------------------------

    if (!accounts || !accounts.length) {
      alert("ไม่พบบัญชีใน Wallet");
      return;
    }

    currentAccount = accounts[0];

    provider = new ethers.providers.Web3Provider(injected, "any");

    // เช็ค network ต้องเป็น BSC mainnet (56)
    const network = await provider.getNetwork();
    if (network.chainId !== 56) {
      alert("กรุณาเลือก BNB Smart Chain (chainId 56) ใน Wallet ก่อน");
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

    // เปลี่ยนปุ่ม Connect ให้โชว์ address สั้น ๆ
    if ($("btnConnect")) {
      const short =
        currentAccount.slice(0, 6) +
        "..." +
        currentAccount.slice(currentAccount.length - 4);
      $("btnConnect").textContent = short;
    }

    // อัปเดต referral link ให้เป็นกระเป๋าปัจจุบัน
    updateReferralLinkUI();

    // ถ้าเปลี่ยน account / chain ให้รีโหลดหน้าใหม่
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

    const usdtAmount = ethers.utils.parseUnits(amountStr, 18); // USDT BSC = 18 decimals
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

    setTxMessage("Buy THBC success!", "success");
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
