#!/usr/bin/env node
/**
 * 产物漂移守卫：client.js 里内嵌的演练台片段，应该等于用 lib/redteam/client.js 重建出来的片段。
 *
 *   node scripts/check-client-drift.mjs            # 只报告，退出码 0
 *   node scripts/check-client-drift.mjs --strict   # 有漂移就退出 1（CI / 发版前用）
 *
 * 为什么要它：`npm run build:client` 会整段重写 client.js 的 BEGIN/END 区间。
 * 如果产物比源码新（有人在产物上直接改过），重建就会静默把功能降级回旧版。
 * 这个脚本把「产物 ≠ 源码」变成一条看得见的命令；build-client 也会先跑它。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDrillFragment, embeddedDrillFragment } from "./drill-fragment.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");

function norm(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

const want = norm(buildDrillFragment());
const have = norm(embeddedDrillFragment(readFileSync(join(root, "client.js"), "utf8")));
if (have === null) {
  console.error("client.js 里没有演练台标记区间，先跑 patch-client-dock.mjs");
  process.exit(strict ? 1 : 0);
}

if (want === have) {
  console.log("client.js 内嵌演练台与 lib/redteam/client.js 一致 / embedded drill matches source");
  process.exit(0);
}

const wantLines = want.split("\n");
const haveLines = have.split("\n");
let firstDiff = 0;
while (firstDiff < wantLines.length && firstDiff < haveLines.length && wantLines[firstDiff] === haveLines[firstDiff]) {
  firstDiff += 1;
}
console.log(`client.js 内嵌演练台与源码不一致 / embedded drill drifted (第 ${firstDiff + 1} 行起)`);
console.log(`  源码重建: ${wantLines.length} 行`);
console.log(`  仓库产物: ${haveLines.length} 行`);
console.log(`  源码: ${String(wantLines[firstDiff] || "(EOF)").slice(0, 160)}`);
console.log(`  产物: ${String(haveLines[firstDiff] || "(EOF)").slice(0, 160)}`);
console.log("\n处理：把产物的改动反抽回 lib/redteam/client.js，或接受降级后 DSH_PURGE_ALLOW_CLIENT_DRIFT=1 重建。");
process.exit(strict ? 1 : 0);
