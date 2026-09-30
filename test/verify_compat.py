"""Web/desktop marker regressions against DSH 0.2.0-rc.2 contracts.

Native-shell E2E is separate; these cases emulate preload-platform/preload-windows.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

MOCK = Path(__file__).with_name("mock.html").resolve().as_uri()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for platform in ("web", "win32", "darwin"):
            context = browser.new_context(viewport={"width": 1000, "height": 760}, accept_downloads=True)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(MOCK + "?platform=" + platform)
            page.wait_for_selector(".dshUiHub_launch")
            page.evaluate("window.dshUiHub.collisionMode('off'); window.dshUiHub.open()")
            page.wait_for_timeout(450)
            page.evaluate("""window.churn = 0; window.churnObserver = new MutationObserver(() => window.churn++);
              window.churnObserver.observe(document.body, {childList:true,subtree:true});""")
            page.wait_for_timeout(400)
            assert page.evaluate("window.churn") == 0, "idle panel is mutating its own DOM"
            page.evaluate("window.churnObserver.disconnect()")
            # Search expands matching groups without persisting their expansion state.
            search = page.get_by_role("searchbox")
            search.fill("DSH-COST-METER")
            assert page.locator(".dshUiHub_row").count() == 1
            assert page.evaluate("document.activeElement.matches('.dshUiHub_search')")
            search.fill("nothing-matches-this")
            assert page.locator(".dshUiHub_row").count() == 0
            search.fill("")
            assert page.locator(".dshUiHub_row").count() == 0
            # Import/export uses an actual downloaded file and input[type=file].
            key = "slot:sidebar.footer.action@0"
            page.evaluate("key => window.dshUiHub.setConfig(key,{on:false,mode:'nudge',dx:38,dy:14})", key)
            page.wait_for_timeout(60)
            with page.expect_download() as saved:
                page.locator("[data-layout-export]").click()
            data = Path(saved.value.path()).read_text(encoding="utf-8")
            assert json.loads(data)["plugin"] == "dsh-ui-hub"
            page.evaluate("window.dshUiHub.reset()")
            page.locator("[data-layout-import]").set_input_files({"name": "layout.json", "mimeType": "application/json", "buffer": data.encode()})
            page.wait_for_function("window.dshUiHub.getConfig('slot:sidebar.footer.action@0').on === false")
            assert page.evaluate("window.dshUiHub.getConfig('slot:sidebar.footer.action@0').dx") == 38
            before = page.evaluate("JSON.stringify(window.dshUiHub.exportLayout())")
            assert page.evaluate("window.dshUiHub.importLayout('{broken')") is False
            assert page.evaluate("window.dshUiHub.importLayout({plugin:'dsh-ui-hub',version:2,layout:{}})") is False
            assert page.evaluate("window.dshUiHub.importLayout({plugin:'dsh-ui-hub',version:1,layout:{v:1,items:{bad:null},children:{}}})") is False
            assert page.evaluate("JSON.stringify(window.dshUiHub.exportLayout())") == before
            # A single insertion just after a scan must eventually be discovered.
            page.evaluate("""() => {
              window.dshUiHub.items();
              const a = document.createElement('div'); a.dataset.slot = 'regression.new-slot';
              const b = document.createElement('button'); b.textContent = 'Late widget'; a.append(b); document.body.append(a);
              const native = document.createElement('div'); native.dataset.windowsMenu = '';
              native.style.cssText = 'position:fixed;top:0;left:48px;width:140px;height:40px'; document.body.append(native);
            }""")
            page.wait_for_function("document.querySelector('[data-slot=\"regression.new-slot\"] button').hasAttribute('data-uihub-key')")
            assert page.locator("[data-windows-menu][data-uihub-key]").count() == 0
            # The complete launcher must remain reachable after a resize/drag.
            page.evaluate("window.dshUiHub.setConfig('launcher',{x:5000,y:0})")
            page.set_viewport_size({"width": 420, "height": 640})
            page.wait_for_timeout(150)
            box = page.locator(".dshUiHub_launch").bounding_box()
            assert box["x"] + box["width"] <= 420
            assert box["y"] >= (48 if platform == "win32" else 40 if platform == "darwin" else 8)
            assert page.evaluate("getComputedStyle(document.querySelector('.dshUiHub_launch')).getPropertyValue('-webkit-app-region')") == "no-drag"
            # Immediate shutdown must flush the pending save and stop delayed work.
            page.evaluate("window.dshUiHub.setConfig('launcher',{x:77}); window.__pluginCleanup()")
            assert page.evaluate("JSON.parse(localStorage.getItem('dsh-ui-hub:layout:v1')).launcher.x") == 77
            page.wait_for_timeout(450)
            assert not errors, errors
            page.evaluate("window.__plugin.apply(window.__pluginCtx); window.dshUiHub.setConfig('slot:sidebar.footer.action@0',{on:true})")
            page.wait_for_function("getComputedStyle(document.querySelector('.cm-footer-stack')).display !== 'none'")
            page.evaluate("window.dshUiHub.setConfig('slot:sidebar.footer.action@0',{on:false}); window.__pluginCleanup()")
            page.reload()
            page.wait_for_selector(".dshUiHub_launch")
            assert page.evaluate("window.dshUiHub.getConfig('slot:sidebar.footer.action@0').on") is False
            print(f"PASS {platform}: idle, search, layout file round-trip, invalid import, remount, native chrome, bounds, cleanup and reactivation")
            context.close()
        browser.close()


if __name__ == "__main__":
    run()
