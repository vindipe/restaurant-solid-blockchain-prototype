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

const testNumber = "34";

const obj = {
    adminRoot : `https://pod.inrupt.com/admintest1/dev/root/`,
    root : `https://pod.inrupt.com/admintest1/dev/root/test${testNumber}/`,
    acp : `https://pod.inrupt.com/admintest1/dev/root/acp/myrulesandpolicies`,

    storeContainerURL : `https://pod.inrupt.com/admintest1/dev/root/test${testNumber}/store/`,
    billToPayURL : `https://pod.inrupt.com/admintest1/dev/root/test${testNumber}/billing/to-pay/`,
    billPayedURL : `https://pod.inrupt.com/admintest1/dev/root/test${testNumber}/billing/payed/`,
    activeOrderContainerURL : `https://pod.inrupt.com/admintest1/dev/root/test${testNumber}/activeorder/`,

    storeFileURL : `https://pod.inrupt.com/admintest1/dev/root/test${testNumber}/store/store.json`,
    billingFileURL : `https://pod.inrupt.com/admintest1/dev/root/test${testNumber}/billing/to-pay/bill-temp.json`,
    activeOrderFileURL : `https://pod.inrupt.com/admintest1/dev/root/test${testNumber}/activeorder/order-temp.json`,

    storeFilePath : "./utils/store.json",
    billingFilePath : "./utils/bill-temp.json",
    activeOrderFilePath : "./utils/order-temp.json",
    
    restaurantInruptWebID : "https://pod.inrupt.com/ristorante1/profile/card#me",
    restaurantWebID : "https://ristorante1.solidcommunity.net/profile/card#me",
    CEOWebID : "https://restaurantCEO.solidcommunity.net/profile/card#me",
    authorityWebID : "https://pod.inrupt.com/authoritycheck/profile/card#me",
    erpWebID : "https://pod.inrupt.com/erp/profile/card#me",
    adminWebID : "https://pod.inrupt.com/admintest1/profile/card#me"
};


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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function login(sessionID, token){    
    const session = await logging(sessionID, token);
    return session;
}

function logout(session){
    logOut(session);
}

async function getMenu(tableNumber) {
    //get the resources for the menù
    var json = await readPublicFileFromPod(obj.storeFileURL);
    var order = await readPublicFileFromPod(obj.activeOrderContainerURL+`order-table-${tableNumber}.json`);
    if (order == undefined)
        order = await readPublicFileFromPod(obj.activeOrderFileURL);

    return [json, order];    
}

async function makeOrder(req, session) {  
    //get info/params for order
    var order = JSON.parse(req); 

    if(order["id_order"] == "orderID"){
        let orderID = "order-";
        orderID += Math.random().toString(36).substr(2, 9);
        order["id_order"] = orderID;
    }

    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var result = date+'-'+time;
    order["time"] = result;

    var total = 0;
    Object.keys(order.products).forEach(function(k){
        order.products[k].amount = order.products[k].quantity * order.products[k].price_per_unit;
        total += order.products[k].amount;
    });   
    order["total"] = total;

    //insert as file .json
    var table = order.table_number.toString();
    order = JSON.stringify(order);
    await uploadJSON(order, obj.activeOrderContainerURL, `order-table-${table}.json`, session);
    await createResourceSpecificPublicRulesPolicies(obj.activeOrderContainerURL+`order-table-${table}.json`, "activeOrder", { read:true }, session);

    return JSON.parse(order);
}

async function takeBill(table, session) {     //(orderID, session)
    //delete the order from ActiveOrder   
    const orderURL = obj.activeOrderContainerURL + `order-table-${table}.json`;
    var order = await readFileFromPod(orderURL, session);

    //aggiungo controllo sull'hash dell'ordine
    var tmpOrder = order;
    tmpOrder.hash = "";
    tmpOrder.hash = hashCode(JSON.stringify(tmpOrder));

    if (tmpOrder.hash != order.hash){
        console.log("Your hash seems to not correspond to the order.");
        return false;
    }

    //make the bill as json
    var bill = await readFileFromPod(obj.billingFileURL, session);  
    bill["order"] = order;
    
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var result = date+'-'+time;
    bill.src = obj.billToPayURL + bill.order.hash + ".pdf";
    bill["id_bill"] += result;
    var billID = bill["id_bill"];

    // bill = JSON.stringify(bill);
    // await uploadJSON(bill, obj.billToPayURL, `${billID}.json`, session);

    //insert in bill container   
    makePreBillPDF(bill);
    await uploadFileFromPath(`./utils/temp.pdf`, "application/pdf", obj.billToPayURL, bill.order.hash + ".pdf", session);
    await createResourceSpecificPublicRulesPolicies(obj.billToPayURL+`${bill.order.hash}.pdf`, "billToPay", { read:true }, session);

    return bill;
}

async function getPayment(bill, session) {

    bill = JSON.parse(bill);

    const done = await checkPayment(bill.order.hash, bill.blockchain_transaction_id);

    if (done == false) {
        // console.log("Payment not executed");
        return false;
    }

    console.log("Payment executed");
    await deleteFileFromPod(obj.activeOrderContainerURL + `order-table-${bill.order.table_number}.json`, session);

    bill["payed"] = true;
    bill.src =  obj.billPayedURL + bill.order.hash + ".pdf";
    bill["hash_bill"] = hashCode(JSON.stringify(bill));

    //create QRpayed 
    //create link request to encode
    var qrCodeText = new URL(obj.billPayedURL + `${bill.order.hash}.pdf`).toString();   
    // const params = new URLSearchParams({
    //     method: "GET",
    //     var2: "value2",
    //     arr: "foo",
    //   }).toString();
    // qrCodeText += params;

    await qr.toFile(`./utils/img/QR-tables/temp.png`, qrCodeText, {
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

    //insert in bill container   
    makeBillPDF(bill);
    deleteFileFromPod(obj.billToPayURL + `${bill.order.hash}.pdf`, session);
    await uploadFileFromPath(`./utils/temp.pdf`, "application/pdf", obj.billPayedURL, bill.order.hash + ".pdf", session);
    await createResourceSpecificPublicRulesPolicies(obj.billPayedURL +`${bill.order.hash}.pdf`, "billPayed", { read:true }, session);

    return [true, bill.src];      
}

async function checkPayment(hashOrder, transactionID){

    try {
        // Instantiate web3 with HttpProvider
        var web3 = new Web3(`https://kovan.infura.io/v3/09025260fc864cd09d057f68852e45ea`);        

        //################################ Contract Case #################################à
        var ERC20ABI = [
            {
                "inputs": [],
                "stateMutability": "nonpayable",
                "type": "constructor"
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "amount",
                        "type": "uint256"
                    },
                    {
                        "internalType": "string",
                        "name": "_orderHash",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "_data",
                        "type": "string"
                    }
                ],
                "name": "forwardPayment",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "string",
                        "name": "_orderHash",
                        "type": "string"
                    }
                ],
                "name": "getData",
                "outputs": [
                    {
                        "internalType": "string",
                        "name": "data",
                        "type": "string"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "stateMutability": "payable",
                "type": "receive"
            }
        ];
        var instanceContract = new web3.eth.Contract(ERC20ABI, "0x396DC917E64909Dfd3081FE1Ac461c14b87Dc6a8");
        await instanceContract.methods
            .getData(hashOrder.toString())
            .call({ from: "0x684F22798FEf8dDcaCB8278447703787293cEe07" }, function (err, res) {
                if (err) {
                    console.log("An error occured", err)
                    return
                }
                // return JSON.parse(res).order.hash.toString() == hashOrder.toString();
                return res.toString() != "";
            });

        //################################ Transaction Case #################################à
        /**
        const trx = await web3.eth.getTransaction(transactionID);

        console.log("TRX : ", trx.input);

        // Get current block number
        const currentBlock = await web3.eth.getBlockNumber();

        // When transaction is unconfirmed, its block number is null.
        // In this case we return 0 as number of confirmations
        let trxConfirmations;
        if (trx.blockNumber === null)
            trxConfirmations = 0;
        else 
            trxConfirmations = currentBlock - trx.blockNumber;

        // Get current number of confirmations and compare it with sought-for value

        console.log('Transaction with hash ' + transactionID + ' has ' + trxConfirmations + ' confirmation(s)')

        if (trxConfirmations >= 2) {
            // Handle confirmation event according to your business logic
            
            console.log('Transaction with hash ' + transactionID + ' has been successfully confirmed')

            if(web3.hexToAscii(trx.input) == hashOrder)
                return true;
            else
                console.log("The transaction does not contain the correct order hash!");
        };

        return false;  
        */    
    }
    catch (error) {
        console.log(error)
    };
}

function makePreBillPDF(bill){
    let pdfDoc = new PDFDocument({size: 'A4', modifying:false });
    pdfDoc.pipe(fs.createWriteStream(`./utils/temp.pdf`));

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
}

function makeBillPDF(bill){    
    
    //insert in pdf
    let pdfDoc = new PDFDocument({size: 'A4', modifying:false });
    pdfDoc.pipe(fs.createWriteStream(`./utils/temp.pdf`));

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
    pdfDoc.image(`./utils/img/QR-tables/temp.png`, {align: 'center', valign: 'center'});

    pdfDoc.end();
}

async function updateStore(json, session) {
    //get the store to update 
    var store = await readFileFromPod(obj.storeFileURL, session);

    //take the json (the order) and subtract each field to the relative in store
    Object.keys(json.products).forEach(function(k){
        store.products[k].quantity_available -= json.products[k].quantity;
        if (store.products[k].quantity_available <= store.products[k].max_capacity*0.15){
            var units = store.products[k].max_capacity - store.products[k].quantity_available;
            store.products[k].quantity_available = store.products[k].max_capacity;
            console.log("Product: ", store.products[k].name, " refunded of ", units ," units");
        }
    });  

    //update the file
    store = JSON.stringify(store);
    await uploadJSON(store, obj.storeContainerURL, "store.json", session);
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