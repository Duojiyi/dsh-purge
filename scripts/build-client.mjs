/**
 * 把 lib/redteam/client.js 抽成可嵌入的工厂片段，
 * 写进 client.js 里的 DSH_PURGE_DRILL 标记之间。
 *
 * 用法：
 *   node scripts/build-client.mjs              # 正常重建
 *   DSH_PURGE_ALLOW_CLIENT_DRIFT=1 node ...     # 明确接受把产物回退到源码版本
 *
 * 重建会**整段覆盖** client.js 里的演练台区间。如果仓库里的产物比 lib/redteam/client.js 新
 * （有人在产物上直接改过），直接重建就会静默丢掉那些改动，所以默认先比一次漂移。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { BEGIN, END, buildDrillFragment } from "./drill-fragment.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clientPath = join(root, "client.js");

if (process.env.DSH_PURGE_ALLOW_CLIENT_DRIFT !== "1") {
	const drift = spawnSync(process.execPath, [join(root, "scripts", "check-client-drift.mjs")], {
		cwd: root,
		encoding: "utf8",
	});
	const out = `${drift.stdout || ""}${drift.stderr || ""}`;
	if (out.includes("drifted")) {
		process.stdout.write(out);
		console.error(
			"\n重建已中止：产物里的演练台比源码新，重建会把这些改动丢掉。\n"
			+ "处理办法：把 client.js 标记区间里的改动反抽回 lib/redteam/client.js 后再跑；\n"
			+ "确认要放弃产物改动时，用 DSH_PURGE_ALLOW_CLIENT_DRIFT=1 重跑。",
		);
		process.exit(1);
	}
}

const fragment = buildDrillFragment();

let client = readFileSync(clientPath, "utf8");
if (!client.includes(BEGIN) || !client.includes(END)) {
	throw new Error("client.js missing drill markers; run patch-client-dock.mjs first");
}
// client.js 在仓库里是 CRLF；用原文件的换行形态写回，避免整文件 diff。
const hadCrlf = client.includes("\r\n");
const beginAt = client.indexOf(BEGIN);
const endAt = client.indexOf(END);
if (beginAt < 0 || endAt < 0 || endAt < beginAt) throw new Error("drill markers out of order");
client = client.slice(0, beginAt) + fragment + client.slice(endAt + END.length);
if (hadCrlf) client = client.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
writeFileSync(clientPath, client);
console.log("embedded drill client into client.js (" + Buffer.byteLength(fragment) + " bytes fragment)");
