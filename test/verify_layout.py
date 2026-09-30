"""Regression scenarios for layout identity, editing and history.

The same controls are reordered/remounted to model React and plugin changes.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

MOCK = Path(__file__).with_name('mock.html').resolve().as_uri()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1100, 'height': 820})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("""if (!localStorage.getItem('dsh-ui-hub:layout:v1')) {
          localStorage.setItem('dsh-ui-hub:layout:v1', JSON.stringify({v:1, global:{collision:'off'},
            items:{'slot:sidebar.footer.action@0':{on:false,mode:'nudge',dx:42}},children:{}}));
        }""")
        page.goto(MOCK)
        page.wait_for_selector('.dshUiHub_launch')
        page.evaluate("window.dshUiHub.collisionMode('off')")
        cost = 'slot:sidebar.footer.action@0'
        assert not page.locator('.cm-footer-stack').is_visible(), 'pre-upgrade layout must migrate'
        page.evaluate("key => window.dshUiHub.setConfig(key,{on:false,mode:'nudge',dx:42})", cost)
        page.wait_for_function("getComputedStyle(document.querySelector('.cm-footer-stack')).display === 'none'")
        # Insert at the old ordinal, then reorder and replace the original root.
        page.evaluate("""() => {
          const slot = document.querySelector('[data-slot="sidebar.footer.action"]');
          const added = document.createElement('button'); added.id='new-widget'; added.textContent='New plugin';
          slot.prepend(added); slot.append(slot.querySelector('.cm-footer-stack'));
        }""")
        page.wait_for_function("document.querySelector('#new-widget').hasAttribute('data-uihub-key')")
        assert page.locator('.cm-footer-stack').get_attribute('data-uihub-key') == cost
        assert page.locator('#new-widget').is_visible()
        assert page.locator('#new-widget').get_attribute('data-uihub-key') != cost
        page.evaluate("""() => {
          const old=document.querySelector('.cm-footer-stack'), next=old.cloneNode(true);
          next.removeAttribute('data-uihub-key'); next.removeAttribute('data-uihub-off');
          next.removeAttribute('data-uihub-nudge'); next.removeAttribute('style'); old.replaceWith(next);
        }""")
        page.wait_for_function("document.querySelector('.cm-footer-stack').getAttribute('data-uihub-key') === 'slot:sidebar.footer.action@0'")
        assert not page.locator('.cm-footer-stack').is_visible()
        # Persisted mapping survives a reload with a different initial DOM order.
        page.evaluate("window.__pluginCleanup()")
        page.add_init_script("""document.addEventListener('DOMContentLoaded', () => {
          const slot=document.querySelector('[data-slot="sidebar.footer.action"]');
          slot.prepend(slot.lastElementChild);
        });""")
        page.reload()
        page.wait_for_selector('.dshUiHub_launch')
        assert page.locator('.cm-footer-stack').get_attribute('data-uihub-key') == cost
        assert not page.locator('.cm-footer-stack').is_visible()
        assert page.locator('.uw-Msq_entryRow').is_visible()
        print('PASS stable root identity: insert, reorder, remount, reload and old layout keys')

        # Children retain their own visibility when a sibling is inserted ahead.
        page.evaluate("window.dshUiHub.setConfig('slot:sidebar.footer.action@0',{on:true}); window.dshUiHub.open()")
        page.evaluate("window.dshUiHub.setConfig('child:slot:sidebar.footer.action@0#c1',{on:false})")
        page.evaluate("""() => { const b=document.createElement('button'); b.id='extra-action'; b.textContent='Extra';
          document.querySelector('.cm-chip').prepend(b); }""")
        page.wait_for_function("document.querySelector('#extra-action').hasAttribute('data-uihub-child')")
        assert page.locator('.cm-footer-stack .mock-button').get_attribute('data-uihub-child') == cost + '#c1'
        assert not page.locator('.cm-footer-stack .mock-button').is_visible()
        assert page.locator('#extra-action').is_visible()
        print('PASS child identity: inserting an action never inherits a hidden sibling setting')

        # The first click opens a usable detail editor, and searches keep focus.
        search = page.get_by_role('searchbox')
        search.fill('cost-meter')
        page.locator('.dshUiHub_expand').click()
        assert page.locator('.dshUiHub_detail .dshUiHub_modeBtn').count() == 3
        assert page.locator('.dshUiHub_detail').is_visible()
        page.evaluate("window.dshUiHub.setConfig('slot:sidebar.footer.action@0',{mode:'float',x:120,y:150})")
        page.wait_for_function("document.querySelector('.dshUiHub_detail input[type=number]')?.value === '120'")
        page.locator('.dshUiHub_detail .dshUiHub_modeBtn').filter(has_text='微调').click()
        assert page.locator('.dshUiHub_detail').is_visible()
        search.fill('cost')
        page.evaluate("""() => { const b=document.createElement('button'); b.id='another-widget'; b.textContent='Cost widget';
          document.querySelector('[data-slot="sidebar.footer.action"]').append(b); }""")
        page.wait_for_function("document.querySelector('#another-widget').hasAttribute('data-uihub-key')")
        assert search.input_value() == 'cost'
        assert search.evaluate('(el)=>document.activeElement === el')
        print('PASS details and search: first expansion, live values, focus and open detail survive updates')

        # One group action is one undo, including mixed visibility.
        search.fill('sidebar.footer.action')
        group = page.locator('.dshUiHub_group[data-group="sidebar.footer.action"]').filter(has=page.locator('.dshUiHub_groupButton'))
        # The slot has both official and plugin entries, so operate on the plugin group.
        group = group.last
        page.evaluate("window.dshUiHub.setConfig('slot:sidebar.footer.action@0',{on:false})")
        page.wait_for_timeout(80)
        toggle = group.locator('input')
        assert toggle.evaluate('(el)=>el.indeterminate')
        toggle.click()
        page.wait_for_timeout(80)
        assert page.evaluate("window.dshUiHub.getConfig('slot:sidebar.footer.action@0').on")
        page.locator('[data-history=undo]').click()
        assert not page.evaluate("window.dshUiHub.getConfig('slot:sidebar.footer.action@0').on")
        page.locator('[data-history=redo]').click()
        assert page.evaluate("window.dshUiHub.getConfig('slot:sidebar.footer.action@0').on")
        page.evaluate("window.dshUiHub.reset()")
        assert page.evaluate("window.dshUiHub.getConfig('slot:sidebar.footer.action@0').mode") == 'default'
        assert page.evaluate('window.dshUiHub.undo()')
        assert page.evaluate("window.dshUiHub.getConfig('slot:sidebar.footer.action@0').mode") == 'nudge'
        print('PASS history: mixed groups, atomic group undo/redo and reset recovery')

        # A blocked storage write is visible, while export and editing still work.
        page.evaluate("""() => {
          window.realSetItem=Storage.prototype.setItem;
          Storage.prototype.setItem=()=>{throw new DOMException('quota','QuotaExceededError')};
          window.dshUiHub.setConfig('slot:sidebar.footer.action@0',{dx:73});
        }""")
        page.wait_for_function("document.querySelector('[data-save-status]').dataset.state === 'failed'")
        assert page.evaluate("window.dshUiHub.exportLayout().layout.items['slot:sidebar.footer.action@0'].dx") == 73
        page.evaluate("Storage.prototype.setItem=window.realSetItem; window.dshUiHub.setConfig('slot:sidebar.footer.action@0',{dx:74})")
        page.wait_for_function("document.querySelector('[data-save-status]').dataset.state === 'saved'")
        page.keyboard.press('Escape')
        assert page.locator('[data-uihub-panel]').count() == 0
        assert page.locator('.dshUiHub_launch').evaluate('(el)=>document.activeElement===el')
        assert not errors, errors
        print('PASS persistence failure is visible and recoverable; Escape restores launcher focus')
        # Unloading during a drag must remove global listeners and retain the edit.
        launch = page.locator('.dshUiHub_launch').bounding_box()
        page.mouse.move(launch['x']+12, launch['y']+12)
        page.mouse.down()
        page.mouse.move(launch['x']-60, launch['y']+50, steps=4)
        page.evaluate('window.__pluginCleanup()')
        page.mouse.move(20, 20)
        page.mouse.up()
        page.wait_for_timeout(50)
        assert not errors, errors
        print('PASS unloading during launcher drag cleans up pending gestures')
        browser.close()


if __name__ == '__main__':
    run()
