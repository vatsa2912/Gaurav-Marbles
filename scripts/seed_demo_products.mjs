/**
 * Gaurav Marbles - Demo Products Seeder
 *
 * This script inserts realistic demo/sample product entries into Firestore.
 * It adheres strictly to:
 * - Duplicate prevention (never overwrites or duplicates existing products)
 * - Exact schema of Add Product
 * - Supported Tile sizes (12x18, 2x4, 2x2, 16x16)
 * - Slabs vs Cut Size marble schema (no lot number on Cut Size)
 * - 6 pre-filled products with realistic stock and stock lots; all other products with stock = 0
 * - isDemo: true flag
 * - No fake sales, purchases, customers, or suppliers created
 *
 * Usage:
 *   node scripts/seed_demo_products.mjs --dry-run
 *   node scripts/seed_demo_products.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.resolve(__dirname, "..");

const isDryRun = process.argv.includes("--dry-run");

// Helper to convert JS object to Firestore REST API field schema
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function generateLotId() {
  return `lot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// 1. Define all demo products specification
const demoProducts = [
  // ==========================================
  // TILES (5 products per size × 4 sizes = 20)
  // ==========================================
  // Size: 12x18 (Pieces per box: 6)
  {
    name: "Somany 12x18 Glossy Wall",
    category: "Tiles",
    unit: "box",
    size: "12x18",
    piecesPerBox: 6,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Kajaria 12x18 Ceramic Wall",
    category: "Tiles",
    unit: "box",
    size: "12x18",
    piecesPerBox: 6,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Johnson 12x18 Kitchen Digital",
    category: "Tiles",
    unit: "box",
    size: "12x18",
    piecesPerBox: 6,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Orientbell 12x18 Bathroom Floral",
    category: "Tiles",
    unit: "box",
    size: "12x18",
    piecesPerBox: 6,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Classic 12x18 White Elevation",
    category: "Tiles",
    unit: "box",
    size: "12x18",
    piecesPerBox: 6,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // Size: 2x4 (Pieces per box: 2)
  // Pre-filled: Somany 2x4 White (Stock = 50 boxes, PP = 650, SP = 850)
  {
    name: "Somany 2x4 White",
    category: "Tiles",
    unit: "box",
    size: "2x4",
    piecesPerBox: 2,
    stock: 50,
    estimatedStock: 0,
    purchasePrice: 650,
    sellingPrice: 850,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [
      {
        lotId: generateLotId(),
        purchasePrice: 650,
        quantity: 50,
        originalQuantity: 50,
        remainingQuantity: 50,
        purchasedAt: "2026-09-01",
      },
    ],
  },
  {
    name: "Kajaria 2x4 Grey",
    category: "Tiles",
    unit: "box",
    size: "2x4",
    piecesPerBox: 2,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Johnson 2x4 Beige",
    category: "Tiles",
    unit: "box",
    size: "2x4",
    piecesPerBox: 2,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Orientbell 2x4 Ivory",
    category: "Tiles",
    unit: "box",
    size: "2x4",
    piecesPerBox: 2,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Classic 2x4 Black",
    category: "Tiles",
    unit: "box",
    size: "2x4",
    piecesPerBox: 2,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // Size: 2x2 (Pieces per box: 4)
  {
    name: "Somany 2x2 White",
    category: "Tiles",
    unit: "box",
    size: "2x2",
    piecesPerBox: 4,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Kajaria 2x2 Grey",
    category: "Tiles",
    unit: "box",
    size: "2x2",
    piecesPerBox: 4,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Johnson 2x2 Beige",
    category: "Tiles",
    unit: "box",
    size: "2x2",
    piecesPerBox: 4,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Orientbell 2x2 Ivory",
    category: "Tiles",
    unit: "box",
    size: "2x2",
    piecesPerBox: 4,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Classic 2x2 Black",
    category: "Tiles",
    unit: "box",
    size: "2x2",
    piecesPerBox: 4,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // Size: 16x16 (Pieces per box: 5)
  {
    name: "Somany 16x16 Terracotta Parking",
    category: "Tiles",
    unit: "box",
    size: "16x16",
    piecesPerBox: 5,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Kajaria 16x16 Rustic Floor",
    category: "Tiles",
    unit: "box",
    size: "16x16",
    piecesPerBox: 5,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Johnson 16x16 Heavy Duty",
    category: "Tiles",
    unit: "box",
    size: "16x16",
    piecesPerBox: 5,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Orientbell 16x16 Matt Grey",
    category: "Tiles",
    unit: "box",
    size: "16x16",
    piecesPerBox: 5,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Classic 16x16 Chequered",
    category: "Tiles",
    unit: "box",
    size: "16x16",
    piecesPerBox: 5,
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // MARBLE SLABS (5 products)
  // ==========================================
  // Pre-filled: Indian White Marble (Stock = 180 sqft, PP = 35, SP = 55, Est = 180)
  {
    name: "Indian White Marble",
    category: "Marble",
    marbleType: "Slabs",
    unit: "sqft",
    size: "",
    marbleQuantity: 180,
    marblePieces: 0,
    lotNumber: "",
    stock: 180,
    estimatedStock: 180,
    purchasePrice: 35,
    sellingPrice: 55,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [
      {
        lotId: generateLotId(),
        purchasePrice: 35,
        quantity: 180,
        originalQuantity: 180,
        remainingQuantity: 180,
        purchasedAt: "2026-09-01",
      },
    ],
  },
  {
    name: "Morwad White Marble",
    category: "Marble",
    marbleType: "Slabs",
    unit: "sqft",
    size: "",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Katni White Marble",
    category: "Marble",
    marbleType: "Slabs",
    unit: "sqft",
    size: "",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Makrana White Marble",
    category: "Marble",
    marbleType: "Slabs",
    unit: "sqft",
    size: "",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Fantasy Brown Marble",
    category: "Marble",
    marbleType: "Slabs",
    unit: "sqft",
    size: "",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // MARBLE CUT SIZE (5 products with 5 sizes)
  // ==========================================
  // Pre-filled: Marble Cut Size 2x2 (Stock = 100 sqft, PP = 40, SP = 65)
  {
    name: "Marble Cut Size 2x2",
    category: "Marble",
    marbleType: "Cut Size",
    unit: "sqft",
    size: "2x2",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 100,
    estimatedStock: 0,
    purchasePrice: 40,
    sellingPrice: 65,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [
      {
        lotId: generateLotId(),
        purchasePrice: 40,
        quantity: 100,
        originalQuantity: 100,
        remainingQuantity: 100,
        purchasedAt: "2026-09-01",
      },
    ],
  },
  {
    name: "Marble Cut Size 2x4",
    category: "Marble",
    marbleType: "Cut Size",
    unit: "sqft",
    size: "2x4",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Cut Size 3x6",
    category: "Marble",
    marbleType: "Cut Size",
    unit: "sqft",
    size: "3x6",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Cut Size 4x4",
    category: "Marble",
    marbleType: "Cut Size",
    unit: "sqft",
    size: "4x4",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Cut Size 4x8",
    category: "Marble",
    marbleType: "Cut Size",
    unit: "sqft",
    size: "4x8",
    marbleQuantity: 0,
    marblePieces: 0,
    lotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // GRANITE (7 products)
  // ==========================================
  // Pre-filled: Black Galaxy Granite (Stock = 200 sqft, PP = 80, SP = 120, Est = 200)
  {
    name: "Black Galaxy Granite",
    category: "Granite",
    unit: "sqft",
    graniteQuantity: 200,
    granitePieces: 0,
    graniteLotNumber: "",
    stock: 200,
    estimatedStock: 200,
    purchasePrice: 80,
    sellingPrice: 120,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [
      {
        lotId: generateLotId(),
        purchasePrice: 80,
        quantity: 200,
        originalQuantity: 200,
        remainingQuantity: 200,
        purchasedAt: "2026-09-01",
      },
    ],
  },
  {
    name: "Absolute Black Granite",
    category: "Granite",
    unit: "sqft",
    graniteQuantity: 0,
    granitePieces: 0,
    graniteLotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Steel Grey Granite",
    category: "Granite",
    unit: "sqft",
    graniteQuantity: 0,
    granitePieces: 0,
    graniteLotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tan Brown Granite",
    category: "Granite",
    unit: "sqft",
    graniteQuantity: 0,
    granitePieces: 0,
    graniteLotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "River White Granite",
    category: "Granite",
    unit: "sqft",
    graniteQuantity: 0,
    granitePieces: 0,
    graniteLotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Colonial White Granite",
    category: "Granite",
    unit: "sqft",
    graniteQuantity: 0,
    granitePieces: 0,
    graniteLotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Viscount White Granite",
    category: "Granite",
    unit: "sqft",
    graniteQuantity: 0,
    granitePieces: 0,
    graniteLotNumber: "",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // SANITARY (7 products)
  // ==========================================
  {
    name: "Close Coupled Western Toilet",
    category: "Sanitary",
    unit: "piece",
    model: "CC-101",
    material: "Ceramic",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Wall Hung Toilet",
    category: "Sanitary",
    unit: "piece",
    model: "WH-202",
    material: "Ceramic",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "One Piece Toilet",
    category: "Sanitary",
    unit: "piece",
    model: "OP-303",
    material: "Ceramic",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Two Piece Toilet",
    category: "Sanitary",
    unit: "piece",
    model: "TP-404",
    material: "Ceramic",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Floor Mounted Toilet",
    category: "Sanitary",
    unit: "piece",
    model: "FM-505",
    material: "Ceramic",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Sanitary Counter Top Basin",
    category: "Sanitary",
    unit: "piece",
    model: "CT-606",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Sanitary Wall Mounted Basin",
    category: "Sanitary",
    unit: "piece",
    model: "WM-707",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // TAPS (7 products)
  // ==========================================
  {
    name: "Basin Mixer Tap",
    category: "Taps",
    unit: "piece",
    model: "BM-10",
    material: "Brass / Chrome",
    warranty: "7 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Pillar Cock Tap",
    category: "Taps",
    unit: "piece",
    model: "PC-20",
    material: "Brass / Chrome",
    warranty: "7 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Wall Mixer Tap",
    category: "Taps",
    unit: "piece",
    model: "WM-30",
    material: "Brass / Chrome",
    warranty: "7 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Bath Mixer Tap",
    category: "Taps",
    unit: "piece",
    model: "BM-40",
    material: "Brass / Chrome",
    warranty: "7 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Shower Mixer Tap",
    category: "Taps",
    unit: "piece",
    model: "SM-50",
    material: "Brass / Chrome",
    warranty: "7 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Bib Cock Tap",
    category: "Taps",
    unit: "piece",
    model: "BC-60",
    material: "Brass / Chrome",
    warranty: "7 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Sink Mixer Tap",
    category: "Taps",
    unit: "piece",
    model: "KM-70",
    material: "Brass / Chrome",
    warranty: "7 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // WASH BASIN (7 products)
  // ==========================================
  // Pre-filled: Ceramic Table Top Basin (Stock = 20 pieces, PP = 1200, SP = 1800)
  {
    name: "Ceramic Table Top Basin",
    category: "Wash Basin",
    unit: "piece",
    model: "TT-01",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 20,
    estimatedStock: 0,
    purchasePrice: 1200,
    sellingPrice: 1800,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [
      {
        lotId: generateLotId(),
        purchasePrice: 1200,
        quantity: 20,
        originalQuantity: 20,
        remainingQuantity: 20,
        purchasedAt: "2026-09-01",
      },
    ],
  },
  {
    name: "Counter Top Basin",
    category: "Wash Basin",
    unit: "piece",
    model: "CT-02",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Wall Hung Basin",
    category: "Wash Basin",
    unit: "piece",
    model: "WH-03",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Pedestal Basin",
    category: "Wash Basin",
    unit: "piece",
    model: "PB-04",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Corner Basin",
    category: "Wash Basin",
    unit: "piece",
    model: "CB-05",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Semi Recessed Basin",
    category: "Wash Basin",
    unit: "piece",
    model: "SR-06",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Under Counter Basin",
    category: "Wash Basin",
    unit: "piece",
    model: "UC-07",
    material: "Ceramic",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // SINK (7 products)
  // ==========================================
  // Pre-filled: Single Bowl Kitchen Sink (Stock = 15 pieces, PP = 2200, SP = 3200)
  {
    name: "Single Bowl Kitchen Sink",
    category: "Sink",
    unit: "piece",
    model: "SS-SB1",
    material: "Stainless Steel 304",
    warranty: "10 Years",
    stock: 15,
    estimatedStock: 0,
    purchasePrice: 2200,
    sellingPrice: 3200,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [
      {
        lotId: generateLotId(),
        purchasePrice: 2200,
        quantity: 15,
        originalQuantity: 15,
        remainingQuantity: 15,
        purchasedAt: "2026-09-01",
      },
    ],
  },
  {
    name: "Double Bowl Kitchen Sink",
    category: "Sink",
    unit: "piece",
    model: "SS-DB2",
    material: "Stainless Steel 304",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Single Bowl Drainboard Sink",
    category: "Sink",
    unit: "piece",
    model: "SS-SBD3",
    material: "Stainless Steel 304",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Double Bowl Drainboard Sink",
    category: "Sink",
    unit: "piece",
    model: "SS-DBD4",
    material: "Stainless Steel 304",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Handmade Kitchen Sink",
    category: "Sink",
    unit: "piece",
    model: "HM-50",
    material: "Stainless Steel 304",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Undermount Kitchen Sink",
    category: "Sink",
    unit: "piece",
    model: "UM-60",
    material: "Stainless Steel 304",
    warranty: "10 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Quartz Kitchen Sink",
    category: "Sink",
    unit: "piece",
    model: "QZ-70",
    material: "Composite Quartz",
    warranty: "5 Years",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // CHEMICALS (7 products)
  // ==========================================
  {
    name: "Tile Adhesive Cleaner",
    category: "Chemicals",
    unit: "liter",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Polish Chemical",
    category: "Chemicals",
    unit: "liter",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Granite Polish Chemical",
    category: "Chemicals",
    unit: "liter",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Stone Sealer",
    category: "Chemicals",
    unit: "liter",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Stain Remover",
    category: "Chemicals",
    unit: "liter",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tile Cleaner",
    category: "Chemicals",
    unit: "liter",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Stone Protector",
    category: "Chemicals",
    unit: "liter",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // ADHESIVES (7 products)
  // ==========================================
  {
    name: "Tile Adhesive Standard",
    category: "Adhesives",
    unit: "kg",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tile Adhesive Premium",
    category: "Adhesives",
    unit: "kg",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Adhesive White",
    category: "Adhesives",
    unit: "kg",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Adhesive Grey",
    category: "Adhesives",
    unit: "kg",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Granite Adhesive",
    category: "Adhesives",
    unit: "kg",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Epoxy Adhesive",
    category: "Adhesives",
    unit: "kg",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Stone Fix Adhesive",
    category: "Adhesives",
    unit: "kg",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // HARDWARE (7 products)
  // ==========================================
  {
    name: "Tile Spacer 2mm",
    category: "Hardware",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tile Spacer 3mm",
    category: "Hardware",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tile Leveling Clip",
    category: "Hardware",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tile Leveling Wedge",
    category: "Hardware",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "SS Angle",
    category: "Hardware",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Clamp",
    category: "Hardware",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Stone Bracket",
    category: "Hardware",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },

  // ==========================================
  // OTHER (7 products)
  // ==========================================
  {
    name: "Marble Cutting Disc",
    category: "Other",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tile Cutting Blade",
    category: "Other",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Stone Polishing Pad",
    category: "Other",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Diamond Cutting Blade",
    category: "Other",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tile Grouting Tool",
    category: "Other",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Marble Installation Tool",
    category: "Other",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
  {
    name: "Tile Leveling Tool",
    category: "Other",
    unit: "piece",
    stock: 0,
    estimatedStock: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    minimumStock: 0,
    gstRate: 18,
    stockLots: [],
  },
];

async function seed() {
  console.log("================================================================================");
  console.log("              GAURAV MARBLES - DEMO PRODUCTS SEED UTILITY                      ");
  console.log("================================================================================");
  console.log(`Mode: ${isDryRun ? "DRY-RUN (No writes will be made)" : "LIVE INSERTION"}`);
  console.log(`Total sample products defined: ${demoProducts.length}\n`);

  // Extract refresh token from Chrome session
  const userRawPath = "C:/Users/lenovo/.gemini/antigravity/brain/36ff13e1-0c2f-4b99-9d0f-b30e679373a6/scratch/user_raw.txt";
  if (!fs.existsSync(userRawPath)) {
    console.error("❌ Session raw file not found at:", userRawPath);
    process.exit(1);
  }

  const userRaw = fs.readFileSync(userRawPath, "latin1");
  const refreshMatch = userRaw.match(/refreshToken"[^A-Za-z0-9_-]*([A-Za-z0-9_-]{50,})/);
  if (!refreshMatch) {
    console.error("❌ Could not extract refreshToken from session");
    process.exit(1);
  }

  const refreshToken = refreshMatch[1];
  const apiKey = "AIzaSyAO6OQaycah90bDDBHoR2ACCnGXHS2s6qE";
  const projectId = "gaurav-marbles";

  // 1. Refresh ID Token
  console.log("🔑 Authenticating with Firebase...");
  const tokenRes = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.id_token) {
    console.error("❌ Token refresh failed:", tokenData);
    process.exit(1);
  }
  console.log("✓ Authenticated successfully as:", tokenData.user_id, `(${tokenData.project_id})\n`);

  // 2. Fetch existing products from Firestore to prevent duplicates
  console.log("📥 Loading existing products from Firestore to check duplicates...");
  let existingDocs = [];
  let pageToken = null;
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenData.id_token}` },
    });
    const data = await res.json();
    if (data.documents) {
      existingDocs = existingDocs.concat(data.documents);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`✓ Found ${existingDocs.length} existing products in database.`);

  const existingLookup = new Set();
  existingDocs.forEach((doc) => {
    const fields = doc.fields || {};
    const name = (fields.name?.stringValue || "").trim().toLowerCase();
    const category = (fields.category?.stringValue || "").trim().toLowerCase();
    const size = (fields.size?.stringValue || "").trim().toLowerCase();
    // Key by name + category (+ size if category is Tiles/Cut Size)
    existingLookup.add(`${category}:::${name}`);
    if (size) {
      existingLookup.add(`${category}:::${name}:::${size}`);
    }
  });

  // 3. Filter products to insert
  const toInsert = [];
  const skipped = [];

  for (const item of demoProducts) {
    const nameKey = `${item.category.trim().toLowerCase()}:::${item.name.trim().toLowerCase()}`;
    const fullKey = item.size ? `${nameKey}:::${item.size.trim().toLowerCase()}` : nameKey;

    if (existingLookup.has(nameKey) || (item.size && existingLookup.has(fullKey))) {
      skipped.push(item);
    } else {
      toInsert.push(item);
    }
  }

  console.log(`\n📋 Analysis:`);
  console.log(`- New products to insert: ${toInsert.length}`);
  console.log(`- Existing products skipped: ${skipped.length}`);

  if (skipped.length > 0) {
    console.log("\nSkipped existing products:");
    skipped.forEach((s) => console.log(`  - [SKIPPED] ${s.name} (${s.category})`));
  }

  if (isDryRun) {
    console.log("\n🛡️  DRY-RUN completed. No records were written to Firestore.");
    return;
  }

  // 4. Insert each product
  console.log(`\n🚀 Inserting ${toInsert.length} demo products...`);
  let insertedCount = 0;
  const now = new Date();

  for (const prod of toInsert) {
    // Construct standard document matching Add Product page schema
    const docFields = {
      name: prod.name.trim(),
      category: prod.category,
      unit: prod.unit,
      size: prod.size || "",
      piecesPerBox: prod.piecesPerBox ?? null,
      marbleType: prod.marbleType || "",
      marbleQuantity: prod.marbleQuantity ?? 0,
      marblePieces: prod.marblePieces ?? 0,
      lotNumber: prod.lotNumber || "",
      graniteQuantity: prod.graniteQuantity ?? 0,
      granitePieces: prod.granitePieces ?? 0,
      graniteLotNumber: prod.graniteLotNumber || "",
      type: "",
      model: prod.model || "",
      material: prod.material || "",
      warranty: prod.warranty || "",
      purchasePrice: prod.purchasePrice ?? 0,
      sellingPrice: prod.sellingPrice ?? 0,
      gstRate: prod.gstRate ?? 18,
      stock: prod.stock ?? 0,
      estimatedStock: prod.estimatedStock ?? 0,
      minimumStock: prod.minimumStock ?? 0,
      stockLots: prod.stockLots || [],
      isDemo: true,
      createdAt: now,
    };

    const firestoreBody = {
      fields: {},
    };
    for (const [key, val] of Object.entries(docFields)) {
      firestoreBody.fields[key] = toFirestoreValue(val);
    }

    const insertUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products`;
    const res = await fetch(insertUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.id_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firestoreBody),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ Failed to insert ${prod.name}:`, err);
    } else {
      const created = await res.json();
      const docId = created.name.split("/").pop();
      insertedCount++;
      const isPreFilled = prod.stock > 0;
      console.log(`✓ [${insertedCount}/${toInsert.length}] Inserted: ${prod.name} (${prod.category}${prod.size ? `, ${prod.size}` : ""}) -> ID: ${docId}${isPreFilled ? ` [STOCK: ${prod.stock} ${prod.unit} @ ₹${prod.purchasePrice}]` : ""}`);
    }
  }

  console.log("\n================================================================================");
  console.log(`✅ SEEDING COMPLETE: Successfully inserted ${insertedCount} demo products!`);
  console.log("================================================================================");
}

seed().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
