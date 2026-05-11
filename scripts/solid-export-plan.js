const fs = require("fs");
const path = require("path");

const {
  port,
  baseUrl,
  tableCount,
  solid,
  ethereum,
  useLocalDataFallback,
  solidAuthEnabled,
  paymentMode,
  allowPodReset,
} = require("../src/config");

const outputPath = path.join(process.cwd(), "solid-plan.local.json");

function bool(value) {
  return Boolean(value);
}

function buildPlan() {
  return {
    generatedAt: new Date().toISOString(),

    note: "Read-only local planning file. This file is generated from .env and does not modify any Solid Pod resource.",

    executionMode: {
      useLocalDataFallback,
      solidAuthEnabled,
      paymentMode,
      allowPodReset,
    },

    application: {
      port,
      baseUrl,
      tableCount,
    },

    solidTarget: {
      rootContext: solid.rootContext,
      testNumber: solid.testNumber,
      adminRoot: solid.adminRoot,
      testRoot: solid.root,
      acpResource: solid.acp,
    },

    expectedContainers: {
      store: solid.storeContainerURL,
      activeOrders: solid.activeOrderContainerURL,
      billsToPay: solid.billToPayURL,
      paidBills: solid.billPayedURL,
    },

    expectedFiles: {
      storeJson: solid.storeFileURL,
      orderTemplateJson: solid.activeOrderFileURL,
      billingTemplateJson: solid.billingFileURL,
    },

    localFilesToUpload: {
      storeFixture: solid.storeFilePath,
      orderTemplate: solid.activeOrderFilePath,
      billingTemplate: solid.billingFilePath,
      images: [
        "./utils/img/beef.jpg",
        "./utils/img/bread.jpg",
        "./utils/img/coffee.jpg",
        "./utils/img/covers.jpg",
        "./utils/img/fruits.jpg",
        "./utils/img/hamburger.jpg",
        "./utils/img/pasta.jpg",
        "./utils/img/pizza.jpg",
        "./utils/img/smoked-salmon.jpg",
        "./utils/img/water.jpg",
      ],
    },

    configuredWebIds: {
      restaurantInruptWebID: solid.restaurantInruptWebID || null,
      restaurantWebID: solid.restaurantWebID || null,
      CEOWebID: solid.CEOWebID || null,
      authorityWebID: solid.authorityWebID || null,
      erpWebID: solid.erpWebID || null,
      adminWebID: solid.adminWebID || null,
    },

    ethereum: {
      network: ethereum.network || null,
      rpcUrlConfigured: bool(ethereum.rpcUrl),
      smartContractConfigured: bool(ethereum.smartContractAddress),
      restaurantWalletConfigured: bool(ethereum.restaurantWalletAddress),
      ethChfRate: ethereum.ethChfRate,
    },

    safetyChecklist: [
      "Run npm run solid:fixtures before uploading local fixtures.",
      "Run npm run solid:plan to inspect URLs in the terminal.",
      "Run npm run solid:probe before initialization.",
      "Run npm run solid:probe:auth after credentials are configured.",
      "Keep ALLOW_POD_RESET=false unless intentionally resetting the configured test container.",
      "Use a dedicated test path such as restaurant-demo/test1, never a personal or production Pod area.",
    ],
  };
}

function main() {
  const plan = buildPlan();

  fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2), "utf8");

  console.log(`Solid plan exported to: ${outputPath}`);
  console.log("");
  console.log("Next suggested commands:");
  console.log("- npm run solid:fixtures");
  console.log("- npm run solid:plan");
  console.log("- npm run solid:probe");
  console.log("- npm run solid:probe:auth");
}

main();