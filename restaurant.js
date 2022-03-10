const express = require("express");
const ejs = require("ejs");
const path = require('path');
const program = require("commander");
const qr = require("qrcode");
const fs = require("fs");
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
const port = process.env.PORT || 8080;
const localAddress = "http://localhost:";
const home = localAddress + `${port}/`;
//const addressAPI = localAddress + `${port}/api`;

//const adminPod = "https://pod.inrupt.com/admintest1/";
//const adminUserName = "adminTest1";
//const adminPassword = "Administrator0!";
//const restaurantUserName = "ristorante1";
//const restaurantPassword = "Ristorante1!";
//const CEOUserName = "restaurantCEO";
//const CEOPassword = "RestaurantCEO3!";
//const authorityUserName = "authorityCheck";
//const authorityPassword = "Authority2!";
//const erpUserName = "";
//const erpPassword = "";

const adminToken = {
  "refreshToken" : "g9oG9ek8UWZskDsj5mxKZvbYnnPAdT3VvTBvVTDwFPo",
  "clientId"     : "Z49X5XKR04qI03Zw6NIRhiWkaeNDkZs7yawsawwL9Pk",
  "clientSecret" : "RehiKV4cfb5NsLWTKsK8n5IMduu7DPZvrtGD90dbbcQ",
  provider : "https://broker.pod.inrupt.com"
};

const restaurantToken = {
  "refreshToken" : "db034c8769ccccbc481dd5bb6cb6c80b",
  "clientId"     : "dd2cb76b95731bb6046b5c0f123c1ba3",
  "clientSecret" : "6a271506f4b67623909b386a7f064c85",
  provider : "https://solidcommunity.net"
};

const authorityToken = {};
const erpToken = {};

//-----------## Initialization Solid Pod(s) - (re)start the service as predifined
program
    .option("-i, --initialize", "Initialize Restaurant service and Pods.")
    .action(function(options){
      if (options.initialize){
        console.log("Hi, I'm inizializing the Solid context");
        // execute initialize commands
        initialize(adminToken);
      }
    });

program.parse(process.argv);


app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'static')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const rangeTables = 4;
var availableTables = Array(rangeTables-1).fill(0);
var tableNumber, order, bill;

let sessionID = "RWA-"; //Restaurant Web-App
let sessionRWA; 

for(let i = 0; i<rangeTables; i++){

  var qrCodeText = `https://rwa-test-heroku.herokuapp.com/${i+1}`;

  qr.toFile(`./utils/img/QR-tables/qr-table${i+1}.png`, qrCodeText, {
    errorCorrectionLevel: 'H',
    // version: "",
    type: 'image/png',
    quality: 0.95,
    margin: 3,
    color: {
     dark: '#000000ff',
     light: '#ffffffff',
    },
  });

  app.get(`/${i+1}`, async function(req, res) {
    // if (availableTables[i]!=1){
        tableNumber = i+1;
        availableTables[i]=1;  //occupato
        console.log("You are sitting at table : ", tableNumber);

        var tmp = await getMenu(tableNumber, sessionRWA);
        var menu = tmp[0];
        order = tmp[1];
        order.table_number = tableNumber;
      
        res.render("menu", {
          tableNumber,
          menu,
          order
        });

        sessionRWA = await login(sessionID, restaurantToken);
    // }
    // else{
    //     console.log(`Table ${tableNumber} occuped`);
    //     res.render("table-failed", {
    //       tableNumber
    //     });
    // };
  });  
};

app.post('/order', async function(req, res) {
  order = await makeOrder(req.body.cart, sessionRWA);
  await updateStore(order, sessionRWA);

  //res.send("Order executed");
  console.log("Order executed");

  res.redirect(`/${tableNumber}`);
});

app.post('/bill', async function(req, res) {
  order = await makeOrder(req.body.bill, sessionRWA);
  await updateStore(order, sessionRWA);
  bill = await takeBill(order.table_number, sessionRWA);
  if (bill != false){
    res.render("bill", {
      tableNumber, 
      bill
    });
  }
  else{
    res.send("Error");
  }
});

app.post('/payment', async function(req, res, next) {
  let confirmation = false, billURL;
  while(!confirmation){
    var arrayTmp = await getPayment(req.body.bill, sessionRWA);  
    confirmation = arrayTmp[0];
    billURL = arrayTmp[1];
  }
  
  res.render("payment", {
    tableNumber, 
    billURL
  });
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