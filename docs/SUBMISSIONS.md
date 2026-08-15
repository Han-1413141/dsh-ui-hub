# 社区收录申请记录 / Submission Log

本文件记录 dsh-ui-hub 向各知名 DSH 插件仓库提交的收录申请、已满足的要求与当前状态。

| 仓库 | PR | 状态 | 说明 |
|---|---|---|---|
| [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | [#566](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/566) | OPEN · CI ✅ | 已在中英文 README 的 UI Enhancements 各加一行；仓库已启用 `dsh-plugin` topic；修复了 CRLF 导致的站点构建失败 |
| [dshworks/awesome-dsh-plugins](https://github.com/dshworks/awesome-dsh-plugins) | [#35](https://github.com/dshworks/awesome-dsh-plugins/pull/35) | OPEN · 无 CI 上报 | 已在 `data/plugins.json` 添加条目；`validate.mjs` + `render.mjs` 通过；README/lists 已重新生成 |
| [kejixiaoliang/awesome-dsh-plugins](https://github.com/kejixiaoliang/awesome-dsh-plugins) | [#15](https://github.com/kejixiaoliang/awesome-dsh-plugins/pull/15) | OPEN · 无 CI 上报 | 已在 `plugins/ui-themes.md` 添加条目；`README.md` / `README.zh.md` / `INDEX.md` 已重新生成；校验通过 |

## 已完成的贡献要求

- **awesome-dsh-plugin**
  - 在 `README.md`（英文）与 `README.zh.md`（中文）的 `UI Enhancements` 分类各增加一行：
    `- [Han-1413141/dsh-ui-hub](...) - UI butler for every plugin UI: ...`
  - 为 dsh-ui-hub 仓库启用 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic。
  - 保持 README 使用 LF 换行，确保上游 `build-site.mjs` 能正常解析。
- **dshworks/awesome-dsh-plugins**
  - 在 `data/plugins.json` 的 `plugins` 数组追加结构化条目：
    - `category: plugin`
    - `tags: ["ui"]`
    - `verifiedAgainst: 0.1.0-rc.6`
    - `lastVerified: 2026-08-15`
    - `status: verified`
  - 运行 `node scripts/validate.mjs` 与 `node scripts/render.mjs` 并提交生成文件。
- **kejixiaoliang/awesome-dsh-plugins**
  - 在 `plugins/ui-themes.md` 的「界面增强 / 面板」分类增加条目。
  - 重新生成 `README.md` / `README.zh.md` / `INDEX.md`。
  - 运行其生成/校验脚本通过。

## 宣传物料

- 首图：`docs/assets/whale-girl.png`（鲸鱼娘，AI 生成）
- UI 管家面板中英双版本：`docs/assets/screenshot-panel-zh.png` / `docs/assets/screenshot-panel-en.png`
- 官方 UI 展开中英双版本：`docs/assets/screenshot-official-expanded-zh.png` / `-en.png`
- 官方分组展开中英双版本：`docs/assets/screenshot-official-group-expanded-zh.png` / `-en.png`
- 演示动画：`docs/assets/demo.gif`
- 完整图文：`docs/GALLERY.md`，宣传文案：`docs/PROMO.md`

## 说明

- 若维护者反馈格式/字段需要调整，可按对应仓库的 CONTRIBUTING 提交 follow-up PR。
- 当前 dsh-ui-hub 尚未发布到 npm，因此安装命令使用 `dsh plugin --profile web add github:Han-1413141/dsh-ui-hub`。
