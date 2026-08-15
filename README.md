# dsh-ui-hub

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://github.com/Han-1413141/dsh-ui-hub/actions/workflows/test.yml/badge.svg)](https://github.com/Han-1413141/dsh-ui-hub/actions/workflows/test.yml)
[English](README.en.md) | 中文

DSH Web 客户端插件：**UI 管家**。把页面上每个插件贡献的每个 UI（面板、按钮、图标、图表、输入框……）都枚举出来，支持**逐个开关、逐个定位、碰撞避让和一键美观排布**，专治插件一多之后的互相遮挡、挤成一团。

![宣传图：dsh-ui-hub UI 管家](docs/assets/promo-hero.webp)

## ✨ 功能

| 功能 | 说明 |
|---|---|
| 🔍 全量发现 | 枚举平台每个 `[data-slot]` 插槽里的插件 UI，以及脱离插槽的浮动控件（如 dsh-sticky-disclosure 的按钮、dsh-mingli-chart 的悬浮图）；不认识的新控件可用「拾取元素」点击捕获 |
| 🗂️ 官方 / 插件分区 | 面板顶层分成「官方 UI」与「插件 UI」两个类别（每个条目也带官方/插件标签），一眼分清平台自带的界面和第三方插件塞进来的界面 |
| 📁 分组折叠 | 类别与插槽组两级折叠，**默认全部折叠**，只显示类别和组名+数量，逐级展开才出现条目，界面干净易观察；展开状态自动记忆 |
| 🎚️ 精确到单个 UI | 每个 UI 根节点独立开关；再往下可展开到**内部元素**——按钮 / 图标 / 图表 / 输入框，逐个显示或隐藏 |
| 📐 三种位置模式 | **默认**（恢复原样）、**微调**（translate 平移，不脱离原布局）、**浮动**（fixed 定位，x/y 精确坐标） |
| 🖱️ 直接拖拽 | 面板点「拖拽模式」后：**直接拖动任意 UI 改变位置**（插槽内 UI 用平移保持布局与弹层跟随，漂浮控件用固定坐标），拖动元素**右下角手柄改变大小**；Esc 退出编辑 |
| 🛡️ 碰撞避让 | 三档：关闭（只报告）/ 智能（明显重叠才让位）/ 严格（任何重叠都让位）；锁定某项后只挤别人、不挤它 |
| ✨ 一键自动排布 | 以会话滚动区为锚点，把所有浮动 UI 沿右缘排成对齐的纵向列，自动换列、留白一致 |
| 💾 持久化 | 所有开关、位置、大小与折叠状态保存在浏览器 `localStorage`，刷新/重开会话后自动恢复 |
| 🧹 无侵入可还原 | 不修改任何插件代码；只给 DOM 加 `data-uihub-*` 标记 + 自己的 `!important` 样式。关闭/卸载插件即逐元素还原 |

## 为什么需要它

DSH 是插件生态，每个插件都会往页面塞一点 UI：会话标题栏按钮、输入区下方的徽章、侧边栏底部卡片、右下角浮动药丸、悬浮图表……插件之间互不知道对方在哪，**重叠是常态**。UI 管家给这些 UI 建立一份统一的「花名册 + 排班表」：

1. 自动发现所有 UI，按插槽分组列出来；
2. 每个 UI 都能关、能挪、能锁定；
3. 浮动控件互相重叠时自动让位；
4. 一键排布，把散落的控件整理成整齐的一列。

## 📸 界面与功能展示

完整图文说明见 **[docs/GALLERY.md](docs/GALLERY.md)**。

**30 秒演示：默认折叠 → 展开官方 UI → 展开分组 → 拖拽模式**

![演示动画](docs/assets/demo.gif)

| 界面 | 文字说明 |
|---|---|
| ![默认面板](docs/assets/feature-panel-collapsed.png) | 面板默认只显示「官方 UI / 插件 UI」两个折叠类别，干净不刷屏 |
| ![官方 UI 展开](docs/assets/feature-official-expanded.png) | 展开官方 UI：按插槽分组，组默认仍折叠 |
| ![组内条目](docs/assets/feature-official-group-expanded.png) | 展开某组：逐条开关、官方标签、位置模式、`⋯` 内部元素 |
| ![拖拽模式](docs/assets/feature-drag.png) | 拖拽模式：虚线框直接拖动移动，右下角手柄改大小，Esc 退出 |

## 使用

1. 安装后重启 `dsh web`，页面**右上角**出现「UI 管家」胶囊按钮（快捷键 `Ctrl+Shift+U` / macOS `⌘⇧U`），点击打开管理面板；
2. 面板顶层是**「官方 UI」/「插件 UI」两个折叠类别**（默认全部折叠，只显示类别与数量），点击类别展开其下按插槽分组的组名，再点击组名展开该组的 UI 条目；
3. 条目行：左边开关立即显示/隐藏，右侧 `⋯` 展开详情；
4. 详情里：
   - **位置模式**：默认 / 微调 / 浮动；
   - 浮动模式填 **X/Y**，微调模式填 **水平/垂直偏移**；
   - **拖拽移动**：元素右上角出现抓手，直接拖；
   - **锁定位置**：碰撞避让时不移动它；
   - **内部元素**：按钮、图标、图表、输入框逐个开关；
5. 顶部工具条：
   - **拖拽模式**：开启后**直接拖任意 UI 移动位置，拖右下角手柄改变大小**，Esc 退出；
   - **自动排布**：把所有浮动 UI 沿会话区右缘排成对齐的列；
   - **拾取元素**：点击页面上任意元素（哪怕插件没做任何标记）纳入管理；
   - **恢复全部默认**：清空全部开关、位置与大小。

### 编程接口

```js
window.dshUiHub.items()                 // [{ key, label, plugin, category, slot, on, mode, x, y, sw, sh, children: [...] }]
window.dshUiHub.setConfig(key, { on: false })            // 隐藏某个 UI
window.dshUiHub.setConfig(key, { mode: "float", x: 300, y: 200 })
window.dshUiHub.setConfig(key, { sw: 360, sh: 240 })     // 设置宽高
window.dshUiHub.setConfig("child:...", { on: false })    // 隐藏某个内部按钮/图标
window.dshUiHub.arrange()               // 一键自动排布
window.dshUiHub.collisionMode("strict") // off | smart | strict
window.dshUiHub.dragMode(true)          // 开启/关闭直接拖拽模式
window.dshUiHub.open() / close() / reset()
```

## 行为细节

- **身份稳定**：插槽 UI 以 `slot:<插槽名>@<序号>` 为身份，跨 React 重渲染自动重新挂接；浮动控件以 `data-*` 标记（如 `data-sticky-disclosure-control`）为身份；拾取的元素以结构路径哈希为身份。
- **不用 style 打架**：定位通过 `data-uihub-float` + CSS 变量 + `!important` 规则实现，其他插件写 inline `left/top`（非 important）无法覆盖管家设置的位置；去掉标记即恢复插件自己的样式。
- **卸载还原**：插件 dispose 时删除全部 `data-uihub-*` 标记、CSS 变量、样式表和自己的 UI 元素。
- **直接拖拽**：拖拽模式只在开启期间拦截指针；**插槽里的 UI 拖拽用「平移」**（保留在原布局内，点击弹出层会跟着走），脱离插槽的浮动控件拖拽用「浮动」坐标；拖右下角手柄改宽高（浮动模式改浮层大小，默认/微调模式原地固定宽高）。拖拽结束不会给原按钮补发一次 click，普通单击仍原样传给插件；「重置此项」可恢复原样，Esc 退出编辑。
- **浮动弹层跟随**：显式设成「浮动」的 UI 若点击后弹出层仍出现在原位置，插件会用独立的 CSS `translate` 把弹层平移到 UI 的新位置（只作用于锚定在原位置的弹层，居中的整页对话框不受影响）。
- **锁定的项目不动**：自动排布与碰撞避让都跳过锁定项，并把其他项绕开它。
- **避让不会无限循环**：观察器只对结构/托管元素样式变化触发重算，写 CSS 变量前先比较当前值，收敛后不再写。
- 面板/抓手 z-index 为 80/86，高于插件浮动层、低于应用弹窗层（100+），不会盖住权限与设置弹窗。

## 安装

> 需求：Node.js ≥ 20 + DeepSeek Harness（带 `dsh plugin` 命令的版本）。插件随 `dsh web` 启动。

### 方式〇：一键安装（推荐）

```powershell
irm https://raw.githubusercontent.com/Han-1413141/dsh-ui-hub/main/install.ps1 | iex
```

### 方式一：命令行

```bash
dsh plugin --profile web add github:Han-1413141/dsh-ui-hub
```

### 方式二：本地开发（符号链接）

在本仓库**父目录**执行：

```bash
dsh plugin --profile web add link:./dsh-ui-hub
```

改 `lib/client.js` 后刷新页面即生效。卸载：`dsh plugin --profile web remove dsh-ui-hub`。

## 测试

```bash
python test/verify.py   # Playwright chromium,无外部依赖(仅本机 Python + playwright)
```

`test/mock.html` 复刻了平台的 `[data-slot]` 锚点契约、多个插槽贡献与两个互相重叠的浮动控件；`test/verify.py` 覆盖发现、官方/插件分类、默认折叠与逐级展开、根/子元素开关、浮动定位、自动排布对齐、严格避让、面板、热键、拾取、直接拖拽移动与拖拽改大小、刷新持久化与卸载还原。

## 已知限制

- **浮动模式的坐标系**：使用 `position:fixed`。若某个 UI 的祖先元素带 CSS `transform`，fixed 会相对该祖先定位；这类 UI 建议用「微调」模式。
- **平台 DOM 变更**：发现依赖平台公开的 `[data-slot]` 锚点与各插件的 `data-*` 标记；平台升级后若改名，对应条目会按新身份重新出现（旧配置仍保留在本地）。
- **子元素身份**：内部元素按 DOM 顺序编号，插件重排子元素后配置可能跟随序号落到相邻元素上。
- **插槽内不强制重排**：默认/微调模式尊重原插槽布局；跨插槽的「整页重排」请把条目切到浮动后用「自动排布」。
