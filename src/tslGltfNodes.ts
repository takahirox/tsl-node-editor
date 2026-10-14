import { ConstNode } from 'three/webgpu'
import VarNode from 'three/src/nodes/core/VarNode.js'
import ConvertNode from 'three/src/nodes/utils/ConvertNode.js'
import JoinNode from 'three/src/nodes/utils/JoinNode.js'
import SplitNode from 'three/src/nodes/utils/SplitNode.js'
import { createDefaultNodeSerializer } from '@takahirox/gltf-three-materials-tsl-exporter'
import type { NodeExport, JsonValue } from '@takahirox/gltf-three-materials-tsl-exporter'
import { createDefaultNodeResolver } from '@takahirox/gltf-three-materials-tsl-loader'
import type { ExtensionDefinition } from '@takahirox/gltf-three-materials-tsl-loader'

// r186's public TSL constructors introduce these wrappers. Keep adapters paired
// and explicit; do not serialize arbitrary class fields or executable code.
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid editor node arguments')
  return value as Record<string, unknown>
}
const nodeType = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !/^(float|bool|int|uint|color|[biu]?vec[234]|mat[234])(\|(float|bool|int|uint|color|[biu]?vec[234]|mat[234]))*$/.test(value)) {
    throw new Error('Unsupported editor node conversion type')
  }
  return value
}
const components = (value: unknown) => {
  if (typeof value !== 'string' || !/^[xyzw]{1,4}$/.test(value)) throw new Error('Invalid editor swizzle')
  return value
}
const serializeWrapper = (op: string, value: unknown): NodeExport => {
  const node = record(value)
  if (op === 'VarNode') {
    if (node.name !== null && typeof node.name !== 'string') throw new Error('Invalid editor variable name')
    return { op, args: { name: node.name as string | null, readOnly: Boolean(node.readOnly), intent: Boolean(node.intent) }, links: { node: { node: node.node } } }
  }
  if (op === 'ConvertNode') {
    const convertTo = nodeType(node.convertTo)
    if (!convertTo) throw new Error('Missing editor conversion type')
    return { op, args: { convertTo }, links: { node: { node: node.node } } }
  }
  if (op === 'SplitNode') return { op, args: { components: components(node.components) }, links: { node: { node: node.node } } }
  if (!Array.isArray(node.nodes) || !node.nodes.length) throw new Error('Empty editor vector join')
  return { op, args: { nodeType: nodeType(node.nodeType) }, links: { nodes: node.nodes.map((child) => ({ node: child })) } }
}

export const createEditorNodeSerializer = () => createDefaultNodeSerializer({
  overrides: Object.fromEntries(['VarNode', 'ConvertNode', 'JoinNode', 'SplitNode'].map((op) => [op, (node: unknown) => serializeWrapper(op, node)])),
})

export const createEditorNodeResolver = () => {
  const defaults = createDefaultNodeResolver()
  return (op: string, args?: JsonValue) => {
    if (!['VarNode', 'ConvertNode', 'JoinNode', 'SplitNode'].includes(op)) return defaults(op, args)
    const data = record(args)
    const placeholder = new ConstNode(0)
    if (op === 'VarNode') {
      if (data.name !== null && typeof data.name !== 'string') throw new Error('Invalid editor variable name')
      if (typeof data.readOnly !== 'boolean' || typeof data.intent !== 'boolean') throw new Error('Invalid editor variable flags')
      const node = new VarNode(placeholder, data.name as string | null, data.readOnly)
      node.intent = data.intent
      return node
    }
    if (op === 'ConvertNode') {
      const convertTo = nodeType(data.convertTo)
      if (!convertTo) throw new Error('Missing editor conversion type')
      return new ConvertNode(placeholder, convertTo)
    }
    if (op === 'SplitNode') {
      const node = new SplitNode(placeholder)
      node.components = components(data.components)
      return node
    }
    const node = new JoinNode([])
    node.nodeType = nodeType(data.nodeType)
    return node
  }
}

// The plugin resolves references atomically. Validate adapter-specific required
// inputs as well, before onApplied publishes any material replacement.
export const validateEditorNodeLinks = (extension: ExtensionDefinition) => {
  const isNodeRef = (value: unknown) => Boolean(value && typeof value === 'object' && '$ref' in value)
  for (const definition of Object.values(extension.nodes)) {
    if (['VarNode', 'ConvertNode', 'SplitNode'].includes(definition.op) && !isNodeRef(definition.links?.node)) {
      throw new Error(`Missing editor ${definition.op} node input`)
    }
    if (definition.op === 'JoinNode') {
      const nodes = definition.links?.nodes
      if (!Array.isArray(nodes) || !nodes.length || !nodes.every(isNodeRef)) throw new Error('Invalid editor vector join inputs')
    }
  }
}
