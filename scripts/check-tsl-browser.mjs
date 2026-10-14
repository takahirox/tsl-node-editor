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
  // Stop the editor's animation loop for the independent material comparisons.
  // Keep this same local page, but reload without its application entry module.
  await send('Network.enable')
  await send('Network.setBlockedURLs', { urls: [new URL('src/main.tsx', editorURL).href] })
  await reload()
  // Read actual WebGPU pixels: metadata equality alone cannot detect a changed
  // scalar/vector shader result. A custom attribute avoids glTF's automatic
  // COLOR_0 vertex-color multiplication, isolating AttributeNode's explicit type.
  for (const binary of [false, true]) {
    const result = await evaluate(`(async () => {
      const THREE = await import('/node_modules/.vite/deps/three_webgpu.js')
      const TSL = await import('/node_modules/.vite/deps/three_tsl.js')
      const { exportEditorMeshes, createEditorGLTFLoader, cloneImportedTSLMaterial } = await import('/src/tslGltf.ts')
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
      camera.position.z = 2
      const geometry = new THREE.PlaneGeometry(2, 2)
      geometry.setAttribute('_colorprobe', new THREE.Float32BufferAttribute([
        0.2, 0.6, 0.8, 0.2, 0.6, 0.8, 0.2, 0.6, 0.8, 0.2, 0.6, 0.8,
      ], 3))
      const material = new THREE.MeshBasicNodeMaterial()
      material.colorNode = TSL.attribute('_colorprobe', 'float')
      const mesh = new THREE.Mesh(geometry, material)
      let webgpu = true
      const render = async (object) => {
        // Compile each material in a fresh renderer to compare independent
        // shader results without sharing pipeline/uniform state between scenes.
        const renderer = new THREE.WebGPURenderer()
        await renderer.init()
        webgpu &&= renderer.backend.isWebGPUBackend === true
        const target = new THREE.RenderTarget(8, 8)
        renderer.setRenderTarget(target)
        const scene = new THREE.Scene()
        // Compare material behavior on fixed preview geometry, as in the editor.
        scene.add(new THREE.Mesh(geometry, object.material))
        try {
          await renderer.compileAsync(scene, camera)
          renderer.render(scene, camera)
          return Array.from(await renderer.readRenderTargetPixelsAsync(target, 4, 4, 1, 1))
        } finally {
          target.dispose()
          renderer.dispose()
        }
      }
      const errors = []
      const load = async (asset) => {
        const gltf = await createEditorGLTFLoader((error) => errors.push(String(error))).parseAsync(
          asset instanceof ArrayBuffer ? asset : JSON.stringify(asset), '',
        )
        let mesh
        gltf.scene.traverse((object) => { if (object.isMesh) mesh = object })
        return mesh
      }
      const jsonOf = (asset) => asset instanceof ArrayBuffer
        ? JSON.parse(new TextDecoder().decode(new Uint8Array(asset, 20, new DataView(asset).getUint32(12, true))))
        : asset
      try {
        const before = await render(mesh)
        const asset = await exportEditorMeshes([mesh], ${binary})
        const imported = await load(asset)
        const preview = cloneImportedTSLMaterial(imported.material)
        const previewMesh = new THREE.Mesh(imported.geometry, preview)
        const after = await render(previewMesh)
        const reexport = await exportEditorMeshes([previewMesh], ${binary})
        const reimported = await load(reexport)
        const again = await render(reimported)
        const inferred = new THREE.MeshBasicNodeMaterial()
        inferred.colorNode = TSL.attribute('_colorprobe')
        const inferredPixels = await render(new THREE.Mesh(geometry, inferred))
        return { before, after, again, inferredPixels, errors,
          webgpu,
          types: [imported.material.colorNode.nodeType, preview.colorNode.nodeType, reimported.material.colorNode.nodeType],
          extension: jsonOf(asset).materials[0].extensions.THREE_materials_tsl,
          reextension: jsonOf(reexport).materials[0].extensions.THREE_materials_tsl,
        }
      } finally {
        geometry.dispose()
        material.dispose()
      }
    })()`)
    assert.equal(result.webgpu, true, 'Attribute rendering must use WebGPU')
    assert.ok(result.before[0] > 0 && result.before[0] < 255, 'Readback must contain rendered material pixels')
    assert.deepEqual(result.before.slice(0, 3), Array(3).fill(result.before[0]), 'Explicit float renders gray')
    assert.notDeepEqual(result.inferredPixels, result.before, 'Fixture must detect a lost explicit type')
    assert.deepEqual(result.after, result.before, 'Imported preview must render the same pixels')
    assert.deepEqual(result.again, result.before, 'Re-exported material must render the same pixels')
    assert.deepEqual(result.types, ['float', 'float', 'float'])
    assert.deepEqual(result.reextension, result.extension)
    assert.deepEqual(result.errors, [])
    assert.equal(exceptions.length, 0, `Attribute render errors: ${exceptions.slice(0, 3).join(' | ')}`)
    console.log(`PASS WebGPU ${binary ? 'GLB' : 'glTF'} explicit AttributeNode: matching pixels before export, imported preview and re-export`)
  }
} finally {
  await send('Network.setBlockedURLs', { urls: [] })
  socket.close()
}
