const { 
    logging,
    logOut,
    getSession, 
    getPermissions,
    getPublicPermissions,
    setAccess, 
    setAccessPublic, 
    uploadFileFromPath,
    uploadJSON,
    readFileFromPod,
    deleteFileFromPod,
    createContainer,
    deleteContainerFromPod,
    //ACP-Resources
    createDatasetACP,
    createAgentRuleACP,
    createPolicyACP,
    createMemberRulesPolicies,
    createResourceSpecificRulesPolicies,
    createResourceSpecificPublicRulesPolicies,
    getPermissionsACP,
    getContainerAcr,
    readPublicFileFromPod,
} = require("./solid-lib-interface");
const PDFDocument = require('./pdf-kit-ext');
const fs = require('fs');
const qr = require("qrcode");
const Web3 = require("web3");
const {
    solid,
    ethereum,
    baseUrl,
    useLocalDataFallback,
    solidAuthEnabled,
    paymentMode
} = require("./config");

const obj = solid;

//FUNCTION
/**
 * import function as in browser
 */
function hashCode(y) {
    var hash = 0, i, chr;
    if (y.length === 0) return hash;
    for (i = 0; i < y.length; i++) {
        chr = y.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

function computeOrderHash(order) {
    const tmpOrder = JSON.parse(JSON.stringify(order));
    tmpOrder.hash = "";
    return hashCode(JSON.stringify(tmpOrder));
}

function isOrderHashValid(order) {
    return computeOrderHash(order) === order.hash;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readLocalJson(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
}

function rewriteMenuImagesToLocal(menu) {
    if (!menu || !Array.isArray(menu.products)) {
        return menu;
    }

    menu.products = menu.products.map((product) => {
        if (!product.image) {
            return product;
        }

        const filename = product.image.split("/").pop();

        return {
            ...product,
            image: `/img/${filename}`
        };
    });

    return menu;
}

const localRuntimeRoot = "./utils/runtime";
const localActiveOrderDir = `${localRuntimeRoot}/activeorder`;
const localBillingToPayDir = `${localRuntimeRoot}/billing/to-pay`;
const localBillingPayedDir = `${localRuntimeRoot}/billing/payed`;
const localQrDir = `${localRuntimeRoot}/qr`;
const localStoreFilePath = `${localRuntimeRoot}/store.json`;

function ensureLocalRuntime() {
    fs.mkdirSync(localActiveOrderDir, { recursive: true });
    fs.mkdirSync(localBillingToPayDir, { recursive: true });
    fs.mkdirSync(localBillingPayedDir, { recursive: true });
    fs.mkdirSync(localQrDir, { recursive: true });

    if (!fs.existsSync(localStoreFilePath)) {
        fs.copyFileSync(obj.storeFilePath, localStoreFilePath);
    }
}

function getLocalActiveOrderPath(tableNumber) {
    return `${localActiveOrderDir}/order-table-${tableNumber}.json`;
}

function writeLocalJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readLocalStore() {
    ensureLocalRuntime();

    const store = readLocalJson(localStoreFilePath);
    return rewriteMenuImagesToLocal(store);
}

function readLocalOrder(tableNumber) {
    ensureLocalRuntime();

    const activeOrderPath = getLocalActiveOrderPath(tableNumber);

    if (fs.existsSync(activeOrderPath)) {
        return readLocalJson(activeOrderPath);
    }

    return readLocalJson(obj.activeOrderFilePath);
}

async function login(sessionID, token){    
    const session = await logging(sessionID, token);
    return session;
}

function logout(session){
    logOut(session);
}

async function getMenu(tableNumber) {
    if (!solidAuthEnabled && useLocalDataFallback) {
        console.log("Local demo mode enabled. Loading menu and order from local runtime files.");

        const json = readLocalStore();
        const order = readLocalOrder(tableNumber);

        return [json, order];
    }

    console.log("Loading menu from Solid Pod:");
    console.log("Store file:", obj.storeFileURL);
    console.log("Active order:", obj.activeOrderContainerURL + `order-table-${tableNumber}.json`);
    console.log("Order template:", obj.activeOrderFileURL);

    var json = await readPublicFileFromPod(obj.storeFileURL);

    if (json == undefined) {
        if (!useLocalDataFallback) {
            throw new Error(
                "Unable to load store.json from Solid Pod. " +
                "Check ADMIN_POD_BASE_URL, SOLID_ROOT_CONTEXT, SOLID_TEST_NUMBER and public read permissions."
            );
        }

        console.warn("Solid store.json unavailable. Falling back to local utils/store.json.");
        json = readLocalStore();
    }

    var order = await readPublicFileFromPod(obj.activeOrderContainerURL + `order-table-${tableNumber}.json`);

    if (order == undefined) {
        order = await readPublicFileFromPod(obj.activeOrderFileURL);
    }

    if (order == undefined) {
        if (!useLocalDataFallback) {
            throw new Error(
                "Unable to load order template from Solid Pod. " +
                "Check activeorder/order-temp.json and public read permissions."
            );
        }

        console.warn("Solid order template unavailable. Falling back to local utils/order-temp.json.");
        order = readLocalOrder(tableNumber);
    }

    return [json, order];
}

async function makeOrder(req, session) {  
    var order = JSON.parse(req); 

    if (order["id_order"] == "orderID") {
        let orderID = "order-";
        orderID += Math.random().toString(36).substr(2, 9);
        order["id_order"] = orderID;
    }

    var today = new Date();
    var date = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var result = date + "-" + time;
    order["time"] = result;

    var total = 0;
    Object.keys(order.products).forEach(function(k) {
        order.products[k].amount = order.products[k].quantity * order.products[k].price_per_unit;
        total += order.products[k].amount;
    });   

    order["total"] = total;

    order.hash = "";
    order.hash = computeOrderHash(order);

    var table = order.table_number.toString();
    const orderString = JSON.stringify(order, null, 2);

    if (!solidAuthEnabled && useLocalDataFallback) {
        ensureLocalRuntime();

        const localOrderPath = getLocalActiveOrderPath(table);
        fs.writeFileSync(localOrderPath, orderString, "utf8");

        console.log(`Local order saved: ${localOrderPath}`);

        return order;
    }

    await uploadJSON(JSON.stringify(order), obj.activeOrderContainerURL, `order-table-${table}.json`, session);
    await createResourceSpecificPublicRulesPolicies(
        obj.activeOrderContainerURL + `order-table-${table}.json`,
        "activeOrder",
        { read: true },
        session
    );

    return order;
}

async function takeBill(table, session) {
    if (!solidAuthEnabled && useLocalDataFallback) {
        ensureLocalRuntime();

        const localOrderPath = getLocalActiveOrderPath(table);

        if (!fs.existsSync(localOrderPath)) {
            throw new Error(`No active local order found for table ${table}. Click Order before Get Bill.`);
        }

        const order = readLocalJson(localOrderPath);

        if (!isOrderHashValid(order)) {
            console.log("Your hash seems to not correspond to the order.");
            return false;
        }

        const bill = readLocalJson(obj.billingFilePath);
        bill["order"] = order;
        bill["addressSmartContract"] = ethereum.smartContractAddress || "";

        var today = new Date();
        var date = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
        var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
        var result = date + "-" + time;

        bill["id_bill"] += result;
        bill.src = `/runtime/billing/to-pay/${bill.order.hash}.pdf`;

        const localPdfPath = `${localBillingToPayDir}/${bill.order.hash}.pdf`;
        const localBillJsonPath = `${localBillingToPayDir}/${bill.order.hash}.json`;

        await makePreBillPDF(bill, localPdfPath);
        writeLocalJson(localBillJsonPath, bill);

        console.log(`Local pre-bill PDF generated: ${localPdfPath}`);
        console.log(`Local pre-bill JSON saved: ${localBillJsonPath}`);

        return bill;
    }

    const orderURL = obj.activeOrderContainerURL + `order-table-${table}.json`;
    var order = await readFileFromPod(orderURL, session);

    if (!isOrderHashValid(order)) {
        console.log("Your hash seems to not correspond to the order.");
        return false;
    }

    var bill = await readFileFromPod(obj.billingFileURL, session);
    bill["order"] = order;
    bill["addressSmartContract"] = ethereum.smartContractAddress || "";

    var today = new Date();
    var date = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var result = date + "-" + time;

    bill.src = obj.billToPayURL + bill.order.hash + ".pdf";
    bill["id_bill"] += result;

    await makePreBillPDF(bill);
    await uploadFileFromPath(`./utils/temp.pdf`, "application/pdf", obj.billToPayURL, bill.order.hash + ".pdf", session);
    await createResourceSpecificPublicRulesPolicies(obj.billToPayURL + `${bill.order.hash}.pdf`, "billToPay", { read: true }, session);

    return bill;
}

async function getPayment(bill, session) {
    bill = typeof bill === "string" ? JSON.parse(bill) : bill;

    if (!solidAuthEnabled && useLocalDataFallback && paymentMode === "mock") {
        ensureLocalRuntime();

        const hash = bill.order.hash;
        const localOrderPath = getLocalActiveOrderPath(bill.order.table_number);

        bill["payed"] = true;
        bill["pay_mode"] = "mock blockchain transaction";
        bill["blockchain_type"] = "local demo";
        bill["clientWallet"] = "mock-client-wallet";
        bill["blockchain_transaction_id"] = `mock-tx-${Date.now()}-${hash}`;
        bill.src = `/runtime/billing/payed/${hash}.pdf`;

        bill["hash_bill"] = "";
        bill["hash_bill"] = hashCode(JSON.stringify(bill));

        const qrCodeText = `${baseUrl}${bill.src}`;
        const localQrPath = `${localQrDir}/${hash}.png`;
        const localPayedPdfPath = `${localBillingPayedDir}/${hash}.pdf`;
        const localPayedJsonPath = `${localBillingPayedDir}/${hash}.json`;
        const localPreBillPdfPath = `${localBillingToPayDir}/${hash}.pdf`;

        await qr.toFile(localQrPath, qrCodeText, {
            errorCorrectionLevel: "H",
            type: "image/png",
            quality: 0.95,
            margin: 3,
            color: {
                dark: "#000000ff",
                light: "#ffffffff",
            },
        });

        await makeBillPDF(bill, localPayedPdfPath, localQrPath);
        writeLocalJson(localPayedJsonPath, bill);

        if (fs.existsSync(localOrderPath)) {
            fs.unlinkSync(localOrderPath);
        }

        if (fs.existsSync(localPreBillPdfPath)) {
            fs.unlinkSync(localPreBillPdfPath);
        }

        console.log("Mock payment executed.");
        console.log(`Local paid bill PDF generated: ${localPayedPdfPath}`);
        console.log(`Local paid bill JSON saved: ${localPayedJsonPath}`);

        return [true, bill.src];
    }

    bill = typeof bill === "string" ? JSON.parse(bill) : bill;

    const done = await checkPayment(bill.order.hash, bill.blockchain_transaction_id);

    if (done == false) {
        return [false, undefined];
    }

    console.log("Payment executed");
    await deleteFileFromPod(obj.activeOrderContainerURL + `order-table-${bill.order.table_number}.json`, session);

    bill["payed"] = true;
    bill.src = obj.billPayedURL + bill.order.hash + ".pdf";
    bill["hash_bill"] = hashCode(JSON.stringify(bill));

    var qrCodeText = new URL(obj.billPayedURL + `${bill.order.hash}.pdf`).toString();

    await qr.toFile(`./utils/img/QR-tables/temp.png`, qrCodeText, {
        errorCorrectionLevel: "H",
        type: "image/png",
        quality: 0.95,
        margin: 3,
        color: {
            dark: "#000000ff",
            light: "#ffffffff",
        },
    });

    await makeBillPDF(bill);
    await deleteFileFromPod(obj.billToPayURL + `${bill.order.hash}.pdf`, session);
    await uploadFileFromPath(`./utils/temp.pdf`, "application/pdf", obj.billPayedURL, bill.order.hash + ".pdf", session);
    await createResourceSpecificPublicRulesPolicies(obj.billPayedURL + `${bill.order.hash}.pdf`, "billPayed", { read: true }, session);

    return [true, bill.src];
}

async function checkPayment(hashOrder, idTransaction) {
    if (!ethereum.rpcUrl) {
        throw new Error("Missing ETH_RPC_URL in .env. Cannot verify blockchain payment.");
    }

    if (!ethereum.smartContractAddress) {
        throw new Error("Missing SMART_CONTRACT_ADDRESS in .env. Cannot verify blockchain payment.");
    }

    var web3 = new Web3(ethereum.rpcUrl);
    var instanceContract = new web3.eth.Contract(ERC20ABI, ethereum.smartContractAddress);

    const result = await instanceContract.methods
        .getData(hashOrder.toString())
        .call();

    return result.toString() !== "";
}

function makePreBillPDF(bill, outputPath = "./utils/temp.pdf") {
    return new Promise((resolve, reject) => {
        let pdfDoc = new PDFDocument({ size: "A4", modifying: false });
        const stream = fs.createWriteStream(outputPath);

        stream.on("finish", resolve);
        stream.on("error", reject);

        pdfDoc.pipe(stream);

    //Structure    
    pdfDoc
        .fontSize(11.5)
        .text("Order Id : ", { align: 'left', continued:true })
        .text(bill.order.id_order, {oblique : true});

    pdfDoc.moveDown(1);

    pdfDoc
        .text("Date : ", {align: 'left', continued : true})
        .text(bill.order["time"] + "        ", { oblique : true, continued : true})
        .text("Order Id : ", { oblique : false, continued : true})
        .text(bill.order["id_order"] + "        ", {oblique : true, continued : true})
        .text("#Table : ", { oblique : false, continued : true})
        .text(bill.order["table_number"] + "       ", {oblique : true, continued : true})
        .text("Covers : ", { oblique : false, continued : true})
        .text(bill.order["covers"], {oblique : true });    
    pdfDoc.moveDown(2);
    
    let product = [];
    bill.order.products.forEach(function(element) {
        let arrTmp = [];
        arrTmp.push(element["id"]);
        arrTmp.push(element["name"]);
        arrTmp.push(element["quantity"]);
        arrTmp.push(element["price_per_unit"]);
        arrTmp.push(element["amount"]);

        product.push(arrTmp);
    });

    const table0 = {
        headers: [ "Id", "Product", "Qty", "Price", "Amount"],
        rows: product
    };
    
    pdfDoc.table(table0, {
        prepareHeader: () => pdfDoc.font('Helvetica-Bold'),
        prepareRow: (row, i) => pdfDoc.font('Helvetica').fontSize(12)
    });
    
    pdfDoc
        .fontSize(13)
        .text(`Total : ${bill.order["total"]}`, { align: 'right' });
        //.text(bill.order["total"], { oblique : true });
    pdfDoc.moveDown(2);

        pdfDoc.end();
    });
}

function makeBillPDF(bill, outputPath = "./utils/temp.pdf", qrPath = "./utils/img/QR-tables/temp.png") {
    return new Promise((resolve, reject) => {

        //insert in pdf
        let pdfDoc = new PDFDocument({ size: "A4", modifying: false });
        const stream = fs.createWriteStream(outputPath);

        stream.on("finish", resolve);
        stream.on("error", reject);

        pdfDoc.pipe(stream);

    //Structure
    pdfDoc
        .fontSize(16)
        .text(bill["name_activity"], { align: 'center'});
    pdfDoc.text(bill["group"], { align: 'center'});
    pdfDoc.moveDown(0.15);
    pdfDoc
        .fontSize(12.2)
        .text(bill["activity_address"], { align: 'center'});
    pdfDoc.text("P_IVA " + bill["p_iva"], { align: 'center'});
    pdfDoc.text(bill["phone"], { align: 'center'});
    pdfDoc.moveDown(3);
    
    pdfDoc
        .fontSize(11.5)
        .text("Bill Id : ", { align: 'left', continued:true })
        .text(bill["id_bill"], {oblique : true});
    pdfDoc
        .text("Bill Hash : ", { align: 'left', continued:true })
        .text(bill["hash_bill"], {oblique : true });
    pdfDoc.moveDown(1);

    pdfDoc
        .text("Date : ", {align: 'left', continued : true})
        .text(bill.order["time"] + "        ", { oblique : true, continued : true})
        .text("Order Id : ", { oblique : false, continued : true})
        .text(bill.order["id_order"] + "        ", {oblique : true, continued : true})
        .text("#Table : ", { oblique : false, continued : true})
        .text(bill.order["table_number"] + "       ", {oblique : true, continued : true})
        .text("Covers : ", { oblique : false, continued : true})
        .text(bill.order["covers"], {oblique : true });    
    pdfDoc.moveDown(2);
    
    let product = [];
    bill.order.products.forEach(function(element) {
        let arrTmp = [];
        arrTmp.push(element["id"]);
        arrTmp.push(element["name"]);
        arrTmp.push(element["quantity"]);
        arrTmp.push(element["price_per_unit"]);
        arrTmp.push(element["amount"]);

        product.push(arrTmp);
    });

    const table0 = {
        headers: [ "Id", "Product", "Qty", "Price", "Amount"],
        rows: product
    };
    
    pdfDoc.table(table0, {
        prepareHeader: () => pdfDoc.font('Helvetica-Bold'),
        prepareRow: (row, i) => pdfDoc.font('Helvetica').fontSize(12)
    });
    
    pdfDoc
        .fontSize(13)
        .text(`Total : ${bill.order["total"]}`, { align: 'right' });
        //.text(bill.order["total"], { oblique : true });
    pdfDoc.moveDown(2);

    pdfDoc
        .fontSize(12)
        .text("Payment Method : ", { align: 'left', continued : true })
        .text(bill["pay_mode"], { oblique : true});
    pdfDoc.moveDown(1);

    pdfDoc.text("Blockchain Details", { align: 'left'});
    pdfDoc.moveDown(0.5);

    pdfDoc
        .fontSize(10.5)
        .text(`Blockchain Type : ${bill["blockchain_type"]}`, { align: 'right' })
        //.text(bill["blockchain_type"], { oblique : true})

        .text(`Restaurant Wallet : ${bill["restaurantWallet"]}`, { align: 'right' })
        //.text(bill["restaurantWallet"], { oblique : true})

        .text(`Client Wallet : ${bill["clientWallet"]}`, { align: 'right' })
        //.text(bill["clientWallet"], { oblique : true})

        .text(`TransactionID : ${bill["blockchain_transaction_id"]}`, { align: 'right' });
        //.text(bill["blockchain_transaction_id"], { oblique : true});
    pdfDoc.moveDown(3);

    //insert the QR Code within the PDF
    // Fit the image in the dimensions, and center it both horizontally and vertically
    pdfDoc.image(qrPath, { align: "center", valign: "center" });

        pdfDoc.end();
    });
}

async function updateStore(json, session) {
    let store;

    if (!solidAuthEnabled && useLocalDataFallback) {
        ensureLocalRuntime();
        store = readLocalJson(localStoreFilePath);
    } else {
        store = await readFileFromPod(obj.storeFileURL, session);
    }

    Object.keys(json.products).forEach(function(k) {
        const orderedProduct = json.products[k];

        const storeIndex = store.products.findIndex(function(product) {
            return product.id === orderedProduct.id;
        });

        if (storeIndex === -1) {
            console.warn(`Product not found in store: ${orderedProduct.name}`);
            return;
        }

        store.products[storeIndex].quantity_available -= orderedProduct.quantity;

        if (store.products[storeIndex].quantity_available <= store.products[storeIndex].max_capacity * 0.15) {
            var units = store.products[storeIndex].max_capacity - store.products[storeIndex].quantity_available;
            store.products[storeIndex].quantity_available = store.products[storeIndex].max_capacity;

            console.log(
                "Product:",
                store.products[storeIndex].name,
                "refunded of",
                units,
                "units"
            );
        }
    });  

    if (!solidAuthEnabled && useLocalDataFallback) {
        writeLocalJson(localStoreFilePath, store);
        console.log(`Local store updated: ${localStoreFilePath}`);
        return;
    }

    await uploadJSON(JSON.stringify(store), obj.storeContainerURL, "store.json", session);
}

//################################  INITIALIZE SECTION   -------------------------------------
async function createStoreSection(session) {

    console.log("CreateStoreSection");

    await createContainer(obj.storeContainerURL, session);

    await createAgentRuleACP(obj.acp, obj.restaurantWebID, "restaurant", "store", session);
    await createPolicyACP(obj.acp, { read:true, write:true, append:true }, "restaurant", "store", session);
    await createMemberRulesPolicies(obj.storeContainerURL, obj.acp, "restaurant", "store", session);

    //insert as file .json
    await uploadFileFromPath(obj.storeFilePath, "application/json", obj.storeContainerURL, "store.json", session);
    await uploadFileFromPath("./utils/img/water.jpg", "image/jpeg", obj.storeContainerURL, "water.jpg", session);
    await uploadFileFromPath("./utils/img/pasta.jpg", "image/jpeg", obj.storeContainerURL, "pasta.jpg", session);
    await uploadFileFromPath("./utils/img/coffee.jpg", "image/jpeg", obj.storeContainerURL, "coffee.jpg", session);
    await uploadFileFromPath("./utils/img/pizza.jpg", "image/jpeg", obj.storeContainerURL, "pizza.jpg", session);
    await uploadFileFromPath("./utils/img/beef.jpg", "image/jpeg", obj.storeContainerURL, "beef.jpg", session);
    await uploadFileFromPath("./utils/img/hamburger.jpg", "image/jpeg", obj.storeContainerURL, "hamburger.jpg", session);
    await uploadFileFromPath("./utils/img/smoked-salmon.jpg", "image/jpeg", obj.storeContainerURL, "smoked-salmon.jpg", session);
    await uploadFileFromPath("./utils/img/bread.jpg", "image/jpeg", obj.storeContainerURL, "bread.jpg", session);
    await uploadFileFromPath("./utils/img/fruits.jpg", "image/jpeg", obj.storeContainerURL, "fruits.jpg", session);
    

    //set access public to retrieve externally the image
    createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "water.jpg", "img", { read:true }, session);
    createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "pasta.jpg", "img", { read:true }, session);
    createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "coffee.jpg", "img", { read:true }, session);
    createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "pizza.jpg", "img", { read:true }, session);
    createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "hamburger.jpg", "img", { read:true }, session);
    createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "smoked-salmon.jpg", "img", { read:true }, session);
    createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "bread.jpg", "img", { read:true }, session);
    createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "fruits.jpg", "img", { read:true }, session);
    createResourceSpecificPublicRulesPolicies(obj.storeFileURL, "store", { read:true }, session);
    await createResourceSpecificPublicRulesPolicies(obj.storeContainerURL + "beef.jpg", "img", { read:true }, session);
    
    //set access for restaurant as:
    //await createResourceSpecificRulesPolicies(obj.storeFileURL, "menu", { read:true, write:true }, obj.restaurantWebID, session);
    // createResourceSpecificRulesPolicies(obj.storeContainerURL + "water.jpg", "img", { read:true }, obj.restaurantWebID, session);
    // createResourceSpecificRulesPolicies(obj.storeContainerURL + "pasta.jpg", "img", { read:true }, obj.restaurantWebID, session);
    // createResourceSpecificRulesPolicies(obj.storeContainerURL + "coffee.jpg", "img", { read:true }, obj.restaurantWebID, session);
    // createResourceSpecificRulesPolicies(obj.storeContainerURL + "pizza.jpg", "img", { read:true }, obj.restaurantWebID, session);
    // await createResourceSpecificRulesPolicies(obj.storeContainerURL + "beef.jpg", "img", { read:true }, obj.restaurantWebID, session);
    //set access for authority as:   FALSE

}

async function createBillingSection(session) {

    console.log("CreateBillingSection");
    await createContainer(obj.billToPayURL, session);
    await createContainer(obj.billPayedURL, session);

    await uploadFileFromPath(obj.billingFilePath, "application/json", obj.billToPayURL, "bill-temp.json",session);

    //set access for restaurant as:
    await createAgentRuleACP(obj.acp, obj.restaurantWebID, "restaurant", "billing", session);
    await createPolicyACP(obj.acp, { read:true, write:true, append:true }, "restaurant", "billing", session);
    await createMemberRulesPolicies(obj.billToPayURL, obj.acp, "restaurant", "billing", session);
    await createMemberRulesPolicies(obj.billPayedURL, obj.acp, "restaurant", "billing", session);
    await createResourceSpecificRulesPolicies(obj.billingFileURL, "bill", { read:true }, obj.restaurantWebID, session);
    // //set access for authority as:                                 
    await createAgentRuleACP(obj.acp, obj.authorityWebID, "authority", "billing", session);
    await createPolicyACP(obj.acp, { read:true }, "authority", "billing", session);
    await createMemberRulesPolicies(obj.billPayedURL, obj.acp, "authority", "billing", session);
    // //set access for ERP as:                                 
    await createAgentRuleACP(obj.acp, obj.erpWebID, "erp", "billing", session);
    await createPolicyACP(obj.acp, { read:true }, "erp", "billing", session);
    await createMemberRulesPolicies(obj.billPayedURL, obj.acp, "erp", "billing", session);
    
}

async function createActiveOrderSection(session) {

    console.log("CreateOrderSection");    
    await createContainer(obj.activeOrderContainerURL, session);

    //set access for restaurant as:              
    await createAgentRuleACP(obj.acp, obj.restaurantWebID, "restaurant", "active_order", session);
    await createPolicyACP(obj.acp, { read:true, write:true, append:true }, "restaurant", "active_order", session);
    await createMemberRulesPolicies(obj.activeOrderContainerURL, obj.acp, "restaurant", "active_order", session);
    
    await uploadFileFromPath(obj.activeOrderFilePath, "application/json", obj.activeOrderContainerURL, "order-temp.json", session);
    await createResourceSpecificPublicRulesPolicies(obj.activeOrderFileURL, "activeOrder", { read:true }, session);
    //set access for authority as: FALSE

    await deleteFileFromPod(obj.activeOrderContainerURL + "order-table-1.json", session);
    await deleteFileFromPod(obj.activeOrderContainerURL + "order-table-2.json", session);
    await deleteFileFromPod(obj.activeOrderContainerURL + "order-table-3.json", session);
    await deleteFileFromPod(obj.activeOrderContainerURL + "order-table-4.json", session);
  
}

async function initialize(token) {
    //login as admin 
    const session = await login("Admin-", token);

    await createDatasetACP(obj.acp, session);

    if(session.info.webId != obj.CEOWebID){
        await createAgentRuleACP(obj.acp, obj.CEOWebID, "restaurantCEO", "adminRoot", session);
        await createPolicyACP(obj.acp, { read:true, write:true, append:true }, "restaurantCEO", "adminRoot", session);
        await createMemberRulesPolicies(obj.adminRoot, obj.acp, "restaurantCEO", "adminRoot", session);
    }

    //!!INFO: TO DELETE WE NEED TO HAVE AN EMPTY CONTAINER
    //AT THE MOMENT THIS CAN BE DONE BY MANUAL DELETION
    await deleteContainerFromPod(obj.root, session);
    await createContainer(obj.root, session);

    createStoreSection(session);
    createBillingSection(session);
    await createActiveOrderSection(session);

    //logout(session);
}


module.exports = { 
    sleep,
    login,
    logout,
    getMenu,
    makeOrder,
    takeBill,
    getPayment,
    updateStore,
    initialize
};