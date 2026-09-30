/**
 * dsh-ui-hub — browser half (v0.1).
 *
 * A layout butler for every plugin UI in the DSH web client. It never changes
 * how plugins render: it only discovers their DOM, then drives three additive
 * attributes (`data-uihub-off`, `data-uihub-nudge`, `data-uihub-float`) whose
 * effect comes entirely from this bundle's own `!important` stylesheet rules.
 * Inline `left/top` writes from other plugins therefore cannot override an
 * enforced position (their non-important inline styles lose to our important
 * rules), and removing the attributes restores the original layout bit-for-bit.
 *
 * Discovery model:
 *   - slot roots: each visible element child of every `[data-slot]` anchor
 *     (the addressable seam of the platform slot renderer), keyed by
 *     `slot:<slot>@<index>`;
 *   - loose roots: body-level floating widgets and elements carrying known
 *     plugin `data-*` markers, keyed by their marker or body index;
 *   - picked roots: anything the user picks with the click-to-capture mode,
 *     keyed by a structural CSS-path hash;
 *   - children: fine-grained leaves inside a root (buttons, icons, charts,
 *     fields) with independent on/off and translate nudges.
 *
 * The floating panel (right side) lists every discovered UI, per item: switch,
 * position mode (default / nudge / float), x/y (or dx/dy), lock, drag handle,
 * child list. Global controls: collision avoidance (off / smart / strict),
 * one-click auto arrange (right-edge columns anchored to the conversation
 * scrollport), pick mode, reset. Settings persist in localStorage; the whole
 * bundle is dependency-free like dsh-sticky-disclosure.
 */

// The handoff contract of the web boot protocol: register this bundle's module
// under its package name (must equal the graph row / entry options.name).
window.__ModuleLoader__.load({
  id: "dsh-ui-hub",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    //#region dsh-ui-hub client

    const PACKAGE_ID = "dsh-ui-hub";
    const PLUGIN_NAME = "ui-hub";
    const PLUGIN_VERSION = "0.1.0";
    const STORAGE_KEY = "dsh-ui-hub:layout:v1";
    const STYLE_ID = "dsh-ui-hub/client.css";
    const GAP = 12;
    const MARGIN = 16;
    const FLOAT_Z_DEFAULT = 25;
    const LAUNCH_Z = 80;
    const PANEL_Z = 85;
    const HANDLE_Z = 86;
    const HOTKEY = { ctrl: true, meta: false, alt: false, shift: true, code: "KeyU" };
    /** Discovery results are reused for this long before the next DOM scan. */
    const DISCOVER_MS = 320;

    /** dataset key prefixes that mark a third-party plugin widget. */
    const MARKER_PREFIXES = [
      "stickyDisclosure", "dshMingli", "mingli", "dshTaskboard", "taskboard",
      "dshSsh", "ssh", "cm", "costMeter", "dshLiveStats", "liveStats",
      "skinCenter", "gitGraph", "aion", "modlens", "modsearch", "notif",
      "notification", "plugin", "pet", "demo",
    ];

    /** dataset prefix -> human plugin name (best-effort attribution). */
    const MARKER_PLUGINS = {
      stickyDisclosure: "dsh-sticky-disclosure",
      dshMingli: "dsh-mingli-chart",
      mingli: "dsh-mingli-chart",
      cm: "dsh-cost-meter",
      costMeter: "dsh-cost-meter",
      dshTaskboard: "dsh-web-ui-all",
      taskboard: "dsh-web-ui-all",
      dshSsh: "dsh-web-ui-all",
      ssh: "dsh-web-ui-all",
      aion: "dsh-web-ui-all (aionui)",
      modlens: "@liustack/modlens",
      modsearch: "@liustack/modsearch",
      notif: "dsh-notification",
      notification: "dsh-notification",
      dshLiveStats: "dsh-web-ui-all",
      liveStats: "dsh-web-ui-all",
      pet: "dsh-web-ui-all (pet)",
      plugin: "",
    };

    /** class-token prefix -> human plugin name. */
    const CLASS_PLUGINS = [
      ["cm-", "dsh-cost-meter"],
      ["dshSd_", "dsh-sticky-disclosure"],
      ["mgl", "dsh-mingli-chart"],
      ["uw-Msq", "dsh-web-ui-all"],
      ["modsearch", "@liustack/modsearch"],
      ["modlens", "@liustack/modlens"],
    ];

    const SLOT_GROUPS = {
      root: "应用外壳",
      sidebar: "侧边栏",
      conversation: "会话区",
      "conversation.session.header.actions": "会话标题栏操作",
      "conversation.session.header.utilities": "会话标题栏工具",
      "conversation.composer.dock": "输入区下方",
      "conversation.composer.bar": "输入栏",
      "conversation.input.dock": "输入区侧栏",
      "conversation.input.model": "模型选择",
      "sidebar.footer.action": "侧边栏底部",
      "sidebar.settings": "侧边栏设置",
      "sidebar.workspaces": "侧边栏工作区",
      settings: "设置区",
      details: "详情栏",
      "shell.overlay": "全局浮层",
    };

    /** Platform shell slots are never third-party UI; the root frame is unmanaged. */
    const SHELL_SLOTS = { root: true, sidebar: true, conversation: true };

    const MESSAGES = {
      zh: {
        title: "UI 管家",
        subtitle: "开关、定位、避让与自动排布",
        arrange: "自动排布",
        pick: "拾取元素",
        refresh: "刷新",
        reset: "恢复全部默认",
        close: "关闭",
        dragMode: "拖拽模式",
        dragHint: "拖拽模式:直接拖动任意 UI 移动位置,拖动右下角手柄调整大小,按 Esc 退出",
        catOfficial: "官方 UI",
        catPlugin: "插件 UI",
        collision: "碰撞避让",
        collisionOff: "关闭(只报告)",
        collisionSmart: "智能(明显重叠才让位)",
        collisionStrict: "严格(任何重叠都让位)",
        all: "全部",
        hidden: "隐藏",
        overlaps: "重叠",
        rootOn: "显示",
        rootOff: "隐藏",
        mode: "位置模式",
        modeDefault: "默认",
        modeNudge: "微调",
        modeFloat: "浮动",
        xLabel: "X",
        yLabel: "Y",
        dxLabel: "水平偏移",
        dyLabel: "垂直偏移",
        lock: "锁定位置(避让时不动)",
        dragMove: "拖拽移动",
        dragStop: "完成",
        resetItem: "重置此项",
        children: "内部元素",
        noItems: "暂未发现可管理的 UI。打开会话、展开工具卡片或点击「拾取元素」捕获任意 UI。",
        groupDefault: "浮动控件",
        groupPick: "自选元素",
        pickHint: "拾取模式:点击页面上的任意按钮 / 图标 / 图表即可纳入管理,按 Esc 退出。",
        arranged: "已自动排布 {n} 个浮动 UI",
        arrangedNone: "没有可排布的浮动 UI(请先把条目设为「浮动」)",
        resetDone: "已恢复全部默认布局",
        moved: "已移动 {n} 个重叠 UI",
        hiddenCount: "{n} 个已隐藏",
        overlapCount: "{n} 处重叠",
        kindButton: "按钮",
        kindIcon: "图标",
        kindChart: "图表",
        kindField: "输入框",
        kindOther: "元素",
        kindRoot: "界面",
        launch: "UI 管家(开关 / 定位 / 自动排布)",
        toastSaved: "已保存",
        slot: "插槽",
        search: "搜索控件名称、插件或插槽",
        noMatches: "没有匹配的控件，试试其他关键词。",
        export: "导出布局",
        import: "导入布局",
        imported: "已恢复布局",
        importFailed: "导入失败：请选择 UI 管家导出的有效布局文件。",
      },
      en: {
        title: "UI Hub",
        subtitle: "Toggle, position, avoid, arrange",
        arrange: "Auto arrange",
        pick: "Pick element",
        refresh: "Refresh",
        reset: "Reset all",
        close: "Close",
        dragMode: "Drag mode",
        dragHint: "Drag mode: drag any UI to move it, drag its corner handle to resize, Esc to exit",
        catOfficial: "Official UI",
        catPlugin: "Plugin UI",
        collision: "Collision",
        collisionOff: "Off (report only)",
        collisionSmart: "Smart (clear overlaps)",
        collisionStrict: "Strict (any overlap)",
        all: "All",
        hidden: "Hidden",
        overlaps: "Overlaps",
        rootOn: "Show",
        rootOff: "Hide",
        mode: "Position mode",
        modeDefault: "Default",
        modeNudge: "Nudge",
        modeFloat: "Float",
        xLabel: "X",
        yLabel: "Y",
        dxLabel: "DX",
        dyLabel: "DY",
        lock: "Lock (skip avoidance)",
        dragMove: "Drag to move",
        dragStop: "Done",
        resetItem: "Reset item",
        children: "Inner elements",
        noItems: "No manageable UI found yet. Open a session, expand tool cards, or use Pick element.",
        groupDefault: "Floating widgets",
        groupPick: "Picked elements",
        pickHint: "Pick mode: click any button / icon / chart to manage it. Esc to exit.",
        arranged: "Arranged {n} floating UIs",
        arrangedNone: "No float-mode UIs to arrange (set items to Float first)",
        resetDone: "Layout reset to defaults",
        moved: "Moved {n} overlapping UIs",
        hiddenCount: "{n} hidden",
        overlapCount: "{n} overlaps",
        kindButton: "Button",
        kindIcon: "Icon",
        kindChart: "Chart",
        kindField: "Field",
        kindOther: "Element",
        kindRoot: "UI",
        launch: "UI Hub (toggle / position / auto arrange)",
        toastSaved: "Saved",
        slot: "Slot",
        search: "Search controls, plugins or slots",
        noMatches: "No matching controls. Try another keyword.",
        export: "Export layout",
        import: "Import layout",
        imported: "Layout restored",
        importFailed: "Import failed: choose a valid layout exported by UI Hub.",
      },
    };

    function locale() {
      try {
        const lang = document.documentElement.lang || navigator.language || "zh";
        return String(lang).toLowerCase().startsWith("en") ? "en" : "zh";
      } catch (_) {
        return "zh";
      }
    }

    function t(code, vars) {
      const dict = MESSAGES[locale()] || MESSAGES.zh;
      let text = dict[code] !== undefined ? dict[code] : code;
      if (vars !== undefined) {
        for (const key of Object.keys(vars)) text = text.split("{" + key + "}").join(String(vars[key]));
      }
      return text;
    }

    // ── stylesheet ──────────────────────────────────────────────────────────

    /** Read the plugin's own CSS into the document once (HMR-safe style record). */
    function installStyles() {
      if (document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_ID) + "]") !== null) return null;
      const css = [
        "/* dsh-ui-hub: layout management chrome + additive managed-Ui rules */",
        "[data-uihub-ui],[data-uihub-handle],[data-uihub-resize],[data-uihub-float]{-webkit-app-region:no-drag}",
        // The three additive rules are the whole positioning contract.
        '[data-uihub-off]{display:none !important}',
        '[data-uihub-nudge]{transform:translate(var(--uihub-dx,0px),var(--uihub-dy,0px)) !important;transition:transform .16s var(--ds-ease-in-out,ease)}',
        '[data-uihub-float]{position:fixed !important;margin:0 !important;left:var(--uihub-x,16px) !important;top:var(--uihub-y,16px) !important;right:auto !important;bottom:auto !important;',
        "z-index:var(--uihub-z," + FLOAT_Z_DEFAULT + ") !important;width:var(--uihub-w,auto) !important;height:var(--uihub-sh,auto) !important;box-sizing:border-box;",
        "transition:left .16s var(--ds-ease-in-out,ease),top .16s var(--ds-ease-in-out,ease),width .16s var(--ds-ease-in-out,ease),height .16s var(--ds-ease-in-out,ease)}",
        '[data-uihub-size]{width:var(--uihub-sw,auto) !important;height:var(--uihub-sh,auto) !important;box-sizing:border-box;',
        "transition:width .16s var(--ds-ease-in-out,ease),height .16s var(--ds-ease-in-out,ease)}",
        "@media (prefers-reduced-motion:reduce){[data-uihub-nudge],[data-uihub-float]{transition:none !important}}",
        // Launcher.
        ".dshUiHub_launch{position:fixed;z-index:" + LAUNCH_Z + ";display:flex;align-items:center;gap:6px;height:32px;box-sizing:border-box;padding:0 10px 0 8px;",
        "border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:999px;background:var(--dsw-specific-tip,#171a21);color:var(--dsw-alias-label-secondary,#c6c9cf);",
        "box-shadow:var(--dsw-shadow-lv2,0 6px 16px rgba(0,0,0,.3));font:var(--dsw-font-xxs-12,12px/1.4 sans-serif);cursor:grab;user-select:none;touch-action:none}",
        ".dshUiHub_launch:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#eef0f3)}",
        ".dshUiHub_launch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:1px}",
        ".dshUiHub_badge{display:none;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-state-business-primary,#4d6bfe);",
        "color:#fff;font-size:10px;line-height:16px;text-align:center;font-variant-numeric:tabular-nums}",
        ".dshUiHub_launch[data-count]:not([data-count=\"0\"]) .dshUiHub_badge{display:inline-block}",
        // Panel.
        ".dshUiHub_panel{position:fixed;z-index:" + PANEL_Z + ";width:378px;max-width:calc(100vw - 24px);max-height:min(72vh,760px);box-sizing:border-box;display:flex;flex-direction:column;",
        "border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:14px;background:var(--dsw-specific-tip,#171a21);color:var(--dsw-alias-label-secondary,#c6c9cf);",
        "box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.4));font:var(--dsw-font-xxs-12,12px/1.4 sans-serif);overflow:hidden}",
        ".dshUiHub_head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;cursor:grab;user-select:none;touch-action:none;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14))}",
        ".dshUiHub_head:active{cursor:grabbing}",
        ".dshUiHub_title{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-primary,#eef0f3);font-weight:600;font-size:13px}",
        ".dshUiHub_sub{color:var(--dsw-alias-label-tertiary,#8b909a);font-size:11px;margin-top:1px}",
        ".dshUiHub_close{border:none;background:0 0;color:var(--dsw-alias-label-tertiary,#8b909a);cursor:pointer;font-size:14px;line-height:1;padding:4px 6px;border-radius:6px}",
        ".dshUiHub_close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#eef0f3)}",
        ".dshUiHub_toolbar{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px 4px}",
        ".dshUiHub_btn{height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:8px;",
        "background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-secondary,#c6c9cf);font:var(--dsw-font-xxs-12,12px sans-serif);cursor:pointer}",
        ".dshUiHub_btn:hover{color:var(--dsw-alias-label-primary,#eef0f3);background:var(--dsw-alias-bg-layer-2,#1e222b)}",
        ".dshUiHub_btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:1px}",
        ".dshUiHub_btn[data-armed]{background:var(--dsw-alias-state-business-primary,#4d6bfe);color:#fff;border-color:transparent}",
        ".dshUiHub_btn.danger{color:var(--dsw-alias-state-error-primary,#f87171)}",
        ".dshUiHub_global{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14))}",
        ".dshUiHub_globalLabel{color:var(--dsw-alias-label-tertiary,#8b909a);white-space:nowrap}",
        ".dshUiHub_select{font:inherit;color:var(--dsw-alias-label-primary,#eef0f3);background:var(--dsw-alias-bg-layer-2,#1e222b);",
        "border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:8px;height:26px;padding:0 6px;max-width:170px}",
        ".dshUiHub_counts{color:var(--dsw-alias-label-tertiary,#8b909a);font-variant-numeric:tabular-nums;white-space:nowrap}",
        ".dshUiHub_list{flex:1;overflow:auto;padding:8px 12px 14px;scrollbar-width:thin}",
        ".dshUiHub_search{box-sizing:border-box;margin:8px 12px;width:calc(100% - 24px);min-height:30px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l1,#3a3f4a);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#1e222b);color:var(--dsw-alias-label-primary,#eef0f3);font:inherit}",
        ".dshUiHub_search:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe)}",
        ".dshUiHub_group{display:flex;align-items:center;gap:8px;margin:12px 0 6px;color:var(--dsw-alias-label-tertiary,#8b909a)}",
        ".dshUiHub_groupName{font-weight:600;color:var(--dsw-alias-label-secondary,#c6c9cf);font-size:11px;letter-spacing:.02em}",
        ".dshUiHub_groupSlot{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}",
        ".dshUiHub_groupLine{flex:1;height:1px;background:var(--dsw-alias-border-l1,rgba(255,255,255,.14))}",
        // Collapsible categories (官方 / 插件) and groups.
        ".dshUiHub_chev{flex:none;width:10px;height:10px;position:relative;color:var(--dsw-alias-label-tertiary,#8b909a)}",
        ".dshUiHub_chev::before{content:\"\";position:absolute;inset:2px;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(45deg);",
        "transition:transform .14s var(--ds-ease-in-out,ease)}",
        ".dshUiHub_chev[data-open]::before{transform:rotate(135deg)}",
        ".dshUiHub_cat{display:flex;align-items:center;gap:8px;margin:14px 0 8px;padding:7px 8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:10px;cursor:pointer;",
        "background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03));user-select:none}",
        ".dshUiHub_cat:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}",
        ".dshUiHub_catName{font-weight:600;font-size:12px;color:var(--dsw-alias-label-primary,#eef0f3)}",
        ".dshUiHub_catCount{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b909a);font-variant-numeric:tabular-nums}",
        ".dshUiHub_tag{flex:none;font-size:9px;line-height:14px;padding:0 5px;border-radius:999px;font-weight:600}",
        ".dshUiHub_tag.official{color:var(--dsw-alias-state-business-primary,#4d6bfe);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 16%,transparent)}",
        ".dshUiHub_tag.plugin{color:var(--dsw-alias-state-warn-primary,#f0b429);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f0b429) 16%,transparent)}",
        ".dshUiHub_catTag{margin-left:auto}",
        ".dshUiHub_group{cursor:pointer}",
        ".dshUiHub_groupHeader{display:flex;align-items:center;gap:8px;width:100%;min-width:0}",
        // Direct drag mode.
        "body.dshUiHub_dragging{user-select:none !important}",
        "body.dshUiHub_dragging [data-uihub-key]:not([data-uihub-ui]){outline:1px dashed var(--dsw-alias-state-business-primary,#4d6bfe) !important;outline-offset:2px;cursor:move !important}",
        "body.dshUiHub_dragging [data-uihub-child]:not([data-uihub-ui]){outline:1px dotted var(--dsw-alias-state-warn-primary,#f0b429) !important;outline-offset:1px;cursor:move !important}",
        "body.dshUiHub_dragging [data-uihub-ui]{outline:none !important;cursor:default !important}",
        ".dshUiHub_resize{position:fixed;z-index:" + HANDLE_Z + ";width:14px;height:14px;box-sizing:border-box;border:2px solid #fff;border-radius:4px;",
        "background:var(--dsw-alias-state-business-primary,#4d6bfe);cursor:nwse-resize;box-shadow:0 4px 12px rgba(0,0,0,.4);touch-action:none}",
        // Popup follower: an additive `translate` (independent of `transform`)
        // shifts popovers that still open at a floated root's original spot.
        "[data-uihub-follow]{translate:var(--uihub-fdx,0px) var(--uihub-fdy,0px) !important}",
        ".dshUiHub_row{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:10px;margin-bottom:6px;background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03))}",
        ".dshUiHub_row[data-off]{opacity:.52}",
        ".dshUiHub_rowMain{display:flex;align-items:center;gap:8px;padding:7px 8px;min-height:34px;box-sizing:border-box}",
        ".dshUiHub_switch{appearance:none;flex:none;width:32px;height:18px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,#2a2e37);",
        "border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));cursor:pointer;position:relative;transition:background .14s}",
        ".dshUiHub_switch::after{content:\"\";position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:999px;background:var(--dsw-alias-label-tertiary,#8b909a);transition:left .14s}",
        ".dshUiHub_switch:checked{background:var(--dsw-alias-state-business-primary,#4d6bfe);border-color:transparent}",
        ".dshUiHub_switch:checked::after{left:16px;background:#fff}",
        ".dshUiHub_rowText{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}",
        ".dshUiHub_rowLabel{color:var(--dsw-alias-label-primary,#eef0f3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}",
        ".dshUiHub_rowSub{color:var(--dsw-alias-label-tertiary,#8b909a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}",
        ".dshUiHub_modeChip{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#8b909a);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:999px;padding:1px 6px}",
        ".dshUiHub_expand{flex:none;border:none;background:0 0;color:var(--dsw-alias-label-tertiary,#8b909a);cursor:pointer;font-size:12px;padding:2px 6px;border-radius:6px}",
        ".dshUiHub_expand:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#eef0f3)}",
        ".dshUiHub_detail{border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));padding:8px;display:flex;flex-direction:column;gap:8px}",
        ".dshUiHub_detail[hidden]{display:none}",
        ".dshUiHub_modes{display:inline-flex;gap:4px;align-self:flex-start}",
        ".dshUiHub_modeBtn{height:24px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:7px;background:0 0;",
        "color:var(--dsw-alias-label-secondary,#c6c9cf);font:var(--dsw-font-xxs-12,12px sans-serif);cursor:pointer}",
        ".dshUiHub_modeBtn[data-active]{background:var(--dsw-alias-state-business-primary,#4d6bfe);border-color:transparent;color:#fff}",
        ".dshUiHub_fields{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
        ".dshUiHub_field{display:flex;align-items:center;gap:4px;color:var(--dsw-alias-label-tertiary,#8b909a)}",
        ".dshUiHub_field input[type=number]{width:62px;height:24px;box-sizing:border-box;padding:0 6px;font:var(--dsw-font-xxs-12,12px sans-serif);",
        "color:var(--dsw-alias-label-primary,#eef0f3);background:var(--dsw-alias-bg-layer-2,#1e222b);border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:7px}",
        ".dshUiHub_check{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#c6c9cf);cursor:pointer}",
        ".dshUiHub_check input{accent-color:var(--dsw-alias-state-business-primary,#4d6bfe)}",
        ".dshUiHub_child{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));border-radius:8px;padding:4px 8px;margin-bottom:4px;display:flex;align-items:center;gap:8px}",
        ".dshUiHub_child[data-off]{opacity:.5}",
        ".dshUiHub_kind{flex:none;font-size:10px;border-radius:5px;padding:1px 5px;background:var(--dsw-alias-bg-layer-3,#2a2e37);color:var(--dsw-alias-label-tertiary,#8b909a)}",
        ".dshUiHub_kind.icon{color:var(--dsw-alias-state-warn-primary,#f0b429)}",
        ".dshUiHub_kind.chart{color:var(--dsw-alias-state-success-primary,#4ade80)}",
        ".dshUiHub_childText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-secondary,#c6c9cf)}",
        ".dshUiHub_handle{position:fixed;z-index:" + HANDLE_Z + ";width:22px;height:22px;box-sizing:border-box;border:1px solid #fff;border-radius:50%;",
        "background:var(--dsw-alias-state-business-primary,#4d6bfe);color:#fff;font-size:11px;line-height:1;display:grid;place-items:center;cursor:grab;",
        "box-shadow:0 4px 12px rgba(0,0,0,.4);touch-action:none}",
        ".dshUiHub_handle:active{cursor:grabbing}",
        ".dshUiHub_pickbar{position:fixed;z-index:" + (PANEL_Z + 1) + ";left:50%;top:14px;transform:translateX(-50%);max-width:min(680px,calc(100vw - 24px));box-sizing:border-box;",
        "padding:8px 14px;border:1px solid var(--dsw-alias-state-business-primary,#4d6bfe);border-radius:999px;background:var(--dsw-specific-tip,#171a21);",
        "color:var(--dsw-alias-label-primary,#eef0f3);font:var(--dsw-font-xxs-12,12px/1.4 sans-serif);box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.4))}",
        ".dshUiHub_toast{position:fixed;z-index:" + (PANEL_Z + 1) + ";left:50%;bottom:22px;transform:translateX(-50%);padding:7px 14px;border-radius:999px;",
        "background:var(--dsw-alias-bg-inverse,#eef0f3);color:var(--dsw-alias-label-inverse,#101216);font:var(--dsw-font-xxs-12,12px/1.4 sans-serif);",
        "box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.4));pointer-events:none;opacity:0;transition:opacity .2s}",
        ".dshUiHub_toast[data-show]{opacity:1}",
        "body.dshUiHub_picking,body.dshUiHub_picking *{cursor:crosshair !important}",
      ].join("");
      const tag = document.createElement("style");
      tag.dataset.plugin = PACKAGE_ID;
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = css;
      document.head.appendChild(tag);
      return tag;
    }

    // ── small DOM / geometry helpers ────────────────────────────────────────

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function desktopTopInset() {
      const root = document.documentElement;
      if (root.dataset.fullscreen === "true") return 0;
      if (root.dataset.platform === "win32") return parseFloat(getComputedStyle(root).getPropertyValue("--dsh-windows-titlebar-height")) || 40;
      return root.dataset.platform === "darwin" ? 32 : 0;
    }

    function isFiniteNumber(value) {
      return typeof value === "number" && Number.isFinite(value);
    }

    function isOurUI(el) {
      return el instanceof Element && (el.hasAttribute("data-uihub-ui") || el.hasAttribute("data-uihub-handle"));
    }

    function isNativeChrome(el) {
      return el instanceof Element && el.closest("[data-windows-menu],[data-window-controls]") !== null;
    }

    function isManaged(el) {
      return el instanceof Element && el.hasAttribute("data-uihub-key");
    }

    function rectOf(el) {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }

    function visibleRect(el) {
      const r = rectOf(el);
      return r.width > 1 && r.height > 1 ? r : null;
    }

    function overlaps(a, b) {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w <= 0 || h <= 0) return null;
      return { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom), width: w, height: h };
    }

    /** Stable small hash of the structural path of an element (for picked roots). */
    function hashPath(el) {
      let hash = 5381;
      const parts = [];
      let node = el;
      for (let depth = 0; node instanceof Element && depth < 7; depth += 1, node = node.parentElement) {
        let token = node.tagName.toLowerCase();
        if (typeof node.id === "string" && node.id.length > 0) token += "#" + node.id;
        if (typeof node.className === "string" && node.className.length > 0) token += "." + String(node.className).split(/\s+/).slice(0, 3).join(".");
        parts.push(token);
      }
      const text = parts.join(">");
      for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
      return (hash >>> 0).toString(36);
    }

    function firstMarker(el) {
      for (const key of Object.keys(el.dataset)) {
        for (const prefix of MARKER_PREFIXES) {
          if (key === prefix || key.startsWith(prefix)) return key;
        }
      }
      return "";
    }

    function datasetPlugin(el) {
      const marker = firstMarker(el);
      if (marker !== "") {
        for (const prefix of Object.keys(MARKER_PLUGINS)) {
          if (marker === prefix || marker.startsWith(prefix)) return MARKER_PLUGINS[prefix];
        }
      }
      return "";
    }

    function classPlugin(el) {
      const classes = typeof el.className === "string" ? el.className.split(/\s+/) : [];
      for (const token of classes) {
        for (const [prefix, name] of CLASS_PLUGINS) {
          if (token.startsWith(prefix)) return name;
        }
      }
      return "";
    }

    /** Best-effort plugin attribution: the root, then a shallow descendant probe. */
    function pluginGuess(el) {
      let guess = datasetPlugin(el) || classPlugin(el);
      if (guess !== "") return guess;
      const probe = el.querySelectorAll("*");
      for (let i = 0; i < probe.length && i < 60; i += 1) {
        guess = datasetPlugin(probe[i]) || classPlugin(probe[i]);
        if (guess !== "") return guess;
      }
      return "";
    }

    function slotGroupName(slot) {
      if (SLOT_GROUPS[slot] !== undefined) return SLOT_GROUPS[slot];
      const dot = slot.lastIndexOf(".");
      if (dot > 0 && SLOT_GROUPS[slot.slice(0, dot)] !== undefined) return SLOT_GROUPS[slot.slice(0, dot)];
      return slot === "" ? t("groupDefault") : slot;
    }

    function textOf(el) {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return text.slice(0, 48);
    }

    function labelOfRoot(el, slot) {
      const aria = el.getAttribute("aria-label") || el.getAttribute("title") || "";
      if (aria.trim() !== "") return aria.trim().slice(0, 48);
      const text = textOf(el);
      if (text !== "") return text;
      if (typeof slot === "string" && slot !== "") {
        const tail = slot.split(".").pop();
        if (tail !== "") return tail;
      }
      return t("kindRoot");
    }

    function childKind(el) {
      const tag = el.tagName.toLowerCase();
      if (tag === "canvas") return "chart";
      if (tag === "table") return "chart";
      if (el.hasAttribute("data-chart")) return "chart";
      if (typeof el.className === "string" && /chart|graph|plot/i.test(el.className)) return "chart";
      if (tag === "svg") {
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        const big = Math.max(r.width, r.height) >= 110 || area >= 2600 || el.childElementCount >= 12;
        return big ? "chart" : "icon";
      }
      if (tag === "img") return "icon";
      if (tag === "button" || el.getAttribute("role") === "button") return "button";
      if (tag === "input" && (el.type === "button" || el.type === "submit")) return "button";
      if (tag === "input" || tag === "select" || tag === "textarea") return "field";
      if (el.getAttribute("role") === "textbox" || el.getAttribute("contenteditable") === "true") return "field";
      return "other";
    }

    function childLabel(el, kind) {
      const aria = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || "";
      if (aria.trim() !== "") return aria.trim().slice(0, 40);
      if (kind === "button" || kind === "field" || kind === "other") {
        const text = textOf(el).slice(0, 40);
        if (text !== "") return text;
      }
      return t("kind" + kind[0].toUpperCase() + kind.slice(1));
    }

    // ── persisted layout config ─────────────────────────────────────────────

    function defaultItemConfig() {
      return { on: true, mode: "default", x: null, y: null, dx: 0, dy: 0, locked: false, z: null, w: null, h: null, sw: null, sh: null, ox: null, oy: null, ow: null, oh: null, label: null };
    }

    function defaultChildConfig() {
      return { on: true, dx: 0, dy: 0 };
    }

    function defaultConfig() {
      return {
        v: 1,
        global: { collision: "smart" },
        launcher: { on: true, x: null, y: null },
        panel: { x: null, y: null },
        ui: { categories: { official: true, plugin: true }, groups: Object.create(null) },
        items: Object.create(null),
        children: Object.create(null),
      };
    }

    function isRecord(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function validKey(key) {
      return typeof key === "string" && key.length > 0 && key.length <= 512 && !["__proto__", "constructor", "prototype"].includes(key);
    }

    /** Share validation between persisted settings and portable layout files. */
    function normalizeConfig(raw) {
      if (!isRecord(raw) || raw.v !== 1) throw new Error("Unsupported layout");
      const cfg = defaultConfig();
      if (["off", "smart", "strict"].includes(raw.global?.collision)) cfg.global.collision = raw.global.collision;
      for (const section of ["launcher", "panel"]) {
        for (const axis of ["x", "y"]) {
          if (isFiniteNumber(raw[section]?.[axis])) cfg[section][axis] = raw[section][axis];
        }
      }
      cfg.launcher.on = raw.launcher?.on !== false;
      for (const category of ["official", "plugin"]) cfg.ui.categories[category] = raw.ui?.categories?.[category] !== false;
      if (isRecord(raw.ui?.groups)) {
        for (const [key, value] of Object.entries(raw.ui.groups)) {
          if (validKey(key) && typeof value === "boolean") cfg.ui.groups[key] = value;
        }
      }
      for (const section of ["items", "children"]) {
        if (!isRecord(raw[section]) || Object.keys(raw[section]).length > 5000) throw new Error("Invalid layout entries");
        for (const [key, value] of Object.entries(raw[section])) {
          if (!validKey(key) || !isRecord(value)) throw new Error("Invalid layout entry");
          const entry = section === "items" ? defaultItemConfig() : defaultChildConfig();
          for (const field of Object.keys(entry)) {
            if (field === "mode") {
              if (["default", "nudge", "float"].includes(value.mode)) entry.mode = value.mode;
            } else if (field === "label") {
              if (typeof value.label === "string") entry.label = value.label.slice(0, 48) || null;
            } else if (typeof entry[field] === "boolean") {
              if (typeof value[field] === "boolean") entry[field] = value[field];
            } else if (isFiniteNumber(value[field])) {
              entry[field] = Math.round(value[field]);
              if (["sw", "sh", "w", "h"].includes(field)) entry[field] = Math.max(12, entry[field]);
              if (field === "z") entry[field] = clamp(entry[field], 10, 95);
            }
          }
          cfg[section][key] = entry;
        }
      }
      return cfg;
    }

    function loadConfig() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (raw !== null) return normalizeConfig(raw);
      } catch (_) {
        /* corrupt storage falls back to defaults */
      }
      return defaultConfig();
    }

    let config = loadConfig();
    let saveTimer = null;

    function flushSave() {
      if (saveTimer === null) return;
      clearTimeout(saveTimer);
      saveTimer = null;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (_) {
        /* private mode: still works for this page lifetime */
      }
    }

    function scheduleSave() {
      if (saveTimer !== null) return;
      saveTimer = setTimeout(flushSave, 350);
    }

    function exportLayout() {
      return { plugin: PACKAGE_ID, version: 1, layout: JSON.parse(JSON.stringify(config)) };
    }

    function importLayout(data) {
      try {
        if (typeof data === "string") {
          if (data.length > 2 * 1024 * 1024) return false;
          data = JSON.parse(data);
        }
        if (!isRecord(data) || data.plugin !== PACKAGE_ID || data.version !== 1) return false;
        // Finish validation before touching either live DOM or saved settings.
        const next = normalizeConfig(data.layout);
        setDragMode(false);
        stopPick();
        removeHandle();
        const picked = [...document.querySelectorAll('[data-uihub-key^="pick:"]')].map((el) => [el, el.getAttribute("data-uihub-key")]);
        for (const el of document.querySelectorAll("[data-uihub-key], [data-uihub-child], [data-uihub-follow]")) clearElementManagement(el);
        for (const [el, key] of picked) el.setAttribute("data-uihub-key", key);
        followMap.clear();
        config = next;
        const snapshot = discover(true);
        applyAllStyles(snapshot);
        if (panelOpen) buildPanel(snapshot);
        scheduleSave();
        flushSave();
        scheduleUpdate();
        return true;
      } catch (_) { return false; }
    }

    function downloadLayout() {
      const blob = new Blob([JSON.stringify(exportLayout(), null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dsh-ui-hub-layout.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function itemConfig(key) {
      let cfg = config.items[key];
      if (cfg === undefined) {
        cfg = defaultItemConfig();
        config.items[key] = cfg;
      } else {
        const d = defaultItemConfig();
        for (const k of Object.keys(d)) if (cfg[k] === undefined) cfg[k] = d[k];
      }
      return cfg;
    }

    function childConfig(key) {
      let cfg = config.children[key];
      if (cfg === undefined) {
        cfg = defaultChildConfig();
        config.children[key] = cfg;
      } else {
        const d = defaultChildConfig();
        for (const k of Object.keys(d)) if (cfg[k] === undefined) cfg[k] = d[k];
      }
      return cfg;
    }

    /** Official vs third-party plugin classification for the panel. */
    function categoryOf(plugin) {
      return plugin !== undefined && plugin !== "" ? "plugin" : "official";
    }

    /** Stable group id: the slot name, or a pseudo-slot for loose/picked roots. */
    function groupIdOf(root) {
      if (root.slot !== undefined && root.slot !== "") return root.slot;
      return root.scope === "pick" ? "picked" : "floating";
    }

    function ensureUiState() {
      const defaults = defaultConfig().ui;
      if (config.ui === undefined || typeof config.ui !== "object") config.ui = defaults;
      if (config.ui.categories === undefined || typeof config.ui.categories !== "object") config.ui.categories = defaults.categories;
      if (config.ui.groups === undefined || typeof config.ui.groups !== "object") config.ui.groups = {};
      return config.ui;
    }

    function categoryCollapsed(id) {
      ensureUiState();
      return config.ui.categories[id] !== false;
    }

    function groupCollapsed(id) {
      ensureUiState();
      return config.ui.groups[id] !== false;
    }

    /** Normalize a user patch and merge it into the item config. */
    function setConfig(key, patch) {
      if (!validKey(key) || !isRecord(patch)) return false;
      if (key === "launcher") {
        const d = defaultConfig().launcher;
        for (const k of Object.keys(patch)) {
          if (k === "on") config.launcher.on = patch.on !== false;
          else if (k === "x") config.launcher.x = isFiniteNumber(patch.x) ? patch.x : d.x;
          else if (k === "y") config.launcher.y = isFiniteNumber(patch.y) ? patch.y : d.y;
        }
      } else if (key.startsWith("child:")) {
        const realKey = key.slice("child:".length);
        if (!validKey(realKey)) return false;
        const cfg = childConfig(realKey);
        if (patch.on !== undefined) cfg.on = patch.on !== false;
        if (isFiniteNumber(patch.dx)) cfg.dx = Math.round(patch.dx);
        if (isFiniteNumber(patch.dy)) cfg.dy = Math.round(patch.dy);
      } else {
        const cfg = itemConfig(key);
        if (patch.on !== undefined) cfg.on = patch.on !== false;
        if (patch.mode === "default" || patch.mode === "nudge" || patch.mode === "float") cfg.mode = patch.mode;
        if (isFiniteNumber(patch.x)) cfg.x = Math.round(patch.x);
        if (isFiniteNumber(patch.y)) cfg.y = Math.round(patch.y);
        if (isFiniteNumber(patch.dx)) cfg.dx = Math.round(patch.dx);
        if (isFiniteNumber(patch.dy)) cfg.dy = Math.round(patch.dy);
        if (patch.locked !== undefined) cfg.locked = patch.locked === true;
        if (patch.z !== undefined) cfg.z = isFiniteNumber(patch.z) ? patch.z : null;
        if (patch.w !== undefined) cfg.w = isFiniteNumber(patch.w) ? patch.w : null;
        if (patch.h !== undefined) cfg.h = isFiniteNumber(patch.h) ? patch.h : null;
        if (patch.sw !== undefined) cfg.sw = isFiniteNumber(patch.sw) ? Math.max(12, Math.round(patch.sw)) : null;
        if (patch.sh !== undefined) cfg.sh = isFiniteNumber(patch.sh) ? Math.max(12, Math.round(patch.sh)) : null;
        if (typeof patch.label === "string") cfg.label = patch.label.slice(0, 48) || null;
      }
      scheduleSave();
      return true;
    }

    function removeItemConfig(key) {
      delete config.items[key];
      if (config.children !== undefined) {
        for (const childKey of Object.keys(config.children)) {
          if (childKey.startsWith(key + "#")) delete config.children[childKey];
        }
      }
      scheduleSave();
    }

    // ── discovery ───────────────────────────────────────────────────────────

    /**
     * Direct element children of every `[data-slot]` anchor. Nested slot
     * anchors, crash faces and overlay fallbacks are excluded: they are
     * platform plumbing, not a plugin contribution.
     */
    function discoverSlotRoots() {
      const out = [];
      const anchors = document.querySelectorAll("[data-slot]");
      for (const anchor of anchors) {
        const slot = anchor.getAttribute("data-slot") || "";
        let index = 0;
        for (const child of anchor.children) {
          if (!(child instanceof Element)) continue;
          if (child.hasAttribute("data-slot")) continue;
          if (child.hasAttribute("data-slot-error")) continue;
          if (child.hasAttribute("data-chain-overlay-fallback")) continue;
          if (isOurUI(child) || isNativeChrome(child)) continue;
          if (slot === "root") continue;
          const key = "slot:" + slot + "@" + index;
          index += 1;
          const plugin = SHELL_SLOTS[slot] === true ? "" : pluginGuess(child);
          out.push({
            key,
            el: child,
            scope: "slot",
            slot,
            group: slotGroupName(slot),
            label: SHELL_SLOTS[slot] === true ? slotGroupName(slot) : labelOfRoot(child, slot),
            plugin,
            category: categoryOf(plugin),
          });
        }
      }
      return out;
    }

    /** Floating widgets outside slot anchors: body-level and marker-bearing elements. */
    function discoverLooseRoots(known) {
      const out = [];
      const seen = new Set(known.map((item) => item.el));
      const add = (el, source, fallbackKey) => {
        if (!(el instanceof Element) || el === document.body || el === document.documentElement) return;
        if (seen.has(el) || isOurUI(el) || isNativeChrome(el) || isManaged(el)) return;
        if (el.closest("[data-slot]") !== null) return;
        if (el.closest("[role=dialog]") !== null || el.closest("[data-overlay]") !== null) return;
        if (el.closest("[role=tooltip]") !== null) return;
        const tag = el.tagName;
        if (tag === "STYLE" || tag === "SCRIPT" || tag === "LINK" || tag === "META" || tag === "TITLE") return;
        if (el.matches(POPUP_SELECTOR) || el.hasAttribute("data-uihub-follow")) return;
        if (visibleRect(el) === null) return;
        seen.add(el);
        let key = fallbackKey;
        const marker = firstMarker(el);
        if (marker !== "") key = "loose:" + marker + "=" + (el.dataset[marker] || "1");
        const plugin = datasetPlugin(el) || classPlugin(el) || "";
        out.push({
          key,
          el,
          scope: fallbackKey.startsWith("pick:") ? "pick" : "loose",
          slot: "",
          group: fallbackKey.startsWith("pick:") ? t("groupPick") : t("groupDefault"),
          label: labelOfRoot(el, ""),
          plugin,
          category: categoryOf(plugin),
        });
      };
      // 1. body direct children that are visually detached from the frame.
      let bodyIndex = 0;
      for (const child of document.body.children) {
        if (!(child instanceof Element)) continue;
        if (child.hasAttribute("data-dsh-frame")) { bodyIndex += 1; continue; }
        if (seen.has(child) || isOurUI(child)) { bodyIndex += 1; continue; }
        const style = getComputedStyle(child);
        const floating = style.position === "fixed" || style.position === "absolute";
        const rect = visibleRect(child);
        if (floating && rect !== null) add(child, "body", "loose:body@" + bodyIndex);
        bodyIndex += 1;
      }
      // 2. marker-bearing elements anywhere outside slot anchors.
      for (const el of document.querySelectorAll("body *")) {
        if (seen.has(el) || !(el instanceof Element)) continue;
        if (el.matches(POPUP_SELECTOR) || el.hasAttribute("data-uihub-follow")) continue;
        if (firstMarker(el) === "" && !isManaged(el)) continue;
        if (visibleRect(el) === null && !isManaged(el)) continue;
        add(el, "marker", "loose:marker@" + hashPath(el));
      }
      // 3. previously picked elements are self-identifying via data-uihub-key.
      for (const el of document.querySelectorAll("[data-uihub-key]")) {
        if (seen.has(el) || isNativeChrome(el)) continue;
        if (el.matches(POPUP_SELECTOR) || el.hasAttribute("data-uihub-follow")) continue;
        const key = el.getAttribute("data-uihub-key");
        if (key === null || key === "") continue;
        if (key.startsWith("slot:")) continue;
        seen.add(el);
        const plugin = datasetPlugin(el) || classPlugin(el) || "";
        out.push({
          key,
          el,
          scope: key.startsWith("pick:") ? "pick" : "loose",
          slot: "",
          group: key.startsWith("pick:") ? t("groupPick") : t("groupDefault"),
          label: labelOfRoot(el, ""),
          plugin,
          category: categoryOf(plugin),
        });
      }
      return out;
    }

    /** Fine-grained leaves inside one root: buttons / icons / charts / fields. */
    function collectChildren(rootEl, rootKey, limit) {
      const max = limit === undefined ? 60 : limit;
      const out = [];
      const seen = new Set();
      const candidates = rootEl.querySelectorAll(
        "button,[role=button],input,select,textarea,a[href],svg,canvas,img,table,[data-chart],[class*=chart i],[class*=graph i],[role=textbox],[contenteditable=true]",
      );
      let index = 0;
      for (const el of candidates) {
        if (out.length >= max) break;
        if (!(el instanceof Element) || seen.has(el) || isOurUI(el)) continue;
        if (el.hasAttribute("data-uihub-key") && el !== rootEl) continue;
        seen.add(el);
        const kind = childKind(el);
        out.push({
          key: rootKey + "#c" + index,
          el,
          scope: "child",
          rootKey,
          kind,
          label: childLabel(el, kind),
        });
        index += 1;
      }
      return out;
    }

    let snapshotCache = { at: 0, roots: [], children: [], looseCount: 0, scanned: false };
    let discoveryDirty = true;
    let discoveryTimer = null;

    function discover(force) {
      const now = Date.now();
      if (!force && snapshotCache.scanned) {
        if (!discoveryDirty) return snapshotCache;
        const remaining = DISCOVER_MS - (now - snapshotCache.at);
        if (remaining > 0) {
          // Do not lose a single remount that arrives within the throttle window.
          if (discoveryTimer === null) discoveryTimer = setTimeout(() => {
            discoveryTimer = null;
            scheduleUpdate();
          }, remaining + 1);
          return snapshotCache;
        }
      }
      clearTimeout(discoveryTimer);
      discoveryTimer = null;
      discoveryDirty = false;
      const roots = discoverSlotRoots();
      const loose = discoverLooseRoots(roots);
      const all = roots.concat(loose);
      const children = [];
      for (const root of all) {
        const hasChildConfig = Object.keys(config.children).some((key) => key.startsWith(root.key + "#"));
        if (hasChildConfig || panelOpen) children.push(...collectChildren(root.el, root.key));
      }
      snapshotCache = { at: now, roots: all, children, looseCount: loose.length, scanned: true };
      return snapshotCache;
    }

    // ── additive style application ──────────────────────────────────────────

    const MANAGED_VARS = ["--uihub-x", "--uihub-y", "--uihub-z", "--uihub-w", "--uihub-sh", "--uihub-sw", "--uihub-dx", "--uihub-dy", "--uihub-fdx", "--uihub-fdy"];

    function setVar(el, name, value) {
      const current = el.style.getPropertyValue(name);
      if (current !== value) el.style.setProperty(name, value);
    }

    function removeManagedVars(el) {
      for (const name of MANAGED_VARS) el.style.removeProperty(name);
    }

    function clampToViewport(x, y, w, h) {
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      return {
        x: Math.round(clamp(x, 8 - w + 40, vw - 40)),
        y: Math.round(clamp(y, desktopTopInset() + 8, Math.max(desktopTopInset() + 8, vh - 40))),
      };
    }

    function ensureFloatOrigin(el, cfg) {
      if (isFiniteNumber(cfg.x) && isFiniteNumber(cfg.y)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) {
        cfg.x = Math.round(rect.left);
        cfg.y = Math.round(rect.top);
      } else if (isFiniteNumber(cfg.w)) {
        cfg.x = isFiniteNumber(cfg.x) ? cfg.x : MARGIN;
        cfg.y = isFiniteNumber(cfg.y) ? cfg.y : MARGIN;
      } else {
        cfg.x = MARGIN;
        cfg.y = MARGIN;
      }
    }

    function applyRootStyle(root) {
      const cfg = itemConfig(root.key);
      if (root.label !== undefined && cfg.label !== null && cfg.label !== "" && root.label !== cfg.label) root.label = cfg.label;
      if (!(root.el instanceof Element) || !root.el.isConnected) return;
      root.el.setAttribute("data-uihub-key", root.key);
      if (!cfg.on) {
        root.el.setAttribute("data-uihub-off", "");
        return;
      }
      root.el.removeAttribute("data-uihub-off");
      if (cfg.mode === "float") {
        ensureFloatOrigin(root.el, cfg);
        const rect = root.el.getBoundingClientRect();
        // Remember where the element lived in its original layout, so popups
        // that still anchor to that spot can be shifted to the floated spot.
        if (!isFiniteNumber(cfg.ox) || !isFiniteNumber(cfg.oy)) {
          cfg.ox = Math.round(rect.left);
          cfg.oy = Math.round(rect.top);
          cfg.ow = Math.round(rect.width);
          cfg.oh = Math.round(rect.height);
        }
        let z = cfg.z;
        if (!isFiniteNumber(z)) {
          const computed = parseInt(getComputedStyle(root.el).zIndex, 10);
          z = Number.isFinite(computed) ? clamp(computed, 10, 95) : FLOAT_Z_DEFAULT;
        }
        if (!isFiniteNumber(cfg.w) && !isFiniteNumber(cfg.sw)) {
          cfg.w = Math.round(rect.width > 1 ? rect.width : 260);
        }
        if (!isFiniteNumber(cfg.h) && !isFiniteNumber(cfg.sh)) {
          cfg.h = Math.round(rect.height > 1 ? rect.height : 40);
        }
        const width = isFiniteNumber(cfg.sw) ? cfg.sw : (isFiniteNumber(cfg.w) ? cfg.w : 260);
        const height = isFiniteNumber(cfg.sh) ? cfg.sh : (isFiniteNumber(cfg.h) ? cfg.h : 40);
        const pos = clampToViewport(cfg.x, cfg.y, width, height);
        cfg.x = pos.x;
        cfg.y = pos.y;
        setVar(root.el, "--uihub-x", cfg.x + "px");
        setVar(root.el, "--uihub-y", cfg.y + "px");
        setVar(root.el, "--uihub-z", z + "");
        setVar(root.el, "--uihub-w", Math.round(width) + "px");
        setVar(root.el, "--uihub-sh", Math.round(height) + "px");
        root.el.setAttribute("data-uihub-float", "");
        root.el.removeAttribute("data-uihub-nudge");
      } else if (cfg.mode === "nudge") {
        root.el.removeAttribute("data-uihub-float");
        cfg.ox = null;
        cfg.oy = null;
        cfg.ow = null;
        cfg.oh = null;
        setVar(root.el, "--uihub-dx", (isFiniteNumber(cfg.dx) ? cfg.dx : 0) + "px");
        setVar(root.el, "--uihub-dy", (isFiniteNumber(cfg.dy) ? cfg.dy : 0) + "px");
        root.el.setAttribute("data-uihub-nudge", "");
      } else {
        root.el.removeAttribute("data-uihub-float");
        root.el.removeAttribute("data-uihub-nudge");
        cfg.ox = null;
        cfg.oy = null;
        cfg.ow = null;
        cfg.oh = null;
        for (const name of ["--uihub-x", "--uihub-y", "--uihub-z", "--uihub-w", "--uihub-sh", "--uihub-dx", "--uihub-dy"]) {
          root.el.style.removeProperty(name);
        }
      }
      // Explicit size override (drag-mode resize) works in every position mode.
      if (isFiniteNumber(cfg.sw) || isFiniteNumber(cfg.sh)) {
        if (isFiniteNumber(cfg.sw)) setVar(root.el, "--uihub-sw", cfg.sw + "px");
        if (isFiniteNumber(cfg.sh)) setVar(root.el, "--uihub-sh", cfg.sh + "px");
        root.el.setAttribute("data-uihub-size", "");
      } else {
        root.el.removeAttribute("data-uihub-size");
        root.el.style.removeProperty("--uihub-sw");
        if (cfg.mode !== "float") root.el.style.removeProperty("--uihub-sh");
      }
    }

    function applyChildStyle(child) {
      const cfg = childConfig(child.key);
      if (!(child.el instanceof Element) || !child.el.isConnected) return;
      child.el.setAttribute("data-uihub-child", child.key);
      if (!cfg.on) {
        child.el.setAttribute("data-uihub-off", "");
        return;
      }
      child.el.removeAttribute("data-uihub-off");
      setVar(child.el, "--uihub-dx", (isFiniteNumber(cfg.dx) ? cfg.dx : 0) + "px");
      setVar(child.el, "--uihub-dy", (isFiniteNumber(cfg.dy) ? cfg.dy : 0) + "px");
      child.el.setAttribute("data-uihub-nudge", "");
    }

    function applyAllStyles(snapshot) {
      for (const root of snapshot.roots) applyRootStyle(root);
      for (const child of snapshot.children) applyChildStyle(child);
      // Drop stale attributes from elements that are no longer managed.
      for (const el of document.querySelectorAll("[data-uihub-child]")) {
        const key = el.getAttribute("data-uihub-child");
        const known = key !== null && config.children[key] !== undefined;
        if (!known) {
          el.removeAttribute("data-uihub-child");
          if (!isManaged(el)) {
            el.removeAttribute("data-uihub-off");
            el.removeAttribute("data-uihub-nudge");
            removeManagedVars(el);
          }
        }
      }
    }

    function clearElementManagement(el) {
      el.removeAttribute("data-uihub-off");
      el.removeAttribute("data-uihub-nudge");
      el.removeAttribute("data-uihub-float");
      el.removeAttribute("data-uihub-size");
      el.removeAttribute("data-uihub-follow");
      el.removeAttribute("data-uihub-key");
      el.removeAttribute("data-uihub-child");
      removeManagedVars(el);
    }

    // ── popup follower for floated roots ────────────────────────────────────

    const POPUP_SELECTOR = "[role=dialog],[role=menu],[role=listbox],[role=tooltip],[data-popper-placement],[data-popover],[data-menu],[data-floating-ui]";
    /** popup element -> key of the floated root that opened it. */
    let followMap = new Map();

    function applyFollow(el, dx, dy) {
      el.setAttribute("data-uihub-follow", "");
      setVar(el, "--uihub-fdx", dx + "px");
      setVar(el, "--uihub-fdy", dy + "px");
    }

    function clearFollow(el) {
      el.removeAttribute("data-uihub-follow");
      el.style.removeProperty("--uihub-fdx");
      el.style.removeProperty("--uihub-fdy");
    }

    /**
     * Shift popups that still open at a floated root's ORIGINAL layout spot.
     * Anchoring libraries usually measure the trigger rect, which already
     * follows the float; the original-spot case is compensated here with the
     * independent CSS `translate` property so the popup's own transform and
     * layout stay untouched. Full-screen centered dialogs never sit near the
     * original spot and are left alone.
     */
    function syncPopupFollowers(snapshot) {
      const active = new Map();
      for (const root of snapshot.roots) {
        const cfg = itemConfig(root.key);
        if (cfg.on === false || cfg.mode !== "float" || !root.el.isConnected) continue;
        if (!isFiniteNumber(cfg.x) || !isFiniteNumber(cfg.y) || !isFiniteNumber(cfg.ox) || !isFiniteNumber(cfg.oy)) continue;
        const dx = Math.round(cfg.x - cfg.ox);
        const dy = Math.round(cfg.y - cfg.oy);
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
        active.set(root.key, { root, cfg, dx, dy });
      }
      for (const [popup, rootKey] of [...followMap]) {
        if (!popup.isConnected || !active.has(rootKey)) {
          clearFollow(popup);
          followMap.delete(popup);
        }
      }
      if (active.size === 0) return;
      for (const popup of document.querySelectorAll(POPUP_SELECTOR)) {
        if (popup.hasAttribute("data-uihub-follow") || isOurUI(popup) || isManaged(popup)) continue;
        const rect = visibleRect(popup);
        if (rect === null) continue;
        for (const [rootKey, item] of active) {
          if (item.root.el.contains(popup)) continue;
          const ow = isFiniteNumber(item.cfg.ow) ? item.cfg.ow : 24;
          const oh = isFiniteNumber(item.cfg.oh) ? item.cfg.oh : 24;
          const originZone = { left: item.cfg.ox - 48, top: item.cfg.oy - 48, right: item.cfg.ox + ow + 48, bottom: item.cfg.oy + oh + 48 };
          const width = isFiniteNumber(item.cfg.sw) ? item.cfg.sw : (isFiniteNumber(item.cfg.w) ? item.cfg.w : ow);
          const height = isFiniteNumber(item.cfg.sh) ? item.cfg.sh : (isFiniteNumber(item.cfg.h) ? item.cfg.h : oh);
          const currentZone = { left: item.cfg.x - 24, top: item.cfg.y - 24, right: item.cfg.x + width + 24, bottom: item.cfg.y + height + 24 };
          if (overlaps(rect, originZone) !== null && overlaps(rect, currentZone) === null) {
            applyFollow(popup, item.dx, item.dy);
            followMap.set(popup, rootKey);
            break;
          }
        }
      }
      for (const [popup, rootKey] of followMap) {
        const item = active.get(rootKey);
        if (item !== undefined) applyFollow(popup, item.dx, item.dy);
      }
    }

    // ── geometry: enforcement, collisions, auto arrange ────────────────────

    function anchorRect() {
      const sp = document.querySelector("[data-conversation-scroll]");
      if (sp instanceof HTMLElement) {
        const r = visibleRect(sp);
        if (r !== null && r.right > 100 && r.bottom > 100) return r;
      }
      return { left: 0, top: 0, right: window.innerWidth || 1280, bottom: window.innerHeight || 800, width: window.innerWidth || 1280, height: window.innerHeight || 800 };
    }

    /** Visible float-mode roots plus the launcher (as a pseudo float item). */
    function floatItems(snapshot) {
      const out = [];
      for (const root of snapshot.roots) {
        const cfg = itemConfig(root.key);
        if (cfg.on === false || cfg.mode !== "float" || !root.el.isConnected) continue;
        const rect = visibleRect(root.el);
        if (rect === null) continue;
        out.push({ key: root.key, el: root.el, cfg, rect, self: false });
      }
      if (config.launcher.on !== false && launcher !== null && launcher.isConnected) {
        const rect = visibleRect(launcher);
        if (rect !== null) out.push({ key: "launcher", el: launcher, cfg: config.launcher, rect, self: true });
      }
      return out;
    }

    function overlapPenalty(rect, items, exceptKey) {
      let penalty = 0;
      for (const other of items) {
        if (other.key === exceptKey) continue;
        const ov = overlaps(rect, other.rect);
        if (ov !== null) penalty += 10000 + ov.width * ov.height;
      }
      return penalty;
    }

    /** Push overlapping float items apart; returns how many were moved. */
    function solveCollisions(snapshot) {
      const mode = config.global.collision;
      if (mode === "off") return 0;
      const items = floatItems(snapshot);
      let movedCount = 0;
      for (let pass = 0; pass < 8; pass += 1) {
        let moved = false;
        for (let i = 0; i < items.length; i += 1) {
          for (let j = i + 1; j < items.length; j += 1) {
            const a = items[i];
            const b = items[j];
            const ov = overlaps(a.rect, b.rect);
            if (ov === null) continue;
            if (mode === "smart" && (ov.width < 3 || ov.height < 3)) continue;
            if (a.cfg.locked === true && b.cfg.locked === true) continue;
            let mover;
            let fixed;
            if (a.cfg.locked === true) { mover = b; fixed = a; }
            else if (b.cfg.locked === true) { mover = a; fixed = b; }
            else if (a.rect.width * a.rect.height <= b.rect.width * b.rect.height) { mover = a; fixed = b; }
            else { mover = b; fixed = a; }
            const vw = window.innerWidth || 1280;
            const vh = window.innerHeight || 800;
            const candidates = [
              { x: Math.round(fixed.rect.left - mover.rect.width - GAP), y: mover.cfg.y },
              { x: Math.round(fixed.rect.right + GAP), y: mover.cfg.y },
              { x: mover.cfg.x, y: Math.round(fixed.rect.top - mover.rect.height - GAP) },
              { x: mover.cfg.x, y: Math.round(fixed.rect.bottom + GAP) },
            ];
            let best = null;
            let bestScore = Infinity;
            for (const candidate of candidates) {
              const c = clampToViewport(candidate.x, candidate.y, mover.rect.width, mover.rect.height);
              const distance = Math.abs(c.x - mover.cfg.x) + Math.abs(c.y - mover.cfg.y);
              const candidateRect = { left: c.x, top: c.y, right: c.x + mover.rect.width, bottom: c.y + mover.rect.height, width: mover.rect.width, height: mover.rect.height };
              const score = distance + overlapPenalty(candidateRect, items, mover.key);
              if (score < bestScore) {
                bestScore = score;
                best = c;
              }
            }
            if (best !== null && (best.x !== mover.cfg.x || best.y !== mover.cfg.y)) {
              mover.cfg.x = best.x;
              mover.cfg.y = best.y;
              mover.rect = { left: best.x, top: best.y, right: best.x + mover.rect.width, bottom: best.y + mover.rect.height, width: mover.rect.width, height: mover.rect.height };
              if (mover.self) applyLauncherPosition();
              else applyRootStyle(snapshot.roots.find((root) => root.key === mover.key) || { key: mover.key, el: mover.el });
              moved = true;
              movedCount += 1;
            }
          }
        }
        if (!moved) break;
      }
      if (movedCount > 0) scheduleSave();
      return movedCount;
    }

    /** Right-edge vertical columns anchored to the conversation scrollport. */
    function arrangeNow(snapshot) {
      const items = floatItems(snapshot);
      const movable = items.filter((item) => item.cfg.locked !== true && item.cfg.on !== false);
      if (movable.length === 0) {
        toast(t("arrangedNone"));
        return 0;
      }
      const anchor = anchorRect();
      const ordered = [...movable].sort((a, b) => {
        if (a.self !== b.self) return a.self ? 1 : -1;
        if (a.rect.top !== b.rect.top) return a.rect.top - b.rect.top;
        return a.rect.left - b.rect.left;
      });
      let xRight = anchor.right - MARGIN;
      let columnWidth = 0;
      let y = anchor.top + MARGIN;
      let placed = 0;
      for (const item of ordered) {
        const w = item.rect.width;
        const h = item.rect.height;
        if (y + h > anchor.bottom - MARGIN && columnWidth > 0 && xRight - columnWidth - GAP - w > anchor.left) {
          xRight -= columnWidth + GAP;
          columnWidth = 0;
          y = anchor.top + MARGIN;
        }
        if (xRight - w < anchor.left + MARGIN) break;
        item.cfg.x = Math.round(xRight - w);
        item.cfg.y = Math.round(y);
        if (item.cfg.locked !== true) {
          if (item.self) applyLauncherPosition();
          else applyRootStyle(snapshot.roots.find((root) => root.key === item.key) || { key: item.key, el: item.el });
        }
        columnWidth = Math.max(columnWidth, w);
        y += h + GAP;
        placed += 1;
      }
      if (placed > 0) {
        solveCollisions(snapshot);
        scheduleSave();
        toast(t("arranged", { n: placed }));
      } else {
        toast(t("arrangedNone"));
      }
      return placed;
    }

    // ── launcher / panel / picker chrome ────────────────────────────────────

    let launcher = null;
    let panel = null;
    let panelOpen = false;
    let pickBar = null;
    let toastEl = null;
    let handle = null;
    let handleKey = null;
    let picking = false;
    let pickHighlight = null;
    let lastOverlapCount = 0;
    let dragMode = false;
    let dragGrips = new Map();
    let editSession = null;
    let searchQuery = "";

    function applyLauncherPosition() {
      if (launcher === null || !launcher.isConnected) return;
      if (config.launcher.on === false) {
        launcher.style.display = "none";
        return;
      }
      launcher.style.display = "";
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      let x = config.launcher.x;
      let y = config.launcher.y;
      const width = launcher.offsetWidth || 100;
      if (!isFiniteNumber(x)) x = vw - width - MARGIN;
      if (!isFiniteNumber(y)) y = 88;
      x = clamp(x, 8, Math.max(8, vw - width - 8));
      y = clamp(y, desktopTopInset() + 8, Math.max(desktopTopInset() + 8, vh - 56));
      launcher.style.left = Math.round(x) + "px";
      launcher.style.top = Math.round(y) + "px";
    }

    function ensureLauncher() {
      if (launcher !== null && launcher.isConnected) return launcher;
      launcher = document.createElement("button");
      launcher.type = "button";
      launcher.className = "dshUiHub_launch";
      launcher.setAttribute("data-uihub-ui", "");
      launcher.setAttribute("aria-label", t("launch"));
      launcher.title = t("launch") + (document.documentElement.dataset.platform === "darwin" || /Mac/i.test(navigator.userAgent) ? " · ⌘⇧U" : " · Ctrl+Shift+U");
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("width", "14");
      icon.setAttribute("height", "14");
      icon.setAttribute("viewBox", "0 0 14 14");
      icon.setAttribute("fill", "none");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<rect x="1.5" y="1.5" width="4.6" height="4.6" rx="1.2" stroke="currentColor" stroke-width="1.2"/><rect x="7.9" y="1.5" width="4.6" height="4.6" rx="1.2" stroke="currentColor" stroke-width="1.2"/><rect x="1.5" y="7.9" width="4.6" height="4.6" rx="1.2" stroke="currentColor" stroke-width="1.2"/><rect x="7.9" y="7.9" width="4.6" height="4.6" rx="1.2" stroke="currentColor" stroke-width="1.2"/>';
      const label = document.createElement("span");
      label.textContent = t("title");
      const badge = document.createElement("span");
      badge.className = "dshUiHub_badge";
      badge.textContent = "0";
      launcher.append(icon, label, badge);
      // Click vs drag: drag after a 4px threshold, click on release otherwise.
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let originX = 0;
      let originY = 0;
      launcher.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        dragging = false;
        startX = event.clientX;
        startY = event.clientY;
        originX = isFiniteNumber(config.launcher.x) ? config.launcher.x : launcher.getBoundingClientRect().left;
        originY = isFiniteNumber(config.launcher.y) ? config.launcher.y : launcher.getBoundingClientRect().top;
        const onMove = (moveEvent) => {
          if (!dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
          dragging = true;
          launcher.setPointerCapture?.(moveEvent.pointerId);
          config.launcher.x = Math.round(originX + moveEvent.clientX - startX);
          config.launcher.y = Math.round(originY + moveEvent.clientY - startY);
          applyLauncherPosition();
        };
        const onUp = (upEvent) => {
          window.removeEventListener("pointermove", onMove, true);
          window.removeEventListener("pointerup", onUp, true);
          if (dragging) {
            upEvent.preventDefault();
            upEvent.stopPropagation();
            launcher._suppressClick = true;
            setTimeout(() => {
              delete launcher._suppressClick;
            }, 0);
            scheduleSave();
          }
        };
        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", onUp, true);
      });
      launcher.addEventListener("click", (event) => {
        if (event.defaultPrevented || launcher._suppressClick === true) return;
        togglePanel();
      });
      document.body.appendChild(launcher);
      applyLauncherPosition();
      return launcher;
    }

    function updateBadge(hiddenCount) {
      if (launcher === null) return;
      const text = String(hiddenCount);
      if (launcher.dataset.count !== text) launcher.dataset.count = text;
      const badge = launcher.querySelector(".dshUiHub_badge");
      if (badge !== null && badge.textContent !== text) badge.textContent = text;
    }

    function removeLauncher() {
      if (launcher !== null) launcher.remove();
      launcher = null;
    }

    function panelSignature(snapshot) {
      const parts = [];
      for (const root of snapshot.roots) {
        const cfg = itemConfig(root.key);
        parts.push(root.key + ":" + (cfg.on ? "1" : "0") + ":" + cfg.mode + ":" + (cfg.locked ? "1" : "0"));
      }
      for (const child of snapshot.children) {
        const cfg = childConfig(child.key);
        parts.push(child.key + ":" + (cfg.on ? "1" : "0"));
      }
      return parts.join("|");
    }

    function field(labelText, value, onInput) {
      const wrap = document.createElement("label");
      wrap.className = "dshUiHub_field";
      const text = document.createElement("span");
      text.textContent = labelText;
      const input = document.createElement("input");
      input.type = "number";
      input.value = String(value);
      input.addEventListener("change", () => {
        const num = Number(input.value);
        if (Number.isFinite(num)) onInput(Math.round(num));
      });
      wrap.append(text, input);
      return wrap;
    }

    function buildPanel(snapshot) {
      if (panel === null) {
        panel = document.createElement("div");
        panel.className = "dshUiHub_panel";
        panel.setAttribute("data-uihub-ui", "");
        panel.setAttribute("data-uihub-panel", "");
        document.body.appendChild(panel);
      }
      const oldList = panel.querySelector(".dshUiHub_list");
      const scrollTop = oldList?.scrollTop || 0;
      panel.innerHTML = "";
      panel.dataset.signature = panelSignature(snapshot);
      const head = document.createElement("div");
      head.className = "dshUiHub_head";
      const titleWrap = document.createElement("div");
      const title = document.createElement("div");
      title.className = "dshUiHub_title";
      title.textContent = t("title");
      const sub = document.createElement("div");
      sub.className = "dshUiHub_sub";
      sub.textContent = t("subtitle");
      titleWrap.append(title, sub);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "dshUiHub_close";
      close.setAttribute("aria-label", t("close"));
      close.textContent = "✕";
      close.addEventListener("click", closePanel);
      head.append(titleWrap, close);
      // Panel drag by header.
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let originX = 0;
      let originY = 0;
      head.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button") !== null) return;
        dragging = false;
        startX = event.clientX;
        startY = event.clientY;
        const rect = panel.getBoundingClientRect();
        originX = rect.left;
        originY = rect.top;
        const onMove = (moveEvent) => {
          if (!dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
          dragging = true;
          head.setPointerCapture?.(moveEvent.pointerId);
          config.panel.x = Math.round(originX + moveEvent.clientX - startX);
          config.panel.y = Math.round(originY + moveEvent.clientY - startY);
          applyPanelPosition();
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove, true);
          window.removeEventListener("pointerup", onUp, true);
          if (dragging) scheduleSave();
        };
        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", onUp, true);
      });
      const toolbar = document.createElement("div");
      toolbar.className = "dshUiHub_toolbar";
      const arrangeBtn = document.createElement("button");
      arrangeBtn.type = "button";
      arrangeBtn.className = "dshUiHub_btn";
      arrangeBtn.textContent = t("arrange");
      arrangeBtn.addEventListener("click", () => arrangeNow(discover(true)));
      const pickBtn = document.createElement("button");
      pickBtn.type = "button";
      pickBtn.className = "dshUiHub_btn";
      pickBtn.textContent = t("pick");
      if (picking) pickBtn.dataset.armed = "";
      pickBtn.addEventListener("click", () => (picking ? stopPick() : startPick()));
      const dragBtn = document.createElement("button");
      dragBtn.type = "button";
      dragBtn.className = "dshUiHub_btn";
      dragBtn.textContent = t("dragMode");
      if (dragMode) dragBtn.dataset.armed = "";
      dragBtn.addEventListener("click", () => {
        setDragMode(!dragMode);
        if (panel !== null) buildPanel(discover(true));
      });
      const refreshBtn = document.createElement("button");
      refreshBtn.type = "button";
      refreshBtn.className = "dshUiHub_btn";
      refreshBtn.textContent = t("refresh");
      refreshBtn.addEventListener("click", () => {
        discover(true);
        scheduleUpdate();
      });
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "dshUiHub_btn danger";
      resetBtn.textContent = t("reset");
      resetBtn.addEventListener("click", () => {
        config.items = Object.create(null);
        config.children = Object.create(null);
        config.launcher = defaultConfig().launcher;
        config.panel = defaultConfig().panel;
        applyAllStyles(discover(true));
        removeHandle();
        applyLauncherPosition();
        applyPanelPosition();
        scheduleSave();
        toast(t("resetDone"));
      });
      toolbar.append(arrangeBtn, pickBtn, dragBtn, refreshBtn, resetBtn);
      const exportBtn = document.createElement("button");
      exportBtn.type = "button";
      exportBtn.className = "dshUiHub_btn";
      exportBtn.dataset.layoutExport = "";
      exportBtn.textContent = t("export");
      exportBtn.addEventListener("click", downloadLayout);
      const importBtn = document.createElement("button");
      importBtn.type = "button";
      importBtn.className = "dshUiHub_btn";
      importBtn.textContent = t("import");
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json";
      fileInput.hidden = true;
      fileInput.dataset.layoutImport = "";
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        let ok = false;
        try {
          if (file.size <= 2 * 1024 * 1024) {
            const text = await file.text();
            if (disposed) return;
            ok = importLayout(text);
          }
        } catch (_) { /* report a failed read without changing the layout */ }
        fileInput.value = "";
        if (!disposed) toast(t(ok ? "imported" : "importFailed"));
      });
      importBtn.addEventListener("click", () => fileInput.click());
      toolbar.append(exportBtn, importBtn, fileInput);
      const global = document.createElement("div");
      global.className = "dshUiHub_global";
      const globalLabel = document.createElement("span");
      globalLabel.className = "dshUiHub_globalLabel";
      globalLabel.textContent = t("collision");
      const select = document.createElement("select");
      select.className = "dshUiHub_select";
      select.setAttribute("aria-label", t("collision"));
      const options = [
        ["off", t("collisionOff")],
        ["smart", t("collisionSmart")],
        ["strict", t("collisionStrict")],
      ];
      for (const [value, labelText] of options) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = labelText;
        if (config.global.collision === value) option.selected = true;
        select.append(option);
      }
      select.addEventListener("change", () => {
        config.global.collision = select.value === "off" || select.value === "strict" ? select.value : "smart";
        scheduleSave();
        scheduleUpdate();
      });
      const counts = document.createElement("span");
      counts.className = "dshUiHub_counts";
      counts.dataset.counts = "";
      global.append(globalLabel, select, counts);
      const search = document.createElement("input");
      search.type = "search";
      search.className = "dshUiHub_search";
      search.placeholder = t("search");
      search.setAttribute("aria-label", t("search"));
      search.value = searchQuery;
      search.addEventListener("input", () => {
        searchQuery = search.value;
        renderList(list, discover(true));
      });
      const list = document.createElement("div");
      list.className = "dshUiHub_list";
      renderList(list, snapshot);
      panel.append(head, toolbar, global, search, list);
      list.scrollTop = scrollTop;
      applyPanelPosition();
      updatePanelCounts(snapshot);
    }

    function renderList(list, snapshot) {
      list.replaceChildren();
      const terms = searchQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const roots = snapshot.roots.filter((root) => {
        const text = [root.label, root.plugin, root.slot, root.group, root.key].join(" ").toLocaleLowerCase();
        return terms.every((term) => text.includes(term));
      });
      if (snapshot.roots.length === 0) {
        const empty = document.createElement("div");
        empty.className = "dshUiHub_sub";
        empty.style.padding = "8px 2px";
        empty.style.lineHeight = "18px";
        empty.textContent = t("noItems");
        list.append(empty);
      } else if (roots.length === 0) {
        const empty = document.createElement("div");
        empty.className = "dshUiHub_sub";
        empty.textContent = t("noMatches");
        list.append(empty);
      } else {
        const categories = [
          { id: "official", label: t("catOfficial"), roots: roots.filter((root) => root.category !== "plugin") },
          { id: "plugin", label: t("catPlugin"), roots: roots.filter((root) => root.category === "plugin") },
        ];
        for (const category of categories) {
          if (terms.length && !category.roots.length) continue;
          list.append(buildCategoryHeader(category, snapshot));
          if (terms.length || !categoryCollapsed(category.id)) list.append(...buildGroups(category.roots, snapshot));
        }
      }
    }

    function chevron(open) {
      const el = document.createElement("span");
      el.className = "dshUiHub_chev";
      if (open) el.dataset.open = "";
      return el;
    }

    function buildCategoryHeader(category, snapshot) {
      const header = document.createElement("div");
      header.className = "dshUiHub_cat";
      header.dataset.cat = category.id;
      header.title = t("catOfficial") + "/" + t("catPlugin");
      const open = searchQuery.trim() !== "" || !categoryCollapsed(category.id);
      header.append(chevron(open));
      const name = document.createElement("span");
      name.className = "dshUiHub_catName";
      name.textContent = category.label;
      const count = document.createElement("span");
      count.className = "dshUiHub_catCount";
      count.textContent = category.roots.length + " UI";
      const tag = document.createElement("span");
      tag.className = "dshUiHub_tag catTag " + category.id;
      tag.textContent = category.label;
      header.append(name, count, tag);
      header.addEventListener("click", () => {
        ensureUiState();
        config.ui.categories[category.id] = open;
        scheduleSave();
        buildPanel(snapshot);
      });
      return header;
    }

    /** Build the collapsible slot groups of one category (groups start collapsed). */
    function buildGroups(roots, snapshot) {
      const groups = new Map();
      for (const root of roots) {
        const id = groupIdOf(root);
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(root);
      }
      const out = [];
      for (const [groupId, groupRoots] of groups) {
        const group = document.createElement("div");
        group.className = "dshUiHub_group";
        group.dataset.group = groupId;
        const open = searchQuery.trim() !== "" || !groupCollapsed(groupId);
        const header = document.createElement("div");
        header.className = "dshUiHub_groupHeader";
        header.append(chevron(open));
        const name = document.createElement("span");
        name.className = "dshUiHub_groupName";
        name.textContent = groupId === "floating"
          ? t("groupDefault")
          : groupId === "picked"
            ? t("groupPick")
            : slotGroupName(groupId);
        const slot = document.createElement("span");
        slot.className = "dshUiHub_groupSlot";
        slot.textContent = groupId === "floating" || groupId === "picked" ? groupRoots.length + " UI" : groupId;
        const line = document.createElement("span");
        line.className = "dshUiHub_groupLine";
        const groupToggle = document.createElement("input");
        groupToggle.type = "checkbox";
        groupToggle.className = "dshUiHub_switch";
        groupToggle.checked = groupRoots.some((root) => itemConfig(root.key).on !== false);
        groupToggle.addEventListener("click", (event) => event.stopPropagation());
        groupToggle.addEventListener("change", () => {
          for (const root of groupRoots) setConfig(root.key, { on: groupToggle.checked });
          applyAllStyles(snapshot);
          scheduleUpdate();
        });
        header.append(name, slot, line, groupToggle);
        header.addEventListener("click", () => {
          ensureUiState();
          config.ui.groups[groupId] = open;
          scheduleSave();
          buildPanel(snapshot);
        });
        group.append(header);
        out.push(group);
        if (open) for (const root of groupRoots) out.push(buildRow(root, snapshot));
      }
      return out;
    }

    function buildRow(root, snapshot) {
      const cfg = itemConfig(root.key);
      const row = document.createElement("div");
      row.className = "dshUiHub_row";
      row.dataset.key = root.key;
      if (!cfg.on) row.dataset.off = "";
      const main = document.createElement("div");
      main.className = "dshUiHub_rowMain";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.className = "dshUiHub_switch";
      toggle.checked = cfg.on !== false;
      toggle.setAttribute("aria-label", t("rootOn") + "/" + t("rootOff"));
      toggle.addEventListener("change", () => {
        setConfig(root.key, { on: toggle.checked });
        applyRootStyle(root);
        if (toggle.checked) row.removeAttribute("data-off");
        else row.dataset.off = "";
        updateBadgeFromSnapshot();
        scheduleUpdate();
      });
      const textWrap = document.createElement("div");
      textWrap.className = "dshUiHub_rowText";
      const label = document.createElement("span");
      label.className = "dshUiHub_rowLabel";
      label.textContent = root.label;
      label.title = root.label + " · " + root.key;
      const sub = document.createElement("span");
      sub.className = "dshUiHub_rowSub";
      const originText = root.category === "plugin" && root.plugin !== "" ? root.plugin : t("catOfficial");
      sub.textContent = originText + (root.slot !== undefined && root.slot !== "" ? " · " + t("slot") + " " + root.slot : "");
      textWrap.append(label, sub);
      const modeChip = document.createElement("span");
      modeChip.className = "dshUiHub_modeChip";
      modeChip.textContent = cfg.mode === "float" ? t("modeFloat") : cfg.mode === "nudge" ? t("modeNudge") : t("modeDefault");
      const categoryTag = document.createElement("span");
      categoryTag.className = "dshUiHub_tag " + (root.category === "plugin" ? "plugin" : "official");
      categoryTag.textContent = root.category === "plugin" ? t("catPlugin") : t("catOfficial");
      const expand = document.createElement("button");
      expand.type = "button";
      expand.className = "dshUiHub_expand";
      expand.textContent = "⋯";
      expand.setAttribute("aria-label", root.label);
      expand.addEventListener("click", () => {
        const detail = row.querySelector(".dshUiHub_detail");
        if (detail === null) return;
        const hidden = detail.hasAttribute("hidden");
        detail.hidden = !hidden;
        if (!hidden) {
          ensureDetail(detail, root, snapshot);
          if (handleKey === root.key) positionHandle();
        }
      });
      main.append(toggle, textWrap, modeChip, categoryTag, expand);
      const detail = document.createElement("div");
      detail.className = "dshUiHub_detail";
      detail.hidden = true;
      row.append(main, detail);
      return row;
    }

    function rowFor(key) {
      if (panel === null) return null;
      return panel.querySelector('.dshUiHub_row[data-key="' + key + '"]');
    }

    function ensureDetail(detail, root, snapshot) {
      if (detail.dataset.built === "1") return;
      detail.dataset.built = "1";
      const cfg = itemConfig(root.key);
      const modes = document.createElement("div");
      modes.className = "dshUiHub_modes";
      const modeDefs = [["default", t("modeDefault")], ["nudge", t("modeNudge")], ["float", t("modeFloat")]];
      for (const [mode, modeLabel] of modeDefs) {
        const modeBtn = document.createElement("button");
        modeBtn.type = "button";
        modeBtn.className = "dshUiHub_modeBtn";
        modeBtn.textContent = modeLabel;
        if (cfg.mode === mode) modeBtn.dataset.active = "";
        modeBtn.addEventListener("click", () => {
          setConfig(root.key, { mode });
          applyRootStyle(root);
          detail.querySelectorAll(".dshUiHub_modeBtn").forEach((btn) => delete btn.dataset.active);
          modeBtn.dataset.active = "";
          const chip = rowFor(root.key)?.querySelector(".dshUiHub_modeChip");
          if (chip !== null && chip !== undefined) {
            chip.textContent = mode === "float" ? t("modeFloat") : mode === "nudge" ? t("modeNudge") : t("modeDefault");
          }
          detail.dataset.built = "";
          detail.innerHTML = "";
          ensureDetail(detail, root, snapshot);
          scheduleUpdate();
        });
        modes.append(modeBtn);
      }
      const fields = document.createElement("div");
      fields.className = "dshUiHub_fields";
      const refreshFields = () => {
        fields.innerHTML = "";
        if (cfg.mode === "float") {
          fields.append(
            field(t("xLabel"), cfg.x ?? 0, (value) => { setConfig(root.key, { x: value }); applyRootStyle(root); }),
            field(t("yLabel"), cfg.y ?? 0, (value) => { setConfig(root.key, { y: value }); applyRootStyle(root); }),
          );
        } else if (cfg.mode === "nudge") {
          fields.append(
            field(t("dxLabel"), cfg.dx ?? 0, (value) => { setConfig(root.key, { dx: value }); applyRootStyle(root); }),
            field(t("dyLabel"), cfg.dy ?? 0, (value) => { setConfig(root.key, { dy: value }); applyRootStyle(root); }),
          );
        }
      };
      refreshFields();
      const dragBtn = document.createElement("button");
      dragBtn.type = "button";
      dragBtn.className = "dshUiHub_btn";
      dragBtn.dataset.drag = "";
      dragBtn.textContent = handleKey === root.key ? t("dragStop") : t("dragMove");
      dragBtn.addEventListener("click", () => {
        if (handleKey === root.key) removeHandle();
        else {
          removeHandle();
          handleKey = root.key;
          ensureHandle();
          positionHandle();
        }
        dragBtn.textContent = handleKey === root.key ? t("dragStop") : t("dragMove");
      });
      const lockLabel = document.createElement("label");
      lockLabel.className = "dshUiHub_check";
      const lockInput = document.createElement("input");
      lockInput.type = "checkbox";
      lockInput.checked = cfg.locked === true;
      lockInput.addEventListener("change", () => {
        setConfig(root.key, { locked: lockInput.checked });
        scheduleUpdate();
      });
      lockLabel.append(lockInput, document.createTextNode(t("lock")));
      const resetItem = document.createElement("button");
      resetItem.type = "button";
      resetItem.className = "dshUiHub_btn";
      resetItem.textContent = t("resetItem");
      resetItem.addEventListener("click", () => {
        removeItemConfig(root.key);
        applyRootStyle(root);
        removeHandle();
        scheduleUpdate();
      });
      const actions = document.createElement("div");
      actions.className = "dshUiHub_fields";
      actions.append(dragBtn, lockLabel, resetItem);
      const childrenTitle = document.createElement("div");
      childrenTitle.className = "dshUiHub_groupName";
      childrenTitle.textContent = t("children");
      const childrenWrap = document.createElement("div");
      childrenWrap.dataset.children = "";
      detail.append(modes, fields, actions, childrenTitle, childrenWrap);
      fillChildren(childrenWrap, root);
      detail.dataset.built = "1";
    }

    function fillChildren(childrenWrap, root) {
      childrenWrap.innerHTML = "";
      const children = collectChildren(root.el, root.key, 60);
      if (children.length === 0) {
        const none = document.createElement("div");
        none.className = "dshUiHub_sub";
        none.textContent = "—";
        childrenWrap.append(none);
        return;
      }
      for (const child of children) {
        const cfg = childConfig(child.key);
        const row = document.createElement("div");
        row.className = "dshUiHub_child";
        row.dataset.key = child.key;
        if (!cfg.on) row.dataset.off = "";
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "dshUiHub_switch";
        toggle.checked = cfg.on !== false;
        toggle.addEventListener("change", () => {
          setConfig("child:" + child.key, { on: toggle.checked });
          applyChildStyle(child);
          if (toggle.checked) row.removeAttribute("data-off");
          else row.dataset.off = "";
          updateBadgeFromSnapshot();
        });
        const kind = document.createElement("span");
        kind.className = "dshUiHub_kind " + (child.kind === "icon" || child.kind === "chart" ? child.kind : "");
        kind.textContent = t("kind" + child.kind[0].toUpperCase() + child.kind.slice(1));
        const label = document.createElement("span");
        label.className = "dshUiHub_childText";
        label.textContent = child.label;
        label.title = child.label + " · " + child.key;
        row.append(toggle, kind, label);
        childrenWrap.append(row);
      }
    }

    function updatePanelCounts(snapshot) {
      if (panel === null) return;
      const countsEl = panel.querySelector(".dshUiHub_counts");
      if (countsEl === null) return;
      let hidden = 0;
      for (const root of snapshot.roots) if (itemConfig(root.key).on === false) hidden += 1;
      for (const child of snapshot.children) if (childConfig(child.key).on === false) hidden += 1;
      const parts = [snapshot.roots.length + " UI"];
      if (hidden > 0) parts.push(t("hiddenCount", { n: hidden }));
      if (lastOverlapCount > 0) parts.push(t("overlapCount", { n: lastOverlapCount }));
      const text = parts.join(" · ");
      if (countsEl.textContent !== text) countsEl.textContent = text;
    }

    function updateBadgeFromSnapshot() {
      if (launcher === null) return;
      const snapshot = snapshotCache;
      let hidden = 0;
      for (const root of snapshot.roots) if (itemConfig(root.key).on === false) hidden += 1;
      for (const child of snapshot.children) if (childConfig(child.key).on === false) hidden += 1;
      updateBadge(hidden);
    }

    function applyPanelPosition() {
      if (panel === null || !panel.isConnected) return;
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      const w = panel.offsetWidth || 378;
      const h = panel.offsetHeight || 300;
      let x = config.panel.x;
      let y = config.panel.y;
      if (!isFiniteNumber(x)) x = vw - w - MARGIN;
      if (!isFiniteNumber(y)) y = 136;
      x = clamp(x, 8, Math.max(8, vw - w - 8));
      const top = desktopTopInset() + 8;
      y = clamp(y, top, Math.max(top, vh - Math.min(h, vh - top - 8) - 8));
      panel.style.left = Math.round(x) + "px";
      panel.style.top = Math.round(y) + "px";
    }

    function openPanel() {
      panelOpen = true;
      const snapshot = discover(true);
      buildPanel(snapshot);
      updatePanelCounts(snapshot);
      updateBadgeFromSnapshot();
    }

    function closePanel() {
      panelOpen = false;
      removePanel();
      removeHandle();
    }

    function removePanel() {
      if (panel !== null) {
        panel.remove();
        panel = null;
      }
    }

    function togglePanel() {
      if (panelOpen) closePanel();
      else openPanel();
    }

    function ensureHandle() {
      if (handle !== null && handle.isConnected) return;
      handle = document.createElement("div");
      handle.className = "dshUiHub_handle";
      handle.setAttribute("data-uihub-handle", "");
      handle.setAttribute("aria-label", t("dragMove"));
      handle.textContent = "⤢";
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startCfg = null;
      handle.addEventListener("pointerdown", (event) => {
        if (handleKey === null || event.button !== 0) return;
        const root = discover(true).roots.find((item) => item.key === handleKey);
        if (root === undefined || !root.el.isConnected) return;
        const cfg = itemConfig(handleKey);
        if (!cfg.on) return;
        dragging = false;
        startX = event.clientX;
        startY = event.clientY;
        const wasFloat = cfg.mode === "float";
        startCfg = { x: cfg.x, y: cfg.y, dx: cfg.dx, dy: cfg.dy, mode: cfg.mode };
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture?.(event.pointerId);
        const onMove = (moveEvent) => {
          if (!dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 3) return;
          dragging = true;
          const dx = Math.round(moveEvent.clientX - startX);
          const dy = Math.round(moveEvent.clientY - startY);
          if (wasFloat) {
            cfg.x = Math.round((startCfg.x ?? 0) + dx);
            cfg.y = Math.round((startCfg.y ?? 0) + dy);
          } else {
            if (cfg.mode !== "nudge") setConfig(handleKey, { mode: "nudge" });
            cfg.dx = Math.round((startCfg.dx ?? 0) + dx);
            cfg.dy = Math.round((startCfg.dy ?? 0) + dy);
          }
          applyRootStyle(root);
          positionHandle();
        };
        const onUp = () => {
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          scheduleSave();
          scheduleUpdate();
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
      });
      document.body.appendChild(handle);
    }

    function positionHandle() {
      if (handle === null || handleKey === null) return;
      const root = discover(true).roots.find((item) => item.key === handleKey);
      if (root === undefined || !root.el.isConnected || itemConfig(handleKey).on === false) {
        removeHandle();
        return;
      }
      const rect = visibleRect(root.el);
      if (rect === null) {
        removeHandle();
        return;
      }
      handle.style.left = Math.round(rect.right - 11) + "px";
      handle.style.top = Math.round(rect.top - 11) + "px";
    }

    function removeHandle() {
      if (handle !== null) handle.remove();
      handle = null;
      handleKey = null;
    }

    // ── direct drag mode: move any UI, resize via corner grips ─────────────

    function findRootByKey(key) {
      return discover(false).roots.find((root) => root.key === key);
    }

    function removeDragGrips() {
      for (const grip of dragGrips.values()) grip.remove();
      dragGrips.clear();
    }

    /** Enter/leave the whole-page edit mode: direct drag + resize grips. */
    function setDragMode(on) {
      if (on === dragMode) return;
      dragMode = on;
      if (on) {
        document.body.classList.add("dshUiHub_dragging");
        syncDragGrips(discover(true));
        document.addEventListener("pointerdown", onEditPointerDown, true);
        document.addEventListener("keydown", onEditKeyDown, true);
        toast(t("dragHint"));
      } else {
        document.body.classList.remove("dshUiHub_dragging");
        removeDragGrips();
        editSession = null;
        document.removeEventListener("pointerdown", onEditPointerDown, true);
        document.removeEventListener("keydown", onEditKeyDown, true);
      }
    }

    /** Keep one resize grip at the bottom-right corner of every visible root. */
    function syncDragGrips(snapshot) {
      if (!dragMode) {
        removeDragGrips();
        return;
      }
      const seen = new Set();
      for (const root of snapshot.roots) {
        const cfg = itemConfig(root.key);
        if (cfg.on === false || !root.el.isConnected) continue;
        const rect = visibleRect(root.el);
        if (rect === null) continue;
        seen.add(root.key);
        let grip = dragGrips.get(root.key);
        if (grip === undefined || !grip.isConnected) {
          grip = document.createElement("div");
          grip.className = "dshUiHub_resize";
          grip.dataset.key = root.key;
          grip.setAttribute("data-uihub-ui", "");
          grip.setAttribute("data-uihub-resize", "");
          grip.setAttribute("aria-label", t("dragMode"));
          grip.addEventListener("pointerdown", (event) => startResize(event, root.key));
          document.body.appendChild(grip);
          dragGrips.set(root.key, grip);
        }
        grip.style.left = Math.round(rect.right - 9) + "px";
        grip.style.top = Math.round(rect.bottom - 9) + "px";
      }
      for (const [key, grip] of [...dragGrips]) {
        if (!seen.has(key)) {
          grip.remove();
          dragGrips.delete(key);
        }
      }
    }

    function startResize(event, key) {
      if (event.button !== 0) return;
      const root = findRootByKey(key);
      if (root === undefined || !root.el.isConnected) return;
      const cfg = itemConfig(key);
      if (cfg.on === false) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = root.el.getBoundingClientRect();
      editSession = {
        kind: "resize",
        key,
        startX: event.clientX,
        startY: event.clientY,
        baseW: Math.round(rect.width),
        baseH: Math.round(rect.height),
      };
      window.addEventListener("pointermove", onEditMove, true);
      window.addEventListener("pointerup", onEditUp, true);
    }

    /** Swallow the click that browsers synthesize after a real drag ended. */
    function suppressNextClick(el) {
      const handler = (event) => {
        document.removeEventListener("click", handler, true);
        if (el.isConnected && el.contains(event.target)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      document.addEventListener("click", handler, true);
      setTimeout(() => document.removeEventListener("click", handler, true), 500);
    }

    function onEditPointerDown(event) {
      if (!dragMode || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element) || isOurUI(target)) return;
      const childEl = target.closest("[data-uihub-child]");
      if (childEl !== null) {
        const key = childEl.getAttribute("data-uihub-child");
        if (key === null || key === "" || config.children[key] === undefined) return;
        const cfg = childConfig(key);
        editSession = {
          kind: "child",
          key,
          el: childEl,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          clickSuppressed: false,
          baseDx: isFiniteNumber(cfg.dx) ? cfg.dx : 0,
          baseDy: isFiniteNumber(cfg.dy) ? cfg.dy : 0,
        };
        window.addEventListener("pointermove", onEditMove, true);
        window.addEventListener("pointerup", onEditUp, true);
        return;
      }
      const rootEl = target.closest("[data-uihub-key]");
      if (rootEl === null) return;
      const key = rootEl.getAttribute("data-uihub-key");
      if (key === null || key === "") return;
      const cfg = itemConfig(key);
      if (cfg.on === false) return;
      const rect = rootEl.getBoundingClientRect();
      editSession = {
        kind: "root",
        key,
        el: rootEl,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        clickSuppressed: false,
        baseX: isFiniteNumber(cfg.x) ? cfg.x : Math.round(rect.left),
        baseY: isFiniteNumber(cfg.y) ? cfg.y : Math.round(rect.top),
        baseDx: isFiniteNumber(cfg.dx) ? cfg.dx : 0,
        baseDy: isFiniteNumber(cfg.dy) ? cfg.dy : 0,
      };
      window.addEventListener("pointermove", onEditMove, true);
      window.addEventListener("pointerup", onEditUp, true);
    }

    function onEditMove(event) {
      const session = editSession;
      if (session === null) return;
      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      if (!session.moved && Math.hypot(dx, dy) < 4) return;
      if (!session.moved) {
        session.moved = true;
        // Once this becomes a drag, the trailing click must not reach the
        // plugin's own handlers (it would re-trigger the button we dragged).
        if (!session.clickSuppressed) {
          session.clickSuppressed = true;
          suppressNextClick(session.el);
        }
        event.preventDefault();
      }
      if (session.kind === "child") {
        const cfg = childConfig(session.key);
        cfg.dx = Math.round(session.baseDx + dx);
        cfg.dy = Math.round(session.baseDy + dy);
        if (session.el instanceof Element) applyChildStyle({ key: session.key, el: session.el });
      } else if (session.kind === "root") {
        const root = findRootByKey(session.key);
        if (root === undefined) return;
        const cfg = itemConfig(session.key);
        const inSlot = root.slot !== undefined && root.slot !== "";
        if (inSlot && cfg.mode !== "float") {
          // Slot-mounted React UI keeps its layout box: nudge (translate) is
          // safe and its anchored popups follow the translated rect.
          if (cfg.mode !== "nudge") {
            cfg.mode = "nudge";
            cfg.dx = session.baseDx;
            cfg.dy = session.baseDy;
          }
          cfg.dx = Math.round(session.baseDx + dx);
          cfg.dy = Math.round(session.baseDy + dy);
          applyRootStyle(root);
        } else {
          // Loose floating widgets (and items already explicitly floated)
          // move as a fixed box.
          if (cfg.mode !== "float") {
            cfg.mode = "float";
            cfg.x = session.baseX;
            cfg.y = session.baseY;
          }
          cfg.x = Math.round(session.baseX + dx);
          cfg.y = Math.round(session.baseY + dy);
          applyRootStyle(root);
        }
      } else if (session.kind === "resize") {
        const root = findRootByKey(session.key);
        if (root === undefined) return;
        const cfg = itemConfig(session.key);
        cfg.sw = Math.max(20, Math.round(session.baseW + dx));
        cfg.sh = Math.max(12, Math.round(session.baseH + dy));
        applyRootStyle(root);
      }
      scheduleUpdate();
    }

    function onEditUp() {
      window.removeEventListener("pointermove", onEditMove, true);
      window.removeEventListener("pointerup", onEditUp, true);
      if (editSession !== null && editSession.moved === true) {
        if (!editSession.clickSuppressed) suppressNextClick(editSession.el);
        scheduleSave();
      }
      editSession = null;
      scheduleUpdate();
    }

    function onEditKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDragMode(false);
        if (panelOpen && panel !== null) buildPanel(discover(true));
      }
    }

    function toast(message) {
      if (toastEl === null || !toastEl.isConnected) {
        toastEl = document.createElement("div");
        toastEl.className = "dshUiHub_toast";
        toastEl.setAttribute("data-uihub-ui", "");
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = message;
      toastEl.dataset.show = "";
      clearTimeout(toastEl._timer);
      const element = toastEl;
      toastEl._timer = setTimeout(() => {
        delete element.dataset.show;
      }, 1800);
    }

    function startPick() {
      if (picking) return;
      picking = true;
      document.body.classList.add("dshUiHub_picking");
      pickBar = document.createElement("div");
      pickBar.className = "dshUiHub_pickbar";
      pickBar.setAttribute("data-uihub-ui", "");
      pickBar.setAttribute("data-uihub-pickbar", "");
      pickBar.textContent = t("pickHint");
      document.body.appendChild(pickBar);
      document.addEventListener("pointerover", onPickOver, true);
      document.addEventListener("click", onPickClick, true);
      document.addEventListener("keydown", onPickKey, true);
    }

    function stopPick() {
      if (!picking) return;
      picking = false;
      document.body.classList.remove("dshUiHub_picking");
      if (pickBar !== null) {
        pickBar.remove();
        pickBar = null;
      }
      clearPickHighlight();
      document.removeEventListener("pointerover", onPickOver, true);
      document.removeEventListener("click", onPickClick, true);
      document.removeEventListener("keydown", onPickKey, true);
    }

    function clearPickHighlight() {
      if (pickHighlight !== null) {
        pickHighlight.style.removeProperty("outline");
        pickHighlight.style.removeProperty("outline-offset");
        pickHighlight = null;
      }
    }

    function onPickOver(event) {
      const target = event.target;
      if (!(target instanceof Element) || isOurUI(target)) {
        clearPickHighlight();
        return;
      }
      if (target === pickHighlight) return;
      clearPickHighlight();
      pickHighlight = target;
      pickHighlight.style.outline = "2px dashed var(--dsw-alias-state-business-primary,#4d6bfe)";
      pickHighlight.style.outlineOffset = "1px";
    }

    function onPickKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        stopPick();
      }
    }

    function onPickClick(event) {
      const target = event.target;
      if (!(target instanceof Element) || isOurUI(target)) return;
      event.preventDefault();
      event.stopPropagation();
      stopPick();
      managePickedElement(target);
    }

    function managePickedElement(el) {
      if (isNativeChrome(el)) return;
      // Prefer the managed root that already contains the clicked leaf.
      const existingRoot = el.closest("[data-uihub-key]");
      if (existingRoot instanceof Element) el = existingRoot;
      let key = el.getAttribute("data-uihub-key");
      if (key === null || key === "") {
        key = "pick:" + hashPath(el);
        el.setAttribute("data-uihub-key", key);
      }
      const cfg = itemConfig(key);
      const style = getComputedStyle(el);
      if (style.position === "fixed" || style.position === "absolute") {
        if (cfg.mode === "default") cfg.mode = "float";
      }
      discover(true);
      applyAllStyles(snapshotCache);
      openPanel();
      // Expand the row for the picked item.
      const row = panel !== null ? panel.querySelector('.dshUiHub_row[data-key="' + CSS.escape(key) + '"]') : null;
      if (row !== null) {
        const detail = row.querySelector(".dshUiHub_detail");
        if (detail !== null) {
          detail.hidden = false;
          ensureDetail(detail, snapshotCache.roots.find((root) => root.key === key) || { key, el, slot: "", group: t("groupPick"), label: labelOfRoot(el, "") }, snapshotCache);
        }
        row.scrollIntoView({ block: "nearest" });
      }
      toast(t("toastSaved"));
    }

    // ── hotkey ──────────────────────────────────────────────────────────────

    function onKeyDown(event) {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (event.code !== HOTKEY.code) return;
      if (event.shiftKey !== HOTKEY.shift || event.altKey !== HOTKEY.alt) return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (typeof event.getModifierState === "function" && event.getModifierState("AltGraph")) return;
      event.preventDefault();
      togglePanel();
    }

    // ── reconcile loop ──────────────────────────────────────────────────────

    let rafPending = false;
    let rafId = null;
    let disposed = false;
    let observer = null;
    let resizeObserver = null;

    function scheduleUpdate() {
      if (rafPending || disposed) return;
      rafPending = true;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        rafPending = false;
        if (!disposed) update();
      });
    }

    function update() {
      if (disposed) return;
      const snapshot = discover(false);
      applyAllStyles(snapshot);
      syncPopupFollowers(snapshot);
      let hidden = 0;
      for (const root of snapshot.roots) if (itemConfig(root.key).on === false) hidden += 1;
      for (const child of snapshot.children) if (childConfig(child.key).on === false) hidden += 1;
      updateBadge(hidden);
      if (panelOpen && panel !== null) {
        const active = document.activeElement;
        const focusInside = active instanceof Element && panel.contains(active);
        const sig = panelSignature(snapshot);
        if (!focusInside && panel.dataset.signature !== sig) {
          panel.dataset.signature = sig;
          buildPanel(snapshot);
        } else {
          updatePanelCounts(snapshot);
          // Keep row toggle states honest after external remounts.
          for (const root of snapshot.roots) {
            const row = panel.querySelector('.dshUiHub_row[data-key="' + CSS.escape(root.key) + '"]');
            if (row !== null) {
              const cfg = itemConfig(root.key);
              if (cfg.on === false) row.dataset.off = "";
              else delete row.dataset.off;
            }
          }
        }
      }
      const moved = solveCollisions(snapshot);
      if (moved > 0 && config.global.collision !== "off") {
        // Keep the count for the panel footer.
        lastOverlapCount = moved;
        if (panel !== null && panelOpen) updatePanelCounts(snapshot);
      } else {
        lastOverlapCount = countOverlaps(snapshot);
        if (panel !== null && panelOpen) updatePanelCounts(snapshot);
      }
      positionHandle();
      if (dragMode) syncDragGrips(snapshot);
      applyLauncherPosition();
      applyPanelPosition();
    }

    function countOverlaps(snapshot) {
      const items = floatItems(snapshot);
      let count = 0;
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const ov = overlaps(items[i].rect, items[j].rect);
          if (ov !== null && (config.global.collision === "strict" || (ov.width >= 3 && ov.height >= 3))) count += 1;
        }
      }
      return count;
    }

    function onMutation(mutations) {
      // childList: any structural change may add/remove slot entries or floats.
      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (target?.closest("[data-uihub-ui],[data-uihub-handle]")) continue;
        if (mutation.type === "childList") {
          const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
          if (nodes.length && nodes.every((node) => isOurUI(node))) continue;
          discoveryDirty = true;
          scheduleUpdate();
          return;
        }
        // Attributes: only react when a managed element's box can change.
        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (!(target instanceof Element)) continue;
          const name = mutation.attributeName;
          if (["data-open", "data-slot", "aria-expanded", "hidden", "data-platform", "data-fullscreen"].includes(name)) {
            discoveryDirty = true;
            scheduleUpdate();
            return;
          }
          if ((name === "style" || name === "class") && (isManaged(target) || target.hasAttribute("data-uihub-child") || target.closest("[data-uihub-key]") !== null || target.closest("[data-uihub-child]") !== null)) {
            scheduleUpdate();
            return;
          }
        }
      }
    }

    function onScrollOrResize() {
      scheduleUpdate();
    }

    // ── public API / plugin apply ───────────────────────────────────────────

    function apiItems() {
      const snapshot = discover(true);
      return snapshot.roots.map((root) => {
        const cfg = itemConfig(root.key);
        return {
          key: root.key,
          label: root.label,
          plugin: root.plugin,
          category: root.category,
          slot: root.slot,
          on: cfg.on !== false,
          mode: cfg.mode,
          x: cfg.x,
          y: cfg.y,
          dx: cfg.dx,
          dy: cfg.dy,
          sw: cfg.sw,
          sh: cfg.sh,
          locked: cfg.locked === true,
          children: collectChildren(root.el, root.key, 60).map((child) => {
            const childCfg = childConfig(child.key);
            return { key: child.key, kind: child.kind, label: child.label, on: childCfg.on !== false, dx: childCfg.dx, dy: childCfg.dy };
          }),
        };
      });
    }

    function apply(ctx) {
      ctx.effect(() => {
        // Current DSH may re-activate the same module after a plugin toggle.
        disposed = false;
        rafPending = false;
        panelOpen = false;
        lastOverlapCount = 0;
        config = loadConfig();
        const styleTag = installStyles();
        ensureLauncher();
        const initial = discover(true);
        applyAllStyles(initial);
        updateBadgeFromSnapshot();
        observer = new MutationObserver(onMutation);
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-open", "data-slot", "aria-expanded", "hidden", "style", "class", "data-platform", "data-fullscreen"],
        });
        resizeObserver = new ResizeObserver(scheduleUpdate);
        resizeObserver.observe(document.body);
        document.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
        window.addEventListener("resize", onScrollOrResize);
        window.addEventListener("pagehide", flushSave);
        document.addEventListener("keydown", onKeyDown, true);
        window.dshUiHub = {
          version: PLUGIN_VERSION,
          open: openPanel,
          close: closePanel,
          toggle: togglePanel,
          refresh: () => { discoveryDirty = true; scheduleUpdate(); },
          exportLayout,
          importLayout,
          items: apiItems,
          setConfig: (key, patch) => {
            const ok = setConfig(key, patch);
            if (ok) scheduleUpdate();
            return ok;
          },
          getConfig: (key) => (key === "launcher" ? { ...config.launcher } : itemConfig(key)),
          arrange: () => arrangeNow(discover(true)),
          dragMode: (on) => setDragMode(on !== false),
          isDragMode: () => dragMode,
          pick: startPick,
          collisionMode: (mode) => {
            if (mode === "off" || mode === "strict" || mode === "smart") {
              config.global.collision = mode;
              scheduleSave();
              scheduleUpdate();
            }
            return config.global.collision;
          },
          reset: () => {
            config.items = Object.create(null);
            config.children = Object.create(null);
            config.launcher = defaultConfig().launcher;
            config.panel = defaultConfig().panel;
            applyAllStyles(discover(true));
            applyLauncherPosition();
            scheduleSave();
          },
        };
        try {
          console.info("[dsh-ui-hub] applied v" + PLUGIN_VERSION + " — " + initial.roots.length + " UI roots discovered, hotkey Ctrl+Shift+U");
        } catch (_) {
          /* console may be unavailable in exotic embeds */
        }
        scheduleUpdate();
        return () => {
          disposed = true;
          if (rafId !== null) cancelAnimationFrame(rafId);
          rafId = null;
          rafPending = false;
          setDragMode(false);
          stopPick();
          if (observer !== null) observer.disconnect();
          observer = null;
          if (resizeObserver !== null) resizeObserver.disconnect();
          resizeObserver = null;
          document.removeEventListener("scroll", onScrollOrResize, true);
          window.removeEventListener("resize", onScrollOrResize);
          window.removeEventListener("pagehide", flushSave);
          clearTimeout(discoveryTimer);
          discoveryTimer = null;
          flushSave();
          document.removeEventListener("keydown", onKeyDown, true);
          removeHandle();
          removePanel();
          removeLauncher();
          if (toastEl !== null) {
            clearTimeout(toastEl._timer);
            toastEl.remove();
          }
          toastEl = null;
          // Remove every additive attribute this bundle ever wrote.
          for (const el of document.querySelectorAll("[data-uihub-key], [data-uihub-child], [data-uihub-follow]")) {
            clearElementManagement(el);
          }
          followMap = new Map();
          if (window.dshUiHub !== undefined) {
            try {
              delete window.dshUiHub;
            } catch (_) {
              window.dshUiHub = undefined;
            }
          }
          if (styleTag !== null) styleTag.remove();
        };
      }, "ui-hub: per-widget layout management");
    }

    exports.name = PLUGIN_NAME;
    exports.apply = apply;

    //#endregion

    return module.exports;
  },
});
