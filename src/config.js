require("dotenv").config();

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

const port = Number(env("PORT", "8080"));
const baseUrl = env("BASE_URL", `http://localhost:${port}`);
const tableCount = Number(env("TABLE_COUNT", "4"));

const solidRootContext = env("SOLID_ROOT_CONTEXT", "testing/root1");
const solidTestNumber = env("SOLID_TEST_NUMBER", "1");
const adminPodBaseUrl = env("ADMIN_POD_BASE_URL");

if (!adminPodBaseUrl) {
  throw new Error(
    "Missing ADMIN_POD_BASE_URL in .env. Example: ADMIN_POD_BASE_URL=https://pod.inrupt.com/admintest1/"
  );
}

if (!adminPodBaseUrl.startsWith("http://") && !adminPodBaseUrl.startsWith("https://")) {
  throw new Error(
    `ADMIN_POD_BASE_URL must be an absolute URL. Current value: ${adminPodBaseUrl}`
  );
}

function joinUrl(...parts) {
  return parts
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) return part.replace(/\/+$/, "");
      return part.replace(/^\/+|\/+$/g, "");
    })
    .join("/") + "/";
}

const adminRootUrl = joinUrl(adminPodBaseUrl, solidRootContext);
const testRootUrl = joinUrl(adminPodBaseUrl, solidRootContext, `test${solidTestNumber}`);

const solid = {
  rootContext: solidRootContext,
  testNumber: solidTestNumber,

  adminRoot: adminRootUrl,
  root: testRootUrl,
  acp: joinUrl(adminPodBaseUrl, solidRootContext, "acp") + "myrulesandpolicies",

  storeContainerURL: joinUrl(testRootUrl, "store"),
  billToPayURL: joinUrl(testRootUrl, "billing", "to-pay"),
  billPayedURL: joinUrl(testRootUrl, "billing", "payed"),
  activeOrderContainerURL: joinUrl(testRootUrl, "activeorder"),

  storeFileURL: joinUrl(testRootUrl, "store") + "store.json",
  billingFileURL: joinUrl(testRootUrl, "billing", "to-pay") + "bill-temp.json",
  activeOrderFileURL: joinUrl(testRootUrl, "activeorder") + "order-temp.json",

  storeFilePath: "./utils/store.json",
  billingFilePath: "./utils/bill-temp.json",
  activeOrderFilePath: "./utils/order-temp.json",

  restaurantInruptWebID: env("RESTAURANT_INRUPT_WEB_ID"),
  restaurantWebID: env("RESTAURANT_WEB_ID"),
  CEOWebID: env("CEO_WEB_ID"),
  authorityWebID: env("AUTHORITY_WEB_ID"),
  erpWebID: env("ERP_WEB_ID"),
  adminWebID: env("ADMIN_WEB_ID")
};

const ethereum = {
  network: env("ETH_NETWORK", "sepolia"),
  rpcUrl: env("ETH_RPC_URL"),
  smartContractAddress: env("SMART_CONTRACT_ADDRESS"),
  restaurantWalletAddress: env("RESTAURANT_WALLET_ADDRESS"),
  ethChfRate: Number(env("ETH_CHF_RATE", "3919"))
};

const adminToken = {
  refreshToken: env("ADMIN_SOLID_REFRESH_TOKEN"),
  clientId: env("ADMIN_SOLID_CLIENT_ID"),
  clientSecret: env("ADMIN_SOLID_CLIENT_SECRET"),
  provider: env("ADMIN_SOLID_PROVIDER", "https://broker.pod.inrupt.com")
};

const restaurantToken = {
  refreshToken: env("RESTAURANT_SOLID_REFRESH_TOKEN"),
  clientId: env("RESTAURANT_SOLID_CLIENT_ID"),
  clientSecret: env("RESTAURANT_SOLID_CLIENT_SECRET"),
  provider: env("RESTAURANT_SOLID_PROVIDER", "https://solidcommunity.net")
};

const authorityToken = {};
const erpToken = {};

const useLocalDataFallback = env("USE_LOCAL_DATA_FALLBACK", "true") === "true";
const solidAuthEnabled = env("SOLID_AUTH_ENABLED", "false") === "true";
const paymentMode = env("PAYMENT_MODE", "mock");

module.exports = {
  port,
  baseUrl,
  tableCount,
  solid,
  ethereum,
  useLocalDataFallback,
  solidAuthEnabled,
  paymentMode,
  adminToken,
  restaurantToken,
  authorityToken,
  erpToken
};