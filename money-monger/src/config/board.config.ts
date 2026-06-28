/**
 * board.config.ts
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for board layout, pricing, tile
 * mechanics, audit rules, salary, and card effects.
 *
 * Three separate concerns — all distinct:
 *   board.config.ts   → tile positions, prices, mechanics  (this file)
 *   countries.json    → city/district names, currency      (src/shared/countries.json)
 *   theme.json        → art, palette, sounds, card text    (Supabase Storage)
 *
 * Changing board layout or mechanics = edit this file only.
 * No engine code changes needed.
 * ─────────────────────────────────────────────────────────────
 *
 * Board: 32 tiles (9×9 perimeter: 4 corners + 4 × 7 sides)
 * Districts: 5 (d1=3 props, d2=3, d3=4, d4=4, d5=4 = 18 total)
 * Properties are SCATTERED — not grouped by side.
 *
 * Tile index → position on board (0 = Start, clockwise):
 *
 *   [24]  25  26  27  28  29  30  31  [0 ]
 *    23                               1
 *    22                               2
 *    21                               3
 *    20                               4
 *    19                               5
 *    18                               6
 *    17                               7
 *   [16]  15  14  13  12  11  10   9  [8 ]
 */

// ─── Tile types ───────────────────────────────────────────────
export type TileType =
  | 'start'
  | 'audit'
  | 'rest_stop'
  | 'go_to_audit'
  | 'property'
  | 'utility'
  | 'tax'
  | 'card_govt_notice'
  | 'card_govt_grant';

// ─── Audit rules ──────────────────────────────────────────────
// Triggered by: landing on go_to_audit, drawing gn_move_to_audit
// card, or rolling three doubles in a row.
export interface AuditRules {
  turns: number;              // how many turns the player is under audit
  settleCost: number;         // cost to pay the Banker to exit early
  maxDoubleAttempts: number;  // max rolls to escape via doubles before auto-release
}

// ─── Salary config ────────────────────────────────────────────
// Paid by the Banker when a player passes or lands on Start (index 0).
export interface SalaryConfig {
  amount: number;             // base salary
  doubleSalaryMultiplier: 2;  // multiplier when host enables "Double Salary" rule
}

// ─── Auction config (sealed-bid) ─────────────────────────────
// Triggered when a player passes on buying a property or when
// bankrupt player assets return to the bank.
export interface AuctionConfig {
  bidTimerSeconds: number;    // phase 1 countdown; ends early if all bids submitted
  minimumBid: 'property_price'; // always equals the property's listed price
}

// ─── Tax calculation ──────────────────────────────────────────
export type TaxCalculation =
  | { mode: 'fixed';      amount: number }
  | { mode: 'percentage'; of: 'cash' | 'net_worth'; rate: number };

// ─── Card effect keys ─────────────────────────────────────────
export type CardEffectKey =
  | 'MOVE_TO_TILE'
  | 'COLLECT_FIXED'
  | 'PAY_FIXED'
  | 'COLLECT_FROM_ALL'
  | 'PAY_TO_ALL'
  | 'PAY_PER_BUILDING'
  | 'COLLECT_PER_PLAYER'
  | 'GET_AUDIT_CLEARANCE'
  | 'EXTRA_TURN'
  | 'PROPERTY_DISCOUNT'
  | 'FREE_BUILD';

// ─── Tile definitions ─────────────────────────────────────────
export interface CornerTile {
  index: number;
  type: 'start' | 'audit' | 'rest_stop' | 'go_to_audit';
}

export interface PropertyTile {
  index: number;
  type: 'property';
  districtId: string;
  price: number;
  rentLadder: [number, number, number, number, number]; // [base, 1tower, 2tower, 3tower, HQ]
  mortgageValue: number;
}

export interface UtilityTile {
  index: number;
  type: 'utility';
  utilityId: 'u1' | 'u2';
  price: number;
  mortgageValue: number;
}

export interface TaxTile {
  index: number;
  type: 'tax';
  calculation: TaxCalculation;
}

export interface CardTile {
  index: number;
  type: 'card_govt_notice' | 'card_govt_grant';
}

export type BoardTile =
  | CornerTile
  | PropertyTile
  | UtilityTile
  | TaxTile
  | CardTile;

// ─── District definition ──────────────────────────────────────
export interface District {
  id: string;
  size: number;
  buildCost: number;
  sellRefund: number;           // fraction of buildCost returned (0.5 = 50%)
  monopolyRentMultiplier: 2;    // always 2x base rent when monopoly + 0 buildings
}

// ─── Card definition ──────────────────────────────────────────
export interface CardDef {
  id: string;
  deck: 'govt_notice' | 'govt_grant';
  effectKey: CardEffectKey;
  params: Record<string, unknown>;
}

// ─── Utility rent rule ────────────────────────────────────────
export interface UtilityRentRule {
  type: 'dice_multiplier';
  ownOne: number;
  ownBoth: number;
}

// ─── Full board config ────────────────────────────────────────
export interface BoardConfig {
  id: string;
  totalTiles: number;
  tiles: BoardTile[];
  districts: Record<string, District>;
  utilityRent: UtilityRentRule;
  auditRules: AuditRules;
  salary: SalaryConfig;
  auctionConfig: AuctionConfig;
  cards: {
    govt_notice: CardDef[];
    govt_grant: CardDef[];
  };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT BOARD CONFIG
// ─────────────────────────────────────────────────────────────
export const BOARD_CONFIG: BoardConfig = {
  id: 'default',
  totalTiles: 32,

  // ── Audit rules ────────────────────────────────────────────
  // Triggered by go_to_audit tile, gn_move_to_audit card, or 3 doubles.
  // Player rolls each turn trying for doubles; can also pay or use card.
  auditRules: {
    turns: 3,                  // max turns under audit before auto-release
    settleCost: 100,           // pay Banker this amount to exit immediately
    maxDoubleAttempts: 3,      // rolling doubles escapes audit + player moves
  },

  // ── Salary ─────────────────────────────────────────────────
  // Banker pays this when a player passes or lands on Start (index 0).
  salary: {
    amount: 200,
    doubleSalaryMultiplier: 2, // applied when host enables "Double Salary" rule
  },

  // ── Sealed-bid auction ─────────────────────────────────────
  // Minimum bid always equals the property's listed price.
  // Phase 1 ends when all players submit or timer expires.
  // Phase 2 reveals all bids simultaneously; highest wins.
  auctionConfig: {
    bidTimerSeconds: 30,
    minimumBid: 'property_price',
  },

  // ── Utility rent (dice × multiplier) ──────────────────────
  utilityRent: {
    type: 'dice_multiplier',
    ownOne: 4,
    ownBoth: 10,
  },

  // ── Districts ──────────────────────────────────────────────
  // Properties scattered across board — indices below
  // d1: [1, 5, 7]       — cheapest (3 props)
  // d2: [3, 11, 15]     — low-mid  (3 props)
  // d3: [9, 13, 19, 23] — mid      (4 props)
  // d4: [17,21, 27, 30] — high-mid (4 props)
  // d5: [25,28, 29, 31] — expensive(4 props)
  districts: {
    d1: { id: 'd1', size: 3, buildCost: 50,  sellRefund: 0.5, monopolyRentMultiplier: 2 },
    d2: { id: 'd2', size: 3, buildCost: 100, sellRefund: 0.5, monopolyRentMultiplier: 2 },
    d3: { id: 'd3', size: 4, buildCost: 150, sellRefund: 0.5, monopolyRentMultiplier: 2 },
    d4: { id: 'd4', size: 4, buildCost: 200, sellRefund: 0.5, monopolyRentMultiplier: 2 },
    d5: { id: 'd5', size: 4, buildCost: 200, sellRefund: 0.5, monopolyRentMultiplier: 2 },
  },

  // ── Tiles (index = board position, clockwise from Start) ───
  tiles: [

    // ── Corner: Start ────────────────────────────────────────
    { index: 0, type: 'start' },

    // ── Side 1: tiles 1–7 (cheap area near Start) ────────────
    { index: 1,  type: 'property', districtId: 'd1', price: 60,  rentLadder: [2,  10,  30,  90,  160], mortgageValue: 30  },
    { index: 2,  type: 'card_govt_grant' },
    { index: 3,  type: 'property', districtId: 'd2', price: 100, rentLadder: [6,  30,  90,  270, 400], mortgageValue: 50  },
    { index: 4,  type: 'tax',      calculation: { mode: 'fixed', amount: 200 } },
    { index: 5,  type: 'property', districtId: 'd1', price: 60,  rentLadder: [4,  20,  60,  180, 320], mortgageValue: 30  },
    { index: 6,  type: 'utility',  utilityId: 'u1',  price: 150, mortgageValue: 75 },
    { index: 7,  type: 'property', districtId: 'd1', price: 80,  rentLadder: [6,  30,  90,  270, 450], mortgageValue: 40  },

    // ── Corner: Rest Stop ─────────────────────────────────────
    { index: 8, type: 'rest_stop' },

    // ── Side 2: tiles 9–15 (mid district) ────────────────────
    { index: 9,  type: 'property', districtId: 'd3', price: 140, rentLadder: [10, 50,  150, 450, 700], mortgageValue: 70  },
    { index: 10, type: 'card_govt_notice' },
    { index: 11, type: 'property', districtId: 'd2', price: 110, rentLadder: [8,  40,  100, 300, 450], mortgageValue: 55  },
    { index: 12, type: 'utility',  utilityId: 'u2',  price: 150, mortgageValue: 75 },
    { index: 13, type: 'property', districtId: 'd3', price: 150, rentLadder: [12, 60,  180, 500, 750], mortgageValue: 75  },
    { index: 14, type: 'card_govt_grant' },
    { index: 15, type: 'property', districtId: 'd2', price: 120, rentLadder: [8,  40,  100, 300, 450], mortgageValue: 60  },

    // ── Corner: Go to Audit ───────────────────────────────────
    { index: 16, type: 'go_to_audit' },

    // ── Side 3: tiles 17–23 (high-mid district) ──────────────
    { index: 17, type: 'property', districtId: 'd4', price: 200, rentLadder: [14, 70,  200, 550, 950], mortgageValue: 100 },
    { index: 18, type: 'card_govt_notice' },
    { index: 19, type: 'property', districtId: 'd3', price: 160, rentLadder: [12, 60,  180, 500, 750], mortgageValue: 80  },
    { index: 20, type: 'tax',      calculation: { mode: 'percentage', of: 'cash', rate: 0.10 } },
    { index: 21, type: 'property', districtId: 'd4', price: 210, rentLadder: [16, 80,  220, 600, 1000],mortgageValue: 105 },
    { index: 22, type: 'card_govt_grant' },
    { index: 23, type: 'property', districtId: 'd3', price: 180, rentLadder: [14, 70,  200, 550, 950], mortgageValue: 90  },

    // ── Corner: Audit ─────────────────────────────────────────
    { index: 24, type: 'audit' },

    // ── Side 4: tiles 25–31 (expensive, high stakes) ─────────
    { index: 25, type: 'property', districtId: 'd5', price: 300, rentLadder: [26, 130, 390, 900, 1275],mortgageValue: 150 },
    { index: 26, type: 'card_govt_notice' },
    { index: 27, type: 'property', districtId: 'd4', price: 220, rentLadder: [16, 80,  220, 600, 1000],mortgageValue: 110 },
    { index: 28, type: 'property', districtId: 'd5', price: 320, rentLadder: [28, 150, 450, 1000,1400],mortgageValue: 160 },
    { index: 29, type: 'property', districtId: 'd5', price: 350, rentLadder: [30, 165, 500, 1100,1500],mortgageValue: 175 },
    { index: 30, type: 'property', districtId: 'd4', price: 240, rentLadder: [20, 100, 300, 750, 1100],mortgageValue: 120 },
    { index: 31, type: 'property', districtId: 'd5', price: 400, rentLadder: [35, 175, 500, 1100,1500],mortgageValue: 200 },

  ],

  // ── Card decks ─────────────────────────────────────────────
  // effectKey = engine logic. Theme supplies flavor text per id.
  // Decks shuffle (seeded RNG). Drawn cards return to bottom
  // except GET_AUDIT_CLEARANCE (held by player until used).
  cards: {

    govt_notice: [
      {
        id:        'gn_move_to_start',
        deck:      'govt_notice',
        effectKey: 'MOVE_TO_TILE',
        params:    { tileIndex: 0, collectSalary: true },
        // theme label: e.g. "Tax refund! Advance to Start and collect 🪙200"
      },
      {
        id:        'gn_move_to_audit',
        deck:      'govt_notice',
        effectKey: 'MOVE_TO_TILE',
        params:    { tileIndex: 24, collectSalary: false, applyAudit: true },
        // theme label: e.g. "Audit notice received. Report immediately."
      },
      {
        id:        'gn_collect_100',
        deck:      'govt_notice',
        effectKey: 'COLLECT_FIXED',
        params:    { amount: 100 },
        // theme label: e.g. "Tax rebate approved. Collect 🪙100 from Bank."
      },
      {
        id:        'gn_pay_150',
        deck:      'govt_notice',
        effectKey: 'PAY_FIXED',
        params:    { amount: 150 },
        // theme label: e.g. "Outstanding tax dues. Pay 🪙150 to the Bank."
      },
      {
        id:        'gn_clearance_card',
        deck:      'govt_notice',
        effectKey: 'GET_AUDIT_CLEARANCE',
        params:    {},
        // theme label: e.g. "Clean chit issued. Keep this Audit Clearance Card."
      },
      {
        id:        'gn_extra_turn',
        deck:      'govt_notice',
        effectKey: 'EXTRA_TURN',
        params:    {},
        // theme label: e.g. "Fast-track clearance. Take another turn immediately."
      },
    ],

    govt_grant: [
      {
        id:        'gg_collect_from_all',
        deck:      'govt_grant',
        effectKey: 'COLLECT_FROM_ALL',
        params:    { amount: 50 },
        // theme label: e.g. "City dividend declared. Collect 🪙50 from each player."
      },
      {
        id:        'gg_pay_to_all',
        deck:      'govt_grant',
        effectKey: 'PAY_TO_ALL',
        params:    { amount: 50 },
        // theme label: e.g. "Community levy. Pay 🪙50 to each player."
      },
      {
        id:        'gg_pay_per_building',
        deck:      'govt_grant',
        effectKey: 'PAY_PER_BUILDING',
        params:    { towerCost: 40, hqCost: 115 },
        // theme label: e.g. "Property maintenance tax. Pay 🪙40 per tower, 🪙115 per HQ."
      },
      {
        id:        'gg_collect_per_player',
        deck:      'govt_grant',
        effectKey: 'COLLECT_PER_PLAYER',
        params:    { amount: 40 },
        // theme label: e.g. "City grants distributed. Collect 🪙40 per active player."
      },
      {
        id:        'gg_property_discount',
        deck:      'govt_grant',
        effectKey: 'PROPERTY_DISCOUNT',
        params:    { rate: 0.5 },
        // theme label: e.g. "Govt subsidy approved. Next property purchase at 50% off."
      },
      {
        id:        'gg_free_build',
        deck:      'govt_grant',
        effectKey: 'FREE_BUILD',
        params:    {},
        // theme label: e.g. "Urban development grant. Place one free tower on any property."
      },
    ],

  },
};

// ─── Helper — get all tiles in a district ────────────────────
export function getDistrictTiles(
  config: BoardConfig,
  districtId: string,
): PropertyTile[] {
  return config.tiles.filter(
    (t): t is PropertyTile =>
      t.type === 'property' && t.districtId === districtId,
  );
}

// ─── Helper — check player owns full district ─────────────────
export function hasMonopoly(
  config: BoardConfig,
  districtId: string,
  ownedTileIndices: number[],
): boolean {
  const districtTiles = getDistrictTiles(config, districtId);
  return districtTiles.every(t => ownedTileIndices.includes(t.index));
}

// ─── Helper — compute salary for a player ────────────────────
export function computeSalary(
  config: BoardConfig,
  doubleSalaryEnabled: boolean,
): number {
  return doubleSalaryEnabled
    ? config.salary.amount * config.salary.doubleSalaryMultiplier
    : config.salary.amount;
}

// ─── Helper — get minimum bid for a property ─────────────────
export function getMinimumBid(
  config: BoardConfig,
  tileIndex: number,
): number {
  const tile = config.tiles.find(t => t.index === tileIndex);
  if (!tile || tile.type !== 'property') return 0;
  return tile.price;
}