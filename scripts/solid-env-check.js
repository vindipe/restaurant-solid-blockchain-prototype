require("dotenv").config();

const {
  solid,
  useLocalDataFallback,
  solidAuthEnabled,
  allowPodReset,
  adminToken,
  restaurantToken,
} = require("../src/config");

let hasErrors = false;
let hasWarnings = false;

function ok(message) {
  console.log(`OK   ${message}`);
}

function warn(message) {
  hasWarnings = true;
  console.log(`WARN ${message}`);
}

function fail(message) {
  hasErrors = true;
  console.log(`FAIL ${message}`);
}

function isUrl(value) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function checkUrl(name, value, required = true) {
  if (!value) {
    if (required) {
      fail(`${name} is missing`);
    } else {
      warn(`${name} is not set`);
    }
    return;
  }

  if (!isUrl(value)) {
    fail(`${name} must be an absolute URL. Current value: ${value}`);
    return;
  }

  ok(`${name} is a valid URL`);
}

function checkCredential(name, value, required = false) {
  if (!value) {
    if (required) {
      fail(`${name} is missing`);
    } else {
      warn(`${name} is not set`);
    }
    return;
  }

  ok(`${name} is set`);
}

function checkSolidTarget() {
  console.log("\nSolid target");
  console.log("============");

  if (solid.rootContext) {
    ok(`SOLID_ROOT_CONTEXT=${solid.rootContext}`);
  } else {
    fail("SOLID_ROOT_CONTEXT is missing");
  }

  if (solid.testNumber) {
    ok(`SOLID_TEST_NUMBER=${solid.testNumber}`);
  } else {
    fail("SOLID_TEST_NUMBER is missing");
  }

  checkUrl("ADMIN_POD_BASE_URL-derived admin root", solid.adminRoot);
  checkUrl("ADMIN_POD_BASE_URL-derived test root", solid.root);
  checkUrl("ACP resource", solid.acp);
}

function checkExpectedResources() {
  console.log("\nExpected Solid resources");
  console.log("========================");

  checkUrl("Store container", solid.storeContainerURL);
  checkUrl("Active order container", solid.activeOrderContainerURL);
  checkUrl("Bills to pay container", solid.billToPayURL);
  checkUrl("Paid bills container", solid.billPayedURL);
  checkUrl("Store JSON", solid.storeFileURL);
  checkUrl("Order template JSON", solid.activeOrderFileURL);
  checkUrl("Billing template JSON", solid.billingFileURL);
}

function checkWebIds() {
  console.log("\nConfigured WebIDs");
  console.log("=================");

  checkUrl("ADMIN_WEB_ID", solid.adminWebID, false);
  checkUrl("RESTAURANT_INRUPT_WEB_ID", solid.restaurantInruptWebID, false);
  checkUrl("RESTAURANT_WEB_ID", solid.restaurantWebID, false);
  checkUrl("CEO_WEB_ID", solid.CEOWebID, false);
  checkUrl("AUTHORITY_WEB_ID", solid.authorityWebID, false);
  checkUrl("ERP_WEB_ID", solid.erpWebID, false);
}

function checkAuth() {
  console.log("\nSolid authentication");
  console.log("====================");

  if (solidAuthEnabled) {
    warn("SOLID_AUTH_ENABLED=true. The app will attempt Solid login during runtime.");
  } else {
    ok("SOLID_AUTH_ENABLED=false");
  }

  if (allowPodReset) {
    warn("ALLOW_POD_RESET=true. Initialization can delete/recreate the configured test container.");
  } else {
    ok("ALLOW_POD_RESET=false");
  }

  const adminRequired = solidAuthEnabled || allowPodReset;

  checkUrl("ADMIN_SOLID_PROVIDER", adminToken.provider, adminRequired);
  checkCredential("ADMIN_SOLID_REFRESH_TOKEN", adminToken.refreshToken, adminRequired);
  checkCredential("ADMIN_SOLID_CLIENT_ID", adminToken.clientId, adminRequired);
  checkCredential("ADMIN_SOLID_CLIENT_SECRET", adminToken.clientSecret, adminRequired);

  checkUrl("RESTAURANT_SOLID_PROVIDER", restaurantToken.provider, false);
  checkCredential("RESTAURANT_SOLID_REFRESH_TOKEN", restaurantToken.refreshToken, false);
  checkCredential("RESTAURANT_SOLID_CLIENT_ID", restaurantToken.clientId, false);
  checkCredential("RESTAURANT_SOLID_CLIENT_SECRET", restaurantToken.clientSecret, false);
}

function checkMode() {
  console.log("\nExecution mode");
  console.log("==============");

  if (useLocalDataFallback) {
    ok("USE_LOCAL_DATA_FALLBACK=true");
  } else {
    warn("USE_LOCAL_DATA_FALLBACK=false. Solid failures will not fall back to local fixtures.");
  }
}

function main() {
  console.log("Solid environment check");
  console.log("=======================");

  checkMode();
  checkSolidTarget();
  checkExpectedResources();
  checkWebIds();
  checkAuth();

  console.log("\nSummary");
  console.log("=======");

  if (hasErrors) {
    console.log("Solid environment check completed with errors.");
    process.exit(1);
  }

  if (hasWarnings) {
    console.log("Solid environment check completed with warnings.");
    process.exit(0);
  }

  console.log("Solid environment check completed successfully.");
}

main();