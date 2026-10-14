// Run with the Vite dev server and a dedicated headless Chrome profile; see docs.
// Connects only to a page at the explicitly selected local editor origin.
import assert from 'node:assert/strict'
const debuggerURL = process.argv[2] ?? 'http://127.0.0.1:9223'
const editorURL = process.argv[3] ?? 'http://127.0.0.1:5173/'
assert.equal(new URL(editorURL).hostname, '127.0.0.1')
assert.equal(new URL(debuggerURL).hostname, '127.0.0.1')
const pages = await (await fetch(`${debuggerURL}/json/list`)).json()
const page = pages.find((page) => page.type === 'page' && page.url === editorURL)
assert.ok(page, 'Open the local editor in the dedicated Chrome profile first')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const exceptions = []
const events = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (events.has(message.method)) { events.get(message.method)(); events.delete(message.method) }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') exceptions.push(message.params.args.map((arg) => arg.description ?? arg.value).join(' ').slice(0,500))
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
const reload = async () => {
  const loaded = new Promise((resolve) => events.set('Page.loadEventFired', resolve))
  await send('Page.reload')
  await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error('Page load timed out')), 25000))])
}
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result.value
}
const waitFor = async (expression) => {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const value = await evaluate(expression)
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Browser condition timed out: ${expression}`)
}

try {
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await reload()
  await send('Runtime.discardConsoleEntries')
  await send('Runtime.enable')
  await waitFor("document.body.innerText.includes('WebGPU/TSL running')")
  for (const binary of [false, true]) {
    for (const materialType of ['MeshBasicNodeMaterial', 'MeshStandardNodeMaterial', 'MeshPhysicalNodeMaterial']) {
      const expected = await evaluate(`(async () => {
        const THREE = await import('/node_modules/.vite/deps/three_webgpu.js')
        const TSL = await import('/node_modules/.vite/deps/three_tsl.js')
        const { exportEditorMeshes } = await import('/src/tslGltf.ts')
        const material = new THREE[${JSON.stringify(materialType)}]()
        material.colorNode = TSL.color(TSL.vec3(TSL.uniform(0.3), TSL.float(0.5), TSL.uniform(0.7)))
        material.opacityNode = TSL.uniform(0.5)
        material.positionNode = TSL.positionLocal
        material.alphaTestNode = material.colorNode.r
        if (material.isMeshStandardMaterial) material.roughnessNode = material.opacityNode
        if (material.isMeshPhysicalMaterial) material.clearcoatNode = material.opacityNode
        const asset = await exportEditorMeshes([new THREE.Mesh(new THREE.BoxGeometry(), material)], ${binary})
        const json = asset instanceof ArrayBuffer
          ? JSON.parse(new TextDecoder().decode(new Uint8Array(asset, 20, new DataView(asset).getUint32(12, true))))
          : asset
        const slot = ${JSON.stringify('issue-3-browser-' + binary + '-' + materialType)}
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('tsl-node-editor', 2)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        const tx = db.transaction(['graphs', 'assets'], 'readwrite')
        tx.objectStore('graphs').put({ id: slot, version: 2, nodes: [
          { id: 'imported', type: 'gltfMaterial', label: 'Imported TSL', x: 10, y: 20, inputs: [], outputs: ['baseColor'], assetKey: 'imported', materialIndex: '0' },
          { id: 'output', type: 'output', label: 'Output', x: 400, y: 20, inputs: ['baseColor', 'roughness', 'metalness'], outputs: [] },
        ], connections: [{ id: 'color', from: { nodeId: 'imported', pin: 'baseColor' }, to: { nodeId: 'output', pin: 'baseColor' } }], groups: [], functions: {} })
        tx.objectStore('assets').put({ id: slot + ':imported', name: 'roundtrip.${binary ? 'glb' : 'gltf'}', blob: new Blob([asset instanceof ArrayBuffer ? asset : JSON.stringify(asset)], { type: '${binary ? 'model/gltf-binary' : 'model/gltf+json'}' }) })
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) })
        db.close()
        localStorage.setItem('tsl-node-editor:last-slot', slot)
        return json.materials[0].extensions.THREE_materials_tsl
      })()`)
      await reload()
      await waitFor("document.querySelector('#imported-gltf-material-index')?.disabled === false")
      await waitFor("document.body.innerText.includes('WebGPU/TSL running')")
      assert.ok(await evaluate('document.querySelector(\'canvas\').width > 0 && document.querySelector(\'canvas\').height > 0'), 'Preview canvas must have a drawable size')
      await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Show TSL').click()`)
      await evaluate(`(() => {
        const code = document.querySelector('.code-overlay pre').textContent
        const body = code.replace(/^import[\\s\\S]*?from\\s*['"][^'"]+['"];?\\s*/gm, '').replace(/^export /gm, '')
        new Function(body)
      })()`)
      await evaluate(`(() => {
        const select = document.querySelector('.code-overlay-select select')
        select.value = 'gltf'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })()`)
      const extension = await waitFor(`(() => {
        const text = document.querySelector('.code-overlay pre')?.textContent
        if (!text?.trim().startsWith('{')) return false
        return JSON.parse(text).materials?.[0]?.extensions?.THREE_materials_tsl ?? false
      })()`)
      assert.deepEqual(extension, expected, 'Actual editor preview must retain all imported slots and graph references')
      await evaluate(`(() => {
        window.__issue3Download = null
        HTMLAnchorElement.prototype.click = function() {
          void fetch(this.href).then((response) => response.arrayBuffer()).then((data) => {
            const length = new DataView(data).getUint32(12, true)
            window.__issue3Download = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, length)))
          })
        }
        Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Download glTF').click()
      })()`)
      const downloaded = await waitFor('window.__issue3Download')
      assert.deepEqual(downloaded.materials[0].extensions.THREE_materials_tsl, expected)
      await evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
      assert.equal(exceptions.length, 0, `Preview/render errors: ${exceptions.slice(0, 3).join(' | ')}`)
      console.log(`PASS actual editor ${binary ? 'GLB' : 'glTF'} import/WebGPU preview/text export/GLB download: ${materialType}`)
      await evaluate(`Array.from(document.querySelectorAll('.node-card[data-node-id="imported"] button')).find((button) => button.textContent === 'Delete').click()`)
      await waitFor(`(() => {
        const text = document.querySelector('.code-overlay pre')?.textContent
        if (!text?.trim().startsWith('{')) return false
        const extension = JSON.parse(text).materials?.[0]?.extensions?.THREE_materials_tsl
        return extension?.materialType === 'MeshStandardNodeMaterial' && !extension.entrypoints.alphaTestNode && !extension.entrypoints.opacityNode && !extension.entrypoints.clearcoatNode
      })()`)
      assert.equal(exceptions.length, 0, `Graph reset errors: ${exceptions.slice(0, 3).join(' | ')}`)
    }
  }
} finally {
  socket.close()
}
