/**
 * 演练台内嵌片段的唯一生成入口。
 *
 * build-client.mjs 用它写进 client.js，check-client-drift.mjs 用它和产物比对，
 * 两边共用同一份逻辑，才不会出现「守卫说一致、重建出来却不一样」。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const drillSrc = join(root, "lib", "redteam", "client.js");

export const BEGIN = "/* __DSH_PURGE_DRILL_BEGIN__ */";
export const END = "/* __DSH_PURGE_DRILL_END__ */";

export function buildDrillFragment() {
  let raw = readFileSync(drillSrc, "utf8").replace(/\r\n/g, "\n");
  const startMark = "factory: (require) => {";
  const start = raw.indexOf(startMark);
  if (start < 0) throw new Error("cannot find ModuleLoader factory in drill client");
  const endMark = "\n    return module.exports\n  },\n})";
  const end = raw.lastIndexOf(endMark);
  if (end < 0) throw new Error("cannot find factory end in drill client");
  let body = raw.slice(start + startMark.length, end);

  // 去掉末尾 exports（return 已在 endMark 外）
  body = body
    .replace(/\n\s*exports\.apply\s*=\s*apply\s*\n/, "\n")
    .replace(/\n\s*exports\.inject\s*=\s*inject\s*\n/, "\n");

  // 替换 apply(ctx)：不再自己注册槽位，只导出 Panel / CSS / 状态
  const applyAt = body.lastIndexOf("function apply(ctx) {");
  if (applyAt < 0) throw new Error("apply(ctx) not found in drill client");
  // apply() 本体没有嵌套函数花括号冲突到 CSS（CSS 在前面），用括号深度即可
  let d = 0;
  let j = body.indexOf("{", applyAt);
  for (; j < body.length; j += 1) {
    const ch = body[j];
    if (ch === "{") d += 1;
    else if (ch === "}") {
      d -= 1;
      if (d === 0) {
        j += 1;
        break;
      }
    }
  }
  const applyParts = `function applyDrillParts() {
      return { CSS: CSS, Panel: Panel, setUI: setUI, useUI: useUI, isFullWindow: isFullWindow, setDockWidth: setDockWidth };
    }
`;
  body = body.slice(0, applyAt) + applyParts + body.slice(j);

  return `${BEGIN}
		// 内嵌演练台（源码在 lib/redteam，已并进本插件）
		const __dshPurgeDrill = (() => {
			var module = { exports: {} };
			var exports = module.exports;
${body}
			return applyDrillParts();
		})();
${END}`;
}

export function embeddedDrillFragment(clientText) {
  const client = String(clientText || "").replace(/\r\n/g, "\n");
  const beginAt = client.indexOf(BEGIN);
  const endAt = client.indexOf(END);
  if (beginAt < 0 || endAt < beginAt) return null;
  return client.slice(beginAt, endAt + END.length);
}
