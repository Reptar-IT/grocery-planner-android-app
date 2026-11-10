type Category = "Toiletry" | "Staple" | "Meat" | "Produce";
type SupplyDuration =
  | "1 Week"
  | "2 Weeks"
  | "3 Weeks"
  | "1 Month"
  | "2 Months"
  | "3 Months"
  | "4 Months"
  | "6 Months";
type StockDuration = "None" | SupplyDuration;
type Item = {
  id: string;
  name: string;
  category: Category;
  price: number | null;
  purchaseQty: number;
  mandatory: boolean;
  supplyDuration: SupplyDuration;
  stockDuration: StockDuration;
  stockQty: number;
  /** Last time the user checked stock or recorded a purchase. */
  stockUpdatedAt?: string;
};
type SeedRow = [
  name: string,
  category: Item["category"],
  price: number | null,
  purchaseQty: number,
  mandatory: boolean,
  supplyDuration: Item["supplyDuration"],
  stockDuration: Item["stockDuration"],
];
type PurchaseRecord = {
  id: string;
  itemId: string;
  itemName: string;
  date: string;
  quantity: number;
  unitPrice: number;
  total: number;
};
export {
  Item,
  PurchaseRecord,
  SeedRow,
  SupplyDuration,
  StockDuration,
  Category,
};
