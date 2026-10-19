import assert from "node:assert/strict";
import test from "node:test";
import {
  assemblyHasCwdContext,
  cwdOfContext,
  cwdSuffixText,
  fillCwdPlaceholders,
  rewritePromptAssembly,
} from "../lib/identity.js";

function buildAssembly(contexts) {
  return {
    sections: [
      { name: "harness:identity", text: "You are an AI agent powered by DeepSeek Harness." },
      {
        name: "deployment:persona-prefix",
        text:
          "You are a coding agent powered by the {{model}} model, running on the DeepSeek Harness. " +
          "Your working directory is {{cwd}}.",
      },
      { name: "deployment:persona-suffix", text: "Your working directory is {{cwd}}.", order: 10200 },
      { name: "agent-instructions:workspace", text: "Follow the workspace rules." },
    ],
    contexts: contexts || [],
    tools: [],
  };
}

const INJECT = "# 破甲注入\n\n正文两行，带 {{cwd}} 占位符也不能把宿主搞崩。";

test("0.2.1：装配结果里不残留 {{cwd}}，官方身份句被抹掉", () => {
  const out = rewritePromptAssembly(buildAssembly([
    { name: "working-directory:current", text: "Current working directory: D:\\proj", interpolate: false },
  ]), {
    fallbackInject: INJECT,
    context: { agent: { session: { header: { cwd: "D:\\proj" } } } },
  });
  const flat = out.sections.map((section) => String(section?.text || "")).join("\n");
  assert.ok(!flat.includes("{{cwd}}"), "不能把 {{cwd}} 留给宿主渲染");
  assert.ok(!flat.includes("DeepSeek Harness"),
    "官方身份句应被抹掉");
  assert.ok(flat.includes("正文两行"), "注入正文必须还在");
});

test("0.2.0：有 cwd 上下文时不再重复写工作目录句", () => {
  const out = rewritePromptAssembly(buildAssembly([
    { name: "working-directory:current", text: "Current working directory: D:\\proj" },
  ]), {
    fallbackInject: INJECT,
    context: { agent: { session: { header: { cwd: "D:\\proj" } } } },
  });
  const suffix = out.sections.find((section) => String(section?.name || "").includes("persona-suffix"));
  assert.equal(String(suffix?.text || ""), "");
});

test("没有 cwd 上下文时用真实路径补后缀", () => {
  const out = rewritePromptAssembly(buildAssembly([]), {
    fallbackInject: INJECT,
    context: { agent: { session: { header: { cwd: "D:\\proj" } } } },
  });
  const suffix = out.sections.find((section) => String(section?.name || "").includes("persona-suffix"));
  assert.match(String(suffix?.text || ""), /D:\\proj/);
  assert.ok(!String(suffix?.text || "").includes("{{cwd}}"));
});

test("拿不到 cwd 时也不留占位符", () => {
  const out = rewritePromptAssembly(buildAssembly([]), { fallbackInject: INJECT, context: {} });
  const flat = out.sections.map((section) => String(section?.text || "")).join("\n");
  assert.ok(!flat.includes("{{cwd}}"));
});

test("cwd 工具函数", () => {
  assert.equal(cwdSuffixText("D:\\a"), "Your working directory is D:\\a.");
  assert.equal(cwdSuffixText(""), "");
  assert.equal(cwdOfContext({ agent: { session: { header: { cwd: " D:\\b " } } } }), "D:\\b");
  assert.equal(cwdOfContext(null), "");
  assert.equal(assemblyHasCwdContext([{ name: "working-directory:current" }]), true);
  assert.equal(assemblyHasCwdContext([{ name: "workspace" }]), false);
  assert.deepEqual(fillCwdPlaceholders([{ name: "x", text: "dir={{cwd}}" }], "C:\\w"), [
    { name: "x", text: "dir=C:\\w" },
  ]);
  assert.equal(fillCwdPlaceholders([{ name: "x", text: "{{cwd}}" }], "")[0].text, "the current directory");
});
