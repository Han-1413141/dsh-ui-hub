# dsh-ui-hub 宣传文案 / Promo copy

> 素材位置:`docs/assets/`
> - 首图(鲸鱼娘):按 `assets/whale-girl-prompt.md` 生成后存为 `assets/whale-girl.png`
> - 主宣传图(已生成):`assets/promo-hero.png` / `assets/promo-hero.webp`
> - 社交卡片(已生成):`assets/promo-social.png` / `assets/promo-social.webp`
> - 工作流程图(已生成):`assets/architecture.png`
> - 实机截图(已生成):`assets/screenshot-launcher.png` / `assets/screenshot-panel-collapsed.png` / `assets/screenshot-official-expanded.png` / `assets/screenshot-official-group-expanded.png` / `assets/screenshot-drag.png`

## 中文主文案

**一句话**
DeepSeek Harness Web 插件 **dsh-ui-hub「UI 管家」**:把每个插件贡献的每个 UI 都登记造册——按钮、图标、图表逐个开关、逐个定位,浮动控件碰撞自动避让,一键排成整齐队列。

**短文案(适合 V2EX / 知乎 / 微信群)**

DSH 插件越装越多,会话标题栏、输入区下方、侧边栏底部、右下角全都长出了按钮、卡片和图表——插件之间互不知道对方在哪,重叠挡字是常态。我写了个 Web 客户端插件 [dsh-ui-hub](https://github.com/Han-1413141/dsh-ui-hub),专治这个:

- 🗂️ 面板分成「官方 UI / 插件 UI」两类,两级折叠、默认全收起,一眼看清谁是谁;
- 🎚️ 精确到单个 UI:按钮、图标、图表、输入框逐个开关,配置持久保存;
- 🖱️ 打开「拖拽模式」直接拖任意 UI 移动,拖右下角手柄改大小;拖完不误触,弹层跟着走;
- 🛡️ 浮动控件重叠自动让位(关闭/智能/严格三档),锁定项稳如泰山;
- ✨ 一键自动排布:右缘对齐、等距留白,散落控件瞬间整队;
- ⚡ 一行安装:`dsh plugin --profile web add github:Han-1413141/dsh-ui-hub`

**配图**
首图用鲸鱼娘插画(生成提示词见 `docs/assets/whale-girl-prompt.md`);配文用 `assets/promo-hero.webp`。

---

## English copy

**One-liner**
**dsh-ui-hub — UI Hub** for DeepSeek Harness Web: registers every UI every plugin adds — toggle each button/icon/chart, position each one, auto-separate overlapping floats, and arrange them into a tidy column.

**Short post**

The more DSH plugins you install, the more buttons, badges and charts pile up in the header, composer dock, sidebar footer and corners — and plugins never know about each other's geometry. I made [dsh-ui-hub](https://github.com/Han-1413141/dsh-ui-hub):

- 🗂️ Panel split into **Official UI / Plugin UI**, two-level collapsible groups, all collapsed by default;
- 🎚️ Per-widget switches — down to individual buttons, icons, charts and fields, persisted locally;
- 🖱️ Drag mode: drag any UI to move it, drag the bottom-right grip to resize; no accidental clicks, popups follow;
- 🛡️ Collision avoidance (off / smart / strict) with per-item locks;
- ✨ One-click auto arrange into right-aligned, evenly-spaced columns;
- ⚡ Install: `dsh plugin --profile web add github:Han-1413141/dsh-ui-hub`

**Attach**
Whale-girl cover (prompt in `docs/assets/whale-girl-prompt.md`) or `assets/promo-hero.webp`.

---

## 各渠道微调建议

- **V2EX / 知乎**:用中文短文案,先讲“插件 UI 互相遮挡”的痛点,再列功能,最后给一行安装命令;配 `promo-hero.webp`。
- **X / Twitter 中文线程**:第 1 条放鲸鱼娘首图 + “给 DSH 装了个 UI 管家”;第 2 条放 `feature-panel-collapsed.png` 讲官方/插件分区与默认折叠;第 3 条放 `feature-official-expanded.png` + `feature-official-group-expanded.png` 讲逐条开关;第 4 条放 `feature-drag.png` 讲拖拽移动/改大小;第 5 条放 `demo.gif` + 仓库与安装命令。
- **X / Twitter English thread**:同结构,用 English copy,配图依次为 whale-girl → `feature-panel-collapsed.png` → `feature-official-group-expanded.png` → `feature-drag.png` → `demo.gif`。
- **Reddit**:标题 `I made a DSH plugin that manages every plugin's UI: per-widget toggles, drag-to-move, collision avoidance and auto-arrange`;正文先讲痛点,再列功能,结尾放仓库与 `promo-hero.webp`。
- **HelloGitHub / 阮一峰周刊**:项目介绍补一句“官方 UI 与插件 UI 分区管理,支持逐个开关、拖拽定位、碰撞避让与一键自动排布”,附图用 `demo.gif`。

## 素材清单

| 用途 | 文件 |
|---|---|
| 首图(待 AI 生成,提示词已备好) | `assets/whale-girl-prompt.md` → `assets/whale-girl.png` |
| README / 中文主宣传图 | `assets/promo-hero.png` / `assets/promo-hero.webp` |
| 社交卡片 | `assets/promo-social.png` / `assets/promo-social.webp` |
| 30 秒功能演示 GIF | `assets/demo.gif` |
| 默认折叠面板(带标注) | `assets/feature-panel-collapsed.png` |
| 官方 UI 展开(带标注) | `assets/feature-official-expanded.png` |
| 官方组条目展开(带标注) | `assets/feature-official-group-expanded.png` |
| 拖拽模式(带标注) | `assets/feature-drag.png` |
| 无标注原始截图 | `assets/screenshot-*.png` |
| 工作流程架构图 | `assets/architecture.png` |
| 界面图文说明 | `GALLERY.md` |
