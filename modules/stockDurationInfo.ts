import { SupplyDuration, StockDuration } from "../types";

const durations: SupplyDuration[] = [
  "1 Week",
  "2 Weeks",
  "3 Weeks",
  "1 Month",
  "2 Months",
  "3 Months",
  "4 Months",
  "6 Months",
];

const stockOptions: StockDuration[] = ["None", ...durations];

export {
    durations,
    stockOptions,
}

