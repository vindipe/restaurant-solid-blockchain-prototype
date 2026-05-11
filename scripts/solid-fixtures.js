const fs = require("fs");
const path = require("path");

const root = process.cwd();

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

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function isNumberLike(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number.isFinite(Number(value));
  }

  return false;
}

function checkStore() {
  console.log("\nStore fixture");
  console.log("=============");

  const store = readJson("utils/store.json");

  if (!store) return;

  if (!Array.isArray(store.products)) {
    fail("utils/store.json must contain a products array");
    return;
  }

  ok(`store contains ${store.products.length} products`);

  const seenIds = new Set();

  store.products.forEach((product, index) => {
    const prefix = `product[${index}]`;

    if (typeof product.id !== "number") {
      fail(`${prefix}.id must be a number`);
    }

    if (seenIds.has(product.id)) {
      fail(`${prefix}.id is duplicated: ${product.id}`);
    } else {
      seenIds.add(product.id);
    }

    if (!product.name) {
      fail(`${prefix}.name is missing`);
    }

let priceField = null;

if (typeof product.price_per_unit !== "undefined") {
  priceField = "price_per_unit";
} else if (typeof product.price !== "undefined") {
  priceField = "price";
} else if (typeof product.cost_per_unit !== "undefined") {
  priceField = "cost_per_unit";
}

if (!priceField) {
  fail(`${prefix} must define cost_per_unit, price_per_unit, or price`);
} else {
  const priceValue = product[priceField];

  if (typeof priceValue === "number") {
    ok(`${product.name}: ${priceField} is numeric`);
  } else if (isNumberLike(priceValue)) {
    warn(`${product.name}: ${priceField} is a numeric string; consider normalizing it to a number`);
  } else {
    fail(`${prefix}.${priceField} must be a number or numeric string`);
  }

  if (priceField === "cost_per_unit") {
    warn(`${product.name}: uses legacy field cost_per_unit; consider renaming to price_per_unit later`);
  }
}

    if (typeof product.quantity_available !== "number") {
      fail(`${prefix}.quantity_available must be a number`);
    }

    if (typeof product.max_capacity !== "number") {
      fail(`${prefix}.max_capacity must be a number`);
    }

    if (!product.image) {
      fail(`${prefix}.image is missing`);
      return;
    }

    const imageName = product.image.split("/").pop();
    const localImagePath = `utils/img/${imageName}`;

    if (fileExists(localImagePath)) {
      ok(`${product.name}: image exists (${localImagePath})`);
    } else {
      fail(`${product.name}: missing local image ${localImagePath}`);
    }
  });
}

function checkOrderTemplate() {
  console.log("\nOrder template");
  console.log("==============");

  const order = readJson("utils/order-temp.json");

  if (!order) return;

  if (!order.id_order) {
    fail("order-temp.json id_order is missing");
  } else {
    ok("order template has id_order");
  }

  if (!Array.isArray(order.products)) {
    fail("order-temp.json products must be an array");
  } else {
    ok("order template has products array");
  }

  if (typeof order.table_number === "undefined") {
    warn("order-temp.json table_number is not set");
  }

  if (typeof order.total === "undefined") {
    warn("order-temp.json total is not set");
  }
}

function checkBillTemplate() {
  console.log("\nBill template");
  console.log("=============");

  const bill = readJson("utils/bill-temp.json");

  if (!bill) return;

  if (!bill.id_bill) {
    fail("bill-temp.json id_bill is missing");
  } else {
    ok("bill template has id_bill");
  }

  if (typeof bill.payed === "undefined") {
    warn("bill-temp.json payed field is missing");
  } else {
    ok("bill template has payed field");
  }

  if (bill.addressSmartContract && bill.addressSmartContract.includes("396DC917")) {
    fail("bill-temp.json still contains legacy smart contract address");
  } else {
    ok("bill template does not contain legacy smart contract address");
  }
}

function checkRequiredImages() {
  console.log("\nRequired image files");
  console.log("====================");

  const expectedImages = [
    "beef.jpg",
    "bread.jpg",
    "coffee.jpg",
    "covers.jpg",
    "fruits.jpg",
    "hamburger.jpg",
    "pasta.jpg",
    "pizza.jpg",
    "smoked-salmon.jpg",
    "water.jpg",
  ];

  expectedImages.forEach((image) => {
    const relativePath = `utils/img/${image}`;

    if (fileExists(relativePath)) {
      ok(`${relativePath} exists`);
    } else {
      fail(`${relativePath} is missing`);
    }
  });
}

function main() {
  console.log("Solid fixture validation");
  console.log("========================");

  checkStore();
  checkOrderTemplate();
  checkBillTemplate();
  checkRequiredImages();

  console.log("\nSummary");
  console.log("=======");

  if (hasErrors) {
    console.log("Fixture validation completed with errors.");
    process.exit(1);
  }

  if (hasWarnings) {
    console.log("Fixture validation completed with warnings.");
    process.exit(0);
  }

  console.log("Fixture validation completed successfully.");
}

main();