// Run against an isolated npm install; see docs/issue-3-publication-blocker.md.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!process.argv[2]) {
  throw new Error('Usage: node scripts/check-tsl-publication.mjs <isolated-install-directory>')
}
const requirePackage = createRequire(resolve(process.argv[2], 'package.json'))
const load = async (name) => {
  // Plugin packages expose an import-only entrypoint, so require.resolve cannot
  // select it. Read that entrypoint from the isolated package's own manifest.
  if (name.startsWith('@takahirox/')) {
    const directory = resolve(process.argv[2], 'node_modules', name)
    const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'))
    assert.equal(manifest.version, '0.4.0')
    return import(pathToFileURL(resolve(directory, manifest.exports['.'].import)).href)
  }
  return import(pathToFileURL(requirePackage.resolve(name)).href)
}
const { MeshBasicNodeMaterial, MeshStandardNodeMaterial, MeshPhysicalNodeMaterial } =
  await load('three/webgpu')
const { uniform } = await load('three/tsl')
const { GLTFLoader } = await load('three/addons/loaders/GLTFLoader.js')
const { THREEMaterialsTSLExporterPlugin, createDefaultNodeSerializer } =
  await load('@takahirox/gltf-three-materials-tsl-exporter')
const { THREEMaterialsTSLLoaderPlugin, createDefaultNodeResolver } =
  await load('@takahirox/gltf-three-materials-tsl-loader')

let failures = 0
const check = async (name, run) => {
  try {
    await run()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures++
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

for (const Type of [MeshBasicNodeMaterial, MeshStandardNodeMaterial, MeshPhysicalNodeMaterial]) {
  await check(`export ${Type.name} as Draft v2.0`, async () => {
    const material = new Type()
    material.colorNode = uniform(0.5)
    const definition = {}
    const plugin = new THREEMaterialsTSLExporterPlugin(
      { extensionsUsed: {} },
      { nodeSerializer: createDefaultNodeSerializer() },
    )
    await plugin.writeMaterialAsync(material, definition)
    const extension = definition.extensions.THREE_materials_tsl
    console.log(`  emitted version=${extension.version}, materialType=${extension.materialType}`)
    assert.equal(extension.version, '2.0')
    assert.equal(extension.materialType, material.type)
    assert.ok(extension.nodes[extension.entrypoints.colorNode])
  })

  await check(`import Draft v2.0 ${Type.name}`, async () => {
    const diagnostics = []
    const loader = new GLTFLoader()
    loader.register((parser) => new THREEMaterialsTSLLoaderPlugin(parser, {
      nodeResolver: createDefaultNodeResolver(),
      onError: (error) => diagnostics.push(String(error)),
    }))
    const extensions = {
      THREE_materials_tsl: {
        version: '2.0', materialType: new Type().type,
        entrypoints: { colorNode: 'n0' },
        nodes: { n0: { op: 'UniformNode', args: {
          value: 0.5, valueType: 'float', nodeType: 'float',
        } } },
      },
    }
    if (Type === MeshBasicNodeMaterial) extensions.KHR_materials_unlit = {}
    const gltf = await loader.parseAsync(JSON.stringify({
      asset: { version: '2.0' },
      extensionsUsed: Object.keys(extensions),
      materials: [{ extensions }],
      scenes: [{ nodes: [] }], scene: 0,
    }), '')
    const material = await gltf.parser.getDependency('material', 0)
    assert.deepEqual(diagnostics, [])
    assert.equal(material.type, new Type().type)
    assert.equal(material.colorNode?.value, 0.5)
  })
}
process.exitCode = failures ? 1 : 0
