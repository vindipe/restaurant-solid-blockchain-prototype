const express = require("express");
const ejs = require("ejs");
const path = require("path");
const program = require("commander");
const qr = require("qrcode");
const fs = require("fs");

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
  adminToken,
  restaurantToken
} = require("./src/config");

const {
  sleep,
  login,
  logout,
  getMenu,
  makeOrder,
  takeBill,
  getPayment,
  updateStore,
  initialize 
} = require("./src/client-functions");
// const os = require("os");
// const cluster = require("cluster");

//const clusterWorkerSize = os.cpus().length;
//const clusterWorkerSize = 4;


const app = express();

//-----------## Initialization Solid Pod(s) - (re)start the service as predifined
program
  .option("-i, --initialize", "Initialize Restaurant service and Pods.")
  .option("--solid-plan", "Print the expected Solid Pod structure without modifying anything.")
  .option("--solid-probe", "Probe expected Solid Pod URLs without modifying anything.");

program.parse(process.argv);

const options = program.opts();

function printSolidPlan() {
  console.log("");
  console.log("Solid Pod configuration plan");
  console.log("============================");
  console.log("");

  console.log("Execution mode:");
  console.log(`- USE_LOCAL_DATA_FALLBACK: ${useLocalDataFallback}`);
  console.log(`- SOLID_AUTH_ENABLED: ${solidAuthEnabled}`);
  console.log(`- PAYMENT_MODE: ${paymentMode}`);
  console.log(`- ALLOW_POD_RESET: ${allowPodReset}`);
  console.log("");

  console.log("Application:");
  console.log(`- PORT: ${port}`);
  console.log(`- BASE_URL: ${baseUrl}`);
  console.log(`- TABLE_COUNT: ${tableCount}`);
  console.log("");

  console.log("Solid target:");
  console.log(`- Root context: ${solid.rootContext}`);
  console.log(`- Test number: ${solid.testNumber}`);
  console.log(`- Admin root: ${solid.adminRoot}`);
  console.log(`- Test root: ${solid.root}`);
  console.log(`- ACP resource: ${solid.acp}`);
  console.log("");

  console.log("Expected Solid containers:");
  console.log(`- Store: ${solid.storeContainerURL}`);
  console.log(`- Active orders: ${solid.activeOrderContainerURL}`);
  console.log(`- Bills to pay: ${solid.billToPayURL}`);
  console.log(`- Paid bills: ${solid.billPayedURL}`);
  console.log("");

  console.log("Expected Solid files:");
  console.log(`- Store JSON: ${solid.storeFileURL}`);
  console.log(`- Order template JSON: ${solid.activeOrderFileURL}`);
  console.log(`- Billing template JSON: ${solid.billingFileURL}`);
  console.log("");

  console.log("Local source files to upload during initialization:");
  console.log(`- Store fixture: ${solid.storeFilePath}`);
  console.log(`- Order template: ${solid.activeOrderFilePath}`);
  console.log(`- Billing template: ${solid.billingFilePath}`);
  console.log("- Images: ./utils/img/*.jpg");
  console.log("");

  console.log("Configured WebIDs:");
  console.log(`- Restaurant Inrupt WebID: ${solid.restaurantInruptWebID || "(not set)"}`);
  console.log(`- Restaurant WebID: ${solid.restaurantWebID || "(not set)"}`);
  console.log(`- CEO WebID: ${solid.CEOWebID || "(not set)"}`);
  console.log(`- Authority WebID: ${solid.authorityWebID || "(not set)"}`);
  console.log(`- ERP WebID: ${solid.erpWebID || "(not set)"}`);
  console.log(`- Admin WebID: ${solid.adminWebID || "(not set)"}`);
  console.log("");

  console.log("Ethereum configuration:");
  console.log(`- Network: ${ethereum.network || "(not set)"}`);
  console.log(`- RPC URL configured: ${Boolean(ethereum.rpcUrl)}`);
  console.log(`- Smart contract configured: ${Boolean(ethereum.smartContractAddress)}`);
  console.log(`- Restaurant wallet configured: ${Boolean(ethereum.restaurantWalletAddress)}`);
  console.log("");

  console.log("Safety notes:");
  console.log("- This command does not modify the Pod.");
  console.log("- npm run init:pods may delete/recreate the configured Solid test container.");
  console.log("- Keep ALLOW_POD_RESET=false unless you intentionally want to reset the configured Pod path.");
  console.log("");
}

async function probeUrl(label, url, expectedContentType = "") {
  if (!url) {
    console.log(`- ${label}: missing URL`);
    return;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow"
    });

    const contentType = response.headers.get("content-type") || "(none)";
    const finalUrl = response.url || url;

    let statusLabel = `${response.status} ${response.statusText}`;

if (expectedContentType && !contentType.includes(expectedContentType)) {
  statusLabel += ` | NOT OK: expected ${expectedContentType}, received ${contentType}`;
} else if (contentType.includes("text/html")) {
  statusLabel += ` | WARNING: received HTML page, not a Solid data resource`;
} else {
  statusLabel += ` | content-type: ${contentType}`;
}

    if (finalUrl !== url) {
      statusLabel += ` | redirected to: ${finalUrl}`;
    }

    console.log(`- ${label}: ${statusLabel}`);

    if (contentType.includes("text/html")) {
      const body = await response.text();
      const preview = body.slice(0, 120).replace(/\s+/g, " ");
      console.log(`  HTML preview: ${preview}`);
    }
  } catch (error) {
    console.log(`- ${label}: failed`);
    console.log(`  ${error.message}`);
  }
}

async function printSolidProbe() {
  console.log("");
  console.log("Solid Pod URL probe");
  console.log("===================");
  console.log("");
  console.log("This command performs read-only GET requests.");
  console.log("It does not create, delete, or update Pod resources.");
  console.log("");

  console.log("Containers / resources:");
  await probeUrl("Admin root", solid.adminRoot);
  await probeUrl("Test root", solid.root);
  await probeUrl("Store container", solid.storeContainerURL);
  await probeUrl("Active order container", solid.activeOrderContainerURL);
  await probeUrl("Bills to pay container", solid.billToPayURL);
  await probeUrl("Paid bills container", solid.billPayedURL);

  console.log("");
  console.log("JSON files:");
  await probeUrl("Store JSON", solid.storeFileURL, "application/json");
  await probeUrl("Order template JSON", solid.activeOrderFileURL, "application/json");
  await probeUrl("Billing template JSON", solid.billingFileURL, "application/json");

  console.log("");
  console.log("Image files:");
  await probeUrl("Pizza image", `${solid.storeContainerURL}pizza.jpg`, "image/");
  await probeUrl("Water image", `${solid.storeContainerURL}water.jpg`, "image/");
  await probeUrl("Beef image", `${solid.storeContainerURL}beef.jpg`, "image/");

  console.log("");
  console.log("Interpretation:");
  console.log("- 200 with application/json means the JSON resource is publicly readable.");
  console.log("- 200 with text/html usually means the URL redirected to a web page, not the expected file.");
  console.log("- 401/403 means the resource exists or is protected but is not publicly readable.");
  console.log("- 404 means the resource path probably does not exist.");
  console.log("");
}

const isInitCommand = options.initialize;
const isSolidPlanCommand = options.solidPlan;
const isSolidProbeCommand = options.solidProbe;

if (isSolidPlanCommand) {
  printSolidPlan();
  process.exit(0);
}

if (isSolidProbeCommand) {
  printSolidProbe()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Solid probe failed:");
      console.error(error.message);
      process.exit(1);
    });
}

if (isInitCommand) {
  console.log("Initializing Solid Pod context...");

  initialize(adminToken)
    .then(() => {
      console.log("Solid Pod initialization completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Solid Pod initialization failed:");
      console.error(error.message);
      process.exit(1);
    });
}


app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'static')));
app.use("/img", express.static(path.join(__dirname, "utils", "img")));
app.use("/runtime", express.static(path.join(__dirname, "utils", "runtime")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", function(req, res) {
  res.render("index", {
    tableCount: rangeTables,
    baseUrl
  });
});

const rangeTables = tableCount;
var availableTables = Array(rangeTables).fill(0);
var tableNumber, order, bill;

let sessionID = "RWA-"; //Restaurant Web-App
let sessionRWA; 

const qrTablesRuntimeDir = path.join(__dirname, "utils", "runtime", "qr-tables");
fs.mkdirSync(qrTablesRuntimeDir, { recursive: true });

for (let i = 0; i < rangeTables; i++) {
  const currentTable = i + 1;
  const qrCodeText = `${baseUrl}/${currentTable}`;

  qr.toFile(path.join(qrTablesRuntimeDir, `qr-table${currentTable}.png`), qrCodeText, {
    errorCorrectionLevel: "H",
    type: "image/png",
    quality: 0.95,
    margin: 3,
    color: {
      dark: "#000000ff",
      light: "#ffffffff",
    },
  });

  app.get(`/${currentTable}`, async function(req, res) {
    tableNumber = currentTable;
    availableTables[i] = 1;

    console.log("You are sitting at table:", tableNumber);

try {
  if (solidAuthEnabled && !sessionRWA) {
    sessionRWA = await login(sessionID, restaurantToken);
  }

  var tmp = await getMenu(tableNumber, sessionRWA);
  var menu = tmp[0];
  order = tmp[1];
  order.table_number = tableNumber;

  return res.render("menu", {
    tableNumber,
    menu,
    order
  });
} catch (error) {
  console.error("Failed to load table menu:");
  console.error(error.message);

  if (res.headersSent) {
    return;
  }

  return res.status(500).send(`
    <h1>Unable to load menu</h1>
    <p>${error.message}</p>
    <p>Check your .env configuration, Solid Pod permissions, or local fallback settings.</p>
  `);
}
  });
}

app.post('/order', async function(req, res) {
  order = await makeOrder(req.body.cart, sessionRWA);
  await updateStore(order, sessionRWA);

  //res.send("Order executed");
  console.log("Order executed");

  res.redirect(`/${tableNumber}`);
});

app.post("/bill", async function(req, res) {
  try {
    bill = await takeBill(tableNumber, sessionRWA);

    if (bill !== false) {
return res.render("bill", {
  tableNumber,
  bill,
  paymentMode
});
    }

    return res.status(400).send("Unable to generate bill.");
  } catch (error) {
    console.error("Failed to generate bill:");
    console.error(error.message);

    return res.status(500).send(`
      <h1>Unable to generate bill</h1>
      <p>${error.message}</p>
      <p>Make sure an order exists for this table before requesting the bill.</p>
    `);
  }
});

app.post("/payment", async function(req, res) {
  try {
    if (!req.body.bill) {
  throw new Error("Missing bill payload from payment form.");
}

    const arrayTmp = await getPayment(req.body.bill, sessionRWA);
    const confirmation = arrayTmp[0];
    const billURL = arrayTmp[1];

    if (!confirmation) {
      return res.status(400).send(`
        <h1>Payment not verified</h1>
        <p>The payment could not be verified yet.</p>
        <p>Try again after completing the transaction.</p>
      `);
    }

    return res.render("payment", {
      tableNumber,
      billURL
    });
  } catch (error) {
    console.error("Failed to process payment:");
    console.error(error.message);

    return res.status(500).send(`
      <h1>Unable to process payment</h1>
      <p>${error.message}</p>
    `);
  }
});

app.get('/end', function(req, res, next) {
  availableTables[tableNumber-1]=0;
  res.redirect(`/${tableNumber}`);
});


// if (clusterWorkerSize > 1) {
//   if (cluster.isMaster) {
//     for (let i=0; i < clusterWorkerSize; i++) {
//       cluster.fork()
//     }

//     cluster.on("exit", function(worker) {
//       console.log("Worker", worker.id, " has exitted.")
//     })
//   } else {

//     app.listen(port, function () {
//       console.log(`Express server listening on port ${port} and worker ${process.pid}`)
//     })
//   }
// } else {

//   app.listen(port, function () {
//     console.log(`Express server listening on port ${port} with the single worker ${process.pid}`)
//   })
// }

// portRange.forEach(function(port) {
if (!isInitCommand && !isSolidPlanCommand && !isSolidProbeCommand) {
  app.listen(port, function () {
    console.log(`listening on ${port}`);
  });
}
// });