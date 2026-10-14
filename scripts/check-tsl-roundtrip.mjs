// Tests the same import/export and material-preview functions used by App.tsx.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { BoxGeometry, Color, Mesh, MeshStandardMaterial, MeshPhysicalMaterial } from 'three'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial, MeshPhysicalNodeMaterial } from 'three/webgpu'
import { uniform, positionLocal, texture, uv, atan, float, vec3, color, add, not, bitNot, sin, min, mix, clamp } from 'three/tsl'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { createDefaultContainer, write, VK_FORMAT_R8G8B8A8_UNORM } from 'three/addons/libs/ktx-parse.module.js'
import { Texture } from 'three'

// Compile the actual editor module in memory; no extra TS runtime or generated
// files are needed, and this also runs on the deployment's Node.js 20.19.
const compileModule = async (filename, localImports = {}) => {
  const source = await readFile(new URL(filename, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText.replace(/from '([^']+)'/g, (_, name) => `from '${localImports[name] ?? import.meta.resolve(name)}'`)
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
}
const adapters = await compileModule('../src/tslGltfNodes.ts')
const integration = await compileModule('../src/tslGltf.ts', { './tslGltfNodes': adapters })
const { exportEditorMeshes, createEditorGLTFLoader, cloneImportedTSLMaterial, getImportedMaterialNode } = await import(integration)

// Only browser I/O primitives are shimmed; Three.js/plugins remain real.
globalThis.self = globalThis
globalThis.ProgressEvent ??= class extends Event {
  constructor(type, values) { super(type); Object.assign(this, values) }
}
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.() })
  }
  readAsDataURL(blob) {
    void blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`
      this.onloadend?.()
    })
  }
}

const extensionName = 'THREE_materials_tsl'
const geometry = new BoxGeometry()
const serialize = (value) => value instanceof ArrayBuffer ? value : JSON.stringify(value)
const toGLB = (json) => {
  const raw = Buffer.from(JSON.stringify(json))
  const length = Math.ceil(raw.length / 4) * 4
  const result = new ArrayBuffer(20 + length)
  const view = new DataView(result)
  for (const [offset, value] of [[0, 0x46546c67], [4, 2], [8, result.byteLength], [12, length], [16, 0x4e4f534a]]) view.setUint32(offset, value, true)
  const bytes = new Uint8Array(result, 20)
  bytes.fill(32)
  bytes.set(raw)
  return result
}
const jsonOf = (value) => {
  if (!(value instanceof ArrayBuffer)) return value
  const view = new DataView(value)
  assert.equal(view.getUint32(0, true), 0x46546c67)
  assert.equal(view.getUint32(16, true), 0x4e4f534a)
  return JSON.parse(new TextDecoder().decode(new Uint8Array(value, 20, view.getUint32(12, true))))
}
const load = async (value, diagnostics = [], ktx2) =>
  createEditorGLTFLoader((error) => diagnostics.push(String(error)), ktx2).parseAsync(serialize(value), '')
const meshesOf = (gltf) => {
  const meshes = []
  gltf.scene.traverse((object) => { if (object.isMesh) meshes.push(object) })
  return meshes
}
const checkRefs = (extension) => {
  assert.equal(extension.version, '2.0')
  assert.ok(extension.materialType)
  for (const id of Object.values(extension.entrypoints)) assert.ok(extension.nodes[id])
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if ('$ref' in value) assert.ok(extension.nodes[value.$ref])
    for (const child of Object.values(value)) visit(child)
  }
  for (const node of Object.values(extension.nodes)) visit(node.links)
}

let checks = 0
for (const binary of [false, true]) {
  for (const Type of [MeshBasicNodeMaterial, MeshStandardNodeMaterial, MeshPhysicalNodeMaterial]) {
    const original = new Type()
    original.color.setRGB(0.2, 0.4, 0.6)
    original.colorNode = uniform(new Color(0.4, 0.6, 0.8))
    original.positionNode = positionLocal
    const shared = uniform(0.45)
    original.opacityNode = shared
    if (original.isMeshStandardMaterial) {
      original.roughness = 0.65
      original.metalness = 0.25
      original.roughnessNode = shared
      original.metalnessNode = atan(uniform(0.25), shared)
      original.emissiveNode = original.colorNode
    }
    if (original.isMeshPhysicalMaterial) {
      original.clearcoat = 0.3
      original.transmission = 0.2
      original.ior = 1.7
      original.clearcoatNode = shared
    }
    const asset = await exportEditorMeshes([new Mesh(geometry, original), new Mesh(geometry, original)], binary)
    assert.equal(asset instanceof ArrayBuffer, binary)
    const definition = jsonOf(asset).materials[0]
    const extension = definition.extensions[extensionName]
    checkRefs(extension)
    assert.equal(extension.materialType, original.type)
    if (original.isMeshStandardMaterial) {
      assert.equal(extension.entrypoints.roughnessNode, extension.entrypoints.opacityNode)
      assert.equal(extension.entrypoints.emissiveNode, extension.entrypoints.colorNode)
    }
    const diagnostics = []
    const gltf = await load(asset, diagnostics)
    assert.deepEqual(diagnostics, [])
    const meshes = meshesOf(gltf)
    const imported = meshes[0].material
    assert.equal(meshes[1].material, imported)
    assert.equal(imported.type, original.type)
    assert.ok(imported.color.equals(original.color))
    assert.ok(imported.colorNode.value.equals(original.colorNode.value))
    assert.equal(imported.positionNode, positionLocal)
    assert.equal(imported.opacityNode.value, 0.45)
    if (original.isMeshStandardMaterial) {
      assert.equal(imported.roughness, original.roughness)
      assert.equal(imported.metalness, original.metalness)
      assert.equal(imported.roughnessNode, imported.opacityNode)
      assert.equal(imported.emissiveNode, imported.colorNode)
      assert.equal(imported.metalnessNode.node.bNode, imported.opacityNode)
    }
    if (original.isMeshPhysicalMaterial) {
      assert.equal(imported.clearcoat, original.clearcoat)
      assert.equal(imported.transmission, original.transmission)
      assert.equal(imported.ior, original.ior)
      assert.equal(imported.clearcoatNode, imported.opacityNode)
    }
    const preview = cloneImportedTSLMaterial(imported)
    assert.notEqual(preview, imported)
    assert.equal(preview.type, imported.type)
    assert.equal(preview.colorNode, imported.colorNode)
    assert.equal(getImportedMaterialNode(imported, 'baseColor').node, imported.colorNode)
    assert.equal(getImportedMaterialNode(imported, 'opacity').node, imported.opacityNode)
    meshes.forEach((mesh) => { mesh.material = preview })
    const reexport = await exportEditorMeshes(meshes, binary)
    assert.deepEqual(jsonOf(reexport).materials[0].extensions[extensionName], extension)
    const reimport = await load(reexport, diagnostics)
    assert.equal(meshesOf(reimport)[0].material.type, original.type)
    assert.deepEqual(diagnostics, [])
    preview.dispose()
    assert.equal(imported.colorNode.value.r, original.colorNode.value.r)
    console.log(`PASS ${binary ? 'GLB' : 'glTF'} ${original.type}: import, preview clone/pins, shared graph, re-export`)
    checks++
  }
}

for (const binary of [false, true]) {
  const original = new MeshBasicNodeMaterial()
  const shared = uniform(0.6)
  original.colorNode = color(vec3(shared, float(0.4), shared))
  original.opacityNode = original.colorNode.r
  const asset = await exportEditorMeshes([new Mesh(geometry, original)], binary)
  const extension = jsonOf(asset).materials[0].extensions[extensionName]
  for (const op of ['VarNode', 'JoinNode', 'ConvertNode', 'SplitNode']) {
    assert.ok(Object.values(extension.nodes).some((node) => node.op === op))
  }
  const diagnostics = []
  const imported = meshesOf(await load(asset, diagnostics))[0].material
  const preview = cloneImportedTSLMaterial(imported)
  const reexport = await exportEditorMeshes([new Mesh(geometry, preview)], binary)
  assert.deepEqual(jsonOf(reexport).materials[0].extensions[extensionName], extension)
  assert.deepEqual(diagnostics, [])
  console.log(`PASS ${binary ? 'GLB' : 'glTF'} paired Var/Join/Convert/Split adapters`)
  checks++
}

// A later material's slots must not be restricted by the first mesh.
const basic = new MeshBasicNodeMaterial()
basic.colorNode = uniform(new Color(0.2, 0.3, 0.4))
const physical = new MeshPhysicalNodeMaterial()
physical.clearcoatNode = uniform(0.8)
const mixed = await exportEditorMeshes([new Mesh(geometry, basic), new Mesh(geometry, physical)], false)
assert.ok(mixed.materials[1].extensions[extensionName].entrypoints.clearcoatNode)
console.log('PASS mixed material entrypoints')
checks++

for (const binary of [false, true]) {
  const original = new MeshPhysicalMaterial({ color: 0x123456, roughness: 0.3, metalness: 0.7, clearcoat: 0.4, transmission: 0.2, ior: 1.6 })
  const asset = await exportEditorMeshes([new Mesh(geometry, original)], binary)
  assert.equal(jsonOf(asset).materials[0].extensions?.[extensionName], undefined)
  const diagnostics = []
  const gltf = await load(asset, diagnostics)
  const loaded = meshesOf(gltf)[0].material
  assert.equal(loaded.isNodeMaterial, undefined)
  assert.equal(loaded.type, 'MeshPhysicalMaterial')
  assert.ok(loaded.color.equals(original.color))
  for (const key of ['roughness', 'metalness', 'clearcoat', 'transmission', 'ior']) assert.equal(loaded[key], original[key])
  assert.deepEqual(diagnostics, [])
  assert.equal(cloneImportedTSLMaterial(loaded), null)
  assert.equal(getImportedMaterialNode(loaded, 'baseColor'), null)
  assert.ok(meshesOf(gltf)[0].geometry.attributes.position.count)
  console.log(`PASS ordinary ${binary ? 'GLB' : 'glTF'} geometry/PBR/extensions`)
  checks++
}

const fallbackAsset = await exportEditorMeshes([new Mesh(geometry, new MeshPhysicalMaterial({ color: 0x234567, clearcoat: 0.6, transmission: 0.3, ior: 1.7 }))], false)
const validExtension = mixed.materials[0].extensions[extensionName]
const invalidExtensions = [
  { ...validExtension, version: '1.0' },
  { ...validExtension, version: '3.0' },
  { ...validExtension, materialType: '' },
  { ...validExtension, materialType: 'UnknownMaterial' },
  { ...validExtension, materialType: 'MeshBasicNodeMaterial' }, // incompatible physical fallback
  { ...validExtension, materialType: 'MeshPhysicalNodeMaterial', entrypoints: { colorNode: 'missing' } },
  { ...validExtension, materialType: 'MeshPhysicalNodeMaterial', nodes: { n0: { op: 'UnknownNode' } }, entrypoints: { colorNode: 'n0' } },
  { ...validExtension, materialType: 'MeshPhysicalNodeMaterial', nodes: { n0: { op: 'OperatorNode', args: { op: '+' }, links: { aNode: { $ref: 'n0' } } } }, entrypoints: { colorNode: 'n0' } },
  { ...validExtension, materialType: 'MeshPhysicalNodeMaterial', nodes: { n0: { op: 'VarNode', args: { name: null, readOnly: false, intent: false } } }, entrypoints: { colorNode: 'n0' } },
  { ...validExtension, materialType: 'MeshPhysicalNodeMaterial', nodes: { n0: { op: 'SplitNode', args: { components: 'invalid' } } }, entrypoints: { colorNode: 'n0' } },
]
for (const binary of [false, true]) {
for (const extension of invalidExtensions) {
  const fixture = structuredClone(fallbackAsset)
  fixture.extensionsUsed = [...(fixture.extensionsUsed ?? []), extensionName]
  fixture.materials[0].extensions[extensionName] = extension
  const diagnostics = []
  const gltf = await load(binary ? toGLB(fixture) : fixture, diagnostics)
  const loaded = meshesOf(gltf)[0].material
  assert.equal(loaded.isNodeMaterial, undefined)
  assert.equal(loaded.type, 'MeshPhysicalMaterial')
  assert.equal(loaded.clearcoat, 0.6)
  assert.equal(loaded.transmission, 0.3)
  assert.equal(loaded.ior, 1.7)
  assert.ok(loaded.color.equals(new Color(0x234567)))
  assert.equal(loaded.colorNode, undefined)
  assert.equal(diagnostics.length, 1)
  assert.match(diagnostics[0], /\S/)
  const cached = await gltf.parser.getDependency('material', 0)
  assert.equal(cached.isNodeMaterial, undefined)
  assert.equal(cached.type, loaded.type)
  assert.ok(cached.color.equals(loaded.color))
  assert.equal(cached.clearcoat, loaded.clearcoat)
  checks++
}
}
console.log('PASS glTF/GLB invalid version/type/graph/op/cycle/adapters: diagnostics and complete ordinary fallback')

// Corrupt real exported operations so resolver placeholders cannot hide missing
// inputs. Include unary operators and both atan forms to avoid rejecting valid graphs.
const operationCases = [
  ['addition', () => add(uniform(0.2), uniform(0.4)), ['aNode', 'bNode']],
  ['logical not', () => not(uniform(false)), ['aNode']],
  ['bitwise not', () => bitNot(uniform(1, 'int')), ['aNode']],
  ['sin', () => sin(uniform(0.2)), ['aNode']],
  ['min', () => min(uniform(0.2), uniform(0.4)), ['aNode', 'bNode']],
  ['mix', () => mix(uniform(0.2), uniform(0.4), uniform(0.6)), ['aNode', 'bNode', 'cNode']],
  ['clamp', () => clamp(uniform(0.2)), ['aNode', 'bNode', 'cNode']],
  ['unary atan', () => atan(uniform(0.2)), ['aNode']],
  ['binary atan', () => atan(uniform(0.2), uniform(0.4)), ['aNode']],
]
for (const [label, createNode, requiredInputs] of operationCases) {
  const original = new MeshStandardNodeMaterial({ color: 0x234567, roughness: 0.3, metalness: 0.7, emissive: 0x123456, opacity: 0.8, transparent: true })
  original.opacityNode = createNode()
  const asset = await exportEditorMeshes([new Mesh(geometry, original)], false)
  const extension = asset.materials[0].extensions[extensionName]
  const operationId = Object.keys(extension.nodes).find((id) => ['MathNode', 'OperatorNode'].includes(extension.nodes[id].op))
  assert.ok(operationId)
  const operation = extension.nodes[operationId]
  for (const binary of [false, true]) {
    const diagnostics = []
    const imported = meshesOf(await load(binary ? toGLB(asset) : asset, diagnostics))[0].material
    assert.equal(imported.type, original.type)
    assert.deepEqual(diagnostics, [])
    const reexport = await exportEditorMeshes([new Mesh(geometry, imported)], false)
    assert.deepEqual(reexport.materials[0].extensions[extensionName], extension)
    checks++

    const mutations = [{ slot: 'aNode', apply: (node) => { delete node.links } }]
    for (const slot of Object.keys(operation.links)) {
      if (requiredInputs.includes(slot)) mutations.push({ slot, apply: (node) => { delete node.links[slot] } })
      for (const value of [{}, [], { nested: operation.links[slot] }]) {
        mutations.push({ slot, apply: (node) => { node.links[slot] = value } })
      }
    }
    // Optional inputs must also be node references when supplied.
    if (label === 'unary atan') mutations.push({ slot: 'bNode', apply: (node) => { node.links.bNode = {} } })
    for (const { slot, apply } of mutations) {
      const fixture = structuredClone(asset)
      apply(fixture.materials[0].extensions[extensionName].nodes[operationId])
      const errors = []
      const gltf = await load(binary ? toGLB(fixture) : fixture, errors)
      const loaded = meshesOf(gltf)[0].material
      assert.equal(loaded.type, 'MeshStandardMaterial', `${label} invalid ${slot} must fall back`)
      assert.equal(loaded.isNodeMaterial, undefined)
      assert.equal(loaded.opacityNode, undefined)
      for (const key of ['roughness', 'metalness', 'opacity', 'transparent']) assert.equal(loaded[key], original[key])
      for (const key of ['color', 'emissive']) assert.ok(loaded[key].equals(original[key]))
      assert.equal(errors.length, 1)
      assert.ok(errors[0].includes(operation.op), errors[0])
      assert.ok(errors[0].includes(operation.args.op ?? operation.args.method), errors[0])
      assert.ok(errors[0].includes(slot), errors[0])
      const cached = await gltf.parser.getDependency('material', 0)
      assert.equal(cached.type, loaded.type)
      assert.equal(cached.opacityNode, undefined)
      assert.ok(cached.color.equals(original.color))
      checks++
    }
  }
  console.log(`PASS glTF/GLB ${label}: valid round-trip and malformed inputs preserve ordinary PBR with diagnostics`)
}

// Exercise real KTX2 parsing and GLTFLoader texture dependencies, without a GPU
// or Basis worker: a tiny uncompressed KTX2 fixture has deterministic pixels.
const container = createDefaultContainer()
container.vkFormat = VK_FORMAT_R8G8B8A8_UNORM
container.pixelWidth = container.pixelHeight = container.levelCount = 1
container.levels = [{ levelData: new Uint8Array([20, 40, 60, 255]), uncompressedByteLength: 4 }]
const ktx2Bytes = write(container)
const ktx2 = new KTX2Loader().detectSupport({ isWebGPURenderer: true, hasFeature: () => false })
const textureFixture = await exportEditorMeshes([new Mesh(geometry, new MeshStandardMaterial())], false)
textureFixture.extensionsUsed = textureFixture.extensionsRequired = ['KHR_texture_basisu']
textureFixture.images = [{ uri: `data:image/ktx2;base64,${Buffer.from(ktx2Bytes).toString('base64')}` }]
textureFixture.textures = [{ extensions: { KHR_texture_basisu: { source: 0 } } }]
textureFixture.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 }
const gltf = await load(textureFixture, [], ktx2)
const textures = await gltf.parser.getDependencies('texture')
assert.equal(textures[0], meshesOf(gltf)[0].material.map)
assert.equal(textures[0].flipY, false)
assert.deepEqual(Array.from(textures[0].image.data), [20, 40, 60, 255])
console.log('PASS ordinary KTX2 resource: actual KTX2Loader pixels, geometry/material/texture dependencies')
checks++
textureFixture.extensionsUsed.push(extensionName)
textureFixture.materials[0].extensions = { [extensionName]: { ...validExtension, materialType: 'MeshStandardNodeMaterial' } }
const tslTextureGltf = await load(textureFixture, [], ktx2)
const tslTextures = await tslTextureGltf.parser.getDependencies('texture')
const texturedNodeMaterial = meshesOf(tslTextureGltf)[0].material
assert.equal(texturedNodeMaterial.type, 'MeshStandardNodeMaterial')
assert.equal(texturedNodeMaterial.map, tslTextures[0])
assert.deepEqual(Array.from(texturedNodeMaterial.map.image.data), [20, 40, 60, 255])
assert.equal(cloneImportedTSLMaterial(texturedNodeMaterial).map, texturedNodeMaterial.map)
console.log('PASS TSL KTX2 resource survives material reconstruction/preview')
checks++
ktx2.dispose()

for (const binary of [false, true]) {
  const unsupported = new MeshBasicNodeMaterial()
  unsupported.colorNode = texture(new Texture(), uv())
  await assert.rejects(exportEditorMeshes([new Mesh(geometry, unsupported)], binary), /Unsupported node type.*TextureNode/)
  console.log(`PASS unsupported node rejects ${binary ? 'GLB' : 'glTF'} export`)
  checks++
}
console.log(`Passed ${checks} editor integration checks`)
