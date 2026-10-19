/**
 * 预设清洗：把宿主已经不再接受的配置项从 agent.cordis.yml 里摘掉。
 *
 * 0.2.1-rc.2 的 @deepseek-ai/dsh-tool-subagent 见到 `persona` / `toolFilter` 会直接
 * throw（提示改用 Agent Preset + agentPreset），整份预设注册失败 → 子代理那一路全废。
 * 旧版随包预设里写过 toolFilter，用户机器上还留着副本，所以既要改模板也要能就地自愈。
 */

/** 摘掉所有 `toolFilter:` 块（含其缩进更深的子行），返回新文本。 */
export function stripSubagentToolFilter(text) {
  let next = String(text || '')
  let changed = false
  for (;;) {
    const head = /\n([ \t]+)toolFilter:[^\n]*\r?\n/.exec(next)
    if (!head) break
    const indent = head[1].length
    let end = head.index + head[0].length
    while (end < next.length) {
      const nl = next.indexOf('\n', end)
      const line = next.slice(end, nl < 0 ? next.length : nl)
      if (line.trim() === '') break
      if (/^[ \t]*/.exec(line)[0].length <= indent) break
      end = nl < 0 ? next.length : nl + 1
    }
    next = next.slice(0, head.index) + '\n' + next.slice(end)
    changed = true
  }
  return { text: next.replace(/\n{3,}/g, '\n\n'), changed }
}
