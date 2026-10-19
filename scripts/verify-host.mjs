#!/usr/bin/env node
/**
 * 宿主兼容性自检：对一个未清洗的 @deepseek-ai 插件根逐条跑补丁判定，不改任何文件。
 *
 *   node scripts/verify-host.mjs <aiBase>
 *
 * 判读：
 *   pending      = 原文对得上，正常安装会改（锚点还在）
 *   applied      = 已清洗过（哈希/标记命中）
 *   skipped      = 文件在，但这份原文对不上 → 锚点漂移，需要适配
 *   missing_file = 目标文件不存在（宿主换包或删包）
 *   na           = 该宿主面不适用 / 可选补丁没有目标
 *
 * 退出码：有 skipped / missing_file（且非 optional）时为 1，便于 CI 拦。
 */
import { ALL_PATCHES, patchStatus } from "../lib/core.js";

const base = process.argv[2];
if (!base) {
  console.error("usage: node scripts/verify-host.mjs <aiBase>");
  process.exit(2);
}

const status = await patchStatus(base, ALL_PATCHES);
const rows = ALL_PATCHES.map((p) => ({ p, s: status[p.id] ?? "unknown" }));
const by = (name) => rows.filter((r) => r.s === name);

const width = Math.max(...rows.map((r) => r.p.name.length));
console.log(`host: ${base}`);
for (const { p, s } of rows) {
  const mark = s === "applied" ? "✓" : s === "pending" ? "→" : s === "skipped" ? "⚠" : s === "missing_file" ? "✗" : "·";
  console.log(`  ${mark} [#${String(p.id).padEnd(2)}] ${p.name.padEnd(width)} ${s}`);
}

const hard = rows.filter((r) => (r.s === "skipped" || r.s === "missing_file") && !r.p.optional);
const counts = ["applied", "pending", "skipped", "missing_file", "na"]
  .map((n) => `${n}=${by(n).length}`)
  .join(" ");
console.log(`\n${counts}`);
if (hard.length) {
  console.log(`\n需要适配 / needs adaptation (${hard.length}):`);
  for (const { p, s } of hard) console.log(`  [#${p.id}] ${p.name} — ${s} (${p.desc || ""})`);
  process.exit(1);
}
console.log("\n全部补丁与本宿主对齐 / all patches aligned");
