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
 * เลือก provider ให้รองรับ Bitget / Bitkeep / MetaMask
 * - Bitget ก่อน
 * - Bitkeep รองลงมา
 * - สุดท้าย MetaMask (window.ethereum)
 */
function getInjectedProvider() {
  // Bitget
  if (window.bitget && window.bitget.ethereum) {
    return window.bitget.ethereum;
  }

  // Bitkeep
  if (window.bitkeep && window.bitkeep.ethereum) {
    return window.bitkeep.ethereum;
  }

  // MetaMask / Wallet อื่น ๆ ที่ใช้ window.ethereum
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
    el.style.color = "#FFFFFF"; // ขาวหรือค่าดีฟอลต์
  }
}

/* ===================== ADD THBC TO WALLET ==================== */
/**
 * เรียกให้ wallet (MetaMask / Bitget / Bitkeep ฯลฯ)
 * โชว์ popup ชวนเพิ่มเหรียญ THBC เข้า list token ของผู้ใช้
 * ใช้มาตรฐาน method: wallet_watchAsset
 */
async function addTHBCToWallet() {
  try {
    const injected = getInjectedProvider();
    if (!injected) {
      console.log("No injected wallet for wallet_watchAsset");
      return;
    }

    if (!window.THBC_CONFIG || !window.THBC_CONFIG.thbc) {
      console.log("THBC_CONFIG not found");
      return;
    }

    const tokenAddress = window.THBC_CONFIG.thbc.address;
    const tokenSymbol = "THBC";
    const tokenDecimals = 18;

    // TODO: เปลี่ยนเป็น URL รูปเหรียญ THBC จริงของคุณ
    const tokenImage = "https://example.com/thbc.png";

    const wasAdded = await injected.request({
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
      console.log("THBC has been added to wallet");
      setTxMessage("THBC was added to your wallet ✅", "success");
    } else {
      console.log("User rejected token add request");
      // ไม่ต้องขึ้น error ให้ผู้ใช้ตกใจ ปล่อยผ่านได้
    }
  } catch (err) {
    console.error("wallet_watchAsset error:", err);
    // ไม่จำเป็นต้องขึ้น error หน้าจอ แต่ถ้าจะก็ใช้บรรทัดด้านล่าง
    // setTxMessage("Cannot add THBC to wallet: " + (err.message || err), "error");
  }
}

/* ============================ INIT ============================ */

async function init() {
  injected = getInjectedProvider();
  if (!injected) {
    console.warn("No injected wallet found (MetaMask / Bitget)");
  }

  // ให้ input คำนวน THBC ทันทีเวลาพิมพ์
  const amtInput = $("usdtAmount");
  if (amtInput) amtInput.addEventListener("input", updatePreviewTHBC);

  if ($("btnConnect")) $("btnConnect").onclick = connectWallet;
  if ($("btnApprove")) $("btnApprove").onclick = onApproveUSDT;
  if ($("btnBuy")) $("btnBuy").onclick = onBuyTHBC;
  if ($("btnCopy")) $("btnCopy").onclick = onCopyRef;

  // ปุ่มเสริม (ถ้าคุณมีใน HTML) สำหรับให้กด Add THBC เอง
  if ($("btnAddTHBC")) $("btnAddTHBC").onclick = addTHBCToWallet;

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

    const accounts = await injected.request({
      method: "eth_requestAccounts"
    });

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

    // กัน wallet แปลก ๆ ที่ไม่ส่ง tx กลับมา
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

    // กัน wallet ที่ไม่ส่ง tx hash กลับมา
    if (!tx || !tx.hash) {
      throw new Error("Wallet did not return transaction object");
    }

    await tx.wait();

    // แสดงผลสำเร็จ & สีเขียว
    setTxMessage("Buy THBC success! ✅", "success");

    // หลังซื้อสำเร็จ เสนอให้เพิ่มเหรียญ THBC เข้า wallet
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
