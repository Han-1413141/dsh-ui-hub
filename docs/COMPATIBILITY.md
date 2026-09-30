# Compatibility / 兼容性

Checked on 2026-09-30 against **DSH 0.2.0-rc.2**, the npm `latest` release and installed Windows Desktop runtime at the time of verification.

| 检查 / Check | 结果 / Result |
|---|---|
| 本机 Windows Desktop 内置 DSH 0.2.0-rc.2 | 真实 Cordis 宿主激活、客户端模块图、带 revision 的资源响应均通过 |
| 桌面端内置 CLI 与 pnpm | 在独立 `DSH_HOME` 的 `desktop`、`web` 配置中安装本地插件通过；未改动日常配置 |
| 浏览器行为 | 原有回归用例及新增功能用例通过 |
| Desktop DOM 标记 | Chromium 中模拟 `win32` / `darwin`、标题栏、快捷键和 `no-drag` 样式的回归通过 |
| 完整桌面窗口端到端交互 | 未执行；macOS 原生窗口与系统菜单未实机验证 |

Desktop reuses the Web frontend and `dsh.client.platform: "web"` contract. Its installation profile is **desktop**. Changing the client declaration to `desktop` would prevent discovery by the shared module registry.

桌面端继续使用 `platform: "web"` 的客户端声明，安装目标使用 `--profile desktop`。当前版可直接从侧栏插件页安装和启用，无需额外安装 Node/pnpm。CLI 管理桌面插件时，先完全退出桌面应用。

The host now serves revisioned combo URLs (`plugins/??…&rev=…`). Tests use the real runtime registry to obtain this URL; they do not assume the legacy `/plugins/<id>/client.js` route. Restart the host after local bundle edits when HMR has not notified it of the rebuild, then reload the client.

These results describe the version above, not a guarantee for future DOM changes. `test/runtime-smoke.mjs` accepts the installed runtime's package-resolution root as its first argument. `test/verify_compat.py` explicitly emulates Desktop markers rather than launching Electron.

Source references:

- [0.2.0-rc.2 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)
- [Desktop runtime and plugin installation](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/README.zh.md)
- [Client module contract](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/subsystems/client-modules.zh.md)
- [DisclosureRow](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/client/ui-primitives/src/DisclosureRow.tsx)
- [TurnProcessNodeView](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/client/ui-chat/src/client/chat/TurnProcessNodeView.tsx)
