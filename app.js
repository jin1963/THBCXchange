// app.js - Kaojino THBC Exchange (Wallet Compatibility Fixed)

let provider, signer, currentAccount;
let usdtContract, exchangeContract;

const zeroAddress = "0x0000000000000000000000000000000000000000";

function $(id) {
  return document.getElementById(id);
}

/* Provider Detector */
function getInjectedProvider() {
  if (window.bitget && window.bitget.ethereum) {
    console.log("Using Bitget provider");
    return window.bitget.ethereum;
  }
  if (window.BinanceChain) {
    console.log("Using Binance Chain provider");
    return window.BinanceChain;
  }
  if (window.ethereum) {
    console.log("Using MetaMask provider");
    return window.ethereum;
  }
  console.warn("No wallet provider detected");
  return null;
}

/* Init */
async function init() {
  console.log("INIT: waiting wallet connect");

  $("btnConnect").onclick = connectWallet;
  $("btnApprove").onclick = onApproveUSDT;
  $("btnBuy").onclick = onBuyTHBC;
  $("btnCopy").onclick = onCopyRef;

  $("usdtAmount").addEventListener("input", updatePreviewTHBC);

  updatePreviewTHBC();
  updateReferralLinkUI();
}

/* Connect Wallet */
async function connectWallet() {
  try {
    const injected = getInjectedProvider();
    if (!injected) {
      alert("❌ Wallet not found — install MetaMask / Bitget.");
      return;
    }

    provider = new ethers.providers.Web3Provider(injected, "any");

    let accounts;
    try {
      accounts = await injected.request({ method: "eth_requestAccounts" });
    } catch {
      // some wallets require different method name
      accounts = await injected.request({ method: "requestAccounts" });
    }

    currentAccount = accounts[0];
    signer = provider.getSigner();

    const net = await provider.getNetwork();
    if (net.chainId !== 56) {
      alert("Please switch network to BNB Smart Chain (56)");
      return;
    }

    const cfg = window.THBC_CONFIG;
    usdtContract = new ethers.Contract(cfg.usdt.address, cfg.usdt.abi, signer);
    exchangeContract = new ethers.Contract(cfg.exchange.address, cfg.exchange.abi, signer);

    $("btnConnect").textContent = currentAccount.slice(0,6) + "..." + currentAccount.slice(-4);
    updateReferralLinkUI();

    if (injected.on) {
      injected.on("accountsChanged", () => location.reload());
      injected.on("chainChanged", () => location.reload());
    }

    console.log("Wallet connected:", currentAccount);

  } catch (err) {
    console.error("Connect Wallet Error:", err);
    alert("Connect failed: " + (err.message || err));
  }
}

/* Preview THBC */
function updatePreviewTHBC() {
  const amountStr = $("usdtAmount").value || "0";
  const rate = window.THBC_CONFIG.uiRateThbcPerUsdt || 35;
  const thbc = parseFloat(amountStr || 0) * rate;
  $("thbcReceive").textContent = thbc.toFixed(2);
}

/* Approve */
async function onApproveUSDT() {
  try {
    if (!signer) await connectWallet();
    const cfg = window.THBC_CONFIG;
    const tx = await usdtContract.approve(cfg.exchange.address, ethers.constants.MaxUint256);
    await tx.wait();
    $("txMessage").textContent = "USDT Approved ✓";
  } catch (err) {
    console.error(err);
    $("txMessage").textContent = "Approve failed: " + err.message;
  }
}

/* Referral */
function getReferrer() {
  const ref = new URLSearchParams(location.search).get("ref");
  return ethers.utils.isAddress(ref) ? ref : zeroAddress;
}

/* Buy */
async function onBuyTHBC() {
  try {
    if (!signer) await connectWallet();
    const amount = $("usdtAmount").value;
    const cfg = window.THBC_CONFIG;
    const usdt = ethers.utils.parseUnits(amount, 18);
    const tx = await exchangeContract.buyTHBCWithUSDT(usdt, getReferrer());
    await tx.wait();
    $("txMessage").textContent = "Buy successful ✓";
  } catch (err) {
    console.error(err);
    $("txMessage").textContent = "Buy failed: " + err.message;
  }
}

/* Referral UI */
function updateReferralLinkUI() {
  const base = location.origin + location.pathname;
  $("refLink").value = currentAccount ? `${base}?ref=${currentAccount}` : base;
}
function onCopyRef() {
  $("refLink").select();
  document.execCommand("copy");
  alert("Copied!");
}

/* Start */
window.addEventListener("load", init);
