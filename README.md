# Restaurant Web-App: Solid Pods and Blockchain Payment Prototype

## Overview

This repository contains a legacy MSc thesis prototype that implements a restaurant ordering workflow using:

- Node.js and Express for the backend
- EJS server-rendered pages for the frontend
- Solid Pods for menu, order and bill storage
- PDFKit for bill generation
- QR codes for table-specific access
- MetaMask/Web3 for Ethereum-based payment interaction
- A Solidity smart contract for storing and verifying payment-related order data

The project is preserved and modernized as an educational and research artifact. It is not production-ready in its original form.

## Project context

The original goal was to demonstrate how a restaurant workflow could be implemented with decentralized data storage and blockchain-based payment verification.

At a high level, the prototype models this flow:

1. A customer scans a QR code associated with a restaurant table.
2. The app loads the restaurant menu from a Solid Pod.
3. The customer creates or updates an order.
4. The active order is stored in the Solid Pod.
5. The customer requests the bill.
6. The app generates a pre-payment PDF bill.
7. The customer pays through MetaMask.
8. The app checks the blockchain transaction / contract state.
9. The final paid bill is generated and stored in the Solid Pod.

## Legacy status

This project was originally developed around 2021-2022 and reflects the tools and assumptions available at that time.

Known legacy aspects include:

- Node.js 14 runtime originally used
- Kovan Ethereum testnet originally used
- Manual MetaMask interaction from the browser
- Solid Pod URLs and WebIDs originally hardcoded
- Ethereum RPC endpoint, contract address and wallet address originally hardcoded
- Demo-style global server state
- No automated test suite
- Limited error handling
- Server-side trust in client-submitted order data
- Initialization flow tied to an existing Solid Pod structure

The current modernization work aims to preserve the original research idea while making the repository safer, clearer and easier to run.

## Repository structure

```text
.
|-- restaurant.js
|   Main Express server entry point.
|
|-- src/
|   |-- client-functions.js
|   |   Business logic for menu loading, order creation, bill creation,
|   |   Solid Pod updates and payment verification.
|   |
|   |-- solid-lib-interface.js
|   |   Helper functions wrapping Inrupt Solid client operations.
|   |
|   |-- pdf-kit-ext.js
|       PDFKit table helper extension.
|
|-- views/
|   |-- index.ejs
|   |-- menu.ejs
|   |-- bill.ejs
|   |-- payment.ejs
|   |-- table-failed.ejs
|       EJS templates rendered by Express.
|
|-- static/css/
|   CSS assets used by the EJS pages.
|
|-- utils/
|   |-- store.json
|   |-- order-temp.json
|   |-- bill-temp.json
|   |-- smart-contract.sol
|   |-- img/
|       Sample data, contract source and local image assets.
|
|-- .env.example
|   Example environment configuration.
|
|-- .gitignore
|   Ignore rules for dependencies, secrets and generated files.
```

## Requirements

Recommended modern setup:

```bash
node --version
npm --version
```

Use Node.js 24 LTS or newer where possible.

You also need:

- npm
- a Solid Pod provider / account setup
- refresh-token credentials for the Solid accounts used by the app
- MetaMask or another EIP-1193-compatible wallet
- an Ethereum RPC endpoint
- a deployed copy of the smart contract, or a local test chain such as Hardhat

## Setup

Clone the repository and install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Then fill the values in `.env`.

Never commit `.env`.

## Environment variables

The repository should use environment variables for all sensitive or deployment-specific configuration.

Expected variables:

```env
PORT=8080
BASE_URL=http://localhost:8080
TABLE_COUNT=4

SOLID_ROOT_CONTEXT=testing/root1
SOLID_TEST_NUMBER=1

ADMIN_SOLID_PROVIDER=
ADMIN_SOLID_REFRESH_TOKEN=
ADMIN_SOLID_CLIENT_ID=
ADMIN_SOLID_CLIENT_SECRET=

RESTAURANT_SOLID_PROVIDER=
RESTAURANT_SOLID_REFRESH_TOKEN=
RESTAURANT_SOLID_CLIENT_ID=
RESTAURANT_SOLID_CLIENT_SECRET=

ADMIN_POD_BASE_URL=
RESTAURANT_WEB_ID=
CEO_WEB_ID=
AUTHORITY_WEB_ID=
ERP_WEB_ID=
ADMIN_WEB_ID=

ETH_NETWORK=sepolia
ETH_RPC_URL=
SMART_CONTRACT_ADDRESS=
RESTAURANT_WALLET_ADDRESS=
ETH_CHF_RATE=3919
```

## Running the app

Start the server:

```bash
npm start
```

Open one of the table routes:

```text
http://localhost:8080/1
http://localhost:8080/2
http://localhost:8080/3
http://localhost:8080/4
```

The application is table-based. Each route represents one restaurant table.

## Initializing the Solid Pod structure

The original project includes an initialization command that creates the Solid Pod containers, uploads the menu and template files, and configures access rules.

Use:

```bash
npm run init:pods
```

or, in the original version:

```bash
node restaurant.js --initialize
```

This step requires valid Solid credentials and a Pod structure matching the environment variables.

Important: initialization may delete and recreate the configured test container. Do not point this command to a Pod area containing data you want to preserve.

## Main user flow

### 1. Open a table page

The customer opens:

```text
http://localhost:8080/<table-number>
```

Example:

```text
http://localhost:8080/1
```

The backend loads:

- the public restaurant menu from the Solid Pod
- the active order for the selected table, if it exists
- otherwise, the empty order template

### 2. Create or update the order

The customer selects products and submits the order.

The app:

- calculates quantities and totals
- stores the active order as JSON in the Solid Pod
- updates the store inventory file

### 3. Request the bill

The customer clicks the bill action.

The app:

- reads the active order from the Solid Pod
- verifies the order hash
- creates a pre-payment PDF bill
- uploads the pre-payment PDF to the Solid Pod

### 4. Pay through MetaMask

The customer confirms a blockchain payment in the browser wallet.

The original implementation used a legacy MetaMask/Web3 flow. The modernized version should use:

```js
await window.ethereum.request({ method: "eth_requestAccounts" });
```

### 5. Verify payment and generate final bill

The backend checks whether the payment data is present on-chain.

If verified, it:

- deletes the active order
- marks the bill as paid
- generates a final bill PDF
- creates a QR code pointing to the paid bill
- uploads the final bill to the Solid Pod

## Security and publication checklist

Before publishing this repository, verify that:

- no real refresh tokens are committed
- no real client secrets are committed
- no private Solid Pod URLs are exposed unless intentionally public
- no private wallet addresses are exposed unless intentionally public
- no Infura or RPC project IDs are hardcoded
- `.env` is ignored
- generated PDFs are ignored
- generated QR codes are ignored
- temporary JSON files are ignored
- Windows metadata files such as `*:Zone.Identifier` are removed
- the README clearly states that this is a legacy educational prototype

## Known limitations

This repository is a prototype and currently has several limitations:

- It uses demo-style global server state.
- Concurrent users/tables may interfere with one another in the legacy implementation.
- The original payment flow depends on manual MetaMask confirmation.
- The original Ethereum integration targeted Kovan, which is deprecated.
- Server-side validation of submitted order data is incomplete.
- The order hash is a simple JavaScript hash and should not be considered cryptographically secure.
- The app has limited automated testing.
- The Solid Pod initialization flow assumes specific accounts and access-control policies.

## Recommended modernization roadmap

### Step 1 - Safe public release

- remove hardcoded credentials
- move configuration to `.env`
- update `.gitignore`
- add `.env.example`
- add this README
- document legacy limitations

### Step 2 - Make the demo runnable again

- add `dotenv`
- update `package.json` scripts
- add `npm run init:pods`
- make `BASE_URL`, table count and QR-code URL configurable
- replace Kovan RPC with configurable `ETH_RPC_URL`
- replace hardcoded contract and wallet addresses
- update MetaMask connection to `eth_requestAccounts`

### Step 3 - Improve architecture

- move frontend JavaScript out of EJS templates
- replace global server state with table-scoped state
- validate orders server-side
- add better error handling
- add test fixtures for local demo mode

### Step 4 - Add local blockchain mode

- add Hardhat
- add contract deployment script
- add local network instructions
- allow the full payment demo to run without relying on external testnets

### Step 5 - Improve Solid developer experience

- add a dry-run mode
- add safer initialization
- avoid deleting Pod containers unless explicitly confirmed
- document the Solid container structure
- document required WebIDs and permissions

## License

Add the intended license before publishing.

Recommended options:

- MIT for a permissive software artifact
- Apache-2.0 for a permissive license with explicit patent language
- no license initially if you do not yet want to grant reuse rights

## Citation / academic context

If this repository is linked to an MSc thesis or academic demonstration, add the thesis title, university, year and author information here.

Example:

```text
Developed as part of an MSc thesis prototype on decentralized data storage and blockchain-based payment verification.
```
