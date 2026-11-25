// Deterministic Calculation Engines (Modules 1, 2, 3)

const UNIT_CONVERSION_MAP = {
  mg: ["g", 0.001],
  g: ["g", 1.0],
  "กรัม": ["g", 1.0],
  kg: ["g", 1000.0],
  "กก.": ["g", 1000.0],
  ml: ["ml", 1.0],
  "มล.": ["ml", 1.0],
  l: ["ml", 1000.0],
  "ลิตร": ["ml", 1000.0],
  pcs: ["pcs", 1.0],
  "ชิ้น": ["pcs", 1.0],
  uses: ["uses", 1.0],
  "ครั้ง": ["uses", 1.0],
};

const CATEGORY_ORDER = { SHOP: 0, PLATFORM: 1, CREDIT_CARD: 2, CASHBACK_COIN: 3 };

function roundTo(val, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export function normalizeUnit(rawQuantity, rawUnit) {
  const key = String(rawUnit || "").trim().toLowerCase();
  if (key in UNIT_CONVERSION_MAP) {
    const [baseUnit, factor] = UNIT_CONVERSION_MAP[key];
    return {
      standardized_quantity: roundTo(rawQuantity * factor, 6),
      standardized_unit: baseUnit,
    };
  }
  return {
    standardized_quantity: roundTo(rawQuantity, 6),
    standardized_unit: String(rawUnit || "unit").trim() || "unit",
  };
}

export function calculateUnitEconomics(netPrice, unitInput) {
  const rawQty = Number(unitInput.raw_quantity) || 0;
  const rawUnit = unitInput.raw_unit || "pcs";
  const ratio = Math.min(1, Math.max(0.0001, Number(unitInput.active_ingredient_ratio) || 1));

  const { standardized_quantity, standardized_unit } = normalizeUnit(rawQty, rawUnit);
  const effectiveQty = standardized_quantity * ratio;
  const trueUnitCost = effectiveQty > 0 ? roundTo(netPrice / effectiveQty, 4) : 0;

  return {
    raw_quantity: rawQty,
    raw_unit: rawUnit,
    standardized_quantity,
    standardized_unit,
    active_ingredient_ratio: ratio,
    true_unit_cost: trueUnitCost,
  };
}

export function calculateTCO(initialPrice, tcoInput) {
  if (!tcoInput || !tcoInput.is_applicable) {
    const init = roundTo(initialPrice, 2);
    return {
      is_applicable: false,
      annual_energy_cost: 0,
      annual_consumable_cost: 0,
      tco_1_year: init,
      tco_3_years: init,
      tco_5_years: init,
    };
  }

  const watt = Number(tcoInput.watt) || 0;
  const hours = Number(tcoInput.hours_per_day) || 0;
  const rate = Number(tcoInput.electricity_rate_per_kwh) || 4.5;
  const annualEnergy = (watt / 1000) * hours * 365 * rate;

  const annualConsumables = (tcoInput.consumables || []).reduce((sum, c) => {
    const months = Math.max(1, Number(c.replace_interval_months) || 12);
    return sum + ((Number(c.price) || 0) / months) * 12;
  }, 0);

  const annualTotal = annualEnergy + annualConsumables;
  return {
    is_applicable: true,
    annual_energy_cost: roundTo(annualEnergy, 2),
    annual_consumable_cost: roundTo(annualConsumables, 2),
    tco_1_year: roundTo(initialPrice + 1 * annualTotal, 2),
    tco_3_years: roundTo(initialPrice + 3 * annualTotal, 2),
    tco_5_years: roundTo(initialPrice + 5 * annualTotal, 2),
  };
}

function computeCouponValue(coupon, baseAmount) {
  const minSpend = Number(coupon.min_spend) || 0;
  if (baseAmount < minSpend || baseAmount <= 0) return 0;

  const val = Number(coupon.value) || 0;
  let raw = coupon.value_mode === "PERCENT" ? baseAmount * (val / 100) : val;
  if (coupon.max_cap !== null && coupon.max_cap !== undefined && coupon.max_cap !== "") {
    raw = Math.min(raw, Number(coupon.max_cap));
  }
  return roundTo(Math.min(raw, baseAmount), 2);
}

function isValidSubset(subset) {
  const nonStackableCats = new Set();
  for (const c of subset) {
    if (!c.stackable) {
      if (nonStackableCats.has(c.category)) return false;
      nonStackableCats.add(c.category);
    }
  }
  return true;
}

function evaluateSubset(listedPrice, subset) {
  const ordered = [...subset].sort(
    (a, b) => (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
  );
  let remainingCash = listedPrice;
  let totalCashback = 0;
  const applied = [];

  for (const c of ordered) {
    if (c.discount_type === "CASH_DISCOUNT") {
      const disc = computeCouponValue(c, remainingCash);
      if (disc <= 0) continue;
      remainingCash = roundTo(Math.max(0, remainingCash - disc), 2);
      applied.push({
        coupon_name: c.coupon_name,
        discount_type: "CASH_DISCOUNT",
        discount_value: disc,
        conditions: c.conditions || "",
      });
    } else {
      const cb = computeCouponValue(c, remainingCash);
      if (cb <= 0) continue;
      totalCashback = roundTo(totalCashback + cb, 2);
      applied.push({
        coupon_name: c.coupon_name,
        discount_type: "CASHBACK",
        discount_value: cb,
        conditions: c.conditions || "",
      });
    }
  }

  return { remainingCash, totalCashback, applied };
}

export function optimizePricing(listedPrice, coupons = [], medianPrice90d = null) {
  const listed = roundTo(Number(listedPrice) || 0, 2);
  const median90d =
    medianPrice90d !== null && Number(medianPrice90d) > 0
      ? roundTo(Number(medianPrice90d), 2)
      : listed;

  const candidates = coupons.slice(0, 16);
  let bestCash = listed;
  let bestCashback = 0;
  let bestApplied = [];

  const totalMasks = 1 << candidates.length;
  for (let mask = 1; mask < totalMasks; mask++) {
    const subset = [];
    for (let i = 0; i < candidates.length; i++) {
      if (mask & (1 << i)) subset.push(candidates[i]);
    }
    if (!isValidSubset(subset)) continue;

    const { remainingCash, totalCashback, applied } = evaluateSubset(listed, subset);
    const isBetter =
      remainingCash < bestCash ||
      (remainingCash === bestCash && totalCashback > bestCashback) ||
      (remainingCash === bestCash &&
        totalCashback === bestCashback &&
        applied.length < bestApplied.length);

    if (isBetter) {
      bestCash = remainingCash;
      bestCashback = totalCashback;
      bestApplied = applied;
    }
  }

  const realDiscountPct =
    median90d > 0 ? roundTo(((median90d - bestCash) / median90d) * 100, 2) : 0;

  return {
    listed_price: listed,
    median_price_90d: median90d,
    applied_coupons: bestApplied,
    net_cash_payable: roundTo(bestCash, 2),
    cashback_received: roundTo(bestCashback, 2),
    real_discount_percentage: realDiscountPct,
  };
}

export function analyzeProduct(req) {
  const pricing = optimizePricing(req.listed_price, req.coupons, req.median_price_90d);
  const unit_economics = calculateUnitEconomics(pricing.net_cash_payable, req.unit_input);
  const tco_analysis = calculateTCO(pricing.net_cash_payable, req.tco_input);

  return {
    product_id: req.product_id,
    name: req.name,
    source_url: req.source_url || "",
    pricing,
    unit_economics,
    tco_analysis,
    technical_specs: req.technical_specs || { key_parameters: {} },
    verified_review_insights: req.verified_review_insights || {
      total_filtered_reviews: 0,
      recurring_defects: [],
      verified_strengths: [],
    },
  };
}

const ZERO_HALLUCINATION_PROMPT = `คุณคือระบบสกัดข้อมูลทางวิศวกรรมและวิเคราะห์รีวิวแบบ Zero Hallucination
กฎเหล็ก:
1. ห้ามคาดเดาหรือเติมข้อมูลที่ไม่มีในข้อความต้นฉบับโดยเด็ดขาด หากไม่พบให้ระบุว่า "ไม่พบข้อมูลยืนยัน"
2. สเปกทางเทคนิค (key_parameters): ดึงเฉพาะค่าตัวเลข หน่วยวัด และมาตรฐานรับรอง ตัดคำโฆษณาเกินจริงออก
3. การคัดกรองรีวิว (verified_review_insights): วิเคราะห์เฉพาะรีวิวที่ครบทั้ง 3 เงื่อนไข: สั่งซื้อจริง + มีภาพ/วิดีโอ + ใช้งาน >= 14 วัน
4. ตอบกลับเป็น JSON เท่านั้น:
{
  "technical_specs": { "key_parameters": { "พารามิเตอร์": "ค่าและหน่วย" } },
  "verified_review_insights": {
    "total_filtered_reviews": 0,
    "recurring_defects": [{ "issue": "ปัญหา", "frequency_count": 1 }],
    "verified_strengths": ["จุดแข็ง"]
  }
}`;

export function ruleBasedExtract(rawSpecsText, rawReviewsText) {
  const params = {};
  for (const rawLine of String(rawSpecsText || "").split("\n")) {
    const line = rawLine.trim();
    const idx = line.indexOf(":");
    if (idx > 0) {
      const k = line.slice(0, idx).replace(/^[-•*\s]+/, "").trim();
      const v = line.slice(idx + 1).trim();
      if (k && v) params[k] = v;
    }
  }
  if (Object.keys(params).length === 0) {
    params["ข้อมูลสเปก"] = "ไม่พบข้อมูลยืนยัน";
  }

  const defectMap = new Map();
  const strengths = [];
  let filteredCount = 0;

  for (const rawLine of String(rawReviewsText || "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    const hasVerified = /verified|สั่งซื้อจริง|ยืนยันการซื้อ/.test(lower);
    const hasMedia = /photo|video|รูป|ภาพ|วิดีโอ|คลิป/.test(lower);
    const dayMatch = lower.match(/(\d+)\s*(วัน|days|day)/);
    const has14Days = Boolean(dayMatch && Number(dayMatch[1]) >= 14);

    if (hasVerified && hasMedia && has14Days) {
      filteredCount += 1;
      if (/เสีย|พัง|ดัง|รั่ว|defect|issue|ปัญหา|ช้า/.test(lower)) {
        const key = line.slice(0, 80);
        defectMap.set(key, (defectMap.get(key) || 0) + 1);
      } else {
        strengths.push(line.slice(0, 80));
      }
    }
  }

  const recurring_defects = Array.from(defectMap.entries()).map(([issue, frequency_count]) => ({
    issue,
    frequency_count,
  }));

  return {
    mode: "RULE_BASED_FALLBACK",
    technical_specs: { key_parameters: params },
    verified_review_insights: {
      total_filtered_reviews: filteredCount,
      recurring_defects,
      verified_strengths: strengths.slice(0, 10),
    },
    warnings: [
      "ทำงานในโหมด Rule-Based (ไม่ได้ใช้ API Key): สกัดเฉพาะรูปแบบ 'หัวข้อ: ค่า' และรีวิวที่ระบุ สั่งซื้อจริง + รูป/วิดีโอ + >=14 วัน",
    ],
  };
}

export async function extractSpecsAndReviews(rawSpecsText, rawReviewsText, apiKey = "") {
  const key = String(apiKey || "").trim();
  if (!key) {
    return ruleBasedExtract(rawSpecsText, rawReviewsText);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
    key
  )}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ZERO_HALLUCINATION_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `=== ข้อมูลสเปกสินค้า ===\n${rawSpecsText || "ไม่มีข้อมูล"}\n\n=== ข้อมูลรีวิว ===\n${
                  rawReviewsText || "ไม่มีข้อมูล"
                }`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
    return {
      mode: "LLM_GEMINI",
      technical_specs: parsed.technical_specs || { key_parameters: {} },
      verified_review_insights: parsed.verified_review_insights || {
        total_filtered_reviews: 0,
        recurring_defects: [],
        verified_strengths: [],
      },
      warnings: [],
    };
  } catch (err) {
    const fallback = ruleBasedExtract(rawSpecsText, rawReviewsText);
    fallback.warnings.unshift(`เรียก Gemini API ไม่สำเร็จ (${err.message}) ระบบสลับเป็น Rule-Based`);
    return fallback;
  }
}
