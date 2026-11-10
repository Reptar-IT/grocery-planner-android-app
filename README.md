# Grocery Inventory & Shopping Planner (Expo)

Starter version 1: master inventory catalogue, editable prices and quantities, local persistence, shopping-list price overrides, purchase confirmation, and a monthly budget overview.

## Requirements
- Node.js LTS
- npm
- Expo Go compatible with the installed Expo SDK, or an Android/iOS simulator

## Run
```bash
npm install
npx expo start
```

Scan the QR code with Expo Go or launch a simulator.

## Current scope
- Loads the provided 56-item catalogue with original categories, purchase quantities, mandatory/optional flags, supply durations, and current stock durations.
- Missing prices stay blank and display “Price needed”.
- Inventory edits are stored locally using AsyncStorage.
- Shopping list supports temporary price edits and purchase checkboxes.
- Confirming selected purchases records the entered price as the item's current catalogue price and updates stock duration/quantity.

## Important next stage
The shopping-list selection in this starter is intentionally simple (out-of-stock items only). The next stage should implement date-based stock depletion, due-date calculation, rolling four-week spend tracking, and budget-aware prioritization. Do not treat this starter's subtotal as a completed monthly forecast yet.
