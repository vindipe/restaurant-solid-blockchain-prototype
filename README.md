# Restaurant Solid Blockchain Prototype

Legacy MSc thesis prototype modernized into a reproducible local demo for a restaurant ordering workflow involving Solid Pods concepts, PDF bill generation, and blockchain-style payment verification.

The original project was developed as an academic prototype. This repository keeps that context explicit while making the project easier to run, inspect, and extend today.

## Current status

The project currently has a stable **local demo mode**.

In local demo mode, the application can run without:

- a working Solid Pod;
- Solid refresh-token credentials;
- MetaMask;
- Infura or another RPC provider;
- Sepolia ETH;
- a deployed smart contract.

The local demo uses local JSON fixtures and generated runtime files to reproduce the main application flow:

1. open a table page;
2. load the restaurant menu;
3. create an order;
4. update local runtime inventory;
5. generate a pre-payment bill PDF;
6. complete a mock payment;
7. generate a final paid bill PDF;
8. download the bill.

The original Solid and blockchain integrations are still present as legacy/prototype code, but they are not treated as production-ready. The repository now includes safe tooling to inspect and rebuild the Solid side before attempting any real Pod initialization.

## Why this repository exists

This project is useful as:

- a preserved MSc thesis artifact;
- a practical example of a server-rendered Node.js prototype;
- a local demo of a restaurant ordering and bill-generation workflow;
- a starting point for rebuilding a Solid Pods integration in a controlled way;
- a portfolio repository showing how an old prototype can be cleaned, documented, tested, and made reproducible.

It should not be presented as a production restaurant system.

## Main features

### Working local demo

- table-based route access;
- menu rendering from local fixtures;
- local order creation;
- local runtime inventory updates;
- PDF bill generation;
- mock payment flow;
- downloadable paid bill;
- smoke test for the local app.

### Solid rebuild tooling

The repository includes non-destructive Solid tooling:

- `solid:env` checks Solid-related environment configuration;
- `solid:fixtures` validates local files before upload;
- `solid:plan` prints the expected Pod structure;
- `solid:export-plan` writes a local JSON plan;
- `solid:readiness` runs the main non-destructive readiness checks;
- `solid:probe` checks configured Solid URLs without authentication;
- `solid:probe:auth` checks configured Solid URLs with authenticated admin fetch;
- `init:pods` is protected by `ALLOW_POD_RESET=true`.

### Repository safety checks

- `.env` is ignored;
- local runtime files are ignored;
- generated PDFs are ignored;
- generated QR files are ignored;
- Dropbox and Windows metadata files are ignored;
- a `doctor` command checks common privacy and repository hygiene issues.

## Stack

- Node.js
- Express
- EJS
- PDFKit
- QRCode
- Solid client libraries
- Web3 legacy dependency retained for future blockchain-mode modernization
- Solidity smart contract source retained as legacy artifact

## Repository structure

```text
.
|-- restaurant.js
|   Main Express application and command entry point.
|
|-- src/
|   |-- config.js
|   |   Centralized environment-based configuration.
|   |
|   |-- client-functions.js
|   |   Core application logic for menu loading, orders, store updates,
|   |   bill generation, payment handling, local fallback, and Solid setup.
|   |
|   |-- solid-lib-interface.js
|   |   Legacy Solid helper functions.
|   |
|   |-- pdf-kit-ext.js
|       PDFKit table helper.
|
|-- scripts/
|   |-- doctor.js
|   |   Repository hygiene and privacy checks.
|   |
|   |-- test-local-flow.js
|   |   Local server smoke test.
|   |
|   |-- solid-env-check.js
|   |   Solid environment validation.
|   |
|   |-- solid-fixtures.js
|   |   Solid fixture validation.
|   |
|   |-- solid-export-plan.js
|       Exports a local Solid planning file.
|
|-- views/
|   EJS templates.
|
|-- static/css/
|   CSS files.
|
|-- utils/
|   |-- store.json
|   |-- order-temp.json
|   |-- bill-temp.json
|   |-- smart-contract.sol
|   |-- img/
|       Local fixtures, images, and legacy smart contract source.
|
|-- .env.example
|   Local demo environment example.
|
|-- .env.solid.example
|   Solid-specific environment example.
```

## Requirements

The current tested environment is:

```text
Node.js 18.x
npm 9.x
```

The project may work with newer Node/npm versions, but some dependencies are legacy and should be updated carefully.

Check your versions:

```bash
node --version
npm --version
```

## Installation

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Do not commit `.env`.

## Local demo configuration

For the local demo, `.env` should include:

```env
PORT=8080
BASE_URL=http://localhost:8080
TABLE_COUNT=4

USE_LOCAL_DATA_FALLBACK=true
SOLID_AUTH_ENABLED=false
PAYMENT_MODE=mock
ALLOW_POD_RESET=false
```

Meaning:

- `USE_LOCAL_DATA_FALLBACK=true`: use local fixtures when Solid is unavailable;
- `SOLID_AUTH_ENABLED=false`: do not attempt Solid login during normal app use;
- `PAYMENT_MODE=mock`: complete payment locally without MetaMask/blockchain;
- `ALLOW_POD_RESET=false`: prevent destructive Solid initialization.

## Running the local demo

Start the app:

```bash
npm start
```

Open:

```text
http://localhost:8080/
```

or directly:

```text
http://localhost:8080/1
http://localhost:8080/2
http://localhost:8080/3
http://localhost:8080/4
```

Recommended manual flow:

1. open a table page;
2. add a product;
3. open the cart;
4. click `Order`;
5. return to the table page if needed;
6. click `Get Bill`;
7. click `Complete Mock Payment`;
8. download the final bill;
9. click `Back to Table`.

Expected terminal messages include:

```text
Local demo mode enabled. Loading menu and order from local runtime files.
Local order saved: ./utils/runtime/activeorder/order-table-1.json
Local store updated: ./utils/runtime/store.json
Local pre-bill PDF generated: ./utils/runtime/billing/to-pay/<hash>.pdf
Mock payment executed.
Local paid bill PDF generated: ./utils/runtime/billing/payed/<hash>.pdf
```

## Cleaning local runtime data

The local demo writes generated files under:

```text
utils/runtime/
```

Clean them with:

```bash
npm run clean:runtime
```

These files are ignored by Git.

## Available commands

### Application

```bash
npm start
```

Start the Express app.

```bash
npm run dev
```

Start the app with Nodemon.

```bash
npm run clean:runtime
```

Delete local runtime files.

### Tests and repository checks

```bash
npm run doctor
```

Run repository hygiene checks.

```bash
npm run test:local-flow
```

Run the local server smoke test.

```bash
npm test
```

Run the doctor check and local flow smoke test.

### Solid inspection and rebuild tooling

```bash
npm run solid:env
```

Check Solid-related environment variables.

```bash
npm run solid:fixtures
```

Validate local fixtures intended for Solid upload.

This currently warns that `utils/store.json` uses the legacy field `cost_per_unit`. That warning is expected.

```bash
npm run solid:plan
```

Print the expected Solid Pod structure.

```bash
npm run solid:export-plan
```

Export the expected Solid structure to:

```text
solid-plan.local.json
```

This file is ignored by Git.

```bash
npm run solid:readiness
```

Run the main non-destructive Solid readiness checks:

```text
solid:env
solid:fixtures
solid:export-plan
```

```bash
npm run solid:probe
```

Perform read-only public GET requests against the configured Solid URLs.

```bash
npm run solid:probe:auth
```

Perform read-only authenticated GET requests using admin Solid credentials.

```bash
npm run init:pods
```

Run the legacy Solid initialization flow.

This command is protected and refuses to proceed unless:

```env
ALLOW_POD_RESET=true
```

Only use this on a dedicated test Pod path.

## Solid rebuild workflow

The historical Pod path used by the original project is no longer assumed to work. If `solid:probe` returns HTML pages or redirects to an Inrupt profile/landing page, the app is not receiving the expected Solid resources.

Recommended rebuild order:

```bash
npm run solid:env
npm run solid:fixtures
npm run solid:plan
npm run solid:export-plan
npm run solid:probe
npm run solid:probe:auth
```

Only after the environment, target URLs, and credentials are correct should you consider:

```env
ALLOW_POD_RESET=true
```

and then:

```bash
npm run init:pods
```

After initialization, immediately return to:

```env
ALLOW_POD_RESET=false
```

Recommended Solid path convention:

```env
SOLID_ROOT_CONTEXT=restaurant-demo
SOLID_TEST_NUMBER=1
```

Use a dedicated test area. Do not point initialization at personal, production, or shared Pod areas.

## Blockchain/payment status

The default payment flow is:

```env
PAYMENT_MODE=mock
```

This is intentional. It makes the demo reproducible without relying on a live chain.

Future blockchain mode should use:

```env
PAYMENT_MODE=blockchain
ETH_NETWORK=sepolia
ETH_RPC_URL=
SMART_CONTRACT_ADDRESS=
RESTAURANT_WALLET_ADDRESS=
```

The old Kovan-oriented flow is not treated as current. The blockchain path should be rebuilt with Sepolia or a local Hardhat network.

## Generated and ignored files

The following are runtime/generated and should not be committed:

```text
.env
utils/runtime/
utils/temp.pdf
utils/temp.json
utils/img/QR-tables/*.png
solid-plan.local.json
```

The repository keeps:

```text
utils/img/QR-tables/.gitkeep
```

so that the QR directory exists without tracking generated images.

## Privacy and safety checks

Before publishing or pushing changes:

```bash
npm run doctor
```

Additional manual checks:

```bash
git ls-files | grep -E '(^\.env$|utils/runtime|utils/temp|QR-tables/.*\.png|dropbox|Zone.Identifier)'
```

Expected output: nothing.

```bash
grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=utils/runtime --exclude=package-lock.json \
  "kovan.infura\|396DC917\|09025260fc864cd09d057f68852e45ea\|Administrator0\|Ristorante1\|Authority2" .
```

Expected output: nothing except intentional matches inside check scripts, if those scripts are not excluded.

## Known limitations

This is still a legacy prototype.

Current limitations:

- demo-style global server state;
- no database;
- no browser-level automated tests;
- limited server-side validation;
- mock payment is not a real blockchain transaction;
- Solid initialization requires a fresh, carefully configured Pod context;
- blockchain mode requires modernization;
- `cost_per_unit` is a legacy store field;
- the current order/bill hash is a legacy JavaScript hash and can produce negative identifiers.

## Roadmap

Recommended next steps:

1. rebuild Solid integration on a fresh Pod;
2. replace the legacy JavaScript hash with SHA-256 identifiers;
3. refactor global state into table-scoped state;
4. add deeper tests for order, bill, and mock payment flows;
5. modernize blockchain payment using Sepolia or Hardhat;
6. normalize store schema from `cost_per_unit` to `price_per_unit`;
7. move frontend JavaScript out of EJS templates;
8. improve UI and error handling.

## Academic context

This repository is connected to an MSc thesis prototype on decentralized accounting/document-management workflows using Solid Pods and blockchain-based transaction/payment concepts.

It is maintained here as a cleaned and reproducible research/portfolio artifact.

## License

The project currently uses the license declared in `package.json`.

Review the license before reuse or redistribution.
