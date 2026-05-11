const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

require("dotenv").config();

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

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function run(command) {
  try {
    return execSync(command, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    return "";
  }
}

function checkNodeAndNpm() {
  console.log("\nEnvironment");
  console.log("===========");

  const nodeVersion = process.version;
  const npmVersion = run("npm --version");

  ok(`Node.js detected: ${nodeVersion}`);

  if (npmVersion) {
    ok(`npm detected: ${npmVersion}`);
  } else {
    fail("npm not detected");
  }

  const major = Number(nodeVersion.replace("v", "").split(".")[0]);

  if (major < 18) {
    fail("Node.js 18 or newer is recommended");
  } else {
    ok("Node.js version is compatible with the current local demo");
  }
}

function checkFiles() {
  console.log("\nRequired files");
  console.log("==============");

  const requiredFiles = [
    "README.md",
    ".env.example",
    ".gitignore",
    "package.json",
    "restaurant.js",
    "src/config.js",
    "src/client-functions.js",
    "utils/store.json",
    "utils/order-temp.json",
    "utils/bill-temp.json",
    "utils/img/pizza.jpg",
    "utils/img/water.jpg",
    "views/index.ejs",
    "views/menu.ejs",
    "views/bill.ejs",
    "views/payment.ejs"
  ];

  requiredFiles.forEach((file) => {
    if (exists(file)) {
      ok(`${file} exists`);
    } else {
      fail(`${file} is missing`);
    }
  });
}

function checkEnv() {
  console.log("\nEnvironment configuration");
  console.log("=========================");

  if (exists(".env")) {
    ok(".env exists locally");
  } else {
    warn(".env is missing. Create it with: cp .env.example .env");
  }

  const expectedLocalDemo = {
    USE_LOCAL_DATA_FALLBACK: "true",
    SOLID_AUTH_ENABLED: "false",
    PAYMENT_MODE: "mock"
  };

  Object.entries(expectedLocalDemo).forEach(([key, expected]) => {
    const value = process.env[key];

    if (value === expected) {
      ok(`${key}=${expected}`);
    } else {
      warn(`${key} is '${value || "(not set)"}'; recommended for local demo: ${expected}`);
    }
  });

  if (process.env.ALLOW_POD_RESET === "true") {
    warn("ALLOW_POD_RESET=true. Keep this false unless you intentionally want to reset a Solid Pod path.");
  } else {
    ok("ALLOW_POD_RESET is not enabled");
  }
}

function checkGitIgnore() {
  console.log("\nGit ignore checks");
  console.log("=================");

  const envIgnored = run("git check-ignore -v .env");

  if (envIgnored) {
    ok(".env is ignored by Git");
  } else {
    fail(".env is not ignored by Git");
  }

  const runtimeIgnored = run("git check-ignore -v utils/runtime/test.json");

  if (runtimeIgnored) {
    ok("utils/runtime/ is ignored by Git");
  } else {
    fail("utils/runtime/ is not ignored by Git");
  }

  const qrIgnored = run("git check-ignore -v utils/img/QR-tables/example.png");

  if (qrIgnored) {
    ok("generated QR PNG files are ignored");
  } else {
    fail("generated QR PNG files are not ignored");
  }
}

function checkTrackedGeneratedFiles() {
  console.log("\nTracked generated/sensitive files");
  console.log("=================================");

  const tracked = run(
    "git ls-files | grep -E '(^\\.env$|utils/runtime|utils/temp|QR-tables/.*\\.png|dropbox|Zone.Identifier)'"
  );

  if (tracked) {
    fail("Generated or sensitive files are tracked:");
    console.log(tracked);
  } else {
    ok("No generated/runtime/sensitive files detected in Git tracking");
  }
}

function checkLegacyHardcoding() {
  console.log("\nLegacy hardcoding checks");
  console.log("========================");

  const command =
    "grep -RIn " +
    "--exclude-dir=node_modules " +
    "--exclude-dir=.git " +
    "--exclude-dir=utils/runtime " +
    "--exclude=package-lock.json " +
    "--exclude=README.md " +
    "--exclude=doctor.js " +
    "--exclude=solid-fixtures.js " +
    "'kovan.infura\\|396DC917\\|09025260fc864cd09d057f68852e45ea\\|Administrator0\\|Ristorante1\\|Authority2' .";

  const matches = run(command);

  if (matches) {
    fail("Legacy hardcoded values found:");
    console.log(matches);
  } else {
    ok("No legacy Kovan/Infura/contract/password hardcoding detected in runtime files");
  }
}

function checkWorkingTree() {
  console.log("\nGit working tree");
  console.log("================");

  const status = run("git status --short");

  if (status) {
    warn("Working tree has uncommitted changes:");
    console.log(status);
  } else {
    ok("Working tree is clean");
  }
}

function main() {
  console.log("Restaurant Solid Blockchain Prototype Doctor");
  console.log("===========================================");

  checkNodeAndNpm();
  checkFiles();
  checkEnv();
  checkGitIgnore();
  checkTrackedGeneratedFiles();
  checkLegacyHardcoding();
  checkWorkingTree();

  console.log("\nSummary");
  console.log("=======");

  if (hasErrors) {
    console.log("Doctor completed with errors.");
    process.exit(1);
  }

  if (hasWarnings) {
    console.log("Doctor completed with warnings.");
    process.exit(0);
  }

  console.log("Doctor completed successfully.");
}

main();