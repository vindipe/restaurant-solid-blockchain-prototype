# Restaurant Web-App: Solid Pods and Blockchain Payment Prototype

## Overview

This repository contains a legacy MSc thesis prototype implementing a restaurant ordering workflow with Solid Pods and blockchain-based payment verification.

The original prototype was built as a research/demo artifact, not as a production-ready restaurant application. The repository has now been partially modernized so that the core demo can run locally without requiring a working Solid Pod, MetaMask, or a live blockchain network.

The current local demo supports:

- table-based access
- restaurant menu rendering
- local order creation
- local inventory/runtime update
- pre-payment bill PDF generation
- mock payment completion
- final paid bill PDF generation
- downloadable bill PDF

The Solid Pod and blockchain integrations are preserved conceptually and structurally, but the default execution mode is now local/mock to make the repository easier to run, test, and understand.

## Project context

The original goal was to demonstrate how a restaurant workflow could combine decentralized data storage and blockchain-based payment verification.

At a high level, the intended full architecture is:

1. A customer opens a table-specific URL.
2. The app loads a restaurant menu.
3. The customer creates an order.
4. The order is stored as structured data.
5. The customer requests the bill.
6. The app generates a pre-payment PDF bill.
7. The customer pays.
8. The app verifies the payment.
9. The final paid bill is generated and made available for download.

The legacy version used Solid Pods for shared data storage and Ethereum/Web3 for payment verification. The modernized local mode simulates the same workflow using local runtime files and a mock payment step.

## Current status

The repository currently supports two conceptual modes.

### Local demo mode

This is the default and currently recommended mode.

It does not require:

- Solid Pod credentials
- MetaMask
- Infura
- Sepolia ETH
- deployed smart contracts

It uses:

- local fixture files from `utils/`
- generated runtime files under `utils/runtime/`
- mock payment completion through `PAYMENT_MODE=mock`

### Solid/blockchain mode

The original Solid and blockchain integration code is still present, but it requires additional modernization and reconfiguration before it should be considered usable.

Known legacy aspects include:

- old Solid Pod assumptions and hardcoded historical structure
- legacy refresh-token based Solid authentication
- old Kovan-oriented Ethereum flow
- old MetaMask/Web3 assumptions
- demo-style server state
- limited automated testing
- limited validation and error handling

## Repository structure

```text
.
|-- restaurant.js
|   Main Express server entry point.
|
|-- src/
|   |-- config.js
|   |   Centralized configuration loaded from environment variables.
|   |
|   |-- client-functions.js
|   |   Main business logic for menu loading, order creation, store update,
|   |   bill generation, payment handling, and local demo fallback.
|   |
|   |-- solid-lib-interface.js
|   |   Helper functions wrapping Solid client operations.
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
|       Fixture data, images, and legacy smart contract source.
|
|-- .env.example
|   Example environment configuration.
|
|-- .gitignore
|   Ignore rules for secrets, dependencies, generated files, and runtime data.
```

## Requirements

Recommended local setup:

```bash
node --version
npm --version
```

The current tested environment is:

```text
Node.js 18.x
npm 9.x
```

The project should also be compatible with newer Node/npm versions, but the legacy dependencies may require careful updates.

## Installation

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Never commit `.env`.

## Environment configuration

For the local demo, use:

```env
PORT=8080
BASE_URL=http://localhost:8080
TABLE_COUNT=4

USE_LOCAL_DATA_FALLBACK=true
SOLID_AUTH_ENABLED=false
PAYMENT_MODE=mock
```

These values mean:

- `USE_LOCAL_DATA_FALLBACK=true`: use local fixture/runtime files when Solid is unavailable.
- `SOLID_AUTH_ENABLED=false`: do not attempt Solid authentication.
- `PAYMENT_MODE=mock`: complete payment locally without MetaMask/blockchain.

The `.env.example` file also contains placeholders for Solid and Ethereum configuration, but they are not required for the local demo.

## Running the local demo

Start the server:

```bash
npm start
```

Open:

```text
http://localhost:8080/
```

Or directly open a table:

```text
http://localhost:8080/1
http://localhost:8080/2
http://localhost:8080/3
http://localhost:8080/4
```

## Local demo flow

Use this flow to test the project:

1. Open `http://localhost:8080/1`.
2. Select one or more products.
3. Open the cart.
4. Click `Order`.
5. Return to the table page if needed.
6. Click `Get Bill`.
7. Click `Complete Mock Payment`.
8. Download the final paid bill PDF.
9. Click `Back to Table`.

Expected terminal output includes messages similar to:

```text
Local demo mode enabled. Loading menu and order from local runtime files.
Local order saved: ./utils/runtime/activeorder/order-table-1.json
Local store updated: ./utils/runtime/store.json
Local pre-bill PDF generated: ./utils/runtime/billing/to-pay/<hash>.pdf
Mock payment executed.
Local paid bill PDF generated: ./utils/runtime/billing/payed/<hash>.pdf
```

## Cleaning local runtime data

The local demo creates runtime files under:

```text
utils/runtime/
```

These files are generated and should not be committed.

To clean the local demo state:

```bash
npm run clean:runtime
```

Then restart the app:

```bash
npm start
```

## Generated files

The following files/directories are generated at runtime and ignored by Git:

```text
utils/runtime/
utils/temp.pdf
utils/temp.json
utils/img/QR-tables/*.png
```

The repository keeps only:

```text
utils/img/QR-tables/.gitkeep
```

so that the QR table directory exists without tracking generated QR images.

## Available npm scripts

```bash
npm start
```

Start the Express server.

```bash
npm run dev
```

Start the server with Nodemon.

```bash
npm run init:pods
```

Run the legacy Solid Pod initialization flow.

Warning: this flow still requires review and valid Solid credentials before use.

```bash
npm run clean:runtime
```

Delete generated local demo runtime files.

```bash
npm test
```

Placeholder test command.

## Solid Pod integration

The original project was designed around Solid Pods. The current local demo does not require Solid.

Solid-related environment variables include:

```env
SOLID_ROOT_CONTEXT=
SOLID_TEST_NUMBER=
ADMIN_POD_BASE_URL=

ADMIN_SOLID_PROVIDER=
ADMIN_SOLID_REFRESH_TOKEN=
ADMIN_SOLID_CLIENT_ID=
ADMIN_SOLID_CLIENT_SECRET=

RESTAURANT_SOLID_PROVIDER=
RESTAURANT_SOLID_REFRESH_TOKEN=
RESTAURANT_SOLID_CLIENT_ID=
RESTAURANT_SOLID_CLIENT_SECRET=

RESTAURANT_INRUPT_WEB_ID=
RESTAURANT_WEB_ID=
CEO_WEB_ID=
AUTHORITY_WEB_ID=
ERP_WEB_ID=
ADMIN_WEB_ID=
```

To re-enable Solid authentication in the future:

```env
SOLID_AUTH_ENABLED=true
```

However, the Solid flow should be reviewed before use. In particular:

- verify the target Pod URL
- verify container creation logic
- verify access-control policies
- verify refresh-token credentials
- avoid pointing initialization to data that should not be deleted or overwritten

### Legacy Pod note

The original repository referenced an old Inrupt Pod path used during the MSc thesis prototype. That historical Pod configuration is no longer assumed to be valid.

If `npm run solid:probe` returns `text/html` responses redirected to an Inrupt profile or landing page, the app is not receiving the expected Solid resources. In that case, create a fresh test Pod context and update `.env` with the new Pod base URL and WebIDs.

## Payment modes

The current recommended payment mode is:

```env
PAYMENT_MODE=mock
```

This completes the payment flow locally and generates a final paid bill PDF.

A future blockchain mode can be configured through:

```env
PAYMENT_MODE=blockchain
ETH_NETWORK=sepolia
ETH_RPC_URL=
SMART_CONTRACT_ADDRESS=
RESTAURANT_WALLET_ADDRESS=
ETH_CHF_RATE=3919
```

The blockchain mode still requires additional modernization before it should be treated as functional.

## Security and publication checklist

Before publishing or pushing the repository, verify that:

- `.env` is not tracked
- no refresh tokens are committed
- no client secrets are committed
- no Infura/RPC project IDs are hardcoded
- no private Solid Pod URLs are exposed unless intentionally public
- no private wallet keys are included
- generated PDFs are ignored
- generated QR images are ignored
- runtime JSON files are ignored
- Dropbox metadata files are removed
- Windows `Zone.Identifier` files are removed
- the local demo still runs from a clean checkout

Useful checks:

```bash
git check-ignore -v .env
```

```bash
git ls-files | grep -E '(^\.env$|utils/runtime|utils/temp|QR-tables/.*\.png|dropbox|Zone.Identifier)'
```

```bash
grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=utils/runtime --exclude=package-lock.json \
  "kovan.infura\|396DC917\|09025260fc864cd09d057f68852e45ea\|Administrator0\|Ristorante1\|Authority2" .
```

The first command should confirm that `.env` is ignored. The second and third commands should ideally produce no output.

## Known limitations

This project remains a legacy prototype.

Current limitations include:

- demo-style server state
- no database
- no automated test suite
- limited server-side validation
- local runtime files are not suitable for production persistence
- mock payment does not represent a real blockchain transaction
- Solid initialization still needs review
- blockchain payment mode still needs modernization
- the order hash is a simple legacy JavaScript hash and should not be considered strong cryptographic protection

## Recommended modernization roadmap

### Completed in the current modernization pass

- added README documentation
- added `.env.example`
- added centralized `src/config.js`
- moved configuration toward environment variables
- added local demo fallback
- added mock payment mode
- added local runtime storage
- generated local pre-payment and paid bill PDFs
- removed tracked temporary PDF/JSON files
- removed tracked generated QR images
- added `.gitignore` rules for runtime/generated files
- added `.gitattributes`
- removed legacy Kovan/contract hardcoding from active payment verification path

### Next recommended steps

1. Improve README and inline code comments further.
2. Add a clean local testing checklist.
3. Refactor global server state into table-scoped state.
4. Add basic automated tests for local order and bill generation.
5. Rebuild the Solid Pod initialization flow safely.
6. Add a documented Solid demo mode.
7. Add a local Hardhat blockchain mode.
8. Replace the legacy JavaScript hash with a SHA-256 based identifier.
9. Separate frontend JavaScript from EJS templates.
10. Improve UI and error messages.

## Academic context

This repository is preserved as a legacy MSc thesis prototype exploring decentralized data storage and blockchain-based payment verification in a restaurant workflow.

Add thesis title, institution, year, and author information here before publication if desired.

## License

This repository currently uses the license declared in `package.json`.

Review and confirm the intended license before publication.
