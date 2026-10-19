/**
 * 0.2.1-rc.2 的 agent-loop 只注册 provider / model 两个插值变量，`{{cwd}}` 不再由宿主提供；
 * 工作目录改由 working-directory:current 上下文下发。用户自己的提示词、旧配置或预设里
 * 只要还留着 `{{cwd}}`，renderPrompt 就会抛 unknown prompt variable，整轮运行失败。
 *
 * 这里按宿主当前工作目录把 `cwd` 变量补回去：拿得到 session 用该 session 的目录，
 * 拿不到（子代理首次装配 / 无会话）用宿主的 defaultDirectory。宿主已经注册过就什么都不做。
 */
export function installCwdPromptVariable(ctx) {
  return ctx.inject(["systemPrompt", "workingDirectory"], (host) => {
    try {
      host.systemPrompt.variable("cwd", ({ agent }) => agent
        ? host.workingDirectory.get(agent.session)
        : host.workingDirectory.defaultDirectory);
    } catch (error) {
      // 老宿主或别的插件已经占了这个变量名，不算错误。
      if (!/^prompt variable "cwd" is already registered(?: \(| in this scope$|$)/.test(String(error?.message || ""))) {
        throw error;
      }
    }
  });
}
