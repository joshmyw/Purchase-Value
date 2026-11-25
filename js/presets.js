import { analyzeProduct } from "./engines.js";

export function getDemoPresets() {
  return [
    {
      comparison_session_id: "preset-air-purifiers",
      title: "ตัวอย่าง: เครื่องฟอกอากาศ (เทียบ TCO 3-5 ปี + ค่าไส้กรอง)",
      currency: "THB",
      priority_mode: "TCO_3Y",
      products: [
        analyzeProduct({
          product_id: "ap-1",
          name: "Xiaomi Smart Air Purifier 4 Compact",
          source_url: "https://example.com/xiaomi-4-compact",
          listed_price: 3290,
          median_price_90d: 2990,
          coupons: [
            {
              coupon_name: "โค้ดร้านค้า 100.-",
              category: "SHOP",
              discount_type: "CASH_DISCOUNT",
              value_mode: "FIXED",
              value: 100,
              min_spend: 2000,
            },
            {
              coupon_name: "แพลตฟอร์มลด 10% (สูงสุด 300)",
              category: "PLATFORM",
              discount_type: "CASH_DISCOUNT",
              value_mode: "PERCENT",
              value: 10,
              min_spend: 2500,
              max_cap: 300,
            },
            {
              coupon_name: "รับ Coins คืน 15%",
              category: "CASHBACK_COIN",
              discount_type: "CASHBACK",
              value_mode: "PERCENT",
              value: 15,
              max_cap: 500,
            },
          ],
          unit_input: { raw_quantity: 1, raw_unit: "pcs", active_ingredient_ratio: 1.0 },
          tco_input: {
            is_applicable: true,
            watt: 27,
            hours_per_day: 12,
            electricity_rate_per_kwh: 4.5,
            consumables: [{ name: "ไส้กรอง HEPA", price: 790, replace_interval_months: 6 }],
          },
          technical_specs: {
            key_parameters: {
              "CADR (ฝุ่น)": "230 m³/h",
              "พื้นที่แนะนำ": "16–27 ตร.ม.",
              "กำลังไฟสูงสุด": "27 W",
              "ระดับเสียง": "20–60 dB(A)",
              "มาตรฐานกรอง": "HEPA H13 (99.97% @ 0.3µm)",
            },
          },
          verified_review_insights: {
            total_filtered_reviews: 42,
            recurring_defects: [
              { issue: "เสียงพัดลมโหมด Auto ดังช่วงกลางคืน", frequency_count: 6 },
              { issue: "เซนเซอร์ฝุ่นเพี้ยนหลัง 6 เดือน", frequency_count: 3 },
            ],
            verified_strengths: ["ประหยัดไฟมากเมื่อเปิดต่อเนื่อง", "ขนาดกะทัดรัด วางบนโต๊ะได้"],
          },
        }),
        analyzeProduct({
          product_id: "ap-2",
          name: "Sharp FP-J30TA-B",
          source_url: "https://example.com/sharp-fp-j30",
          listed_price: 3490,
          median_price_90d: 3690,
          coupons: [
            {
              coupon_name: "ลดทันที 250.-",
              category: "PLATFORM",
              discount_type: "CASH_DISCOUNT",
              value_mode: "FIXED",
              value: 250,
              min_spend: 3000,
            },
            {
              coupon_name: "บัตรเครดิตลดเพิ่ม 5%",
              category: "CREDIT_CARD",
              discount_type: "CASH_DISCOUNT",
              value_mode: "PERCENT",
              value: 5,
              max_cap: 200,
            },
          ],
          unit_input: { raw_quantity: 1, raw_unit: "pcs", active_ingredient_ratio: 1.0 },
          tco_input: {
            is_applicable: true,
            watt: 50,
            hours_per_day: 12,
            electricity_rate_per_kwh: 4.5,
            consumables: [
              { name: "ไส้กรอง FZ-F30HFE", price: 1190, replace_interval_months: 24 },
            ],
          },
          technical_specs: {
            key_parameters: {
              "พื้นที่แนะนำ": "23 ตร.ม.",
              "กำลังไฟสูงสุด": "50 W",
              "ระดับเสียง": "23–44 dB(A)",
              "มาตรฐานกรอง": "HEPA + Plasmacluster 7000",
            },
          },
          verified_review_insights: {
            total_filtered_reviews: 35,
            recurring_defects: [
              { issue: "ไม่มีหน้าจอตัวเลข PM2.5 บอกค่าจริง", frequency_count: 8 },
            ],
            verified_strengths: [
              "ไส้กรองอายุยาว 2 ปี ประหยัดค่าเปลี่ยนระยะยาว",
              "มอเตอร์ทนทาน ใช้งานเกิน 3 ปีไม่พบปัญหา",
            ],
          },
        }),
        analyzeProduct({
          product_id: "ap-3",
          name: "Levoit Core 300",
          source_url: "https://example.com/levoit-core-300",
          listed_price: 4290,
          median_price_90d: 4590,
          coupons: [
            {
              coupon_name: "โค้ดลด 400.-",
              category: "SHOP",
              discount_type: "CASH_DISCOUNT",
              value_mode: "FIXED",
              value: 400,
              min_spend: 4000,
            },
          ],
          unit_input: { raw_quantity: 1, raw_unit: "pcs", active_ingredient_ratio: 1.0 },
          tco_input: {
            is_applicable: true,
            watt: 45,
            hours_per_day: 12,
            electricity_rate_per_kwh: 4.5,
            consumables: [
              { name: "ไส้กรอง Core 300-RF", price: 990, replace_interval_months: 8 },
            ],
          },
          technical_specs: {
            key_parameters: {
              "CADR (ฝุ่น)": "240 m³/h",
              "พื้นที่แนะนำ": "20–40 ตร.ม.",
              "กำลังไฟสูงสุด": "45 W",
              "ระดับเสียง": "24–50 dB(A)",
              "มาตรฐานกรอง": "True HEPA H13 + Activated Carbon",
            },
          },
          verified_review_insights: {
            total_filtered_reviews: 28,
            recurring_defects: [
              { issue: "ไส้กรองแท้ราคาสูงและหาซื้อยากบางช่วง", frequency_count: 4 },
            ],
            verified_strengths: ["กรองกลิ่นและฝุ่นได้เร็วมาก", "โหมด Sleep เงียบจริง 24 dB"],
          },
        }),
      ],
    },
    {
      comparison_session_id: "preset-detergents",
      title: "ตัวอย่าง: น้ำยาซักผ้า (เทียบ True Unit Cost ต่อหน่วยสารสำคัญ)",
      currency: "THB",
      priority_mode: "TRUE_UNIT_COST",
      products: [
        analyzeProduct({
          product_id: "det-1",
          name: "สูตรปกติ แกลลอน 3 ลิตร (ความเข้มข้น 15%)",
          source_url: "",
          listed_price: 219,
          median_price_90d: 199,
          coupons: [
            {
              coupon_name: "ลด 20.-",
              category: "SHOP",
              discount_type: "CASH_DISCOUNT",
              value_mode: "FIXED",
              value: 20,
              min_spend: 150,
            },
          ],
          unit_input: { raw_quantity: 3, raw_unit: "l", active_ingredient_ratio: 0.15 },
          tco_input: { is_applicable: false },
          technical_specs: {
            key_parameters: {
              "ปริมาตรสุทธิ": "3,000 ml (3 L)",
              "สารลดแรงตึงผิว (Active)": "15%",
              "ค่า pH": "7.5 (เป็นกลาง)",
            },
          },
          verified_review_insights: {
            total_filtered_reviews: 18,
            recurring_defects: [{ issue: "ฝาขวดหกเลอะเทอะเวลาเท", frequency_count: 3 }],
            verified_strengths: ["ราคาเริ่มต้นถูก"],
          },
        }),
        analyzeProduct({
          product_id: "det-2",
          name: "สูตรเข้มข้นพิเศษ ถุงเติม 1,400 ml (ความเข้มข้น 35%)",
          source_url: "",
          listed_price: 169,
          median_price_90d: 185,
          coupons: [
            {
              coupon_name: "ลด 15%",
              category: "PLATFORM",
              discount_type: "CASH_DISCOUNT",
              value_mode: "PERCENT",
              value: 15,
              min_spend: 100,
              max_cap: 40,
            },
          ],
          unit_input: { raw_quantity: 1400, raw_unit: "ml", active_ingredient_ratio: 0.35 },
          tco_input: { is_applicable: false },
          technical_specs: {
            key_parameters: {
              "ปริมาตรสุทธิ": "1,400 ml",
              "สารลดแรงตึงผิว (Active)": "35%",
              "เหมาะสำหรับ": "เครื่องซักผ้าฝาหน้าและฝาบน",
            },
          },
          verified_review_insights: {
            total_filtered_reviews: 25,
            recurring_defects: [],
            verified_strengths: ["ใช้ปริมาณน้อยกว่าครึ่งต่อการซัก 1 ครั้ง", "ประหยัดพื้นที่จัดเก็บ"],
          },
        }),
      ],
    },
  ];
}
