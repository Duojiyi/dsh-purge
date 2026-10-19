import assert from "node:assert/strict";
import test from "node:test";
import { ALL_PATCHES, patchStatus } from "../lib/core.js";

/**
 * 宿主契约测试：给一个**未清洗**的 @deepseek-ai 插件根，逐条跑补丁判定，
 * 要求非可选补丁没有 skipped / missing_file。宿主小版本升级后锚点漂移会在这里先炸，
 * 而不是等用户点「安装」才发现有补丁落不下去。
 *
 *   DSH_VERIFY_AI_BASE="C:\\path\\to\\node_modules\\@deepseek-ai" node --test test/
 */
const aiBase = process.env.DSH_VERIFY_AI_BASE;

test("补丁锚点与目标宿主对齐", { skip: aiBase ? false : "未设置 DSH_VERIFY_AI_BASE，跳过宿主契约检查" }, async () => {
  const status = await patchStatus(aiBase, ALL_PATCHES);
  const bad = ALL_PATCHES.filter((patch) => {
    if (patch.optional) return false;
    const s = status[patch.id];
    return s === "skipped" || s === "missing_file";
  }).map((patch) => `[#${patch.id}] ${patch.name} -> ${status[patch.id]}`);
  assert.deepEqual(bad, [], `这些补丁对不上宿主原文：\n${bad.join("\n")}`);
});
