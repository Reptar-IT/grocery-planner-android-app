# Grocery Planner

**A local-first grocery inventory, shopping-list, and four-week budget planner for Android.**

Grocery Planner helps households keep track of everyday supplies, estimate when items will run out, prepare shopping lists, record purchases, and monitor spending against a configurable budget.

Built with Expo, React Native, and TypeScript, the app keeps its inventory, purchase history, and budget settings on the device. It includes a starter catalogue and supports JSON backup/restore and PDF shopping-list export.

## Features

### 1. Grocery inventory

Maintain a catalogue of household items with:
- Item name and category
- Current unit price (prices can remain blank until known)
- Planned purchase quantity
- Mandatory or optional classification
- Expected supply duration
- Current stock quantity and stock duration
- Last stock update timestamp

The starter catalogue contains 56 items. You can add, edit, search, filter, and remove inventory items.

Supported categories:
- Toiletry
- Staple
- Meat
- Produce

### 2. Stock-duration estimates

Life-cycle estimates help identify when household supplies may need replenishing.

For each item, the app uses:
- The recorded stock quantity
- The expected supply duration
- The planned purchase quantity
- The date the stock level was last updated

It estimates remaining stock based on elapsed time and expected weekly consumption. Items whose estimated stock reaches zero and have a planned purchase quantity are considered due for replenishment.

These are planning estimates, not measurements of physical stock. Update stock information when actual usage differs from the estimate.

### 3. Shopping list

The Shopping List screen brings together items identified as due for replenishment.

Current list behavior:
- Automatically identifies due items from the stock estimates.
- Prioritizes mandatory items.
- Includes mandatory due items in the active shopping list.
- Allows shopping quantities and prices to be adjusted before applying changes.
- Calculates line totals and a planned shopping total.
- Identifies items that still need prices.
- Shows the estimated effect of the planned shopping total on the remaining budget.

Shopping-list price and quantity changes are draft edits until they are confirmed. This helps prevent accidental changes to the working list.

**Current scope:** optional items are represented in the inventory catalogue, but the active shopping list currently filters for mandatory items. Budget-aware selection of optional items is not implemented.

### 4. Four-week budget planner

Track spending against a configurable budget using a rolling four-week cycle.

The initial budget is **JMD $30,000**. The budget can be changed in the app.

Budget features include:
- Four-week budget cycles.
- Four weekly periods within each cycle.
- Recorded purchase totals counted toward cycle spending.
- Remaining-budget calculation.
- Planned shopping total included when estimating remaining budget after the next shop.
- Manual adjustment of the recorded month-to-date spending figure.
- Editable cycle week and cycle starting point.
- Automatic advancement to the next four-week cycle.

The default currency display is Jamaican dollars (JMD). The app does not retrieve exchange rates or convert currencies.

> The budget period is a rolling 28-day / four-week cycle, not a calendar month. The budget is a planning aid and depends on accurate inventory, prices, and purchase records.

### 5. Purchase history

Purchase records contain:
- Item ID and item name
- Purchase date
- Quantity
- Unit price
- Total amount

Purchase history is stored locally and contributes to four-week spending calculations. Removing an inventory item does not remove its historical purchase records.

### 6. Shopping-list PDF

Generate and share a PDF version of the current shopping list.

The PDF includes item names, categories, mandatory/optional labels, quantities, prices where available, and calculated line totals. Items without a valid price are clearly marked as not priced.

### 7. JSON backup and restore

Export a versioned JSON backup containing:
- Inventory items
- Purchase history
- Budget amount
- Budget-cycle starting point
- Manual spending adjustment
- Export timestamp and format version

Restore a previously exported backup using the device document picker.

The importer checks the backup identifier, format version, inventory records, and purchase records before applying the restore.

**Warning:** Restoring a backup replaces the current inventory, purchase history, and included budget settings. Export a fresh backup before restoring if you need to preserve the current data.

### 8. Local data and reset

The application uses AsyncStorage to persist inventory, purchase history, and budget settings on the device.

The Settings area provides backup/restore and a reset option. Resetting restores the starter catalogue and clears purchase history and relevant planner settings.

There is no account system, cloud synchronization, or remote database in the current implementation.

## Screens

| Screen | Purpose |
|---|---|
| **Inventory** | Browse, search, filter, add, edit, and remove household items |
| **Shopping List** | Review due mandatory items, adjust quantities/prices, calculate the planned total, and export a PDF |
| **Budget** | Review and configure the four-week spending plan |

## Technology stack

| Technology | Purpose |
|---|---|
| Expo SDK 58 | Mobile application framework and tooling |
| React 19.3 | UI rendering |
| React Native 0.88 | Native mobile interface |
| TypeScript 6 | Type-safe application code |
| AsyncStorage 2.2 | Local inventory, history, and settings persistence |
| Expo Document Picker | Select backup files for restore |
| Expo File System | Read and write JSON backups |
| Expo Print | Generate shopping-list PDFs |
| Expo Sharing | Share PDF and JSON exports |
| React Native Safe Area Context | Safe-area layout |
| React Native View Shot | View capture support |
| Expo Development Client | Native development builds |

## Getting started

### Requirements

- Node.js LTS
- npm
- Android device or Android emulator
- Expo-compatible development environment

### Clone the repository

```bash
git clone https://github.com/Reptar-IT/grocery-planner-android-app.git
cd grocery-planner-android-app
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npx expo start
```

Then scan the QR code with a compatible Expo Go app or launch the application in an Android emulator.

For native development-client workflows, build and install the development client before opening the project.

### Run on Android

```bash
npm run android
```

This starts Expo with the Android target. It does not itself create a distributable APK.

### Run on iOS

```bash
npm run ios
```

### Run on web

```bash
npm run web
```

The project is designed primarily as a mobile application. Verify platform-specific behavior before treating the web target as a production deployment.

### Type-check

```bash
npm run typecheck
```

This runs TypeScript without emitting build files.

## Building Android APKs with EAS

The repository includes EAS Build profiles configured for Android APK output.

Use the EAS CLI:

```bash
npx eas-cli --version
```

Build an internal development APK:

```bash
npx eas-cli build --platform android --profile development
```

Build an internal preview APK:

```bash
npx eas-cli build --platform android --profile preview
```

Build a production APK:

```bash
npx eas-cli build --platform android --profile production
```

The EAS profiles specify APK output. A successful EAS build is required before an installable APK is available.

## How to use the app

### Set up your inventory

1. Open **Inventory**.
2. Review the starter catalogue.
3. Search for an item or filter by category.
4. Edit its price, planned purchase quantity, mandatory status, supply duration, and current stock.
5. Add any household items that are missing.

Leave unknown prices blank rather than entering an estimate as though it were a confirmed price.

### Review replenishment needs

1. Open **Shopping List**.
2. Review the mandatory items identified as due.
3. Adjust quantities or prices if needed.
4. Apply the edits to update the planned shopping calculation.
5. Review missing prices and the estimated budget impact.
6. Export a PDF if you need a printable or shareable list.

### Configure the budget

1. Open **Budget**.
2. Enter the budget amount.
3. Set the current week within the four-week cycle.
4. Enter a manual spending adjustment if purchases made outside the app need to be accounted for.
5. Save the settings.

Recorded purchase history and the manual adjustment are combined for the current cycle's spending figure.

### Back up your data

1. Open the app's Settings area.
2. Choose the export/backup action.
3. Share or save the generated JSON file somewhere safe.

To restore, select the corresponding import/restore action and choose a valid Grocery Planner backup file.

## Data model

### Inventory item

Each inventory item includes:

| Field | Description |
|---|---|
| `id` | Stable item identifier |
| `name` | Item name |
| `category` | Toiletry, Staple, Meat, or Produce |
| `price` | Current unit price, or `null` when unknown |
| `purchaseQty` | Planned purchase quantity |
| `mandatory` | Whether the item is mandatory |
| `supplyDuration` | Expected duration of a normal purchase |
| `stockDuration` | Recorded current-stock duration |
| `stockQty` | Recorded current stock quantity |
| `stockUpdatedAt` | Timestamp of the last stock update |

### Purchase record

Each purchase record includes:
- `id`
- `itemId`
- `itemName`
- `date`
- `quantity`
- `unitPrice`
- `total`

### Local storage keys

```text
@grocery_planner_items_v1
@grocery_planner_purchase_history_v1
@grocery_planner_settings_v1
```

### Backup format

The JSON backup uses format version `1` and includes the app identifier `Grocery Planner`, export timestamp, inventory, purchase history, and budget-cycle settings.

## Project structure

```text
grocery-planner-android-app/
├── assets/                       # App icons and visual assets
├── modules/
│   ├── seedItems.ts              # Starter grocery catalogue
│   └── stockDurationInfo.ts      # Supply and stock duration options
├── App.tsx                       # Main application screens and workflows
├── Commands.txt                  # Project command notes
├── app.json                      # Expo application configuration
├── eas.json                      # EAS Build profiles
├── package.json                  # Dependencies and scripts
├── package-lock.json
├── styles.ts                     # Application styles
├── types.ts                      # Inventory and purchase types
└── tsconfig.json                 # TypeScript configuration
```

## Privacy and data handling

- Inventory, budget settings, and purchase history are stored locally on the device.
- The app does not require a user account.
- The current implementation does not synchronize data to a cloud service.
- Exported backups and PDFs are shared only when the user invokes the device sharing workflow.

When a backup or PDF is shared with another app or service, that service's own privacy and data-handling practices apply.

## Current limitations and future opportunities

The current implementation is a local household planner, not a retailer integration or a full accounting system.

Potential future improvements include:
- Include optional items in shopping lists with budget-aware prioritization.
- More detailed spending reports and historical cycle comparisons.
- Configurable household members and shared inventories.
- Cloud backup and synchronization.
- More advanced stock adjustments for partial consumption, spoilage, and variable usage.
- Importing prices from receipts or supported retailer sources.

These are possible future directions, not claims about current functionality.

## Contributing

Bug reports, suggestions, and pull requests are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement and test your changes.
4. Run the TypeScript check:

   ```bash
   npm run typecheck
   ```

5. Test inventory editing, stock estimates, budget calculations, backup/restore, and PDF export on a device or emulator.
6. Submit a pull request with a clear description and test notes.

Changes to inventory or backup structures should preserve compatibility with existing local data and versioned backup files.

## License

No license file was confirmed during repository review. Unless a license is added to the repository, the source code should not be assumed to be open source or available for unrestricted reuse.

## Repository

[Reptar-IT/grocery-planner-android-app](https://github.com/Reptar-IT/grocery-planner-android-app)
