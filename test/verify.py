"""Verify dsh-ui-hub against the mock DSH DOM harness.

Run: python test/verify.py
Uses Playwright chromium (headless) over a file:// mock page that reproduces
the [data-slot] anchor contract plus floating third-party widgets.
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

MOCK = Path(__file__).resolve().parent / "mock.html"
FAILED = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    line = f"[{status}] {name}" + (f" -- {detail}" if detail else "")
    print(line)
    if not cond:
        FAILED.append(name)


def overlap_js(a_key, b_key):
    return f"""(() => {{
      const a = document.querySelector('[data-uihub-key="{a_key}"]');
      const b = document.querySelector('[data-uihub-key="{b_key}"]');
      if (!a || !b) return null;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      return w > 0 && h > 0 ? {{w, h}} : null;
    }})()"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(MOCK.as_uri())
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(250)

        def eval_js(expr):
            return page.evaluate(expr)

        def items():
            return eval_js("window.dshUiHub.items()")

        def find(key):
            key_js = json.dumps(key)
            return eval_js(f"""(() => {{
              const el = document.querySelector('[data-uihub-key={key_js}]');
              return el ? {{
                tag: el.tagName.toLowerCase(),
                display: getComputedStyle(el).display,
                position: getComputedStyle(el).position,
                left: getComputedStyle(el).left,
                top: getComputedStyle(el).top,
                rect: (() => {{ const r = el.getBoundingClientRect(); return {{x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom)}}; }})()
              }} : null;
            }})()""")

        def set_cfg(key, patch):
            return eval_js(f"window.dshUiHub.setConfig({json.dumps(key)}, {json.dumps(patch)})")

        # --- 1. boot ---------------------------------------------------------
        check("plugin registered as ui-hub", eval_js("window.__plugin && window.__plugin.name") == "ui-hub")
        check("debug handle exposed", eval_js("window.dshUiHub && window.dshUiHub.version") == "0.1.0")
        check("style tag injected", eval_js(
            "!!document.querySelector('style[data-plugin=\"dsh-ui-hub\"]')"))
        check("launcher visible", eval_js(
            "!!document.querySelector('[data-uihub-ui].dshUiHub_launch')"))

        # --- 2. discovery ----------------------------------------------------
        roots = items()
        keys = [r["key"] for r in roots]
        check("discovered slot roots", "slot:sidebar.footer.action@0" in keys and "slot:conversation.session.header.actions@0" in keys, str(keys))
        check("discovered composer dock chart", "slot:conversation.composer.dock@1" in keys, str(keys))
        check("discovered loose sticky pill", "loose:stickyDisclosureControl=1" in keys, str(keys))
        check("discovered loose chart widget", "loose:demoChartWidget=1" in keys, str(keys))
        cost = next((r for r in roots if r["key"] == "slot:sidebar.footer.action@0"), None)
        check("cost meter root labelled", cost is not None and "今日费用" in cost["label"], str(cost))
        check("cost meter classified as plugin UI", cost is not None and cost["category"] == "plugin", str(cost))
        header = next((r for r in roots if r["key"] == "slot:conversation.session.header.actions@0"), None)
        check("header action classified as official UI", header is not None and header["category"] == "official", str(header))
        kinds = [c["kind"] for c in (cost or {}).get("children", [])]
        check("cost meter children = button + icon", "button" in kinds and "icon" in kinds, str(kinds))
        chart = next((r for r in roots if r["key"] == "slot:conversation.composer.dock@1"), None)
        chart_kinds = [c["kind"] for c in (chart or {}).get("children", [])]
        check("chart root child classified chart", "chart" in chart_kinds, str(chart_kinds))

        # --- 3. per-root and per-child toggle ---------------------------------
        set_cfg("slot:sidebar.footer.action@0", {"on": False})
        page.wait_for_timeout(500)
        state = find("slot:sidebar.footer.action@0")
        check("root toggle hides cost panel", state is not None and state["display"] == "none", str(state))
        saved = eval_js("JSON.parse(localStorage.getItem('dsh-ui-hub:layout:v1') || 'null')")
        check("hidden state persisted", saved is not None and saved["items"]["slot:sidebar.footer.action@0"]["on"] is False)
        set_cfg("slot:sidebar.footer.action@0", {"on": True})
        page.wait_for_timeout(80)
        state = find("slot:sidebar.footer.action@0")
        check("root toggle restores cost panel", state is not None and state["display"] != "none", str(state))
        icon_key = next((c["key"] for c in (next(r for r in items() if r["key"] == "slot:sidebar.footer.action@0"))["children"] if c["kind"] == "icon"), None)
        check("found child icon key", icon_key is not None, str(icon_key))
        set_cfg("child:" + icon_key, {"on": False})
        page.wait_for_timeout(80)
        icon_state = eval_js(f"""(() => {{
          const el = document.querySelector('[data-uihub-child="{icon_key}"]');
          return el ? getComputedStyle(el).display : 'missing';
        }})()""")
        check("child icon toggle hides only the icon", icon_state == "none", str(icon_state))
        set_cfg("child:" + icon_key, {"on": True})
        page.wait_for_timeout(80)

        # --- 4. float positioning --------------------------------------------
        set_cfg("slot:conversation.composer.dock@1", {"mode": "float", "x": 300, "y": 400})
        page.wait_for_timeout(120)
        state = find("slot:conversation.composer.dock@1")
        check("float mode makes chart fixed", state is not None and state["position"] == "fixed", str(state))
        check("float mode applies exact x/y", state is not None and state["left"] == "300px" and state["top"] == "400px", str(state))

        # --- 5. auto arrange --------------------------------------------------
        set_cfg("loose:stickyDisclosureControl=1", {"mode": "float", "x": 480, "y": 220})
        set_cfg("loose:demoChartWidget=1", {"mode": "float", "x": 500, "y": 230})
        page.wait_for_timeout(80)
        placed = eval_js("window.dshUiHub.arrange()")
        page.wait_for_timeout(350)
        sticky_rect = find("loose:stickyDisclosureControl=1")["rect"]
        chart_rect = find("loose:demoChartWidget=1")["rect"]
        ov = eval_js(overlap_js("loose:stickyDisclosureControl=1", "loose:demoChartWidget=1"))
        check("auto arrange moved items", placed >= 2, str(placed))
        check("auto arrange items do not overlap", ov is None, str(ov))
        check("auto arrange right-aligns column", abs(sticky_rect["right"] - chart_rect["right"]) <= 2, f"{sticky_rect} vs {chart_rect}")

        # --- 6. strict collision avoidance ------------------------------------
        eval_js("window.dshUiHub.collisionMode('strict')")
        set_cfg("slot:conversation.session.header.actions@0", {"mode": "float", "x": 600, "y": 500})
        set_cfg("slot:conversation.session.header.actions@1", {"mode": "float", "x": 610, "y": 510})
        page.wait_for_timeout(180)
        ov = eval_js(overlap_js("slot:conversation.session.header.actions@0", "slot:conversation.session.header.actions@1"))
        check("strict mode separates forced overlap", ov is None, str(ov))

        # --- 7. panel: collapsed categories, hotkey ---------------------------
        eval_js("window.dshUiHub.open()")
        page.wait_for_timeout(60)
        check("panel opens", eval_js("!!document.querySelector('[data-uihub-panel]')"))
        cats = eval_js("document.querySelectorAll('[data-uihub-panel] [data-cat]').length")
        check("panel shows official/plugin categories", cats == 2, str(cats))
        chev_closed = eval_js("""(() => {
          const c = document.querySelector('[data-uihub-panel] [data-cat] .dshUiHub_chev');
          const s = getComputedStyle(c);
          return { top: s.borderTopWidth, right: s.borderRightWidth, left: s.borderLeftWidth, transform: s.transform };
        })()""")
        check("category exposes collapsed state to keyboard and screen readers",
              eval_js("document.querySelector('[data-cat=plugin]').matches('button[aria-expanded=false]')"))
        rows = eval_js("document.querySelectorAll('[data-uihub-panel] .dshUiHub_row').length")
        check("all categories collapsed by default (no rows)", rows == 0, str(rows))
        eval_js("document.querySelector('[data-uihub-panel] [data-cat=plugin]').click()")
        page.wait_for_timeout(60)
        chev_open = eval_js("""(() => {
          const c = document.querySelector('[data-uihub-panel] [data-cat=plugin] .dshUiHub_chev');
          return getComputedStyle(c).transform;
        })()""")
        check("chevron rotates when expanded", chev_open != chev_closed["transform"], f"{chev_closed['transform']} -> {chev_open}")
        groups = eval_js("document.querySelectorAll('[data-uihub-panel] .dshUiHub_group').length")
        rows = eval_js("document.querySelectorAll('[data-uihub-panel] .dshUiHub_row').length")
        check("expanded category shows groups, still collapsed", groups >= 1 and rows == 0, f"groups={groups} rows={rows}")
        page.locator('[data-uihub-panel] .dshUiHub_groupButton').first.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(60)
        rows = eval_js("document.querySelectorAll('[data-uihub-panel] .dshUiHub_row').length")
        check("expanded group lists its UI rows", rows >= 1, str(rows))
        eval_js("window.dshUiHub.close()")
        page.wait_for_timeout(60)
        check("panel closes", eval_js("!document.querySelector('[data-uihub-panel]')"))
        eval_js("""document.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyU', ctrlKey:true, shiftKey:true, bubbles:true, cancelable:true}))""")
        page.wait_for_timeout(80)
        check("hotkey opens panel", eval_js("!!document.querySelector('[data-uihub-panel]')"))
        eval_js("""document.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyU', ctrlKey:true, shiftKey:true, bubbles:true, cancelable:true}))""")
        page.wait_for_timeout(80)
        check("hotkey closes panel", eval_js("!document.querySelector('[data-uihub-panel]')"))

        # --- 8. pick mode -------------------------------------------------------
        eval_js("window.dshUiHub.pick()")
        check("pick bar shows", eval_js("!!document.querySelector('[data-uihub-pickbar]')"))
        page.mouse.click(680, 60)
        page.wait_for_timeout(160)
        new_keys = [r["key"] for r in items() if r["key"].startswith("pick:")]
        check("pick captured an element", len(new_keys) == 1, str(new_keys))
        check("pick bar removed after capture", eval_js("!document.querySelector('[data-uihub-pickbar]')"))

        # --- 9. direct drag mode: move + resize ----------------------------------
        eval_js("window.dshUiHub.dragMode(true)")
        page.wait_for_timeout(120)
        check("drag mode class applied", eval_js("document.body.classList.contains('dshUiHub_dragging')"))
        grips = eval_js("document.querySelectorAll('[data-uihub-resize]').length")
        check("resize grips created for visible UIs", grips >= 3, str(grips))
        target_key = "slot:sidebar.footer.action@1"
        before = find(target_key)
        center = eval_js(f"""(() => {{
          const el = document.querySelector('[data-uihub-key={json.dumps(target_key)}]');
          const r = el.getBoundingClientRect();
          return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }};
        }})()""")
        page.mouse.move(center["x"], center["y"])
        page.mouse.down()
        page.mouse.move(center["x"] + 80, center["y"] - 60, steps=5)
        page.mouse.up()
        page.wait_for_timeout(400)
        after = find(target_key)
        moved_item = next((r for r in items() if r["key"] == target_key), None)
        check("direct drag keeps slot UI in layout (nudge)", moved_item is not None and moved_item["mode"] == "nudge", str(moved_item))
        check("direct drag moved the UI", after is not None and abs(after["rect"]["x"] - before["rect"]["x"] - 80) <= 6 and abs(after["rect"]["y"] - before["rect"]["y"] + 60) <= 6, f"{before} -> {after}")
        grip_center = eval_js(f"""(() => {{
          const g = document.querySelector('[data-uihub-resize][data-key={json.dumps(target_key)}]');
          if (!g) return null;
          const r = g.getBoundingClientRect();
          return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }};
        }})()""")
        check("resize grip follows dragged item", grip_center is not None, str(grip_center))
        page.mouse.move(grip_center["x"], grip_center["y"])
        page.mouse.down()
        page.mouse.move(grip_center["x"] + 50, grip_center["y"] + 30, steps=5)
        page.mouse.up()
        page.wait_for_timeout(400)
        resized = find(target_key)
        check("resize grip widens the UI", resized is not None and resized["rect"]["w"] >= before["rect"]["w"] + 40, f"{before} -> {resized}")
        check("resize grip heightens the UI", resized is not None and resized["rect"]["h"] >= before["rect"]["h"] + 20, f"{before} -> {resized}")

        # Dragging must not synthesize a click on the dragged button; a plain
        # click inside drag mode must still pass through to the plugin.
        click_key = "slot:conversation.session.header.actions@0"
        set_cfg(click_key, {"mode": "default"})
        set_cfg("slot:conversation.session.header.actions@1", {"mode": "default"})
        page.wait_for_timeout(400)
        click_before = find(click_key)
        center2 = eval_js(f"""(() => {{
          const el = document.querySelector('[data-uihub-key={json.dumps(click_key)}]');
          const r = el.getBoundingClientRect();
          return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }};
        }})()""")
        count_before = eval_js("window.__clickCount")
        page.mouse.move(center2["x"], center2["y"])
        page.mouse.down()
        page.mouse.move(center2["x"] + 60, center2["y"] + 40, steps=5)
        page.mouse.up()
        page.wait_for_timeout(150)
        check("drag does not re-trigger the button click", eval_js("window.__clickCount") == count_before, f"before={count_before} after={eval_js('window.__clickCount')}")
        page.wait_for_timeout(650)
        moved_click = find(click_key)
        center3 = eval_js(f"""(() => {{
          const el = document.querySelector('[data-uihub-key={json.dumps(click_key)}]');
          const r = el.getBoundingClientRect();
          return {{ x: r.left + r.width / 2, y: r.top + r.height / 2 }};
        }})()""")
        page.mouse.click(center3["x"], center3["y"])
        page.wait_for_timeout(150)
        hit = eval_js(f"""(() => {{
          const n = document.elementFromPoint({center3['x']}, {center3['y']});
          const b = document.querySelector('[data-uihub-key={json.dumps(click_key)}]').getBoundingClientRect();
          const s = document.querySelector('.spacer').getBoundingClientRect();
          return {{
            hit: n ? n.outerHTML.slice(0, 120) : 'none',
            button: {{x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height)}},
            spacer: {{x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.width), h: Math.round(s.height)}},
          }};
        }})()""")
        check("plain click still works in drag mode", eval_js("window.__clickCount") == count_before + 1, f"count={eval_js('window.__clickCount')} center={center3} hit={hit}")
        check("dragged button ended up nudged", find(click_key)["rect"]["x"] - moved_click["rect"]["x"] <= 2)

        # Popup follower: float the button away, then its click opens a menu at
        # the original spot; the follower must translate it to the floated spot.
        eval_js("window.dshUiHub.collisionMode('off')")
        set_cfg(click_key, {"mode": "default"})
        page.wait_for_timeout(400)
        set_cfg(click_key, {"mode": "float", "x": 500, "y": 300})
        page.wait_for_timeout(400)
        eval_js(f"""(() => {{
          const el = document.querySelector('[data-uihub-key={json.dumps(click_key)}]');
          el.click();
        }})()""")
        page.wait_for_timeout(400)
        popup_state = eval_js(f"""(() => {{
          const p = document.querySelector('[data-test-popup]');
          if (!p) return null;
          const pr = p.getBoundingClientRect();
          const b = document.querySelector('[data-uihub-key={json.dumps(click_key)}]').getBoundingClientRect();
          return {{
            follow: p.hasAttribute('data-uihub-follow'),
            popupX: Math.round(pr.x), popupY: Math.round(pr.y),
            buttonX: Math.round(b.x), buttonY: Math.round(b.y),
            translate: getComputedStyle(p).translate,
          }};
        }})()""")
        check("popup anchored to original spot follows floated UI",
              popup_state is not None and popup_state["follow"]
              and abs(popup_state["popupX"] - popup_state["buttonX"]) <= 10
              and abs(popup_state["popupY"] - popup_state["buttonY"]) <= 10, str(popup_state))

        eval_js("window.dshUiHub.dragMode(false)")
        page.wait_for_timeout(60)
        check("drag mode exits cleanly", eval_js("!document.body.classList.contains('dshUiHub_dragging') && document.querySelectorAll('[data-uihub-resize]').length === 0"))

        # --- 10. persistence across reload ---------------------------------------
        set_cfg("slot:sidebar.footer.action@0", {"on": False})
        page.wait_for_timeout(500)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(250)
        state = find("slot:sidebar.footer.action@0")
        check("toggle survives reload", state is not None and state["display"] == "none", str(state))

        # --- 10. teardown restores DOM -------------------------------------------
        eval_js("window.__pluginCleanup()")
        page.wait_for_timeout(60)
        leftover = eval_js("document.querySelectorAll('[data-uihub-key], [data-uihub-child], [data-uihub-follow], [data-uihub-ui]').length")
        check("teardown removes managed attributes & chrome", leftover == 0, str(leftover))
        check("teardown removes stylesheet", eval_js(
            "!document.querySelector('style[data-plugin=\"dsh-ui-hub\"]')"))
        check("teardown removes debug handle", eval_js("window.dshUiHub === undefined"))

        browser.close()

    print(f"\n{len(FAILED)} failed / total checks")
    if FAILED:
        print("FAILED:", *FAILED, sep="\n  - ")
        sys.exit(1)


if __name__ == "__main__":
    main()
