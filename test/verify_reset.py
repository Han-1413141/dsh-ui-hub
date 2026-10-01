"""Reset restores every preference together and can be undone as one action."""
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

MOCK = Path(__file__).with_name('mock.html').resolve().as_uri()
COST = 'slot:sidebar.footer.action@0'
OTHER = 'slot:sidebar.footer.action@1'


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1100, 'height': 820})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(MOCK)
        page.wait_for_selector('.dshUiHub_launch')
        # Customize every persistent section, including controls that are absent.
        page.evaluate("""() => {
          const data=window.dshUiHub.exportLayout(), cfg=data.layout;
          cfg.global={collision:'off',revealShortcut:{code:'F8',ctrl:false,alt:false,meta:false,shift:false,mode:'toggle'}};
          cfg.launcher={on:false,x:80,y:160}; cfg.panel={x:70,y:100};
          cfg.ui={categories:{official:false,plugin:false},groups:{'sidebar.footer.action':false,floating:false}};
          cfg.items['slot:sidebar.footer.action@0']={on:false,reveal:false,mode:'nudge',dx:45,dy:13,sw:280,sh:110,locked:true,label:'Custom panel'};
          cfg.items['slot:sidebar.footer.action@1']={on:false,reveal:true,mode:'default'};
          cfg.children['slot:sidebar.footer.action@0#c1']={on:false,reveal:true,dx:18,dy:6};
          window.dshUiHub.importLayout(data);
        }""")
        expect(page.locator('.cm-footer-stack')).to_be_hidden()
        expect(page.locator('.dshUiHub_launch')).to_be_hidden()
        page.keyboard.press('Control+Shift+u')
        expect(page.locator('.dshUiHub_panel')).to_be_visible()
        page.get_by_role('searchbox').fill('custom')
        page.evaluate("document.activeElement.blur(); window.dshUiHub.dragMode(true); window.dshUiHub.pick()")
        page.keyboard.press('F8')
        expect(page.locator('.uw-Msq_entryRow')).to_be_visible()
        before = page.evaluate('window.dshUiHub.exportLayout().layout')
        reset = page.get_by_role('button', name='恢复默认', exact=True)
        expect(reset).to_be_visible()
        assert reset.inner_text() == '恢复默认', 'reset must have a visible label, not just an icon'
        reset.click()

        def assert_defaults():
            cfg = page.evaluate('window.dshUiHub.exportLayout().layout')
            assert cfg['global'] == {'collision': 'smart', 'revealShortcut': {
                'code': 'KeyU', 'ctrl': False, 'meta': False, 'alt': True, 'shift': False, 'mode': 'hold'}}
            assert cfg['launcher'] == {'on': True, 'x': None, 'y': None}
            assert cfg['panel'] == {'x': None, 'y': None}
            assert cfg['ui'] == {'categories': {'official': True, 'plugin': True}, 'groups': {}}
            item = cfg['items'][COST]
            assert item['on'] and not item['reveal'] and item['mode'] == 'default'
            assert item['dx'] == 0 and item['dy'] == 0 and item['sw'] is None and item['sh'] is None
            assert not item['locked'] and item['label'] is None
            assert all(c['on'] and not c['reveal'] and c['dx'] == 0 and c['dy'] == 0 for c in cfg['children'].values())
            expect(page.locator('.cm-footer-stack')).to_be_visible()
            expect(page.locator('.cm-footer-stack button')).to_be_visible()
            expect(page.locator('.uw-Msq_entryRow')).to_be_visible()
            expect(page.locator('.dshUiHub_launch')).to_be_visible()
            assert not page.evaluate('window.dshUiHub.isDragMode()')
            assert page.locator('[data-uihub-pickbar],.dshUiHub_resize,[data-uihub-handle]').count() == 0
            assert not page.locator('body').evaluate("el=>el.classList.contains('dshUiHub_picking')")
            return cfg

        assert_defaults()
        assert page.get_by_role('searchbox').input_value() == ''
        assert page.locator('[data-record-shortcut]').inner_text() == 'Alt+U'
        assert page.locator('[data-shortcut-mode]').input_value() == 'hold'
        assert page.locator('.dshUiHub_global select').input_value() == 'smart'
        stored = page.evaluate("JSON.parse(localStorage.getItem('dsh-ui-hub:layout:v1'))")
        assert stored['global']['collision'] == 'smart' and stored['items'][COST]['on']
        # Resetting cancels a toggled reveal; the old shortcut can no longer reveal.
        page.evaluate('(key)=>window.dshUiHub.setConfig(key,{visibility:"hidden"})', OTHER)
        expect(page.locator('.uw-Msq_entryRow')).to_be_hidden()
        page.keyboard.press('F8')
        expect(page.locator('.uw-Msq_entryRow')).to_be_hidden()
        assert page.evaluate('window.dshUiHub.undo()')  # remove only the probe edit
        page.locator('[data-history=undo]').click()
        restored = page.evaluate('window.dshUiHub.exportLayout().layout')
        for section in ['global', 'launcher', 'panel', 'ui']:
            assert restored[section] == before[section], section
        assert restored['items'][COST] == before['items'][COST]
        assert restored['children'][COST+'#c1'] == before['children'][COST+'#c1']
        assert all(restored['identities'].get(k) == v for k, v in before['identities'].items())
        expect(page.locator('.cm-footer-stack')).to_be_hidden()
        page.locator('[data-history=redo]').click()
        assert_defaults()
        print('PASS labeled reset: visibility, children, layout, shortcuts, collision, chrome and group preferences; one-step undo/redo')

        # The API uses the same complete reset even with no panel; immediate reload keeps it.
        page.evaluate("window.dshUiHub.close(); window.dshUiHub.setConfig('slot:sidebar.footer.action@0',{visibility:'removed'}); window.dshUiHub.collisionMode('strict')")
        assert page.evaluate('window.dshUiHub.reset()')
        assert_defaults()
        assert page.locator('[data-uihub-panel]').count() == 0
        page.reload()
        page.wait_for_selector('.dshUiHub_launch')
        assert_defaults()
        # A reset while dragging must end that gesture, not allow a later move to rewrite defaults.
        launch = page.locator('.dshUiHub_launch').bounding_box()
        page.mouse.move(launch['x']+12, launch['y']+12)
        page.mouse.down()
        page.mouse.move(launch['x']-80, launch['y']+70, steps=3)
        assert page.evaluate('window.dshUiHub.reset()')
        page.mouse.move(20, 220)
        page.mouse.up()
        assert_defaults()
        assert not errors, errors
        print('PASS reset API, immediate persistence/reload, preserved identities and in-flight gesture cleanup')
        browser.close()


if __name__ == '__main__':
    run()
