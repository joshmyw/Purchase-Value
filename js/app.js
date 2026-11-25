import { analyzeProduct, extractSpecsAndReviews } from "./engines.js";
import { getDemoPresets } from "./presets.js";
import {
  deleteSessionFromStorage,
  exportSessionJson,
  loadSavedSessions,
  saveSessionToStorage,
} from "./storage.js";

const presets = getDemoPresets();
let currentSession = structuredClone(presets[0]);
let editingProductId = null;
let modalCoupons = [];
let modalConsumables = [];
let extractedSpecs = { key_parameters: {} };
let extractedReviews = { total_filtered_reviews: 0, recurring_defects: [], verified_strengths: [] };

const el = (id) => document.getElementById(id);

const ICONS = {
  award: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  warn: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
};

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(val, currency = "THB") {
  const sym = currency === "THB" ? "฿" : `${currency} `;
  return `${sym}${Number(val || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function showToast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => {
    t.style.display = "none";
  }, 3000);
}

function getMetricValue(product, mode) {
  if (mode === "NET_CASH") return product.pricing.net_cash_payable;
  if (mode === "TRUE_UNIT_COST") return product.unit_economics.true_unit_cost;
  if (mode === "TCO_3Y") return product.tco_analysis.tco_3_years;
  return product.verified_review_insights.recurring_defects.reduce(
    (s, d) => s + d.frequency_count,
    0
  );
}

function sortProductsByPriority(products, mode) {
  return [...products].sort((a, b) => getMetricValue(a, mode) - getMetricValue(b, mode));
}

function renderVerdictBanner(products, mode, currency) {
  const banner = el("verdict-banner");
  if (products.length < 2) {
    banner.style.display = "none";
    return;
  }

  const ranked = sortProductsByPriority(products, mode);
  const first = ranked[0];
  const second = ranked[1];
  const diff = getMetricValue(second, mode) - getMetricValue(first, mode);

  let detail = "";
  if (mode === "NET_CASH") {
    detail = `จ่ายเงินสดสุทธิ ${formatMoney(first.pricing.net_cash_payable, currency)} (ประหยัดกว่าอันดับ 2 อยู่ ${formatMoney(diff, currency)})`;
  } else if (mode === "TRUE_UNIT_COST") {
    detail = `ต้นทุนสารสำคัญ ${formatMoney(first.unit_economics.true_unit_cost, currency)}/${first.unit_economics.standardized_unit} (ถูกกว่าอันดับ 2 อยู่ ${formatMoney(diff, currency)}/${first.unit_economics.standardized_unit})`;
  } else if (mode === "TCO_3Y") {
    detail = `ต้นทุนรวม 3 ปี ${formatMoney(first.tco_analysis.tco_3_years, currency)} (ประหยัดกว่าอันดับ 2 อยู่ ${formatMoney(diff, currency)})`;
  } else {
    const cnt = getMetricValue(first, mode);
    detail = `พบข้อบกพร่องซ้ำซากที่ยืนยัน ${cnt} ครั้ง (น้อยกว่าอันดับ 2 อยู่ ${diff} ครั้ง)`;
  }

  banner.style.display = "flex";
  banner.innerHTML = `
    <div class="verdict-main">
      <span class="verdict-tag">สรุปคำแนะนำ</span>
      <strong>${escapeHtml(first.name)}</strong>
    </div>
    <div class="verdict-detail tabular">${escapeHtml(detail)}</div>
  `;
}

function renderPriorityBar() {
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    const active = btn.dataset.priority === currentSession.priority_mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", active ? "true" : "false");
  });
}

function renderDrawerLists() {
  const presetList = el("preset-list");
  presetList.innerHTML = presets
    .map(
      (p) => `
      <button type="button" class="nav-item ${
        currentSession.comparison_session_id === p.comparison_session_id ? "active" : ""
      }" data-preset-id="${escapeHtml(p.comparison_session_id)}">
        <span>${escapeHtml(p.title)}</span>
      </button>`
    )
    .join("");

  presetList.querySelectorAll("[data-preset-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const found = presets.find((p) => p.comparison_session_id === btn.dataset.presetId);
      if (found) {
        currentSession = structuredClone(found);
        closeDrawer();
        renderAll();
      }
    });
  });

  const saved = loadSavedSessions();
  const savedList = el("saved-list");
  if (!saved.length) {
    savedList.innerHTML = `<p style="font-size:12px;color:var(--ink-muted);margin:4px 0">ยังไม่มีรายการที่บันทึก</p>`;
    return;
  }

  savedList.innerHTML = saved
    .map(
      (s) => `
      <div class="nav-item ${
        currentSession.comparison_session_id === s.comparison_session_id ? "active" : ""
      }">
        <button type="button" data-load-id="${escapeHtml(s.comparison_session_id)}" style="flex:1;text-align:left;background:none;border:none;font:inherit;color:inherit;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0">
          ${escapeHtml(s.title)} (${s.products.length})
        </button>
        <button type="button" data-del-id="${escapeHtml(s.comparison_session_id)}" class="btn btn-sm" style="border:none;color:var(--terracotta);padding:2px 6px" aria-label="ลบเซสชัน">ลบ</button>
      </div>`
    )
    .join("");

  savedList.querySelectorAll("[data-load-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const found = saved.find((s) => s.comparison_session_id === btn.dataset.loadId);
      if (found) {
        currentSession = structuredClone(found);
        closeDrawer();
        renderAll();
      }
    });
  });

  savedList.querySelectorAll("[data-del-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteSessionFromStorage(btn.dataset.delId);
      renderDrawerLists();
    });
  });
}

function renderMatrix() {
  el("session-title").value = currentSession.title;
  el("product-count-label").textContent = `สินค้า ${currentSession.products.length} / 5 รายการ`;
  el("btn-add-product").disabled = currentSession.products.length >= 5;
  renderPriorityBar();

  const products = currentSession.products;
  renderVerdictBanner(products, currentSession.priority_mode, currentSession.currency);

  const container = el("matrix-container");
  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>ยังไม่มีสินค้าในตารางเปรียบเทียบ</h3>
        <p>เพิ่มสินค้าอย่างน้อย 2 รายการเพื่อเริ่มคำนวณต้นทุนจริง หรือเลือกชุดตัวอย่างจากคลังเปรียบเทียบ</p>
        <button id="empty-add-btn" type="button" class="btn btn-primary">+ เพิ่มสินค้ารายการแรก</button>
      </div>`;
    el("empty-add-btn")?.addEventListener("click", () => openModal(null));
    return;
  }

  const ranked = sortProductsByPriority(products, currentSession.priority_mode);
  const winnerId = ranked[0]?.product_id || null;
  const allSpecKeys = Array.from(
    new Set(products.flatMap((p) => Object.keys(p.technical_specs?.key_parameters || {})))
  );
  const maxTco5 = Math.max(...products.map((p) => p.tco_analysis.tco_5_years), 1);

  container.innerHTML = `
    <div class="matrix-wrap">
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="row-corner">หัวข้อการวิเคราะห์</th>
            ${products
              .map((p) => {
                const isWinner = p.product_id === winnerId;
                return `
                  <th class="${isWinner ? "winner-col" : ""}" style="min-width:240px">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                      <div>
                        ${
                          isWinner
                            ? `<div class="winner-label">${ICONS.award} คุ้มค่าที่สุดตามเกณฑ์</div>`
                            : ""
                        }
                        <div class="product-title">${escapeHtml(p.name)}</div>
                        ${
                          p.source_url
                            ? `<a href="${escapeHtml(p.source_url)}" target="_blank" rel="noreferrer" class="product-link">เปิดหน้าสินค้า</a>`
                            : ""
                        }
                      </div>
                      <div style="display:flex;gap:4px;flex-shrink:0">
                        <button type="button" class="btn btn-sm" data-edit-prod="${escapeHtml(p.product_id)}">แก้ไข</button>
                        <button type="button" class="btn btn-sm" style="color:var(--terracotta)" data-del-prod="${escapeHtml(
                          p.product_id
                        )}">ลบ</button>
                      </div>
                    </div>
                  </th>`;
              })
              .join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="row-label">ยอดจ่ายเงินสดสุทธิ<div class="row-sub">เทียบราคากลาง 90 วันและคูปอง</div></td>
            ${products
              .map((p) => {
                const disc = p.pricing.real_discount_percentage;
                const isOver = disc < 0;
                return `
                  <td class="${p.product_id === winnerId ? "winner-col" : ""}">
                    <div class="price-big tabular">${formatMoney(p.pricing.net_cash_payable, currentSession.currency)}</div>
                    <div class="price-sub tabular">
                      <span style="text-decoration:line-through">ป้าย ${formatMoney(
                        p.pricing.listed_price,
                        currentSession.currency
                      )}</span>
                      · กลาง 90 วัน ${formatMoney(p.pricing.median_price_90d, currentSession.currency)}
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">
                      <span class="pill tabular ${isOver ? "pill-warn" : "pill-good"}">
                        ${isOver ? ICONS.warn : ""} ส่วนลดจริง ${disc > 0 ? `-${disc}%` : `${disc}%`}
                      </span>
                      ${
                        p.pricing.cashback_received > 0
                          ? `<span class="pill pill-neutral tabular">เครดิตเงินคืน ${formatMoney(
                              p.pricing.cashback_received,
                              currentSession.currency
                            )}</span>`
                          : ""
                      }
                    </div>
                    ${
                      p.pricing.applied_coupons.length
                        ? `<ul class="coupon-list tabular">${p.pricing.applied_coupons
                            .map(
                              (c) =>
                                `<li><span>${escapeHtml(c.coupon_name)}</span><strong>-${formatMoney(
                                  c.discount_value,
                                  currentSession.currency
                                )}${c.discount_type === "CASHBACK" ? " (คืน)" : ""}</strong></li>`
                            )
                            .join("")}</ul>`
                        : ""
                    }
                  </td>`;
              })
              .join("")}
          </tr>

          <tr>
            <td class="row-label">ต้นทุนต่อหน่วยสารสำคัญ<div class="row-sub">True Unit Cost</div></td>
            ${products
              .map(
                (p) => `
                <td class="${p.product_id === winnerId ? "winner-col" : ""}">
                  <div class="tabular" style="font-size:18px;font-weight:800;color:var(--ink-primary)">
                    ${formatMoney(p.unit_economics.true_unit_cost, currentSession.currency)}
                    <span style="font-size:12px;font-weight:500;color:var(--ink-muted)">/ ${escapeHtml(
                      p.unit_economics.standardized_unit
                    )}</span>
                  </div>
                  <div class="tabular" style="font-size:12px;color:var(--ink-muted);margin-top:4px">
                    ปริมาณ ${p.unit_economics.standardized_quantity.toLocaleString("th-TH")} ${escapeHtml(
                  p.unit_economics.standardized_unit
                )} · ความเข้มข้น ${(p.unit_economics.active_ingredient_ratio * 100).toFixed(0)}%
                  </div>
                </td>`
              )
              .join("")}
          </tr>

          <tr>
            <td class="row-label">ต้นทุนรวมตลอดอายุ (TCO)<div class="row-sub">ค่าเครื่อง + ค่าไฟ + อะไหล่</div></td>
            ${products
              .map((p) => {
                const tco = p.tco_analysis;
                if (!tco.is_applicable) {
                  return `<td class="${p.product_id === winnerId ? "winner-col" : ""}" style="color:var(--ink-muted);font-size:12px">ไม่มีค่าไฟหรืออะไหล่แฝง</td>`;
                }
                const pct = Math.min(100, Math.round((tco.tco_5_years / maxTco5) * 100));
                return `
                  <td class="${p.product_id === winnerId ? "winner-col" : ""}">
                    <div class="tco-row tabular"><span>1 ปี</span><strong>${formatMoney(tco.tco_1_year, currentSession.currency)}</strong></div>
                    <div class="tco-row tabular"><span>3 ปี</span><strong>${formatMoney(tco.tco_3_years, currentSession.currency)}</strong></div>
                    <div class="tco-row tabular" style="color:var(--terracotta)"><span>5 ปี</span><strong>${formatMoney(tco.tco_5_years, currentSession.currency)}</strong></div>
                    <div class="tco-bar-bg"><div class="tco-bar-fill" style="width:${pct}%"></div></div>
                    <div class="tabular" style="font-size:11px;color:var(--ink-muted)">
                      ค่าไฟ ${formatMoney(tco.annual_energy_cost, currentSession.currency)}/ปี · อะไหล่ ${formatMoney(
                  tco.annual_consumable_cost,
                  currentSession.currency
                )}/ปี
                    </div>
                  </td>`;
              })
              .join("")}
          </tr>

          <tr>
            <td class="row-label">สเปกทางเทคนิค<div class="row-sub">เฉพาะค่าพารามิเตอร์ยืนยันได้</div></td>
            ${products
              .map(
                (p) => `
                <td class="${p.product_id === winnerId ? "winner-col" : ""}">
                  ${
                    allSpecKeys.length
                      ? allSpecKeys
                          .map(
                            (k) => `
                            <div class="spec-row">
                              <span style="color:var(--ink-muted)">${escapeHtml(k)}</span>
                              <strong class="tabular">${escapeHtml(
                                p.technical_specs?.key_parameters?.[k] ?? "ไม่พบข้อมูลยืนยัน"
                              )}</strong>
                            </div>`
                          )
                          .join("")
                      : `<span style="color:var(--ink-muted);font-size:12px">ไม่พบข้อมูลยืนยัน</span>`
                  }
                </td>`
              )
              .join("")}
          </tr>

          <tr>
            <td class="row-label">วิเคราะห์รีวิวที่ยืนยันตัวตน<div class="row-sub">สั่งซื้อจริง + รูป/วิดีโอ + ใช้งาน ≥14 วัน</div></td>
            ${products
              .map((p) => {
                const rev = p.verified_review_insights;
                return `
                  <td class="${p.product_id === winnerId ? "winner-col" : ""}">
                    <div class="tabular" style="font-size:12px;color:var(--ink-muted);margin-bottom:8px">
                      ผ่านเกณฑ์คัดกรอง: <strong style="color:var(--ink-primary)">${rev.total_filtered_reviews}</strong> รีวิว
                    </div>
                    ${
                      rev.recurring_defects.length
                        ? rev.recurring_defects
                            .map(
                              (d) =>
                                `<div class="defect-item">${ICONS.warn}<span>${escapeHtml(
                                  d.issue
                                )} <strong class="tabular">(${d.frequency_count} ครั้ง)</strong></span></div>`
                            )
                            .join("")
                        : `<div style="font-size:12px;color:var(--ink-muted)">ไม่พบจุดบกพร่องซ้ำซากที่ยืนยัน</div>`
                    }
                    ${rev.verified_strengths
                      .map(
                        (s) =>
                          `<div class="strength-item">${ICONS.check}<span>${escapeHtml(s)}</span></div>`
                      )
                      .join("")}
                  </td>`;
              })
              .join("")}
          </tr>
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll("[data-edit-prod]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prod = currentSession.products.find((p) => p.product_id === btn.dataset.editProd);
      if (prod) openModal(prod);
    });
  });

  container.querySelectorAll("[data-del-prod]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSession.products = currentSession.products.filter(
        (p) => p.product_id !== btn.dataset.delProd
      );
      renderMatrix();
    });
  });
}

function renderAll() {
  renderDrawerLists();
  renderMatrix();
}

// --- Drawer Logic ---
function openDrawer() {
  el("history-drawer").classList.remove("hidden");
  el("drawer-backdrop").classList.remove("hidden");
  el("btn-toggle-drawer").setAttribute("aria-expanded", "true");
  el("btn-close-drawer").focus();
}

function closeDrawer() {
  el("history-drawer").classList.add("hidden");
  el("drawer-backdrop").classList.add("hidden");
  el("btn-toggle-drawer").setAttribute("aria-expanded", "false");
  el("btn-toggle-drawer").focus();
}

el("btn-toggle-drawer").addEventListener("click", openDrawer);
el("btn-close-drawer").addEventListener("click", closeDrawer);
el("drawer-backdrop").addEventListener("click", closeDrawer);

// --- Modal Logic ---
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("hidden", p.dataset.panel !== tabName);
  });
}

function renderCouponRows() {
  const wrap = el("coupon-rows");
  wrap.innerHTML = modalCoupons
    .map(
      (c, i) => `
      <div class="card-box">
        <div style="display:flex;gap:8px">
          <input type="text" value="${escapeHtml(c.coupon_name)}" data-c-idx="${i}" data-c-key="coupon_name" style="flex:1" placeholder="ชื่อคูปอง" />
          <button type="button" class="btn btn-sm" style="color:var(--terracotta)" data-c-del="${i}">ลบ</button>
        </div>
        <div class="grid-3">
          <select data-c-idx="${i}" data-c-key="category">
            <option value="SHOP" ${c.category === "SHOP" ? "selected" : ""}>ร้านค้า (SHOP)</option>
            <option value="PLATFORM" ${c.category === "PLATFORM" ? "selected" : ""}>แพลตฟอร์ม</option>
            <option value="CREDIT_CARD" ${c.category === "CREDIT_CARD" ? "selected" : ""}>บัตรเครดิต</option>
            <option value="CASHBACK_COIN" ${c.category === "CASHBACK_COIN" ? "selected" : ""}>เครดิตเงินคืน</option>
          </select>
          <select data-c-idx="${i}" data-c-key="discount_type">
            <option value="CASH_DISCOUNT" ${c.discount_type === "CASH_DISCOUNT" ? "selected" : ""}>ส่วนลดเงินสด</option>
            <option value="CASHBACK" ${c.discount_type === "CASHBACK" ? "selected" : ""}>Cashback</option>
          </select>
          <select data-c-idx="${i}" data-c-key="value_mode">
            <option value="FIXED" ${c.value_mode === "FIXED" ? "selected" : ""}>ลดคงที่ (บาท)</option>
            <option value="PERCENT" ${c.value_mode === "PERCENT" ? "selected" : ""}>ลดเป็น %</option>
          </select>
        </div>
        <div class="grid-3">
          <input type="number" value="${c.value}" data-c-idx="${i}" data-c-key="value" placeholder="มูลค่า" />
          <input type="number" value="${c.min_spend}" data-c-idx="${i}" data-c-key="min_spend" placeholder="ขั้นต่ำ" />
          <input type="number" value="${c.max_cap ?? ""}" data-c-idx="${i}" data-c-key="max_cap" placeholder="ลดสูงสุด" />
        </div>
      </div>`
    )
    .join("");

  wrap.querySelectorAll("[data-c-idx]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const idx = Number(inp.dataset.cIdx);
      const key = inp.dataset.cKey;
      if (key === "value" || key === "min_spend") {
        modalCoupons[idx][key] = Number(inp.value) || 0;
      } else if (key === "max_cap") {
        modalCoupons[idx][key] = inp.value === "" ? null : Number(inp.value);
      } else {
        modalCoupons[idx][key] = inp.value;
      }
    });
  });

  wrap.querySelectorAll("[data-c-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalCoupons.splice(Number(btn.dataset.cDel), 1);
      renderCouponRows();
    });
  });
}

function renderConsumableRows() {
  const wrap = el("consumable-rows");
  wrap.innerHTML = modalConsumables
    .map(
      (c, i) => `
      <div class="grid-3">
        <input type="text" value="${escapeHtml(c.name)}" data-con-idx="${i}" data-con-key="name" placeholder="ชื่ออะไหล่" />
        <input type="number" value="${c.price}" data-con-idx="${i}" data-con-key="price" placeholder="ราคา (บาท)" />
        <div style="display:flex;gap:6px">
          <input type="number" min="1" value="${c.replace_interval_months}" data-con-idx="${i}" data-con-key="replace_interval_months" title="เปลี่ยนทุกกี่เดือน" />
          <button type="button" class="btn btn-sm" style="color:var(--terracotta)" data-con-del="${i}">ลบ</button>
        </div>
      </div>`
    )
    .join("");

  wrap.querySelectorAll("[data-con-idx]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const idx = Number(inp.dataset.conIdx);
      const key = inp.dataset.conKey;
      modalConsumables[idx][key] = key === "name" ? inp.value : Number(inp.value) || 0;
    });
  });

  wrap.querySelectorAll("[data-con-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalConsumables.splice(Number(btn.dataset.conDel), 1);
      renderConsumableRows();
    });
  });
}

function openModal(product = null) {
  editingProductId = product ? product.product_id : null;
  el("modal-title").textContent = product ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าเข้าตารางเปรียบเทียบ";
  el("f-name").value = product?.name || "";
  el("f-url").value = product?.source_url || "";
  el("f-listed").value = product?.pricing.listed_price ?? 1000;
  el("f-median").value = product?.pricing.median_price_90d ?? 1000;
  el("f-qty").value = product?.unit_economics.raw_quantity ?? 1;
  el("f-unit").value = product?.unit_economics.raw_unit || "pcs";
  el("f-ratio").value = Math.round((product?.unit_economics.active_ingredient_ratio ?? 1) * 100);

  const tcoOn = Boolean(product?.tco_analysis.is_applicable);
  el("f-tco-enabled").checked = tcoOn;
  el("tco-fields").style.display = tcoOn ? "flex" : "none";

  modalCoupons = product
    ? product.pricing.applied_coupons.map((c) => ({
        coupon_name: c.coupon_name,
        category: c.discount_type === "CASHBACK" ? "CASHBACK_COIN" : "PLATFORM",
        discount_type: c.discount_type,
        value_mode: "FIXED",
        value: c.discount_value,
        min_spend: 0,
        max_cap: null,
        stackable: true,
        conditions: c.conditions || "",
      }))
    : [];
  modalConsumables = [];
  extractedSpecs = product?.technical_specs || { key_parameters: {} };
  extractedReviews = product?.verified_review_insights || {
    total_filtered_reviews: 0,
    recurring_defects: [],
    verified_strengths: [],
  };

  el("f-specs-text").value = Object.entries(extractedSpecs.key_parameters || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  el("f-reviews-text").value = "";
  el("extract-status").textContent = "";

  renderCouponRows();
  renderConsumableRows();
  switchTab("PRICING");
  el("product-modal").classList.remove("hidden");
  el("f-name").focus();
}

function closeModal() {
  el("product-modal").classList.add("hidden");
}

// --- Event Bindings ---
document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentSession.priority_mode = btn.dataset.priority;
    renderMatrix();
  });
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

el("f-tco-enabled").addEventListener("change", (e) => {
  el("tco-fields").style.display = e.target.checked ? "flex" : "none";
});

el("btn-add-coupon").addEventListener("click", () => {
  modalCoupons.push({
    coupon_name: `คูปอง ${modalCoupons.length + 1}`,
    category: "PLATFORM",
    discount_type: "CASH_DISCOUNT",
    value_mode: "FIXED",
    value: 100,
    min_spend: 0,
    max_cap: null,
    stackable: false,
    conditions: "",
  });
  renderCouponRows();
});

el("btn-add-consumable").addEventListener("click", () => {
  modalConsumables.push({ name: "ไส้กรอง", price: 790, replace_interval_months: 6 });
  renderConsumableRows();
});

el("btn-extract-ai").addEventListener("click", async () => {
  el("extract-status").textContent = "กำลังสกัดข้อมูล...";
  const res = await extractSpecsAndReviews(
    el("f-specs-text").value,
    el("f-reviews-text").value,
    el("f-gemini-key").value
  );
  extractedSpecs = res.technical_specs;
  extractedReviews = res.verified_review_insights;
  el("extract-status").textContent = `สกัดสำเร็จ (${res.mode})${
    res.warnings.length ? ` · ${res.warnings[0]}` : ""
  }`;
});

el("product-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const specsMap = { ...(extractedSpecs.key_parameters || {}) };
  for (const line of el("f-specs-text").value.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && v) specsMap[k] = v;
    }
  }

  const product = analyzeProduct({
    product_id: editingProductId || `prod-${Date.now()}`,
    name: el("f-name").value.trim(),
    source_url: el("f-url").value.trim(),
    listed_price: Number(el("f-listed").value) || 0,
    median_price_90d: Number(el("f-median").value) || 0,
    coupons: modalCoupons,
    unit_input: {
      raw_quantity: Number(el("f-qty").value) || 1,
      raw_unit: el("f-unit").value,
      active_ingredient_ratio: (Number(el("f-ratio").value) || 100) / 100,
    },
    tco_input: {
      is_applicable: el("f-tco-enabled").checked,
      watt: Number(el("f-watt").value) || 0,
      hours_per_day: Number(el("f-hours").value) || 0,
      electricity_rate_per_kwh: Number(el("f-rate").value) || 4.5,
      consumables: modalConsumables,
    },
    technical_specs: { key_parameters: specsMap },
    verified_review_insights: extractedReviews,
  });

  const idx = currentSession.products.findIndex((p) => p.product_id === product.product_id);
  if (idx >= 0) currentSession.products[idx] = product;
  else currentSession.products.push(product);

  closeModal();
  renderMatrix();
});

el("btn-add-product").addEventListener("click", () => openModal(null));
el("btn-close-modal").addEventListener("click", closeModal);
el("btn-cancel-modal").addEventListener("click", closeModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!el("product-modal").classList.contains("hidden")) closeModal();
    if (!el("history-drawer").classList.contains("hidden")) closeDrawer();
  }
});

el("session-title").addEventListener("input", (e) => {
  currentSession.title = e.target.value;
});

el("btn-new-session").addEventListener("click", () => {
  currentSession = {
    comparison_session_id: `session-${Date.now()}`,
    title: "การเปรียบเทียบสินค้าใหม่",
    currency: "THB",
    priority_mode: "NET_CASH",
    products: [],
  };
  closeDrawer();
  renderAll();
});

el("btn-save-session").addEventListener("click", () => {
  if (currentSession.comparison_session_id.startsWith("preset-")) {
    currentSession.comparison_session_id = `session-${Date.now()}`;
  }
  currentSession = saveSessionToStorage(currentSession);
  renderDrawerLists();
  showToast("บันทึกเซสชันลงเบราว์เซอร์เรียบร้อยแล้ว");
});

el("btn-export-json").addEventListener("click", () => exportSessionJson(currentSession));

el("input-import-json").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.products)) throw new Error("Invalid schema");
    currentSession = parsed;
    renderAll();
    showToast("นำเข้าข้อมูล JSON สำเร็จ");
  } catch {
    showToast("ไฟล์ JSON ไม่ถูกต้องตามโครงสร้าง");
  }
  e.target.value = "";
});

renderAll();
