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
  solidAuthEnabled,
  paymentMode,
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
  .option("-i, --initialize", "Initialize Restaurant service and Pods.");

program.parse(process.argv);

const options = program.opts();

if (options.initialize) {
  console.log("Initializing Solid Pod context...");
  initialize(adminToken)
    .then(() => {
      console.log("Solid Pod initialization completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Solid Pod initialization failed:");
      console.error(error);
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
  app.listen(port, () => {
    console.log(`listening on ${port}`);
  });
// });