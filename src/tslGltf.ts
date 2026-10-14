import type { Material, Mesh } from 'three'
import { Scene, MeshBasicNodeMaterial, MeshStandardNodeMaterial, MeshPhysicalNodeMaterial } from 'three/webgpu'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import type { Node } from 'three/webgpu'
import { THREEMaterialsTSLExporterPlugin } from '@takahirox/gltf-three-materials-tsl-exporter'
import { THREEMaterialsTSLLoaderPlugin } from '@takahirox/gltf-three-materials-tsl-loader'
import { createEditorNodeSerializer, createEditorNodeResolver, validateEditorNodeLinks } from './tslGltfNodes'

// Both UI export paths use the same strict serializer and export all node slots
// on each material, rather than restricting every mesh to the first material.
export const exportEditorMeshes = async (meshes: Mesh[], binary: boolean) => {
  if (!meshes.length) throw new Error('No mesh to export')
  const exporter = new GLTFExporter()
  exporter.register((writer) => new THREEMaterialsTSLExporterPlugin(writer, {
    nodeSerializer: createEditorNodeSerializer(),
  }))
  const scene = new Scene()
  for (const mesh of meshes) {
    const clone = mesh.clone()
    clone.geometry = mesh.geometry
    clone.material = mesh.material
    clone.updateMatrix()
    clone.updateMatrixWorld(true)
    scene.add(clone)
  }
  return exporter.parseAsync(scene, { binary })
}

export const createEditorGLTFLoader = (onError: (error: unknown) => void, ktx2Loader?: KTX2Loader) => {
  const loader = new GLTFLoader()
  loader.register((parser) => new THREEMaterialsTSLLoaderPlugin(parser, {
    nodeResolver: createEditorNodeResolver(),
    onError,
    onApplied: (_material, extension) => validateEditorNodeLinks(extension),
  }))
  if (ktx2Loader) loader.setKTX2Loader(ktx2Loader)
  return loader
}

// Clone material state for the preview, retaining graph identity/shared inputs.
// Disposing/rebuilding the preview must not mutate the cached imported asset.
export const cloneImportedTSLMaterial = (material: Material) => {
  if (material instanceof MeshBasicNodeMaterial || material instanceof MeshStandardNodeMaterial || material instanceof MeshPhysicalNodeMaterial) {
    return material.clone()
  }
  return null
}

const importedSlots: Record<string, { slot: string; kind: 'color' | 'number' }> = {
  baseColor: { slot: 'colorNode', kind: 'color' },
  roughness: { slot: 'roughnessNode', kind: 'number' },
  metalness: { slot: 'metalnessNode', kind: 'number' },
  emissive: { slot: 'emissiveNode', kind: 'color' },
  opacity: { slot: 'opacityNode', kind: 'number' },
  alphaTest: { slot: 'alphaTestNode', kind: 'number' },
}

export const getImportedMaterialNode = (material: Material, pin: string) => {
  const mapping = importedSlots[pin]
  if (!mapping || !('isNodeMaterial' in material) || !material.isNodeMaterial) return null
  const node = (material as unknown as Record<string, unknown>)[mapping.slot] as Node | null
  return node?.isNode ? { node, kind: mapping.kind } : null
}
