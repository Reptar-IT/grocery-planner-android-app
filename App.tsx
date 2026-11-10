import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { styles } from "./styles";
import {
  Item,
  SupplyDuration,
  StockDuration,
  Category,
  PurchaseRecord,
} from "./types";

import { seedItems } from "./modules/seedItems";
import { stockOptions, durations } from "./modules/stockDurationInfo";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Print from "expo-print";
import { Feather } from "@expo/vector-icons";

const STORAGE_KEY = "@grocery_planner_items_v1";
const HISTORY_KEY = "@grocery_planner_purchase_history_v1";
const SETTINGS_KEY = "@grocery_planner_settings_v1";
const DEFAULT_MONTHLY_BUDGET = 30000;
const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function dateStamp(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const durationWeeks: Record<SupplyDuration, number> = {
  "1 Week": 1,
  "2 Weeks": 2,
  "3 Weeks": 3,
  "1 Month": 4,
  "2 Months": 8,
  "3 Months": 13,
  "4 Months": 17,
  "6 Months": 26,
};

function estimateStock(item: Item, now = Date.now()): number {
  const startingQty = Math.max(0, Number(item.stockQty) || 0);
  if (startingQty <= 0 || item.stockDuration === "None") return 0;

  const lastChecked = item.stockUpdatedAt
    ? Date.parse(item.stockUpdatedAt)
    : now;
  const elapsedWeeks =
    Math.max(0, now - (Number.isFinite(lastChecked) ? lastChecked : now)) /
    (7 * 24 * 60 * 60 * 1000);
  const weeklyUse = item.purchaseQty / durationWeeks[item.supplyDuration];
  return Math.max(0, startingQty - elapsedWeeks * weeklyUse);
}

function estimatedWeeksLeft(item: Item, now = Date.now()): number {
  const weeklyUse = item.purchaseQty / durationWeeks[item.supplyDuration];
  return weeklyUse > 0 ? estimateStock(item, now) / weeklyUse : 0;
}

const money = (value: number) =>
  `JMD $${value.toLocaleString("en-JM", { maximumFractionDigits: 2 })}`;

export default function App() {
  const [items, setItems] = useState<Item[]>(seedItems);
  const [loaded, setLoaded] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState(DEFAULT_MONTHLY_BUDGET);
  const [budgetInput, setBudgetInput] = useState(
    String(DEFAULT_MONTHLY_BUDGET),
  );
  // A manual adjustment lets the user set month-to-date spending without
  // altering the individual purchase-history records.
  const [monthlySpendAdjustment, setMonthlySpendAdjustment] = useState(0);
  const [spendInput, setSpendInput] = useState("0");
  const [weekInput, setWeekInput] = useState("1");
  const [cycleAnchor, setCycleAnchor] = useState(new Date().toISOString());
  const [actualQuantities, setActualQuantities] = useState<
    Record<string, string>
  >({});
  const [screen, setScreen] = useState<
    "Inventory" | "Shopping List" | "Budget"
  >("Inventory");
  const [category, setCategory] = useState<"All" | Category>("All");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    category: "Staple" as Category,
    price: "",
    purchaseQty: "1",
    mandatory: true,
    supplyDuration: "1 Month" as SupplyDuration,
    stockDuration: "None" as StockDuration,
    stockQty: "0",
  });

  const [isNewItem, setIsNewItem] = useState(false);
  const [bought, setBought] = useState<string[]>([]);
  const [actualPrices, setActualPrices] = useState<Record<string, string>>({});
  // Shopping-list edits stay in draft state until the user confirms applying them.
  const [draftActualQuantities, setDraftActualQuantities] = useState<
    Record<string, string>
  >({});
  const [draftActualPrices, setDraftActualPrices] = useState<
    Record<string, string>
  >({});
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const now = new Date().toISOString();
        if (saved) {
          const parsed = JSON.parse(saved) as Item[];
          setItems(
            parsed.map((item) => ({
              ...item,
              stockUpdatedAt: item.stockUpdatedAt ?? now,
            })),
          );
        } else {
          setItems(seedItems.map((item) => ({ ...item, stockUpdatedAt: now })));
        }
        const savedHistory = await AsyncStorage.getItem(HISTORY_KEY);
        if (savedHistory)
          setPurchaseHistory(JSON.parse(savedHistory) as PurchaseRecord[]);
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
          const settings = JSON.parse(savedSettings) as {
            monthlyBudget?: number;
            cycleAnchor?: string;
            monthlySpendAdjustment?: number;
          };
          if (
            typeof settings.monthlyBudget === "number" &&
            Number.isFinite(settings.monthlyBudget) &&
            settings.monthlyBudget > 0
          ) {
            setMonthlyBudget(settings.monthlyBudget);
            setBudgetInput(String(settings.monthlyBudget));
          }
          if (
            typeof settings.cycleAnchor === "string" &&
            Number.isFinite(Date.parse(settings.cycleAnchor))
          ) {
            setCycleAnchor(settings.cycleAnchor);
          }
          if (
            typeof settings.monthlySpendAdjustment === "number" &&
            Number.isFinite(settings.monthlySpendAdjustment)
          ) {
            setMonthlySpendAdjustment(settings.monthlySpendAdjustment);
          }
        }
      } catch {
        Alert.alert(
          "Storage issue",
          "Saved inventory could not be loaded. The starter catalogue is shown.",
        );
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded)
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() =>
        Alert.alert(
          "Save issue",
          "Your changes could not be saved on this device.",
        ),
      );
  }, [items, loaded]);

  useEffect(() => {
    if (loaded)
      AsyncStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ monthlyBudget, cycleAnchor, monthlySpendAdjustment }),
      ).catch(() =>
        Alert.alert(
          "Save issue",
          "Your budget settings could not be saved on this device.",
        ),
      );
  }, [monthlyBudget, cycleAnchor, monthlySpendAdjustment, loaded]);

  useEffect(() => {
    if (loaded)
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(purchaseHistory)).catch(
        () =>
          Alert.alert(
            "Save issue",
            "Purchase history could not be saved on this device.",
          ),
      );
  }, [purchaseHistory, loaded]);

  function resetAppData() {
    Alert.alert(
      "Reset to factory settings?",
      "This will replace your current inventory with the original starter catalogue and erase all purchase history on this device. This cannot be undone, so export a backup first if you want to keep your data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset planner",
          style: "destructive",
          onPress: () => {
            const resetAt = new Date().toISOString();
            setItems(
              seedItems.map((item) => ({ ...item, stockUpdatedAt: resetAt })),
            );
            setPurchaseHistory([]);
            setCycleAnchor(resetAt);
            setMonthlySpendAdjustment(0);
            setBought([]);
            setActualPrices({});
            setActualQuantities({});
            setDraftActualPrices({});
            setDraftActualQuantities({});
            setCategory("All");
            setSearch("");
            setEditing(null);
            setIsNewItem(false);
            setScreen("Inventory");
            Alert.alert(
              "Planner reset",
              "The starter catalogue has been restored and purchase history cleared.",
            );
          },
        },
      ],
    );
  }

  async function exportPlanner() {
    try {
      const backup = {
        app: "Grocery Planner",
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        monthlyBudget,
        cycleAnchor,
        monthlySpendAdjustment,
        items,
        purchaseHistory,
      };

      const uri = `${FileSystem.cacheDirectory}grocery-planner-backup.json`;

      await FileSystem.writeAsStringAsync(
        uri,
        JSON.stringify(backup, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 },
      );

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing unavailable",
          "Your device cannot open the sharing menu.",
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Export Grocery Planner",
        UTI: "public.json",
      });
    } catch (error) {
      Alert.alert("Export failed", "Could not export your planner.");
      console.error("Planner export failed:", error);
    }
  }

  async function shareShoppingListPDF() {
    try {
      const escapeHtml = (value: string) =>
        value.replace(/[&<>"']/g, (character) => {
          const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          };
          return entities[character];
        });

      const rows = shoppingItems
        .map((item) => {
          const rawPrice = actualPrices[item.id];
          const price = rawPrice !== undefined ? Number(rawPrice) : item.price;

          const validPrice =
            price !== null && Number.isFinite(price) && price >= 0;

          const quantityText =
            actualQuantities[item.id] ?? String(item.purchaseQty);
          const quantity = Number(quantityText);
          const validQuantity = Number.isFinite(quantity) && quantity > 0;
          const lineTotal =
            validPrice && validQuantity ? price * quantity : null;

          return `
          <tr>
            <td class="check">☐</td>
            <td>
              ${escapeHtml(item.name)}
              <div class="meta">
                ${escapeHtml(item.category)} ·
                ${item.mandatory ? "Mandatory" : "Optional"}
              </div>
            </td>
            <td class="number">${validQuantity ? quantity : item.purchaseQty}</td>
            <td class="number">${validPrice ? money(price) : "Not priced"}</td>
            <td class="number">${lineTotal === null ? "—" : money(lineTotal)}</td>
          </tr>`;
        })
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #203c2e;
            }
            h1 { color: #176b4d; margin-bottom: 4px; }
            .subtitle { color: #718078; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td {
              padding: 10px 5px;
              border-bottom: 1px solid #dce5de;
              text-align: left;
              font-size: 11px;
            }
            th { background: #e4f0e8; }
            .check { width: 20px; font-size: 18px; }
            .number { text-align: right; white-space: nowrap; }
            .meta { color: #718078; font-size: 9px; margin-top: 4px; }
            .total { margin-top: 20px; font-size: 18px; font-weight: bold; }
            .note { color: #718078; font-size: 10px; margin-top: 12px; }
          </style>
        </head>
        <body>
          <h1>Grocery Shopping List</h1>
          <div class="subtitle">
            Prepared ${new Date().toLocaleDateString()} ·
            ${shoppingItems.length} items
          </div>
          <table>
            <thead>
              <tr>
                <th>Done</th>
                <th>Item</th>
                <th class="number">Qty</th>
                <th class="number">Unit price</th>
                <th class="number">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">Priced subtotal: ${money(plannedTotal)}</div>
          <div class="note">
            Unpriced items are excluded from the subtotal.
            Check off items as you shop.
          </div>
        </body>
        </html>`;

      const { uri: generatedUri } = await Print.printToFileAsync({ html });
      const filename = `supermarket_list_week_${ordinal(currentWeekNumber)}_${dateStamp(new Date())}.pdf`;
      const uri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${filename}`;
      await FileSystem.copyAsync({ from: generatedUri, to: uri });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing unavailable",
          "Your device cannot open the sharing menu.",
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: filename,
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      Alert.alert("Sharing failed", "Could not create the shopping-list PDF.");
      console.error("Shopping list export failed:", error);
    }
  }

  async function importPlanner() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // Android file providers may not identify WhatsApp backups as JSON.
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      let raw: string;

      try {
        // Prefer Expo's file-system reader. Some Android document providers
        // return a content:// URI that this reader cannot open directly.
        try {
          raw = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        } catch (fileSystemError) {
          console.warn(
            "FileSystem could not read backup URI; trying fetch fallback.",
            fileSystemError,
          );
          const response = await fetch(file.uri);
          if (!response.ok) {
            throw new Error(
              `Backup read failed with status ${response.status}`,
            );
          }
          raw = await response.text();
        }
      } catch (error) {
        console.error("Planner backup file read failed:", {
          name: file.name,
          mimeType: file.mimeType,
          uri: file.uri,
          error,
        });
        Alert.alert(
          "Could not read backup",
          `Android did not provide readable contents for "${file.name}". In Files, open Downloads, locate the original .json backup, and select it there. If it still fails, the file provider may not be sharing the file contents with the app.`,
        );
        return;
      }

      // Remove a possible UTF-8 byte-order mark before parsing.
      raw = raw.replace(/^\uFEFF/, "").trim();

      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch (error) {
        console.error("Planner backup JSON parse failed:", {
          name: file.name,
          mimeType: file.mimeType,
          error,
        });
        Alert.alert(
          "Invalid backup file",
          `The selected file "${file.name}" is not readable JSON. Select the original Grocery Planner .json backup, not a preview, message, or renamed file.`,
        );
        return;
      }

      if (
        !data ||
        typeof data !== "object" ||
        !("formatVersion" in data) ||
        !("items" in data) ||
        !("purchaseHistory" in data)
      ) {
        Alert.alert(
          "Invalid backup",
          "This file is not a supported Grocery Planner backup.",
        );
        return;
      }

      const backup = data as {
        app?: unknown;
        formatVersion: unknown;
        items: unknown;
        purchaseHistory: unknown;
        monthlyBudget?: unknown;
        cycleAnchor?: unknown;
        monthlySpendAdjustment?: unknown;
      };

      if (
        backup.app !== "Grocery Planner" ||
        backup.formatVersion !== 1 ||
        !Array.isArray(backup.items) ||
        !Array.isArray(backup.purchaseHistory)
      ) {
        Alert.alert(
          "Invalid backup",
          "The file format or version is not supported.",
        );
        return;
      }

      const validItems = backup.items.every((item: unknown) => {
        if (!item || typeof item !== "object") return false;
        const value = item as Record<string, unknown>;

        return (
          typeof value.id === "string" &&
          typeof value.name === "string" &&
          ["Toiletry", "Staple", "Meat", "Produce"].includes(
            String(value.category),
          ) &&
          (value.price === null ||
            (typeof value.price === "number" &&
              Number.isFinite(value.price) &&
              value.price >= 0)) &&
          typeof value.purchaseQty === "number" &&
          Number.isFinite(value.purchaseQty) &&
          value.purchaseQty >= 0 &&
          typeof value.mandatory === "boolean" &&
          typeof value.supplyDuration === "string" &&
          typeof value.stockDuration === "string" &&
          typeof value.stockQty === "number" &&
          Number.isFinite(value.stockQty) &&
          value.stockQty >= 0
        );
      });

      const validHistory = backup.purchaseHistory.every((record: unknown) => {
        if (!record || typeof record !== "object") return false;
        const value = record as Record<string, unknown>;

        return (
          typeof value.id === "string" &&
          typeof value.itemId === "string" &&
          typeof value.itemName === "string" &&
          typeof value.date === "string" &&
          typeof value.quantity === "number" &&
          typeof value.unitPrice === "number" &&
          typeof value.total === "number" &&
          Number.isFinite(value.quantity) &&
          Number.isFinite(value.unitPrice) &&
          Number.isFinite(value.total) &&
          value.quantity >= 0 &&
          value.unitPrice >= 0 &&
          value.total >= 0
        );
      });

      if (!validItems || !validHistory) {
        Alert.alert(
          "Invalid backup",
          "Some inventory or purchase history entries are invalid. Your existing data has not been changed.",
        );
        return;
      }

      Alert.alert(
        "Replace current planner?",
        `This backup contains ${backup.items.length} inventory items and ${backup.purchaseHistory.length} purchase records. Your current inventory and history will be replaced.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace data",
            style: "destructive",
            onPress: () => {
              const importedAt = new Date().toISOString();
              setItems(
                (backup.items as Item[]).map((item) => ({
                  ...item,
                  stockUpdatedAt: item.stockUpdatedAt ?? importedAt,
                })),
              );
              setPurchaseHistory(backup.purchaseHistory as PurchaseRecord[]);
              if (
                typeof backup.monthlyBudget === "number" &&
                Number.isFinite(backup.monthlyBudget) &&
                backup.monthlyBudget > 0
              ) {
                setMonthlyBudget(backup.monthlyBudget);
                setBudgetInput(String(backup.monthlyBudget));
              }
              if (
                typeof backup.cycleAnchor === "string" &&
                Number.isFinite(Date.parse(backup.cycleAnchor))
              )
                setCycleAnchor(backup.cycleAnchor);
              if (
                typeof backup.monthlySpendAdjustment === "number" &&
                Number.isFinite(backup.monthlySpendAdjustment)
              )
                setMonthlySpendAdjustment(backup.monthlySpendAdjustment);
              else setMonthlySpendAdjustment(0);
              setBought([]);
              setActualPrices({});
              setActualQuantities({});
              setDraftActualPrices({});
              setDraftActualQuantities({});
              setCategory("All");
              setSearch("");
              setScreen("Inventory");

              Alert.alert("Import complete", "The planner has been loaded.");
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Import failed",
        "The backup could not be imported. Your current inventory and purchase history have not been changed.",
      );
      console.error("Planner import failed:", error);
    }
  }

  const baseCycleTime = Date.parse(cycleAnchor);
  const cycleIndex =
    Number.isFinite(baseCycleTime) && clockNow >= baseCycleTime
      ? Math.floor((clockNow - baseCycleTime) / FOUR_WEEKS_MS)
      : 0;
  const currentCycleStart = new Date(
    (Number.isFinite(baseCycleTime) ? baseCycleTime : clockNow) +
      cycleIndex * FOUR_WEEKS_MS,
  );
  const daysIntoCycle = Math.max(
    0,
    Math.floor(
      (clockNow - currentCycleStart.getTime()) / (24 * 60 * 60 * 1000),
    ),
  );
  const currentWeekNumber = Math.min(4, Math.floor(daysIntoCycle / 7) + 1);
  const currentWeekStart = new Date(
    currentCycleStart.getTime() + (currentWeekNumber - 1) * WEEK_MS,
  );
  const currentCycleSpend = purchaseHistory.reduce((sum, record) => {
    const time = Date.parse(record.date);
    return Number.isFinite(time) &&
      time >= currentCycleStart.getTime() &&
      time <= clockNow
      ? sum + record.total
      : sum;
  }, 0);
  const adjustedCycleSpend = Math.max(
    0,
    currentCycleSpend + monthlySpendAdjustment,
  );
  const cycleRemainder = monthlyBudget - adjustedCycleSpend;

  useEffect(() => {
    if (
      !loaded ||
      !Number.isFinite(baseCycleTime) ||
      clockNow < baseCycleTime + FOUR_WEEKS_MS
    )
      return;
    const nextAnchor = currentCycleStart.toISOString();
    if (nextAnchor !== cycleAnchor) setCycleAnchor(nextAnchor);
  }, [loaded, clockNow, baseCycleTime, currentCycleStart, cycleAnchor]);

  useEffect(() => {
    setSpendInput(String(adjustedCycleSpend));
    setWeekInput(String(currentWeekNumber));
  }, [adjustedCycleSpend, currentWeekNumber]);

  function saveBudgetSettings() {
    const budgetValue = Number(budgetInput.trim());
    const weekValue = Number(weekInput.trim());
    const spendValue = Number(spendInput.trim());

    if (
      !budgetInput.trim() ||
      !Number.isFinite(budgetValue) ||
      budgetValue <= 0
    ) {
      Alert.alert(
        "Invalid budget",
        "Enter a monthly budget greater than zero.",
      );
      return;
    }
    if (!Number.isInteger(weekValue) || weekValue < 1 || weekValue > 4) {
      Alert.alert("Invalid week", "Choose a week from 1 to 4.");
      return;
    }
    if (!spendInput.trim() || !Number.isFinite(spendValue) || spendValue < 0) {
      Alert.alert(
        "Invalid spending amount",
        "Enter an amount of zero or more.",
      );
      return;
    }

    setMonthlyBudget(budgetValue);
    setBudgetInput(String(budgetValue));
    setMonthlySpendAdjustment(spendValue - currentCycleSpend);
    setSpendInput(String(spendValue));

    const now = new Date(clockNow);
    now.setDate(now.getDate() - (weekValue - 1) * 7);
    setCycleAnchor(now.toISOString());
    Alert.alert(
      "Budget settings saved",
      "Your budget, current week, and monthly spending have been updated.",
    );
  }

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "All" || item.category === category) &&
          item.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [items, category, search],
  );

  const neededItems = useMemo(() => {
    return items
      .filter(
        (item) => item.purchaseQty > 0 && estimateStock(item, clockNow) <= 0,
      )
      .map((item) => ({ ...item, purchaseQty: Math.ceil(item.purchaseQty) }))
      .sort((a, b) => Number(b.mandatory) - Number(a.mandatory));
  }, [items, clockNow]);

  // Mandatory items stay on the list; the monthly budget is the only spending allowance.
  const shoppingItems = useMemo(
    () => neededItems.filter((item) => item.mandatory),
    [neededItems],
  );
  const plannedTotal = shoppingItems.reduce((sum, item) => {
    const raw = actualPrices[item.id];
    const price =
      raw !== undefined ? (raw.trim() === "" ? null : Number(raw)) : item.price;
    const quantity = Number(actualQuantities[item.id] ?? item.purchaseQty);
    return (
      sum +
      (price !== null &&
      Number.isFinite(price) &&
      price >= 0 &&
      Number.isFinite(quantity) &&
      quantity > 0
        ? price * quantity
        : 0)
    );
  }, 0);
  const missingPrices = shoppingItems.filter((item) => {
    const raw = actualPrices[item.id];
    const price =
      raw === undefined ? item.price : raw.trim() === "" ? null : Number(raw);
    return price === null || !Number.isFinite(price) || price < 0;
  }).length;
  const hasShoppingEdits = shoppingItems.some((item) => {
    const currentQty = actualQuantities[item.id] ?? String(item.purchaseQty);
    const draftQty = draftActualQuantities[item.id] ?? currentQty;
    const defaultPrice = item.price === null ? "" : String(item.price);
    const currentPrice = actualPrices[item.id] ?? defaultPrice;
    const draftPrice = draftActualPrices[item.id] ?? currentPrice;
    return draftQty !== currentQty || draftPrice !== currentPrice;
  });
  const remainingMonthlyBudget =
    monthlyBudget - adjustedCycleSpend - plannedTotal;

  function beginShoppingEdits() {
    setDraftActualQuantities({ ...actualQuantities });
    setDraftActualPrices({ ...actualPrices });
  }

  function cancelShoppingEdits() {
    setDraftActualQuantities({ ...actualQuantities });
    setDraftActualPrices({ ...actualPrices });
  }

  function confirmShoppingEdits() {
    const changed = shoppingItems.filter((item) => {
      const currentQty = actualQuantities[item.id] ?? String(item.purchaseQty);
      const nextQty =
        draftActualQuantities[item.id] ?? String(item.purchaseQty);
      const currentPrice =
        actualPrices[item.id] ??
        (item.price === null ? "" : String(item.price));
      const nextPrice =
        draftActualPrices[item.id] ??
        (item.price === null ? "" : String(item.price));
      return currentQty !== nextQty || currentPrice !== nextPrice;
    });

    if (!changed.length) {
      Alert.alert("No changes", "There are no shopping-list changes to apply.");
      return;
    }

    const invalidQty = changed.filter((item) => {
      const qty = Number(
        draftActualQuantities[item.id] ?? String(item.purchaseQty),
      );
      return !Number.isFinite(qty) || qty <= 0;
    });
    if (invalidQty.length) {
      Alert.alert(
        "Check quantities",
        `Enter a quantity greater than zero for: ${invalidQty.map((item) => item.name).join(", ")}`,
      );
      return;
    }

    const invalidPrices = changed.filter((item) => {
      const raw =
        draftActualPrices[item.id] ??
        (item.price === null ? "" : String(item.price));
      return (
        raw.trim() !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0)
      );
    });
    if (invalidPrices.length) {
      Alert.alert(
        "Check prices",
        `Enter a valid price of zero or more for: ${invalidPrices.map((item) => item.name).join(", ")}`,
      );
      return;
    }

    Alert.alert(
      "Apply shopping-list changes?",
      `Apply the updated quantities and prices for ${changed.length} item(s)? These values will be used for the list total and purchase confirmation.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Apply changes",
          onPress: () => {
            const nextQuantities = { ...actualQuantities };
            const nextPrices = { ...actualPrices };
            for (const item of changed) {
              const quantity =
                draftActualQuantities[item.id] ?? String(item.purchaseQty);
              const price =
                draftActualPrices[item.id] ??
                (item.price === null ? "" : String(item.price));
              if (quantity === String(item.purchaseQty)) {
                delete nextQuantities[item.id];
              } else {
                nextQuantities[item.id] = quantity;
              }
              if (item.price !== null && price === String(item.price)) {
                delete nextPrices[item.id];
              } else {
                nextPrices[item.id] = price;
              }
            }
            setActualQuantities(nextQuantities);
            setActualPrices(nextPrices);
            setDraftActualQuantities(nextQuantities);
            setDraftActualPrices(nextPrices);
            Alert.alert(
              "Changes applied",
              "Shopping-list values were updated.",
            );
          },
        },
      ],
    );
  }

  function openNewItem() {
    setIsNewItem(true);

    setDraft({
      name: "",
      category: "Staple",
      price: "",
      purchaseQty: "1",
      mandatory: true,
      supplyDuration: "1 Month",
      stockDuration: "None",
      stockQty: "0",
    });

    setEditing({
      id: "__new__",
      name: "",
      category: "Staple",
      price: null,
      purchaseQty: 1,
      mandatory: true,
      supplyDuration: "1 Month",
      stockDuration: "None",
      stockQty: 0,
    });
  }

  function openEditor(item: Item) {
    setIsNewItem(false);
    setEditing(item);

    setDraft({
      name: item.name,
      category: item.category,
      price: item.price === null ? "" : String(item.price),
      purchaseQty: String(item.purchaseQty),
      mandatory: item.mandatory,
      supplyDuration: item.supplyDuration,
      stockDuration: item.stockDuration,
      stockQty: String(item.stockQty),
    });
  }

  function deleteEditingItem() {
    if (!editing || isNewItem) return;
    Alert.alert(
      "Remove inventory item?",
      `Remove “${editing.name}” from your inventory? Purchase history will be kept.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove item",
          style: "destructive",
          onPress: () => {
            setItems((old) => old.filter((item) => item.id !== editing.id));
            setBought((old) => old.filter((id) => id !== editing.id));
            setActualPrices((old) => {
              const next = { ...old };
              delete next[editing.id];
              return next;
            });
            setActualQuantities((old) => {
              const next = { ...old };
              delete next[editing.id];
              return next;
            });
            setDraftActualPrices((old) => {
              const next = { ...old };
              delete next[editing.id];
              return next;
            });
            setDraftActualQuantities((old) => {
              const next = { ...old };
              delete next[editing.id];
              return next;
            });
            setEditing(null);
            Alert.alert("Item removed", "The inventory item was removed.");
          },
        },
      ],
    );
  }

  function saveItem() {
    if (!editing) return;

    const name = draft.name.trim();
    const priceText = draft.price.trim();
    const qty = Number(draft.purchaseQty);
    const stockQty = Number(draft.stockQty);
    const price = priceText === "" ? null : Number(priceText);

    if (!name) {
      Alert.alert("Item name required", "Enter a name for this item.");
      return;
    }

    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      Alert.alert(
        "Check price",
        "Enter a valid price of 0 or more, or leave it blank.",
      );
      return;
    }

    if (
      !Number.isFinite(qty) ||
      qty < 0 ||
      !Number.isFinite(stockQty) ||
      stockQty < 0
    ) {
      Alert.alert("Check quantity", "Quantities must be zero or greater.");
      return;
    }

    const itemData = {
      name,
      category: draft.category,
      price,
      purchaseQty: qty,
      mandatory: draft.mandatory,
      supplyDuration: draft.supplyDuration,
      stockDuration: draft.stockDuration,
      stockQty: draft.stockDuration === "None" ? 0 : stockQty,
      stockUpdatedAt: new Date().toISOString(),
    };

    if (isNewItem) {
      const newItem: Item = {
        id: `item-${Date.now()}`,
        ...itemData,
      };

      setItems((old) => [...old, newItem]);
    } else {
      setItems((old) =>
        old.map((item) =>
          item.id === editing.id ? { ...item, ...itemData } : item,
        ),
      );
    }

    setEditing(null);
    setIsNewItem(false);
  }

  function confirmPurchases() {
    const chosen = shoppingItems.filter((item) => bought.includes(item.id));
    if (!chosen.length) {
      Alert.alert("Nothing selected", "Check the items you bought first.");
      return;
    }
    const unpriced = chosen.filter((item) => {
      const raw = actualPrices[item.id];
      return (
        (raw === undefined && item.price === null) ||
        (raw !== undefined &&
          (!raw.trim() || !Number.isFinite(Number(raw)) || Number(raw) < 0))
      );
    });
    if (unpriced.length) {
      Alert.alert(
        "Prices needed",
        `Enter a valid price for: ${unpriced.map((item) => item.name).join(", ")}`,
      );
      return;
    }
    const invalidQty = chosen.filter((item) => {
      const qty = Number(actualQuantities[item.id] ?? item.purchaseQty);
      return !Number.isFinite(qty) || qty <= 0;
    });
    if (invalidQty.length) {
      Alert.alert(
        "Check quantities",
        `Enter a quantity greater than zero for: ${invalidQty.map((item) => item.name).join(", ")}`,
      );
      return;
    }
    const cost = chosen.reduce(
      (sum, item) =>
        sum +
        Number(actualPrices[item.id] ?? item.price) *
          Number(actualQuantities[item.id] ?? item.purchaseQty),
      0,
    );
    Alert.alert(
      "Confirm purchases",
      `Record ${chosen.length} items costing ${money(cost)} and update inventory?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            const records = chosen.map((item) => {
              const unitPrice = Number(actualPrices[item.id] ?? item.price);
              const quantity = Number(
                actualQuantities[item.id] ?? item.purchaseQty,
              );
              return {
                id: `${Date.now()}-${item.id}`,
                itemId: item.id,
                itemName: item.name,
                date: new Date().toISOString(),
                quantity,
                unitPrice,
                total: unitPrice * quantity,
              };
            });
            setPurchaseHistory((old) => [...records, ...old].slice(0, 500));
            setItems((old) =>
              old.map((item) =>
                bought.includes(item.id)
                  ? {
                      ...item,
                      stockDuration: item.supplyDuration,
                      stockQty: Number(
                        actualQuantities[item.id] ?? item.purchaseQty,
                      ),
                      stockUpdatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            );
            setBought([]);
            setActualPrices({});
            setActualQuantities({});
            setDraftActualPrices({});
            setDraftActualQuantities({});
            Alert.alert(
              "Purchases recorded",
              "Inventory updated for the items checked off.",
            );
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>✓</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.appTitle}>Grocery Planner</Text>
          <Text style={styles.subtitle}>Inventory · shopping · budget</Text>
        </View>
        <View style={styles.budgetChip}>
          <Text style={styles.budgetChipText}>
            {money(monthlyBudget)} / 4 weeks
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(["Inventory", "Shopping List", "Budget"] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              if (tab === "Shopping List") beginShoppingEdits();
              setScreen(tab);
            }}
            style={[styles.tab, screen === tab && styles.activeTab]}
          >
            <Text
              style={[styles.tabText, screen === tab && styles.activeTabText]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {screen === "Inventory" && (
        <View style={[styles.content, { flex: 1 }]}>
          {/* Inventory heading and Add Item button */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.heading}>{items.length} inventory items</Text>
              <Text style={styles.muted}>
                Tap an item to update its price or stock.
              </Text>
            </View>

            <Pressable onPress={openNewItem} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Item</Text>
            </Pressable>
          </View>

          {/* Export and import on their own row */}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Pressable
              onPress={exportPlanner}
              accessibilityLabel="Export planner"
              hitSlop={8}
              style={{ padding: 7 }}
            >
              <Feather name="upload" size={19} color="#426b80" />
            </Pressable>

            <Pressable
              onPress={importPlanner}
              accessibilityLabel="Import planner"
              hitSlop={8}
              style={{ padding: 7 }}
            >
              <Feather name="download" size={19} color="#426b80" />
            </Pressable>

            <Pressable
              onPress={resetAppData}
              accessibilityLabel="Reset planner to factory settings"
              hitSlop={8}
              style={{ padding: 7 }}
            >
              <Feather name="rotate-ccw" size={19} color="#b04a45" />
            </Pressable>
          </View>

          {/* Search */}
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search inventory…"
            placeholderTextColor="#84918a"
            style={styles.search}
          />

          {/* Category filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filters}
            contentContainerStyle={{
              alignItems: "center",
              paddingVertical: 4,
            }}
          >
            {(["All", "Toiletry", "Staple", "Meat", "Produce"] as const).map(
              (value) => (
                <Pressable
                  key={value}
                  onPress={() => setCategory(value)}
                  style={[
                    styles.filter,
                    category === value && styles.filterActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      category === value && styles.filterTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                </Pressable>
              ),
            )}
          </ScrollView>

          {/* Inventory list uses the remaining screen height */}
          <FlatList
            style={{ flex: 1 }}
            data={visibleItems}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.itemCard}
                onPress={() => openEditor(item)}
              >
                <View style={styles.itemMain}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.category} · Buy qty {item.purchaseQty} ·{" "}
                      {item.mandatory ? "Mandatory" : "Optional"}
                    </Text>
                    <Text style={styles.itemMeta}>
                      Uses about{" "}
                      {(
                        item.purchaseQty / durationWeeks[item.supplyDuration]
                      ).toFixed(2)}{" "}
                      per week · Estimated stock:{" "}
                      {estimateStock(item, clockNow).toFixed(2)} ·{" "}
                      {estimatedWeeksLeft(item, clockNow).toFixed(1)} weeks left
                    </Text>
                  </View>

                  <View style={styles.itemRight}>
                    <Text
                      style={[
                        styles.itemPrice,
                        item.price === null && styles.priceMissing,
                      ]}
                    >
                      {item.price === null ? "Price needed" : money(item.price)}
                    </Text>
                    <Text style={styles.editHint}>Edit ›</Text>
                  </View>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No items match your search.</Text>
            }
          />
        </View>
      )}

      {screen === "Shopping List" && (
        <View style={styles.content}>
          <View style={styles.totalCard}>
            <Text style={styles.muted}>
              {ordinal(currentWeekNumber)} of 4 Weeks
            </Text>
            <Text style={styles.muted}>
              {money(cycleRemainder)} Remaining  -{" "}
              {money(adjustedCycleSpend)} spent
            </Text>
            <Text style={styles.total}>Total {money(plannedTotal)}</Text>

            {missingPrices > 0 && (
              <Text style={styles.warning}>
                {missingPrices} listed item(s) need prices before the total is
                complete.
              </Text>
            )}
            <Text style={styles.muted}>
              {shoppingItems.filter((item) => item.mandatory).length} mandatory
              · {shoppingItems.filter((item) => !item.mandatory).length}{" "}
              optional (unpriced excluded)
            </Text>
            
            <Pressable
              onPress={shareShoppingListPDF}
              accessibilityLabel="Share shopping list as PDF"
              hitSlop={8}
              style={{
                alignSelf: "flex-end",
              }}
            >
              <Feather name="share" size={19} color="#426b80" />
            </Pressable>
          </View>

          <FlatList
            data={shoppingItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 28 }}
            renderItem={({ item }) => (
              <View style={styles.shopCard}>
                <View style={styles.compactShopRow}>
                  <Pressable
                    style={styles.compactCheckboxRow}
                    onPress={() =>
                      setBought((old) =>
                        old.includes(item.id)
                          ? old.filter((id) => id !== item.id)
                          : [...old, item.id],
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: bought.includes(item.id) }}
                    accessibilityLabel={`Mark ${item.name} as purchased`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        bought.includes(item.id) && styles.checkboxChecked,
                      ]}
                    >
                      <Text style={styles.checkboxMark}>
                        {bought.includes(item.id) ? "✓" : ""}
                      </Text>
                    </View>
                  </Pressable>

                  <View style={styles.compactItemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {item.purchaseQty} ·{" "}
                      {item.mandatory ? "Required" : "Optional"}
                    </Text>
                  </View>

                  <TextInput
                    value={
                      draftActualQuantities[item.id] ??
                      actualQuantities[item.id] ??
                      String(item.purchaseQty)
                    }
                    onChangeText={(value) =>
                      setDraftActualQuantities((old) => ({
                        ...old,
                        [item.id]: value,
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="Bought"
                    placeholderTextColor="#84918a"
                    accessibilityLabel={`Actual quantity bought for ${item.name}; recommended quantity is ${item.purchaseQty}`}
                    style={{
                      width: 48,
                      borderWidth: 1,
                      borderColor: "#dce5de",
                      borderRadius: 8,
                      paddingHorizontal: 5,
                      paddingVertical: 8,
                      textAlign: "center",
                      color: "#203c2e",
                    }}
                  />
                  <TextInput
                    value={
                      draftActualPrices[item.id] ??
                      actualPrices[item.id] ??
                      (item.price === null ? "" : String(item.price))
                    }
                    onChangeText={(value) =>
                      setDraftActualPrices((old) => ({
                        ...old,
                        [item.id]: value,
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="Price"
                    placeholderTextColor="#84918a"
                    accessibilityLabel={`Price for ${item.name}`}
                    style={styles.compactPriceInput}
                  />

                  <Text style={styles.compactLineTotal}>
                    {(draftActualPrices[item.id] === undefined &&
                      actualPrices[item.id] === undefined &&
                      item.price === null) ||
                    (
                      draftActualPrices[item.id] ?? actualPrices[item.id]
                    )?.trim() === "" ||
                    !Number.isFinite(
                      Number(
                        draftActualPrices[item.id] ??
                          actualPrices[item.id] ??
                          item.price,
                      ),
                    ) ||
                    Number(
                      draftActualPrices[item.id] ??
                        actualPrices[item.id] ??
                        item.price,
                    ) < 0
                      ? "—"
                      : money(
                          Number(
                            draftActualPrices[item.id] ??
                              actualPrices[item.id] ??
                              item.price,
                          ) *
                            Number(
                              draftActualQuantities[item.id] ??
                                actualQuantities[item.id] ??
                                item.purchaseQty,
                            ),
                        )}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.empty}>
                  No items currently need replenishment within the weekly plan.
                </Text>
                <Text style={styles.muted}>
                  Stock estimates update over time. Check physical quantities in
                  Inventory before shopping.
                </Text>
              </View>
            }
          />
          {shoppingItems.length > 0 && (
            <>
              {hasShoppingEdits && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    style={[styles.cancelButton, { flex: 1 }]}
                    onPress={cancelShoppingEdits}
                  >
                    <Text style={styles.cancelButtonText}>Cancel edits</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButton, { flex: 1 }]}
                    onPress={confirmShoppingEdits}
                  >
                    <Text style={styles.primaryButtonText}>Apply changes</Text>
                  </Pressable>
                </View>
              )}
              <Pressable
                style={styles.primaryButton}
                onPress={confirmPurchases}
              >
                <Text style={styles.primaryButtonText}>
                  Confirm checked purchases
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {screen === "Budget" && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          <View style={styles.totalCard}>
            <Text style={styles.heading}>Four-week budget</Text>
            <Text style={styles.muted}>
              {ordinal(currentWeekNumber)} of 4 Weeks · Cycle started{" "}
              {currentCycleStart.toLocaleDateString()}
            </Text>
            <Text style={styles.total}>{money(monthlyBudget)}</Text>
          </View>
          <View style={{ gap: 8, marginTop: 10, marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>Monthly budget (JMD)</Text>
            <TextInput
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="decimal-pad"
              placeholder="Monthly budget"
              placeholderTextColor="#84918a"
              style={[
                styles.fieldInput,
                {
                  height: 40,
                  minHeight: 40,
                  paddingVertical: 6,
                  fontSize: 14,
                  marginBottom: 0,
                },
              ]}
            />
            <Text style={styles.fieldLabel}>Current week (1–4)</Text>
            <TextInput
              value={weekInput}
              onChangeText={setWeekInput}
              keyboardType="number-pad"
              placeholder="1 to 4"
              placeholderTextColor="#84918a"
              style={[
                styles.fieldInput,
                {
                  height: 40,
                  minHeight: 40,
                  paddingVertical: 6,
                  fontSize: 14,
                  marginBottom: 0,
                },
              ]}
            />
            <Text style={styles.fieldLabel}>Spend this month (JMD)</Text>
            <TextInput
              value={spendInput}
              onChangeText={setSpendInput}
              keyboardType="decimal-pad"
              placeholder="Amount spent"
              placeholderTextColor="#84918a"
              style={[
                styles.fieldInput,
                {
                  height: 40,
                  minHeight: 40,
                  paddingVertical: 6,
                  fontSize: 14,
                  marginBottom: 0,
                },
              ]}
            />
            <Pressable
              style={[
                styles.primaryButton,
                { paddingVertical: 10, marginTop: 2 },
              ]}
              onPress={saveBudgetSettings}
            >
              <Text style={styles.primaryButtonText}>Save settings</Text>
            </Pressable>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Spend this Month</Text>
            <Text style={styles.budgetValue}>{money(adjustedCycleSpend)}</Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Remaining this cycle</Text>
            <Text
              style={[styles.budgetValue, cycleRemainder < 0 && styles.warning]}
            >
              {money(cycleRemainder)}
            </Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Recorded purchase entries</Text>
            <Text style={styles.budgetValue}>{purchaseHistory.length}</Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Items with missing prices</Text>
            <Text style={styles.budgetValue}>
              {items.filter((item) => item.price === null).length}
            </Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Mandatory items</Text>
            <Text style={styles.budgetValue}>
              {items.filter((item) => item.mandatory).length}
            </Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Optional items</Text>
            <Text style={styles.budgetValue}>
              {items.filter((item) => !item.mandatory).length}
            </Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Items needing replenishment</Text>
            <Text style={styles.budgetValue}>{neededItems.length}</Text>
          </View>
          <Text style={styles.note}>
            Estimated use is based on the quantity bought divided by how long
            that purchase lasts. Check and correct stock in Inventory before
            shopping. Mandatory items are prioritized; optional items are added
            with prices included in the monthly budget estimate.
          </Text>
        </ScrollView>
      )}

      <Modal
        visible={editing !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {isNewItem ? "Add inventory item" : "Edit inventory item"}
                </Text>
                <Text style={styles.muted}>{editing?.name}</Text>
              </View>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Item name</Text>

              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft((old) => ({ ...old, name }))}
                placeholder="Enter item name"
                placeholderTextColor="#84918a"
                style={styles.fieldInput}
                maxLength={100}
              />

              <Text style={styles.fieldLabel}>Category</Text>

              <View style={styles.optionWrap}>
                {(["Toiletry", "Staple", "Meat", "Produce"] as Category[]).map(
                  (value) => (
                    <Pressable
                      key={value}
                      onPress={() =>
                        setDraft((old) => ({ ...old, category: value }))
                      }
                      style={[
                        styles.option,
                        draft.category === value && styles.optionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          draft.category === value && styles.optionTextActive,
                        ]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
              <Text style={styles.fieldLabel}>Regular price (JMD)</Text>
              <TextInput
                value={draft.price}
                onChangeText={(price) => setDraft((old) => ({ ...old, price }))}
                keyboardType="decimal-pad"
                placeholder="Enter price"
                placeholderTextColor="#84918a"
                style={styles.fieldInput}
              />
              <Text style={styles.fieldLabel}>Quantity to buy each time</Text>
              <TextInput
                value={draft.purchaseQty}
                onChangeText={(purchaseQty) =>
                  setDraft((old) => ({ ...old, purchaseQty }))
                }
                keyboardType="decimal-pad"
                style={styles.fieldInput}
              />
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Mandatory item</Text>
                <Switch
                  value={draft.mandatory}
                  onValueChange={(mandatory) =>
                    setDraft((old) => ({ ...old, mandatory }))
                  }
                />
              </View>
              <Text style={styles.fieldLabel}>How long a purchase lasts</Text>
              <View style={styles.optionWrap}>
                {durations.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() =>
                      setDraft((old) => ({ ...old, supplyDuration: value }))
                    }
                    style={[
                      styles.option,
                      draft.supplyDuration === value && styles.optionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        draft.supplyDuration === value &&
                          styles.optionTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Current supply remaining</Text>
              <View style={styles.optionWrap}>
                {stockOptions.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() =>
                      setDraft((old) => ({
                        ...old,
                        stockDuration: value,
                        stockQty:
                          value === "None"
                            ? "0"
                            : old.stockQty === "0"
                              ? "1"
                              : old.stockQty,
                      }))
                    }
                    style={[
                      styles.option,
                      draft.stockDuration === value && styles.optionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        draft.stockDuration === value &&
                          styles.optionTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>
                Quantity physically in stock (packages/units)
              </Text>
              <TextInput
                value={draft.stockQty}
                onChangeText={(stockQty) =>
                  setDraft((old) => ({ ...old, stockQty }))
                }
                keyboardType="decimal-pad"
                style={styles.fieldInput}
              />
              <Text style={styles.muted}>
                Saving this item resets its estimate from the quantity entered
                above. Choose “None” to mark it as out of stock.
              </Text>
              <Pressable style={styles.primaryButton} onPress={saveItem}>
                <Text style={styles.primaryButtonText}>Save item</Text>
              </Pressable>
              {!isNewItem && (
                <Pressable
                  style={[
                    styles.cancelButton,
                    { borderColor: "#b04a45", marginTop: 8 },
                  ]}
                  onPress={deleteEditingItem}
                >
                  <Text style={[styles.cancelButtonText, { color: "#b04a45" }]}>
                    Remove inventory item
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={styles.cancelButton}
                onPress={() => setEditing(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
