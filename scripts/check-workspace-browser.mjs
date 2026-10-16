// Uses a dedicated disposable Chrome profile, as documented in workspace-validation.md.
import assert from 'node:assert/strict'
const debuggerURL = process.argv[2] ?? 'http://127.0.0.1:9223'
const editorURL = process.argv[3] ?? 'http://127.0.0.1:5173/'
assert.equal(new URL(debuggerURL).hostname, '127.0.0.1')
assert.equal(new URL(editorURL).hostname, '127.0.0.1')
const pages = await (await fetch(`${debuggerURL}/json/list`)).json()
const page = pages.find((page) => page.type === 'page' && page.url === editorURL)
assert.ok(page, 'Open the local editor in a dedicated disposable Chrome profile first')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const errors = []
let pageLoaded
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Page.loadEventFired') pageLoaded?.()
  if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true })
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((arg) => arg.description ?? arg.value).join(' ').slice(0, 500))
  if (message.id) {
    const handler = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) handler.reject(new Error(message.error.message))
    else handler.resolve(message.result)
  }
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const current = ++id
  const timer = setTimeout(() => { pending.delete(current); reject(new Error(`CDP timed out: ${method}`)) }, 25000)
  pending.set(current, { resolve: (value) => { clearTimeout(timer); resolve(value) }, reject: (error) => { clearTimeout(timer); reject(error) } })
  socket.send(JSON.stringify({ id: current, method, params }))
})
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result.value
}
const waitFor = async (expression) => {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const value = await evaluate(`(async () => Boolean(await (${expression})))()`)
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Browser condition timed out: ${expression}`)
}
const settled = () => evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
const bounds = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`)
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, ...extra })
const click = async (selector) => {
  const box = await bounds(selector)
  assert.ok(box.width && box.height, `Visible control: ${selector}`)
  await mouse('mousePressed', box.x + box.width / 2, box.y + box.height / 2, { button: 'left', clickCount: 1 })
  await mouse('mouseReleased', box.x + box.width / 2, box.y + box.height / 2, { button: 'left', clickCount: 1 })
  await settled()
}
const button = async (text, within = 'document') => {
  assert.ok(await evaluate(`(() => { const button = Array.from(${within}.querySelectorAll('button')).find((button) => button.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) return false; button.click(); return true })()`), `Enabled button: ${text}`)
  await settled()
}
const fill = async (selector, value) => {
  await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); const prototype = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) })()`)
  await settled()
}
const key = async (key, code = key, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers })
  await settled()
}
const drag = async (from, to) => {
  await mouse('mouseMoved', from.x, from.y)
  await mouse('mousePressed', from.x, from.y, { button: 'left', clickCount: 1 })
  for (let step = 1; step <= 6; step++) {
    await mouse('mouseMoved', from.x + (to.x - from.x) * step / 6, from.y + (to.y - from.y) * step / 6, { buttons: 1 })
    await settled()
  }
  await mouse('mouseReleased', to.x, to.y, { button: 'left', clickCount: 1 })
  await settled()
}
const selectCard = async (id, shift = false) => {
  await evaluate(`document.querySelector('.node-card[data-node-id="${id}"]').focus()`)
  await key('Enter', 'Enter', shift ? 8 : 0)
}
const metrics = async (width, height) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await settled()
}
const reload = async () => {
  const loaded = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Page reload timed out')), 20000)
    pageLoaded = () => { clearTimeout(timer); resolve() }
  })
  await send('Page.reload')
  await loaded
  await waitFor("document.querySelector('.workspace') && document.querySelector('.status')?.textContent.includes('WebGPU/TSL running')")
  await settled()
}
const assertLinksAligned = async () => {
  const error = await evaluate(`(() => {
    const pins = [...document.querySelectorAll('[data-pin-key]')]
    const world = document.querySelector('.node-world').getBoundingClientRect()
    const scale = new DOMMatrix(getComputedStyle(document.querySelector('.node-world')).transform).a
    const points = new Map(pins.map((pin) => { const r = pin.getBoundingClientRect(); return [pin.dataset.pinKey, { x: (r.x + r.width / 2 - world.x) / scale, y: (r.y + r.height / 2 - world.y) / scale }] }))
    return [...document.querySelectorAll('.node-links path:not(.draft)')].some((path) => {
      const start = path.getPointAtLength(0), end = path.getPointAtLength(path.getTotalLength())
      const values = [...points.values()]
      return !values.some((p) => Math.hypot(p.x - start.x, p.y - start.y) < 1) || !values.some((p) => Math.hypot(p.x - end.x, p.y - end.y) < 1)
    })
  })()`)
  assert.equal(error, false, 'Connections must end at their visible pins')
}
try {
  await send('Page.enable')
  await send('Runtime.enable')
  await metrics(1440, 1000)
  await reload()
  // Read a saved v2 record through the real load path; no format migration.
  await evaluate(`(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('tsl-node-editor', 2); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
    const tx = db.transaction('graphs', 'readwrite')
    tx.objectStore('graphs').put({ id: 'issue-5-workspace', version: 2, nodes: [
      { id: 'number', type: 'number', label: 'Roughness', x: -250, y: -120, value: '0.4', inputs: [], outputs: ['value'] },
      { id: 'color', type: 'color', label: 'Surface', x: 100, y: -120, value: '#4fb3c8', inputs: [], outputs: ['color'] },
      { id: 'output', type: 'output', label: 'Output', x: 450, y: -120, inputs: ['baseColor', 'roughness', 'metalness'], outputs: [] },
    ], connections: [
      { id: 'color-link', from: { nodeId: 'color', pin: 'color' }, to: { nodeId: 'output', pin: 'baseColor' } },
      { id: 'number-link', from: { nodeId: 'number', pin: 'value' }, to: { nodeId: 'output', pin: 'roughness' } },
    ], groups: [], functions: {} })
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) }); db.close()
    localStorage.setItem('tsl-node-editor:last-slot', 'issue-5-workspace')
  })()`)
  await reload()
  await waitFor("document.querySelectorAll('.node-card').length === 3")
  // Open output without first using the desktop toggle, including a fresh iframe
  // after closing output while Viewer remains selected.
  await metrics(390, 844)
  await reload()
  await button('output', "document.querySelector('.compact-tabs')")
  await button('Viewer')
  await waitFor("document.querySelector('.viewer-frame')?.contentDocument?.querySelector('canvas')?.width > 0")
  await button('Close output')
  assert.equal(await evaluate("document.querySelector('.viewer-frame') === null && document.querySelector('.workspace').dataset.compactPanel === 'graph'"), true)
  await button('output', "document.querySelector('.compact-tabs')")
  await waitFor("document.querySelector('.viewer-frame')?.contentDocument?.querySelector('canvas')?.width > 0")
  await button('Code', "document.querySelector('.code-overlay-tabs')")
  await button('Close output')
  console.log('PASS 390px direct Output → Viewer and reopening Viewer after Close output')
  await metrics(1440, 1000)
  await button('Fit graph')
  assert.ok(await evaluate(`(() => { const graph = document.querySelector('.graph-viewport').getBoundingClientRect(), preview = document.querySelector('.preview-surface').getBoundingClientRect(); return graph.width > 500 && preview.width > 250 && graph.right <= preview.left && [...document.querySelectorAll('.node-card')].every((node) => { const r = node.getBoundingClientRect(); return r.left >= graph.left && r.right <= graph.right && r.top >= graph.top && r.bottom <= graph.bottom }) })()`))
  await assertLinksAligned()
  await fill('.palette-search', 'no-such-node-issue-5')
  assert.ok(await evaluate("document.querySelector('.palette').innerText.includes('No nodes match')"))
  await fill('.palette-search', 'Number')
  await new Promise((resolve) => setTimeout(resolve, 300)) // Allow the initial history snapshot to commit.
  await button('Number', "document.querySelector('.palette')")
  await new Promise((resolve) => setTimeout(resolve, 300))
  await waitFor("document.querySelectorAll('.node-card').length === 4 && !document.querySelector('.history-actions button').disabled")
  await button('Undo')
  await waitFor("document.querySelectorAll('.node-card').length === 3")
  await button('Redo')
  await waitFor("document.querySelectorAll('.node-card').length === 4")
  console.log('PASS desktop split, saved v2 load, fit, search/empty state, add and Undo/Redo')

  await selectCard('number')
  assert.ok(await evaluate("document.querySelector('.inspector').innerText.includes('number') && getComputedStyle(document.activeElement).outlineStyle !== 'none'"))
  await fill('.inspector input[type="number"]', '0.65')
  assert.equal(await evaluate("document.querySelector('#number-number').value"), '0.65')
  await button('Code & export')
  await button('Fit graph')
  const before = await bounds('.node-card[data-node-id="number"] .node-title')
  await drag({ x: before.x + 15, y: before.y + 10 }, { x: before.x + 45, y: before.y + 40 })
  const after = await bounds('.node-card[data-node-id="number"] .node-title')
  assert.ok(after.x > before.x + 20, 'Node drag works with output open')
  const graph = await bounds('.graph-viewport')
  const transform = await evaluate("document.querySelector('.node-world').style.transform")
  await drag({ x: graph.right - 10, y: graph.bottom - 10 }, { x: graph.right - 40, y: graph.bottom - 30 })
  assert.notEqual(await evaluate("document.querySelector('.node-world').style.transform"), transform)
  await button('Fit graph')
  await click('[aria-label="Zoom in"]')
  await click('[aria-label="Zoom out"]')
  await button('Fit graph')
  const wheelOrigin = await bounds('.graph-viewport')
  const wheelBefore = await evaluate("document.querySelector('.node-world').style.transform")
  await mouse('mouseWheel', wheelOrigin.x + 20, wheelOrigin.y + 20, { deltaX: 0, deltaY: 60 })
  await settled()
  assert.notEqual(await evaluate("document.querySelector('.node-world').style.transform"), wheelBefore)
  await mouse('mouseWheel', wheelOrigin.x + 20, wheelOrigin.y + 20, { deltaX: 0, deltaY: -60, modifiers: 2 })
  await settled()
  await button('Fit graph')
  await click('[data-pin-key="output:input:roughness"]')
  await waitFor("document.querySelectorAll('.node-links path').length === 1")
  const from = await bounds('[data-pin-key="number:output:value"]')
  const to = await bounds('[data-pin-key="output:input:roughness"]')
  await drag({ x: from.x + from.width / 2, y: from.y + from.height / 2 }, { x: to.x + to.width / 2, y: to.y + to.height / 2 })
  await waitFor("document.querySelectorAll('.node-links path').length === 2")
  await assertLinksAligned()
  for (const kind of ['tsl', 'material', 'app']) {
    await fill('.code-overlay-select select', kind)
    assert.ok(await evaluate("document.querySelector('.code-preview').textContent.length > 50"))
  }
  await fill('.code-overlay-select select', 'app')
  await button('Viewer')
  await waitFor("document.querySelector('.viewer-frame')?.contentDocument?.querySelector('canvas')?.width > 0")
  await button('Code', "document.querySelector('.code-overlay-tabs')")
  await fill('.code-overlay-select select', 'gltf')
  await waitFor("document.querySelector('.code-preview')?.textContent.trim().startsWith('{')")
  assert.equal(await evaluate("JSON.parse(document.querySelector('.code-preview').textContent).materials[0].extensions.THREE_materials_tsl.version"), '2.0')
  console.log('PASS inspector edit, keyboard selection/focus, pan/drag/zoom/connect with output open, TSL/material/app/glTF and app viewer')

  await button('Close output')
  await selectCard('number')
  await selectCard('color', true)
  await button('Group Selected')
  await waitFor("document.querySelectorAll('.node-group').length === 1")
  await click('.node-group-header')
  await waitFor("document.querySelector('.node-group.collapsed')")
  await button('Fit graph')
  assert.ok((await bounds('.node-group')).height < 60)
  await click('.node-group-header')
  await waitFor("!document.querySelector('.node-group.collapsed')")
  await button('Ungroup Selected')
  await waitFor("document.querySelectorAll('.node-group').length === 0")
  await button('Group Selected')
  await button('Make Function')
  await waitFor("document.querySelectorAll('.node-header-function').length === 1")
  await button('Edit', "document.querySelector('.node-header-function')")
  await waitFor("document.querySelector('.function-pin-editor')")
  await button('Fit graph')
  await assertLinksAligned()
  await button('Back to Graph', "document.querySelector('.graph-toolbar')")
  await button('Expand', "document.querySelector('.node-header-function')")
  await waitFor("document.querySelectorAll('.node-header-function').length === 0")
  await button('Auto Layout')
  await button('Fit graph')
  console.log('PASS group/ungroup, function create/edit/expand, function wires and Auto Layout')

  for (const width of [1024, 768, 390, 320]) {
    await metrics(width, 844)
    if (width <= 900) {
      await button('nodes', "document.querySelector('.compact-tabs')")
      await fill('.palette-search', 'Color')
      assert.ok((await bounds('.palette-search')).width > 200)
      await button('graph', "document.querySelector('.compact-tabs')")
    }
    await button('Fit graph')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.node-card')).position"), 'absolute')
    assert.ok((await bounds('.graph-viewport')).height > 400)
    await assertLinksAligned()
    if (width <= 900) {
      await selectCard('output')
      await button('Inspector', "document.querySelector('.compact-tabs')")
      assert.ok((await bounds('.inspector')).height > 500)
      await fill('.inspector input', 'Material output')
      await button('preview', "document.querySelector('.compact-tabs')")
      await waitFor("document.querySelector('.preview-surface canvas').width > 100")
      assert.ok((await bounds('.preview-surface')).height > 500)
      await button('output', "document.querySelector('.compact-tabs')")
      assert.ok((await bounds('.code-overlay')).height > 600)
      await fill('.code-overlay-select select', 'tsl')
      await button('graph', "document.querySelector('.compact-tabs')")
      await button('Fit graph')
      await assertLinksAligned()
    }
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `No horizontal page overflow at ${width}px`)
    console.log(`PASS ${width}px panels, graph geometry, fit and aligned connections`)
  }
  await metrics(1440, 1000)
  // Wait for real autosave, reload, and confirm the inspector edit survived.
  await waitFor(`(async () => { const db = await new Promise((resolve) => { const r = indexedDB.open('tsl-node-editor', 2); r.onsuccess = () => resolve(r.result) }); const record = await new Promise((resolve) => { const r = db.transaction('graphs').objectStore('graphs').get('issue-5-workspace'); r.onsuccess = () => resolve(r.result) }); db.close(); return record.nodes.some((node) => node.id === 'output' && node.label === 'Material output') })()`)
  await reload()
  await waitFor("document.querySelector('.node-card[data-node-id=output]').textContent.includes('Material output')")
  await click('.project-menu summary')
  await fill('[aria-label="New slot name"]', 'issue-5-created')
  await button('Create', "document.querySelector('.project-popover')")
  await waitFor("document.querySelector('.workspace-slot').textContent === 'issue-5-created'")
  await fill('.project-popover select', 'issue-5-workspace')
  await waitFor("document.querySelector('.node-card[data-node-id=output]')?.textContent.includes('Material output')")
  await fill('.project-popover select', 'issue-5-created')
  await waitFor("document.querySelector('.workspace-slot').textContent === 'issue-5-created'")
  await button('Clear Slot', "document.querySelector('.project-popover')")
  await waitFor("document.querySelectorAll('.node-card').length === 0")
  await button('Delete Slot', "document.querySelector('.project-popover')")
  await waitFor("document.querySelector('.workspace-slot').textContent !== 'issue-5-created'")
  await fill('.project-popover select', 'issue-5-workspace')
  await waitFor("document.querySelector('.node-card[data-node-id=output]')?.textContent.includes('Material output')")
  await click('.project-menu summary')
  assert.deepEqual(errors, [], 'No browser runtime errors')
  console.log('PASS autosave/reload, project slot creation/switch/load/clear/delete, and no browser runtime errors')
} finally {
  socket.close()
}
