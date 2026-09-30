"""Exercise three visibility states with real keyboard and UI interactions."""
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

MOCK = Path(__file__).with_name('mock.html').resolve().as_uri()
COST = 'slot:sidebar.footer.action@0'
OTHER = 'slot:sidebar.footer.action@1'


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(MOCK)
        page.wait_for_selector('.dshUiHub_launch')
        page.evaluate("window.dshUiHub.collisionMode('off'); window.dshUiHub.open()")
        cost = page.locator('.cm-footer-stack')
        other = page.locator('.uw-Msq_entryRow')

        def flush():
            page.evaluate('() => new Promise(requestAnimationFrame)')

        def state(key, value):
            page.evaluate('([key,visibility]) => window.dshUiHub.setConfig(key,{visibility})', [key, value])
            flush()

        def shortcut(**patch):
            assert page.evaluate('(patch) => window.dshUiHub.setRevealShortcut(patch)', patch)

        def outside():
            page.evaluate('document.activeElement?.blur()')

        # Use the same controls a user sees; restoring never loses positioning.
        search = page.get_by_role('searchbox')
        search.fill('cost-meter')
        choice = page.locator(f'.dshUiHub_row[data-key="{COST}"] > .dshUiHub_rowMain select')
        choice.select_option('hidden')
        expect(cost).to_be_hidden()
        state(OTHER, 'removed')
        outside()
        page.keyboard.down('Alt')
        page.keyboard.down('u')
        expect(cost).to_be_visible()
        expect(other).to_be_hidden()
        page.keyboard.up('u')
        expect(cost).to_be_hidden()
        page.keyboard.up('Alt')
        # Releasing a modifier first, or leaving the window, must also end a hold.
        page.keyboard.down('Alt')
        page.keyboard.down('u')
        expect(cost).to_be_visible()
        page.keyboard.up('Alt')
        expect(cost).to_be_hidden()
        page.keyboard.up('u')
        page.keyboard.down('Alt')
        page.keyboard.down('u')
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        expect(cost).to_be_hidden()
        page.keyboard.up('u')
        page.keyboard.up('Alt')
        print('PASS hold: hidden controls reveal, removed controls stay absent, key release and blur restore hiding')

        # Toggle uses key edges, not auto-repeat; new DOM inherits current reveal.
        page.locator('[data-shortcut-mode]').select_option('toggle')
        outside()
        page.keyboard.press('Alt+u')
        expect(cost).to_be_visible()
        assert page.evaluate("""() => {
          const e=new KeyboardEvent('keydown',{code:'KeyU',key:'u',altKey:true,repeat:true,bubbles:true,cancelable:true});
          document.dispatchEvent(e); return e.defaultPrevented;
        }""")
        expect(cost).to_be_visible()
        page.evaluate("""() => {
          for (const selector of ['.cm-footer-stack','.uw-Msq_entryRow']) {
            const old=document.querySelector(selector), next=old.cloneNode(true);
            next.removeAttribute('data-uihub-key'); next.removeAttribute('data-uihub-off'); old.replaceWith(next);
          }
          window.dshUiHub.refresh();
        }""")
        expect(other).to_be_hidden()
        expect(cost).to_be_visible()
        page.keyboard.press('Alt+u')
        expect(cost).to_be_hidden()
        print('PASS toggle: one press per transition, repeats ignored, remounts retain both visibility policies')

        # Hidden child respects its parent; a removed child never joins a reveal.
        state(COST, 'shown')
        children = page.evaluate('(key)=>window.dshUiHub.items().find(x=>x.key===key).children', COST)
        button_key = next(c['key'] for c in children if c['kind'] == 'button')
        icon_key = next(c['key'] for c in children if c['kind'] == 'icon')
        page.locator('.dshUiHub_expand').click()
        page.locator(f'.dshUiHub_child[data-key="{button_key}"] select').select_option('hidden')
        page.locator(f'.dshUiHub_child[data-key="{icon_key}"] select').select_option('removed')
        button, icon = cost.locator('button'), cost.locator('svg')
        expect(button).to_be_hidden()
        outside()
        page.keyboard.press('Alt+u')
        expect(button).to_be_visible()
        expect(icon).to_be_hidden()
        state(COST, 'removed')
        expect(cost).to_be_hidden()
        page.keyboard.press('Alt+u')
        page.keyboard.press('Alt+u')
        expect(cost).to_be_hidden()
        page.keyboard.press('Alt+u')
        state(COST, 'shown')
        expect(button).to_be_hidden()
        expect(icon).to_be_hidden()
        print('PASS nested controls: independent child states and removed-parent precedence')

        state(COST, 'hidden')
        # Typing, IME, AltGraph and already-handled keystrokes are left alone.
        for markup in ['<input>', '<textarea></textarea>', '<div contenteditable="true"><span>edit</span></div>', '<input id="shadow-input">']:
            page.evaluate("""markup => {
              document.querySelector('#editor-fixture')?.remove();
              const wrap=document.createElement('div'); wrap.id='editor-fixture'; document.body.append(wrap);
              if(markup.includes('shadow-input')) { const root=wrap.attachShadow({mode:'open'}); root.innerHTML=markup; root.querySelector('input').focus(); }
              else {wrap.innerHTML=markup; wrap.firstElementChild.focus();}
            }""", markup)
            page.keyboard.press('Alt+u')
            expect(cost).to_be_hidden()
        page.evaluate("document.querySelector('#editor-fixture').remove()")
        for kind in ['composition', 'altgraph', 'handled']:
            page.evaluate("""kind => {
              const event = new KeyboardEvent('keydown',{code:'KeyU',key:'u',altKey:true,bubbles:true,cancelable:true,isComposing:kind==='composition'});
              if(kind==='altgraph') Object.defineProperty(event,'getModifierState',{value:key=>key==='AltGraph'});
              if(kind==='handled') event.preventDefault();
              document.dispatchEvent(event);
            }""", kind)
            expect(cost).to_be_hidden()
        print('PASS editing safety: inputs, contenteditable, shadow DOM, IME, AltGraph and consumed events')

        # Record a shortcut; Esc cancels, panel shortcut is reserved, undo restores settings.
        record = page.locator('[data-record-shortcut]')
        record.click()
        page.keyboard.press('Escape')
        expect(page.locator('.dshUiHub_panel')).to_be_visible()
        assert page.evaluate('window.dshUiHub.getRevealShortcut().code') == 'KeyU'
        record.click()
        page.keyboard.press('Control+Shift+u')
        assert page.evaluate('window.dshUiHub.getRevealShortcut().code') == 'KeyU'
        page.keyboard.press('F8')
        assert page.evaluate('window.dshUiHub.getRevealShortcut().code') == 'F8'
        assert page.evaluate('window.dshUiHub.undo()')
        assert page.evaluate('window.dshUiHub.getRevealShortcut().code') == 'KeyU'
        assert page.evaluate('window.dshUiHub.redo()')
        outside()
        page.keyboard.press('Alt+u')
        expect(cost).to_be_hidden()
        page.keyboard.press('F8')
        expect(cost).to_be_visible()
        # The temporary reveal flag must not survive export/import or a reload.
        backup = page.evaluate('window.dshUiHub.exportLayout()')
        assert backup['layout']['items'][COST]['on'] is False
        assert backup['layout']['items'][COST]['reveal'] is True
        assert page.evaluate('(data)=>window.dshUiHub.importLayout(data)', backup)
        expect(cost).to_be_hidden()
        outside()
        page.keyboard.press('F8')
        expect(cost).to_be_visible()
        page.evaluate('window.__pluginCleanup()')
        page.reload()
        page.wait_for_selector('.dshUiHub_launch')
        expect(cost).to_be_hidden()
        expect(other).to_be_hidden()
        assert page.evaluate('window.dshUiHub.getRevealShortcut().code') == 'F8'
        print('PASS shortcut recording, reserved keys, undo/redo and persisted settings without persisted reveal')

        # Legacy on:false still means always absent, even with new shortcuts.
        legacy = page.evaluate('window.dshUiHub.exportLayout()')
        legacy['layout']['items'][COST] = {'on': False, 'mode': 'nudge', 'dx': 37}
        assert page.evaluate('(data)=>window.dshUiHub.importLayout(data)', legacy)
        page.keyboard.press('F8')
        expect(cost).to_be_hidden()
        state(COST, 'shown')
        expect(cost).to_be_visible()
        assert page.evaluate('(key)=>window.dshUiHub.getConfig(key).dx', COST) == 37
        assert page.evaluate('window.dshUiHub.undo()')
        expect(cost).to_be_hidden()
        # Disable while holding; hot reload must not leave stale keyboard listeners.
        shortcut(mode='hold', code='KeyJ', meta=True, ctrl=False, alt=False, shift=True)
        page.evaluate("document.documentElement.dataset.platform='darwin'")
        state(COST, 'hidden')
        page.keyboard.down('Meta')
        page.keyboard.down('Shift')
        page.keyboard.down('j')
        expect(cost).to_be_visible()
        page.evaluate('window.__pluginCleanup()')
        expect(other).to_be_visible()
        page.keyboard.up('j')
        page.keyboard.up('Shift')
        page.keyboard.up('Meta')
        page.evaluate('window.__plugin.apply(window.__pluginCtx)')
        expect(cost).to_be_hidden()
        shortcut(mode='toggle')
        page.keyboard.press('Meta+Shift+j')
        expect(cost).to_be_visible()
        page.keyboard.press('Meta+Shift+j')
        expect(cost).to_be_hidden()
        assert not errors, errors
        print('PASS legacy migration, restore without losing layout, macOS modifiers and unload/re-enable cleanup')
        browser.close()


if __name__ == '__main__':
    run()
