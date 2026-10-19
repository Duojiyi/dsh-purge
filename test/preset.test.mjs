import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { stripSubagentToolFilter } from "../lib/redteam/preset-sanitize.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const preset = readFileSync(join(root, "presets", "redteam", "agent.cordis.yml"), "utf8");

test("随包红队预设不再带 toolFilter（0.2.1 会让预设注册失败）", () => {
  assert.ok(!/^[ \t]*toolFilter:/m.test(preset), "agent.cordis.yml 里不能再出现 toolFilter");
  assert.match(preset, /maxDepth: 1/, "叶子约束改由 maxDepth 承担，不能被一起删掉");
});

test("stripSubagentToolFilter：摘掉整块，保留同级兄弟行", () => {
  const text = [
    "      config:",
    "        provider: spawn",
    "        maxDepth: 1",
    "        toolFilter:",
    "          deny:",
    "            - subagent_fork",
    "            - workflow",
    "            - ralph",
    "",
    "    - id: tool-subagent-fork",
  ].join("\n");
  const out = stripSubagentToolFilter(text);
  assert.equal(out.changed, true);
  assert.ok(!out.text.includes("toolFilter"));
  assert.ok(!out.text.includes("subagent_fork"));
  assert.ok(out.text.includes("maxDepth: 1"));
  assert.ok(out.text.includes("- id: tool-subagent-fork"));
});

test("stripSubagentToolFilter：没有可摘的东西就不改", () => {
  const text = "      config:\n        provider: fork\n";
  const out = stripSubagentToolFilter(text);
  assert.equal(out.changed, false);
  assert.equal(out.text, text);
});
