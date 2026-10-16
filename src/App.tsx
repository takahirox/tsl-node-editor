import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './workspace.css'
import { NodeInspector } from './NodeInspector'
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  CylinderGeometry,
} from 'three/webgpu'
import {
  BufferGeometry,
  Material,
  Mesh as ThreeMesh,
  NoToneMapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from 'three'
import {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  WebGPURenderer,
} from 'three/webgpu'
import WebGPU from 'three/addons/capabilities/WebGPU.js'
import { createEditorGLTFLoader, exportEditorMeshes, cloneImportedTSLMaterial, getImportedMaterialNode } from './tslGltf'
import type { UniformNode } from 'three/webgpu'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import {
  acesFilmicToneMapping,
  abs,
  acos,
  agxToneMapping,
  asin,
  atan,
  ceil,
  clamp,
  cos,
  color,
  cineonToneMapping,
  cross,
  checker,
  equal,
  distance,
  degrees,
  dot,
  dFdx,
  dFdy,
  exp,
  exp2,
  faceforward,
  float,
  floor,
  fract,
  fwidth,
  greaterThan,
  greaterThanEqual,
  grayscale,
  length,
  lessThan,
  lessThanEqual,
  linearToneMapping,
  log,
  log2,
  luminance,
  max,
  mat2,
  mat3,
  mat4,
  min,
  mix,
  modelWorldMatrix,
  modelViewMatrix,
  mx_fractal_noise_float,
  mx_fractal_noise_vec2,
  mx_fractal_noise_vec3,
  mx_fractal_noise_vec4,
  mx_noise_float,
  mx_noise_vec3,
  mx_noise_vec4,
  mx_worley_noise_float,
  mx_worley_noise_vec2,
  mx_worley_noise_vec3,
  mod,
  negate,
  neutralToneMapping,
  modelNormalMatrix,
  notEqual,
  normalize,
  oneMinus,
  posterize,
  pow2,
  pow3,
  pow4,
  remap,
  remapClamp,
  pow,
  normalLocal,
  tangentLocal,
  bitangentLocal,
  positionLocal,
  radians,
  reinhardToneMapping,
  reflect,
  refract,
  rotateUV,
  round,
  saturate,
  sRGBTransferEOTF,
  sRGBTransferOETF,
  saturation,
  select,
  sign,
  sin,
  spherizeUV,
  spritesheetUV,
  smoothstep,
  smoothstepElement,
  sqrt,
  step,
  stepElement,
  tan,
  texture,
  transpose,
  triNoise3D,
  trunc,
  uniform,
  uniformTexture,
  inverse,
  uv,
  vec2,
  vec3,
  vec4,
  cameraViewMatrix,
  cameraProjectionMatrix,
} from 'three/tsl'

type GraphNode = {
  id: string
  type: string
  label: string
  x: number
  y: number
  inputs: string[]
  outputs: string[]
  value?: number | string
  slider?: boolean
  textureKey?: string
  textureName?: string
  assetKey?: string
  assetName?: string
  meshIndex?: string
  materialIndex?: string
  textureIndex?: string
  updateMode?: UniformUpdateMode
  updateSource?: UniformUpdateSource
  functionId?: string
}

type UniformUpdateMode = 'manual' | 'frame' | 'render' | 'object'
type UniformUpdateSource =
  | 'value'
  | 'time'
  | 'objectPositionX'
  | 'objectPositionY'
  | 'objectPositionZ'
  | 'objectRotationX'
  | 'objectRotationY'
  | 'objectRotationZ'
  | 'objectScaleX'
  | 'objectScaleY'
  | 'objectScaleZ'
  | 'cameraPositionX'
  | 'cameraPositionY'
  | 'cameraPositionZ'

type GraphConnection = {
  id: string
  from: { nodeId: string; pin: string }
  to: { nodeId: string; pin: string }
}

type GraphGroup = {
  id: string
  label: string
  nodeIds: string[]
  collapsed?: boolean
}

type FunctionPin = {
  name: string
  nodeId: string
}

type FunctionDefinition = {
  id: string
  name: string
  nodes: GraphNode[]
  connections: GraphConnection[]
  inputs: FunctionPin[]
  outputs: FunctionPin[]
}

type UniformEntry = {
  uniform: UniformNode<'float', number> | UniformNode<'color', Color>
  mode: UniformUpdateMode
  source: UniformUpdateSource
  kind: 'number' | 'color'
}

type NodeMap = Map<string, GraphNode>
type ConnectionMap = Map<string, GraphConnection>
type OutputPin = 'baseColor' | 'roughness' | 'metalness'
type ExprKind = 'color' | 'number' | 'vec2' | 'vec3' | 'vec4' | 'mat2' | 'mat3' | 'mat4'
type ExprResult = { expr: string; kind: ExprKind }
// Pin kinds are checked by the dynamic graph resolver; r186 constructor return
// types describe concrete implementations rather than interchangeable nodes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNodeValue = any
type TslNodeResult = { node: TslNodeValue; kind: ExprKind }
type PaletteItem = {
  type: string
  label: string
  inputs: string[]
  outputs: string[]
  defaultValue?: string
}
type ExampleGraph = {
  nodes: GraphNode[]
  connections: GraphConnection[]
  groups?: GraphGroup[]
  functions?: Record<string, FunctionDefinition>
  ui?: { paletteOpen?: Record<string, boolean> }
}
type GltfTextureInfo = {
  texture?: Texture | null
  scale?: Vector2
  strength?: number
}
type GltfPbrMetallicRoughness = {
  baseColorFactor?: number[]
  baseColorTexture?: GltfTextureInfo
  metallicFactor?: number
  roughnessFactor?: number
  metallicRoughnessTexture?: GltfTextureInfo
}
type GltfMaterial = Material & {
  [key: string]: unknown
  color?: Color
  map?: Texture | null
  roughness?: number
  roughnessMap?: Texture | null
  metalness?: number
  metalnessMap?: Texture | null
  emissive?: Color
  emissiveMap?: Texture | null
  emissiveIntensity?: number
  normalMap?: Texture | null
  normalScale?: Vector2
  aoMap?: Texture | null
  aoMapIntensity?: number
  envMap?: Texture | null
  envMapIntensity?: number
  opacity?: number
  alphaTest?: number
  alphaHash?: boolean
  name?: string
  pbrMetallicRoughness?: GltfPbrMetallicRoughness
  emissiveFactor?: number[]
  emissiveTexture?: GltfTextureInfo
  emissiveStrength?: number
  normalTexture?: GltfTextureInfo
  occlusionTexture?: GltfTextureInfo
  clearcoatFactor?: number
  clearcoatTexture?: GltfTextureInfo
  clearcoatRoughnessFactor?: number
  clearcoatRoughnessTexture?: GltfTextureInfo
  clearcoatNormalTexture?: GltfTextureInfo
  sheenColorFactor?: number[]
  sheenColorTexture?: GltfTextureInfo
  sheenRoughnessFactor?: number
  sheenRoughnessTexture?: GltfTextureInfo
  iridescenceFactor?: number
  iridescenceTexture?: GltfTextureInfo
  iridescenceIOR?: number
  iridescenceThicknessRange?: [number, number]
  iridescenceThicknessTexture?: GltfTextureInfo
  ior?: number
  transmissionFactor?: number
  transmissionTexture?: GltfTextureInfo
  thicknessFactor?: number
  thicknessTexture?: GltfTextureInfo
  attenuationColor?: number[]
  attenuationDistance?: number
  specularColorFactor?: number[]
  specularColorTexture?: GltfTextureInfo
  specularFactor?: number
  specularTexture?: GltfTextureInfo
}

type GltfAssetEntry = {
  src: string
  geometries: BufferGeometry[]
  materials: Material[]
  meshNames: string[]
  textures: Texture[]
}

const buildNodeMap = (nodes: GraphNode[]): NodeMap =>
  new Map(nodes.map((node) => [node.id, node]))
const buildConnectionMap = (connections: GraphConnection[]): ConnectionMap =>
  new Map(
    connections.map((connection) => [
      `${connection.to.nodeId}:${connection.to.pin}`,
      connection,
    ]),
  )

const sanitizeConnections = (
  connections: GraphConnection[],
  nodes: GraphNode[],
): GraphConnection[] => {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const seenTargets = new Set<string>()
  const next: GraphConnection[] = []
  connections.forEach((connection) => {
    if (!nodeIds.has(connection.from.nodeId) || !nodeIds.has(connection.to.nodeId)) {
      return
    }
    const key = `${connection.to.nodeId}:${connection.to.pin}`
    if (seenTargets.has(key)) return
    seenTargets.add(key)
    next.push(connection)
  })
  return next
}

const expandFunctions = (
  nodes: GraphNode[],
  connections: GraphConnection[],
  functions: Record<string, FunctionDefinition>,
) => {
  const functionNodes = nodes.filter((node) => node.type === 'function' && node.functionId)
  if (!functionNodes.length) {
    return { nodes, connections }
  }

  const expandedNodes = nodes.filter((node) => node.type !== 'function')
  const expandedConnections = connections.filter(
    (connection) =>
      !functionNodes.some(
        (node) =>
          node.id === connection.from.nodeId || node.id === connection.to.nodeId,
      ),
  )

  functionNodes.forEach((fnNode) => {
    const def = fnNode.functionId ? functions[fnNode.functionId] : null
    if (!def) return
    const prefix = `fn-${fnNode.id}-`
    const idMap = new Map(def.nodes.map((node) => [node.id, `${prefix}${node.id}`]))
    const inputMap = new Map(
      def.inputs.map((pin) => [pin.name, idMap.get(pin.nodeId) ?? '']),
    )
    const outputMap = new Map(
      def.outputs.map((pin) => [pin.name, idMap.get(pin.nodeId) ?? '']),
    )
    def.nodes.forEach((node) => {
      const id = idMap.get(node.id)
      if (!id) return
      expandedNodes.push({ ...node, id })
    })
    def.connections.forEach((connection) => {
      const fromId = idMap.get(connection.from.nodeId)
      const toId = idMap.get(connection.to.nodeId)
      if (!fromId || !toId) return
      expandedConnections.push({
        ...connection,
        id: `${prefix}${connection.id}`,
        from: { ...connection.from, nodeId: fromId },
        to: { ...connection.to, nodeId: toId },
      })
    })

    connections.forEach((connection) => {
      if (connection.to.nodeId === fnNode.id) {
        const targetId = inputMap.get(connection.to.pin)
        if (!targetId) return
        expandedConnections.push({
          id: `${prefix}in-${connection.id}`,
          from: connection.from,
          to: { nodeId: targetId, pin: 'value' },
        })
      }
      if (connection.from.nodeId === fnNode.id) {
        const sourceId = outputMap.get(connection.from.pin)
        if (!sourceId) return
        expandedConnections.push({
          id: `${prefix}out-${connection.id}`,
          from: { nodeId: sourceId, pin: 'value' },
          to: connection.to,
        })
      }
    })
  })

  return { nodes: expandedNodes, connections: expandedConnections }
}

const DEFAULT_COLOR = '#4fb3c8'
const FALLBACK_COLOR = 0x111316
const FALLBACK_COLOR_HEX = '#111316'

const getOutputConnection = (
  connectionMap: ConnectionMap,
  outputNode: GraphNode | undefined,
  pin: OutputPin,
) => (outputNode ? connectionMap.get(`${outputNode.id}:${pin}`) ?? null : null)

const ATTRIBUTE_NODE_EXPR: Record<string, ExprResult> = {
  position: { expr: 'positionLocal', kind: 'vec3' },
  normal: { expr: 'normalLocal', kind: 'vec3' },
  tangent: { expr: 'tangentLocal', kind: 'vec3' },
  bitangent: { expr: 'bitangentLocal', kind: 'vec3' },
  uv: { expr: 'uv()', kind: 'vec2' },
  uv2: { expr: 'uv(1)', kind: 'vec2' },
}

const ATTRIBUTE_NODE_KIND: Record<string, 'vec2' | 'vec3'> = {
  position: 'vec3',
  normal: 'vec3',
  tangent: 'vec3',
  bitangent: 'vec3',
  uv: 'vec2',
  uv2: 'vec2',
}

const getAttributeExpr = (nodeType: string): ExprResult | null =>
  ATTRIBUTE_NODE_EXPR[nodeType] ?? null
const getAttributeKind = (nodeType: string): 'vec2' | 'vec3' | null =>
  ATTRIBUTE_NODE_KIND[nodeType] ?? null
const getAttributeNodeValue = (nodeType: string): TslNodeResult | null => {
  switch (nodeType) {
    case 'position':
      return { node: positionLocal, kind: 'vec3' }
    case 'normal':
      return { node: normalLocal, kind: 'vec3' }
    case 'tangent':
      return { node: tangentLocal, kind: 'vec3' }
    case 'bitangent':
      return { node: bitangentLocal, kind: 'vec3' }
    case 'uv':
      return { node: uv(), kind: 'vec2' }
    case 'uv2':
      return { node: uv(1), kind: 'vec2' }
    default:
      return null
  }
}

const parseMeshIndex = (value: string | undefined, max: number) => {
  if (max <= 0) return 0
  if (!value) return 0
  const parsed = Number(value.trim())
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= max) return 0
  return parsed
}

const getMeshIndex = (node: GraphNode, max: number) =>
  parseMeshIndex(node.meshIndex, max)

const parseMaterialIndex = (value: string | undefined, max: number) => {
  if (max <= 0) return 0
  if (!value) return 0
  const parsed = Number(value.trim())
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= max) return 0
  return parsed
}

const getMaterialIndex = (node: GraphNode, max: number) =>
  parseMaterialIndex(node.materialIndex, max)

const parseTextureIndex = (value: string | undefined, max: number) => {
  if (max <= 0) return 0
  if (!value) return 0
  const parsed = Number(value.trim())
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= max) return 0
  return parsed
}

const getTextureIndex = (node: GraphNode, max: number) =>
  parseTextureIndex(node.textureIndex, max)

const isKtx2Texture = (node: GraphNode) => {
  const name = (node.textureName ?? '').toLowerCase()
  const value = typeof node.value === 'string' ? node.value.toLowerCase() : ''
  return name.endsWith('.ktx2') || value.includes('.ktx2')
}

const getGltfMaterialTextureId = (nodeId: string, key: string) =>
  `gltf-material-${nodeId}-${key}`

const getGltfTextureId = (nodeId: string) => `gltf-texture-${nodeId}`

function App() {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const [paletteVisible, setPaletteVisible] = useState(true)
  const [compactPanel, setCompactPanel] = useState('graph')
  const [status, setStatus] = useState('Initializing...')
  const [showCode, setShowCode] = useState(false)
  const [tslPanelMode, setTslPanelMode] = useState<'code' | 'viewer'>('code')
  const [tslOutputKind, setTslOutputKind] = useState<
    'tsl' | 'material' | 'app' | 'gltf'
  >('tsl')
  const [gltfOutputText, setGltfOutputText] = useState('')
  const [viewerReadyTick, setViewerReadyTick] = useState(0)
  const [exportFormat, setExportFormat] = useState<'js' | 'ts'>('js')
  const [toast, setToast] = useState<string | null>(null)
  const [materialReady, setMaterialReady] = useState(false)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [groups, setGroups] = useState<GraphGroup[]>([])
  const [functions, setFunctions] = useState<Record<string, FunctionDefinition>>({})
  const [activeFunctionId, setActiveFunctionId] = useState<string | null>(null)
  const dragRef = useRef<{
    ids: string[]
    offsets: Record<string, { x: number; y: number }>
    elements?: Record<string, HTMLElement>
  } | null>(null)
  const groupDragRef = useRef<{
    id: string
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const groupClickSuppressRef = useRef<{ id: string } | null>(null)
  const isDraggingNodesRef = useRef(false)
  const dragRafRef = useRef<number | null>(null)
  const dragPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const panRafRef = useRef<number | null>(null)
  const panPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const nodeWorldRef = useRef<HTMLDivElement | null>(null)
  const nodeLinksRef = useRef<SVGSVGElement | null>(null)
  const viewerRef = useRef<HTMLIFrameElement | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [connections, setConnections] = useState<GraphConnection[]>([])
  type HistorySnapshot = {
    nodes: GraphNode[]
    connections: GraphConnection[]
    groups: GraphGroup[]
    functions: Record<string, FunctionDefinition>
  }
  type HistoryState = {
    past: HistorySnapshot[]
    future: HistorySnapshot[]
    last: HistorySnapshot | null
    lastSig: string | null
  }
  const historyRef = useRef<{
    past: HistorySnapshot[]
    future: HistorySnapshot[]
    last: HistorySnapshot | null
    lastSig: string | null
  }>({ past: [], future: [], last: null, lastSig: null })
  const historyPendingRef = useRef<HistorySnapshot | null>(null)
  const historyTimerRef = useRef<number | null>(null)
  const historySkipRef = useRef(false)
  const [historyTick, setHistoryTick] = useState(0)
  const [linkDraft, setLinkDraft] = useState<{
    from: { nodeId: string; pin: string }
    x: number
    y: number
  } | null>(null)
  const linkDraftRef = useRef<{
    from: { nodeId: string; pin: string }
    x: number
    y: number
  } | null>(null)
  const [pinPositions, setPinPositions] = useState<
    Record<string, { x: number; y: number }>
  >({})
  const [groupBounds, setGroupBounds] = useState<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({})
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [typeWarnings, setTypeWarnings] = useState<Record<string, string>>({})
  const [textureVersion, setTextureVersion] = useState(0)
  const [gltfVersion, setGltfVersion] = useState(0)
  const nodesRef = useRef(nodes)
  const connectionsRef = useRef(connections)
  const setEditorNodesRef = useRef<(updater: React.SetStateAction<GraphNode[]>) => void>(
    () => undefined,
  )
  const setEditorConnectionsRef = useRef<
    (updater: React.SetStateAction<GraphConnection[]>) => void
  >(() => undefined)
  const codePreviewRef = useRef('')
  const viewRef = useRef(view)
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const timeUniformRef = useRef(uniform(0))
  const rendererRef = useRef<WebGPURenderer | null>(null)
  const ktx2LoaderRef = useRef<KTX2Loader | null>(null)
  const [ktx2Ready, setKtx2Ready] = useState(false)
  const meshesRef = useRef<Mesh[]>([])
  const geometriesRef = useRef<BufferGeometry[]>([])
  const sceneRef = useRef<Scene | null>(null)
  const materialRef = useRef<
    MeshStandardNodeMaterial | MeshPhysicalNodeMaterial | MeshBasicNodeMaterial | null
  >(
    null,
  )
  const nodeUniformsRef = useRef<Record<string, UniformEntry>>({})
  const fallbackColorUniformRef = useRef<UniformNode<'float', number> | UniformNode<'color', Color> | null>(null)
  const graphSignatureRef = useRef<string>('')
  const isImportedPreviewRef = useRef(false)
  const textureSignatureRef = useRef<string>('')
  const textureMapRef = useRef<Record<string, { src: string; texture: Texture }>>(
    {},
  )
  const gltfMapRef = useRef<Record<string, GltfAssetEntry>>(
    {},
  )
  const objectUrlRef = useRef<Record<string, string>>({})
  // Start with the persisted slot so the default graph cannot race its load.
  const [storageSlot, setStorageSlot] = useState(() =>
    localStorage.getItem('tsl-node-editor:last-slot')?.trim() || 'default',
  )
  const [storageSlots, setStorageSlots] = useState<string[]>(['default'])
  const [newSlotName, setNewSlotName] = useState('')
  const historyBySlotRef = useRef<Record<string, HistoryState>>({})
  const historySlotRef = useRef(storageSlot)
  const historyRecordingEnabled = true // Temporary toggle for drag hitch profiling

  const lastSlotStorageKey = 'tsl-node-editor:last-slot'
  const autoSaveTimerRef = useRef<number | null>(null)
  const isHydratingRef = useRef(false)
  const pendingExampleLayoutRef = useRef(false)
  const nodeSizeRef = useRef<Record<string, { width: number; height: number }>>({})
  const dbName = 'tsl-node-editor'
  const graphSchemaVersion = 2
  const dbVersion = 2

  const applyViewportTransform = useCallback((next: { x: number; y: number; zoom: number }) => {
    const transform = `translate(${next.x}px, ${next.y}px) scale(${next.zoom})`
    if (nodeWorldRef.current) {
      nodeWorldRef.current.style.transform = transform
    }
    if (nodeLinksRef.current) {
      nodeLinksRef.current.style.transform = transform
    }
  }, [])

  const basePalette = useMemo<PaletteItem[]>(
    () => [
      {
        type: 'number',
        label: 'Number',
        inputs: [],
        outputs: ['value'],
        defaultValue: '1',
      },
      {
        type: 'time',
        label: 'Time',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'color',
        label: 'Color',
        inputs: [],
        outputs: ['color'],
        defaultValue: DEFAULT_COLOR,
      },
      {
        type: 'texture',
        label: 'Texture',
        inputs: [],
        outputs: ['color'],
        defaultValue: '',
      },
      {
        type: 'luminance',
        label: 'Luminance',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'grayscale',
        label: 'Grayscale',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'saturation',
        label: 'Saturation',
        inputs: ['value', 'amount'],
        outputs: ['value'],
      },
      {
        type: 'posterize',
        label: 'Posterize',
        inputs: ['value', 'steps'],
        outputs: ['value'],
      },
      {
        type: 'sRGBTransferEOTF',
        label: 'sRGB EOTF',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'sRGBTransferOETF',
        label: 'sRGB OETF',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'linearToneMapping',
        label: 'Linear Tone Mapping',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'reinhardToneMapping',
        label: 'Reinhard Tone Mapping',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'cineonToneMapping',
        label: 'Cineon Tone Mapping',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'acesFilmicToneMapping',
        label: 'ACES Filmic Tone Mapping',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'agxToneMapping',
        label: 'AgX Tone Mapping',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'neutralToneMapping',
        label: 'Neutral Tone Mapping',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'position',
        label: 'Position',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'normal',
        label: 'Normal',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'tangent',
        label: 'Tangent',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'bitangent',
        label: 'Bitangent',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'uv',
        label: 'UV',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'uv2',
        label: 'UV2',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'gltf',
        label: 'GLTF Geometry',
        inputs: [],
        outputs: ['geometry'],
        defaultValue: '',
      },
      {
        type: 'gltfMaterial',
        label: 'GLTF Material',
        inputs: [],
        outputs: [
          'baseColor',
          'baseColorTexture',
          'roughness',
          'metalness',
          'roughnessMap',
          'metalnessMap',
          'emissive',
          'emissiveMap',
          'emissiveIntensity',
          'normalMap',
          'normalScale',
          'aoMap',
          'aoMapIntensity',
          'envMap',
          'envMapIntensity',
          'opacity',
          'alphaTest',
          'alphaHash',
        ],
        defaultValue: '',
      },
      {
        type: 'gltfTexture',
        label: 'GLTF Texture',
        inputs: [],
        outputs: ['value'],
        defaultValue: '',
      },
      { type: 'add', label: 'Add', inputs: ['a', 'b'], outputs: ['value'] },
      {
        type: 'multiply',
        label: 'Multiply',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'normalize',
        label: 'Normalize',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'dot',
        label: 'Dot',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'cross',
        label: 'Cross',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'checker',
        label: 'Checker',
        inputs: ['coord'],
        outputs: ['value'],
      },
      {
        type: 'distance',
        label: 'Distance',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'dFdx',
        label: 'dFdx',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'dFdy',
        label: 'dFdy',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'fwidth',
        label: 'Fwidth',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'triNoise3D',
        label: 'TriNoise3D',
        inputs: ['position', 'speed', 'time'],
        outputs: ['value'],
      },
      {
        type: 'mxNoiseFloat',
        label: 'MX Noise Float',
        inputs: ['texcoord', 'amplitude', 'pivot'],
        outputs: ['value'],
      },
      {
        type: 'mxNoiseVec3',
        label: 'MX Noise Vec3',
        inputs: ['texcoord', 'amplitude', 'pivot'],
        outputs: ['value'],
      },
      {
        type: 'mxNoiseVec4',
        label: 'MX Noise Vec4',
        inputs: ['texcoord', 'amplitude', 'pivot'],
        outputs: ['value'],
      },
      {
        type: 'mxFractalNoiseFloat',
        label: 'MX Fractal Noise Float',
        inputs: ['position', 'octaves', 'lacunarity', 'diminish', 'amplitude'],
        outputs: ['value'],
      },
      {
        type: 'mxFractalNoiseVec2',
        label: 'MX Fractal Noise Vec2',
        inputs: ['position', 'octaves', 'lacunarity', 'diminish', 'amplitude'],
        outputs: ['value'],
      },
      {
        type: 'mxFractalNoiseVec3',
        label: 'MX Fractal Noise Vec3',
        inputs: ['position', 'octaves', 'lacunarity', 'diminish', 'amplitude'],
        outputs: ['value'],
      },
      {
        type: 'mxFractalNoiseVec4',
        label: 'MX Fractal Noise Vec4',
        inputs: ['position', 'octaves', 'lacunarity', 'diminish', 'amplitude'],
        outputs: ['value'],
      },
      {
        type: 'mxWorleyNoiseFloat',
        label: 'MX Worley Noise Float',
        inputs: ['texcoord', 'jitter'],
        outputs: ['value'],
      },
      {
        type: 'mxWorleyNoiseVec2',
        label: 'MX Worley Noise Vec2',
        inputs: ['texcoord', 'jitter'],
        outputs: ['value'],
      },
      {
        type: 'mxWorleyNoiseVec3',
        label: 'MX Worley Noise Vec3',
        inputs: ['texcoord', 'jitter'],
        outputs: ['value'],
      },
      {
        type: 'rotateUV',
        label: 'Rotate UV',
        inputs: ['uv', 'rotation', 'center'],
        outputs: ['value'],
      },
      {
        type: 'scaleUV',
        label: 'Scale UV',
        inputs: ['uv', 'scale'],
        outputs: ['value'],
      },
      {
        type: 'offsetUV',
        label: 'Offset UV',
        inputs: ['uv', 'offset'],
        outputs: ['value'],
      },
      {
        type: 'spherizeUV',
        label: 'Spherize UV',
        inputs: ['uv', 'strength', 'center'],
        outputs: ['value'],
      },
      {
        type: 'spritesheetUV',
        label: 'Spritesheet UV',
        inputs: ['size', 'uv', 'time'],
        outputs: ['value'],
      },
      {
        type: 'reflect',
        label: 'Reflect',
        inputs: ['incident', 'normal'],
        outputs: ['value'],
      },
      {
        type: 'refract',
        label: 'Refract',
        inputs: ['incident', 'normal', 'eta'],
        outputs: ['value'],
      },
      {
        type: 'faceforward',
        label: 'FaceForward',
        inputs: ['n', 'i', 'nref'],
        outputs: ['value'],
      },
      {
        type: 'length',
        label: 'Length',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'smoothstep',
        label: 'Smoothstep',
        inputs: ['edge0', 'edge1', 'x'],
        outputs: ['value'],
      },
      {
        type: 'pow',
        label: 'Pow',
        inputs: ['base', 'exp'],
        outputs: ['value'],
      },
      {
        type: 'sine',
        label: 'Sine',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'vec3',
        label: 'Vec3',
        inputs: ['x', 'y', 'z'],
        outputs: ['value'],
      },
      {
        type: 'mat3',
        label: 'Mat3',
        inputs: ['c0', 'c1', 'c2'],
        outputs: ['value'],
      },
      {
        type: 'scale',
        label: 'Scale',
        inputs: ['value', 'scale'],
        outputs: ['value'],
      },
      {
        type: 'rotate',
        label: 'Rotate',
        inputs: ['value', 'rotation'],
        outputs: ['value'],
      },
      {
        type: 'splitVec3',
        label: 'Split Vec3',
        inputs: ['value'],
        outputs: ['x', 'y', 'z'],
      },
      {
        type: 'vec2',
        label: 'Vec2',
        inputs: ['x', 'y'],
        outputs: ['value'],
      },
      {
        type: 'mat2',
        label: 'Mat2',
        inputs: ['c0', 'c1'],
        outputs: ['value'],
      },
      {
        type: 'splitVec2',
        label: 'Split Vec2',
        inputs: ['value'],
        outputs: ['x', 'y'],
      },
      {
        type: 'vec4',
        label: 'Vec4',
        inputs: ['x', 'y', 'z', 'w'],
        outputs: ['value'],
      },
      {
        type: 'mat4',
        label: 'Mat4',
        inputs: ['c0', 'c1', 'c2', 'c3'],
        outputs: ['value'],
      },
      {
        type: 'modelMatrix',
        label: 'Model Matrix',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'viewMatrix',
        label: 'View Matrix',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'projectionMatrix',
        label: 'Projection Matrix',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'modelViewMatrix',
        label: 'ModelView Matrix',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'normalMatrix',
        label: 'Normal Matrix',
        inputs: [],
        outputs: ['value'],
      },
      {
        type: 'splitVec4',
        label: 'Split Vec4',
        inputs: ['value'],
        outputs: ['x', 'y', 'z', 'w'],
      },
      {
        type: 'transpose',
        label: 'Transpose',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'inverse',
        label: 'Inverse',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'cosine',
        label: 'Cosine',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'tan',
        label: 'Tan',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'asin',
        label: 'Asin',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'acos',
        label: 'Acos',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'atan',
        label: 'Atan',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'atan2',
        label: 'Atan2',
        inputs: ['y', 'x'],
        outputs: ['value'],
      },
      {
        type: 'radians',
        label: 'Radians',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'degrees',
        label: 'Degrees',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'abs',
        label: 'Abs',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'clamp',
        label: 'Clamp',
        inputs: ['value', 'min', 'max'],
        outputs: ['value'],
      },
      {
        type: 'min',
        label: 'Min',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'max',
        label: 'Max',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'step',
        label: 'Step',
        inputs: ['edge', 'x'],
        outputs: ['value'],
      },
      {
        type: 'fract',
        label: 'Fract',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'floor',
        label: 'Floor',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'ceil',
        label: 'Ceil',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'round',
        label: 'Round',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'trunc',
        label: 'Trunc',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'sqrt',
        label: 'Sqrt',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'mod',
        label: 'Mod',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'exp',
        label: 'Exp',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'exp2',
        label: 'Exp2',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'log',
        label: 'Log',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'log2',
        label: 'Log2',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'pow2',
        label: 'Pow2',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'pow3',
        label: 'Pow3',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'pow4',
        label: 'Pow4',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'sign',
        label: 'Sign',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'saturate',
        label: 'Saturate',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'remap',
        label: 'Remap',
        inputs: ['value', 'inLow', 'inHigh', 'outLow', 'outHigh'],
        outputs: ['value'],
      },
      {
        type: 'remapClamp',
        label: 'Remap Clamp',
        inputs: ['value', 'inLow', 'inHigh', 'outLow', 'outHigh'],
        outputs: ['value'],
      },
      {
        type: 'oneMinus',
        label: 'OneMinus',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'negate',
        label: 'Negate',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'mix',
        label: 'Mix',
        inputs: ['a', 'b', 't'],
        outputs: ['value'],
      },
      {
        type: 'ifElse',
        label: 'If Else',
        inputs: ['cond', 'a', 'b', 'threshold'],
        outputs: ['value'],
      },
      {
        type: 'smoothstepElement',
        label: 'Smoothstep Element',
        inputs: ['x', 'low', 'high'],
        outputs: ['value'],
      },
      {
        type: 'stepElement',
        label: 'Step Element',
        inputs: ['x', 'edge'],
        outputs: ['value'],
      },
      {
        type: 'lessThan',
        label: 'Less Than',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'lessThanEqual',
        label: 'Less Than Equal',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'greaterThan',
        label: 'Greater Than',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'greaterThanEqual',
        label: 'Greater Than Equal',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'equal',
        label: 'Equal',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'notEqual',
        label: 'Not Equal',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'and',
        label: 'And',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'or',
        label: 'Or',
        inputs: ['a', 'b'],
        outputs: ['value'],
      },
      {
        type: 'not',
        label: 'Not',
        inputs: ['value'],
        outputs: ['value'],
      },
      {
        type: 'geometryPrimitive',
        label: 'PrimitiveGeometry',
        inputs: [],
        outputs: ['geometry'],
        defaultValue: 'box',
      },
      {
        type: 'geometryOutput',
        label: 'Geometry Output',
        inputs: ['geometry'],
        outputs: [],
      },
      {
        type: 'vertexOutput',
        label: 'Vertex Output',
        inputs: ['position'],
        outputs: [],
      },
      {
        type: 'material',
        label: 'StandardMaterial',
        inputs: [
          'baseColor',
          'baseColorTexture',
          'roughness',
          'roughnessMap',
          'metalness',
          'metalnessMap',
          'emissive',
          'emissiveMap',
          'emissiveIntensity',
          'normalMap',
          'normalScale',
          'aoMap',
          'aoMapIntensity',
          'envMap',
          'envMapIntensity',
          'opacity',
          'alphaTest',
          'alphaHash',
        ],
        outputs: ['baseColor', 'roughness', 'metalness'],
      },
      {
        type: 'physicalMaterial',
        label: 'PhysicalMaterial',
        inputs: [
          'baseColor',
          'baseColorTexture',
          'roughness',
          'roughnessMap',
          'metalness',
          'metalnessMap',
          'emissive',
          'emissiveMap',
          'emissiveIntensity',
          'normalMap',
          'normalScale',
          'clearcoat',
          'clearcoatRoughness',
          'clearcoatNormal',
          'aoMap',
          'aoMapIntensity',
          'envMap',
          'envMapIntensity',
          'opacity',
          'alphaTest',
          'alphaHash',
        ],
        outputs: ['baseColor', 'roughness', 'metalness'],
      },
      {
        type: 'basicMaterial',
        label: 'BasicMaterial',
        inputs: [
          'baseColor',
          'baseColorTexture',
          'opacity',
          'alphaTest',
          'alphaHash',
          'map',
          'alphaMap',
          'aoMap',
          'envMap',
          'envMapIntensity',
          'reflectivity',
        ],
        outputs: ['baseColor'],
      },
      {
        type: 'output',
        label: 'Fragment Output',
        inputs: ['baseColor', 'roughness', 'metalness'],
        outputs: [],
      },
    ],
    [],
  )

  const functionPalette = useMemo<PaletteItem[]>(
    () =>
      Object.values(functions).map((fn) => ({
        type: `function:${fn.id}`,
        label: fn.name,
        inputs: fn.inputs.map((pin) => pin.name),
        outputs: fn.outputs.map((pin) => pin.name),
      })),
    [functions],
  )

  const palette = useMemo(
    () => [...basePalette, ...functionPalette],
    [basePalette, functionPalette],
  )

  const isFunctionEditing = activeFunctionId !== null
  const activeFunction = activeFunctionId ? functions[activeFunctionId] : null
  const editorNodes = activeFunction?.nodes ?? nodes
  const editorConnections = activeFunction?.connections ?? connections
  const editorGroups = isFunctionEditing ? [] : groups

  const getMaterialKindFromOutput = (
    outputNode: GraphNode | undefined,
    nodeMap: NodeMap,
    connectionMap: ConnectionMap,
  ) => {
    if (!outputNode) return 'standard' as const
    const baseColorConn = connectionMap.get(`${outputNode.id}:baseColor`)
    if (!baseColorConn) return 'standard' as const
    const source = nodeMap.get(baseColorConn.from.nodeId)
    if (source?.type === 'basicMaterial') return 'basic' as const
    if (source?.type === 'physicalMaterial') return 'physical' as const
    return 'standard' as const
  }

  const getMaterialNodesFromOutput = (
    outputNode: GraphNode | undefined,
    nodeMap: NodeMap,
    connectionMap: ConnectionMap,
  ) => {
    if (!outputNode) {
      return {
        standardMaterialNode: null as GraphNode | null,
        physicalMaterialNode: null as GraphNode | null,
        basicMaterialNode: null as GraphNode | null,
      }
    }
    const baseColorConn = connectionMap.get(`${outputNode.id}:baseColor`)
    const source = baseColorConn ? nodeMap.get(baseColorConn.from.nodeId) : null
    return {
      standardMaterialNode: source?.type === 'material' ? source : null,
      physicalMaterialNode: source?.type === 'physicalMaterial' ? source : null,
      basicMaterialNode: source?.type === 'basicMaterial' ? source : null,
    }
  }

  const paletteGroups = useMemo(() => {
    const functionTypes = Object.keys(functions).map((id) => `function:${id}`)
    return [
      { id: 'inputs', label: 'Inputs', types: ['number', 'time', 'color', 'texture', 'gltfTexture'] },
      {
        id: 'color',
        label: 'Color',
        types: [
          'luminance',
          'grayscale',
          'saturation',
          'posterize',
          'sRGBTransferEOTF',
          'sRGBTransferOETF',
          'linearToneMapping',
          'reinhardToneMapping',
          'cineonToneMapping',
          'acesFilmicToneMapping',
          'agxToneMapping',
          'neutralToneMapping',
        ],
      },
      {
        id: 'geometry',
        label: 'Geometry',
        types: [
          'position',
          'normal',
          'tangent',
          'bitangent',
          'uv',
          'uv2',
          'geometryPrimitive',
          'gltf',
        ],
      },
      {
        id: 'math',
        label: 'Math',
        types: [
          'add',
          'multiply',
          'normalize',
          'dot',
          'cross',
          'checker',
          'dFdx',
          'dFdy',
          'distance',
          'reflect',
          'refract',
          'faceforward',
          'fwidth',
          'triNoise3D',
          'length',
          'smoothstep',
          'pow',
          'sine',
          'cosine',
          'tan',
          'asin',
          'acos',
          'atan',
          'atan2',
          'radians',
          'degrees',
          'abs',
          'clamp',
          'min',
          'max',
          'step',
          'fract',
          'floor',
          'ceil',
          'round',
          'trunc',
          'sqrt',
          'mod',
          'exp',
          'exp2',
          'log',
          'log2',
          'pow2',
          'pow3',
          'pow4',
          'sign',
          'saturate',
          'remap',
          'remapClamp',
          'oneMinus',
          'negate',
          'mix',
          'ifElse',
          'smoothstepElement',
          'stepElement',
          'lessThan',
          'lessThanEqual',
          'greaterThan',
          'greaterThanEqual',
          'equal',
          'notEqual',
          'and',
          'or',
          'not',
        ],
      },
      {
        id: 'noise',
        label: 'Noise',
        types: [
          'checker',
          'triNoise3D',
          'mxNoiseFloat',
          'mxNoiseVec3',
          'mxNoiseVec4',
          'mxFractalNoiseFloat',
          'mxFractalNoiseVec2',
          'mxFractalNoiseVec3',
          'mxFractalNoiseVec4',
          'mxWorleyNoiseFloat',
          'mxWorleyNoiseVec2',
          'mxWorleyNoiseVec3',
          'rotateUV',
          'scaleUV',
          'offsetUV',
          'spherizeUV',
          'spritesheetUV',
        ],
      },
      {
        id: 'vector',
        label: 'Vector',
        types: [
          'vec2',
          'mat2',
          'splitVec2',
          'vec3',
          'mat3',
          'scale',
          'rotate',
          'splitVec3',
          'vec4',
          'mat4',
          'modelMatrix',
          'viewMatrix',
          'projectionMatrix',
          'modelViewMatrix',
          'normalMatrix',
          'splitVec4',
          'transpose',
          'inverse',
        ],
      },
      {
        id: 'material',
        label: 'Material',
        types: ['material', 'physicalMaterial', 'basicMaterial', 'gltfMaterial'],
      },
      {
        id: 'outputs',
        label: 'Outputs',
        types: ['output', 'vertexOutput', 'geometryOutput'],
      },
      ...(functionTypes.length
        ? [{ id: 'functions', label: 'Functions', types: functionTypes }]
        : []),
    ]
  }, [functions])

  const paletteByType = useMemo(
    () => new Map(palette.map((item) => [item.type, item])),
    [palette],
  )

  const sortedPaletteGroups = useMemo(
    () =>
      [...paletteGroups]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((group) => ({
          ...group,
          types: [...group.types].sort((a, b) => {
            const labelA = paletteByType.get(a)?.label ?? a
            const labelB = paletteByType.get(b)?.label ?? b
            return labelA.localeCompare(labelB)
          }),
        })),
    [paletteGroups, paletteByType],
  )

  const [paletteQuery, setPaletteQuery] = useState('')
  const filteredPaletteGroups = useMemo(() => {
    const query = paletteQuery.trim().toLowerCase()
    if (!query) return sortedPaletteGroups
    return sortedPaletteGroups
      .map((group) => ({
        ...group,
        types: group.types.filter((type) => {
          const label = paletteByType.get(type)?.label ?? type
          return label.toLowerCase().includes(query)
        }),
      }))
      .filter((group) => group.types.length > 0)
  }, [paletteQuery, sortedPaletteGroups, paletteByType])

  const setEditorNodes = useCallback(
    (updater: React.SetStateAction<GraphNode[]>) => {
      if (!isFunctionEditing) {
        setNodes(updater)
        return
      }
      if (!activeFunctionId) return
      setFunctions((prev) => {
        const def = prev[activeFunctionId]
        if (!def) return prev
        const nextNodes =
          typeof updater === 'function' ? (updater as (prev: GraphNode[]) => GraphNode[])(def.nodes) : updater
        return {
          ...prev,
          [activeFunctionId]: {
            ...def,
            nodes: nextNodes,
          },
        }
      })
    },
    [activeFunctionId, isFunctionEditing, setFunctions],
  )

  const setEditorConnections = useCallback(
    (updater: React.SetStateAction<GraphConnection[]>) => {
      if (!isFunctionEditing) {
        setConnections(updater)
        return
      }
      if (!activeFunctionId) return
      setFunctions((prev) => {
        const def = prev[activeFunctionId]
        if (!def) return prev
        const nextConnections =
          typeof updater === 'function'
            ? (updater as (prev: GraphConnection[]) => GraphConnection[])(def.connections)
            : updater
        return {
          ...prev,
          [activeFunctionId]: {
            ...def,
            connections: nextConnections,
          },
        }
      })
    },
    [activeFunctionId, isFunctionEditing, setFunctions],
  )

  useEffect(() => {
    setEditorNodesRef.current = setEditorNodes
    setEditorConnectionsRef.current = setEditorConnections
  }, [setEditorNodes, setEditorConnections])

  useEffect(() => {
    setSelectedNodeIds([])
  }, [activeFunctionId])

  useEffect(() => {
    if (activeFunctionId && !functions[activeFunctionId]) {
      setActiveFunctionId(null)
    }
  }, [activeFunctionId, functions])

  const estimateNodeHeight = useCallback((node: GraphNode) => {
    const measured = nodeSizeRef.current[node.id]?.height
    if (measured) return measured
    const pinCount = Math.max(node.inputs.length, node.outputs.length)
    const headerHeight = 40
    const rowHeight = 26
    const padding = 32
    return headerHeight + padding + pinCount * rowHeight
  }, [])

  const cloneHistoryState = (state: HistoryState): HistoryState => ({
    past: state.past.map((snap) => ({
      nodes: [...snap.nodes],
      connections: [...snap.connections],
      groups: [...snap.groups],
      functions: { ...snap.functions },
    })),
    future: state.future.map((snap) => ({
      nodes: [...snap.nodes],
      connections: [...snap.connections],
      groups: [...snap.groups],
      functions: { ...snap.functions },
    })),
    last: state.last
      ? {
          nodes: [...state.last.nodes],
          connections: [...state.last.connections],
          groups: [...state.last.groups],
          functions: { ...state.last.functions },
        }
      : null,
    lastSig: state.lastSig,
  })

  const spreadNodesByColumn = useCallback(
    (graphNodes: GraphNode[]) => {
      const updates = new Map<string, GraphNode>()
      const columns: Array<{ x: number; nodes: GraphNode[] }> = []
      const columnThreshold = 40
      graphNodes.forEach((node) => {
        let column = columns.find((entry) => Math.abs(entry.x - node.x) <= columnThreshold)
        if (!column) {
          column = { x: node.x, nodes: [] }
          columns.push(column)
        }
        column.nodes.push(node)
      })
      columns.sort((a, b) => a.x - b.x)
      columns.forEach((column) => {
        const list = column.nodes
        list.sort((a, b) => a.y - b.y)
        let cursor = -Infinity
        const spacing = 40
        list.forEach((node, index) => {
          const height = Math.max(estimateNodeHeight(node), 120)
          const nextY = index === 0 ? node.y : Math.max(node.y, cursor + spacing)
          cursor = nextY + height
          updates.set(node.id, { ...node, y: nextY })
        })
      })
      return graphNodes.map((node) => updates.get(node.id) ?? node)
    },
    [estimateNodeHeight],
  )

  const computeLayout = useCallback(
    (graphNodes: GraphNode[], graphConnections: GraphConnection[]) => {
      if (!graphNodes.length) return graphNodes
      const nodeMap = buildNodeMap(graphNodes)
      const incoming = new Map<string, Set<string>>()
      const outgoing = new Map<string, Set<string>>()
      graphNodes.forEach((node) => {
        incoming.set(node.id, new Set())
        outgoing.set(node.id, new Set())
      })
      graphConnections.forEach((connection) => {
        if (!nodeMap.has(connection.from.nodeId) || !nodeMap.has(connection.to.nodeId)) {
          return
        }
        outgoing.get(connection.from.nodeId)?.add(connection.to.nodeId)
        incoming.get(connection.to.nodeId)?.add(connection.from.nodeId)
      })
      const queue: string[] = []
      incoming.forEach((sources, id) => {
        if (sources.size === 0) queue.push(id)
      })
      const order: string[] = []
      const tempIncoming = new Map(
        Array.from(incoming.entries()).map(([id, sources]) => [id, new Set(sources)]),
      )
      while (queue.length) {
        const id = queue.shift()!
        order.push(id)
        outgoing.get(id)?.forEach((next) => {
          const set = tempIncoming.get(next)
          if (!set) return
          set.delete(id)
          if (set.size === 0) {
            queue.push(next)
          }
        })
      }
      graphNodes.forEach((node) => {
        if (!order.includes(node.id)) {
          order.push(node.id)
        }
      })
      const depth = new Map<string, number>()
      order.forEach((id) => {
        const parents = incoming.get(id)
        if (!parents || parents.size === 0) {
          depth.set(id, 0)
          return
        }
        let maxDepth = 0
        parents.forEach((parent) => {
          const parentDepth = depth.get(parent)
          if (parentDepth !== undefined) {
            maxDepth = Math.max(maxDepth, parentDepth + 1)
          }
        })
        depth.set(id, maxDepth)
      })
      const columns = new Map<number, string[]>()
      order.forEach((id) => {
        const column = depth.get(id) ?? 0
        if (!columns.has(column)) columns.set(column, [])
        columns.get(column)?.push(id)
      })
      const xSpacing = 280
      const ySpacing = 170
      return graphNodes.map((node) => {
        const column = depth.get(node.id) ?? 0
        const list = columns.get(column) ?? []
        const rowIndex = list.indexOf(node.id)
        return {
          ...node,
          x: 40 + column * xSpacing,
          y: 40 + rowIndex * ySpacing,
        }
      })
    },
    [],
  )

  const layoutNodes = useCallback(() => {
    if (!editorNodes.length) return
    const next = computeLayout(editorNodes, editorConnections)
    setEditorNodes(spreadNodesByColumn(next))
  }, [computeLayout, editorConnections, editorNodes, setEditorNodes, spreadNodesByColumn])

  const paletteDefaults = useMemo(
    () =>
      Object.fromEntries(paletteGroups.map((group) => [group.id, false])) as Record<
        string,
        boolean
      >,
    [paletteGroups],
  )

  const canUndo = historyTick >= 0 && historyRef.current.past.length > 0
  const canRedo = historyTick >= 0 && historyRef.current.future.length > 0

  const [paletteOpen, setPaletteOpen] = useState<Record<string, boolean>>(
    () => paletteDefaults,
  )

  useEffect(() => {
    setPaletteOpen((prev) => ({ ...paletteDefaults, ...prev }))
  }, [paletteDefaults])

  const allPaletteOpen = useMemo(
    () =>
      Object.fromEntries(paletteGroups.map((group) => [group.id, true])) as Record<
        string,
        boolean
      >,
    [paletteGroups],
  )

  const allPaletteClosed = useMemo(
    () =>
      Object.fromEntries(paletteGroups.map((group) => [group.id, false])) as Record<
        string,
        boolean
      >,
    [paletteGroups],
  )

  const isPaletteAllExpanded = useMemo(
    () => paletteGroups.every((group) => paletteOpen[group.id]),
    [paletteGroups, paletteOpen],
  )

  const isPaletteAllCollapsed = useMemo(
    () => paletteGroups.every((group) => !paletteOpen[group.id]),
    [paletteGroups, paletteOpen],
  )

  const exampleGraph = useMemo<ExampleGraph>(
    () => ({
      nodes: [
        {
          id: 'color-example',
          type: 'color',
          label: 'Color',
          x: 60,
          y: 120,
          inputs: [],
          outputs: ['color'],
          value: DEFAULT_COLOR,
        },
        {
          id: 'geometry-example',
          type: 'geometryPrimitive',
          label: 'Geometry',
          x: 60,
          y: 400,
          inputs: [],
          outputs: ['geometry'],
          value: 'torus',
        },
        {
          id: 'geometry-output-example',
          type: 'geometryOutput',
          label: 'Geometry Output',
          x: 320,
          y: 460,
          inputs: ['geometry'],
          outputs: [],
        },
        {
          id: 'time-example',
          type: 'time',
          label: 'Time',
          x: 60,
          y: 260,
          inputs: [],
          outputs: ['value'],
        },
        {
          id: 'color-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 1100,
          y: 200,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'position-example',
          type: 'position',
          label: 'Position',
          x: 60,
          y: 540,
          inputs: [],
          outputs: ['value'],
        },
        {
          id: 'length-example',
          type: 'length',
          label: 'Length',
          x: 320,
          y: 1000,
          inputs: ['value'],
          outputs: ['value'],
        },
        {
          id: 'pos-freq-example',
          type: 'number',
          label: 'Number',
          x: 320,
          y: 1180,
          inputs: [],
          outputs: ['value'],
          value: '6',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'pos-freq-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 580,
          y: 940,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'pos-speed-example',
          type: 'number',
          label: 'Number',
          x: 320,
          y: 640,
          inputs: [],
          outputs: ['value'],
          value: '2.5',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'pos-time-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 580,
          y: 520,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'pos-time-neg-example',
          type: 'number',
          label: 'Number',
          x: 320,
          y: 820,
          inputs: [],
          outputs: ['value'],
          value: '-1',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'pos-time-neg-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 580,
          y: 660,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'pos-phase-example',
          type: 'add',
          label: 'Add',
          x: 840,
          y: 420,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'pos-wave-example',
          type: 'sine',
          label: 'Sine',
          x: 1100,
          y: 420,
          inputs: ['value'],
          outputs: ['value'],
        },
        {
          id: 'pos-edge-low-example',
          type: 'number',
          label: 'Number',
          x: 320,
          y: 120,
          inputs: [],
          outputs: ['value'],
          value: '0.85',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'pos-edge-high-example',
          type: 'number',
          label: 'Number',
          x: 320,
          y: 280,
          inputs: [],
          outputs: ['value'],
          value: '0.95',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'pos-band-example',
          type: 'smoothstep',
          label: 'Smoothstep',
          x: 1360,
          y: 420,
          inputs: ['edge0', 'edge1', 'x'],
          outputs: ['value'],
        },
        {
          id: 'pos-invert-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 1620,
          y: 420,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'pos-invert-bias-example',
          type: 'number',
          label: 'Number',
          x: 1620,
          y: 560,
          inputs: [],
          outputs: ['value'],
          value: '-1',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'pos-invert-add-example',
          type: 'add',
          label: 'Add',
          x: 1880,
          y: 420,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'pos-invert-one-example',
          type: 'number',
          label: 'Number',
          x: 1880,
          y: 560,
          inputs: [],
          outputs: ['value'],
          value: '1',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'normal-example',
          type: 'normal',
          label: 'Normal',
          x: 60,
          y: 700,
          inputs: [],
          outputs: ['value'],
        },
        {
          id: 'vert-split-example',
          type: 'splitVec3',
          label: 'Split Vec3',
          x: 320,
          y: 1360,
          inputs: ['value'],
          outputs: ['x', 'y', 'z'],
        },
        {
          id: 'vert-length-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 580,
          y: 1080,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'vert-freq-example',
          type: 'number',
          label: 'Number',
          x: 320,
          y: 1540,
          inputs: [],
          outputs: ['value'],
          value: '3',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'vert-time-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 580,
          y: 1360,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'vert-speed-example',
          type: 'number',
          label: 'Number',
          x: 320,
          y: 1720,
          inputs: [],
          outputs: ['value'],
          value: '2',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'vert-phase-example',
          type: 'add',
          label: 'Add',
          x: 840,
          y: 1220,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'vert-sine-example',
          type: 'sine',
          label: 'Sine',
          x: 1100,
          y: 1220,
          inputs: ['value'],
          outputs: ['value'],
        },
        {
          id: 'vert-amp-example',
          type: 'number',
          label: 'Number',
          x: 1100,
          y: 1360,
          inputs: [],
          outputs: ['value'],
          value: '0.15',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'vert-amp-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 1360,
          y: 1220,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'vert-normal-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 1360,
          y: 1360,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'vertex-output-example',
          type: 'vertexOutput',
          label: 'Vertex Output',
          x: 1620,
          y: 1280,
          inputs: ['position'],
          outputs: [],
        },
        {
          id: 'final-mult-example',
          type: 'multiply',
          label: 'Multiply',
          x: 2140,
          y: 260,
          inputs: ['a', 'b'],
          outputs: ['value'],
        },
        {
          id: 'roughness-example',
          type: 'number',
          label: 'Number',
          x: 60,
          y: 840,
          inputs: [],
          outputs: ['value'],
          value: '0.6',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'metalness-example',
          type: 'number',
          label: 'Number',
          x: 60,
          y: 980,
          inputs: [],
          outputs: ['value'],
          value: '0.1',
          slider: false,
          updateMode: 'manual',
          updateSource: 'value',
        },
        {
          id: 'output-example',
          type: 'output',
          label: 'Fragment Output',
          x: 2400,
          y: 260,
          inputs: ['baseColor', 'roughness', 'metalness'],
          outputs: [],
        },
      ],
      connections: [
        {
          id: 'conn-time-speed',
          from: { nodeId: 'time-example', pin: 'value' },
          to: { nodeId: 'pos-time-mult-example', pin: 'a' },
        },
        {
          id: 'conn-color-mult',
          from: { nodeId: 'color-example', pin: 'color' },
          to: { nodeId: 'color-mult-example', pin: 'a' },
        },
        {
          id: 'conn-geometry-output',
          from: { nodeId: 'geometry-example', pin: 'geometry' },
          to: { nodeId: 'geometry-output-example', pin: 'geometry' },
        },
        {
          id: 'conn-position-add',
          from: { nodeId: 'position-example', pin: 'value' },
          to: { nodeId: 'length-example', pin: 'value' },
        },
        {
          id: 'conn-length-freq',
          from: { nodeId: 'length-example', pin: 'value' },
          to: { nodeId: 'pos-freq-mult-example', pin: 'a' },
        },
        {
          id: 'conn-freq-mult',
          from: { nodeId: 'pos-freq-example', pin: 'value' },
          to: { nodeId: 'pos-freq-mult-example', pin: 'b' },
        },
        {
          id: 'conn-speed-mult',
          from: { nodeId: 'pos-speed-example', pin: 'value' },
          to: { nodeId: 'pos-time-mult-example', pin: 'b' },
        },
        {
          id: 'conn-time-neg',
          from: { nodeId: 'pos-time-mult-example', pin: 'value' },
          to: { nodeId: 'pos-time-neg-mult-example', pin: 'a' },
        },
        {
          id: 'conn-time-neg-value',
          from: { nodeId: 'pos-time-neg-example', pin: 'value' },
          to: { nodeId: 'pos-time-neg-mult-example', pin: 'b' },
        },
        {
          id: 'conn-phase-add-a',
          from: { nodeId: 'pos-freq-mult-example', pin: 'value' },
          to: { nodeId: 'pos-phase-example', pin: 'a' },
        },
        {
          id: 'conn-phase-add-b',
          from: { nodeId: 'pos-time-neg-mult-example', pin: 'value' },
          to: { nodeId: 'pos-phase-example', pin: 'b' },
        },
        {
          id: 'conn-phase-sine',
          from: { nodeId: 'pos-phase-example', pin: 'value' },
          to: { nodeId: 'pos-wave-example', pin: 'value' },
        },
        {
          id: 'conn-band-edge0',
          from: { nodeId: 'pos-edge-low-example', pin: 'value' },
          to: { nodeId: 'pos-band-example', pin: 'edge0' },
        },
        {
          id: 'conn-band-edge1',
          from: { nodeId: 'pos-edge-high-example', pin: 'value' },
          to: { nodeId: 'pos-band-example', pin: 'edge1' },
        },
        {
          id: 'conn-band-x',
          from: { nodeId: 'pos-wave-example', pin: 'value' },
          to: { nodeId: 'pos-band-example', pin: 'x' },
        },
        {
          id: 'conn-invert-band',
          from: { nodeId: 'pos-band-example', pin: 'value' },
          to: { nodeId: 'pos-invert-mult-example', pin: 'a' },
        },
        {
          id: 'conn-invert-mult',
          from: { nodeId: 'pos-invert-bias-example', pin: 'value' },
          to: { nodeId: 'pos-invert-mult-example', pin: 'b' },
        },
        {
          id: 'conn-invert-add-a',
          from: { nodeId: 'pos-invert-mult-example', pin: 'value' },
          to: { nodeId: 'pos-invert-add-example', pin: 'a' },
        },
        {
          id: 'conn-invert-add-b',
          from: { nodeId: 'pos-invert-one-example', pin: 'value' },
          to: { nodeId: 'pos-invert-add-example', pin: 'b' },
        },
        {
          id: 'conn-vert-length',
          from: { nodeId: 'vert-split-example', pin: 'y' },
          to: { nodeId: 'vert-length-mult-example', pin: 'a' },
        },
        {
          id: 'conn-vert-split',
          from: { nodeId: 'position-example', pin: 'value' },
          to: { nodeId: 'vert-split-example', pin: 'value' },
        },
        {
          id: 'conn-vert-freq',
          from: { nodeId: 'vert-freq-example', pin: 'value' },
          to: { nodeId: 'vert-length-mult-example', pin: 'b' },
        },
        {
          id: 'conn-vert-time',
          from: { nodeId: 'time-example', pin: 'value' },
          to: { nodeId: 'vert-time-mult-example', pin: 'a' },
        },
        {
          id: 'conn-vert-speed',
          from: { nodeId: 'vert-speed-example', pin: 'value' },
          to: { nodeId: 'vert-time-mult-example', pin: 'b' },
        },
        {
          id: 'conn-vert-phase-a',
          from: { nodeId: 'vert-length-mult-example', pin: 'value' },
          to: { nodeId: 'vert-phase-example', pin: 'a' },
        },
        {
          id: 'conn-vert-phase-b',
          from: { nodeId: 'vert-time-mult-example', pin: 'value' },
          to: { nodeId: 'vert-phase-example', pin: 'b' },
        },
        {
          id: 'conn-vert-sine',
          from: { nodeId: 'vert-phase-example', pin: 'value' },
          to: { nodeId: 'vert-sine-example', pin: 'value' },
        },
        {
          id: 'conn-vert-amp-sine',
          from: { nodeId: 'vert-sine-example', pin: 'value' },
          to: { nodeId: 'vert-amp-mult-example', pin: 'a' },
        },
        {
          id: 'conn-vert-amp',
          from: { nodeId: 'vert-amp-example', pin: 'value' },
          to: { nodeId: 'vert-amp-mult-example', pin: 'b' },
        },
        {
          id: 'conn-vert-normal',
          from: { nodeId: 'normal-example', pin: 'value' },
          to: { nodeId: 'vert-normal-mult-example', pin: 'a' },
        },
        {
          id: 'conn-vert-offset',
          from: { nodeId: 'vert-amp-mult-example', pin: 'value' },
          to: { nodeId: 'vert-normal-mult-example', pin: 'b' },
        },
        {
          id: 'conn-vert-output',
          from: { nodeId: 'vert-normal-mult-example', pin: 'value' },
          to: { nodeId: 'vertex-output-example', pin: 'position' },
        },
        {
          id: 'conn-color-final',
          from: { nodeId: 'color-mult-example', pin: 'value' },
          to: { nodeId: 'final-mult-example', pin: 'a' },
        },
        {
          id: 'conn-pos-final',
          from: { nodeId: 'pos-invert-add-example', pin: 'value' },
          to: { nodeId: 'final-mult-example', pin: 'b' },
        },
        {
          id: 'conn-color-output',
          from: { nodeId: 'final-mult-example', pin: 'value' },
          to: { nodeId: 'output-example', pin: 'baseColor' },
        },
        {
          id: 'conn-roughness-output',
          from: { nodeId: 'roughness-example', pin: 'value' },
          to: { nodeId: 'output-example', pin: 'roughness' },
        },
        {
          id: 'conn-metalness-output',
          from: { nodeId: 'metalness-example', pin: 'value' },
          to: { nodeId: 'output-example', pin: 'metalness' },
        },
      ],
      groups: [],
      functions: {},
      ui: { paletteOpen: paletteDefaults },
    }),
    [paletteDefaults],
  )

  const migrateGraph = (
    currentNodes: GraphNode[],
    currentConnections: GraphConnection[],
    version: number,
  ): { nodes: GraphNode[]; connections: GraphConnection[]; version: number } => {
    const nextNodes = currentNodes
    let nextConnections = currentConnections
    let nextVersion = version

    if (nextVersion < 2) {
      const nodeMap = buildNodeMap(nextNodes)
      const byTo = buildConnectionMap(nextConnections)
      const byFrom = new Map<string, GraphConnection[]>()
      nextConnections.forEach((connection) => {
        const list = byFrom.get(connection.from.nodeId)
        if (list) {
          list.push(connection)
        } else {
          byFrom.set(connection.from.nodeId, [connection])
        }
      })
      const newConnections = [...nextConnections]

      const ensureConnection = (
        id: string,
        from: { nodeId: string; pin: string },
        to: { nodeId: string; pin: string },
      ) => {
        const targetKey = `${to.nodeId}:${to.pin}`
        if (byTo.has(targetKey)) return
        const connection = { id, from, to }
        newConnections.push(connection)
        byTo.set(targetKey, connection)
        const list = byFrom.get(from.nodeId)
        if (list) {
          list.push(connection)
        } else {
          byFrom.set(from.nodeId, [connection])
        }
      }

      const positionNode = nodeMap.get('position-example') ?? nextNodes.find((n) => n.type === 'position')
      const lengthNode = nodeMap.get('length-example') ?? nextNodes.find((n) => n.type === 'length')
      const freqNumber =
        nodeMap.get('pos-freq-example') ??
        nextNodes.find((n) => n.type === 'number' && Math.abs(parseNumber(n.value) - 6) < 1e-4)

      const findSmoothstepChain = () => {
        const smoothstep = nextNodes.find((node) => node.type === 'smoothstep')
        if (!smoothstep) return null
        const xConn = byTo.get(`${smoothstep.id}:x`)
        const sine = xConn ? nodeMap.get(xConn.from.nodeId) : null
        if (!sine || sine.type !== 'sine') return null
        const addConn = byTo.get(`${sine.id}:value`)
        const add = addConn ? nodeMap.get(addConn.from.nodeId) : null
        if (!add || add.type !== 'add') return null
        return { smoothstep, sine, add }
      }

      const chain = findSmoothstepChain()
      const addNode = chain?.add ?? null
      const isFreqMultiply = (node: GraphNode) => {
        if (node.type !== 'multiply' || !freqNumber) return false
        const connA = byTo.get(`${node.id}:a`)
        const connB = byTo.get(`${node.id}:b`)
        return (
          connA?.from.nodeId === freqNumber.id || connB?.from.nodeId === freqNumber.id
        )
      }

      let freqMultiply: GraphNode | null = null
      if (addNode) {
        const connA = byTo.get(`${addNode.id}:a`)
        const connB = byTo.get(`${addNode.id}:b`)
        const nodeA = connA ? nodeMap.get(connA.from.nodeId) : null
        const nodeB = connB ? nodeMap.get(connB.from.nodeId) : null
        if (nodeA && isFreqMultiply(nodeA)) freqMultiply = nodeA
        if (!freqMultiply && nodeB && isFreqMultiply(nodeB)) freqMultiply = nodeB
      }
      if (!freqMultiply) {
        freqMultiply = nextNodes.find((node) => isFreqMultiply(node)) ?? null
      }

      if (positionNode && lengthNode) {
        ensureConnection(
          'migrate-pos-length',
          { nodeId: positionNode.id, pin: 'value' },
          { nodeId: lengthNode.id, pin: 'value' },
        )
      }
      if (lengthNode && freqMultiply && freqNumber) {
        const connA = byTo.get(`${freqMultiply.id}:a`)
        const connB = byTo.get(`${freqMultiply.id}:b`)
        const hasLength =
          connA?.from.nodeId === lengthNode.id || connB?.from.nodeId === lengthNode.id
        const hasFreq =
          connA?.from.nodeId === freqNumber.id || connB?.from.nodeId === freqNumber.id
        if (!hasLength) {
          if (!connA) {
            ensureConnection(
              'migrate-length-freq-a',
              { nodeId: lengthNode.id, pin: 'value' },
              { nodeId: freqMultiply.id, pin: 'a' },
            )
          } else if (!connB) {
            ensureConnection(
              'migrate-length-freq-b',
              { nodeId: lengthNode.id, pin: 'value' },
              { nodeId: freqMultiply.id, pin: 'b' },
            )
          }
        }
        if (!hasFreq) {
          const connA2 = byTo.get(`${freqMultiply.id}:a`)
          const connB2 = byTo.get(`${freqMultiply.id}:b`)
          if (!connA2) {
            ensureConnection(
              'migrate-freq-a',
              { nodeId: freqNumber.id, pin: 'value' },
              { nodeId: freqMultiply.id, pin: 'a' },
            )
          } else if (!connB2) {
            ensureConnection(
              'migrate-freq-b',
              { nodeId: freqNumber.id, pin: 'value' },
              { nodeId: freqMultiply.id, pin: 'b' },
            )
          }
        }
      }

      nextConnections = newConnections

      nextVersion = 2
    }

    return { nodes: nextNodes, connections: nextConnections, version: nextVersion }
  }

  const inputTypes = useMemo<Record<string, Record<string, string>>>(
    () => ({
      add: { a: 'any', b: 'any' },
      multiply: { a: 'any', b: 'any' },
      normalize: { value: 'vector' },
      dot: { a: 'vector', b: 'vector' },
      cross: { a: 'vector3', b: 'vector3' },
      checker: { coord: 'vec2' },
      distance: { a: 'any', b: 'any' },
      dFdx: { value: 'any' },
      dFdy: { value: 'any' },
      reflect: { incident: 'vector3', normal: 'vector3' },
      refract: { incident: 'vector3', normal: 'vector3', eta: 'number' },
      faceforward: { n: 'vector3', i: 'vector3', nref: 'vector3' },
      fwidth: { value: 'any' },
      triNoise3D: { position: 'vec3', speed: 'number', time: 'number' },
      mxNoiseFloat: { texcoord: 'vector', amplitude: 'number', pivot: 'number' },
      mxNoiseVec3: { texcoord: 'vector', amplitude: 'number', pivot: 'number' },
      mxNoiseVec4: { texcoord: 'vector', amplitude: 'number', pivot: 'number' },
      mxFractalNoiseFloat: {
        position: 'vector',
        octaves: 'number',
        lacunarity: 'number',
        diminish: 'number',
        amplitude: 'number',
      },
      mxFractalNoiseVec2: {
        position: 'vector',
        octaves: 'number',
        lacunarity: 'number',
        diminish: 'number',
        amplitude: 'number',
      },
      mxFractalNoiseVec3: {
        position: 'vector',
        octaves: 'number',
        lacunarity: 'number',
        diminish: 'number',
        amplitude: 'number',
      },
      mxFractalNoiseVec4: {
        position: 'vector',
        octaves: 'number',
        lacunarity: 'number',
        diminish: 'number',
        amplitude: 'number',
      },
      mxWorleyNoiseFloat: { texcoord: 'vector', jitter: 'number' },
      mxWorleyNoiseVec2: { texcoord: 'vector', jitter: 'number' },
      mxWorleyNoiseVec3: { texcoord: 'vector', jitter: 'number' },
      rotateUV: { uv: 'vec2', rotation: 'number', center: 'vec2' },
      scaleUV: { uv: 'vec2', scale: 'vec2' },
      offsetUV: { uv: 'vec2', offset: 'vec2' },
      spherizeUV: { uv: 'vec2', strength: 'number', center: 'vec2' },
      spritesheetUV: { size: 'vec2', uv: 'vec2', time: 'number' },
      luminance: { value: 'vector3' },
      grayscale: { value: 'vector3' },
      saturation: { value: 'vector3', amount: 'number' },
      posterize: { value: 'vector3', steps: 'number' },
      sRGBTransferEOTF: { value: 'vector3' },
      sRGBTransferOETF: { value: 'vector3' },
      linearToneMapping: { value: 'vector3' },
      reinhardToneMapping: { value: 'vector3' },
      cineonToneMapping: { value: 'vector3' },
      acesFilmicToneMapping: { value: 'vector3' },
      agxToneMapping: { value: 'vector3' },
      neutralToneMapping: { value: 'vector3' },
      length: { value: 'vector' },
      smoothstep: { edge0: 'any', edge1: 'any', x: 'any' },
      pow: { base: 'any', exp: 'any' },
      sine: { value: 'number' },
      vec2: { x: 'number', y: 'number' },
      vec3: { x: 'number', y: 'number', z: 'number' },
      scale: { value: 'vec3', scale: 'vec3' },
      rotate: { value: 'vec3', rotation: 'vec3' },
      vec4: { x: 'number', y: 'number', z: 'number', w: 'number' },
      mat2: { c0: 'vec2', c1: 'vec2' },
      mat3: { c0: 'vec3', c1: 'vec3', c2: 'vec3' },
      mat4: { c0: 'vec4', c1: 'vec4', c2: 'vec4', c3: 'vec4' },
      transpose: { value: 'matrix' },
      inverse: { value: 'matrix' },
      splitVec2: { value: 'vec2' },
      splitVec3: { value: 'vec3' },
      splitVec4: { value: 'vec4' },
      cosine: { value: 'number' },
      tan: { value: 'any' },
      asin: { value: 'any' },
      acos: { value: 'any' },
      atan: { value: 'any' },
      atan2: { y: 'any', x: 'any' },
      radians: { value: 'any' },
      degrees: { value: 'any' },
      abs: { value: 'number' },
      clamp: { value: 'number', min: 'number', max: 'number' },
      min: { a: 'any', b: 'any' },
      max: { a: 'any', b: 'any' },
      step: { edge: 'any', x: 'any' },
      fract: { value: 'any' },
      floor: { value: 'any' },
      ceil: { value: 'any' },
      round: { value: 'any' },
      trunc: { value: 'any' },
      sqrt: { value: 'any' },
      mod: { a: 'any', b: 'any' },
      exp: { value: 'any' },
      exp2: { value: 'any' },
      log: { value: 'any' },
      log2: { value: 'any' },
      pow2: { value: 'any' },
      pow3: { value: 'any' },
      pow4: { value: 'any' },
      sign: { value: 'any' },
      saturate: { value: 'any' },
      remap: {
        value: 'any',
        inLow: 'any',
        inHigh: 'any',
        outLow: 'any',
        outHigh: 'any',
      },
      remapClamp: {
        value: 'any',
        inLow: 'any',
        inHigh: 'any',
        outLow: 'any',
        outHigh: 'any',
      },
      oneMinus: { value: 'any' },
      negate: { value: 'any' },
      mix: { a: 'any', b: 'any', t: 'number' },
      ifElse: { cond: 'any', a: 'any', b: 'any', threshold: 'number' },
      smoothstepElement: { x: 'any', low: 'any', high: 'any' },
      stepElement: { x: 'any', edge: 'any' },
      lessThan: { a: 'any', b: 'any' },
      lessThanEqual: { a: 'any', b: 'any' },
      greaterThan: { a: 'any', b: 'any' },
      greaterThanEqual: { a: 'any', b: 'any' },
      equal: { a: 'any', b: 'any' },
      notEqual: { a: 'any', b: 'any' },
      and: { a: 'any', b: 'any' },
      or: { a: 'any', b: 'any' },
      not: { value: 'any' },
      geometryOutput: { geometry: 'geometry' },
      gltf: {},
      material: {
        baseColor: 'color',
        baseColorTexture: 'color',
        roughnessMap: 'color',
        metalnessMap: 'color',
        emissive: 'color',
        emissiveMap: 'color',
        emissiveIntensity: 'number',
        roughness: 'number',
        metalness: 'number',
        normalMap: 'color',
        normalScale: 'vec2',
        aoMap: 'color',
        aoMapIntensity: 'number',
        envMap: 'color',
        envMapIntensity: 'number',
        opacity: 'number',
        alphaTest: 'number',
        alphaHash: 'number',
      },
      physicalMaterial: {
        baseColor: 'color',
        baseColorTexture: 'color',
        roughnessMap: 'color',
        metalnessMap: 'color',
        emissive: 'color',
        emissiveMap: 'color',
        emissiveIntensity: 'number',
        roughness: 'number',
        metalness: 'number',
        normalMap: 'color',
        normalScale: 'vec2',
        aoMap: 'color',
        aoMapIntensity: 'number',
        envMap: 'color',
        envMapIntensity: 'number',
        opacity: 'number',
        alphaTest: 'number',
        alphaHash: 'number',
        clearcoat: 'number',
        clearcoatRoughness: 'number',
        clearcoatNormal: 'color',
      },
      basicMaterial: {
        baseColor: 'color',
        baseColorTexture: 'color',
        opacity: 'number',
        alphaTest: 'number',
        alphaHash: 'number',
        map: 'color',
        alphaMap: 'color',
        aoMap: 'color',
        envMap: 'color',
        envMapIntensity: 'number',
        reflectivity: 'number',
      },
      output: { baseColor: 'color', roughness: 'number', metalness: 'number' },
      vertexOutput: { position: 'vec3' },
      functionInput: { value: 'any' },
      functionOutput: { value: 'any' },
    }),
    [],
  )

  const materialInputGroups = useMemo<
    Record<string, { label: string; pins: string[] }[]>
  >(
    () => ({
      material: [
        { label: 'Base', pins: ['baseColor', 'baseColorTexture'] },
        {
          label: 'Surface',
          pins: ['roughness', 'roughnessMap', 'metalness', 'metalnessMap'],
        },
        { label: 'Emission', pins: ['emissive', 'emissiveMap', 'emissiveIntensity'] },
        { label: 'Normal', pins: ['normalMap', 'normalScale'] },
        { label: 'Occlusion', pins: ['aoMap', 'aoMapIntensity'] },
        { label: 'Environment', pins: ['envMap', 'envMapIntensity'] },
        { label: 'Transparency', pins: ['opacity', 'alphaTest', 'alphaHash'] },
      ],
      physicalMaterial: [
        { label: 'Base', pins: ['baseColor', 'baseColorTexture'] },
        {
          label: 'Surface',
          pins: ['roughness', 'roughnessMap', 'metalness', 'metalnessMap'],
        },
        { label: 'Emission', pins: ['emissive', 'emissiveMap', 'emissiveIntensity'] },
        { label: 'Normal', pins: ['normalMap', 'normalScale'] },
        {
          label: 'Clearcoat',
          pins: ['clearcoat', 'clearcoatRoughness', 'clearcoatNormal'],
        },
        { label: 'Occlusion', pins: ['aoMap', 'aoMapIntensity'] },
        { label: 'Environment', pins: ['envMap', 'envMapIntensity'] },
        { label: 'Transparency', pins: ['opacity', 'alphaTest', 'alphaHash'] },
      ],
      basicMaterial: [
        { label: 'Base', pins: ['baseColor', 'baseColorTexture'] },
        { label: 'Opacity', pins: ['opacity', 'alphaTest', 'alphaHash'] },
        { label: 'Maps', pins: ['map', 'alphaMap', 'aoMap'] },
        { label: 'Environment', pins: ['envMap', 'envMapIntensity', 'reflectivity'] },
      ],
    }),
    [],
  )

 
  const inferType = (
    nodeId: string,
    outputPin: string | undefined,
    nodeMap: NodeMap,
    connectionMap: ConnectionMap,
    stack: Set<string>,
  ): 
    | 'number'
    | 'color'
    | 'vec2'
    | 'vec3'
    | 'vec4'
    | 'mat2'
    | 'mat3'
    | 'mat4'
    | 'geometry'
    | 'unknown' => {
    if (stack.has(nodeId)) return 'unknown'
    stack.add(nodeId)
    const node = nodeMap.get(nodeId)
    if (!node) return 'unknown'
    if (node.type === 'number') return 'number'
    if (node.type === 'color' || node.type === 'texture' || node.type === 'gltfTexture') {
      return 'color'
    }
    if (node.type === 'function') {
      const def = node.functionId ? functions[node.functionId] : null
      if (!def) return 'unknown'
      const targetPin = outputPin ?? def.outputs[0]?.name
      if (!targetPin) return 'unknown'
      const output = def.outputs.find((pin) => pin.name === targetPin)
      if (!output) return 'unknown'
      const internalNodeMap = buildNodeMap(def.nodes)
      const internalConnectionMap = buildConnectionMap(def.connections)
      return inferType(
        output.nodeId,
        'value',
        internalNodeMap,
        internalConnectionMap,
        new Set(),
      )
    }
    const attributeKind = getAttributeKind(node.type)
    if (attributeKind) return attributeKind
    if (node.type === 'time') return 'number'
    if (node.type === 'sine') return 'number'
    if (node.type === 'normalize') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      return isVectorKind(inputType) ? inputType : 'unknown'
    }
    if (node.type === 'length') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      return isVectorKind(inputType) ? 'number' : 'unknown'
    }
    if (node.type === 'dot') {
      const inputA = connectionMap.get(`${node.id}:a`)
      const inputB = connectionMap.get(`${node.id}:b`)
      const typeA = inputA
        ? inferType(inputA.from.nodeId, inputA.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      const typeB = inputB
        ? inferType(inputB.from.nodeId, inputB.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      const vecA = getVectorKind(typeA)
      const vecB = getVectorKind(typeB)
      if (!vecA || !vecB) return 'unknown'
      if (vecA !== vecB) return 'unknown'
      return 'number'
    }
    if (node.type === 'cross') {
      const inputA = connectionMap.get(`${node.id}:a`)
      const inputB = connectionMap.get(`${node.id}:b`)
      const typeA = inputA
        ? inferType(inputA.from.nodeId, inputA.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      const typeB = inputB
        ? inferType(inputB.from.nodeId, inputB.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      const vecA = getVectorKind(typeA)
      const vecB = getVectorKind(typeB)
      if (vecA !== 'vec3' || vecB !== 'vec3') return 'unknown'
      return typeA === 'color' || typeB === 'color' ? 'color' : 'vec3'
    }
    if (node.type === 'smoothstep') {
      const edge0Input = connectionMap.get(`${node.id}:edge0`)
      const edge1Input = connectionMap.get(`${node.id}:edge1`)
      const xInput = connectionMap.get(`${node.id}:x`)
      const type0 = edge0Input
        ? inferType(edge0Input.from.nodeId, edge0Input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const type1 = edge1Input
        ? inferType(edge1Input.from.nodeId, edge1Input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const typeX = xInput
        ? inferType(xInput.from.nodeId, xInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      return resolveVectorOutputKind([type0, type1, typeX])
    }
    if (node.type === 'pow') {
      const baseInput = connectionMap.get(`${node.id}:base`)
      const expInput = connectionMap.get(`${node.id}:exp`)
      const baseType = baseInput
        ? inferType(baseInput.from.nodeId, baseInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const expType = expInput
        ? inferType(expInput.from.nodeId, expInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      return resolveVectorOutputKind([baseType, expType])
    }
    if (node.type === 'vec2') return 'vec2'
    if (node.type === 'vec3') return 'vec3'
    if (node.type === 'mat2') return 'mat2'
    if (node.type === 'mat3') return 'mat3'
    if (node.type === 'mat4') return 'mat4'
    if (node.type === 'modelMatrix') return 'mat4'
    if (node.type === 'viewMatrix') return 'mat4'
    if (node.type === 'projectionMatrix') return 'mat4'
    if (node.type === 'modelViewMatrix') return 'mat4'
    if (node.type === 'normalMatrix') return 'mat3'
    if (node.type === 'scale') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      if (inputType === 'vec3' || inputType === 'number') return 'vec3'
      return 'unknown'
    }
    if (node.type === 'rotate') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      if (inputType === 'vec3' || inputType === 'number') return 'vec3'
      return 'unknown'
    }
    if (node.type === 'vec4') return 'vec4'
    if (node.type === 'splitVec2') {
      if (outputPin === 'x' || outputPin === 'y') {
        return 'number'
      }
      return 'unknown'
    }
    if (node.type === 'splitVec3') {
      if (outputPin === 'x' || outputPin === 'y' || outputPin === 'z') {
        return 'number'
      }
      return 'unknown'
    }
    if (node.type === 'splitVec4') {
      if (outputPin === 'x' || outputPin === 'y' || outputPin === 'z' || outputPin === 'w') {
        return 'number'
      }
      return 'unknown'
    }
    if (node.type === 'cosine') return 'number'
    if (node.type === 'checker') return 'number'
    if (node.type === 'distance') return 'number'
    if (node.type === 'dFdx' || node.type === 'dFdy' || node.type === 'fwidth') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (inputType === 'number' || isVectorKind(inputType)) return inputType
      return 'unknown'
    }
    if (node.type === 'mxNoiseFloat') return 'number'
    if (node.type === 'mxNoiseVec3') return 'vec3'
    if (node.type === 'mxNoiseVec4') return 'vec4'
    if (node.type === 'mxFractalNoiseFloat') return 'number'
    if (node.type === 'mxFractalNoiseVec2') return 'vec2'
    if (node.type === 'mxFractalNoiseVec3') return 'vec3'
    if (node.type === 'mxFractalNoiseVec4') return 'vec4'
    if (node.type === 'mxWorleyNoiseFloat') return 'number'
    if (node.type === 'mxWorleyNoiseVec2') return 'vec2'
    if (node.type === 'mxWorleyNoiseVec3') return 'vec3'
    if (node.type === 'rotateUV') return 'vec2'
    if (node.type === 'scaleUV') return 'vec2'
    if (node.type === 'offsetUV') return 'vec2'
    if (node.type === 'spherizeUV') return 'vec2'
    if (node.type === 'spritesheetUV') return 'vec2'
    if (node.type === 'reflect' || node.type === 'refract' || node.type === 'faceforward') {
      const getType = (pin: string) => {
        const input = connectionMap.get(`${node.id}:${pin}`)
        return input
          ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
          : 'unknown'
      }
      const types =
        node.type === 'reflect'
          ? [getType('incident'), getType('normal')]
          : node.type === 'refract'
            ? [getType('incident'), getType('normal')]
            : [getType('n'), getType('i'), getType('nref')]
      if (types.some((type) => type === 'unknown')) return 'unknown'
      if (types.some((type) => type !== 'vec3' && type !== 'color')) return 'unknown'
      return types.some((type) => type === 'color') ? 'color' : 'vec3'
    }
    if (node.type === 'triNoise3D') return 'number'
    if (node.type === 'tan') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (inputType === 'number' || isVectorKind(inputType)) return inputType
      return 'unknown'
    }
    if (node.type === 'asin' || node.type === 'acos' || node.type === 'atan') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (inputType === 'number' || isVectorKind(inputType)) return inputType
      return 'unknown'
    }
    if (
      node.type === 'sqrt' ||
      node.type === 'exp2' ||
      node.type === 'log2' ||
      node.type === 'pow2' ||
      node.type === 'pow3' ||
      node.type === 'pow4' ||
      node.type === 'saturate'
    ) {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (inputType === 'number' || isVectorKind(inputType)) return inputType
      return 'unknown'
    }
    if (node.type === 'remap' || node.type === 'remapClamp') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (inputType === 'number' || isVectorKind(inputType)) return inputType
      return 'unknown'
    }
    if (node.type === 'smoothstepElement') {
      const lowInput = connectionMap.get(`${node.id}:low`)
      const highInput = connectionMap.get(`${node.id}:high`)
      const xInput = connectionMap.get(`${node.id}:x`)
      const lowType = lowInput
        ? inferType(lowInput.from.nodeId, lowInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const highType = highInput
        ? inferType(highInput.from.nodeId, highInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const xType = xInput
        ? inferType(xInput.from.nodeId, xInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      return resolveVectorOutputKind([lowType, highType, xType])
    }
    if (node.type === 'stepElement') {
      const edgeInput = connectionMap.get(`${node.id}:edge`)
      const xInput = connectionMap.get(`${node.id}:x`)
      const edgeType = edgeInput
        ? inferType(edgeInput.from.nodeId, edgeInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const xType = xInput
        ? inferType(xInput.from.nodeId, xInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      return resolveVectorOutputKind([edgeType, xType])
    }
    if (node.type === 'transpose' || node.type === 'inverse') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'unknown'
      if (isMatrixKind(inputType)) return inputType
      return 'unknown'
    }
    if (
      node.type === 'lessThan' ||
      node.type === 'lessThanEqual' ||
      node.type === 'greaterThan' ||
      node.type === 'greaterThanEqual' ||
      node.type === 'equal' ||
      node.type === 'notEqual' ||
      node.type === 'and' ||
      node.type === 'or'
    ) {
      const inputA = connectionMap.get(`${node.id}:a`)
      const inputB = connectionMap.get(`${node.id}:b`)
      const typeA = inputA
        ? inferType(inputA.from.nodeId, inputA.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const typeB = inputB
        ? inferType(inputB.from.nodeId, inputB.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      return resolveVectorOutputKind([typeA, typeB])
    }
    if (node.type === 'not') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (inputType === 'number' || isVectorKind(inputType)) return inputType
      return 'unknown'
    }
    if (node.type === 'atan2') {
      const yInput = connectionMap.get(`${node.id}:y`)
      const xInput = connectionMap.get(`${node.id}:x`)
      const yType = yInput
        ? inferType(yInput.from.nodeId, yInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const xType = xInput
        ? inferType(xInput.from.nodeId, xInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      return resolveVectorOutputKind([yType, xType])
    }
    if (node.type === 'radians' || node.type === 'degrees') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (inputType === 'number' || isVectorKind(inputType)) return inputType
      return 'unknown'
    }
    if (node.type === 'abs') return 'number'
    if (node.type === 'clamp') return 'number'
    if (node.type === 'min' || node.type === 'max' || node.type === 'mod') {
      const inputA = connectionMap.get(`${node.id}:a`)
      const inputB = connectionMap.get(`${node.id}:b`)
      const typeA = inputA
        ? inferType(inputA.from.nodeId, inputA.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const typeB = inputB
        ? inferType(inputB.from.nodeId, inputB.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (typeA === 'number') return typeB
      if (typeB === 'number') return typeA
      if (typeA === typeB) return typeA
      return 'unknown'
    }
    if (node.type === 'step') {
      const edgeInput = connectionMap.get(`${node.id}:edge`)
      const xInput = connectionMap.get(`${node.id}:x`)
      const edgeType = edgeInput
        ? inferType(edgeInput.from.nodeId, edgeInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const xType = xInput
        ? inferType(xInput.from.nodeId, xInput.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      return resolveVectorOutputKind([edgeType, xType])
    }
    if (
      node.type === 'fract' ||
      node.type === 'floor' ||
      node.type === 'ceil' ||
      node.type === 'round' ||
      node.type === 'trunc' ||
      node.type === 'exp' ||
      node.type === 'log' ||
      node.type === 'sign' ||
      node.type === 'oneMinus' ||
      node.type === 'negate'
    ) {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (inputType === 'number' || isVectorKind(inputType)) return inputType
      return 'unknown'
    }
    if (node.type === 'mix') {
      const inputA = connectionMap.get(`${node.id}:a`)
      const inputB = connectionMap.get(`${node.id}:b`)
      const typeA = inputA
        ? inferType(inputA.from.nodeId, inputA.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const typeB = inputB
        ? inferType(inputB.from.nodeId, inputB.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (typeA === 'number') return typeB
      if (typeB === 'number') return typeA
      if (typeA === typeB) return typeA
      return 'unknown'
    }
    if (node.type === 'ifElse') {
      const inputA = connectionMap.get(`${node.id}:a`)
      const inputB = connectionMap.get(`${node.id}:b`)
      const typeA = inputA
        ? inferType(inputA.from.nodeId, inputA.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const typeB = inputB
        ? inferType(inputB.from.nodeId, inputB.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (typeA === 'number') return typeB
      if (typeB === 'number') return typeA
      if (typeA === typeB) return typeA
      return 'unknown'
    }
    if (node.type === 'luminance') {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'color'
      if (inputType === 'color' || inputType === 'vec3') return 'number'
      return 'unknown'
    }
    if (
      node.type === 'grayscale' ||
      node.type === 'saturation' ||
      node.type === 'posterize' ||
      node.type === 'sRGBTransferEOTF' ||
      node.type === 'sRGBTransferOETF' ||
      node.type === 'linearToneMapping' ||
      node.type === 'reinhardToneMapping' ||
      node.type === 'cineonToneMapping' ||
      node.type === 'acesFilmicToneMapping' ||
      node.type === 'agxToneMapping' ||
      node.type === 'neutralToneMapping'
    ) {
      const input = connectionMap.get(`${node.id}:value`)
      const inputType = input
        ? inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
        : 'color'
      if (inputType === 'color') return 'color'
      if (inputType === 'vec3') return 'vec3'
      return 'unknown'
    }
    if (node.type === 'geometryPrimitive') return 'geometry'
    if (node.type === 'gltf') return 'geometry'
    if (node.type === 'add' || node.type === 'multiply') {
      const inputA = connectionMap.get(`${node.id}:a`)
      const inputB = connectionMap.get(`${node.id}:b`)
      const typeA = inputA
        ? inferType(inputA.from.nodeId, inputA.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      const typeB = inputB
        ? inferType(inputB.from.nodeId, inputB.from.pin, nodeMap, connectionMap, stack)
        : 'number'
      if (typeA === 'number') return typeB
      if (typeB === 'number') return typeA
      if (typeA === typeB) return typeA
      return 'unknown'
    }
    if (node.type === 'material' || node.type === 'physicalMaterial') {
      if (outputPin === 'roughness' || outputPin === 'metalness') {
        return 'number'
      }
      return 'color'
    }
    if (node.type === 'gltfMaterial') {
      if (outputPin === 'normalScale') return 'vec2'
      if (
        outputPin === 'roughness' ||
        outputPin === 'metalness' ||
        outputPin === 'emissiveIntensity' ||
        outputPin === 'aoMapIntensity' ||
        outputPin === 'envMapIntensity' ||
        outputPin === 'opacity' ||
        outputPin === 'alphaTest' ||
        outputPin === 'alphaHash'
      ) {
        return 'number'
      }
      return 'color'
    }
    if (node.type === 'basicMaterial') {
      return 'color'
    }
    if (node.type === 'output') return 'color'
    if (node.type === 'vertexOutput') return 'vec3'
    if (node.type === 'functionInput' || node.type === 'functionOutput') {
      const input = connectionMap.get(`${node.id}:value`)
      if (!input) return 'unknown'
      return inferType(input.from.nodeId, input.from.pin, nodeMap, connectionMap, stack)
    }
    if (node.type === 'geometryOutput') return 'geometry'
    return 'unknown'
  }

  const addNode = (type: string, label: string) => {
    if (type.startsWith('function:')) {
      const functionId = type.slice('function:'.length)
      const def = functions[functionId]
      if (!def) {
        setToast('Function not found')
        return
      }
      setEditorNodes((prev) => [
        ...prev,
        {
          id: `function-${Date.now()}-${prev.length}`,
          type: 'function',
          functionId,
          label: def.name,
          x: 40 + prev.length * 18,
          y: 80 + prev.length * 18,
          inputs: def.inputs.map((pin) => pin.name),
          outputs: def.outputs.map((pin) => pin.name),
        },
      ])
      return
    }
    const template = palette.find((item) => item.type === type)
    if (type === 'output' && editorNodes.some((node) => node.type === 'output')) {
      setToast('Only one Output node is allowed')
      return
    }
    if (
      type === 'geometryOutput' &&
      editorNodes.some((node) => node.type === 'geometryOutput')
    ) {
      setToast('Only one Geometry Output node is allowed')
      return
    }
    setEditorNodes((prev) => [
      ...prev,
      {
        id: `${type}-${Date.now()}-${prev.length}`,
        type,
        label: template?.label ?? label,
        x: 40 + prev.length * 18,
        y: 80 + prev.length * 18,
        inputs: template?.inputs ?? [],
        outputs: template?.outputs ?? [],
        value: template?.defaultValue,
        slider: type === 'number' ? false : undefined,
        updateMode: type === 'number' ? 'manual' : undefined,
        updateSource: type === 'number' ? 'value' : undefined,
      },
    ])
  }

  const openDB = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('graphs')) {
          db.createObjectStore('graphs', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('textures')) {
          db.createObjectStore('textures', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

  const normalizeSlot = (value: string) => value.trim() || 'default'

  const buildSlotKey = (slot: string, id: string) => `${slot}:${id}`

  const clearSlotEntries = (store: IDBObjectStore, slot: string) =>
    new Promise<void>((resolve, reject) => {
      const prefix = `${slot}:`
      const cursorReq = store.openCursor()
      cursorReq.onerror = () => reject(cursorReq.error)
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor) {
          resolve()
          return
        }
        if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
          cursor.delete()
        }
        cursor.continue()
      }
    })

  const getSlotRecord = <T,>(
    store: IDBObjectStore,
    slot: string,
    id: string,
  ): Promise<T | null> =>
    new Promise((resolve, reject) => {
      const slotKey = buildSlotKey(slot, id)
      const getReq = store.get(slotKey)
      getReq.onsuccess = () => {
        if (getReq.result) {
          resolve(getReq.result as T)
          return
        }
        const fallbackReq = store.get(id)
        fallbackReq.onsuccess = () => resolve((fallbackReq.result as T) ?? null)
        fallbackReq.onerror = () => reject(fallbackReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })

  const refreshStorageSlots = useCallback(async () => {
    try {
      const db = await openDB()
      const tx = db.transaction(['graphs'], 'readonly')
      const graphs = tx.objectStore('graphs')
      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const req = graphs.getAllKeys()
        req.onsuccess = () => resolve(req.result ?? [])
        req.onerror = () => reject(req.error)
      })
      const slots = Array.from(
        new Set(
          keys
            .map((key) => (typeof key === 'string' ? key : ''))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b))
      if (!slots.includes('default')) slots.unshift('default')
      if (storageSlot && !slots.includes(storageSlot)) slots.unshift(storageSlot)
      setStorageSlots(slots)
    } catch {
      setStorageSlots((prev) =>
        prev.includes('default') ? prev : ['default', ...prev],
      )
    }
  }, [storageSlot])

  useEffect(() => {
    void refreshStorageSlots()
  }, [refreshStorageSlots])

  const writeGraphRecord = async (
    slotKey: string,
    record: {
      nodes: typeof nodes
      connections: typeof connections
      groups: GraphGroup[]
      functions: Record<string, FunctionDefinition>
      ui?: { paletteOpen?: Record<string, boolean> }
    },
    options?: { silent?: boolean },
  ) => {
    try {
      const db = await openDB()
      const tx = db.transaction(['graphs'], 'readwrite')
      const graphs = tx.objectStore('graphs')
      await new Promise((resolve, reject) => {
        const putReq = graphs.put({ id: slotKey, ...record, version: graphSchemaVersion })
        putReq.onsuccess = () => resolve(null)
        putReq.onerror = () => reject(putReq.error)
      })
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(null)
        tx.onerror = () => reject(tx.error)
      })
      if (!options?.silent) {
        setToast(`Saved slot "${slotKey}"`)
      }
      void refreshStorageSlots()
    } catch {
      if (!options?.silent) {
        setToast('Save failed')
      }
    }
  }

  const saveGraphWithSlot = async (
    slotKey: string,
    options?: { silent?: boolean },
  ) => {
    try {
      const texturePayloads: Array<{ id: string; blob: Blob; name: string }> = []
      const assetPayloads: Array<{ id: string; blob: Blob; name: string }> = []
      for (const node of nodes) {
        if (node.type !== 'texture') continue
        const src = typeof node.value === 'string' ? node.value : ''
        if (!src) continue
        const blob = await fetch(src).then((res) => res.blob())
        texturePayloads.push({ id: node.id, blob, name: node.textureName ?? '' })
      }
      for (const node of nodes) {
        if (node.type !== 'gltf' && node.type !== 'gltfMaterial' && node.type !== 'gltfTexture') {
          continue
        }
        const src = typeof node.value === 'string' ? node.value : ''
        if (!src) continue
        const blob = await fetch(src).then((res) => res.blob())
        assetPayloads.push({ id: node.id, blob, name: node.assetName ?? '' })
      }

      const payload = {
        id: slotKey,
        version: graphSchemaVersion,
        nodes: nodes.map((node) => {
          if (node.type === 'texture') {
            return {
              ...node,
              value: '',
              textureKey: node.id,
            }
          }
          if (node.type === 'gltf' || node.type === 'gltfMaterial' || node.type === 'gltfTexture') {
            return {
              ...node,
              value: '',
              assetKey: node.id,
            }
          }
          return node
        }),
        connections,
        groups,
        functions,
        ui: {
          paletteOpen,
        },
      }

      const db = await openDB()
      const tx = db.transaction(['graphs', 'textures', 'assets'], 'readwrite')
      const graphs = tx.objectStore('graphs')
      const textures = tx.objectStore('textures')
      const assets = tx.objectStore('assets')

      await clearSlotEntries(textures, slotKey)
      await clearSlotEntries(assets, slotKey)

      for (const entry of texturePayloads) {
        await new Promise((resolve, reject) => {
          const putReq = textures.put({
            ...entry,
            id: buildSlotKey(slotKey, entry.id),
          })
          putReq.onsuccess = () => resolve(null)
          putReq.onerror = () => reject(putReq.error)
        })
      }
      for (const entry of assetPayloads) {
        await new Promise((resolve, reject) => {
          const putReq = assets.put({
            ...entry,
            id: buildSlotKey(slotKey, entry.id),
          })
          putReq.onsuccess = () => resolve(null)
          putReq.onerror = () => reject(putReq.error)
        })
      }

      await new Promise((resolve, reject) => {
        const putReq = graphs.put(payload)
        putReq.onsuccess = () => resolve(null)
        putReq.onerror = () => reject(putReq.error)
      })

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(null)
        tx.onerror = () => reject(tx.error)
      })

      if (!options?.silent) {
        setToast(`Saved slot "${slotKey}"`)
      }
      void refreshStorageSlots()
    } catch {
      if (!options?.silent) {
        setToast('Save failed')
      }
    }
  }

  const deleteSlot = async (slotKey: string) => {
    try {
      const db = await openDB()
      const tx = db.transaction(['graphs', 'textures', 'assets'], 'readwrite')
      tx.objectStore('graphs').delete(slotKey)
      await clearSlotEntries(tx.objectStore('textures'), slotKey)
      await clearSlotEntries(tx.objectStore('assets'), slotKey)
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(null)
        tx.onerror = () => reject(tx.error)
      })
      setToast(`Deleted slot "${slotKey}"`)
      void refreshStorageSlots()
    } catch {
      setToast('Delete failed')
    }
  }

  const clearSlot = async (slotKey: string) => {
    try {
      const db = await openDB()
      const tx = db.transaction(['graphs', 'textures', 'assets'], 'readwrite')
      tx.objectStore('graphs').delete(slotKey)
      await clearSlotEntries(tx.objectStore('textures'), slotKey)
      await clearSlotEntries(tx.objectStore('assets'), slotKey)
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(null)
        tx.onerror = () => reject(tx.error)
      })
      void refreshStorageSlots()
    } catch {
      setToast('Clear failed')
    }
  }

  const loadGraphWithSlot = async (
    slotKey: string,
    options?: { silent?: boolean },
  ) => {
    try {
      isHydratingRef.current = true
      const db = await openDB()
      const tx = db.transaction(['graphs', 'textures', 'assets'], 'readonly')
      const graphs = tx.objectStore('graphs')
      const textures = tx.objectStore('textures')
      const assets = tx.objectStore('assets')

      const record = await new Promise<
        | {
            nodes?: typeof nodes
            connections?: typeof connections
            groups?: GraphGroup[]
            functions?: Record<string, FunctionDefinition>
            ui?: { paletteOpen?: Record<string, boolean> }
            version?: number
          }
        | null
      >(
        (resolve, reject) => {
          const getReq = graphs.get(slotKey)
          getReq.onsuccess = () => resolve(getReq.result ?? null)
          getReq.onerror = () => reject(getReq.error)
        },
      )

      if (!record?.nodes || !record?.connections) {
        if (!options?.silent) {
          setToast('Loaded example graph')
        }
        Object.values(objectUrlRef.current).forEach((url) => URL.revokeObjectURL(url))
        objectUrlRef.current = {}
        pendingExampleLayoutRef.current = true
        setNodes(exampleGraph.nodes as GraphNode[])
        setConnections(exampleGraph.connections as GraphConnection[])
        setGroups((exampleGraph.groups ?? []) as GraphGroup[])
        setFunctions((exampleGraph.functions ?? {}) as Record<string, FunctionDefinition>)
        setPaletteOpen({
          ...paletteDefaults,
          ...(exampleGraph.ui?.paletteOpen ?? {}),
        })
        setSelectedNodeIds([])
        setTimeout(() => {
          isHydratingRef.current = false
        }, 0)
        void refreshStorageSlots()
        return
      }

      Object.values(objectUrlRef.current).forEach((url) => URL.revokeObjectURL(url))
      objectUrlRef.current = {}

      const hydratedNodes = await Promise.all(
        record.nodes.map(async (node) => {
          if (node.type === 'texture') {
            const key = node.textureKey ?? node.id
            const record = await getSlotRecord<{ blob?: Blob; name?: string }>(
              textures,
              slotKey,
              key,
            )
            const blob = record?.blob ?? null
            if (!blob) return { ...node, value: '' }
            const url = URL.createObjectURL(blob)
            objectUrlRef.current[node.id] = url
            return {
              ...node,
              value: url,
              textureName: record?.name || node.textureName || 'Loaded texture',
            }
          }
          if (node.type === 'gltf' || node.type === 'gltfMaterial' || node.type === 'gltfTexture') {
            const key = node.assetKey ?? node.id
            const record = await getSlotRecord<{ blob?: Blob; name?: string }>(
              assets,
              slotKey,
              key,
            )
            const blob = record?.blob ?? null
            if (!blob) return { ...node, value: '' }
            const url = URL.createObjectURL(blob)
            objectUrlRef.current[node.id] = url
            return {
              ...node,
              value: url,
              assetName: record?.name || node.assetName || 'Loaded model',
            }
          }
          return node
        }),
      )
      const sanitizedConnections = sanitizeConnections(record.connections, hydratedNodes)
      const migrated = migrateGraph(
        hydratedNodes,
        sanitizedConnections,
        record.version ?? 0,
      )
      setNodes(migrated.nodes)
      setConnections(migrated.connections)
      setGroups(record.groups ?? [])
      setFunctions(record.functions ?? {})
      setPaletteOpen({ ...paletteDefaults, ...(record.ui?.paletteOpen ?? {}) })
      setSelectedNodeIds([])
      setTimeout(() => {
        isHydratingRef.current = false
      }, 0)
      if (!options?.silent) {
        setToast(`Loaded slot "${slotKey}"`)
      }
      void refreshStorageSlots()
    } catch {
      if (!options?.silent) {
        setToast('Load failed')
      }
      isHydratingRef.current = false
    }
  }

  useEffect(() => {
    localStorage.setItem(lastSlotStorageKey, storageSlot)
  }, [storageSlot, lastSlotStorageKey])

  useEffect(() => {
    if (!storageSlot) return
    const previous = historySlotRef.current
    if (previous !== storageSlot) {
      historyBySlotRef.current[previous] = cloneHistoryState(historyRef.current)
      const stored = historyBySlotRef.current[storageSlot]
      historyRef.current = stored
        ? cloneHistoryState(stored)
        : { past: [], future: [], last: null, lastSig: null }
      historyPendingRef.current = null
      if (historyTimerRef.current) {
        window.clearTimeout(historyTimerRef.current)
        historyTimerRef.current = null
      }
      historySlotRef.current = storageSlot
      setHistoryTick((prev) => prev + 1)
    }
  }, [storageSlot])

  useEffect(() => {
    if (!storageSlot) return
    void loadGraphWithSlot(normalizeSlot(storageSlot), { silent: true })
  }, [storageSlot])

  useEffect(() => {
    if (isHydratingRef.current || isDraggingNodesRef.current) return
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveGraphWithSlot(normalizeSlot(storageSlot), { silent: true })
    }, 600)
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [nodes, connections, groups, functions, paletteOpen, storageSlot])

  const groupSelectedNodes = () => {
    if (isFunctionEditing) {
      setToast('Grouping is only available in the main graph')
      return
    }
    if (!selectedNodeIds.length) return
    const label = `Group ${groups.length + 1}`
    setGroups((prev) => {
      const selected = new Set(selectedNodeIds)
      const cleaned = prev
        .map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((id) => !selected.has(id)),
        }))
        .filter((group) => group.nodeIds.length > 0)
      return [
        ...cleaned,
        {
          id: `group-${Date.now()}-${cleaned.length}`,
          label,
          nodeIds: [...selectedNodeIds],
          collapsed: false,
        },
      ]
    })
  }

  const buildUniqueName = (base: string, used: Set<string>) => {
    const normalized = base.trim() || 'value'
    let name = normalized
    let index = 1
    while (used.has(name)) {
      name = `${normalized}_${index}`
      index += 1
    }
    used.add(name)
    return name
  }

  const createFunctionFromGroup = (group: GraphGroup) => {
    const inside = new Set(group.nodeIds)
    const internalNodes = nodes.filter((node) => inside.has(node.id))
    if (!internalNodes.length) return
    const internalConnections = connections.filter(
      (connection) =>
        inside.has(connection.from.nodeId) && inside.has(connection.to.nodeId),
    )
    const inbound = connections.filter(
      (connection) =>
        !inside.has(connection.from.nodeId) && inside.has(connection.to.nodeId),
    )
    const outbound = connections.filter(
      (connection) =>
        inside.has(connection.from.nodeId) && !inside.has(connection.to.nodeId),
    )

    const usedInputs = new Set<string>()
    const usedOutputs = new Set<string>()
    const inputMap = new Map<string, string>()
    const outputMap = new Map<string, string>()
    const inputNodes: GraphNode[] = []
    const outputNodes: GraphNode[] = []
    const functionConnections: GraphConnection[] = [...internalConnections]
    const functionInputs: FunctionPin[] = []
    const functionOutputs: FunctionPin[] = []
    const functionId = `function-${Date.now()}-${Object.keys(functions).length}`

    inbound.forEach((connection) => {
      const key = `${connection.to.nodeId}:${connection.to.pin}`
      if (!inputMap.has(key)) {
        const name = buildUniqueName(connection.to.pin, usedInputs)
        const inputNode: GraphNode = {
          id: `${functionId}-input-${inputNodes.length}`,
          type: 'functionInput',
          label: name,
          x: 0,
          y: 0,
          inputs: ['value'],
          outputs: ['value'],
        }
        inputNodes.push(inputNode)
        functionInputs.push({ name, nodeId: inputNode.id })
        inputMap.set(key, name)
        functionConnections.push({
          id: `${functionId}-link-in-${inputNodes.length}`,
          from: { nodeId: inputNode.id, pin: 'value' },
          to: { nodeId: connection.to.nodeId, pin: connection.to.pin },
        })
      }
    })

    outbound.forEach((connection) => {
      const key = `${connection.from.nodeId}:${connection.from.pin}`
      if (!outputMap.has(key)) {
        const name = buildUniqueName(connection.from.pin, usedOutputs)
        const outputNode: GraphNode = {
          id: `${functionId}-output-${outputNodes.length}`,
          type: 'functionOutput',
          label: name,
          x: 0,
          y: 0,
          inputs: ['value'],
          outputs: ['value'],
        }
        outputNodes.push(outputNode)
        functionOutputs.push({ name, nodeId: outputNode.id })
        outputMap.set(key, name)
        functionConnections.push({
          id: `${functionId}-link-out-${outputNodes.length}`,
          from: { nodeId: connection.from.nodeId, pin: connection.from.pin },
          to: { nodeId: outputNode.id, pin: 'value' },
        })
      }
    })

    const minX = Math.min(...internalNodes.map((node) => node.x))
    const minY = Math.min(...internalNodes.map((node) => node.y))
    const maxX = Math.max(...internalNodes.map((node) => node.x))
    const maxY = Math.max(...internalNodes.map((node) => node.y))
    const functionNode: GraphNode = {
      id: `${functionId}-node`,
      type: 'function',
      functionId,
      label: group.label,
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      inputs: functionInputs.map((pin) => pin.name),
      outputs: functionOutputs.map((pin) => pin.name),
    }

    const nextNodes = nodes.filter((node) => !inside.has(node.id))
    nextNodes.push(functionNode)
    const nextConnections = connections.filter(
      (connection) =>
        !inside.has(connection.from.nodeId) && !inside.has(connection.to.nodeId),
    )

    inbound.forEach((connection) => {
      const key = `${connection.to.nodeId}:${connection.to.pin}`
      const pinName = inputMap.get(key)
      if (!pinName) return
      nextConnections.push({
        id: `${functionId}-wire-in-${connection.id}`,
        from: connection.from,
        to: { nodeId: functionNode.id, pin: pinName },
      })
    })

    outbound.forEach((connection) => {
      const key = `${connection.from.nodeId}:${connection.from.pin}`
      const pinName = outputMap.get(key)
      if (!pinName) return
      nextConnections.push({
        id: `${functionId}-wire-out-${connection.id}`,
        from: { nodeId: functionNode.id, pin: pinName },
        to: connection.to,
      })
    })

    setFunctions((prev) => ({
      ...prev,
      [functionId]: {
        id: functionId,
        name: group.label,
        nodes: [...internalNodes, ...inputNodes, ...outputNodes],
        connections: functionConnections,
        inputs: functionInputs,
        outputs: functionOutputs,
      },
    }))
    setNodes(nextNodes)
    setConnections(nextConnections)
    setGroups((prev) => prev.filter((item) => item.id !== group.id))
    setSelectedNodeIds([functionNode.id])
  }

  const expandFunctionNode = (fnNode: GraphNode) => {
    if (fnNode.type !== 'function' || !fnNode.functionId) return
    const functionId = fnNode.functionId
    const def = functions[functionId]
    if (!def) {
      setToast('Function not found')
      return
    }
    const inputNodeIds = new Set(def.inputs.map((pin) => pin.nodeId))
    const outputNodeIds = new Set(def.outputs.map((pin) => pin.nodeId))
    const internalNodes = def.nodes.filter(
      (node) => !inputNodeIds.has(node.id) && !outputNodeIds.has(node.id),
    )
    if (!internalNodes.length) {
      setToast('Function has no internal nodes')
      return
    }
    const prefix = `expand-${fnNode.id}-${Date.now()}-`
    const idMap = new Map(def.nodes.map((node) => [node.id, `${prefix}${node.id}`]))
    const center = def.nodes.reduce(
      (acc, node) => ({
        x: acc.x + node.x,
        y: acc.y + node.y,
      }),
      { x: 0, y: 0 },
    )
    const count = def.nodes.length || 1
    const centerX = center.x / count
    const centerY = center.y / count
    const nextNodes = internalNodes.map((node) => {
      const mappedId = idMap.get(node.id)
      return {
        ...node,
        id: mappedId ?? node.id,
        x: fnNode.x + (node.x - centerX),
        y: fnNode.y + (node.y - centerY),
      }
    })
    const nextConnections: GraphConnection[] = []
    const internalNodeSet = new Set(internalNodes.map((node) => node.id))
    def.connections.forEach((connection) => {
      if (!internalNodeSet.has(connection.from.nodeId)) return
      if (!internalNodeSet.has(connection.to.nodeId)) return
      const fromId = idMap.get(connection.from.nodeId)
      const toId = idMap.get(connection.to.nodeId)
      if (!fromId || !toId) return
      nextConnections.push({
        ...connection,
        id: `${prefix}${connection.id}`,
        from: { ...connection.from, nodeId: fromId },
        to: { ...connection.to, nodeId: toId },
      })
    })

    const inbound = connections.filter((conn) => conn.to.nodeId === fnNode.id)
    def.inputs.forEach((pin) => {
      const external = inbound.find((conn) => conn.to.pin === pin.name)
      if (!external) return
      const internalLinks = def.connections.filter(
        (conn) => conn.from.nodeId === pin.nodeId,
      )
      internalLinks.forEach((internal, index) => {
        const targetId = idMap.get(internal.to.nodeId)
        if (!targetId) return
        nextConnections.push({
          id: `${prefix}in-${external.id}-${index}`,
          from: external.from,
          to: { nodeId: targetId, pin: internal.to.pin },
        })
      })
    })

    const outbound = connections.filter((conn) => conn.from.nodeId === fnNode.id)
    def.outputs.forEach((pin) => {
      const external = outbound.filter((conn) => conn.from.pin === pin.name)
      if (!external.length) return
      const internalLink = def.connections.find(
        (conn) => conn.to.nodeId === pin.nodeId,
      )
      if (!internalLink) return
      const sourceId = idMap.get(internalLink.from.nodeId)
      if (!sourceId) return
      external.forEach((conn, index) => {
        nextConnections.push({
          id: `${prefix}out-${conn.id}-${index}`,
          from: { nodeId: sourceId, pin: internalLink.from.pin },
          to: conn.to,
        })
      })
    })

    setNodes((prev) => {
      const withoutFn = prev.filter((node) => node.id !== fnNode.id)
      return [...withoutFn, ...nextNodes]
    })
    setConnections((prev) => {
      const withoutFn = prev.filter(
        (conn) => conn.from.nodeId !== fnNode.id && conn.to.nodeId !== fnNode.id,
      )
      return [...withoutFn, ...nextConnections]
    })
    setGroups((prev) =>
      prev
        .map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((id) => id !== fnNode.id),
        }))
        .filter((group) => group.nodeIds.length > 0),
    )
    setSelectedNodeIds(nextNodes.map((node) => node.id))
    setFunctions((prev) => {
      const stillUsed = nodesRef.current.some(
        (node) =>
          node.id !== fnNode.id &&
          node.type === 'function' &&
          node.functionId === functionId,
      )
      if (stillUsed) return prev
      const next = { ...prev }
      delete next[functionId]
      return next
    })
  }

  const renameGroup = (groupId: string, nextLabel: string) => {
    const trimmed = nextLabel.trim()
    if (!trimmed) return
    setGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, label: trimmed } : group,
      ),
    )
  }

  const ungroupSelectedNodes = () => {
    if (isFunctionEditing) {
      setToast('Ungroup is only available in the main graph')
      return
    }
    if (!selectedNodeIds.length) return
    setGroups((prev) =>
      prev.filter((group) => !group.nodeIds.some((id) => selectedNodeIds.includes(id))),
    )
  }

  const removeFunctionsForNodeIds = (ids: string[]) => {
    if (!ids.length) return
    setFunctions((prev) => {
      const next = { ...prev }
      ids.forEach((id) => {
        const node = nodes.find((item) => item.id === id)
        if (node?.type === 'function' && node.functionId) {
          delete next[node.functionId]
        }
      })
      return next
    })
  }

  const applyFunctionDefinitionChange = useCallback(
    (
      functionId: string,
      nextDef: FunctionDefinition,
      change?: { kind: 'input' | 'output'; renameMap?: Record<string, string>; removed?: Set<string> },
    ) => {
      setFunctions((prev) => {
        if (!prev[functionId]) return prev
        return { ...prev, [functionId]: nextDef }
      })
      const functionNodeIds = new Set(
        nodes.filter(
          (node) => node.type === 'function' && node.functionId === functionId,
        ).map((node) => node.id),
      )
      setNodes((prev) =>
        prev.map((node) =>
          node.type === 'function' && node.functionId === functionId
            ? {
                ...node,
                inputs: nextDef.inputs.map((pin) => pin.name),
                outputs: nextDef.outputs.map((pin) => pin.name),
              }
            : node,
        ),
      )
      if (!change || (!change.renameMap && !change.removed)) return
      setConnections((prev) =>
        prev.flatMap((connection) => {
          if (change.kind === 'input' && functionNodeIds.has(connection.to.nodeId)) {
            if (change.removed?.has(connection.to.pin)) return []
            const renamed = change.renameMap?.[connection.to.pin]
            if (renamed) {
              return [
                {
                  ...connection,
                  to: { ...connection.to, pin: renamed },
                },
              ]
            }
          }
          if (change.kind === 'output' && functionNodeIds.has(connection.from.nodeId)) {
            if (change.removed?.has(connection.from.pin)) return []
            const renamed = change.renameMap?.[connection.from.pin]
            if (renamed) {
              return [
                {
                  ...connection,
                  from: { ...connection.from, pin: renamed },
                },
              ]
            }
          }
          return [connection]
        }),
      )
    },
    [nodes, setConnections, setFunctions, setNodes],
  )

  const renameFunctionPin = useCallback(
    (kind: 'input' | 'output', index: number, nextName: string) => {
      if (!activeFunctionId || !activeFunction) return false
      const trimmed = nextName.trim()
      if (!trimmed) {
        setToast('Pin name cannot be empty')
        return false
      }
      const pins = kind === 'input' ? activeFunction.inputs : activeFunction.outputs
      const current = pins[index]
      if (!current) return false
      if (current.name === trimmed) return true
      if (pins.some((pin, idx) => pin.name === trimmed && idx !== index)) {
        setToast('Pin name already exists')
        return false
      }
      const renameMap = { [current.name]: trimmed }
      const nextPins = pins.map((pin, idx) =>
        idx === index ? { ...pin, name: trimmed } : pin,
      )
      const nextNodes = activeFunction.nodes.map((node) =>
        node.id === current.nodeId ? { ...node, label: trimmed } : node,
      )
      const nextDef: FunctionDefinition = {
        ...activeFunction,
        nodes: nextNodes,
        inputs: kind === 'input' ? nextPins : activeFunction.inputs,
        outputs: kind === 'output' ? nextPins : activeFunction.outputs,
      }
      applyFunctionDefinitionChange(activeFunctionId, nextDef, {
        kind,
        renameMap,
      })
      return true
    },
    [activeFunction, activeFunctionId, applyFunctionDefinitionChange],
  )

  const moveFunctionPin = useCallback(
    (kind: 'input' | 'output', index: number, direction: -1 | 1) => {
      if (!activeFunctionId || !activeFunction) return
      const pins = kind === 'input' ? activeFunction.inputs : activeFunction.outputs
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= pins.length) return
      const nextPins = [...pins]
      const [moved] = nextPins.splice(index, 1)
      nextPins.splice(nextIndex, 0, moved)
      const nextDef: FunctionDefinition = {
        ...activeFunction,
        inputs: kind === 'input' ? nextPins : activeFunction.inputs,
        outputs: kind === 'output' ? nextPins : activeFunction.outputs,
      }
      applyFunctionDefinitionChange(activeFunctionId, nextDef)
    },
    [activeFunction, activeFunctionId, applyFunctionDefinitionChange],
  )

  const removeFunctionPin = useCallback(
    (kind: 'input' | 'output', index: number) => {
      if (!activeFunctionId || !activeFunction) return
      const pins = kind === 'input' ? activeFunction.inputs : activeFunction.outputs
      const target = pins[index]
      if (!target) return
      const removed = new Set([target.name])
      const nextPins = pins.filter((_, idx) => idx !== index)
      const nextNodes = activeFunction.nodes.filter((node) => node.id !== target.nodeId)
      const nextConnections = activeFunction.connections.filter(
        (connection) =>
          connection.from.nodeId !== target.nodeId &&
          connection.to.nodeId !== target.nodeId,
      )
      const nextDef: FunctionDefinition = {
        ...activeFunction,
        nodes: nextNodes,
        connections: nextConnections,
        inputs: kind === 'input' ? nextPins : activeFunction.inputs,
        outputs: kind === 'output' ? nextPins : activeFunction.outputs,
      }
      applyFunctionDefinitionChange(activeFunctionId, nextDef, { kind, removed })
    },
    [activeFunction, activeFunctionId, applyFunctionDefinitionChange],
  )

  const isNodeInCollapsedGroup = (nodeId: string) =>
    editorGroups.some((group) => group.collapsed && group.nodeIds.includes(nodeId))

  useEffect(() => {
    const container = viewportRef.current
    if (!container) return
    const rafId = window.requestAnimationFrame(() => {
      if (!container.clientWidth || !container.clientHeight) return
      const rect = container.getBoundingClientRect()
      const viewState = viewRef.current
      const next: Record<string, { x: number; y: number }> = {}
      let sizeMap = nodeSizeRef.current
      const pins = container.querySelectorAll<HTMLElement>('[data-pin-key]')
      pins.forEach((pin) => {
        const pinRect = pin.getBoundingClientRect()
        const key = pin.dataset.pinKey
        if (!key) return
        const screenX = pinRect.left - rect.left + pinRect.width / 2
        const screenY = pinRect.top - rect.top + pinRect.height / 2
        next[key] = {
          x: (screenX - viewState.x) / viewState.zoom,
          y: (screenY - viewState.y) / viewState.zoom,
        }
      })
      const needsNodeSizeMeasure =
        Object.keys(sizeMap).length !== editorNodes.length ||
        editorNodes.some((node) => !sizeMap[node.id])
      if (needsNodeSizeMeasure) {
        const nextSizeMap: Record<string, { width: number; height: number }> = {}
        const cards = container.querySelectorAll<HTMLElement>('.node-card[data-node-id]')
        cards.forEach((card) => {
          const id = card.dataset.nodeId
          if (!id) return
          const rect = card.getBoundingClientRect()
          const width = card.offsetWidth || rect.width
          const height = card.offsetHeight || rect.height
          nextSizeMap[id] = {
            width,
            height,
          }
        })
        sizeMap = nextSizeMap
        nodeSizeRef.current = nextSizeMap
      }
      setPinPositions(next)
      if (!isFunctionEditing && pendingExampleLayoutRef.current) {
        pendingExampleLayoutRef.current = false
        setEditorNodes((prev) => spreadNodesByColumn(prev))
      }
      if (isFunctionEditing || !groups.length) {
        setGroupBounds((prev) => (Object.keys(prev).length ? {} : prev))
        return
      }
      const nodeMap = new Map(nodes.map((node) => [node.id, node]))
      const fallbackSize = { width: 260, height: 180 }
      const padding = 16
      const nextBounds: Record<
        string,
        { x: number; y: number; width: number; height: number }
      > = {}
      groups.forEach((group) => {
        const members = group.nodeIds
          .map((id) => {
            const node = nodeMap.get(id)
            if (!node) return null
            const size = sizeMap[id] ?? fallbackSize
            return { x: node.x, y: node.y, width: size.width, height: size.height }
          })
          .filter(
            (member): member is { x: number; y: number; width: number; height: number } =>
              Boolean(member),
          )
        if (!members.length) return
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        members.forEach((member) => {
          minX = Math.min(minX, member.x)
          minY = Math.min(minY, member.y)
          maxX = Math.max(maxX, member.x + member.width)
          maxY = Math.max(maxY, member.y + member.height)
        })
        nextBounds[group.id] = {
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
        }
      })
      setGroupBounds(nextBounds)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [
    nodes,
    connections,
    groups,
    isFunctionEditing,
    spreadNodesByColumn,
    editorNodes,
    editorConnections,
    setEditorNodes,
    compactPanel,
  ])

  const nodeIdSignature = useMemo(
    () => nodes.map((node) => node.id).join('|'),
    [nodes],
  )

  const uniformInputSignature = useMemo(
    () =>
      JSON.stringify(
        nodes
          .filter((node) => node.type === 'number' || node.type === 'color')
          .map((node) => ({
            id: node.id,
            type: node.type,
            value: node.value ?? '',
          })),
      ),
    [nodes],
  )

  const textureSourceSignature = useMemo(
    () =>
      JSON.stringify(
        nodes
          .filter((node) => node.type === 'texture')
          .map((node) => ({
            id: node.id,
            src: typeof node.value === 'string' ? node.value : '',
          })),
      ),
    [nodes],
  )

  const gltfSourceSignature = useMemo(
    () =>
      JSON.stringify(
        nodes
          .filter(
            (node) =>
              node.type === 'gltf' ||
              node.type === 'gltfMaterial' ||
              node.type === 'gltfTexture',
          )
          .map((node) => ({
            id: node.id,
            type: node.type,
            src: typeof node.value === 'string' ? node.value : '',
          })),
      ),
    [nodes],
  )

  useEffect(() => {
    nodesRef.current = editorNodes
    connectionsRef.current = editorConnections
  }, [editorNodes, editorConnections])

  useEffect(() => {
    const nodeIds = new Set(nodes.map((node) => node.id))
    setGroups((prev) => {
      const next = prev
        .map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((id) => nodeIds.has(id)),
        }))
        .filter((group) => group.nodeIds.length > 0)
      const same =
        next.length === prev.length &&
        next.every((group, index) => {
          const current = prev[index]
          if (!current) return false
          if (
            group.id !== current.id ||
            group.label !== current.label ||
            Boolean(group.collapsed) !== Boolean(current.collapsed)
          ) {
            return false
          }
          if (group.nodeIds.length !== current.nodeIds.length) return false
          return group.nodeIds.every((id, idx) => id === current.nodeIds[idx])
        })
      return same ? prev : next
    })
  }, [nodeIdSignature])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    const needsMigration = nodes.some(
      (node) =>
      (node.type === 'material' && node.inputs.length < 18) ||
      (node.type === 'material' && node.inputs.includes('color')) ||
      (node.type === 'material' && node.label !== 'StandardMaterial') ||
      (node.type === 'output' && node.inputs.includes('color')) ||
      (node.type === 'physicalMaterial' && node.inputs.length < 21) ||
      (node.type === 'basicMaterial' && node.inputs.length < 11),
    )
    if (!needsMigration) return
    setNodes((prev) =>
      prev.map((node) => {
        if (node.type === 'material') {
          return {
            ...node,
            label: 'StandardMaterial',
            inputs: [
              'baseColor',
              'baseColorTexture',
              'roughness',
              'roughnessMap',
              'metalness',
              'metalnessMap',
              'emissive',
              'emissiveMap',
              'emissiveIntensity',
              'normalMap',
              'normalScale',
              'aoMap',
              'aoMapIntensity',
              'envMap',
              'envMapIntensity',
              'opacity',
              'alphaTest',
              'alphaHash',
            ],
          }
        }
        if (node.type === 'physicalMaterial') {
          return {
            ...node,
            inputs: [
              'baseColor',
              'baseColorTexture',
              'roughness',
              'roughnessMap',
              'metalness',
              'metalnessMap',
              'emissive',
              'emissiveMap',
              'emissiveIntensity',
              'normalMap',
              'normalScale',
              'clearcoat',
              'clearcoatRoughness',
              'clearcoatNormal',
              'aoMap',
              'aoMapIntensity',
              'envMap',
              'envMapIntensity',
              'opacity',
              'alphaTest',
              'alphaHash',
            ],
          }
        }
        if (node.type === 'output' && node.inputs.includes('color')) {
          return { ...node, inputs: ['baseColor', 'roughness', 'metalness'] }
        }
        if (node.type === 'output' && node.label === 'Output') {
          return { ...node, label: 'Fragment Output' }
        }
        if (node.type === 'vertexOutput' && node.inputs.includes('offset')) {
          return { ...node, inputs: ['position'] }
        }
        if (node.type === 'basicMaterial') {
          return {
            ...node,
            inputs: [
              'baseColor',
              'baseColorTexture',
              'opacity',
              'alphaTest',
              'alphaHash',
              'map',
              'alphaMap',
              'aoMap',
              'envMap',
              'envMapIntensity',
              'reflectivity',
            ],
          }
        }
        return node
      }),
    )
    setConnections((prev) =>
      prev.map((connection) =>
        connection.to.pin === 'color'
          ? { ...connection, to: { ...connection.to, pin: 'baseColor' } }
          : connection.to.pin === 'offset'
            ? { ...connection, to: { ...connection.to, pin: 'position' } }
            : connection,
      ),
    )
  }, [nodes])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => {
      setToast(null)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const undo = useCallback(() => {
    const history = historyRef.current
    if (!history.last || history.past.length === 0) return
    if (historyTimerRef.current) {
      window.clearTimeout(historyTimerRef.current)
      historyTimerRef.current = null
    }
    historyPendingRef.current = null
    const previous = history.past.pop()
    if (!previous) return
    history.future.push(history.last)
    history.last = previous
    history.lastSig = JSON.stringify(previous)
    historySkipRef.current = true
    setNodes(previous.nodes)
    setConnections(previous.connections)
    setGroups(previous.groups)
    setFunctions(previous.functions)
    setHistoryTick((prev) => prev + 1)
  }, [])

  const redo = useCallback(() => {
    const history = historyRef.current
    if (!history.last || history.future.length === 0) return
    if (historyTimerRef.current) {
      window.clearTimeout(historyTimerRef.current)
      historyTimerRef.current = null
    }
    historyPendingRef.current = null
    const next = history.future.pop()
    if (!next) return
    history.past.push(history.last)
    history.last = next
    history.lastSig = JSON.stringify(next)
    historySkipRef.current = true
    setNodes(next.nodes)
    setConnections(next.connections)
    setGroups(next.groups)
    setFunctions(next.functions)
    setHistoryTick((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!historyRecordingEnabled) return
    if (isDraggingNodesRef.current) return
    const snapshot = { nodes, connections, groups, functions }
    const signature = JSON.stringify(snapshot)
    const history = historyRef.current
    if (historySkipRef.current) {
      historySkipRef.current = false
      history.last = snapshot
      history.lastSig = signature
      historyPendingRef.current = null
      return
    }
    if (!history.lastSig) {
      history.last = snapshot
      history.lastSig = signature
      return
    }
    if (history.lastSig === signature) return
    historyPendingRef.current = snapshot
    if (historyTimerRef.current) {
      window.clearTimeout(historyTimerRef.current)
    }
    historyTimerRef.current = window.setTimeout(() => {
      const pending = historyPendingRef.current
      if (!pending) return
      const pendingSig = JSON.stringify(pending)
      const history = historyRef.current
      if (history.lastSig === pendingSig) return
      if (history.last) {
        history.past.push(history.last)
      }
      if (history.past.length > 100) {
        history.past.shift()
      }
      history.future = []
      history.last = pending
      history.lastSig = pendingSig
      historyPendingRef.current = null
      setHistoryTick((prev) => prev + 1)
    }, 200)
    return () => {
      if (historyTimerRef.current) {
        window.clearTimeout(historyTimerRef.current)
        historyTimerRef.current = null
      }
    }
  }, [nodes, connections, groups, functions, historyRecordingEnabled])

  useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }
      const key = event.key.toLowerCase()
      const isMod = event.metaKey || event.ctrlKey
      if (isMod && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }
      if ((isMod && key === 'y') || (isMod && event.shiftKey && key === 'z')) {
        event.preventDefault()
        redo()
        return
      }
      if (!selectedNodeIds.length) return
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        if (!isFunctionEditing) {
          removeFunctionsForNodeIds(selectedNodeIds)
        }
        setEditorNodes((prev) => prev.filter((node) => !selectedNodeIds.includes(node.id)))
        setEditorConnections((prev) =>
          prev.filter(
            (connection) =>
              !selectedNodeIds.includes(connection.from.nodeId) &&
              !selectedNodeIds.includes(connection.to.nodeId),
          ),
        )
        if (!isFunctionEditing) {
          setGroups((prev) =>
            prev
              .map((group) => ({
                ...group,
                nodeIds: group.nodeIds.filter((id) => !selectedNodeIds.includes(id)),
              }))
              .filter((group) => group.nodeIds.length > 0),
          )
        }
        setSelectedNodeIds([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [redo, selectedNodeIds, undo, isFunctionEditing, setEditorConnections, setEditorNodes])

  const parseNumber = (value: number | string | undefined) => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return 0
      const parsed = Number(trimmed)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
  }

  const numberUpdateModes: { value: UniformUpdateMode; label: string }[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'frame', label: 'Frame' },
    { value: 'object', label: 'Object' },
    { value: 'render', label: 'Render' },
  ]

  const numberUpdateSources: Record<
    UniformUpdateMode,
    { value: UniformUpdateSource; label: string }[]
  > = {
    manual: [{ value: 'value', label: 'Value' }],
    frame: [{ value: 'time', label: 'Time (seconds)' }],
    object: [
      { value: 'objectPositionX', label: 'Object Position X' },
      { value: 'objectPositionY', label: 'Object Position Y' },
      { value: 'objectPositionZ', label: 'Object Position Z' },
      { value: 'objectRotationX', label: 'Object Rotation X' },
      { value: 'objectRotationY', label: 'Object Rotation Y' },
      { value: 'objectRotationZ', label: 'Object Rotation Z' },
      { value: 'objectScaleX', label: 'Object Scale X' },
      { value: 'objectScaleY', label: 'Object Scale Y' },
      { value: 'objectScaleZ', label: 'Object Scale Z' },
    ],
    render: [
      { value: 'cameraPositionX', label: 'Camera Position X' },
      { value: 'cameraPositionY', label: 'Camera Position Y' },
      { value: 'cameraPositionZ', label: 'Camera Position Z' },
    ],
  }

  const getNumberUpdateMode = (node: GraphNode): UniformUpdateMode => {
    const mode = node.updateMode
    return numberUpdateModes.some((entry) => entry.value === mode)
      ? (mode as UniformUpdateMode)
      : 'manual'
  }

  const getDefaultNumberUpdateSource = (mode: UniformUpdateMode): UniformUpdateSource =>
    numberUpdateSources[mode]?.[0]?.value ?? 'value'

  const getNumberUpdateSource = (
    node: GraphNode,
    mode: UniformUpdateMode,
  ): UniformUpdateSource => {
    const source = node.updateSource
    const options = numberUpdateSources[mode] ?? numberUpdateSources.manual
    return options.some((entry) => entry.value === source)
      ? (source as UniformUpdateSource)
      : getDefaultNumberUpdateSource(mode)
  }

  const getObjectUpdateValue = (
    object:
      | {
          position?: { x: number; y: number; z: number }
          rotation?: { x: number; y: number; z: number }
          scale?: { x: number; y: number; z: number }
        }
      | null
      | undefined,
    source: UniformUpdateSource,
  ) => {
    if (!object) return 0
    switch (source) {
      case 'objectPositionX':
        return object.position?.x ?? 0
      case 'objectPositionY':
        return object.position?.y ?? 0
      case 'objectPositionZ':
        return object.position?.z ?? 0
      case 'objectRotationX':
        return object.rotation?.x ?? 0
      case 'objectRotationY':
        return object.rotation?.y ?? 0
      case 'objectRotationZ':
        return object.rotation?.z ?? 0
      case 'objectScaleX':
        return object.scale?.x ?? 0
      case 'objectScaleY':
        return object.scale?.y ?? 0
      case 'objectScaleZ':
        return object.scale?.z ?? 0
      default:
        return 0
    }
  }

  const getCameraUpdateValue = (
    camera:
      | {
          position?: { x: number; y: number; z: number }
        }
      | null
      | undefined,
    source: UniformUpdateSource,
  ) => {
    if (!camera) return 0
    switch (source) {
      case 'cameraPositionX':
        return camera.position?.x ?? 0
      case 'cameraPositionY':
        return camera.position?.y ?? 0
      case 'cameraPositionZ':
        return camera.position?.z ?? 0
      default:
        return 0
    }
  }

  const getObjectUpdateExpr = (source: UniformUpdateSource) => {
    switch (source) {
      case 'objectPositionX':
        return 'object.position.x'
      case 'objectPositionY':
        return 'object.position.y'
      case 'objectPositionZ':
        return 'object.position.z'
      case 'objectRotationX':
        return 'object.rotation.x'
      case 'objectRotationY':
        return 'object.rotation.y'
      case 'objectRotationZ':
        return 'object.rotation.z'
      case 'objectScaleX':
        return 'object.scale.x'
      case 'objectScaleY':
        return 'object.scale.y'
      case 'objectScaleZ':
        return 'object.scale.z'
      default:
        return '0'
    }
  }

  const getCameraUpdateExpr = (source: UniformUpdateSource) => {
    switch (source) {
      case 'cameraPositionX':
        return 'camera.position.x'
      case 'cameraPositionY':
        return 'camera.position.y'
      case 'cameraPositionZ':
        return 'camera.position.z'
      default:
        return '0'
    }
  }

  const appendNumberUniformUpdate = (
    decls: string[],
    uniformName: string,
    node: GraphNode,
  ) => {
    const mode = getNumberUpdateMode(node)
    if (mode === 'manual') return
    const source = getNumberUpdateSource(node, mode)
    if (mode === 'frame') {
      decls.push(`${uniformName}.onFrameUpdate(() => performance.now() / 1000);`)
      return
    }
    if (mode === 'object') {
      const expr = getObjectUpdateExpr(source)
      decls.push(
        `${uniformName}.onObjectUpdate(({ object }) => (object ? ${expr} : 0));`,
      )
      return
    }
    if (mode === 'render') {
      const expr = getCameraUpdateExpr(source)
      decls.push(
        `${uniformName}.onRenderUpdate(({ camera }) => (camera ? ${expr} : 0));`,
      )
    }
  }

  type ValueKind =
    | 'number'
    | 'color'
    | 'vec2'
    | 'vec3'
    | 'vec4'
    | 'mat2'
    | 'mat3'
    | 'mat4'
    | 'unknown'

  const isVectorKind = (kind: string) =>
    kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4'

  const isMatrixKind = (kind: string) =>
    kind === 'mat2' || kind === 'mat3' || kind === 'mat4'

  const getVectorKind = (kind: string): 'vec2' | 'vec3' | 'vec4' | null => {
    if (kind === 'vec2') return 'vec2'
    if (kind === 'vec3' || kind === 'color') return 'vec3'
    if (kind === 'vec4') return 'vec4'
    return null
  }

  const resolveVectorOutputKind = (kinds: string[]): ValueKind => {
    if (kinds.some((kind) => isMatrixKind(kind))) return 'unknown'
    let vectorKind: 'vec2' | 'vec3' | 'vec4' | null = null
    let hasColor = false
    let hasNonColorVec3 = false
    for (const rawKind of kinds) {
      const kind = normalizeKind(rawKind)
      if (kind === 'color') {
        hasColor = true
      } else if (kind === 'vec3') {
        hasNonColorVec3 = true
      }
      const mapped = getVectorKind(kind)
      if (!mapped) continue
      if (!vectorKind) {
        vectorKind = mapped
      } else if (vectorKind !== mapped) {
        return 'unknown'
      }
    }
    if (hasColor && hasNonColorVec3) return 'unknown'
    if (!vectorKind) return 'number'
    if (hasColor && vectorKind === 'vec3') return 'color'
    return vectorKind
  }

  const isAssignableType = (actual: string, expected: string) => {
    if (expected === 'any') return true
    if (expected === 'vector') return isVectorKind(actual)
    if (expected === 'vector3') return actual === 'vec3' || actual === 'color'
    if (expected === 'matrix') return isMatrixKind(actual)
    if (expected === 'mat2' && actual === 'mat2') return true
    if (expected === 'mat3' && actual === 'mat3') return true
    if (expected === 'mat4' && actual === 'mat4') return true
    if (actual === 'unknown') return true
    if (actual === expected) return true
    if (
      actual === 'number' &&
      (expected === 'color' ||
        expected === 'vec2' ||
        expected === 'vec3' ||
        expected === 'vec4')
    ) {
      return true
    }
    return false
  }

  const normalizeKind = (value: string): ValueKind => {
    if (
      value === 'number' ||
      value === 'color' ||
      value === 'vec2' ||
      value === 'vec3' ||
      value === 'vec4' ||
      value === 'mat2' ||
      value === 'mat3' ||
      value === 'mat4' ||
      value === 'unknown'
    ) {
      return value
    }
    return 'unknown'
  }

  const combineTypes = (left: string, right: string): ValueKind => {
    const leftKind = normalizeKind(left)
    const rightKind = normalizeKind(right)
    if (isMatrixKind(leftKind) || isMatrixKind(rightKind)) return 'unknown'
    if (leftKind === 'unknown' || rightKind === 'unknown') return 'unknown'
    if (leftKind === 'number') return rightKind
    if (rightKind === 'number') return leftKind
    if (leftKind === rightKind) return leftKind
    return 'unknown'
  }

  const graphSignature = useMemo(() => {
    const nodeShape = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      inputs: node.inputs,
      outputs: node.outputs,
      meshIndex: node.type === 'gltf' ? node.meshIndex ?? '' : undefined,
      materialIndex: node.type === 'gltfMaterial' ? node.materialIndex ?? '' : undefined,
      textureIndex: node.type === 'gltfTexture' ? node.textureIndex ?? '' : undefined,
      functionId: node.type === 'function' ? node.functionId ?? '' : undefined,
    }))
    const linkShape = connections.map((connection) => ({
      from: connection.from,
      to: connection.to,
    }))
    const functionShape = Object.values(functions).map((fn) => ({
      id: fn.id,
      name: fn.name,
      nodes: fn.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        inputs: node.inputs,
        outputs: node.outputs,
      })),
      connections: fn.connections.map((connection) => ({
        from: connection.from,
        to: connection.to,
      })),
      inputs: fn.inputs,
      outputs: fn.outputs,
    }))
    return JSON.stringify({ nodeShape, linkShape, gltfVersion, functionShape })
  }, [nodes, connections, gltfVersion, functions])

  const graphComputeSignature = useMemo(() => {
    const normalizedNodes = nodes.map((node) => {
      const rest: Partial<GraphNode> = { ...node }
      delete rest.x
      delete rest.y
      return rest
    })
    const normalizedFunctions = Object.values(functions).map((fn) => ({
      ...fn,
      nodes: fn.nodes.map((node) => {
        const rest: Partial<GraphNode> = { ...node }
        delete rest.x
        delete rest.y
        return rest
      }),
    }))
    return JSON.stringify({
      nodes: normalizedNodes,
      connections,
      functions: normalizedFunctions,
      gltfVersion,
      textureVersion,
    })
  }, [nodes, connections, functions, gltfVersion, textureVersion])

  const geometrySignature = useMemo(() => {
    const expanded = expandFunctions(nodes, connections, functions)
    const geometryNodes = expanded.nodes
      .filter(
        (node) =>
          node.type === 'geometryPrimitive' ||
          node.type === 'geometryOutput' ||
          node.type === 'gltf' ||
          node.type === 'gltfMaterial' ||
          node.type === 'gltfTexture',
      )
      .map((node) => ({
        id: node.id,
        type: node.type,
        value: node.value ?? '',
        meshIndex: node.meshIndex ?? '',
        materialIndex: node.materialIndex ?? '',
        textureIndex: node.textureIndex ?? '',
      }))
    const geometryLinks = expanded.connections.filter(
      (connection) => connection.to.pin === 'geometry',
    )
    return JSON.stringify({ geometryNodes, geometryLinks, version: gltfVersion })
  }, [nodes, connections, functions, gltfVersion])

  const textureSignature = useMemo(() => {
    const expanded = expandFunctions(nodes, connections, functions)
    const textures = expanded.nodes
      .filter((node) => node.type === 'texture')
      .map((node) => ({ id: node.id, value: node.value ?? '' }))
    return JSON.stringify({ textures, version: textureVersion })
  }, [nodes, connections, functions, textureVersion])

  const editorGraphSignature = useMemo(() => {
    const normalizedNodes = editorNodes.map((node) => {
      const rest: Partial<GraphNode> = { ...node }
      delete rest.x
      delete rest.y
      return rest
    })
    return JSON.stringify({ nodes: normalizedNodes, connections: editorConnections })
  }, [editorNodes, editorConnections])

  const applyNumberUniformUpdate = (
    uniformNode: UniformNode<'float', number>,
    mode: UniformUpdateMode,
    source: UniformUpdateSource,
  ) => {
    if (mode === 'frame') {
      uniformNode.onFrameUpdate(() => performance.now() / 1000)
      return
    }
    if (mode === 'object') {
      uniformNode.onObjectUpdate(({ object }) => getObjectUpdateValue(object, source))
      return
    }
    if (mode === 'render') {
      uniformNode.onRenderUpdate(({ camera }) => getCameraUpdateValue(camera, source))
    }
  }

  const ensureNumberUniform = (node: GraphNode, value: number) => {
    const mode = getNumberUpdateMode(node)
    const source = getNumberUpdateSource(node, mode)
    let entry = nodeUniformsRef.current[node.id]
    if (!entry || entry.kind !== 'number' || entry.mode !== mode || entry.source !== source) {
      const uniformNode = uniform(value)
      if (mode !== 'manual') {
        applyNumberUniformUpdate(uniformNode, mode, source)
      }
      entry = { uniform: uniformNode, mode, source, kind: 'number' }
      nodeUniformsRef.current[node.id] = entry
    }
    if (mode === 'manual') {
      entry.uniform.value = value
    }
    return entry.uniform
  }

  const ensureColorUniform = (node: GraphNode, value: string) => {
    let entry = nodeUniformsRef.current[node.id]
    if (!entry || entry.kind !== 'color') {
      const uniformNode = uniform(new Color(value))
      entry = { uniform: uniformNode, mode: 'manual', source: 'value', kind: 'color' }
      nodeUniformsRef.current[node.id] = entry
    }
    if (entry.uniform.value instanceof Color) {
      entry.uniform.value.set(value)
    }
    return entry.uniform
  }

  const buildGraph = () => {
    const expanded = expandFunctions(nodes, connections, functions)
    const nodeMap = buildNodeMap(expanded.nodes)
    const connectionMap = buildConnectionMap(expanded.connections)
    const graphNodes = expanded.nodes

    const fallbackColor = FALLBACK_COLOR_HEX

    const resolveNode = (
      nodeId: string,
      stack: Set<string>,
      outputPin?: string,
    ): TslNodeResult => {
      if (stack.has(nodeId)) {
        return { node: float(0), kind: 'number' }
      }
      stack.add(nodeId)
      const node = nodeMap.get(nodeId)
      if (!node) {
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }

      if (node.type === 'number') {
        const value = parseNumber(node.value)
        stack.delete(nodeId)
        return { node: ensureNumberUniform(node, value), kind: 'number' }
      }
      if (node.type === 'time') {
        stack.delete(nodeId)
        return { node: timeUniformRef.current, kind: 'number' }
      }
      const attributeNode = getAttributeNodeValue(node.type)
      if (attributeNode) {
        stack.delete(nodeId)
        return attributeNode
      }

      if (node.type === 'color') {
        const value = typeof node.value === 'string' ? node.value : DEFAULT_COLOR
        stack.delete(nodeId)
        return { node: ensureColorUniform(node, value), kind: 'color' }
      }
      if (node.type === 'texture') {
        const entry = textureMapRef.current[node.id]
        const nodeTexture = entry?.texture
        const nodeValue = nodeTexture
          ? texture(uniformTexture(nodeTexture), uv())
          : color(FALLBACK_COLOR)
        stack.delete(nodeId)
        return { node: nodeValue, kind: 'color' }
      }
      if (node.type === 'gltfTexture') {
        const entry = gltfMapRef.current[node.id]
        const textureCount = entry?.textures.length ?? 0
        const tex = textureCount
          ? entry?.textures[getTextureIndex(node, textureCount)]
          : null
        const nodeValue = tex ? texture(uniformTexture(tex), uv()) : color(FALLBACK_COLOR)
        stack.delete(nodeId)
        return { node: nodeValue, kind: 'color' }
      }

      const getInput = (pin: string) => {
        const connection = connectionMap.get(`${node.id}:${pin}`)
        if (!connection) {
          return null
        }
        return resolveNode(connection.from.nodeId, stack, connection.from.pin)
      }
      if (node.type === 'functionInput' || node.type === 'functionOutput') {
        const input = getInput('value')
        stack.delete(nodeId)
        return input ?? { node: float(0), kind: 'number' }
      }
      const toVectorNode = (
        entry: ReturnType<typeof getInput>,
        kind: 'color' | 'vec2' | 'vec3' | 'vec4',
      ) => {
        if (entry?.kind === kind) return entry.node
        if (entry?.kind === 'number') {
          if (kind === 'color') return color(entry.node)
          if (kind === 'vec2') return vec2(entry.node, entry.node)
          if (kind === 'vec3') return vec3(entry.node, entry.node, entry.node)
          return vec4(entry.node, entry.node, entry.node, entry.node)
        }
        if (kind === 'color') return color(0)
        if (kind === 'vec2') return vec2(0, 0)
        if (kind === 'vec3') return vec3(0, 0, 0)
        return vec4(0, 0, 0, 1)
      }
      const toVec2Node = (entry: ReturnType<typeof getInput> | null) => {
        if (entry?.kind === 'vec2') return entry.node
        if (entry?.kind === 'vec3' || entry?.kind === 'color') {
          return vec2(entry.node.x, entry.node.y)
        }
        if (entry?.kind === 'vec4') {
          return vec2(entry.node.x, entry.node.y)
        }
        if (entry?.kind === 'number') return vec2(entry.node, entry.node)
        return vec2(0, 0)
      }
      const toVec3Node = (entry: ReturnType<typeof getInput> | null) => {
        if (entry?.kind === 'vec3' || entry?.kind === 'color') return entry.node
        if (entry?.kind === 'vec2') return vec3(entry.node.x, entry.node.y, float(0))
        if (entry?.kind === 'vec4') return vec3(entry.node.x, entry.node.y, entry.node.z)
        if (entry?.kind === 'number') {
          return vec3(entry.node, entry.node, entry.node)
        }
        return vec3(0, 0, 0)
      }
      const toVec4Node = (entry: ReturnType<typeof getInput> | null) => {
        if (entry?.kind === 'vec4') return entry.node
        if (entry?.kind === 'vec3' || entry?.kind === 'color') {
          return vec4(entry.node.x, entry.node.y, entry.node.z, float(1))
        }
        if (entry?.kind === 'vec2') {
          return vec4(entry.node.x, entry.node.y, float(0), float(1))
        }
        if (entry?.kind === 'number') {
          return vec4(entry.node, entry.node, entry.node, entry.node)
        }
        return vec4(0, 0, 0, 1)
      }
      const resolveColorSource = (entry: ReturnType<typeof getInput> | null) =>
        entry ? toVec3Node(entry) : color(0)
      const wrapColorResult = (
        result: TslNodeValue,
        entry: ReturnType<typeof getInput> | null,
      ) => {
        const kind: ExprKind = entry?.kind === 'color' || !entry ? 'color' : 'vec3'
        return { node: kind === 'color' ? color(result) : result, kind }
      }

      if (node.type === 'add' || node.type === 'multiply') {
        const left =
          getInput('a') ??
          ({
            node: node.type === 'add' ? float(0) : float(1),
            kind: 'number' as const,
          })
        const right =
          getInput('b') ??
          ({
            node: node.type === 'add' ? float(0) : float(1),
            kind: 'number' as const,
          })
        const combined = combineTypes(left.kind, right.kind)
        const toKindNode = (
          entry: typeof left,
          kind: 'number' | 'color' | 'vec2' | 'vec3' | 'vec4',
        ) => {
          if (entry.kind === kind) return entry.node
          if (entry.kind === 'number') {
            if (kind === 'color') return color(entry.node)
            if (kind === 'vec2') return vec2(entry.node, entry.node)
            if (kind === 'vec3') return vec3(entry.node, entry.node, entry.node)
            if (kind === 'vec4') return vec4(entry.node, entry.node, entry.node, entry.node)
          }
          return kind === 'number' ? float(0) : color(0)
        }
        if (combined === 'number') {
          const nodeResult =
            node.type === 'add'
              ? left.node.add(right.node)
              : left.node.mul(right.node)
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const l = toKindNode(left, combined)
          const r = toKindNode(right, combined)
          const nodeResult = node.type === 'add' ? l.add(r) : l.mul(r)
          stack.delete(nodeId)
          return { node: nodeResult, kind: combined }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'sine') {
        const input = getInput('value')
        const inputNode = input?.kind === 'number' ? input.node : float(0)
        const nodeResult = sin(inputNode)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (node.type === 'normalize') {
        const input = getInput('value')
        if (input && isVectorKind(input.kind)) {
          const nodeResult = normalize(input.node)
          stack.delete(nodeId)
          return { node: nodeResult, kind: input.kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'length') {
        const input = getInput('value')
        if (input && isVectorKind(input.kind)) {
          const nodeResult = length(input.node)
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'dot') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (inputA && inputB && vecA && vecB && vecA === vecB) {
          const nodeResult = dot(inputA.node, inputB.node)
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'cross') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (inputA && inputB && vecA === 'vec3' && vecB === 'vec3') {
          const nodeResult = cross(inputA.node, inputB.node)
          const kind = inputA.kind === 'color' || inputB.kind === 'color' ? 'color' : 'vec3'
          stack.delete(nodeId)
          return { node: nodeResult, kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'checker') {
        const input = getInput('coord')
        const coord =
          input?.kind === 'vec2'
            ? input.node
            : input?.kind === 'number'
              ? vec2(input.node, input.node)
              : uv()
        const nodeResult = checker(coord)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (node.type === 'dFdx' || node.type === 'dFdy' || node.type === 'fwidth') {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          stack.delete(nodeId)
          return { node: float(0), kind: 'number' }
        }
        const fn = node.type === 'dFdx' ? dFdx : node.type === 'dFdy' ? dFdy : fwidth
        const nodeResult = fn(input.node)
        stack.delete(nodeId)
        return { node: nodeResult, kind: input.kind }
      }
      if (node.type === 'distance') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'number') {
          const nodeResult = distance(
            inputA?.kind === 'number' ? inputA.node : float(0),
            inputB?.kind === 'number' ? inputB.node : float(0),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const nodeResult = distance(
            toVectorNode(inputA, kind),
            toVectorNode(inputB, kind),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'reflect' || node.type === 'refract' || node.type === 'faceforward') {
        const toVec3Node = (entry: ReturnType<typeof getInput> | null) => {
          if (entry?.kind === 'vec3' || entry?.kind === 'color') return entry.node
          if (entry?.kind === 'number') return vec3(entry.node, entry.node, entry.node)
          return vec3(0, 0, 0)
        }
        if (node.type === 'reflect') {
          const incident = toVec3Node(getInput('incident'))
          const normal = toVec3Node(getInput('normal'))
          const nodeResult = reflect(incident, normal)
          const kind =
            getInput('incident')?.kind === 'color' || getInput('normal')?.kind === 'color'
              ? 'color'
              : 'vec3'
          stack.delete(nodeId)
          return { node: nodeResult, kind }
        }
        if (node.type === 'refract') {
          const incident = toVec3Node(getInput('incident'))
          const normal = toVec3Node(getInput('normal'))
          const etaInput = getInput('eta')
          const eta = etaInput?.kind === 'number' ? etaInput.node : float(1)
          const nodeResult = refract(incident, normal, eta)
          const kind =
            getInput('incident')?.kind === 'color' || getInput('normal')?.kind === 'color'
              ? 'color'
              : 'vec3'
          stack.delete(nodeId)
          return { node: nodeResult, kind }
        }
        const n = toVec3Node(getInput('n'))
        const i = toVec3Node(getInput('i'))
        const nref = toVec3Node(getInput('nref'))
        const nodeResult = faceforward(n, i, nref)
        const kind =
          getInput('n')?.kind === 'color' ||
          getInput('i')?.kind === 'color' ||
          getInput('nref')?.kind === 'color'
            ? 'color'
            : 'vec3'
        stack.delete(nodeId)
        return { node: nodeResult, kind }
      }
      if (node.type === 'triNoise3D') {
        const inputPosition = getInput('position')
        const inputSpeed = getInput('speed')
        const inputTime = getInput('time')
        const position =
          inputPosition?.kind === 'vec3'
            ? inputPosition.node
            : inputPosition?.kind === 'number'
              ? vec3(inputPosition.node, inputPosition.node, inputPosition.node)
              : positionLocal
        const speed = inputSpeed?.kind === 'number' ? inputSpeed.node : float(1)
        const time = inputTime?.kind === 'number' ? inputTime.node : timeUniformRef.current
        const nodeResult = triNoise3D(position, speed, time)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (node.type === 'mxNoiseFloat' || node.type === 'mxNoiseVec3' || node.type === 'mxNoiseVec4') {
        const texcoord = getInput('texcoord')
        const amplitudeInput = getInput('amplitude')
        const pivotInput = getInput('pivot')
        const coordNode = texcoord
          ? texcoord.kind === 'vec3' || texcoord.kind === 'color' || texcoord.kind === 'vec4'
            ? toVec3Node(texcoord)
            : toVec2Node(texcoord)
          : uv()
        const amplitude = amplitudeInput?.kind === 'number' ? amplitudeInput.node : float(1)
        const pivot = pivotInput?.kind === 'number' ? pivotInput.node : float(0)
        const nodeResult =
          node.type === 'mxNoiseFloat'
            ? mx_noise_float(coordNode, amplitude, pivot)
            : node.type === 'mxNoiseVec3'
              ? mx_noise_vec3(coordNode, amplitude, pivot)
              : mx_noise_vec4(coordNode, amplitude, pivot)
        const kind =
          node.type === 'mxNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxNoiseVec3'
              ? ('vec3' as const)
              : ('vec4' as const)
        stack.delete(nodeId)
        return { node: nodeResult, kind }
      }
      if (
        node.type === 'mxFractalNoiseFloat' ||
        node.type === 'mxFractalNoiseVec2' ||
        node.type === 'mxFractalNoiseVec3' ||
        node.type === 'mxFractalNoiseVec4'
      ) {
        const positionInput = getInput('position')
        const octavesInput = getInput('octaves')
        const lacunarityInput = getInput('lacunarity')
        const diminishInput = getInput('diminish')
        const amplitudeInput = getInput('amplitude')
        const positionNode = positionInput
          ? positionInput.kind === 'vec3' ||
            positionInput.kind === 'color' ||
            positionInput.kind === 'vec4'
            ? toVec3Node(positionInput)
            : toVec2Node(positionInput)
          : uv()
        const octaves = octavesInput?.kind === 'number' ? octavesInput.node : float(3)
        const lacunarity = lacunarityInput?.kind === 'number' ? lacunarityInput.node : float(2)
        const diminish = diminishInput?.kind === 'number' ? diminishInput.node : float(0.5)
        const amplitude = amplitudeInput?.kind === 'number' ? amplitudeInput.node : float(1)
        const nodeResult =
          node.type === 'mxFractalNoiseFloat'
            ? mx_fractal_noise_float(positionNode, octaves, lacunarity, diminish, amplitude)
            : node.type === 'mxFractalNoiseVec2'
              ? mx_fractal_noise_vec2(positionNode, octaves, lacunarity, diminish, amplitude)
              : node.type === 'mxFractalNoiseVec3'
                ? mx_fractal_noise_vec3(positionNode, octaves, lacunarity, diminish, amplitude)
                : mx_fractal_noise_vec4(positionNode, octaves, lacunarity, diminish, amplitude)
        const kind =
          node.type === 'mxFractalNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxFractalNoiseVec2'
              ? ('vec2' as const)
              : node.type === 'mxFractalNoiseVec3'
                ? ('vec3' as const)
                : ('vec4' as const)
        stack.delete(nodeId)
        return { node: nodeResult, kind }
      }
      if (
        node.type === 'mxWorleyNoiseFloat' ||
        node.type === 'mxWorleyNoiseVec2' ||
        node.type === 'mxWorleyNoiseVec3'
      ) {
        const texcoord = getInput('texcoord')
        const jitterInput = getInput('jitter')
        const coordNode = texcoord
          ? texcoord.kind === 'vec3' || texcoord.kind === 'color' || texcoord.kind === 'vec4'
            ? toVec3Node(texcoord)
            : toVec2Node(texcoord)
          : uv()
        const jitter = jitterInput?.kind === 'number' ? jitterInput.node : float(1)
        const nodeResult =
          node.type === 'mxWorleyNoiseFloat'
            ? mx_worley_noise_float(coordNode, jitter)
            : node.type === 'mxWorleyNoiseVec2'
              ? mx_worley_noise_vec2(coordNode, jitter)
              : mx_worley_noise_vec3(coordNode, jitter)
        const kind =
          node.type === 'mxWorleyNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxWorleyNoiseVec2'
              ? ('vec2' as const)
              : ('vec3' as const)
        stack.delete(nodeId)
        return { node: nodeResult, kind }
      }
      if (node.type === 'rotateUV') {
        const uvInput = getInput('uv')
        const rotationInput = getInput('rotation')
        const centerInput = getInput('center')
        const uvNode = uvInput ? toVec2Node(uvInput) : uv()
        const rotation = rotationInput?.kind === 'number' ? rotationInput.node : float(0)
        const center = centerInput ? toVec2Node(centerInput) : vec2(0.5, 0.5)
        const nodeResult = rotateUV(uvNode, rotation, center)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec2' }
      }
      if (node.type === 'scaleUV') {
        const uvInput = getInput('uv')
        const scaleInput = getInput('scale')
        const uvNode = uvInput ? toVec2Node(uvInput) : uv()
        const scale = scaleInput ? toVec2Node(scaleInput) : vec2(1, 1)
        const nodeResult = uvNode.mul(scale)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec2' }
      }
      if (node.type === 'offsetUV') {
        const uvInput = getInput('uv')
        const offsetInput = getInput('offset')
        const uvNode = uvInput ? toVec2Node(uvInput) : uv()
        const offset = offsetInput ? toVec2Node(offsetInput) : vec2(0, 0)
        const nodeResult = uvNode.add(offset)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec2' }
      }
      if (node.type === 'spherizeUV') {
        const uvInput = getInput('uv')
        const strengthInput = getInput('strength')
        const centerInput = getInput('center')
        const uvNode = uvInput ? toVec2Node(uvInput) : uv()
        const strength = strengthInput?.kind === 'number' ? strengthInput.node : float(0)
        const center = centerInput ? toVec2Node(centerInput) : vec2(0.5, 0.5)
        const nodeResult = spherizeUV(uvNode, strength, center)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec2' }
      }
      if (node.type === 'spritesheetUV') {
        const sizeInput = getInput('size')
        const uvInput = getInput('uv')
        const timeInput = getInput('time')
        const sizeNode = sizeInput ? toVec2Node(sizeInput) : vec2(1, 1)
        const uvNode = uvInput ? toVec2Node(uvInput) : uv()
        const timeNode = timeInput?.kind === 'number' ? timeInput.node : timeUniformRef.current
        const nodeResult = spritesheetUV(sizeNode, uvNode, timeNode)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec2' }
      }
      if (node.type === 'smoothstep') {
        const edge0Input = getInput('edge0')
        const edge1Input = getInput('edge1')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edge0Input?.kind ?? 'number',
          edge1Input?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'number') {
          const nodeResult = smoothstep(
            edge0Input?.kind === 'number' ? edge0Input.node : float(0),
            edge1Input?.kind === 'number' ? edge1Input.node : float(1),
            xInput?.kind === 'number' ? xInput.node : float(0),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const nodeResult = smoothstep(
            toVectorNode(edge0Input, kind),
            toVectorNode(edge1Input, kind),
            toVectorNode(xInput, kind),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'pow') {
        const baseInput = getInput('base')
        const expInput = getInput('exp')
        const kind = resolveVectorOutputKind([
          baseInput?.kind ?? 'number',
          expInput?.kind ?? 'number',
        ])
        if (kind === 'number') {
          const nodeResult = pow(
            baseInput?.kind === 'number' ? baseInput.node : float(0),
            expInput?.kind === 'number' ? expInput.node : float(1),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const nodeResult = pow(
            toVectorNode(baseInput, kind),
            toVectorNode(expInput, kind),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'vec2') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const nodeX = inputX?.kind === 'number' ? inputX.node : float(0)
        const nodeY = inputY?.kind === 'number' ? inputY.node : float(0)
        const nodeResult = vec2(nodeX, nodeY)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec2' }
      }
      if (node.type === 'mat2') {
        const c0 = toVec2Node(getInput('c0'))
        const c1 = toVec2Node(getInput('c1'))
        const nodeResult = (mat2 as unknown as (...args: unknown[]) => ReturnType<typeof mat2>)(c0, c1)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'mat2' }
      }
      if (node.type === 'vec3') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const inputZ = getInput('z')
        const nodeX = inputX?.kind === 'number' ? inputX.node : float(0)
        const nodeY = inputY?.kind === 'number' ? inputY.node : float(0)
        const nodeZ = inputZ?.kind === 'number' ? inputZ.node : float(0)
        const nodeResult = vec3(nodeX, nodeY, nodeZ)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec3' }
      }
      if (node.type === 'mat3') {
        const c0 = toVec3Node(getInput('c0'))
        const c1 = toVec3Node(getInput('c1'))
        const c2 = toVec3Node(getInput('c2'))
        const nodeResult = mat3(c0, c1, c2)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'mat3' }
      }
      if (node.type === 'scale') {
        const inputValue = getInput('value')
        const inputScale = getInput('scale')
        const valueNode =
          inputValue?.kind === 'vec3'
            ? inputValue.node
            : inputValue?.kind === 'number'
              ? vec3(inputValue.node, inputValue.node, inputValue.node)
              : vec3(0, 0, 0)
        const scaleNode =
          inputScale?.kind === 'vec3'
            ? inputScale.node
            : inputScale?.kind === 'number'
              ? vec3(inputScale.node, inputScale.node, inputScale.node)
              : vec3(1, 1, 1)
        const nodeResult = valueNode.mul(scaleNode)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec3' }
      }
      if (node.type === 'rotate') {
        const inputValue = getInput('value')
        const inputRotation = getInput('rotation')
        const valueNode =
          inputValue?.kind === 'vec3'
            ? inputValue.node
            : inputValue?.kind === 'number'
              ? vec3(inputValue.node, inputValue.node, inputValue.node)
              : vec3(0, 0, 0)
        const rotationNode =
          inputRotation?.kind === 'vec3'
            ? inputRotation.node
            : inputRotation?.kind === 'number'
              ? vec3(inputRotation.node, inputRotation.node, inputRotation.node)
              : vec3(0, 0, 0)
        const neg = float(-1)
        const cx = cos(rotationNode.x)
        const sx = sin(rotationNode.x)
        const cy = cos(rotationNode.y)
        const sy = sin(rotationNode.y)
        const cz = cos(rotationNode.z)
        const sz = sin(rotationNode.z)
        const rotX = vec3(
          valueNode.x,
          valueNode.y.mul(cx).add(valueNode.z.mul(sx).mul(neg)),
          valueNode.y.mul(sx).add(valueNode.z.mul(cx)),
        )
        const rotY = vec3(
          rotX.x.mul(cy).add(rotX.z.mul(sy)),
          rotX.y,
          rotX.z.mul(cy).add(rotX.x.mul(sy).mul(neg)),
        )
        const nodeResult = vec3(
          rotY.x.mul(cz).add(rotY.y.mul(sz).mul(neg)),
          rotY.x.mul(sz).add(rotY.y.mul(cz)),
          rotY.z,
        )
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec3' }
      }
      if (node.type === 'vec4') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const inputZ = getInput('z')
        const inputW = getInput('w')
        const nodeX = inputX?.kind === 'number' ? inputX.node : float(0)
        const nodeY = inputY?.kind === 'number' ? inputY.node : float(0)
        const nodeZ = inputZ?.kind === 'number' ? inputZ.node : float(0)
        const nodeW = inputW?.kind === 'number' ? inputW.node : float(1)
        const nodeResult = vec4(nodeX, nodeY, nodeZ, nodeW)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'vec4' }
      }
      if (node.type === 'mat4') {
        const c0 = toVec4Node(getInput('c0'))
        const c1 = toVec4Node(getInput('c1'))
        const c2 = toVec4Node(getInput('c2'))
        const c3 = toVec4Node(getInput('c3'))
        const nodeResult = mat4(c0, c1, c2, c3)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'mat4' }
      }
      if (node.type === 'modelMatrix') {
        stack.delete(nodeId)
        return { node: modelWorldMatrix, kind: 'mat4' }
      }
      if (node.type === 'viewMatrix') {
        stack.delete(nodeId)
        return { node: cameraViewMatrix, kind: 'mat4' }
      }
      if (node.type === 'projectionMatrix') {
        stack.delete(nodeId)
        return { node: cameraProjectionMatrix, kind: 'mat4' }
      }
      if (node.type === 'modelViewMatrix') {
        stack.delete(nodeId)
        return { node: modelViewMatrix, kind: 'mat4' }
      }
      if (node.type === 'normalMatrix') {
        stack.delete(nodeId)
        return { node: modelNormalMatrix, kind: 'mat3' }
      }
      if (node.type === 'transpose' || node.type === 'inverse') {
        const input = getInput('value')
        if (input && isMatrixKind(input.kind)) {
          const fn = node.type === 'transpose' ? transpose : inverse
          const nodeResult = fn(input.node)
          stack.delete(nodeId)
          return { node: nodeResult, kind: input.kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'splitVec2') {
        const input = getInput('value')
        const source =
          input?.kind === 'vec2'
            ? input.node
            : input?.kind === 'number'
              ? vec2(input.node, input.node)
              : vec2(0, 0)
        const channel = outputPin === 'y' ? source.y : source.x
        const nodeResult = channel
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (node.type === 'splitVec3') {
        const input = getInput('value')
        const source =
          input?.kind === 'vec3'
            ? input.node
            : input?.kind === 'number'
              ? vec3(input.node, input.node, input.node)
              : vec3(0, 0, 0)
        const channel =
          outputPin === 'y' ? source.y : outputPin === 'z' ? source.z : source.x
        const nodeResult = channel
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (node.type === 'splitVec4') {
        const input = getInput('value')
        const source =
          input?.kind === 'vec4'
            ? input.node
            : input?.kind === 'number'
              ? vec4(input.node, input.node, input.node, input.node)
              : vec4(0, 0, 0, 1)
        const channel =
          outputPin === 'y'
            ? source.y
            : outputPin === 'z'
              ? source.z
              : outputPin === 'w'
                ? source.w
                : source.x
        const nodeResult = channel
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (node.type === 'cosine') {
        const input = getInput('value')
        const inputNode = input?.kind === 'number' ? input.node : float(0)
        const nodeResult = cos(inputNode)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (
        node.type === 'tan' ||
        node.type === 'asin' ||
        node.type === 'acos' ||
        node.type === 'atan' ||
        node.type === 'radians' ||
        node.type === 'degrees'
      ) {
        const input = getInput('value')
        if (input && (input.kind === 'number' || isVectorKind(input.kind))) {
          const fn =
            node.type === 'tan'
              ? tan
              : node.type === 'asin'
                ? asin
                : node.type === 'acos'
                  ? acos
                  : node.type === 'atan'
                    ? atan
                    : node.type === 'radians'
                      ? radians
                      : degrees
          const nodeResult = fn(input.node)
          stack.delete(nodeId)
          return { node: nodeResult, kind: input.kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'remap' || node.type === 'remapClamp') {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          stack.delete(nodeId)
          return { node: float(0), kind: 'number' }
        }
        const inLowInput = getInput('inLow')
        const inHighInput = getInput('inHigh')
        const outLowInput = getInput('outLow')
        const outHighInput = getInput('outHigh')
        const kind = input.kind
        const toKindNode = (entry: ReturnType<typeof getInput> | null, fallback: number) => {
          if (kind === 'number') {
            return entry?.kind === 'number' ? entry.node : float(fallback)
          }
          return toVectorNode(entry, kind)
        }
        const inLowNode = toKindNode(inLowInput, 0)
        const inHighNode = toKindNode(inHighInput, 1)
        const outLowNode = toKindNode(outLowInput, 0)
        const outHighNode = toKindNode(outHighInput, 1)
        const fn = node.type === 'remap' ? remap : remapClamp
        const nodeResult = fn(input.node, inLowNode, inHighNode, outLowNode, outHighNode)
        if (kind === 'color') {
          stack.delete(nodeId)
          return { node: color(nodeResult), kind: 'color' }
        }
        stack.delete(nodeId)
        return { node: nodeResult, kind }
      }
      if (node.type === 'smoothstepElement') {
        const lowInput = getInput('low')
        const highInput = getInput('high')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          lowInput?.kind ?? 'number',
          highInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'number') {
          const nodeResult = smoothstepElement(
            xInput?.kind === 'number' ? xInput.node : float(0),
            lowInput?.kind === 'number' ? lowInput.node : float(0),
            highInput?.kind === 'number' ? highInput.node : float(1),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const nodeResult = smoothstepElement(
            toVectorNode(xInput, kind),
            toVectorNode(lowInput, kind),
            toVectorNode(highInput, kind),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'stepElement') {
        const edgeInput = getInput('edge')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edgeInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'number') {
          const nodeResult = stepElement(
            xInput?.kind === 'number' ? xInput.node : float(0),
            edgeInput?.kind === 'number' ? edgeInput.node : float(0),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const nodeResult = stepElement(
            toVectorNode(xInput, kind),
            toVectorNode(edgeInput, kind),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (
        node.type === 'lessThan' ||
        node.type === 'lessThanEqual' ||
        node.type === 'greaterThan' ||
        node.type === 'greaterThanEqual' ||
        node.type === 'equal' ||
        node.type === 'notEqual'
      ) {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          stack.delete(nodeId)
          return { node: float(0), kind: 'number' }
        }
        if (kind === 'mat2' || kind === 'mat3' || kind === 'mat4') {
          stack.delete(nodeId)
          return { node: float(0), kind: 'number' }
        }
        const left =
          kind === 'number'
            ? inputA?.kind === 'number'
              ? inputA.node
              : float(0)
            : toVectorNode(inputA, kind)
        const right =
          kind === 'number'
            ? inputB?.kind === 'number'
              ? inputB.node
              : float(0)
            : toVectorNode(inputB, kind)
        const compareFn =
          node.type === 'lessThan'
            ? lessThan
            : node.type === 'lessThanEqual'
              ? lessThanEqual
              : node.type === 'greaterThan'
                ? greaterThan
                : node.type === 'greaterThanEqual'
                  ? greaterThanEqual
                  : node.type === 'equal'
                    ? equal
                    : notEqual
        const one =
          kind === 'number'
            ? float(1)
            : kind === 'vec2'
              ? vec2(1, 1)
              : kind === 'vec3'
                ? vec3(1, 1, 1)
                : kind === 'vec4'
                  ? vec4(1, 1, 1, 1)
                  : color(1)
        const zero =
          kind === 'number'
            ? float(0)
            : kind === 'vec2'
              ? vec2(0, 0)
              : kind === 'vec3'
                ? vec3(0, 0, 0)
                : kind === 'vec4'
                  ? vec4(0, 0, 0, 0)
                  : color(0)
        const nodeResult = select(compareFn(left, right), one, zero)
        stack.delete(nodeId)
        return { node: nodeResult, kind }
      }
      if (node.type === 'and' || node.type === 'or') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          stack.delete(nodeId)
          return { node: float(0), kind: 'number' }
        }
        if (kind === 'mat2' || kind === 'mat3' || kind === 'mat4') {
          stack.delete(nodeId)
          return { node: float(0), kind: 'number' }
        }
        const edge: TslNodeValue =
          kind === 'number'
            ? float(0.5)
            : kind === 'vec2'
              ? vec2(0.5, 0.5)
              : kind === 'vec3'
                ? vec3(0.5, 0.5, 0.5)
                : kind === 'vec4'
                  ? vec4(0.5, 0.5, 0.5, 0.5)
                  : color(0.5)
        const valueA =
          kind === 'number'
            ? inputA?.kind === 'number'
              ? inputA.node
              : float(0)
            : toVectorNode(inputA, kind)
        const valueB =
          kind === 'number'
            ? inputB?.kind === 'number'
              ? inputB.node
              : float(0)
            : toVectorNode(inputB, kind)
        const maskA: TslNodeValue = step(edge, valueA)
        const maskB: TslNodeValue = step(edge, valueB)
        const nodeResult = node.type === 'and' ? maskA.mul(maskB) : max(maskA, maskB)
        stack.delete(nodeId)
        return { node: nodeResult, kind }
      }
      if (node.type === 'not') {
        const input = getInput('value')
        const kind = input?.kind ?? 'number'
        if (kind !== 'number' && !isVectorKind(kind)) {
          stack.delete(nodeId)
          return { node: float(0), kind: 'number' }
        }
        const edge: TslNodeValue =
          kind === 'number'
            ? float(0.5)
            : kind === 'vec2'
              ? vec2(0.5, 0.5)
              : kind === 'vec3'
                ? vec3(0.5, 0.5, 0.5)
                : kind === 'vec4'
                  ? vec4(0.5, 0.5, 0.5, 0.5)
                  : color(0.5)
        const value =
          kind === 'number'
            ? input?.kind === 'number'
              ? input.node
              : float(0)
            : toVectorNode(input, kind)
        const mask: TslNodeValue = step(edge, value)
        const nodeResult = oneMinus(mask)
        stack.delete(nodeId)
        return { node: nodeResult, kind }
      }
      if (node.type === 'atan2') {
        const inputY = getInput('y')
        const inputX = getInput('x')
        const combined = resolveVectorOutputKind([
          inputY?.kind ?? 'number',
          inputX?.kind ?? 'number',
        ])
        if (combined === 'number') {
          const nodeResult = atan(
            inputY?.kind === 'number' ? inputY.node : float(0),
            inputX?.kind === 'number' ? inputX.node : float(0),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const nodeY = toVectorNode(inputY, combined)
          const nodeX = toVectorNode(inputX, combined)
          const nodeResult = atan(nodeY, nodeX)
          stack.delete(nodeId)
          return { node: nodeResult, kind: combined }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'abs') {
        const input = getInput('value')
        const inputNode = input?.kind === 'number' ? input.node : float(0)
        const nodeResult = abs(inputNode)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (node.type === 'clamp') {
        const input = getInput('value')
        const minInput = getInput('min')
        const maxInput = getInput('max')
        const inputNode = input?.kind === 'number' ? input.node : float(0)
        const minNode = minInput?.kind === 'number' ? minInput.node : float(0)
        const maxNode = maxInput?.kind === 'number' ? maxInput.node : float(1)
        const nodeResult = clamp(inputNode, minNode, maxNode)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (node.type === 'min' || node.type === 'max' || node.type === 'mod') {
        const inputA = getInput('a') ?? { node: float(0), kind: 'number' as const }
        const inputB = getInput('b') ?? { node: float(0), kind: 'number' as const }
        const combined = combineTypes(inputA.kind, inputB.kind)
        if (combined === 'number') {
          const nodeResult =
            node.type === 'min'
              ? min(inputA.node, inputB.node)
              : node.type === 'max'
                ? max(inputA.node, inputB.node)
                : mod(inputA.node, inputB.node)
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const nodeA = toVectorNode(inputA, combined)
          const nodeB = toVectorNode(inputB, combined)
          const nodeResult =
            node.type === 'min'
              ? min(nodeA, nodeB)
              : node.type === 'max'
                ? max(nodeA, nodeB)
                : mod(nodeA, nodeB)
          stack.delete(nodeId)
          return { node: nodeResult, kind: combined }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'step') {
        const edgeInput = getInput('edge')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edgeInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'number') {
          const nodeResult = step(
            edgeInput?.kind === 'number' ? edgeInput.node : float(0),
            xInput?.kind === 'number' ? xInput.node : float(0),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const nodeResult = step(
            toVectorNode(edgeInput, kind),
            toVectorNode(xInput, kind),
          )
          stack.delete(nodeId)
          return { node: nodeResult, kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (
        node.type === 'fract' ||
        node.type === 'floor' ||
        node.type === 'ceil' ||
        node.type === 'round' ||
        node.type === 'trunc' ||
        node.type === 'exp' ||
        node.type === 'exp2' ||
        node.type === 'log' ||
        node.type === 'log2' ||
        node.type === 'sign' ||
        node.type === 'oneMinus' ||
        node.type === 'negate' ||
        node.type === 'pow2' ||
        node.type === 'pow3' ||
        node.type === 'pow4' ||
        node.type === 'sqrt' ||
        node.type === 'saturate'
      ) {
        const input = getInput('value')
        if (input && (input.kind === 'number' || isVectorKind(input.kind))) {
          const fn =
            node.type === 'fract'
              ? fract
              : node.type === 'floor'
                ? floor
                : node.type === 'ceil'
                  ? ceil
                  : node.type === 'round'
                    ? round
                    : node.type === 'trunc'
                      ? trunc
              : node.type === 'exp'
                ? exp
                : node.type === 'exp2'
                  ? exp2
                  : node.type === 'log'
                    ? log
                    : node.type === 'log2'
                      ? log2
                      : node.type === 'sign'
                        ? sign
                        : node.type === 'oneMinus'
                          ? oneMinus
                          : node.type === 'pow2'
                            ? pow2
                            : node.type === 'pow3'
                              ? pow3
                              : node.type === 'pow4'
                                ? pow4
                                : node.type === 'sqrt'
                                  ? sqrt
                                  : node.type === 'saturate'
                                    ? saturate
                                    : negate
          const nodeResult = fn(input.node)
          stack.delete(nodeId)
          return { node: nodeResult, kind: input.kind }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'mix') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputT = getInput('t')
        const nodeT = inputT?.kind === 'number' ? inputT.node : float(0.5)
        const combined = combineTypes(inputA?.kind ?? 'number', inputB?.kind ?? 'number')
        if (combined === 'number') {
          const nodeA = inputA?.kind === 'number' ? inputA.node : float(0)
          const nodeB = inputB?.kind === 'number' ? inputB.node : float(1)
          const nodeResult = mix(nodeA, nodeB, nodeT)
          stack.delete(nodeId)
          return { node: nodeResult, kind: 'number' }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const toKindNode = (
            entry: typeof inputA,
            kind: 'color' | 'vec2' | 'vec3' | 'vec4',
          ) => {
            if (entry?.kind === kind) return entry.node
            if (entry?.kind === 'number') {
              if (kind === 'color') return color(entry.node)
              if (kind === 'vec2') return vec2(entry.node, entry.node)
              if (kind === 'vec3') return vec3(entry.node, entry.node, entry.node)
              if (kind === 'vec4') return vec4(entry.node, entry.node, entry.node, entry.node)
            }
            return kind === 'color' ? color(0) : vec3(0, 0, 0)
          }
          const nodeA = toKindNode(inputA, combined)
          const nodeB = toKindNode(inputB, combined)
          const nodeResult = mix(nodeA, nodeB, nodeT)
          stack.delete(nodeId)
          return { node: nodeResult, kind: combined }
        }
        stack.delete(nodeId)
        return { node: float(0), kind: 'number' }
      }
      if (node.type === 'ifElse') {
        const inputCond = getInput('cond')
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputThreshold = getInput('threshold')
        const combined = combineTypes(inputA?.kind ?? 'number', inputB?.kind ?? 'number')
        if (combined === 'unknown' || isMatrixKind(combined)) {
          stack.delete(nodeId)
          return { node: float(0), kind: 'number' }
        }
        const outputKind = combined as 'number' | 'color' | 'vec2' | 'vec3' | 'vec4'
        const toKindNode = (
          entry: typeof inputA,
          kind: 'number' | 'color' | 'vec2' | 'vec3' | 'vec4',
          fallback: number,
        ) => {
          if (kind === 'number') {
            return entry?.kind === 'number' ? entry.node : float(fallback)
          }
          if (entry?.kind === kind) return entry.node
          if (entry?.kind === 'number') {
            if (kind === 'color') return color(entry.node)
            if (kind === 'vec2') return vec2(entry.node, entry.node)
            if (kind === 'vec3') return vec3(entry.node, entry.node, entry.node)
            return vec4(entry.node, entry.node, entry.node, entry.node)
          }
          if (kind === 'color') return color(fallback)
          if (kind === 'vec2') return vec2(fallback, fallback)
          if (kind === 'vec3') return vec3(fallback, fallback, fallback)
          return vec4(fallback, fallback, fallback, fallback)
        }
        const nodeA = toKindNode(inputA, outputKind, 1)
        const nodeB = toKindNode(inputB, outputKind, 0)
        const condValue = (() => {
          if (!inputCond) return float(0)
          if (outputKind === 'number') {
            if (inputCond.kind === 'number') return inputCond.node
            if (isVectorKind(inputCond.kind)) return length(inputCond.node)
            return float(0)
          }
          if (outputKind === 'vec2') return toVec2Node(inputCond)
          if (outputKind === 'vec4') return toVec4Node(inputCond)
          return toVec3Node(inputCond)
        })()
        const thresholdValue =
          inputThreshold?.kind === 'number' ? inputThreshold.node : float(0.5)
        const threshold =
          outputKind === 'number'
            ? thresholdValue
            : outputKind === 'vec2'
              ? vec2(thresholdValue, thresholdValue)
              : outputKind === 'vec4'
                ? vec4(thresholdValue, thresholdValue, thresholdValue, thresholdValue)
                : outputKind === 'color'
                  ? color(thresholdValue)
                  : vec3(thresholdValue, thresholdValue, thresholdValue)
        const mask = greaterThan(condValue, threshold)
        const nodeResult = select(mask, nodeA, nodeB)
        stack.delete(nodeId)
        return { node: nodeResult, kind: outputKind }
      }
      if (node.type === 'luminance') {
        const input = getInput('value')
        const source = resolveColorSource(input)
        const nodeResult = luminance(source)
        stack.delete(nodeId)
        return { node: nodeResult, kind: 'number' }
      }
      if (
        node.type === 'grayscale' ||
        node.type === 'saturation' ||
        node.type === 'posterize' ||
        node.type === 'sRGBTransferEOTF' ||
        node.type === 'sRGBTransferOETF' ||
        node.type === 'linearToneMapping' ||
        node.type === 'reinhardToneMapping' ||
        node.type === 'cineonToneMapping' ||
        node.type === 'acesFilmicToneMapping' ||
        node.type === 'agxToneMapping' ||
        node.type === 'neutralToneMapping'
      ) {
        const input = getInput('value')
        const source = resolveColorSource(input)
        let nodeResult: TslNodeValue
        if (node.type === 'grayscale') {
          nodeResult = grayscale(source)
        } else if (node.type === 'saturation') {
          const amountInput = getInput('amount')
          const amount = amountInput?.kind === 'number' ? amountInput.node : float(1)
          nodeResult = saturation(source, amount)
        } else if (node.type === 'posterize') {
          const stepsInput = getInput('steps')
          const steps = stepsInput?.kind === 'number' ? stepsInput.node : float(4)
          nodeResult = posterize(source, steps)
        } else if (node.type === 'sRGBTransferEOTF') {
          nodeResult = sRGBTransferEOTF(source)
        } else if (node.type === 'sRGBTransferOETF') {
          nodeResult = sRGBTransferOETF(source)
        } else if (node.type === 'linearToneMapping') {
          nodeResult = linearToneMapping(source, float(1))
        } else if (node.type === 'reinhardToneMapping') {
          nodeResult = reinhardToneMapping(source, float(1))
        } else if (node.type === 'cineonToneMapping') {
          nodeResult = cineonToneMapping(source, float(1))
        } else if (node.type === 'acesFilmicToneMapping') {
          nodeResult = acesFilmicToneMapping(source, float(1))
        } else if (node.type === 'agxToneMapping') {
          nodeResult = agxToneMapping(source, float(1))
        } else {
          nodeResult = neutralToneMapping(source, float(1))
        }
        stack.delete(nodeId)
        return wrapColorResult(nodeResult, input)
      }

      if (node.type === 'gltfMaterial') {
        const pin = outputPin ?? 'baseColor'
        const entry = gltfMapRef.current[node.id]
        const materialCount = entry?.materials?.length ?? 0
        const material = materialCount
          ? (entry?.materials?.[
              getMaterialIndex(node, materialCount)
            ] as GltfMaterial | undefined)
          : undefined
        const fallbackColorNode = () => {
          if (!fallbackColorUniformRef.current) {
            fallbackColorUniformRef.current = uniform(new Color(fallbackColor))
          } else {
            ;(fallbackColorUniformRef.current.value as Color).set(fallbackColor)
          }
          return { node: fallbackColorUniformRef.current, kind: 'color' as const }
        }
        const getTextureNode = (tex?: Texture | null) =>
          tex ? { node: texture(uniformTexture(tex), uv()), kind: 'color' as const } : null
        const getColorNode = (value?: Color) =>
          value ? { node: color(value), kind: 'color' as const } : null
        if (!material) {
          if (pin === 'normalScale') {
            stack.delete(nodeId)
            return { node: vec2(1, 1), kind: 'vec2' }
          }
          if (
            pin === 'roughness' ||
            pin === 'metalness' ||
            pin === 'emissiveIntensity' ||
            pin === 'aoMapIntensity' ||
            pin === 'envMapIntensity' ||
            pin === 'opacity' ||
            pin === 'alphaTest' ||
            pin === 'alphaHash'
          ) {
            stack.delete(nodeId)
            return { node: float(0), kind: 'number' }
          }
          stack.delete(nodeId)
          return fallbackColorNode()
        }
        const imported = getImportedMaterialNode(material, pin)
        if (imported) {
          stack.delete(nodeId)
          return { node: imported.node as TslNodeValue, kind: imported.kind }
        }
        if (pin === 'baseColor') {
          const base = getColorNode(material.color)
          const tex = getTextureNode(material.map)
          if (base && tex) {
            stack.delete(nodeId)
            return { node: base.node.mul(tex.node as TslNodeValue), kind: 'color' }
          }
          if (base) {
            stack.delete(nodeId)
            return base
          }
          if (tex) {
            stack.delete(nodeId)
            return tex
          }
          stack.delete(nodeId)
          return fallbackColorNode()
        }
        if (pin === 'baseColorTexture') {
          const tex = getTextureNode(material.map)
          stack.delete(nodeId)
          return tex ?? fallbackColorNode()
        }
        if (pin === 'roughness') {
          stack.delete(nodeId)
          return { node: float(material.roughness ?? 0.7), kind: 'number' }
        }
        if (pin === 'metalness') {
          stack.delete(nodeId)
          return { node: float(material.metalness ?? 0.1), kind: 'number' }
        }
        if (pin === 'roughnessMap') {
          const tex = getTextureNode(material.roughnessMap)
          stack.delete(nodeId)
          return tex ?? fallbackColorNode()
        }
        if (pin === 'metalnessMap') {
          const tex = getTextureNode(material.metalnessMap)
          stack.delete(nodeId)
          return tex ?? fallbackColorNode()
        }
        if (pin === 'emissive') {
          const value = material.emissive ?? new Color(0x000000)
          stack.delete(nodeId)
          return { node: color(value), kind: 'color' }
        }
        if (pin === 'emissiveMap') {
          const tex = getTextureNode(material.emissiveMap)
          stack.delete(nodeId)
          return tex ?? fallbackColorNode()
        }
        if (pin === 'emissiveIntensity') {
          stack.delete(nodeId)
          return { node: float(material.emissiveIntensity ?? 1), kind: 'number' }
        }
        if (pin === 'normalMap') {
          const tex = getTextureNode(material.normalMap)
          stack.delete(nodeId)
          return tex ?? fallbackColorNode()
        }
        if (pin === 'normalScale') {
          const scale = material.normalScale ?? new Vector2(1, 1)
          stack.delete(nodeId)
          return { node: vec2(scale.x, scale.y), kind: 'vec2' }
        }
        if (pin === 'aoMap') {
          const tex = getTextureNode(material.aoMap)
          stack.delete(nodeId)
          return tex ?? fallbackColorNode()
        }
        if (pin === 'aoMapIntensity') {
          stack.delete(nodeId)
          return { node: float(material.aoMapIntensity ?? 1), kind: 'number' }
        }
        if (pin === 'envMap') {
          const tex = getTextureNode(material.envMap)
          stack.delete(nodeId)
          return tex ?? fallbackColorNode()
        }
        if (pin === 'envMapIntensity') {
          stack.delete(nodeId)
          return { node: float(material.envMapIntensity ?? 1), kind: 'number' }
        }
        if (pin === 'opacity') {
          stack.delete(nodeId)
          return { node: float(material.opacity ?? 1), kind: 'number' }
        }
        if (pin === 'alphaTest') {
          stack.delete(nodeId)
          return { node: float(material.alphaTest ?? 0), kind: 'number' }
        }
        if (pin === 'alphaHash') {
          stack.delete(nodeId)
          return { node: float(material.alphaHash ? 1 : 0), kind: 'number' }
        }
        stack.delete(nodeId)
        return fallbackColorNode()
      }
      if (node.type === 'material' || node.type === 'physicalMaterial') {
        const pin = outputPin ?? 'baseColor'
        const input = getInput(pin)
        if (pin === 'baseColor') {
          const base =
            input?.kind === 'color'
              ? input
              : input?.kind === 'number'
                ? { node: color(input.node), kind: 'color' as const }
                : null
          const texInput = getInput('baseColorTexture')
          const tex =
            texInput?.kind === 'color'
              ? texInput
              : texInput?.kind === 'number'
                ? {
                    node: color(texInput.node),
                    kind: 'color' as const,
                  }
                : null
          if (base && tex) {
            stack.delete(nodeId)
            return { node: base.node.mul(tex.node), kind: 'color' }
          }
          if (base) {
            stack.delete(nodeId)
            return base
          }
          if (tex) {
            stack.delete(nodeId)
            return tex
          }
        }
        if (pin === 'roughness' || pin === 'metalness') {
          const fallback = float(pin === 'roughness' ? 0.7 : 0.1)
          stack.delete(nodeId)
          return input ?? { node: fallback, kind: 'number' }
        }
    if (!fallbackColorUniformRef.current) {
      fallbackColorUniformRef.current = uniform(new Color(fallbackColor))
    } else {
      ;(fallbackColorUniformRef.current.value as Color).set(fallbackColor)
    }
        stack.delete(nodeId)
        return { node: fallbackColorUniformRef.current, kind: 'color' }
      }
      if (node.type === 'basicMaterial') {
        const pin = outputPin ?? 'baseColor'
        if (pin === 'baseColor') {
          const input = getInput('baseColor')
          const texInput = getInput('baseColorTexture')
          const base =
            input?.kind === 'color'
              ? input
              : input?.kind === 'number'
                ? { node: color(input.node), kind: 'color' as const }
                : null
          const tex =
            texInput?.kind === 'color'
              ? texInput
              : texInput?.kind === 'number'
                ? { node: color(texInput.node), kind: 'color' as const }
                : null
          if (base && tex) {
            stack.delete(nodeId)
            return { node: base.node.mul(tex.node), kind: 'color' }
          }
          if (base) {
            stack.delete(nodeId)
            return base
          }
          if (tex) {
            stack.delete(nodeId)
            return tex
          }
        }
        if (!fallbackColorUniformRef.current) {
          fallbackColorUniformRef.current = uniform(new Color(fallbackColor))
        } else {
          ;(fallbackColorUniformRef.current.value as Color).set(fallbackColor)
        }
        stack.delete(nodeId)
        return { node: fallbackColorUniformRef.current, kind: 'color' }
      }
      if (node.type === 'output') {
        const input = getInput('baseColor')
        stack.delete(nodeId)
        return input ?? { node: color(FALLBACK_COLOR), kind: 'color' }
      }

      stack.delete(nodeId)
      return { node: float(0), kind: 'number' }
    }

    const outputNode = graphNodes.find((node) => node.type === 'output')
    const vertexOutputNode = graphNodes.find((node) => node.type === 'vertexOutput')
    const materialKind = getMaterialKindFromOutput(outputNode, nodeMap, connectionMap)
    const hasOutputConnection =
      !!outputNode && connectionMap.has(`${outputNode.id}:baseColor`)
    const getOutputInput = (pin: OutputPin) => {
      const connection = getOutputConnection(connectionMap, outputNode, pin)
      if (!connection) return null
      return resolveNode(connection.from.nodeId, new Set(), connection.from.pin)
    }

    const baseColorNode =
      outputNode && hasOutputConnection
        ? getOutputInput('baseColor')
        : null
    const rootNode = baseColorNode
      ? baseColorNode
      : { node: color(FALLBACK_COLOR), kind: 'color' as const }

    const evalNode = (
      nodeId: string,
      stack: Set<string>,
      outputPin?: string,
    ): { kind: 'color' | 'number' | 'vec2' | 'vec3' | 'vec4'; value: Color | number } => {
      if (stack.has(nodeId)) {
        return { kind: 'number', value: 0 }
      }
      stack.add(nodeId)
      const node = nodeMap.get(nodeId)
      if (!node) {
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'number') {
        const value = parseNumber(node.value)
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (node.type === 'time') {
        stack.delete(nodeId)
        return { kind: 'number', value: timeUniformRef.current.value }
      }
      const attributeKind = getAttributeKind(node.type)
      if (attributeKind) {
        stack.delete(nodeId)
        return { kind: attributeKind, value: new Color(0, 0, 0) }
      }
      if (node.type === 'color') {
        const value = typeof node.value === 'string' ? node.value : DEFAULT_COLOR
        stack.delete(nodeId)
        return { kind: 'color', value: new Color(value) }
      }
      if (node.type === 'texture') {
        stack.delete(nodeId)
        return { kind: 'color', value: new Color(FALLBACK_COLOR) }
      }
      if (node.type === 'gltfTexture') {
        stack.delete(nodeId)
        return { kind: 'color', value: new Color(FALLBACK_COLOR) }
      }
      const getInput = (pin: string) => {
        const connection = connectionMap.get(`${node.id}:${pin}`)
        if (!connection) return null
        return evalNode(connection.from.nodeId, stack, connection.from.pin)
      }
      if (node.type === 'functionInput' || node.type === 'functionOutput') {
        const input = getInput('value')
        stack.delete(nodeId)
        return input ?? { kind: 'number', value: 0 }
      }
      const toColorValue = (entry: ReturnType<typeof getInput> | null) => {
        if (!entry) return new Color(0, 0, 0)
        if (
          entry.kind === 'color' ||
          entry.kind === 'vec2' ||
          entry.kind === 'vec3' ||
          entry.kind === 'vec4'
        ) {
          return (entry.value as Color).clone()
        }
        return new Color(entry.value as number, entry.value as number, entry.value as number)
      }
      const toLuminanceValue = (colorValue: Color) =>
        colorValue.r * 0.2126 + colorValue.g * 0.7152 + colorValue.b * 0.0722
      if (node.type === 'add' || node.type === 'multiply') {
        const left =
          getInput('a') ??
          ({
            kind: 'number' as const,
            value: node.type === 'add' ? 0 : 1,
          })
        const right =
          getInput('b') ??
          ({
            kind: 'number' as const,
            value: node.type === 'add' ? 0 : 1,
          })
        const combined = combineTypes(left.kind, right.kind)
        if (combined === 'number') {
          const value =
            node.type === 'add'
              ? (left.value as number) + (right.value as number)
              : (left.value as number) * (right.value as number)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const toColorValue = (entry: typeof left) =>
            entry.kind === 'color' ||
            entry.kind === 'vec2' ||
            entry.kind === 'vec3' ||
            entry.kind === 'vec4'
              ? (entry.value as Color).clone()
              : new Color(
                  entry.value as number,
                  entry.value as number,
                  entry.value as number,
                )
          const l = toColorValue(left)
          const r = toColorValue(right)
          const value = node.type === 'add' ? l.add(r) : l.multiply(r)
          stack.delete(nodeId)
          return { kind: combined, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'sine') {
        const input = getInput('value')
        if (!input || input.kind !== 'number') {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const value = Math.sin(input.value as number)
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (node.type === 'normalize') {
        const input = getInput('value')
        if (!input || !isVectorKind(input.kind)) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const colorValue = toColorValue(input)
        const lengthValue = Math.sqrt(
          colorValue.r * colorValue.r +
            colorValue.g * colorValue.g +
            colorValue.b * colorValue.b,
        )
        const scale = lengthValue > 0 ? 1 / lengthValue : 0
        const value = new Color(
          colorValue.r * scale,
          colorValue.g * scale,
          colorValue.b * scale,
        )
        stack.delete(nodeId)
        return { kind: input.kind, value }
      }
      if (node.type === 'length') {
        const input = getInput('value')
        if (!input || !isVectorKind(input.kind)) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const colorValue = toColorValue(input)
        const value = Math.sqrt(
          colorValue.r * colorValue.r +
            colorValue.g * colorValue.g +
            colorValue.b * colorValue.b,
        )
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (node.type === 'dot') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (!inputA || !inputB || !vecA || !vecB || vecA !== vecB) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const a = toColorValue(inputA)
        const b = toColorValue(inputB)
        const value = a.r * b.r + a.g * b.g + a.b * b.b
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (node.type === 'cross') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (!inputA || !inputB || vecA !== 'vec3' || vecB !== 'vec3') {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const a = toColorValue(inputA)
        const b = toColorValue(inputB)
        const value = new Color(
          a.g * b.b - a.b * b.g,
          a.b * b.r - a.r * b.b,
          a.r * b.g - a.g * b.r,
        )
        stack.delete(nodeId)
        return { kind: inputA.kind === 'color' || inputB.kind === 'color' ? 'color' : 'vec3', value }
      }
      if (node.type === 'checker') {
        const input = getInput('coord')
        const coord =
          input?.kind === 'vec2'
            ? (input.value as Color)
            : input?.kind === 'number'
              ? new Color(
                  input.value as number,
                  input.value as number,
                  0,
                )
              : new Color(0, 0, 0)
        const cx = Math.floor(coord.r * 2)
        const cy = Math.floor(coord.g * 2)
        const value = Math.sign((cx + cy) % 2)
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (node.type === 'dFdx' || node.type === 'dFdy' || node.type === 'fwidth') {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const value = input.kind === 'number' ? (input.value as number) : 0
        stack.delete(nodeId)
        return { kind: input.kind, value }
      }
      if (node.type === 'mxNoiseFloat') {
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'mxNoiseVec3') {
        stack.delete(nodeId)
        return { kind: 'vec3', value: new Color(0, 0, 0) }
      }
      if (node.type === 'mxNoiseVec4') {
        stack.delete(nodeId)
        return { kind: 'vec4', value: new Color(0, 0, 0) }
      }
      if (node.type === 'mxFractalNoiseFloat') {
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'mxFractalNoiseVec2') {
        stack.delete(nodeId)
        return { kind: 'vec2', value: new Color(0, 0, 0) }
      }
      if (node.type === 'mxFractalNoiseVec3') {
        stack.delete(nodeId)
        return { kind: 'vec3', value: new Color(0, 0, 0) }
      }
      if (node.type === 'mxFractalNoiseVec4') {
        stack.delete(nodeId)
        return { kind: 'vec4', value: new Color(0, 0, 0) }
      }
      if (node.type === 'mxWorleyNoiseFloat') {
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'mxWorleyNoiseVec2') {
        stack.delete(nodeId)
        return { kind: 'vec2', value: new Color(0, 0, 0) }
      }
      if (node.type === 'mxWorleyNoiseVec3') {
        stack.delete(nodeId)
        return { kind: 'vec3', value: new Color(0, 0, 0) }
      }
      if (node.type === 'rotateUV') {
        const uvInput = getInput('uv')
        const rotationInput = getInput('rotation')
        const centerInput = getInput('center')
        const uvValue =
          uvInput?.kind === 'vec2'
            ? (uvInput.value as Color)
            : uvInput?.kind === 'number'
              ? new Color(
                  uvInput.value as number,
                  uvInput.value as number,
                  0,
                )
              : new Color(0, 0, 0)
        const centerValue =
          centerInput?.kind === 'vec2'
            ? (centerInput.value as Color)
            : centerInput?.kind === 'number'
              ? new Color(
                  centerInput.value as number,
                  centerInput.value as number,
                  0,
                )
              : new Color(0.5, 0.5, 0)
        const rotation = rotationInput?.kind === 'number' ? (rotationInput.value as number) : 0
        const dx = uvValue.r - centerValue.r
        const dy = uvValue.g - centerValue.g
        const cosValue = Math.cos(rotation)
        const sinValue = Math.sin(rotation)
        const value = new Color(
          centerValue.r + dx * cosValue - dy * sinValue,
          centerValue.g + dx * sinValue + dy * cosValue,
          0,
        )
        stack.delete(nodeId)
        return { kind: 'vec2', value }
      }
      if (node.type === 'scaleUV') {
        const uvInput = getInput('uv')
        const scaleInput = getInput('scale')
        const uvValue =
          uvInput?.kind === 'vec2'
            ? (uvInput.value as Color)
            : uvInput?.kind === 'number'
              ? new Color(
                  uvInput.value as number,
                  uvInput.value as number,
                  0,
                )
              : new Color(0, 0, 0)
        const scaleValue =
          scaleInput?.kind === 'vec2'
            ? (scaleInput.value as Color)
            : scaleInput?.kind === 'number'
              ? new Color(
                  scaleInput.value as number,
                  scaleInput.value as number,
                  0,
                )
              : new Color(1, 1, 0)
        const value = new Color(
          uvValue.r * scaleValue.r,
          uvValue.g * scaleValue.g,
          0,
        )
        stack.delete(nodeId)
        return { kind: 'vec2', value }
      }
      if (node.type === 'offsetUV') {
        const uvInput = getInput('uv')
        const offsetInput = getInput('offset')
        const uvValue =
          uvInput?.kind === 'vec2'
            ? (uvInput.value as Color)
            : uvInput?.kind === 'number'
              ? new Color(
                  uvInput.value as number,
                  uvInput.value as number,
                  0,
                )
              : new Color(0, 0, 0)
        const offsetValue =
          offsetInput?.kind === 'vec2'
            ? (offsetInput.value as Color)
            : offsetInput?.kind === 'number'
              ? new Color(
                  offsetInput.value as number,
                  offsetInput.value as number,
                  0,
                )
              : new Color(0, 0, 0)
        const value = new Color(
          uvValue.r + offsetValue.r,
          uvValue.g + offsetValue.g,
          0,
        )
        stack.delete(nodeId)
        return { kind: 'vec2', value }
      }
      if (node.type === 'spherizeUV') {
        const uvInput = getInput('uv')
        const uvValue =
          uvInput?.kind === 'vec2'
            ? (uvInput.value as Color)
            : uvInput?.kind === 'number'
              ? new Color(
                  uvInput.value as number,
                  uvInput.value as number,
                  0,
                )
              : new Color(0, 0, 0)
        stack.delete(nodeId)
        return { kind: 'vec2', value: uvValue }
      }
      if (node.type === 'spritesheetUV') {
        const uvInput = getInput('uv')
        const uvValue =
          uvInput?.kind === 'vec2'
            ? (uvInput.value as Color)
            : uvInput?.kind === 'number'
              ? new Color(
                  uvInput.value as number,
                  uvInput.value as number,
                  0,
                )
              : new Color(0, 0, 0)
        stack.delete(nodeId)
        return { kind: 'vec2', value: uvValue }
      }
      if (node.type === 'distance') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'number') {
          const a = inputA?.kind === 'number' ? (inputA.value as number) : 0
          const b = inputB?.kind === 'number' ? (inputB.value as number) : 0
          const value = Math.abs(a - b)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const a = toColorValue(inputA)
          const b = toColorValue(inputB)
          const dx = a.r - b.r
          const dy = a.g - b.g
          const dz = a.b - b.b
          const value = Math.sqrt(dx * dx + dy * dy + dz * dz)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'reflect' || node.type === 'refract' || node.type === 'faceforward') {
        const toVec3Value = (entry: ReturnType<typeof getInput> | null) => {
          if (!entry) return new Color(0, 0, 0)
          if (
            entry.kind === 'color' ||
            entry.kind === 'vec2' ||
            entry.kind === 'vec3' ||
            entry.kind === 'vec4'
          ) {
            return (entry.value as Color).clone()
          }
          const value = entry.value as number
          return new Color(value, value, value)
        }
        if (node.type === 'reflect') {
          const incident = toVec3Value(getInput('incident'))
          const normal = toVec3Value(getInput('normal'))
          const dotValue =
            incident.r * normal.r + incident.g * normal.g + incident.b * normal.b
          const scale = 2 * dotValue
          const value = new Color(
            incident.r - scale * normal.r,
            incident.g - scale * normal.g,
            incident.b - scale * normal.b,
          )
          const kind =
            getInput('incident')?.kind === 'color' || getInput('normal')?.kind === 'color'
              ? 'color'
              : 'vec3'
          stack.delete(nodeId)
          return { kind, value }
        }
        if (node.type === 'refract') {
          const incident = toVec3Value(getInput('incident'))
          const normal = toVec3Value(getInput('normal'))
          const etaInput = getInput('eta')
          const eta = etaInput?.kind === 'number' ? (etaInput.value as number) : 1
          const dotValue =
            incident.r * normal.r + incident.g * normal.g + incident.b * normal.b
          const k = 1 - eta * eta * (1 - dotValue * dotValue)
          const value =
            k < 0
              ? new Color(0, 0, 0)
              : new Color(
                  eta * incident.r - (eta * dotValue + Math.sqrt(k)) * normal.r,
                  eta * incident.g - (eta * dotValue + Math.sqrt(k)) * normal.g,
                  eta * incident.b - (eta * dotValue + Math.sqrt(k)) * normal.b,
                )
          const kind =
            getInput('incident')?.kind === 'color' || getInput('normal')?.kind === 'color'
              ? 'color'
              : 'vec3'
          stack.delete(nodeId)
          return { kind, value }
        }
        const n = toVec3Value(getInput('n'))
        const i = toVec3Value(getInput('i'))
        const nref = toVec3Value(getInput('nref'))
        const dotValue = nref.r * i.r + nref.g * i.g + nref.b * i.b
        const value = dotValue < 0 ? n : new Color(-n.r, -n.g, -n.b)
        const kind =
          getInput('n')?.kind === 'color' ||
          getInput('i')?.kind === 'color' ||
          getInput('nref')?.kind === 'color'
            ? 'color'
            : 'vec3'
        stack.delete(nodeId)
        return { kind, value }
      }
      if (node.type === 'triNoise3D') {
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'smoothstep') {
        const edge0Input = getInput('edge0')
        const edge1Input = getInput('edge1')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edge0Input?.kind ?? 'number',
          edge1Input?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        const smoothstepScalar = (edge0: number, edge1: number, x: number) => {
          const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
          return t * t * (3 - 2 * t)
        }
        if (kind === 'number') {
          const edge0 = edge0Input?.kind === 'number' ? (edge0Input.value as number) : 0
          const edge1 = edge1Input?.kind === 'number' ? (edge1Input.value as number) : 1
          const x = xInput?.kind === 'number' ? (xInput.value as number) : 0
          const value = smoothstepScalar(edge0, edge1, x)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const edge0 = toColorValue(edge0Input)
          const edge1 = toColorValue(edge1Input)
          const x = toColorValue(xInput)
          const value = new Color(
            smoothstepScalar(edge0.r, edge1.r, x.r),
            smoothstepScalar(edge0.g, edge1.g, x.g),
            smoothstepScalar(edge0.b, edge1.b, x.b),
          )
          stack.delete(nodeId)
          return { kind, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'pow') {
        const baseInput = getInput('base')
        const expInput = getInput('exp')
        const kind = resolveVectorOutputKind([
          baseInput?.kind ?? 'number',
          expInput?.kind ?? 'number',
        ])
        if (kind === 'number') {
          const baseValue = baseInput?.kind === 'number' ? (baseInput.value as number) : 0
          const expValue = expInput?.kind === 'number' ? (expInput.value as number) : 1
          const value = Math.pow(baseValue, expValue)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const baseValue = toColorValue(baseInput)
          const expValue = toColorValue(expInput)
          const value = new Color(
            Math.pow(baseValue.r, expValue.r),
            Math.pow(baseValue.g, expValue.g),
            Math.pow(baseValue.b, expValue.b),
          )
          stack.delete(nodeId)
          return { kind, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'vec2') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const valueX = inputX?.kind === 'number' ? (inputX.value as number) : 0
        const valueY = inputY?.kind === 'number' ? (inputY.value as number) : 0
        const value = new Color(valueX, valueY, 0)
        stack.delete(nodeId)
        return { kind: 'vec2', value }
      }
      if (node.type === 'vec3') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const inputZ = getInput('z')
        const valueX = inputX?.kind === 'number' ? (inputX.value as number) : 0
        const valueY = inputY?.kind === 'number' ? (inputY.value as number) : 0
        const valueZ = inputZ?.kind === 'number' ? (inputZ.value as number) : 0
        const value = new Color(valueX, valueY, valueZ)
        stack.delete(nodeId)
        return { kind: 'vec3', value }
      }
      if (node.type === 'scale') {
        const inputValue = getInput('value')
        const inputScale = getInput('scale')
        const value =
          inputValue?.kind === 'vec3'
            ? (inputValue.value as Color).clone()
            : inputValue?.kind === 'number'
              ? new Color(
                  inputValue.value as number,
                  inputValue.value as number,
                  inputValue.value as number,
                )
              : new Color(0, 0, 0)
        const scale =
          inputScale?.kind === 'vec3'
            ? (inputScale.value as Color)
            : inputScale?.kind === 'number'
              ? new Color(
                  inputScale.value as number,
                  inputScale.value as number,
                  inputScale.value as number,
                )
              : new Color(1, 1, 1)
        value.multiply(scale)
        stack.delete(nodeId)
        return { kind: 'vec3', value }
      }
      if (node.type === 'rotate') {
        const inputValue = getInput('value')
        const inputRotation = getInput('rotation')
        const value =
          inputValue?.kind === 'vec3'
            ? (inputValue.value as Color)
            : inputValue?.kind === 'number'
              ? new Color(
                  inputValue.value as number,
                  inputValue.value as number,
                  inputValue.value as number,
                )
              : new Color(0, 0, 0)
        const rotation =
          inputRotation?.kind === 'vec3'
            ? (inputRotation.value as Color)
            : inputRotation?.kind === 'number'
              ? new Color(
                  inputRotation.value as number,
                  inputRotation.value as number,
                  inputRotation.value as number,
                )
              : new Color(0, 0, 0)
        const cx = Math.cos(rotation.r)
        const sx = Math.sin(rotation.r)
        const cy = Math.cos(rotation.g)
        const sy = Math.sin(rotation.g)
        const cz = Math.cos(rotation.b)
        const sz = Math.sin(rotation.b)
        const x1 = value.r
        const y1 = value.g * cx - value.b * sx
        const z1 = value.g * sx + value.b * cx
        const x2 = x1 * cy + z1 * sy
        const y2 = y1
        const z2 = z1 * cy - x1 * sy
        const x3 = x2 * cz - y2 * sz
        const y3 = x2 * sz + y2 * cz
        const z3 = z2
        const rotated = new Color(x3, y3, z3)
        stack.delete(nodeId)
        return { kind: 'vec3', value: rotated }
      }
      if (node.type === 'vec4') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const inputZ = getInput('z')
        const valueX = inputX?.kind === 'number' ? (inputX.value as number) : 0
        const valueY = inputY?.kind === 'number' ? (inputY.value as number) : 0
        const valueZ = inputZ?.kind === 'number' ? (inputZ.value as number) : 0
        const value = new Color(valueX, valueY, valueZ)
        stack.delete(nodeId)
        return { kind: 'vec4', value }
      }
      if (node.type === 'splitVec2') {
        const input = getInput('value')
        if (!input) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const colorValue =
          input.kind === 'vec2'
            ? (input.value as Color)
            : new Color(input.value as number, input.value as number, 0)
        const channel = outputPin === 'y' ? colorValue.g : colorValue.r
        stack.delete(nodeId)
        return { kind: 'number', value: channel }
      }
      if (node.type === 'splitVec3') {
        const input = getInput('value')
        if (!input) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const colorValue =
          input.kind === 'vec3'
            ? (input.value as Color)
            : new Color(input.value as number, input.value as number, input.value as number)
        const channel =
          outputPin === 'y' ? colorValue.g : outputPin === 'z' ? colorValue.b : colorValue.r
        stack.delete(nodeId)
        return { kind: 'number', value: channel }
      }
      if (node.type === 'splitVec4') {
        const input = getInput('value')
        if (!input) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const colorValue =
          input.kind === 'vec4'
            ? (input.value as Color)
            : new Color(input.value as number, input.value as number, input.value as number)
        const channel =
          outputPin === 'y'
            ? colorValue.g
            : outputPin === 'z'
              ? colorValue.b
              : outputPin === 'w'
                ? 1
                : colorValue.r
        stack.delete(nodeId)
        return { kind: 'number', value: channel }
      }
      if (node.type === 'cosine') {
        const input = getInput('value')
        if (!input || input.kind !== 'number') {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const value = Math.cos(input.value as number)
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (
        node.type === 'tan' ||
        node.type === 'asin' ||
        node.type === 'acos' ||
        node.type === 'atan' ||
        node.type === 'radians' ||
        node.type === 'degrees'
      ) {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const op = (value: number) => {
          if (node.type === 'tan') return Math.tan(value)
          if (node.type === 'asin') return Math.asin(value)
          if (node.type === 'acos') return Math.acos(value)
          if (node.type === 'atan') return Math.atan(value)
          if (node.type === 'radians') return (value * Math.PI) / 180
          return (value * 180) / Math.PI
        }
        if (input.kind === 'number') {
          const value = op(input.value as number)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        const source = toColorValue(input)
        const value = new Color(op(source.r), op(source.g), op(source.b))
        stack.delete(nodeId)
        return { kind: input.kind, value }
      }
      if (node.type === 'atan2') {
        const inputY = getInput('y')
        const inputX = getInput('x')
        const combined = resolveVectorOutputKind([
          inputY?.kind ?? 'number',
          inputX?.kind ?? 'number',
        ])
        if (combined === 'number') {
          const y = inputY?.kind === 'number' ? (inputY.value as number) : 0
          const x = inputX?.kind === 'number' ? (inputX.value as number) : 0
          const value = Math.atan2(y, x)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const y = toColorValue(inputY)
          const x = toColorValue(inputX)
          const value = new Color(
            Math.atan2(y.r, x.r),
            Math.atan2(y.g, x.g),
            Math.atan2(y.b, x.b),
          )
          stack.delete(nodeId)
          return { kind: combined, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'abs') {
        const input = getInput('value')
        if (!input || input.kind !== 'number') {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const value = Math.abs(input.value as number)
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (node.type === 'clamp') {
        const valueInput = getInput('value')
        if (!valueInput || valueInput.kind !== 'number') {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const minInput = getInput('min')
        const maxInput = getInput('max')
        const minValue = minInput?.kind === 'number' ? (minInput.value as number) : 0
        const maxValue = maxInput?.kind === 'number' ? (maxInput.value as number) : 1
        const value = Math.min(
          Math.max(valueInput.value as number, minValue),
          maxValue,
        )
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (node.type === 'min' || node.type === 'max' || node.type === 'mod') {
        const inputA =
          getInput('a') ??
          ({
            kind: 'number' as const,
            value: 0,
          })
        const inputB =
          getInput('b') ??
          ({
            kind: 'number' as const,
            value: 0,
          })
        const combined = combineTypes(inputA.kind, inputB.kind)
        const modScalar = (x: number, y: number) => x - y * Math.floor(x / y)
        if (combined === 'number') {
          const a = inputA.value as number
          const b = inputB.value as number
          const value =
            node.type === 'min'
              ? Math.min(a, b)
              : node.type === 'max'
                ? Math.max(a, b)
                : modScalar(a, b)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const a = toColorValue(inputA)
          const b = toColorValue(inputB)
          const value =
            node.type === 'min'
              ? new Color(
                  Math.min(a.r, b.r),
                  Math.min(a.g, b.g),
                  Math.min(a.b, b.b),
                )
              : node.type === 'max'
                ? new Color(
                    Math.max(a.r, b.r),
                    Math.max(a.g, b.g),
                    Math.max(a.b, b.b),
                  )
                : new Color(
                    modScalar(a.r, b.r),
                    modScalar(a.g, b.g),
                    modScalar(a.b, b.b),
                  )
          stack.delete(nodeId)
          return { kind: combined, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'step') {
        const edgeInput = getInput('edge')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edgeInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        const stepScalar = (edge: number, x: number) => (x < edge ? 0 : 1)
        if (kind === 'number') {
          const edge = edgeInput?.kind === 'number' ? (edgeInput.value as number) : 0
          const x = xInput?.kind === 'number' ? (xInput.value as number) : 0
          const value = stepScalar(edge, x)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const edge = toColorValue(edgeInput)
          const x = toColorValue(xInput)
          const value = new Color(
            stepScalar(edge.r, x.r),
            stepScalar(edge.g, x.g),
            stepScalar(edge.b, x.b),
          )
          stack.delete(nodeId)
          return { kind, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'stepElement') {
        const xInput = getInput('x')
        const edgeInput = getInput('edge')
        const kind = resolveVectorOutputKind([
          edgeInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        const stepScalar = (edge: number, x: number) => (x < edge ? 0 : 1)
        if (kind === 'number') {
          const edge = edgeInput?.kind === 'number' ? (edgeInput.value as number) : 0
          const x = xInput?.kind === 'number' ? (xInput.value as number) : 0
          const value = stepScalar(edge, x)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const edge = toColorValue(edgeInput)
          const x = toColorValue(xInput)
          const value = new Color(
            stepScalar(edge.r, x.r),
            stepScalar(edge.g, x.g),
            stepScalar(edge.b, x.b),
          )
          stack.delete(nodeId)
          return { kind, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (
        node.type === 'lessThan' ||
        node.type === 'lessThanEqual' ||
        node.type === 'greaterThan' ||
        node.type === 'greaterThanEqual' ||
        node.type === 'equal' ||
        node.type === 'notEqual'
      ) {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        const compareScalar = (a: number, b: number) => {
          if (node.type === 'lessThan') return a < b ? 1 : 0
          if (node.type === 'lessThanEqual') return a <= b ? 1 : 0
          if (node.type === 'greaterThan') return a > b ? 1 : 0
          if (node.type === 'greaterThanEqual') return a >= b ? 1 : 0
          if (node.type === 'equal') return a === b ? 1 : 0
          return a !== b ? 1 : 0
        }
        if (kind === 'number') {
          const a = inputA?.kind === 'number' ? (inputA.value as number) : 0
          const b = inputB?.kind === 'number' ? (inputB.value as number) : 0
          const value = compareScalar(a, b)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const a = toColorValue(inputA)
          const b = toColorValue(inputB)
          const value = new Color(
            compareScalar(a.r, b.r),
            compareScalar(a.g, b.g),
            compareScalar(a.b, b.b),
          )
          stack.delete(nodeId)
          return { kind, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'and' || node.type === 'or') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        const maskScalar = (value: number) => (value >= 0.5 ? 1 : 0)
        if (kind === 'number') {
          const a = inputA?.kind === 'number' ? (inputA.value as number) : 0
          const b = inputB?.kind === 'number' ? (inputB.value as number) : 0
          const maskA = maskScalar(a)
          const maskB = maskScalar(b)
          const value = node.type === 'and' ? maskA * maskB : Math.max(maskA, maskB)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const a = toColorValue(inputA)
          const b = toColorValue(inputB)
          const value = new Color(
            node.type === 'and'
              ? maskScalar(a.r) * maskScalar(b.r)
              : Math.max(maskScalar(a.r), maskScalar(b.r)),
            node.type === 'and'
              ? maskScalar(a.g) * maskScalar(b.g)
              : Math.max(maskScalar(a.g), maskScalar(b.g)),
            node.type === 'and'
              ? maskScalar(a.b) * maskScalar(b.b)
              : Math.max(maskScalar(a.b), maskScalar(b.b)),
          )
          stack.delete(nodeId)
          return { kind, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'not') {
        const input = getInput('value')
        const kind = input?.kind ?? 'number'
        const maskScalar = (value: number) => (value >= 0.5 ? 1 : 0)
        if (kind === 'number') {
          const value = input?.kind === 'number' ? (input.value as number) : 0
          const masked = maskScalar(value)
          stack.delete(nodeId)
          return { kind: 'number', value: 1 - masked }
        }
        if (isVectorKind(kind)) {
          const colorValue = toColorValue(input)
          const value = new Color(
            1 - maskScalar(colorValue.r),
            1 - maskScalar(colorValue.g),
            1 - maskScalar(colorValue.b),
          )
          stack.delete(nodeId)
          return { kind, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (
        node.type === 'fract' ||
        node.type === 'floor' ||
        node.type === 'ceil' ||
        node.type === 'round' ||
        node.type === 'trunc' ||
        node.type === 'exp' ||
        node.type === 'exp2' ||
        node.type === 'log' ||
        node.type === 'log2' ||
        node.type === 'sign' ||
        node.type === 'oneMinus' ||
        node.type === 'negate' ||
        node.type === 'pow2' ||
        node.type === 'pow3' ||
        node.type === 'pow4' ||
        node.type === 'sqrt' ||
        node.type === 'saturate'
      ) {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          stack.delete(nodeId)
          return { kind: 'number', value: 0 }
        }
        const op = (value: number) => {
          if (node.type === 'fract') return value - Math.floor(value)
          if (node.type === 'floor') return Math.floor(value)
          if (node.type === 'ceil') return Math.ceil(value)
          if (node.type === 'round') return Math.round(value)
          if (node.type === 'trunc') return Math.trunc(value)
          if (node.type === 'exp') return Math.exp(value)
          if (node.type === 'exp2') return Math.pow(2, value)
          if (node.type === 'log') return Math.log(value)
          if (node.type === 'log2') return Math.log2(value)
          if (node.type === 'sign') return Math.sign(value)
          if (node.type === 'oneMinus') return 1 - value
          if (node.type === 'pow2') return value * value
          if (node.type === 'pow3') return value * value * value
          if (node.type === 'pow4') return value * value * value * value
          if (node.type === 'sqrt') return Math.sqrt(value)
          if (node.type === 'saturate') return Math.min(1, Math.max(0, value))
          return -value
        }
        if (input.kind === 'number') {
          const value = op(input.value as number)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        const source = toColorValue(input)
        const value = new Color(op(source.r), op(source.g), op(source.b))
        stack.delete(nodeId)
        return { kind: input.kind, value }
      }
      if (node.type === 'mix') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputT = getInput('t')
        const valueT = inputT?.kind === 'number' ? (inputT.value as number) : 0.5
        const typeA = inputA?.kind ?? 'number'
        const typeB = inputB?.kind ?? 'number'
        const combined = combineTypes(typeA, typeB)
        if (combined === 'number') {
          const valueA = inputA?.kind === 'number' ? (inputA.value as number) : 0
          const valueB = inputB?.kind === 'number' ? (inputB.value as number) : 1
          const value = valueA * (1 - valueT) + valueB * valueT
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const toColorValue = (entry: typeof inputA) =>
            entry?.kind === 'color' || entry?.kind === 'vec2' || entry?.kind === 'vec3' || entry?.kind === 'vec4'
              ? (entry.value as Color)
              : new Color(0, 0, 0)
          const colorA = inputA?.kind === 'number'
            ? new Color(inputA.value as number, inputA.value as number, inputA.value as number)
            : toColorValue(inputA)
          const colorB = inputB?.kind === 'number'
            ? new Color(inputB.value as number, inputB.value as number, inputB.value as number)
            : toColorValue(inputB)
          const value = colorA.clone().lerp(colorB, valueT)
          stack.delete(nodeId)
          return { kind: combined as typeof combined, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'ifElse') {
        const inputCond = getInput('cond')
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputThreshold = getInput('threshold')
        const combined = combineTypes(inputA?.kind ?? 'number', inputB?.kind ?? 'number')
        const threshold =
          inputThreshold?.kind === 'number' ? (inputThreshold.value as number) : 0.5
        if (combined === 'number') {
          const condValue =
            inputCond?.kind === 'number'
              ? (inputCond.value as number)
              : inputCond && isVectorKind(inputCond.kind)
                ? Math.sqrt(
                    (inputCond.value as Color).r ** 2 +
                      (inputCond.value as Color).g ** 2 +
                    (inputCond.value as Color).b ** 2,
                  )
                : 0
          const useA = condValue >= threshold
          const value = useA
            ? inputA?.kind === 'number'
              ? (inputA.value as number)
              : 1
            : inputB?.kind === 'number'
              ? (inputB.value as number)
              : 0
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (combined === 'color' || combined === 'vec2' || combined === 'vec3' || combined === 'vec4') {
          const toColorValue = (entry: typeof inputA, fallback: number) =>
            entry?.kind === 'color' || entry?.kind === 'vec2' || entry?.kind === 'vec3' || entry?.kind === 'vec4'
              ? (entry.value as Color)
              : new Color(fallback, fallback, fallback)
          const condValue =
            inputCond?.kind === 'number'
              ? new Color(inputCond.value as number, inputCond.value as number, inputCond.value as number)
              : inputCond && isVectorKind(inputCond.kind)
                ? (inputCond.value as Color)
                : new Color(0, 0, 0)
          const valueA = toColorValue(inputA, 1)
          const valueB = toColorValue(inputB, 0)
          const mixValue = new Color(
            condValue.r >= threshold ? valueA.r : valueB.r,
            condValue.g >= threshold ? valueA.g : valueB.g,
            condValue.b >= threshold ? valueA.b : valueB.b,
          )
          stack.delete(nodeId)
          return { kind: combined as typeof combined, value: mixValue }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'smoothstepElement') {
        const lowInput = getInput('low')
        const highInput = getInput('high')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          lowInput?.kind ?? 'number',
          highInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        const smoothstepScalar = (edge0: number, edge1: number, x: number) => {
          const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
          return t * t * (3 - 2 * t)
        }
        if (kind === 'number') {
          const edge0 = lowInput?.kind === 'number' ? (lowInput.value as number) : 0
          const edge1 = highInput?.kind === 'number' ? (highInput.value as number) : 1
          const x = xInput?.kind === 'number' ? (xInput.value as number) : 0
          const value = smoothstepScalar(edge0, edge1, x)
          stack.delete(nodeId)
          return { kind: 'number', value }
        }
        if (kind === 'color' || kind === 'vec2' || kind === 'vec3' || kind === 'vec4') {
          const edge0 = toColorValue(lowInput)
          const edge1 = toColorValue(highInput)
          const x = toColorValue(xInput)
          const value = new Color(
            smoothstepScalar(edge0.r, edge1.r, x.r),
            smoothstepScalar(edge0.g, edge1.g, x.g),
            smoothstepScalar(edge0.b, edge1.b, x.b),
          )
          stack.delete(nodeId)
          return { kind, value }
        }
        stack.delete(nodeId)
        return { kind: 'number', value: 0 }
      }
      if (node.type === 'remap' || node.type === 'remapClamp') {
        const input = getInput('value')
        const inLowInput = getInput('inLow')
        const inHighInput = getInput('inHigh')
        const outLowInput = getInput('outLow')
        const outHighInput = getInput('outHigh')
        const clamp = node.type === 'remapClamp'
        const remapScalar = (
          value: number,
          inLow: number,
          inHigh: number,
          outLow: number,
          outHigh: number,
        ) => {
          const denom = inHigh - inLow
          const t = denom !== 0 ? (value - inLow) / denom : 0
          const clamped = clamp ? Math.min(1, Math.max(0, t)) : t
          return outLow + clamped * (outHigh - outLow)
        }
        if (!input || input.kind === 'number') {
          const value = input?.kind === 'number' ? (input.value as number) : 0
          const inLow = inLowInput?.kind === 'number' ? (inLowInput.value as number) : 0
          const inHigh = inHighInput?.kind === 'number' ? (inHighInput.value as number) : 1
          const outLow = outLowInput?.kind === 'number' ? (outLowInput.value as number) : 0
          const outHigh =
            outHighInput?.kind === 'number' ? (outHighInput.value as number) : 1
          const mapped = remapScalar(value, inLow, inHigh, outLow, outHigh)
          stack.delete(nodeId)
          return { kind: 'number', value: mapped }
        }
        const source = toColorValue(input)
        const inLow = inLowInput ? toColorValue(inLowInput) : new Color(0, 0, 0)
        const inHigh = inHighInput ? toColorValue(inHighInput) : new Color(1, 1, 1)
        const outLow = outLowInput ? toColorValue(outLowInput) : new Color(0, 0, 0)
        const outHigh = outHighInput ? toColorValue(outHighInput) : new Color(1, 1, 1)
        const value = new Color(
          remapScalar(source.r, inLow.r, inHigh.r, outLow.r, outHigh.r),
          remapScalar(source.g, inLow.g, inHigh.g, outLow.g, outHigh.g),
          remapScalar(source.b, inLow.b, inHigh.b, outLow.b, outHigh.b),
        )
        stack.delete(nodeId)
        return { kind: input.kind, value }
      }
      if (node.type === 'luminance') {
        const input = getInput('value')
        const colorValue = toColorValue(input)
        const value = toLuminanceValue(colorValue)
        stack.delete(nodeId)
        return { kind: 'number', value }
      }
      if (
        node.type === 'grayscale' ||
        node.type === 'saturation' ||
        node.type === 'posterize' ||
        node.type === 'sRGBTransferEOTF' ||
        node.type === 'sRGBTransferOETF' ||
        node.type === 'linearToneMapping' ||
        node.type === 'reinhardToneMapping' ||
        node.type === 'cineonToneMapping' ||
        node.type === 'acesFilmicToneMapping' ||
        node.type === 'agxToneMapping' ||
        node.type === 'neutralToneMapping'
      ) {
        const input = getInput('value')
        const colorValue = toColorValue(input)
        let value = colorValue.clone()
        if (node.type === 'grayscale') {
          const luma = toLuminanceValue(colorValue)
          value = new Color(luma, luma, luma)
        } else if (node.type === 'saturation') {
          const amountInput = getInput('amount')
          const amount = amountInput?.kind === 'number' ? (amountInput.value as number) : 1
          const luma = toLuminanceValue(colorValue)
          const base = new Color(luma, luma, luma)
          value = base.lerp(colorValue, amount)
        } else if (node.type === 'posterize') {
          const stepsInput = getInput('steps')
          const steps = stepsInput?.kind === 'number' ? (stepsInput.value as number) : 4
          const safeSteps = steps > 0 ? steps : 1
          value = new Color(
            Math.floor(colorValue.r * safeSteps) / safeSteps,
            Math.floor(colorValue.g * safeSteps) / safeSteps,
            Math.floor(colorValue.b * safeSteps) / safeSteps,
          )
        } else if (node.type === 'sRGBTransferEOTF' || node.type === 'sRGBTransferOETF') {
          const toLinear = (channel: number) =>
            channel <= 0.04045
              ? channel / 12.92
              : Math.pow((channel + 0.055) / 1.055, 2.4)
          const toSRGB = (channel: number) =>
            channel <= 0.0031308
              ? channel * 12.92
              : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055
          const map = node.type === 'sRGBTransferEOTF' ? toLinear : toSRGB
          value = new Color(map(colorValue.r), map(colorValue.g), map(colorValue.b))
        }
        const kind = input?.kind === 'vec3' ? 'vec3' : 'color'
        stack.delete(nodeId)
        return { kind, value }
      }
      if (node.type === 'material' || node.type === 'physicalMaterial') {
        const pin = outputPin ?? 'baseColor'
        const input = getInput(pin)
        if (pin === 'baseColor') {
          const base =
            input?.kind === 'number'
              ? {
                  kind: 'color' as const,
                  value: new Color(
                    input.value as number,
                    input.value as number,
                    input.value as number,
                  ),
                }
              : input
          const texInput = getInput('baseColorTexture')
          const tex =
            texInput?.kind === 'number'
              ? {
                  kind: 'color' as const,
                  value: new Color(
                    texInput.value as number,
                    texInput.value as number,
                    texInput.value as number,
                  ),
                }
              : texInput
          if (base && tex) {
            stack.delete(nodeId)
            return { kind: 'color', value: (base.value as Color).clone().multiply(tex.value as Color) }
          }
          if (base) {
            stack.delete(nodeId)
            return base
          }
          if (tex) {
            stack.delete(nodeId)
            return tex
          }
        }
        if (input) {
          stack.delete(nodeId)
          return input
        }
        stack.delete(nodeId)
        if (pin === 'roughness' || pin === 'metalness') {
          return { kind: 'number', value: pin === 'roughness' ? 0.7 : 0.1 }
        }
        return { kind: 'color', value: new Color(FALLBACK_COLOR) }
      }
      if (node.type === 'basicMaterial') {
        const pin = outputPin ?? 'baseColor'
        if (pin === 'baseColor') {
          const input = getInput('baseColor')
          const texInput = getInput('baseColorTexture')
          const base =
            input?.kind === 'number'
              ? {
                  kind: 'color' as const,
                  value: new Color(
                    input.value as number,
                    input.value as number,
                    input.value as number,
                  ),
                }
              : input
          const tex =
            texInput?.kind === 'number'
              ? {
                  kind: 'color' as const,
                  value: new Color(
                    texInput.value as number,
                    texInput.value as number,
                    texInput.value as number,
                  ),
                }
              : texInput
          if (base && tex) {
            stack.delete(nodeId)
            return {
              kind: 'color',
              value: (base.value as Color).clone().multiply(tex.value as Color),
            }
          }
          if (base) {
            stack.delete(nodeId)
            return base
          }
          if (tex) {
            stack.delete(nodeId)
            return tex
          }
        }
        stack.delete(nodeId)
        return { kind: 'color', value: new Color(FALLBACK_COLOR) }
      }
      if (node.type === 'output') {
        const input = getInput('baseColor')
        stack.delete(nodeId)
        return input ?? { kind: 'color', value: new Color(FALLBACK_COLOR) }
      }
      stack.delete(nodeId)
      return { kind: 'number', value: 0 }
    }

    const evalColor = () => {
      if (!outputNode || !hasOutputConnection) {
        return new Color(FALLBACK_COLOR)
      }
      const result = evalNode(outputNode.id, new Set())
      if (result.kind === 'color') {
        return result.value as Color
      }
      return new Color(
        result.value as number,
        result.value as number,
        result.value as number,
      )
    }

    const evalNumber = (pin: 'roughness' | 'metalness', fallback: number) => {
      if (!outputNode) return fallback
      const connection = connectionMap.get(`${outputNode.id}:${pin}`)
      if (!connection) return fallback
      const result = evalNode(connection.from.nodeId, new Set(), connection.from.pin)
      if (result.kind === 'number') {
        return result.value as number
      }
      if (result.kind === 'color') {
        const colorValue = result.value as Color
        return (colorValue.r + colorValue.g + colorValue.b) / 3
      }
      return fallback
    }

    return {
      root: rootNode.node,
      evalColor,
      evalRoughness: () => evalNumber('roughness', 0.7),
      evalMetalness: () => evalNumber('metalness', 0.1),
      evalMap: () => {
        if (!outputNode) return null
        const connection = connectionMap.get(`${outputNode.id}:baseColor`)
        if (!connection) return null
        const sourceNode = nodeMap.get(connection.from.nodeId)
        if (!sourceNode) return null
        if (sourceNode.type === 'texture') {
          return textureMapRef.current[sourceNode.id]?.texture ?? null
        }
        if (sourceNode.type === 'material' || sourceNode.type === 'basicMaterial') {
          const texConn = connectionMap.get(`${sourceNode.id}:baseColorTexture`)
          if (!texConn) return null
          const texNode = nodeMap.get(texConn.from.nodeId)
          if (texNode?.type === 'texture') {
            return textureMapRef.current[texNode.id]?.texture ?? null
          }
        }
        return null
      },
      roughnessNode: getOutputInput('roughness'),
      metalnessNode: getOutputInput('metalness'),
      vertexPositionNode: vertexOutputNode
        ? resolveNode(
            connectionMap.get(`${vertexOutputNode.id}:position`)?.from.nodeId ?? '',
            new Set(),
            connectionMap.get(`${vertexOutputNode.id}:position`)?.from.pin,
          )
        : null,
      materialKind,
      resolveNode,
    }
  }

  const buildCodePreview = () => {
    const expanded = expandFunctions(nodes, connections, functions)
    const nodeMap = buildNodeMap(expanded.nodes)
    const connectionMap = buildConnectionMap(expanded.connections)
    const graphNodes = expanded.nodes

    const outputNode = graphNodes.find((node) => node.type === 'output')
    const vertexOutputNode = graphNodes.find((node) => node.type === 'vertexOutput')
    if (!outputNode) {
      return '// Output node not found'
    }

    const baseColorConn = getOutputConnection(connectionMap, outputNode, 'baseColor')
    if (!baseColorConn) {
      return '// Output.baseColor not connected'
    }

    const materialKind = getMaterialKindFromOutput(outputNode, nodeMap, connectionMap)
    const materialClass =
      materialKind === 'basic'
        ? 'MeshBasicNodeMaterial'
        : materialKind === 'physical'
          ? 'MeshPhysicalNodeMaterial'
          : 'MeshStandardNodeMaterial'

    const decls: string[] = [`const material = new ${materialClass}();`]
    const cache = new Map<string, ExprResult>()
    let varIndex = 1

    const nextVar = (prefix: string) => `${prefix}_${varIndex++}`
    const asColor = (expr: string, kind: 'color' | 'number') =>
      kind === 'color' ? expr : `color(${expr}, ${expr}, ${expr})`
    const asVec2 = (expr: string, kind: 'vec2' | 'number') =>
      kind === 'vec2' ? expr : `vec2(${expr}, ${expr})`
    const asVec3 = (expr: string, kind: 'vec3' | 'number') =>
      kind === 'vec3' ? expr : `vec3(${expr}, ${expr}, ${expr})`
    const asVec4 = (expr: string, kind: 'vec4' | 'number') =>
      kind === 'vec4' ? expr : `vec4(${expr}, ${expr}, ${expr}, ${expr})`
    const toVec2Expr = (input: ExprResult | null) => {
      if (!input) return 'vec2(0.0, 0.0)'
      if (input.kind === 'vec2') return input.expr
      if (input.kind === 'vec3' || input.kind === 'color') {
        return `vec2(${input.expr}.x, ${input.expr}.y)`
      }
      if (input.kind === 'vec4') {
        return `vec2(${input.expr}.x, ${input.expr}.y)`
      }
      return asVec2(input.expr, 'number')
    }
    const toVec3Expr = (input: ExprResult | null) => {
      if (!input) return 'vec3(0.0, 0.0, 0.0)'
      if (input.kind === 'vec3' || input.kind === 'color') return input.expr
      if (input.kind === 'vec2') {
        return `vec3(${input.expr}.x, ${input.expr}.y, 0.0)`
      }
      if (input.kind === 'vec4') {
        return `vec3(${input.expr}.x, ${input.expr}.y, ${input.expr}.z)`
      }
      return asVec3(input.expr, 'number')
    }
    const toVec4Expr = (input: ExprResult | null) => {
      if (!input) return 'vec4(0.0, 0.0, 0.0, 1.0)'
      if (input.kind === 'vec4') return input.expr
      if (input.kind === 'vec3' || input.kind === 'color') {
        return `vec4(${input.expr}.x, ${input.expr}.y, ${input.expr}.z, 1.0)`
      }
      if (input.kind === 'vec2') {
        return `vec4(${input.expr}.x, ${input.expr}.y, 0.0, 1.0)`
      }
      return asVec4(input.expr, 'number')
    }
    const resolveExpr = (nodeId: string, outputPin?: string): ExprResult => {
      const key = `${nodeId}:${outputPin ?? ''}`
      const cached = cache.get(key)
      if (cached) return cached

      const node = nodeMap.get(nodeId)
      if (!node) {
        const fallback = { expr: 'float(0.0)', kind: 'number' as const }
        cache.set(key, fallback)
        return fallback
      }

      if (node.type === 'number') {
        const value = parseNumber(node.value)
        const name = nextVar('num')
        decls.push(`const ${name} = uniform(${value.toFixed(3)});`)
        appendNumberUniformUpdate(decls, name, node)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'color') {
        const value = typeof node.value === 'string' ? node.value : DEFAULT_COLOR
        const name = nextVar('col')
        decls.push(`const ${name} = uniform(new Color('${value}'));`)
        const out = { expr: name, kind: 'color' as const }
        cache.set(key, out)
        return out
      }

      const attributeExpr = getAttributeExpr(node.type)
      if (attributeExpr) {
        cache.set(key, attributeExpr)
        return attributeExpr
      }

      if (node.type === 'time') {
        const name = nextVar('time')
        decls.push(`const ${name} = uniform(0.0);`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'texture') {
        const name = nextVar('tex')
        decls.push(
          `const ${name} = texture(uniformTexture(textureFromNode('${node.id}')), uv());`,
        )
        const out = { expr: name, kind: 'color' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'gltfTexture') {
        const name = nextVar('tex')
        const texId = getGltfTextureId(node.id)
        decls.push(
          `const ${name} = texture(uniformTexture(textureFromNode('${texId}')), uv());`,
        )
        const out = { expr: name, kind: 'color' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'gltfMaterial') {
        const pin = outputPin ?? 'baseColor'
        const entry = gltfMapRef.current[node.id]
        const materialCount = entry?.materials?.length ?? 0
        const material = materialCount
          ? (entry?.materials?.[
              getMaterialIndex(node, materialCount)
            ] as GltfMaterial | undefined)
          : undefined
        const makeColor = (value?: Color, fallback = FALLBACK_COLOR_HEX) => {
          const name = nextVar('col')
          const hex = value ? `#${value.getHexString()}` : fallback
          decls.push(`const ${name} = color('${hex}');`)
          return { expr: name, kind: 'color' as const }
        }
        const makeNumber = (value: number) => {
          const name = nextVar('num')
          decls.push(`const ${name} = float(${value.toFixed(3)});`)
          return { expr: name, kind: 'number' as const }
        }
        const makeVec2 = (value?: Vector2) => {
          const name = nextVar('vec')
          const x = value?.x ?? 1
          const y = value?.y ?? 1
          decls.push(`const ${name} = vec2(${x.toFixed(3)}, ${y.toFixed(3)});`)
          return { expr: name, kind: 'vec2' as const }
        }
        const makeTexture = (tex: Texture | null | undefined, key: string) => {
          if (!tex) return null
          const name = nextVar('tex')
          const id = getGltfMaterialTextureId(node.id, key)
          decls.push(`const ${name} = texture(uniformTexture(textureFromNode('${id}')), uv());`)
          return { expr: name, kind: 'color' as const }
        }
        if (!material) {
          if (pin === 'normalScale') {
            const out = makeVec2()
            cache.set(key, out)
            return out
          }
          if (
            pin === 'roughness' ||
            pin === 'metalness' ||
            pin === 'emissiveIntensity' ||
            pin === 'clearcoat' ||
            pin === 'clearcoatRoughness' ||
            pin === 'sheenRoughness' ||
            pin === 'iridescence' ||
            pin === 'iridescenceIOR' ||
            pin === 'iridescenceThickness' ||
            pin === 'ior' ||
            pin === 'transmission'
          ) {
            const out = makeNumber(0)
            cache.set(key, out)
            return out
          }
          const out = makeColor()
          cache.set(key, out)
          return out
        }
        const pbr = material.pbrMetallicRoughness
        if (pin === 'baseColor') {
          const out = makeColor(pbr?.baseColorFactor ? new Color().fromArray(pbr.baseColorFactor) : undefined)
          cache.set(key, out)
          return out
        }
        if (pin === 'baseColorTexture') {
          const out =
            makeTexture(pbr?.baseColorTexture?.texture, 'baseColorTexture') ??
            makeColor(new Color(1, 1, 1))
          cache.set(key, out)
          return out
        }
        if (pin === 'roughness') {
          const out = makeNumber(pbr?.roughnessFactor ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'metalness') {
          const out = makeNumber(pbr?.metallicFactor ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'roughnessMap') {
          const out = makeTexture(pbr?.metallicRoughnessTexture?.texture, 'roughnessMap')
          if (out) {
            cache.set(key, out)
            return out
          }
          const fallback = makeColor(new Color(1, 1, 1))
          cache.set(key, fallback)
          return fallback
        }
        if (pin === 'metalnessMap') {
          const out = makeTexture(pbr?.metallicRoughnessTexture?.texture, 'metalnessMap')
          if (out) {
            cache.set(key, out)
            return out
          }
          const fallback = makeColor(new Color(1, 1, 1))
          cache.set(key, fallback)
          return fallback
        }
        if (pin === 'emissive') {
          const emissiveFactor = material.emissiveFactor
          const out = makeColor(
            emissiveFactor ? new Color().fromArray(emissiveFactor) : new Color(0, 0, 0),
          )
          cache.set(key, out)
          return out
        }
        if (pin === 'emissiveMap') {
          const out =
            makeTexture(material.emissiveTexture?.texture, 'emissiveMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'emissiveIntensity') {
          const emissiveStrength = material.emissiveStrength
          const out = makeNumber(emissiveStrength ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'normalMap') {
          const out =
            makeTexture(material.normalTexture?.texture, 'normalMap') ??
            makeColor(new Color(0.5, 0.5, 1))
          cache.set(key, out)
          return out
        }
        if (pin === 'normalScale') {
          const out = makeVec2(material.normalTexture?.scale)
          cache.set(key, out)
          return out
        }
        if (pin === 'occlusionMap') {
          const out =
            makeTexture(material.occlusionTexture?.texture, 'occlusionMap') ??
            makeColor(new Color(1, 1, 1))
          cache.set(key, out)
          return out
        }
        if (pin === 'aoMapIntensity') {
          const out = makeNumber(material.occlusionTexture?.strength ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'clearcoat') {
          const out = makeNumber(material.clearcoatFactor ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'clearcoatMap') {
          const out =
            makeTexture(material.clearcoatTexture?.texture, 'clearcoatMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'clearcoatRoughness') {
          const out = makeNumber(material.clearcoatRoughnessFactor ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'clearcoatRoughnessMap') {
          const out =
            makeTexture(material.clearcoatRoughnessTexture?.texture, 'clearcoatRoughnessMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'clearcoatNormalMap') {
          const out =
            makeTexture(material.clearcoatNormalTexture?.texture, 'clearcoatNormalMap') ??
            makeColor(new Color(0.5, 0.5, 1))
          cache.set(key, out)
          return out
        }
        if (pin === 'sheen') {
          const sheenFactor = material.sheenColorFactor
          const out = makeColor(
            sheenFactor ? new Color().fromArray(sheenFactor) : new Color(0, 0, 0),
          )
          cache.set(key, out)
          return out
        }
        if (pin === 'sheenColorMap') {
          const out =
            makeTexture(material.sheenColorTexture?.texture, 'sheenColorMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'sheenRoughness') {
          const out = makeNumber(material.sheenRoughnessFactor ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'sheenRoughnessMap') {
          const out =
            makeTexture(material.sheenRoughnessTexture?.texture, 'sheenRoughnessMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'iridescence') {
          const out = makeNumber(material.iridescenceFactor ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'iridescenceMap') {
          const out =
            makeTexture(material.iridescenceTexture?.texture, 'iridescenceMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'iridescenceIOR') {
          const out = makeNumber(material.iridescenceIOR ?? 1.3)
          cache.set(key, out)
          return out
        }
        if (pin === 'iridescenceThickness') {
          const range = material.iridescenceThicknessRange
          const out = makeNumber(range ? range[1] : 400)
          cache.set(key, out)
          return out
        }
        if (pin === 'iridescenceThicknessMap') {
          const out =
            makeTexture(material.iridescenceThicknessTexture?.texture, 'iridescenceThicknessMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'ior') {
          const out = makeNumber(material.ior ?? 1.5)
          cache.set(key, out)
          return out
        }
        if (pin === 'transmission') {
          const out = makeNumber(material.transmissionFactor ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'transmissionMap') {
          const out =
            makeTexture(material.transmissionTexture?.texture, 'transmissionMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'thickness') {
          const out = makeNumber(material.thicknessFactor ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'thicknessMap') {
          const out =
            makeTexture(material.thicknessTexture?.texture, 'thicknessMap') ??
            makeColor(new Color(0, 0, 0))
          cache.set(key, out)
          return out
        }
        if (pin === 'attenuationColor') {
          const attenuationColor = material.attenuationColor
          const out = makeColor(
            attenuationColor ? new Color().fromArray(attenuationColor) : new Color(1, 1, 1),
          )
          cache.set(key, out)
          return out
        }
        if (pin === 'attenuationDistance') {
          const out = makeNumber(material.attenuationDistance ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'specularColor') {
          const specularColor = material.specularColorFactor
          const out = makeColor(
            specularColor ? new Color().fromArray(specularColor) : new Color(1, 1, 1),
          )
          cache.set(key, out)
          return out
        }
        if (pin === 'specularColorMap') {
          const out =
            makeTexture(material.specularColorTexture?.texture, 'specularColorMap') ??
            makeColor(new Color(1, 1, 1))
          cache.set(key, out)
          return out
        }
        if (pin === 'specularIntensity') {
          const out = makeNumber(material.specularFactor ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'specularIntensityMap') {
          const out =
            makeTexture(material.specularTexture?.texture, 'specularIntensityMap') ??
            makeColor(new Color(1, 1, 1))
          cache.set(key, out)
          return out
        }
        const out = makeColor()
        cache.set(key, out)
        return out
      }

      if (node.type === 'gltfTexture') {
        const name = nextVar('tex')
        const texId = getGltfTextureId(node.id)
        decls.push(
          `const ${name} = texture(uniformTexture(textureFromNode('${texId}')), uv());`,
        )
        const out = { expr: name, kind: 'color' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'gltfTexture') {
        const name = nextVar('tex')
        const texId = getGltfTextureId(node.id)
        decls.push(
          `const ${name} = texture(uniformTexture(textureFromNode('${texId}')), uv());`,
        )
        const out = { expr: name, kind: 'color' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'gltfMaterial') {
        const pin = outputPin ?? 'baseColor'
        const entry = gltfMapRef.current[node.id]
        const materialCount = entry?.materials?.length ?? 0
        const material = materialCount
          ? (entry?.materials?.[
              getMaterialIndex(node, materialCount)
            ] as GltfMaterial | undefined)
          : undefined
        const makeColor = (value?: Color, fallback = FALLBACK_COLOR_HEX) => {
          const name = nextVar('col')
          const hex = value ? `#${value.getHexString()}` : fallback
          decls.push(`const ${name} = color('${hex}');`)
          return { expr: name, kind: 'color' as const }
        }
        const makeNumber = (value: number) => {
          const name = nextVar('num')
          decls.push(`const ${name} = float(${value.toFixed(3)});`)
          return { expr: name, kind: 'number' as const }
        }
        const makeVec2 = (value?: Vector2) => {
          const name = nextVar('vec')
          const x = value?.x ?? 1
          const y = value?.y ?? 1
          decls.push(`const ${name} = vec2(${x.toFixed(3)}, ${y.toFixed(3)});`)
          return { expr: name, kind: 'vec2' as const }
        }
        const makeTexture = (tex: Texture | null | undefined, key: string) => {
          if (!tex) return null
          const name = nextVar('tex')
          const id = getGltfMaterialTextureId(node.id, key)
          decls.push(`const ${name} = texture(uniformTexture(textureFromNode('${id}')), uv());`)
          return { expr: name, kind: 'color' as const }
        }
        if (!material) {
          if (pin === 'normalScale') {
            const out = makeVec2()
            cache.set(key, out)
            return out
          }
          if (
            pin === 'roughness' ||
            pin === 'metalness' ||
            pin === 'emissiveIntensity' ||
            pin === 'aoMapIntensity' ||
            pin === 'envMapIntensity' ||
            pin === 'opacity' ||
            pin === 'alphaTest' ||
            pin === 'alphaHash'
          ) {
            const out = makeNumber(0)
            cache.set(key, out)
            return out
          }
          const out = makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'baseColor') {
          const base = makeColor(material.color, DEFAULT_COLOR)
          const tex = makeTexture(material.map, 'map')
          if (tex) {
            const name = nextVar('col')
            decls.push(`const ${name} = (${base.expr} * ${tex.expr});`)
            const out = { expr: name, kind: 'color' as const }
            cache.set(key, out)
            return out
          }
          cache.set(key, base)
          return base
        }
        if (pin === 'baseColorTexture') {
          const out = makeTexture(material.map, 'map') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'roughness') {
          const out = makeNumber(material.roughness ?? 0.7)
          cache.set(key, out)
          return out
        }
        if (pin === 'metalness') {
          const out = makeNumber(material.metalness ?? 0.1)
          cache.set(key, out)
          return out
        }
        if (pin === 'roughnessMap') {
          const out = makeTexture(material.roughnessMap, 'roughnessMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'metalnessMap') {
          const out = makeTexture(material.metalnessMap, 'metalnessMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'emissive') {
          const out = makeColor(material.emissive, '#000000')
          cache.set(key, out)
          return out
        }
        if (pin === 'emissiveMap') {
          const out = makeTexture(material.emissiveMap, 'emissiveMap') ?? makeColor(undefined, '#000000')
          cache.set(key, out)
          return out
        }
        if (pin === 'emissiveIntensity') {
          const out = makeNumber(material.emissiveIntensity ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'normalMap') {
          const out = makeTexture(material.normalMap, 'normalMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'normalScale') {
          const out = makeVec2(material.normalScale ?? undefined)
          cache.set(key, out)
          return out
        }
        if (pin === 'aoMap') {
          const out = makeTexture(material.aoMap, 'aoMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'aoMapIntensity') {
          const out = makeNumber(material.aoMapIntensity ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'envMap') {
          const out = makeTexture(material.envMap, 'envMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'envMapIntensity') {
          const out = makeNumber(material.envMapIntensity ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'opacity') {
          const out = makeNumber(material.opacity ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'alphaTest') {
          const out = makeNumber(material.alphaTest ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'alphaHash') {
          const out = makeNumber(material.alphaHash ? 1 : 0)
          cache.set(key, out)
          return out
        }
        const out = makeColor(undefined, FALLBACK_COLOR_HEX)
        cache.set(key, out)
        return out
      }

      if (node.type === 'gltfMaterial') {
        const pin = outputPin ?? 'baseColor'
        const entry = gltfMapRef.current[node.id]
        const materialCount = entry?.materials?.length ?? 0
        const material = materialCount
          ? (entry?.materials?.[
              getMaterialIndex(node, materialCount)
            ] as GltfMaterial | undefined)
          : undefined
        const makeColor = (value?: Color, fallback = FALLBACK_COLOR_HEX) => {
          const name = nextVar('col')
          const hex = value ? `#${value.getHexString()}` : fallback
          decls.push(`const ${name} = uniform(new Color('${hex}'));`)
          return { expr: name, kind: 'color' as const }
        }
        const makeNumber = (value: number) => {
          const name = nextVar('num')
          decls.push(`const ${name} = uniform(${value.toFixed(3)});`)
          return { expr: name, kind: 'number' as const }
        }
        const makeVec2 = (value?: Vector2) => {
          const name = nextVar('vec')
          const x = value?.x ?? 1
          const y = value?.y ?? 1
          decls.push(`const ${name} = vec2(${x.toFixed(3)}, ${y.toFixed(3)});`)
          return { expr: name, kind: 'vec2' as const }
        }
        const makeTexture = (tex: Texture | null | undefined, key: string) => {
          if (!tex) return null
          const name = nextVar('tex')
          const id = getGltfMaterialTextureId(node.id, key)
          decls.push(`const ${name} = texture(uniformTexture(textureFromNode('${id}')), uv());`)
          return { expr: name, kind: 'color' as const }
        }
        if (!material) {
          if (pin === 'normalScale') {
            const out = makeVec2()
            cache.set(key, out)
            return out
          }
          if (
            pin === 'roughness' ||
            pin === 'metalness' ||
            pin === 'emissiveIntensity' ||
            pin === 'aoMapIntensity' ||
            pin === 'envMapIntensity' ||
            pin === 'opacity' ||
            pin === 'alphaTest' ||
            pin === 'alphaHash'
          ) {
            const out = makeNumber(0)
            cache.set(key, out)
            return out
          }
          const out = makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'baseColor') {
          const base = makeColor(material.color, DEFAULT_COLOR)
          const tex = makeTexture(material.map, 'map')
          if (tex) {
            const name = nextVar('col')
            decls.push(`const ${name} = (${base.expr} * ${tex.expr});`)
            const out = { expr: name, kind: 'color' as const }
            cache.set(key, out)
            return out
          }
          cache.set(key, base)
          return base
        }
        if (pin === 'baseColorTexture') {
          const out = makeTexture(material.map, 'map') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'roughness') {
          const out = makeNumber(material.roughness ?? 0.7)
          cache.set(key, out)
          return out
        }
        if (pin === 'metalness') {
          const out = makeNumber(material.metalness ?? 0.1)
          cache.set(key, out)
          return out
        }
        if (pin === 'roughnessMap') {
          const out = makeTexture(material.roughnessMap, 'roughnessMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'metalnessMap') {
          const out = makeTexture(material.metalnessMap, 'metalnessMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'emissive') {
          const out = makeColor(material.emissive, '#000000')
          cache.set(key, out)
          return out
        }
        if (pin === 'emissiveMap') {
          const out = makeTexture(material.emissiveMap, 'emissiveMap') ?? makeColor(undefined, '#000000')
          cache.set(key, out)
          return out
        }
        if (pin === 'emissiveIntensity') {
          const out = makeNumber(material.emissiveIntensity ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'normalMap') {
          const out = makeTexture(material.normalMap, 'normalMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'normalScale') {
          const out = makeVec2(material.normalScale ?? undefined)
          cache.set(key, out)
          return out
        }
        if (pin === 'aoMap') {
          const out = makeTexture(material.aoMap, 'aoMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'aoMapIntensity') {
          const out = makeNumber(material.aoMapIntensity ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'envMap') {
          const out = makeTexture(material.envMap, 'envMap') ?? makeColor(undefined, FALLBACK_COLOR_HEX)
          cache.set(key, out)
          return out
        }
        if (pin === 'envMapIntensity') {
          const out = makeNumber(material.envMapIntensity ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'opacity') {
          const out = makeNumber(material.opacity ?? 1)
          cache.set(key, out)
          return out
        }
        if (pin === 'alphaTest') {
          const out = makeNumber(material.alphaTest ?? 0)
          cache.set(key, out)
          return out
        }
        if (pin === 'alphaHash') {
          const out = makeNumber(material.alphaHash ? 1 : 0)
          cache.set(key, out)
          return out
        }
        const out = makeColor(undefined, FALLBACK_COLOR_HEX)
        cache.set(key, out)
        return out
      }

      const getInput = (pin: string) => {
        const connection = connectionMap.get(`${node.id}:${pin}`)
        if (!connection) return null
        return resolveExpr(connection.from.nodeId, connection.from.pin)
      }
      if (node.type === 'functionInput' || node.type === 'functionOutput') {
        const input = getInput('value')
        const out = input ?? { expr: 'float(0.0)', kind: 'number' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'add' || node.type === 'multiply') {
        const left =
          getInput('a') ??
          {
            expr: node.type === 'add' ? 'float(0.0)' : 'float(1.0)',
            kind: 'number' as const,
          }
        const right =
          getInput('b') ??
          {
            expr: node.type === 'add' ? 'float(0.0)' : 'float(1.0)',
            kind: 'number' as const,
          }
        const op = node.type === 'add' ? '+' : '*'
        const combined = combineTypes(left.kind, right.kind)
        if (combined === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let expr = `(${left.expr} ${op} ${right.expr})`
        const kind: typeof combined = combined
        if (combined === 'color') {
          expr = `(${asColor(left.expr, left.kind === 'number' ? 'number' : 'color')} ${op} ${asColor(
            right.expr,
            right.kind === 'number' ? 'number' : 'color',
          )})`
        } else if (combined === 'vec2') {
          expr = `(${asVec2(left.expr, left.kind === 'number' ? 'number' : 'vec2')} ${op} ${asVec2(
            right.expr,
            right.kind === 'number' ? 'number' : 'vec2',
          )})`
        } else if (combined === 'vec3') {
          expr = `(${asVec3(left.expr, left.kind === 'number' ? 'number' : 'vec3')} ${op} ${asVec3(
            right.expr,
            right.kind === 'number' ? 'number' : 'vec3',
          )})`
        } else if (combined === 'vec4') {
          expr = `(${asVec4(left.expr, left.kind === 'number' ? 'number' : 'vec4')} ${op} ${asVec4(
            right.expr,
            right.kind === 'number' ? 'number' : 'vec4',
          )})`
        }
        const name = nextVar(kind === 'number' ? 'num' : 'col')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'sine') {
        const input = getInput('value')
        const valueExpr = input?.kind === 'number' ? input.expr : 'float(0.0)'
        const expr = `sin(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'normalize') {
        const input = getInput('value')
        if (!input || !isVectorKind(input.kind)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `normalize(${input.expr})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind as 'color' | 'vec2' | 'vec3' | 'vec4' }
        cache.set(key, out)
        return out
      }
      if (node.type === 'dot') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (!inputA || !inputB || !vecA || !vecB || vecA !== vecB) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `dot(${inputA.expr}, ${inputB.expr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'cross') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (!inputA || !inputB || vecA !== 'vec3' || vecB !== 'vec3') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `cross(${inputA.expr}, ${inputB.expr})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const kind: 'color' | 'vec3' =
          inputA.kind === 'color' || inputB.kind === 'color' ? 'color' : 'vec3'
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'checker') {
        const input = getInput('coord')
        const expr =
          input?.kind === 'vec2'
            ? input.expr
            : input?.kind === 'number'
              ? asVec2(input.expr, 'number')
              : 'uv()'
        const name = nextVar('num')
        decls.push(`const ${name} = checker(${expr});`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'dFdx' || node.type === 'dFdy' || node.type === 'fwidth') {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn = node.type === 'dFdx' ? 'dFdx' : node.type === 'dFdy' ? 'dFdy' : 'fwidth'
        const name = nextVar(input.kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${input.expr});`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'distance') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprA = inputA?.expr ?? 'float(0.0)'
        let exprB = inputB?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `distance(${exprA}, ${exprB})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'reflect' || node.type === 'refract' || node.type === 'faceforward') {
        const toVec3Expr = (
          input: {
            expr: string
            kind: 'color' | 'number' | 'vec2' | 'vec3' | 'vec4' | 'mat2' | 'mat3' | 'mat4'
          } | null,
        ) => {
          if (!input) return 'vec3(0.0, 0.0, 0.0)'
          if (input.kind === 'vec3' || input.kind === 'color') return input.expr
          if (input.kind === 'number') return asVec3(input.expr, 'number')
          return 'vec3(0.0, 0.0, 0.0)'
        }
        if (node.type === 'reflect') {
          const incident = getInput('incident')
          const normal = getInput('normal')
          const expr = `reflect(${toVec3Expr(incident)}, ${toVec3Expr(normal)})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const kind: 'color' | 'vec3' =
            incident?.kind === 'color' || normal?.kind === 'color' ? 'color' : 'vec3'
          const out = { expr: name, kind }
          cache.set(key, out)
          return out
        }
        if (node.type === 'refract') {
          const incident = getInput('incident')
          const normal = getInput('normal')
          const eta = getInput('eta')
          const etaExpr = eta?.kind === 'number' ? eta.expr : 'float(1.0)'
          const expr = `refract(${toVec3Expr(incident)}, ${toVec3Expr(normal)}, ${etaExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const kind: 'color' | 'vec3' =
            incident?.kind === 'color' || normal?.kind === 'color' ? 'color' : 'vec3'
          const out = { expr: name, kind }
          cache.set(key, out)
          return out
        }
        const n = getInput('n')
        const i = getInput('i')
        const nref = getInput('nref')
        const expr = `faceforward(${toVec3Expr(n)}, ${toVec3Expr(i)}, ${toVec3Expr(nref)})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const kind: 'color' | 'vec3' =
          n?.kind === 'color' || i?.kind === 'color' || nref?.kind === 'color'
            ? 'color'
            : 'vec3'
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'triNoise3D') {
        const inputPosition = getInput('position')
        const inputSpeed = getInput('speed')
        const inputTime = getInput('time')
        const positionExpr =
          inputPosition?.kind === 'vec3'
            ? inputPosition.expr
            : inputPosition?.kind === 'number'
              ? asVec3(inputPosition.expr, 'number')
              : 'positionLocal'
        const speedExpr = inputSpeed?.kind === 'number' ? inputSpeed.expr : 'float(1.0)'
        const timeExpr = inputTime?.kind === 'number' ? inputTime.expr : 'timeUniform'
        const name = nextVar('num')
        decls.push(`const ${name} = triNoise3D(${positionExpr}, ${speedExpr}, ${timeExpr});`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mxNoiseFloat' || node.type === 'mxNoiseVec3' || node.type === 'mxNoiseVec4') {
        const texcoord = getInput('texcoord')
        const amplitude = getInput('amplitude')
        const pivot = getInput('pivot')
        const coordExpr = texcoord
          ? texcoord.kind === 'vec3' || texcoord.kind === 'color' || texcoord.kind === 'vec4'
            ? toVec3Expr(texcoord)
            : toVec2Expr(texcoord)
          : 'uv()'
        const amplitudeExpr = amplitude?.kind === 'number' ? amplitude.expr : 'float(1.0)'
        const pivotExpr = pivot?.kind === 'number' ? pivot.expr : 'float(0.0)'
        const fn =
          node.type === 'mxNoiseFloat'
            ? 'mx_noise_float'
            : node.type === 'mxNoiseVec3'
              ? 'mx_noise_vec3'
              : 'mx_noise_vec4'
        const name = nextVar(node.type === 'mxNoiseFloat' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${coordExpr}, ${amplitudeExpr}, ${pivotExpr});`)
        const kind =
          node.type === 'mxNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxNoiseVec3'
              ? ('vec3' as const)
              : ('vec4' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'mxFractalNoiseFloat' ||
        node.type === 'mxFractalNoiseVec2' ||
        node.type === 'mxFractalNoiseVec3' ||
        node.type === 'mxFractalNoiseVec4'
      ) {
        const position = getInput('position')
        const octaves = getInput('octaves')
        const lacunarity = getInput('lacunarity')
        const diminish = getInput('diminish')
        const amplitude = getInput('amplitude')
        const positionExpr = position
          ? position.kind === 'vec3' || position.kind === 'color' || position.kind === 'vec4'
            ? toVec3Expr(position)
            : toVec2Expr(position)
          : 'uv()'
        const octavesExpr = octaves?.kind === 'number' ? octaves.expr : 'float(3.0)'
        const lacunarityExpr = lacunarity?.kind === 'number' ? lacunarity.expr : 'float(2.0)'
        const diminishExpr = diminish?.kind === 'number' ? diminish.expr : 'float(0.5)'
        const amplitudeExpr = amplitude?.kind === 'number' ? amplitude.expr : 'float(1.0)'
        const fn =
          node.type === 'mxFractalNoiseFloat'
            ? 'mx_fractal_noise_float'
            : node.type === 'mxFractalNoiseVec2'
              ? 'mx_fractal_noise_vec2'
              : node.type === 'mxFractalNoiseVec3'
                ? 'mx_fractal_noise_vec3'
                : 'mx_fractal_noise_vec4'
        const name = nextVar(
          node.type === 'mxFractalNoiseFloat' ? 'num' : 'vec',
        )
        decls.push(
          `const ${name} = ${fn}(${positionExpr}, ${octavesExpr}, ${lacunarityExpr}, ${diminishExpr}, ${amplitudeExpr});`,
        )
        const kind =
          node.type === 'mxFractalNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxFractalNoiseVec2'
              ? ('vec2' as const)
              : node.type === 'mxFractalNoiseVec3'
                ? ('vec3' as const)
                : ('vec4' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'mxWorleyNoiseFloat' ||
        node.type === 'mxWorleyNoiseVec2' ||
        node.type === 'mxWorleyNoiseVec3'
      ) {
        const texcoord = getInput('texcoord')
        const jitter = getInput('jitter')
        const coordExpr = texcoord
          ? texcoord.kind === 'vec3' || texcoord.kind === 'color' || texcoord.kind === 'vec4'
            ? toVec3Expr(texcoord)
            : toVec2Expr(texcoord)
          : 'uv()'
        const jitterExpr = jitter?.kind === 'number' ? jitter.expr : 'float(1.0)'
        const fn =
          node.type === 'mxWorleyNoiseFloat'
            ? 'mx_worley_noise_float'
            : node.type === 'mxWorleyNoiseVec2'
              ? 'mx_worley_noise_vec2'
              : 'mx_worley_noise_vec3'
        const name = nextVar(node.type === 'mxWorleyNoiseFloat' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${coordExpr}, ${jitterExpr});`)
        const kind =
          node.type === 'mxWorleyNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxWorleyNoiseVec2'
              ? ('vec2' as const)
              : ('vec3' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'rotateUV') {
        const uvInput = getInput('uv')
        const rotation = getInput('rotation')
        const center = getInput('center')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const rotationExpr = rotation?.kind === 'number' ? rotation.expr : 'float(0.0)'
        const centerExpr = center ? toVec2Expr(center) : 'vec2(0.5, 0.5)'
        const name = nextVar('vec')
        decls.push(`const ${name} = rotateUV(${uvExpr}, ${rotationExpr}, ${centerExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'scaleUV') {
        const uvInput = getInput('uv')
        const scale = getInput('scale')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const scaleExpr = scale ? toVec2Expr(scale) : 'vec2(1.0, 1.0)'
        const name = nextVar('vec')
        decls.push(`const ${name} = (${uvExpr} * ${scaleExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'offsetUV') {
        const uvInput = getInput('uv')
        const offset = getInput('offset')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const offsetExpr = offset ? toVec2Expr(offset) : 'vec2(0.0, 0.0)'
        const name = nextVar('vec')
        decls.push(`const ${name} = (${uvExpr} + ${offsetExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'spherizeUV') {
        const uvInput = getInput('uv')
        const strength = getInput('strength')
        const center = getInput('center')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const strengthExpr = strength?.kind === 'number' ? strength.expr : 'float(0.0)'
        const centerExpr = center ? toVec2Expr(center) : 'vec2(0.5, 0.5)'
        const name = nextVar('vec')
        decls.push(
          `const ${name} = spherizeUV(${uvExpr}, ${strengthExpr}, ${centerExpr});`,
        )
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'spritesheetUV') {
        const sizeInput = getInput('size')
        const uvInput = getInput('uv')
        const time = getInput('time')
        const sizeExpr = sizeInput ? toVec2Expr(sizeInput) : 'vec2(1.0, 1.0)'
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const timeExpr = time?.kind === 'number' ? time.expr : 'float(0.0)'
        const name = nextVar('vec')
        decls.push(`const ${name} = spritesheetUV(${sizeExpr}, ${uvExpr}, ${timeExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'normalize') {
        const input = getInput('value')
        if (!input || !isVectorKind(input.kind)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `normalize(${input.expr})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind as 'color' | 'vec2' | 'vec3' | 'vec4' }
        cache.set(key, out)
        return out
      }
      if (node.type === 'length') {
        const input = getInput('value')
        const valueExpr =
          input && isVectorKind(input.kind) ? input.expr : 'vec3(0.0, 0.0, 0.0)'
        const expr = `length(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'dot') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (!inputA || !inputB || !vecA || !vecB || vecA !== vecB) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `dot(${inputA.expr}, ${inputB.expr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'cross') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (!inputA || !inputB || vecA !== 'vec3' || vecB !== 'vec3') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `cross(${inputA.expr}, ${inputB.expr})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const kind: 'color' | 'vec3' =
          inputA.kind === 'color' || inputB.kind === 'color' ? 'color' : 'vec3'
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'checker') {
        const input = getInput('coord')
        const expr =
          input?.kind === 'vec2'
            ? input.expr
            : input?.kind === 'number'
              ? asVec2(input.expr, 'number')
              : 'uv()'
        const name = nextVar('num')
        decls.push(`const ${name} = checker(${expr});`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'dFdx' || node.type === 'dFdy' || node.type === 'fwidth') {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn = node.type === 'dFdx' ? 'dFdx' : node.type === 'dFdy' ? 'dFdy' : 'fwidth'
        const name = nextVar(input.kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${input.expr});`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'distance') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprA = inputA?.expr ?? 'float(0.0)'
        let exprB = inputB?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `distance(${exprA}, ${exprB})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'reflect' || node.type === 'refract' || node.type === 'faceforward') {
        const toVec3Expr = (
          input: {
            expr: string
            kind: 'color' | 'number' | 'vec2' | 'vec3' | 'vec4' | 'mat2' | 'mat3' | 'mat4'
          } | null,
        ) => {
          if (!input) return 'vec3(0.0, 0.0, 0.0)'
          if (input.kind === 'vec3' || input.kind === 'color') return input.expr
          if (input.kind === 'number') return asVec3(input.expr, 'number')
          return 'vec3(0.0, 0.0, 0.0)'
        }
        if (node.type === 'reflect') {
          const incident = getInput('incident')
          const normal = getInput('normal')
          const expr = `reflect(${toVec3Expr(incident)}, ${toVec3Expr(normal)})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const kind: 'color' | 'vec3' =
            incident?.kind === 'color' || normal?.kind === 'color' ? 'color' : 'vec3'
          const out = { expr: name, kind }
          cache.set(key, out)
          return out
        }
        if (node.type === 'refract') {
          const incident = getInput('incident')
          const normal = getInput('normal')
          const eta = getInput('eta')
          const etaExpr = eta?.kind === 'number' ? eta.expr : 'float(1.0)'
          const expr = `refract(${toVec3Expr(incident)}, ${toVec3Expr(normal)}, ${etaExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const kind: 'color' | 'vec3' =
            incident?.kind === 'color' || normal?.kind === 'color' ? 'color' : 'vec3'
          const out = { expr: name, kind }
          cache.set(key, out)
          return out
        }
        const n = getInput('n')
        const i = getInput('i')
        const nref = getInput('nref')
        const expr = `faceforward(${toVec3Expr(n)}, ${toVec3Expr(i)}, ${toVec3Expr(nref)})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const kind: 'color' | 'vec3' =
          n?.kind === 'color' || i?.kind === 'color' || nref?.kind === 'color'
            ? 'color'
            : 'vec3'
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'triNoise3D') {
        const inputPosition = getInput('position')
        const inputSpeed = getInput('speed')
        const inputTime = getInput('time')
        const positionExpr =
          inputPosition?.kind === 'vec3'
            ? inputPosition.expr
            : inputPosition?.kind === 'number'
              ? asVec3(inputPosition.expr, 'number')
              : 'positionLocal'
        const speedExpr = inputSpeed?.kind === 'number' ? inputSpeed.expr : 'float(1.0)'
        const timeExpr = inputTime?.kind === 'number' ? inputTime.expr : 'timeUniform'
        const name = nextVar('num')
        decls.push(`const ${name} = triNoise3D(${positionExpr}, ${speedExpr}, ${timeExpr});`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mxNoiseFloat' || node.type === 'mxNoiseVec3' || node.type === 'mxNoiseVec4') {
        const texcoord = getInput('texcoord')
        const amplitude = getInput('amplitude')
        const pivot = getInput('pivot')
        const coordExpr = texcoord
          ? texcoord.kind === 'vec3' || texcoord.kind === 'color' || texcoord.kind === 'vec4'
            ? toVec3Expr(texcoord)
            : toVec2Expr(texcoord)
          : 'uv()'
        const amplitudeExpr = amplitude?.kind === 'number' ? amplitude.expr : 'float(1.0)'
        const pivotExpr = pivot?.kind === 'number' ? pivot.expr : 'float(0.0)'
        const fn =
          node.type === 'mxNoiseFloat'
            ? 'mx_noise_float'
            : node.type === 'mxNoiseVec3'
              ? 'mx_noise_vec3'
              : 'mx_noise_vec4'
        const name = nextVar(node.type === 'mxNoiseFloat' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${coordExpr}, ${amplitudeExpr}, ${pivotExpr});`)
        const kind =
          node.type === 'mxNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxNoiseVec3'
              ? ('vec3' as const)
              : ('vec4' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'mxFractalNoiseFloat' ||
        node.type === 'mxFractalNoiseVec2' ||
        node.type === 'mxFractalNoiseVec3' ||
        node.type === 'mxFractalNoiseVec4'
      ) {
        const position = getInput('position')
        const octaves = getInput('octaves')
        const lacunarity = getInput('lacunarity')
        const diminish = getInput('diminish')
        const amplitude = getInput('amplitude')
        const positionExpr = position
          ? position.kind === 'vec3' || position.kind === 'color' || position.kind === 'vec4'
            ? toVec3Expr(position)
            : toVec2Expr(position)
          : 'uv()'
        const octavesExpr = octaves?.kind === 'number' ? octaves.expr : 'float(3.0)'
        const lacunarityExpr = lacunarity?.kind === 'number' ? lacunarity.expr : 'float(2.0)'
        const diminishExpr = diminish?.kind === 'number' ? diminish.expr : 'float(0.5)'
        const amplitudeExpr = amplitude?.kind === 'number' ? amplitude.expr : 'float(1.0)'
        const fn =
          node.type === 'mxFractalNoiseFloat'
            ? 'mx_fractal_noise_float'
            : node.type === 'mxFractalNoiseVec2'
              ? 'mx_fractal_noise_vec2'
              : node.type === 'mxFractalNoiseVec3'
                ? 'mx_fractal_noise_vec3'
                : 'mx_fractal_noise_vec4'
        const name = nextVar(
          node.type === 'mxFractalNoiseFloat' ? 'num' : 'vec',
        )
        decls.push(
          `const ${name} = ${fn}(${positionExpr}, ${octavesExpr}, ${lacunarityExpr}, ${diminishExpr}, ${amplitudeExpr});`,
        )
        const kind =
          node.type === 'mxFractalNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxFractalNoiseVec2'
              ? ('vec2' as const)
              : node.type === 'mxFractalNoiseVec3'
                ? ('vec3' as const)
                : ('vec4' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'mxWorleyNoiseFloat' ||
        node.type === 'mxWorleyNoiseVec2' ||
        node.type === 'mxWorleyNoiseVec3'
      ) {
        const texcoord = getInput('texcoord')
        const jitter = getInput('jitter')
        const coordExpr = texcoord
          ? texcoord.kind === 'vec3' || texcoord.kind === 'color' || texcoord.kind === 'vec4'
            ? toVec3Expr(texcoord)
            : toVec2Expr(texcoord)
          : 'uv()'
        const jitterExpr = jitter?.kind === 'number' ? jitter.expr : 'float(1.0)'
        const fn =
          node.type === 'mxWorleyNoiseFloat'
            ? 'mx_worley_noise_float'
            : node.type === 'mxWorleyNoiseVec2'
              ? 'mx_worley_noise_vec2'
              : 'mx_worley_noise_vec3'
        const name = nextVar(node.type === 'mxWorleyNoiseFloat' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${coordExpr}, ${jitterExpr});`)
        const kind =
          node.type === 'mxWorleyNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxWorleyNoiseVec2'
              ? ('vec2' as const)
              : ('vec3' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'rotateUV') {
        const uvInput = getInput('uv')
        const rotation = getInput('rotation')
        const center = getInput('center')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const rotationExpr = rotation?.kind === 'number' ? rotation.expr : 'float(0.0)'
        const centerExpr = center ? toVec2Expr(center) : 'vec2(0.5, 0.5)'
        const name = nextVar('vec')
        decls.push(`const ${name} = rotateUV(${uvExpr}, ${rotationExpr}, ${centerExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'scaleUV') {
        const uvInput = getInput('uv')
        const scale = getInput('scale')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const scaleExpr = scale ? toVec2Expr(scale) : 'vec2(1.0, 1.0)'
        const name = nextVar('vec')
        decls.push(`const ${name} = (${uvExpr} * ${scaleExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'offsetUV') {
        const uvInput = getInput('uv')
        const offset = getInput('offset')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const offsetExpr = offset ? toVec2Expr(offset) : 'vec2(0.0, 0.0)'
        const name = nextVar('vec')
        decls.push(`const ${name} = (${uvExpr} + ${offsetExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'spherizeUV') {
        const uvInput = getInput('uv')
        const strength = getInput('strength')
        const center = getInput('center')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const strengthExpr = strength?.kind === 'number' ? strength.expr : 'float(0.0)'
        const centerExpr = center ? toVec2Expr(center) : 'vec2(0.5, 0.5)'
        const name = nextVar('vec')
        decls.push(
          `const ${name} = spherizeUV(${uvExpr}, ${strengthExpr}, ${centerExpr});`,
        )
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'spritesheetUV') {
        const sizeInput = getInput('size')
        const uvInput = getInput('uv')
        const time = getInput('time')
        const sizeExpr = sizeInput ? toVec2Expr(sizeInput) : 'vec2(1.0, 1.0)'
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const timeExpr = time?.kind === 'number' ? time.expr : 'float(0.0)'
        const name = nextVar('vec')
        decls.push(`const ${name} = spritesheetUV(${sizeExpr}, ${uvExpr}, ${timeExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'smoothstep') {
        const edge0Input = getInput('edge0')
        const edge1Input = getInput('edge1')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edge0Input?.kind ?? 'number',
          edge1Input?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprEdge0 = edge0Input?.expr ?? 'float(0.0)'
        let exprEdge1 = edge1Input?.expr ?? 'float(1.0)'
        let exprX = xInput?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprEdge0 =
            edge0Input?.kind === 'color'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asColor(edge0Input.expr, 'number')
                : 'color(0.0)'
          exprEdge1 =
            edge1Input?.kind === 'color'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asColor(edge1Input.expr, 'number')
                : 'color(1.0)'
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprEdge0 =
            edge0Input?.kind === 'vec2'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec2(edge0Input.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec2'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec2(edge1Input.expr, 'number')
                : 'vec2(1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprEdge0 =
            edge0Input?.kind === 'vec3'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec3(edge0Input.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec3'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec3(edge1Input.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprEdge0 =
            edge0Input?.kind === 'vec4'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec4(edge0Input.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec4'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec4(edge1Input.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `smoothstep(${exprEdge0}, ${exprEdge1}, ${exprX})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'pow') {
        const baseInput = getInput('base')
        const expInput = getInput('exp')
        const kind = resolveVectorOutputKind([
          baseInput?.kind ?? 'number',
          expInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprBase = baseInput?.expr ?? 'float(0.0)'
        let exprExp = expInput?.expr ?? 'float(1.0)'
        if (kind === 'color') {
          exprBase =
            baseInput?.kind === 'color'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asColor(baseInput.expr, 'number')
                : 'color(0.0)'
          exprExp =
            expInput?.kind === 'color'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asColor(expInput.expr, 'number')
                : 'color(1.0)'
        } else if (kind === 'vec2') {
          exprBase =
            baseInput?.kind === 'vec2'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec2(baseInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprExp =
            expInput?.kind === 'vec2'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec2(expInput.expr, 'number')
                : 'vec2(1.0, 1.0)'
        } else if (kind === 'vec3') {
          exprBase =
            baseInput?.kind === 'vec3'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec3(baseInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprExp =
            expInput?.kind === 'vec3'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec3(expInput.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
        } else if (kind === 'vec4') {
          exprBase =
            baseInput?.kind === 'vec4'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec4(baseInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprExp =
            expInput?.kind === 'vec4'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec4(expInput.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
        }
        const expr = `pow(${exprBase}, ${exprExp})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'normalize') {
        const input = getInput('value')
        if (!input || !isVectorKind(input.kind)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `normalize(${input.expr})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind as 'color' | 'vec2' | 'vec3' | 'vec4' }
        cache.set(key, out)
        return out
      }
      if (node.type === 'length') {
        const input = getInput('value')
        const valueExpr =
          input && isVectorKind(input.kind) ? input.expr : 'vec3(0.0, 0.0, 0.0)'
        const expr = `length(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'dot') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (!inputA || !inputB || !vecA || !vecB || vecA !== vecB) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `dot(${inputA.expr}, ${inputB.expr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'cross') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const vecA = getVectorKind(inputA?.kind ?? 'unknown')
        const vecB = getVectorKind(inputB?.kind ?? 'unknown')
        if (!inputA || !inputB || vecA !== 'vec3' || vecB !== 'vec3') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `cross(${inputA.expr}, ${inputB.expr})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const kind: 'color' | 'vec3' =
          inputA.kind === 'color' || inputB.kind === 'color' ? 'color' : 'vec3'
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'checker') {
        const input = getInput('coord')
        const expr =
          input?.kind === 'vec2'
            ? input.expr
            : input?.kind === 'number'
              ? asVec2(input.expr, 'number')
              : 'uv()'
        const name = nextVar('num')
        decls.push(`const ${name} = checker(${expr});`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'dFdx' || node.type === 'dFdy' || node.type === 'fwidth') {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn = node.type === 'dFdx' ? 'dFdx' : node.type === 'dFdy' ? 'dFdy' : 'fwidth'
        const name = nextVar(input.kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${input.expr});`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'distance') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprA = inputA?.expr ?? 'float(0.0)'
        let exprB = inputB?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `distance(${exprA}, ${exprB})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'reflect' || node.type === 'refract' || node.type === 'faceforward') {
        const toVec3Expr = (
          input: {
            expr: string
            kind: 'color' | 'number' | 'vec2' | 'vec3' | 'vec4' | 'mat2' | 'mat3' | 'mat4'
          } | null,
        ) => {
          if (!input) return 'vec3(0.0, 0.0, 0.0)'
          if (input.kind === 'vec3' || input.kind === 'color') return input.expr
          if (input.kind === 'number') return asVec3(input.expr, 'number')
          return 'vec3(0.0, 0.0, 0.0)'
        }
        if (node.type === 'reflect') {
          const incident = getInput('incident')
          const normal = getInput('normal')
          const expr = `reflect(${toVec3Expr(incident)}, ${toVec3Expr(normal)})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const kind: 'color' | 'vec3' =
            incident?.kind === 'color' || normal?.kind === 'color' ? 'color' : 'vec3'
          const out = { expr: name, kind }
          cache.set(key, out)
          return out
        }
        if (node.type === 'refract') {
          const incident = getInput('incident')
          const normal = getInput('normal')
          const eta = getInput('eta')
          const etaExpr = eta?.kind === 'number' ? eta.expr : 'float(1.0)'
          const expr = `refract(${toVec3Expr(incident)}, ${toVec3Expr(normal)}, ${etaExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const kind: 'color' | 'vec3' =
            incident?.kind === 'color' || normal?.kind === 'color' ? 'color' : 'vec3'
          const out = { expr: name, kind }
          cache.set(key, out)
          return out
        }
        const n = getInput('n')
        const i = getInput('i')
        const nref = getInput('nref')
        const expr = `faceforward(${toVec3Expr(n)}, ${toVec3Expr(i)}, ${toVec3Expr(nref)})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const kind: 'color' | 'vec3' =
          n?.kind === 'color' || i?.kind === 'color' || nref?.kind === 'color'
            ? 'color'
            : 'vec3'
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'triNoise3D') {
        const inputPosition = getInput('position')
        const inputSpeed = getInput('speed')
        const inputTime = getInput('time')
        const positionExpr =
          inputPosition?.kind === 'vec3'
            ? inputPosition.expr
            : inputPosition?.kind === 'number'
              ? asVec3(inputPosition.expr, 'number')
              : 'positionLocal'
        const speedExpr = inputSpeed?.kind === 'number' ? inputSpeed.expr : 'float(1.0)'
        const timeExpr = inputTime?.kind === 'number' ? inputTime.expr : 'timeUniform'
        const name = nextVar('num')
        decls.push(`const ${name} = triNoise3D(${positionExpr}, ${speedExpr}, ${timeExpr});`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mxNoiseFloat' || node.type === 'mxNoiseVec3' || node.type === 'mxNoiseVec4') {
        const texcoord = getInput('texcoord')
        const amplitude = getInput('amplitude')
        const pivot = getInput('pivot')
        const coordExpr =
          texcoord?.kind === 'vec3' || texcoord?.kind === 'color' || texcoord?.kind === 'vec4'
            ? toVec3Expr(texcoord)
            : toVec2Expr(texcoord)
        const amplitudeExpr = amplitude?.kind === 'number' ? amplitude.expr : 'float(1.0)'
        const pivotExpr = pivot?.kind === 'number' ? pivot.expr : 'float(0.0)'
        const fn =
          node.type === 'mxNoiseFloat'
            ? 'mx_noise_float'
            : node.type === 'mxNoiseVec3'
              ? 'mx_noise_vec3'
              : 'mx_noise_vec4'
        const name = nextVar(node.type === 'mxNoiseFloat' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${coordExpr}, ${amplitudeExpr}, ${pivotExpr});`)
        const kind =
          node.type === 'mxNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxNoiseVec3'
              ? ('vec3' as const)
              : ('vec4' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'mxFractalNoiseFloat' ||
        node.type === 'mxFractalNoiseVec2' ||
        node.type === 'mxFractalNoiseVec3' ||
        node.type === 'mxFractalNoiseVec4'
      ) {
        const position = getInput('position')
        const octaves = getInput('octaves')
        const lacunarity = getInput('lacunarity')
        const diminish = getInput('diminish')
        const amplitude = getInput('amplitude')
        const positionExpr =
          position?.kind === 'vec3' || position?.kind === 'color' || position?.kind === 'vec4'
            ? toVec3Expr(position)
            : toVec2Expr(position)
        const octavesExpr = octaves?.kind === 'number' ? octaves.expr : 'float(3.0)'
        const lacunarityExpr = lacunarity?.kind === 'number' ? lacunarity.expr : 'float(2.0)'
        const diminishExpr = diminish?.kind === 'number' ? diminish.expr : 'float(0.5)'
        const amplitudeExpr = amplitude?.kind === 'number' ? amplitude.expr : 'float(1.0)'
        const fn =
          node.type === 'mxFractalNoiseFloat'
            ? 'mx_fractal_noise_float'
            : node.type === 'mxFractalNoiseVec2'
              ? 'mx_fractal_noise_vec2'
              : node.type === 'mxFractalNoiseVec3'
                ? 'mx_fractal_noise_vec3'
                : 'mx_fractal_noise_vec4'
        const name = nextVar(
          node.type === 'mxFractalNoiseFloat' ? 'num' : 'vec',
        )
        decls.push(
          `const ${name} = ${fn}(${positionExpr}, ${octavesExpr}, ${lacunarityExpr}, ${diminishExpr}, ${amplitudeExpr});`,
        )
        const kind =
          node.type === 'mxFractalNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxFractalNoiseVec2'
              ? ('vec2' as const)
              : node.type === 'mxFractalNoiseVec3'
                ? ('vec3' as const)
                : ('vec4' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'mxWorleyNoiseFloat' ||
        node.type === 'mxWorleyNoiseVec2' ||
        node.type === 'mxWorleyNoiseVec3'
      ) {
        const texcoord = getInput('texcoord')
        const jitter = getInput('jitter')
        const coordExpr =
          texcoord?.kind === 'vec3' || texcoord?.kind === 'color' || texcoord?.kind === 'vec4'
            ? toVec3Expr(texcoord)
            : toVec2Expr(texcoord)
        const jitterExpr = jitter?.kind === 'number' ? jitter.expr : 'float(1.0)'
        const fn =
          node.type === 'mxWorleyNoiseFloat'
            ? 'mx_worley_noise_float'
            : node.type === 'mxWorleyNoiseVec2'
              ? 'mx_worley_noise_vec2'
              : 'mx_worley_noise_vec3'
        const name = nextVar(node.type === 'mxWorleyNoiseFloat' ? 'num' : 'vec')
        decls.push(`const ${name} = ${fn}(${coordExpr}, ${jitterExpr});`)
        const kind =
          node.type === 'mxWorleyNoiseFloat'
            ? ('number' as const)
            : node.type === 'mxWorleyNoiseVec2'
              ? ('vec2' as const)
              : ('vec3' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'rotateUV') {
        const uvInput = getInput('uv')
        const rotation = getInput('rotation')
        const center = getInput('center')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const rotationExpr = rotation?.kind === 'number' ? rotation.expr : 'float(0.0)'
        const centerExpr = center ? toVec2Expr(center) : 'vec2(0.5, 0.5)'
        const name = nextVar('vec')
        decls.push(`const ${name} = rotateUV(${uvExpr}, ${rotationExpr}, ${centerExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'scaleUV') {
        const uvInput = getInput('uv')
        const scale = getInput('scale')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const scaleExpr = scale ? toVec2Expr(scale) : 'vec2(1.0, 1.0)'
        const name = nextVar('vec')
        decls.push(`const ${name} = (${uvExpr} * ${scaleExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'offsetUV') {
        const uvInput = getInput('uv')
        const offset = getInput('offset')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const offsetExpr = offset ? toVec2Expr(offset) : 'vec2(0.0, 0.0)'
        const name = nextVar('vec')
        decls.push(`const ${name} = (${uvExpr} + ${offsetExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'spherizeUV') {
        const uvInput = getInput('uv')
        const strength = getInput('strength')
        const center = getInput('center')
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const strengthExpr = strength?.kind === 'number' ? strength.expr : 'float(0.0)'
        const centerExpr = center ? toVec2Expr(center) : 'vec2(0.5, 0.5)'
        const name = nextVar('vec')
        decls.push(
          `const ${name} = spherizeUV(${uvExpr}, ${strengthExpr}, ${centerExpr});`,
        )
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'spritesheetUV') {
        const sizeInput = getInput('size')
        const uvInput = getInput('uv')
        const time = getInput('time')
        const sizeExpr = sizeInput ? toVec2Expr(sizeInput) : 'vec2(1.0, 1.0)'
        const uvExpr = toVec2Expr(uvInput ?? { expr: 'uv()', kind: 'vec2' })
        const timeExpr = time?.kind === 'number' ? time.expr : 'timeUniform'
        const name = nextVar('vec')
        decls.push(`const ${name} = spritesheetUV(${sizeExpr}, ${uvExpr}, ${timeExpr});`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'smoothstep') {
        const edge0Input = getInput('edge0')
        const edge1Input = getInput('edge1')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edge0Input?.kind ?? 'number',
          edge1Input?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprEdge0 = edge0Input?.expr ?? 'float(0.0)'
        let exprEdge1 = edge1Input?.expr ?? 'float(1.0)'
        let exprX = xInput?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprEdge0 =
            edge0Input?.kind === 'color'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asColor(edge0Input.expr, 'number')
                : 'color(0.0)'
          exprEdge1 =
            edge1Input?.kind === 'color'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asColor(edge1Input.expr, 'number')
                : 'color(1.0)'
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprEdge0 =
            edge0Input?.kind === 'vec2'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec2(edge0Input.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec2'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec2(edge1Input.expr, 'number')
                : 'vec2(1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprEdge0 =
            edge0Input?.kind === 'vec3'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec3(edge0Input.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec3'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec3(edge1Input.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprEdge0 =
            edge0Input?.kind === 'vec4'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec4(edge0Input.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec4'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec4(edge1Input.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `smoothstep(${exprEdge0}, ${exprEdge1}, ${exprX})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'pow') {
        const baseInput = getInput('base')
        const expInput = getInput('exp')
        const kind = resolveVectorOutputKind([
          baseInput?.kind ?? 'number',
          expInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprBase = baseInput?.expr ?? 'float(0.0)'
        let exprExp = expInput?.expr ?? 'float(1.0)'
        if (kind === 'color') {
          exprBase =
            baseInput?.kind === 'color'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asColor(baseInput.expr, 'number')
                : 'color(0.0)'
          exprExp =
            expInput?.kind === 'color'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asColor(expInput.expr, 'number')
                : 'color(1.0)'
        } else if (kind === 'vec2') {
          exprBase =
            baseInput?.kind === 'vec2'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec2(baseInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprExp =
            expInput?.kind === 'vec2'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec2(expInput.expr, 'number')
                : 'vec2(1.0, 1.0)'
        } else if (kind === 'vec3') {
          exprBase =
            baseInput?.kind === 'vec3'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec3(baseInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprExp =
            expInput?.kind === 'vec3'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec3(expInput.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
        } else if (kind === 'vec4') {
          exprBase =
            baseInput?.kind === 'vec4'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec4(baseInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprExp =
            expInput?.kind === 'vec4'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec4(expInput.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
        }
        const expr = `pow(${exprBase}, ${exprExp})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'vec2') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const exprX = inputX?.kind === 'number' ? inputX.expr : 'float(0.0)'
        const exprY = inputY?.kind === 'number' ? inputY.expr : 'float(0.0)'
        const expr = `vec2(${exprX}, ${exprY})`
        const name = nextVar('col')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mat2') {
        const c0 = getInput('c0')
        const c1 = getInput('c1')
        const expr = `mat2(${toVec2Expr(c0)}, ${toVec2Expr(c1)})`
        const name = nextVar('mat')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'mat2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'vec3') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const inputZ = getInput('z')
        const exprX = inputX?.kind === 'number' ? inputX.expr : 'float(0.0)'
        const exprY = inputY?.kind === 'number' ? inputY.expr : 'float(0.0)'
        const exprZ = inputZ?.kind === 'number' ? inputZ.expr : 'float(0.0)'
        const expr = `vec3(${exprX}, ${exprY}, ${exprZ})`
        const name = nextVar('col')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'vec3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mat3') {
        const c0 = getInput('c0')
        const c1 = getInput('c1')
        const c2 = getInput('c2')
        const expr = `mat3(${toVec3Expr(c0)}, ${toVec3Expr(c1)}, ${toVec3Expr(c2)})`
        const name = nextVar('mat')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'mat3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'scale') {
        const valueInput = getInput('value')
        const scaleInput = getInput('scale')
        const valueExpr =
          valueInput?.kind === 'vec3'
            ? valueInput.expr
            : valueInput?.kind === 'number'
              ? asVec3(valueInput.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        const scaleExpr =
          scaleInput?.kind === 'vec3'
            ? scaleInput.expr
            : scaleInput?.kind === 'number'
              ? asVec3(scaleInput.expr, 'number')
              : 'vec3(1.0, 1.0, 1.0)'
        const expr = `(${valueExpr} * ${scaleExpr})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'vec3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'rotate') {
        const valueInput = getInput('value')
        const rotationInput = getInput('rotation')
        const valueExpr =
          valueInput?.kind === 'vec3'
            ? valueInput.expr
            : valueInput?.kind === 'number'
              ? asVec3(valueInput.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        const rotationExpr =
          rotationInput?.kind === 'vec3'
            ? rotationInput.expr
            : rotationInput?.kind === 'number'
              ? asVec3(rotationInput.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        const baseName = nextVar('vec')
        const rotName = nextVar('vec')
        const cx = nextVar('num')
        const sx = nextVar('num')
        const cy = nextVar('num')
        const sy = nextVar('num')
        const cz = nextVar('num')
        const sz = nextVar('num')
        const rotX = nextVar('vec')
        const rotY = nextVar('vec')
        const rotZ = nextVar('vec')
        decls.push(`const ${baseName} = ${valueExpr};`)
        decls.push(`const ${rotName} = ${rotationExpr};`)
        decls.push(`const ${cx} = cos(${rotName}.x);`)
        decls.push(`const ${sx} = sin(${rotName}.x);`)
        decls.push(`const ${cy} = cos(${rotName}.y);`)
        decls.push(`const ${sy} = sin(${rotName}.y);`)
        decls.push(`const ${cz} = cos(${rotName}.z);`)
        decls.push(`const ${sz} = sin(${rotName}.z);`)
        decls.push(
          `const ${rotX} = vec3(${baseName}.x, ${baseName}.y * ${cx} - ${baseName}.z * ${sx}, ${baseName}.y * ${sx} + ${baseName}.z * ${cx});`,
        )
        decls.push(
          `const ${rotY} = vec3(${rotX}.x * ${cy} + ${rotX}.z * ${sy}, ${rotX}.y, ${rotX}.z * ${cy} - ${rotX}.x * ${sy});`,
        )
        decls.push(
          `const ${rotZ} = vec3(${rotY}.x * ${cz} - ${rotY}.y * ${sz}, ${rotY}.x * ${sz} + ${rotY}.y * ${cz}, ${rotY}.z);`,
        )
        const out = { expr: rotZ, kind: 'vec3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'vec4') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const inputZ = getInput('z')
        const inputW = getInput('w')
        const exprX = inputX?.kind === 'number' ? inputX.expr : 'float(0.0)'
        const exprY = inputY?.kind === 'number' ? inputY.expr : 'float(0.0)'
        const exprZ = inputZ?.kind === 'number' ? inputZ.expr : 'float(0.0)'
        const exprW = inputW?.kind === 'number' ? inputW.expr : 'float(1.0)'
        const expr = `vec4(${exprX}, ${exprY}, ${exprZ}, ${exprW})`
        const name = nextVar('col')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'vec4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mat4') {
        const c0 = getInput('c0')
        const c1 = getInput('c1')
        const c2 = getInput('c2')
        const c3 = getInput('c3')
        const expr = `mat4(${toVec4Expr(c0)}, ${toVec4Expr(c1)}, ${toVec4Expr(c2)}, ${toVec4Expr(c3)})`
        const name = nextVar('mat')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'modelMatrix') {
        const out = { expr: 'modelWorldMatrix', kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'viewMatrix') {
        const out = { expr: 'cameraViewMatrix', kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'projectionMatrix') {
        const out = { expr: 'cameraProjectionMatrix', kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'modelViewMatrix') {
        const out = { expr: 'modelViewMatrix', kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'normalMatrix') {
        const out = { expr: 'modelNormalMatrix', kind: 'mat3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'transpose' || node.type === 'inverse') {
        const input = getInput('value')
        if (!input || !isMatrixKind(input.kind)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `${node.type}(${input.expr})`
        const name = nextVar('mat')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'splitVec2') {
        const input = getInput('value')
        const sourceExpr =
          input?.kind === 'vec2'
            ? input.expr
            : input?.kind === 'number'
              ? asVec2(input.expr, 'number')
              : 'vec2(0.0, 0.0)'
        const channel = outputPin === 'y' ? 'y' : 'x'
        const expr = `${sourceExpr}.${channel}`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'splitVec3') {
        const input = getInput('value')
        const sourceExpr =
          input?.kind === 'vec3'
            ? input.expr
            : input?.kind === 'number'
              ? asVec3(input.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        const channel = outputPin === 'y' ? 'y' : outputPin === 'z' ? 'z' : 'x'
        const expr = `${sourceExpr}.${channel}`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'splitVec4') {
        const input = getInput('value')
        const sourceExpr =
          input?.kind === 'vec4'
            ? input.expr
            : input?.kind === 'number'
              ? asVec4(input.expr, 'number')
              : 'vec4(0.0, 0.0, 0.0, 1.0)'
        const channel =
          outputPin === 'y' ? 'y' : outputPin === 'z' ? 'z' : outputPin === 'w' ? 'w' : 'x'
        const expr = `${sourceExpr}.${channel}`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'cosine') {
        const input = getInput('value')
        const valueExpr = input?.kind === 'number' ? input.expr : 'float(0.0)'
        const expr = `cos(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'tan' ||
        node.type === 'asin' ||
        node.type === 'acos' ||
        node.type === 'atan' ||
        node.type === 'radians' ||
        node.type === 'degrees'
      ) {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn =
          node.type === 'tan'
            ? 'tan'
            : node.type === 'asin'
              ? 'asin'
              : node.type === 'acos'
                ? 'acos'
                : node.type === 'atan'
                  ? 'atan'
                  : node.type === 'radians'
                    ? 'radians'
                    : 'degrees'
        const expr = `${fn}(${input.expr})`
        const name = nextVar(input.kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'atan2') {
        const inputY = getInput('y')
        const inputX = getInput('x')
        const kind = resolveVectorOutputKind([
          inputY?.kind ?? 'number',
          inputX?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprY = inputY?.expr ?? 'float(0.0)'
        let exprX = inputX?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprY =
            inputY?.kind === 'color'
              ? inputY.expr
              : inputY?.kind === 'number'
                ? asColor(inputY.expr, 'number')
                : 'color(0.0)'
          exprX =
            inputX?.kind === 'color'
              ? inputX.expr
              : inputX?.kind === 'number'
                ? asColor(inputX.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprY =
            inputY?.kind === 'vec2'
              ? inputY.expr
              : inputY?.kind === 'number'
                ? asVec2(inputY.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprX =
            inputX?.kind === 'vec2'
              ? inputX.expr
              : inputX?.kind === 'number'
                ? asVec2(inputX.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprY =
            inputY?.kind === 'vec3'
              ? inputY.expr
              : inputY?.kind === 'number'
                ? asVec3(inputY.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprX =
            inputX?.kind === 'vec3'
              ? inputX.expr
              : inputX?.kind === 'number'
                ? asVec3(inputX.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprY =
            inputY?.kind === 'vec4'
              ? inputY.expr
              : inputY?.kind === 'number'
                ? asVec4(inputY.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprX =
            inputX?.kind === 'vec4'
              ? inputX.expr
              : inputX?.kind === 'number'
                ? asVec4(inputX.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `atan(${exprY}, ${exprX})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'abs') {
        const input = getInput('value')
        const valueExpr = input?.kind === 'number' ? input.expr : 'float(0.0)'
        const expr = `abs(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'clamp') {
        const valueInput = getInput('value')
        const minInput = getInput('min')
        const maxInput = getInput('max')
        const valueExpr = valueInput?.kind === 'number' ? valueInput.expr : 'float(0.0)'
        const minExpr = minInput?.kind === 'number' ? minInput.expr : 'float(0.0)'
        const maxExpr = maxInput?.kind === 'number' ? maxInput.expr : 'float(1.0)'
        const expr = `clamp(${valueExpr}, ${minExpr}, ${maxExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'min' || node.type === 'max' || node.type === 'mod') {
        const inputA = getInput('a') ?? { expr: 'float(0.0)', kind: 'number' as const }
        const inputB = getInput('b') ?? { expr: 'float(0.0)', kind: 'number' as const }
        const combined = combineTypes(inputA.kind, inputB.kind)
        if (combined === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn = node.type === 'min' ? 'min' : node.type === 'max' ? 'max' : 'mod'
        if (combined === 'number') {
          const expr = `${fn}(${inputA.expr}, ${inputB.expr})`
          const name = nextVar('num')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprA = inputA.expr
        let exprB = inputB.expr
        if (combined === 'color') {
          exprA =
            inputA.kind === 'color'
              ? inputA.expr
              : inputA.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB.kind === 'color'
              ? inputB.expr
              : inputB.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (combined === 'vec2') {
          exprA =
            inputA.kind === 'vec2'
              ? inputA.expr
              : inputA.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB.kind === 'vec2'
              ? inputB.expr
              : inputB.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (combined === 'vec3') {
          exprA =
            inputA.kind === 'vec3'
              ? inputA.expr
              : inputA.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB.kind === 'vec3'
              ? inputB.expr
              : inputB.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (combined === 'vec4') {
          exprA =
            inputA.kind === 'vec4'
              ? inputA.expr
              : inputA.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB.kind === 'vec4'
              ? inputB.expr
              : inputB.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `${fn}(${exprA}, ${exprB})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: combined }
        cache.set(key, out)
        return out
      }
      if (node.type === 'step') {
        const edgeInput = getInput('edge')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edgeInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprEdge = edgeInput?.expr ?? 'float(0.0)'
        let exprX = xInput?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprEdge =
            edgeInput?.kind === 'color'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asColor(edgeInput.expr, 'number')
                : 'color(0.0)'
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprEdge =
            edgeInput?.kind === 'vec2'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec2(edgeInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprEdge =
            edgeInput?.kind === 'vec3'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec3(edgeInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprEdge =
            edgeInput?.kind === 'vec4'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec4(edgeInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `step(${exprEdge}, ${exprX})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'fract' ||
        node.type === 'floor' ||
        node.type === 'ceil' ||
        node.type === 'round' ||
        node.type === 'trunc' ||
        node.type === 'exp' ||
        node.type === 'log' ||
        node.type === 'sign' ||
        node.type === 'oneMinus' ||
        node.type === 'negate' ||
        node.type === 'exp2' ||
        node.type === 'log2' ||
        node.type === 'pow2' ||
        node.type === 'pow3' ||
        node.type === 'pow4' ||
        node.type === 'sqrt' ||
        node.type === 'saturate'
      ) {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn =
          node.type === 'fract'
            ? 'fract'
            : node.type === 'floor'
              ? 'floor'
              : node.type === 'ceil'
                ? 'ceil'
                : node.type === 'round'
                  ? 'round'
                  : node.type === 'trunc'
                    ? 'trunc'
                    : node.type === 'exp'
                      ? 'exp'
                      : node.type === 'exp2'
                        ? 'exp2'
                        : node.type === 'log'
                          ? 'log'
                          : node.type === 'log2'
                            ? 'log2'
                            : node.type === 'sign'
                              ? 'sign'
                              : node.type === 'oneMinus'
                                ? 'oneMinus'
                                : node.type === 'pow2'
                                  ? 'pow2'
                                  : node.type === 'pow3'
                                    ? 'pow3'
                                    : node.type === 'pow4'
                                      ? 'pow4'
                                      : node.type === 'sqrt'
                                        ? 'sqrt'
                                        : node.type === 'saturate'
                                          ? 'saturate'
                                          : 'negate'
        const expr = `${fn}(${input.expr})`
        const name = nextVar(input.kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mix') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputT = getInput('t')
        const exprT = inputT?.kind === 'number' ? inputT.expr : 'float(0.5)'
        const typeA = inputA?.kind ?? 'number'
        const typeB = inputB?.kind ?? 'number'
        const combined = combineTypes(typeA, typeB)
        if (combined === 'color') {
          const exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          const exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(1.0)'
          const expr = `mix(${exprA}, ${exprB}, ${exprT})`
          const name = nextVar('col')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'color' as const }
          cache.set(key, out)
          return out
        }
        if (combined === 'vec2') {
          const exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          const exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(1.0, 1.0)'
          const expr = `mix(${exprA}, ${exprB}, ${exprT})`
          const name = nextVar('col')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'vec2' as const }
          cache.set(key, out)
          return out
        }
        if (combined === 'vec3') {
          const exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          const exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
          const expr = `mix(${exprA}, ${exprB}, ${exprT})`
          const name = nextVar('col')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'vec3' as const }
          cache.set(key, out)
          return out
        }
        if (combined === 'vec4') {
          const exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          const exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
          const expr = `mix(${exprA}, ${exprB}, ${exprT})`
          const name = nextVar('col')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'vec4' as const }
          cache.set(key, out)
          return out
        }
        const exprA = inputA?.kind === 'number' ? inputA.expr : 'float(0.0)'
        const exprB = inputB?.kind === 'number' ? inputB.expr : 'float(1.0)'
        const expr = `mix(${exprA}, ${exprB}, ${exprT})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'ifElse') {
        const inputCond = getInput('cond')
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputThreshold = getInput('threshold')
        const combined = combineTypes(inputA?.kind ?? 'number', inputB?.kind ?? 'number')
        if (combined === 'unknown' || isMatrixKind(combined)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const outputKind = combined as 'number' | 'color' | 'vec2' | 'vec3' | 'vec4'
        const toKindExpr = (
          entry: typeof inputA,
          kind: 'number' | 'color' | 'vec2' | 'vec3' | 'vec4',
          fallback: number,
        ) => {
          if (kind === 'number') {
            return entry?.kind === 'number' ? entry.expr : `float(${fallback.toFixed(1)})`
          }
          if (entry?.kind === kind) return entry.expr
          if (entry?.kind === 'number') {
            if (kind === 'color') return asColor(entry.expr, 'number')
            if (kind === 'vec2') return asVec2(entry.expr, 'number')
            if (kind === 'vec3') return asVec3(entry.expr, 'number')
            return asVec4(entry.expr, 'number')
          }
          if (kind === 'color') return `color(${fallback.toFixed(1)})`
          if (kind === 'vec2') return `vec2(${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
          if (kind === 'vec3') return `vec3(${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
          return `vec4(${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
        }
        const exprA = toKindExpr(inputA, outputKind, 1)
        const exprB = toKindExpr(inputB, outputKind, 0)
        const condExpr = (() => {
          if (!inputCond) return 'float(0.0)'
          if (outputKind === 'number') {
            if (inputCond.kind === 'number') return inputCond.expr
            if (isVectorKind(inputCond.kind)) return `length(${inputCond.expr})`
            return 'float(0.0)'
          }
          if (outputKind === 'vec2') return toVec2Expr(inputCond)
          if (outputKind === 'vec4') return toVec4Expr(inputCond)
          return toVec3Expr(inputCond)
        })()
        const thresholdExpr =
          inputThreshold?.kind === 'number' ? inputThreshold.expr : 'float(0.5)'
        const thresholdValue =
          outputKind === 'number'
            ? thresholdExpr
            : outputKind === 'vec2'
              ? `vec2(${thresholdExpr}, ${thresholdExpr})`
              : outputKind === 'vec4'
                ? `vec4(${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr})`
                : `vec3(${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr})`
        const mask = `greaterThan(${condExpr}, ${thresholdValue})`
        const expr = `select(${mask}, ${exprA}, ${exprB})`
        const name = nextVar(outputKind === 'number' ? 'num' : outputKind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: outputKind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'ifElse') {
        const inputCond = getInput('cond')
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputThreshold = getInput('threshold')
        const combined = combineTypes(inputA?.kind ?? 'number', inputB?.kind ?? 'number')
        if (combined === 'unknown' || isMatrixKind(combined)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const outputKind = combined as 'number' | 'color' | 'vec2' | 'vec3' | 'vec4'
        const toKindExpr = (
          entry: typeof inputA,
          kind: 'number' | 'color' | 'vec2' | 'vec3' | 'vec4',
          fallback: number,
        ) => {
          if (kind === 'number') {
            return entry?.kind === 'number' ? entry.expr : `float(${fallback.toFixed(1)})`
          }
          if (entry?.kind === kind) return entry.expr
          if (entry?.kind === 'number') {
            if (kind === 'color') return asColor(entry.expr, 'number')
            if (kind === 'vec2') return asVec2(entry.expr, 'number')
            if (kind === 'vec3') return asVec3(entry.expr, 'number')
            return asVec4(entry.expr, 'number')
          }
          if (kind === 'color') return `color(${fallback.toFixed(1)})`
          if (kind === 'vec2') return `vec2(${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
          if (kind === 'vec3') return `vec3(${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
          return `vec4(${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
        }
        const exprA = toKindExpr(inputA, outputKind, 1)
        const exprB = toKindExpr(inputB, outputKind, 0)
        const condExpr = (() => {
          if (!inputCond) return 'float(0.0)'
          if (outputKind === 'number') {
            if (inputCond.kind === 'number') return inputCond.expr
            if (isVectorKind(inputCond.kind)) return `length(${inputCond.expr})`
            return 'float(0.0)'
          }
          if (outputKind === 'vec2') return toVec2Expr(inputCond)
          if (outputKind === 'vec4') return toVec4Expr(inputCond)
          return toVec3Expr(inputCond)
        })()
        const thresholdExpr =
          inputThreshold?.kind === 'number' ? inputThreshold.expr : 'float(0.5)'
        const thresholdValue =
          outputKind === 'number'
            ? thresholdExpr
            : outputKind === 'vec2'
              ? `vec2(${thresholdExpr}, ${thresholdExpr})`
              : outputKind === 'vec4'
                ? `vec4(${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr})`
                : `vec3(${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr})`
        const mask = `greaterThan(${condExpr}, ${thresholdValue})`
        const expr = `select(${mask}, ${exprA}, ${exprB})`
        const name = nextVar(outputKind === 'number' ? 'num' : outputKind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: outputKind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'smoothstepElement') {
        const lowInput = getInput('low')
        const highInput = getInput('high')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          lowInput?.kind ?? 'number',
          highInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprX = xInput?.expr ?? 'float(0.0)'
        let exprLow = lowInput?.expr ?? 'float(0.0)'
        let exprHigh = highInput?.expr ?? 'float(1.0)'
        if (kind === 'color') {
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
          exprLow =
            lowInput?.kind === 'color'
              ? lowInput.expr
              : lowInput?.kind === 'number'
                ? asColor(lowInput.expr, 'number')
                : 'color(0.0)'
          exprHigh =
            highInput?.kind === 'color'
              ? highInput.expr
              : highInput?.kind === 'number'
                ? asColor(highInput.expr, 'number')
                : 'color(1.0)'
        } else if (kind === 'vec2') {
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprLow =
            lowInput?.kind === 'vec2'
              ? lowInput.expr
              : lowInput?.kind === 'number'
                ? asVec2(lowInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprHigh =
            highInput?.kind === 'vec2'
              ? highInput.expr
              : highInput?.kind === 'number'
                ? asVec2(highInput.expr, 'number')
                : 'vec2(1.0, 1.0)'
        } else if (kind === 'vec3') {
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprLow =
            lowInput?.kind === 'vec3'
              ? lowInput.expr
              : lowInput?.kind === 'number'
                ? asVec3(lowInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprHigh =
            highInput?.kind === 'vec3'
              ? highInput.expr
              : highInput?.kind === 'number'
                ? asVec3(highInput.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
        } else if (kind === 'vec4') {
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprLow =
            lowInput?.kind === 'vec4'
              ? lowInput.expr
              : lowInput?.kind === 'number'
                ? asVec4(lowInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprHigh =
            highInput?.kind === 'vec4'
              ? highInput.expr
              : highInput?.kind === 'number'
                ? asVec4(highInput.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
        }
        const expr = `smoothstepElement(${exprX}, ${exprLow}, ${exprHigh})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'stepElement') {
        const edgeInput = getInput('edge')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edgeInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprX = xInput?.expr ?? 'float(0.0)'
        let exprEdge = edgeInput?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
          exprEdge =
            edgeInput?.kind === 'color'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asColor(edgeInput.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprEdge =
            edgeInput?.kind === 'vec2'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec2(edgeInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprEdge =
            edgeInput?.kind === 'vec3'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec3(edgeInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprEdge =
            edgeInput?.kind === 'vec4'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec4(edgeInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `stepElement(${exprX}, ${exprEdge})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'lessThan' ||
        node.type === 'lessThanEqual' ||
        node.type === 'greaterThan' ||
        node.type === 'greaterThanEqual' ||
        node.type === 'equal' ||
        node.type === 'notEqual'
      ) {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const compareFn =
          node.type === 'lessThan'
            ? 'lessThan'
            : node.type === 'lessThanEqual'
              ? 'lessThanEqual'
              : node.type === 'greaterThan'
                ? 'greaterThan'
                : node.type === 'greaterThanEqual'
                  ? 'greaterThanEqual'
                  : node.type === 'equal'
                    ? 'equal'
                    : 'notEqual'
        let exprA = inputA?.expr ?? 'float(0.0)'
        let exprB = inputB?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const oneExpr =
          kind === 'number'
            ? 'float(1.0)'
            : kind === 'color'
              ? 'color(1.0)'
              : kind === 'vec2'
                ? 'vec2(1.0, 1.0)'
                : kind === 'vec3'
                  ? 'vec3(1.0, 1.0, 1.0)'
                  : 'vec4(1.0, 1.0, 1.0, 1.0)'
        const zeroExpr =
          kind === 'number'
            ? 'float(0.0)'
            : kind === 'color'
              ? 'color(0.0)'
              : kind === 'vec2'
                ? 'vec2(0.0, 0.0)'
                : kind === 'vec3'
                  ? 'vec3(0.0, 0.0, 0.0)'
                  : 'vec4(0.0, 0.0, 0.0, 0.0)'
        const expr = `select(${compareFn}(${exprA}, ${exprB}), ${oneExpr}, ${zeroExpr})`
        const name = nextVar(kind === 'number' ? 'num' : kind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'and' || node.type === 'or') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const halfExpr =
          kind === 'number'
            ? 'float(0.5)'
            : kind === 'color'
              ? 'color(0.5)'
              : kind === 'vec2'
                ? 'vec2(0.5, 0.5)'
                : kind === 'vec3'
                  ? 'vec3(0.5, 0.5, 0.5)'
                  : 'vec4(0.5, 0.5, 0.5, 0.5)'
        let exprA = inputA?.expr ?? 'float(0.0)'
        let exprB = inputB?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const maskA = `step(${halfExpr}, ${exprA})`
        const maskB = `step(${halfExpr}, ${exprB})`
        const expr = node.type === 'and' ? `(${maskA} * ${maskB})` : `max(${maskA}, ${maskB})`
        const name = nextVar(kind === 'number' ? 'num' : kind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'not') {
        const input = getInput('value')
        const kind = input?.kind ?? 'number'
        if (kind !== 'number' && !isVectorKind(kind)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const halfExpr =
          kind === 'number'
            ? 'float(0.5)'
            : kind === 'color'
              ? 'color(0.5)'
              : kind === 'vec2'
                ? 'vec2(0.5, 0.5)'
                : kind === 'vec3'
                  ? 'vec3(0.5, 0.5, 0.5)'
                  : 'vec4(0.5, 0.5, 0.5, 0.5)'
        let exprValue = input?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprValue =
            input?.kind === 'color'
              ? input.expr
              : input?.kind === 'number'
                ? asColor(input.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprValue =
            input?.kind === 'vec2'
              ? input.expr
              : input?.kind === 'number'
                ? asVec2(input.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprValue =
            input?.kind === 'vec3'
              ? input.expr
              : input?.kind === 'number'
                ? asVec3(input.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprValue =
            input?.kind === 'vec4'
              ? input.expr
              : input?.kind === 'number'
                ? asVec4(input.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const mask = `step(${halfExpr}, ${exprValue})`
        const expr = `oneMinus(${mask})`
        const name = nextVar(kind === 'number' ? 'num' : kind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = {
          expr: name,
          kind: kind === 'color' ? ('color' as const) : (kind as typeof kind),
        }
        cache.set(key, out)
        return out
      }
      if (node.type === 'remap' || node.type === 'remapClamp') {
        const input = getInput('value')
        const inLowInput = getInput('inLow')
        const inHighInput = getInput('inHigh')
        const outLowInput = getInput('outLow')
        const outHighInput = getInput('outHigh')
        const kind = input?.kind ?? 'number'
        const fn = node.type === 'remap' ? 'remap' : 'remapClamp'
        if (kind === 'number') {
          const valueExpr = input?.kind === 'number' ? input.expr : 'float(0.0)'
          const inLowExpr = inLowInput?.kind === 'number' ? inLowInput.expr : 'float(0.0)'
          const inHighExpr = inHighInput?.kind === 'number' ? inHighInput.expr : 'float(1.0)'
          const outLowExpr = outLowInput?.kind === 'number' ? outLowInput.expr : 'float(0.0)'
          const outHighExpr =
            outHighInput?.kind === 'number' ? outHighInput.expr : 'float(1.0)'
          const expr = `${fn}(${valueExpr}, ${inLowExpr}, ${inHighExpr}, ${outLowExpr}, ${outHighExpr})`
          const name = nextVar('num')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        if (kind === 'vec2') {
          const valueExpr = input ? toVec2Expr(input) : 'vec2(0.0, 0.0)'
          const inLowExpr = inLowInput ? toVec2Expr(inLowInput) : 'vec2(0.0, 0.0)'
          const inHighExpr = inHighInput ? toVec2Expr(inHighInput) : 'vec2(1.0, 1.0)'
          const outLowExpr = outLowInput ? toVec2Expr(outLowInput) : 'vec2(0.0, 0.0)'
          const outHighExpr = outHighInput ? toVec2Expr(outHighInput) : 'vec2(1.0, 1.0)'
          const expr = `${fn}(${valueExpr}, ${inLowExpr}, ${inHighExpr}, ${outLowExpr}, ${outHighExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'vec2' as const }
          cache.set(key, out)
          return out
        }
        if (kind === 'vec3' || kind === 'color') {
          const valueExpr = input ? toVec3Expr(input) : 'vec3(0.0, 0.0, 0.0)'
          const inLowExpr = inLowInput ? toVec3Expr(inLowInput) : 'vec3(0.0, 0.0, 0.0)'
          const inHighExpr = inHighInput ? toVec3Expr(inHighInput) : 'vec3(1.0, 1.0, 1.0)'
          const outLowExpr = outLowInput ? toVec3Expr(outLowInput) : 'vec3(0.0, 0.0, 0.0)'
          const outHighExpr = outHighInput ? toVec3Expr(outHighInput) : 'vec3(1.0, 1.0, 1.0)'
          const expr = `${fn}(${valueExpr}, ${inLowExpr}, ${inHighExpr}, ${outLowExpr}, ${outHighExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const out = {
            expr: name,
            kind: kind === 'color' ? ('color' as const) : ('vec3' as const),
          }
          cache.set(key, out)
          return out
        }
        if (kind === 'vec4') {
          const valueExpr = input ? toVec4Expr(input) : 'vec4(0.0, 0.0, 0.0, 1.0)'
          const inLowExpr = inLowInput ? toVec4Expr(inLowInput) : 'vec4(0.0, 0.0, 0.0, 1.0)'
          const inHighExpr = inHighInput ? toVec4Expr(inHighInput) : 'vec4(1.0, 1.0, 1.0, 1.0)'
          const outLowExpr = outLowInput ? toVec4Expr(outLowInput) : 'vec4(0.0, 0.0, 0.0, 1.0)'
          const outHighExpr = outHighInput ? toVec4Expr(outHighInput) : 'vec4(1.0, 1.0, 1.0, 1.0)'
          const expr = `${fn}(${valueExpr}, ${inLowExpr}, ${inHighExpr}, ${outLowExpr}, ${outHighExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'vec4' as const }
          cache.set(key, out)
          return out
        }
      }
      if (node.type === 'luminance') {
        const input = getInput('value')
        const sourceExpr = toVec3Expr(input)
        const expr = `luminance(${sourceExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'grayscale' ||
        node.type === 'saturation' ||
        node.type === 'posterize' ||
        node.type === 'sRGBTransferEOTF' ||
        node.type === 'sRGBTransferOETF' ||
        node.type === 'linearToneMapping' ||
        node.type === 'reinhardToneMapping' ||
        node.type === 'cineonToneMapping' ||
        node.type === 'acesFilmicToneMapping' ||
        node.type === 'agxToneMapping' ||
        node.type === 'neutralToneMapping'
      ) {
        const input = getInput('value')
        const sourceExpr = toVec3Expr(input)
        let expr = sourceExpr
        if (node.type === 'grayscale') {
          expr = `grayscale(${sourceExpr})`
        } else if (node.type === 'saturation') {
          const amountInput = getInput('amount')
          const amountExpr = amountInput?.kind === 'number' ? amountInput.expr : 'float(1.0)'
          expr = `saturation(${sourceExpr}, ${amountExpr})`
        } else if (node.type === 'posterize') {
          const stepsInput = getInput('steps')
          const stepsExpr = stepsInput?.kind === 'number' ? stepsInput.expr : 'float(4.0)'
          expr = `posterize(${sourceExpr}, ${stepsExpr})`
        } else if (node.type === 'sRGBTransferEOTF') {
          expr = `sRGBTransferEOTF(${sourceExpr})`
        } else if (node.type === 'sRGBTransferOETF') {
          expr = `sRGBTransferOETF(${sourceExpr})`
        } else if (node.type === 'linearToneMapping') {
          expr = `linearToneMapping(${sourceExpr}, float(1))`
        } else if (node.type === 'reinhardToneMapping') {
          expr = `reinhardToneMapping(${sourceExpr}, float(1))`
        } else if (node.type === 'cineonToneMapping') {
          expr = `cineonToneMapping(${sourceExpr}, float(1))`
        } else if (node.type === 'acesFilmicToneMapping') {
          expr = `acesFilmicToneMapping(${sourceExpr}, float(1))`
        } else if (node.type === 'agxToneMapping') {
          expr = `agxToneMapping(${sourceExpr}, float(1))`
        } else {
          expr = `neutralToneMapping(${sourceExpr}, float(1))`
        }
        const name = nextVar('col')
        decls.push(`const ${name} = ${expr};`)
        const kind = input?.kind === 'color' || !input ? ('color' as const) : ('vec3' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }

      if (node.type === 'material' || node.type === 'physicalMaterial') {
        const pin = outputPin ?? 'baseColor'
        const base = getInput('baseColor')
        const tex = getInput('baseColorTexture')
        const baseColor =
          base?.kind === 'color' || base?.kind === 'number' ? base : null
        const texColor =
          tex?.kind === 'color' || tex?.kind === 'number' ? tex : null
        if (pin === 'baseColor') {
          if (baseColor && texColor) {
            const expr = `${asColor(baseColor.expr, baseColor.kind === 'color' ? 'color' : 'number')}.mul(${asColor(
              texColor.expr,
              texColor.kind === 'color' ? 'color' : 'number',
            )})`
            const name = nextVar('col')
            decls.push(`const ${name} = ${expr};`)
            const out = { expr: name, kind: 'color' as const }
            cache.set(key, out)
            return out
          }
          if (baseColor) {
            const out = {
              expr: asColor(
                baseColor.expr,
                baseColor.kind === 'color' ? 'color' : 'number',
              ),
              kind: 'color' as const,
            }
            cache.set(key, out)
            return out
          }
          if (texColor) {
            const out = {
              expr: asColor(
                texColor.expr,
                texColor.kind === 'color' ? 'color' : 'number',
              ),
              kind: 'color' as const,
            }
            cache.set(key, out)
            return out
          }
        }
        if (pin === 'roughness' || pin === 'metalness') {
          const input = getInput(pin)
          const out = input ?? { expr: 'float(0.7)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
      }
      if (node.type === 'basicMaterial') {
        const pin = outputPin ?? 'baseColor'
        if (pin === 'baseColor') {
          const base = getInput('baseColor')
          const tex = getInput('baseColorTexture')
          if (base && tex) {
            const expr = `${asColor(base.expr, base.kind === 'number' ? 'number' : 'color')}.mul(${asColor(
              tex.expr,
              tex.kind === 'number' ? 'number' : 'color',
            )})`
            const name = nextVar('col')
            decls.push(`const ${name} = ${expr};`)
            const out = { expr: name, kind: 'color' as const }
            cache.set(key, out)
            return out
          }
          if (base) {
            const out = {
              expr: asColor(base.expr, base.kind === 'number' ? 'number' : 'color'),
              kind: 'color' as const,
            }
            cache.set(key, out)
            return out
          }
          if (tex) {
            const out = {
              expr: asColor(tex.expr, tex.kind === 'number' ? 'number' : 'color'),
              kind: 'color' as const,
            }
            cache.set(key, out)
            return out
          }
        }
      }

      if (node.type === 'output') {
        const input = getInput('baseColor')
        const out = input ?? { expr: 'color(0.067, 0.074, 0.086)', kind: 'color' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'vertexOutput') {
        const input = getInput('position')
        const out =
          input?.kind === 'vec3'
            ? { expr: input.expr, kind: 'vec3' as const }
            : input?.kind === 'number'
              ? { expr: asVec3(input.expr, 'number'), kind: 'vec3' as const }
              : { expr: 'vec3(0.0, 0.0, 0.0)', kind: 'vec3' as const }
        cache.set(key, out)
        return out
      }

      const fallback = { expr: 'float(0.0)', kind: 'number' as const }
      cache.set(key, fallback)
      return fallback
    }

    const baseColor = resolveExpr(baseColorConn.from.nodeId, baseColorConn.from.pin)
    const roughnessConn = getOutputConnection(connectionMap, outputNode, 'roughness')
    const metalnessConn = getOutputConnection(connectionMap, outputNode, 'metalness')
    const roughness = roughnessConn
      ? resolveExpr(roughnessConn.from.nodeId, roughnessConn.from.pin)
      : { expr: 'float(0.7)', kind: 'number' as const }
    const metalness = metalnessConn
      ? resolveExpr(metalnessConn.from.nodeId, metalnessConn.from.pin)
      : { expr: 'float(0.1)', kind: 'number' as const }

    const baseColorExpr =
      baseColor.kind === 'color'
        ? baseColor.expr
        : baseColor.kind === 'number'
          ? asColor(baseColor.expr, 'number')
          : 'color(0.067, 0.074, 0.086)'
    const { standardMaterialNode, physicalMaterialNode, basicMaterialNode } =
      getMaterialNodesFromOutput(outputNode, nodeMap, connectionMap)
    const getStandardConn = (pin: string) => {
      const node = standardMaterialNode ?? physicalMaterialNode
      return node ? connectionMap.get(`${node.id}:${pin}`) : null
    }
    const getStandardNumberExpr = (pin: string) => {
      const conn = getStandardConn(pin)
      if (!conn) return null
      const resolved = resolveExpr(conn.from.nodeId, conn.from.pin)
      return resolved.kind === 'number' ? resolved.expr : null
    }
    const getStandardColorExpr = (pin: string) => {
      const conn = getStandardConn(pin)
      if (!conn) return null
      const resolved = resolveExpr(conn.from.nodeId, conn.from.pin)
      if (resolved.kind === 'color') return resolved.expr
      if (resolved.kind === 'number') return asColor(resolved.expr, 'number')
      return null
    }
    const getStandardNumberLiteral = (pin: string) => {
      const conn = getStandardConn(pin)
      if (!conn) return null
      const source = nodeMap.get(conn.from.nodeId)
      if (source?.type === 'number') {
        return parseNumber(source.value)
      }
      return null
    }
    const getStandardTextureId = (pin: string) => {
      const conn = getStandardConn(pin)
      if (!conn) return null
      const source = nodeMap.get(conn.from.nodeId)
      if (source?.type === 'texture') return source.id
      return null
    }
    const getBasicConn = (pin: string) =>
      basicMaterialNode ? connectionMap.get(`${basicMaterialNode.id}:${pin}`) : null
    const getBasicNumberExpr = (pin: string) => {
      const conn = getBasicConn(pin)
      if (!conn) return null
      const resolved = resolveExpr(conn.from.nodeId, conn.from.pin)
      return resolved.kind === 'number' ? resolved.expr : null
    }
    const getBasicNumberLiteral = (pin: string) => {
      const conn = getBasicConn(pin)
      if (!conn) return null
      const source = nodeMap.get(conn.from.nodeId)
      if (source?.type === 'number') {
        return parseNumber(source.value)
      }
      return null
    }
    const getBasicTextureId = (pin: string) => {
      const conn = getBasicConn(pin)
      if (!conn) return null
      const source = nodeMap.get(conn.from.nodeId)
      if (source?.type === 'texture') return source.id
      return null
    }
    decls.push(`material.colorNode = ${baseColorExpr};`)
    if (materialKind === 'standard' || materialKind === 'physical') {
      decls.push(`material.roughnessNode = ${roughness.expr};`)
      decls.push(`material.metalnessNode = ${metalness.expr};`)
      if (standardMaterialNode || physicalMaterialNode) {
        const emissiveExpr = getStandardColorExpr('emissive')
        if (emissiveExpr) {
          decls.push(`material.emissiveNode = ${emissiveExpr};`)
        }
        const emissiveMapId = getStandardTextureId('emissiveMap')
        if (emissiveMapId) {
          decls.push(`material.emissiveMap = textureFromNode('${emissiveMapId}');`)
        }
        const emissiveIntensity = getStandardNumberLiteral('emissiveIntensity')
        if (emissiveIntensity !== null) {
          decls.push(`material.emissiveIntensity = ${emissiveIntensity.toFixed(3)};`)
        }
        const roughnessMapId = getStandardTextureId('roughnessMap')
        if (roughnessMapId) {
          decls.push(`material.roughnessMap = textureFromNode('${roughnessMapId}');`)
        }
        const metalnessMapId = getStandardTextureId('metalnessMap')
        if (metalnessMapId) {
          decls.push(`material.metalnessMap = textureFromNode('${metalnessMapId}');`)
        }
        const normalMapId = getStandardTextureId('normalMap')
        if (normalMapId) {
          decls.push(`material.normalMap = textureFromNode('${normalMapId}');`)
        }
        const normalScale = getStandardNumberLiteral('normalScale')
        if (normalScale !== null) {
          const value = normalScale.toFixed(3)
          decls.push(`material.normalScale = new Vector2(${value}, ${value});`)
        }
        const aoMapId = getStandardTextureId('aoMap')
        if (aoMapId) {
          decls.push(`material.aoMap = textureFromNode('${aoMapId}');`)
        }
        const aoMapIntensity = getStandardNumberLiteral('aoMapIntensity')
        if (aoMapIntensity !== null) {
          decls.push(`material.aoMapIntensity = ${aoMapIntensity.toFixed(3)};`)
        }
        const envMapId = getStandardTextureId('envMap')
        if (envMapId) {
          decls.push(`material.envMap = textureFromNode('${envMapId}');`)
        }
        const envMapIntensity = getStandardNumberLiteral('envMapIntensity')
        if (envMapIntensity !== null) {
          decls.push(`material.envMapIntensity = ${envMapIntensity.toFixed(3)};`)
        }
        const opacityExpr = getStandardNumberExpr('opacity')
        if (opacityExpr) {
          decls.push(`material.opacityNode = ${opacityExpr};`)
        }
        const alphaTestExpr = getStandardNumberExpr('alphaTest')
        if (alphaTestExpr) {
          decls.push(`material.alphaTestNode = ${alphaTestExpr};`)
        }
        const alphaHashLiteral = getStandardNumberLiteral('alphaHash')
        if (alphaHashLiteral !== null) {
          decls.push(`material.alphaHash = ${alphaHashLiteral > 0.5 ? 'true' : 'false'};`)
        } else if (getStandardConn('alphaHash')) {
          decls.push('material.alphaHash = true;')
        }
        const opacityLiteral = getStandardNumberLiteral('opacity')
        if (opacityLiteral !== null) {
          decls.push(`material.transparent = ${opacityLiteral < 1 ? 'true' : 'false'};`)
        }
        if (materialKind === 'physical') {
          const clearcoatExpr = getStandardNumberExpr('clearcoat')
          if (clearcoatExpr) {
            decls.push(`material.clearcoatNode = ${clearcoatExpr};`)
          }
          const clearcoatLiteral = getStandardNumberLiteral('clearcoat')
          if (clearcoatLiteral !== null) {
            decls.push(`material.clearcoat = ${clearcoatLiteral.toFixed(3)};`)
          }
          const clearcoatRoughnessExpr = getStandardNumberExpr('clearcoatRoughness')
          if (clearcoatRoughnessExpr) {
            decls.push(`material.clearcoatRoughnessNode = ${clearcoatRoughnessExpr};`)
          }
          const clearcoatRoughnessLiteral = getStandardNumberLiteral('clearcoatRoughness')
          if (clearcoatRoughnessLiteral !== null) {
            decls.push(
              `material.clearcoatRoughness = ${clearcoatRoughnessLiteral.toFixed(3)};`,
            )
          }
          const clearcoatNormalId = getStandardTextureId('clearcoatNormal')
          if (clearcoatNormalId) {
            decls.push(
              `material.clearcoatNormalMap = textureFromNode('${clearcoatNormalId}');`,
            )
          }
        }
      }
    }
    if (materialKind === 'basic') {
      const opacityExpr = getBasicNumberExpr('opacity')
      if (opacityExpr) {
        decls.push(`material.opacityNode = ${opacityExpr};`)
      }
      const alphaTestExpr = getBasicNumberExpr('alphaTest')
      if (alphaTestExpr) {
        decls.push(`material.alphaTestNode = ${alphaTestExpr};`)
      }
      const alphaHashLiteral = getBasicNumberLiteral('alphaHash')
      if (alphaHashLiteral !== null) {
        decls.push(`material.alphaHash = ${alphaHashLiteral > 0.5 ? 'true' : 'false'};`)
      } else if (getBasicConn('alphaHash')) {
        decls.push('material.alphaHash = true;')
      }
      const mapId = getBasicTextureId('map')
      if (mapId) {
        decls.push(`material.map = textureFromNode('${mapId}');`)
      }
      const alphaMapId = getBasicTextureId('alphaMap')
      if (alphaMapId) {
        decls.push(`material.alphaMap = textureFromNode('${alphaMapId}');`)
        decls.push('material.transparent = true;')
      }
      const aoMapId = getBasicTextureId('aoMap')
      if (aoMapId) {
        decls.push(`material.aoMap = textureFromNode('${aoMapId}');`)
      }
      const envMapId = getBasicTextureId('envMap')
      if (envMapId) {
        decls.push(`material.envMap = textureFromNode('${envMapId}');`)
      }
      const reflectivity =
        getBasicNumberLiteral('reflectivity') ?? getBasicNumberLiteral('envMapIntensity')
      if (reflectivity !== null) {
        decls.push(`material.reflectivity = ${reflectivity.toFixed(3)};`)
      }
    }
    if (vertexOutputNode) {
      const positionConn = connectionMap.get(`${vertexOutputNode.id}:position`)
      if (positionConn) {
        const positionValue = resolveExpr(
          positionConn.from.nodeId,
          positionConn.from.pin,
        )
        const positionExpr =
          positionValue.kind === 'vec3'
            ? positionValue.expr
            : positionValue.kind === 'number'
              ? asVec3(positionValue.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        decls.push(`material.positionNode = positionLocal.add(${positionExpr});`)
      } else {
        decls.push('material.positionNode = positionLocal;')
      }
    }

    const geometryOutputNode = nodes.find((node) => node.type === 'geometryOutput')
    if (geometryOutputNode) {
      const geometryConn = connectionMap.get(`${geometryOutputNode.id}:geometry`)
      const sourceNode = geometryConn
        ? nodeMap.get(geometryConn.from.nodeId)
        : null
      const rawValue =
        sourceNode?.type === 'geometryPrimitive'
          ? sourceNode.value ?? 'box'
          : 'box'
      const geometryType =
        typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : 'box'
      const geometryConstructors: Record<string, string> = {
        box: 'BoxGeometry(1, 1, 1)',
        sphere: 'SphereGeometry(0.75, 32, 16)',
        plane: 'PlaneGeometry(1.5, 1.5, 1, 1)',
        torus: 'TorusGeometry(0.6, 0.25, 24, 64)',
        cylinder: 'CylinderGeometry(0.5, 0.5, 1.2, 24)',
      }
      const geometryExpr = geometryConstructors[geometryType] ?? 'BoxGeometry(1, 1, 1)'
      decls.push(`const geometry = new ${geometryExpr};`)
      decls.push('const mesh = new Mesh(geometry, material);')
    }

    return decls.join('\n')
  }

  const buildExecutableTSL = () => {
    const expanded = expandFunctions(nodes, connections, functions)
    const nodeMap = buildNodeMap(expanded.nodes)
    const connectionMap = buildConnectionMap(expanded.connections)
    const graphNodes = expanded.nodes

    const outputNode = graphNodes.find((node) => node.type === 'output')
    const vertexOutputNode = graphNodes.find((node) => node.type === 'vertexOutput')
    if (!outputNode) {
      return `return new MeshStandardNodeMaterial();`
    }

    const baseColorConn = getOutputConnection(connectionMap, outputNode, 'baseColor')
    if (!baseColorConn) {
      return `return new MeshStandardNodeMaterial();`
    }

    const materialKind = getMaterialKindFromOutput(outputNode, nodeMap, connectionMap)
    const materialClass =
      materialKind === 'basic'
        ? 'MeshBasicNodeMaterial'
        : materialKind === 'physical'
          ? 'MeshPhysicalNodeMaterial'
          : 'MeshStandardNodeMaterial'

    const tslImportNames = [
      'acesFilmicToneMapping',
      'abs',
      'acos',
      'agxToneMapping',
      'asin',
      'atan',
      'ceil',
      'checker',
      'clamp',
      'cos',
      'color',
      'cross',
      'cineonToneMapping',
      'dFdx',
      'dFdy',
      'degrees',
      'distance',
      'dot',
      'equal',
      'exp',
      'exp2',
      'faceforward',
      'float',
      'floor',
      'fract',
      'fwidth',
      'grayscale',
      'greaterThan',
      'greaterThanEqual',
      'inverse',
      'length',
      'lessThan',
      'lessThanEqual',
      'linearToneMapping',
      'log',
      'log2',
      'luminance',
      'mat2',
      'mat3',
      'mat4',
      'max',
      'min',
      'mix',
      'mod',
      'modelWorldMatrix',
      'modelViewMatrix',
      'modelNormalMatrix',
      'mx_fractal_noise_float',
      'mx_fractal_noise_vec2',
      'mx_fractal_noise_vec3',
      'mx_fractal_noise_vec4',
      'mx_noise_float',
      'mx_noise_vec3',
      'mx_noise_vec4',
      'mx_worley_noise_float',
      'mx_worley_noise_vec2',
      'mx_worley_noise_vec3',
      'negate',
      'neutralToneMapping',
      'normalize',
      'notEqual',
      'oneMinus',
      'posterize',
      'pow',
      'pow2',
      'pow3',
      'pow4',
      'positionLocal',
      'normalLocal',
      'tangentLocal',
      'bitangentLocal',
      'cameraProjectionMatrix',
      'radians',
      'reinhardToneMapping',
      'reflect',
      'refract',
      'remap',
      'remapClamp',
      'rotateUV',
      'round',
      'saturate',
      'sRGBTransferEOTF',
      'sRGBTransferOETF',
      'saturation',
      'select',
      'sign',
      'sin',
      'smoothstep',
      'smoothstepElement',
      'spherizeUV',
      'spritesheetUV',
      'sqrt',
      'step',
      'stepElement',
      'tan',
      'texture',
      'transpose',
      'triNoise3D',
      'trunc',
      'uniform',
      'uniformTexture',
      'uv',
      'vec2',
      'vec3',
      'vec4',
      'cameraViewMatrix',
    ]
    const tslImportPlaceholder = '__TSL_IMPORTS__'
    const decls: string[] = [
      `const { ${tslImportPlaceholder} } = TSL;`,
      `const material = new ${materialClass}();`,
    ]
    const cache = new Map<string, ExprResult>()
    let varIndex = 1

    const nextVar = (prefix: string) => `${prefix}_${varIndex++}`
    const asColor = (expr: string, kind: 'color' | 'number') =>
      kind === 'color' ? expr : `color(${expr}, ${expr}, ${expr})`
    const asVec2 = (expr: string, kind: 'vec2' | 'number') =>
      kind === 'vec2' ? expr : `vec2(${expr}, ${expr})`
    const asVec3 = (expr: string, kind: 'vec3' | 'number') =>
      kind === 'vec3' ? expr : `vec3(${expr}, ${expr}, ${expr})`
    const asVec4 = (expr: string, kind: 'vec4' | 'number') =>
      kind === 'vec4' ? expr : `vec4(${expr}, ${expr}, ${expr}, ${expr})`
    const toVec2Expr = (input: ExprResult | null) => {
      if (!input) return 'vec2(0.0, 0.0)'
      if (input.kind === 'vec2') return input.expr
      if (input.kind === 'vec3' || input.kind === 'color') {
        return `vec2(${input.expr}.x, ${input.expr}.y)`
      }
      if (input.kind === 'vec4') {
        return `vec2(${input.expr}.x, ${input.expr}.y)`
      }
      return asVec2(input.expr, 'number')
    }
    const toVec3Expr = (input: ExprResult | null) => {
      if (!input) return 'vec3(0.0, 0.0, 0.0)'
      if (input.kind === 'vec3' || input.kind === 'color') return input.expr
      if (input.kind === 'vec2') {
        return `vec3(${input.expr}.x, ${input.expr}.y, 0.0)`
      }
      if (input.kind === 'vec4') {
        return `vec3(${input.expr}.x, ${input.expr}.y, ${input.expr}.z)`
      }
      return asVec3(input.expr, 'number')
    }
    const toVec4Expr = (input: ExprResult | null) => {
      if (!input) return 'vec4(0.0, 0.0, 0.0, 1.0)'
      if (input.kind === 'vec4') return input.expr
      if (input.kind === 'vec3' || input.kind === 'color') {
        return `vec4(${input.expr}.x, ${input.expr}.y, ${input.expr}.z, 1.0)`
      }
      if (input.kind === 'vec2') {
        return `vec4(${input.expr}.x, ${input.expr}.y, 0.0, 1.0)`
      }
      return asVec4(input.expr, 'number')
    }

    const resolveExpr = (nodeId: string, outputPin?: string): ExprResult => {
      const key = `${nodeId}:${outputPin ?? ''}`
      const cached = cache.get(key)
      if (cached) return cached

      const node = nodeMap.get(nodeId)
      if (!node) {
        const fallback = { expr: 'float(0.0)', kind: 'number' as const }
        cache.set(key, fallback)
        return fallback
      }

      if (node.type === 'number') {
        const value = parseNumber(node.value)
        const name = nextVar('num')
        const mode = getNumberUpdateMode(node)
        if (mode === 'manual') {
          decls.push(`const ${name} = float(${value.toFixed(3)});`)
        } else {
          decls.push(`const ${name} = uniform(${value.toFixed(3)});`)
          appendNumberUniformUpdate(decls, name, node)
        }
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'time') {
        const out = { expr: 'timeUniform', kind: 'number' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'color') {
        const value = typeof node.value === 'string' ? node.value : DEFAULT_COLOR
        const name = nextVar('col')
        decls.push(`const ${name} = color('${value}');`)
        const out = { expr: name, kind: 'color' as const }
        cache.set(key, out)
        return out
      }

      const attributeExpr = getAttributeExpr(node.type)
      if (attributeExpr) {
        cache.set(key, attributeExpr)
        return attributeExpr
      }

      if (node.type === 'texture') {
        const name = nextVar('tex')
        decls.push(
          `const ${name} = texture(uniformTexture(textureFromNode('${node.id}')), uv());`,
        )
        const out = { expr: name, kind: 'color' as const }
        cache.set(key, out)
        return out
      }

      const getInput = (pin: string) => {
        const connection = connectionMap.get(`${node.id}:${pin}`)
        if (!connection) return null
        return resolveExpr(connection.from.nodeId, connection.from.pin)
      }
      if (node.type === 'functionInput' || node.type === 'functionOutput') {
        const input = getInput('value')
        const out = input ?? { expr: 'float(0.0)', kind: 'number' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'add' || node.type === 'multiply') {
        const left =
          getInput('a') ??
          {
            expr: node.type === 'add' ? 'float(0.0)' : 'float(1.0)',
            kind: 'number' as const,
          }
        const right =
          getInput('b') ??
          {
            expr: node.type === 'add' ? 'float(0.0)' : 'float(1.0)',
            kind: 'number' as const,
          }
        const op = node.type === 'add' ? 'add' : 'mul'
        const combined = combineTypes(left.kind, right.kind)
        if (combined === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let leftExpr = left.expr
        let rightExpr = right.expr
        if (combined === 'color') {
          leftExpr = asColor(left.expr, left.kind === 'number' ? 'number' : 'color')
          rightExpr = asColor(right.expr, right.kind === 'number' ? 'number' : 'color')
        } else if (combined === 'vec2') {
          leftExpr = asVec2(left.expr, left.kind === 'number' ? 'number' : 'vec2')
          rightExpr = asVec2(right.expr, right.kind === 'number' ? 'number' : 'vec2')
        } else if (combined === 'vec3') {
          leftExpr = asVec3(left.expr, left.kind === 'number' ? 'number' : 'vec3')
          rightExpr = asVec3(right.expr, right.kind === 'number' ? 'number' : 'vec3')
        } else if (combined === 'vec4') {
          leftExpr = asVec4(left.expr, left.kind === 'number' ? 'number' : 'vec4')
          rightExpr = asVec4(right.expr, right.kind === 'number' ? 'number' : 'vec4')
        }
        const expr = `${leftExpr}.${op}(${rightExpr})`
        const name = nextVar(combined === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: combined }
        cache.set(key, out)
        return out
      }
      if (node.type === 'ifElse') {
        const inputCond = getInput('cond')
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputThreshold = getInput('threshold')
        const combined = combineTypes(inputA?.kind ?? 'number', inputB?.kind ?? 'number')
        if (combined === 'unknown' || isMatrixKind(combined)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const outputKind = combined as 'number' | 'color' | 'vec2' | 'vec3' | 'vec4'
        const toKindExpr = (
          entry: typeof inputA,
          kind: 'number' | 'color' | 'vec2' | 'vec3' | 'vec4',
          fallback: number,
        ) => {
          if (kind === 'number') {
            return entry?.kind === 'number' ? entry.expr : `float(${fallback.toFixed(1)})`
          }
          if (entry?.kind === kind) return entry.expr
          if (entry?.kind === 'number') {
            if (kind === 'color') return asColor(entry.expr, 'number')
            if (kind === 'vec2') return asVec2(entry.expr, 'number')
            if (kind === 'vec3') return asVec3(entry.expr, 'number')
            return asVec4(entry.expr, 'number')
          }
          if (kind === 'color') return `color(${fallback.toFixed(1)})`
          if (kind === 'vec2') return `vec2(${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
          if (kind === 'vec3') return `vec3(${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
          return `vec4(${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)}, ${fallback.toFixed(1)})`
        }
        const exprA = toKindExpr(inputA, outputKind, 1)
        const exprB = toKindExpr(inputB, outputKind, 0)
        const condExpr = (() => {
          if (!inputCond) return 'float(0.0)'
          if (outputKind === 'number') {
            if (inputCond.kind === 'number') return inputCond.expr
            if (isVectorKind(inputCond.kind)) return `length(${inputCond.expr})`
            return 'float(0.0)'
          }
          if (outputKind === 'vec2') return toVec2Expr(inputCond)
          if (outputKind === 'vec4') return toVec4Expr(inputCond)
          return toVec3Expr(inputCond)
        })()
        const thresholdExpr =
          inputThreshold?.kind === 'number' ? inputThreshold.expr : 'float(0.5)'
        const thresholdValue =
          outputKind === 'number'
            ? thresholdExpr
            : outputKind === 'vec2'
              ? `vec2(${thresholdExpr}, ${thresholdExpr})`
              : outputKind === 'vec4'
                ? `vec4(${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr})`
                : `vec3(${thresholdExpr}, ${thresholdExpr}, ${thresholdExpr})`
        const mask = `greaterThan(${condExpr}, ${thresholdValue})`
        const expr = `select(${mask}, ${exprA}, ${exprB})`
        const name = nextVar(outputKind === 'number' ? 'num' : outputKind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: outputKind }
        cache.set(key, out)
        return out
      }

      if (node.type === 'sine') {
        const input = getInput('value')
        const valueExpr = input?.kind === 'number' ? input.expr : 'float(0.0)'
        const expr = `sin(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'tan' ||
        node.type === 'asin' ||
        node.type === 'acos' ||
        node.type === 'atan' ||
        node.type === 'radians' ||
        node.type === 'degrees'
      ) {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn =
          node.type === 'tan'
            ? 'tan'
            : node.type === 'asin'
              ? 'asin'
              : node.type === 'acos'
                ? 'acos'
                : node.type === 'atan'
                  ? 'atan'
                  : node.type === 'radians'
                    ? 'radians'
                    : 'degrees'
        const expr = `${fn}(${input.expr})`
        const name = nextVar(input.kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'atan2') {
        const inputY = getInput('y')
        const inputX = getInput('x')
        const kind = resolveVectorOutputKind([
          inputY?.kind ?? 'number',
          inputX?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprY = inputY?.expr ?? 'float(0.0)'
        let exprX = inputX?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprY =
            inputY?.kind === 'color'
              ? inputY.expr
              : inputY?.kind === 'number'
                ? asColor(inputY.expr, 'number')
                : 'color(0.0)'
          exprX =
            inputX?.kind === 'color'
              ? inputX.expr
              : inputX?.kind === 'number'
                ? asColor(inputX.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprY =
            inputY?.kind === 'vec2'
              ? inputY.expr
              : inputY?.kind === 'number'
                ? asVec2(inputY.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprX =
            inputX?.kind === 'vec2'
              ? inputX.expr
              : inputX?.kind === 'number'
                ? asVec2(inputX.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprY =
            inputY?.kind === 'vec3'
              ? inputY.expr
              : inputY?.kind === 'number'
                ? asVec3(inputY.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprX =
            inputX?.kind === 'vec3'
              ? inputX.expr
              : inputX?.kind === 'number'
                ? asVec3(inputX.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprY =
            inputY?.kind === 'vec4'
              ? inputY.expr
              : inputY?.kind === 'number'
                ? asVec4(inputY.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprX =
            inputX?.kind === 'vec4'
              ? inputX.expr
              : inputX?.kind === 'number'
                ? asVec4(inputX.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `atan(${exprY}, ${exprX})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'vec2') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const exprX = inputX?.kind === 'number' ? inputX.expr : 'float(0.0)'
        const exprY = inputY?.kind === 'number' ? inputY.expr : 'float(0.0)'
        const expr = `vec2(${exprX}, ${exprY})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'vec2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mat2') {
        const c0 = getInput('c0')
        const c1 = getInput('c1')
        const expr = `mat2(${toVec2Expr(c0)}, ${toVec2Expr(c1)})`
        const name = nextVar('mat')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'mat2' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'vec3') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const inputZ = getInput('z')
        const exprX = inputX?.kind === 'number' ? inputX.expr : 'float(0.0)'
        const exprY = inputY?.kind === 'number' ? inputY.expr : 'float(0.0)'
        const exprZ = inputZ?.kind === 'number' ? inputZ.expr : 'float(0.0)'
        const expr = `vec3(${exprX}, ${exprY}, ${exprZ})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'vec3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mat3') {
        const c0 = getInput('c0')
        const c1 = getInput('c1')
        const c2 = getInput('c2')
        const expr = `mat3(${toVec3Expr(c0)}, ${toVec3Expr(c1)}, ${toVec3Expr(c2)})`
        const name = nextVar('mat')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'mat3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'scale') {
        const valueInput = getInput('value')
        const scaleInput = getInput('scale')
        const valueExpr =
          valueInput?.kind === 'vec3'
            ? valueInput.expr
            : valueInput?.kind === 'number'
              ? asVec3(valueInput.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        const scaleExpr =
          scaleInput?.kind === 'vec3'
            ? scaleInput.expr
            : scaleInput?.kind === 'number'
              ? asVec3(scaleInput.expr, 'number')
              : 'vec3(1.0, 1.0, 1.0)'
        const expr = `(${valueExpr} * ${scaleExpr})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'vec3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'rotate') {
        const valueInput = getInput('value')
        const rotationInput = getInput('rotation')
        const valueExpr =
          valueInput?.kind === 'vec3'
            ? valueInput.expr
            : valueInput?.kind === 'number'
              ? asVec3(valueInput.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        const rotationExpr =
          rotationInput?.kind === 'vec3'
            ? rotationInput.expr
            : rotationInput?.kind === 'number'
              ? asVec3(rotationInput.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        const baseName = nextVar('vec')
        const rotName = nextVar('vec')
        const cx = nextVar('num')
        const sx = nextVar('num')
        const cy = nextVar('num')
        const sy = nextVar('num')
        const cz = nextVar('num')
        const sz = nextVar('num')
        const rotX = nextVar('vec')
        const rotY = nextVar('vec')
        const rotZ = nextVar('vec')
        decls.push(`const ${baseName} = ${valueExpr};`)
        decls.push(`const ${rotName} = ${rotationExpr};`)
        decls.push(`const ${cx} = cos(${rotName}.x);`)
        decls.push(`const ${sx} = sin(${rotName}.x);`)
        decls.push(`const ${cy} = cos(${rotName}.y);`)
        decls.push(`const ${sy} = sin(${rotName}.y);`)
        decls.push(`const ${cz} = cos(${rotName}.z);`)
        decls.push(`const ${sz} = sin(${rotName}.z);`)
        decls.push(
          `const ${rotX} = vec3(${baseName}.x, ${baseName}.y * ${cx} - ${baseName}.z * ${sx}, ${baseName}.y * ${sx} + ${baseName}.z * ${cx});`,
        )
        decls.push(
          `const ${rotY} = vec3(${rotX}.x * ${cy} + ${rotX}.z * ${sy}, ${rotX}.y, ${rotX}.z * ${cy} - ${rotX}.x * ${sy});`,
        )
        decls.push(
          `const ${rotZ} = vec3(${rotY}.x * ${cz} - ${rotY}.y * ${sz}, ${rotY}.x * ${sz} + ${rotY}.y * ${cz}, ${rotY}.z);`,
        )
        const out = { expr: rotZ, kind: 'vec3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'vec4') {
        const inputX = getInput('x')
        const inputY = getInput('y')
        const inputZ = getInput('z')
        const inputW = getInput('w')
        const exprX = inputX?.kind === 'number' ? inputX.expr : 'float(0.0)'
        const exprY = inputY?.kind === 'number' ? inputY.expr : 'float(0.0)'
        const exprZ = inputZ?.kind === 'number' ? inputZ.expr : 'float(0.0)'
        const exprW = inputW?.kind === 'number' ? inputW.expr : 'float(1.0)'
        const expr = `vec4(${exprX}, ${exprY}, ${exprZ}, ${exprW})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'vec4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mat4') {
        const c0 = getInput('c0')
        const c1 = getInput('c1')
        const c2 = getInput('c2')
        const c3 = getInput('c3')
        const expr = `mat4(${toVec4Expr(c0)}, ${toVec4Expr(c1)}, ${toVec4Expr(c2)}, ${toVec4Expr(c3)})`
        const name = nextVar('mat')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'modelMatrix') {
        const out = { expr: 'modelWorldMatrix', kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'viewMatrix') {
        const out = { expr: 'cameraViewMatrix', kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'projectionMatrix') {
        const out = { expr: 'cameraProjectionMatrix', kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'modelViewMatrix') {
        const out = { expr: 'modelViewMatrix', kind: 'mat4' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'normalMatrix') {
        const out = { expr: 'modelNormalMatrix', kind: 'mat3' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'transpose' || node.type === 'inverse') {
        const input = getInput('value')
        if (!input || !isMatrixKind(input.kind)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const expr = `${node.type}(${input.expr})`
        const name = nextVar('mat')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'splitVec2') {
        const input = getInput('value')
        const sourceExpr =
          input?.kind === 'vec2'
            ? input.expr
            : input?.kind === 'number'
              ? asVec2(input.expr, 'number')
              : 'vec2(0.0, 0.0)'
        const channel = outputPin === 'y' ? 'y' : 'x'
        const expr = `${sourceExpr}.${channel}`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'splitVec3') {
        const input = getInput('value')
        const sourceExpr =
          input?.kind === 'vec3'
            ? input.expr
            : input?.kind === 'number'
              ? asVec3(input.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        const channel = outputPin === 'y' ? 'y' : outputPin === 'z' ? 'z' : 'x'
        const expr = `${sourceExpr}.${channel}`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'splitVec4') {
        const input = getInput('value')
        const sourceExpr =
          input?.kind === 'vec4'
            ? input.expr
            : input?.kind === 'number'
              ? asVec4(input.expr, 'number')
              : 'vec4(0.0, 0.0, 0.0, 1.0)'
        const channel =
          outputPin === 'y' ? 'y' : outputPin === 'z' ? 'z' : outputPin === 'w' ? 'w' : 'x'
        const expr = `${sourceExpr}.${channel}`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'cosine') {
        const input = getInput('value')
        const valueExpr = input?.kind === 'number' ? input.expr : 'float(0.0)'
        const expr = `cos(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'abs') {
        const input = getInput('value')
        const valueExpr = input?.kind === 'number' ? input.expr : 'float(0.0)'
        const expr = `abs(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'clamp') {
        const valueInput = getInput('value')
        const minInput = getInput('min')
        const maxInput = getInput('max')
        const valueExpr = valueInput?.kind === 'number' ? valueInput.expr : 'float(0.0)'
        const minExpr = minInput?.kind === 'number' ? minInput.expr : 'float(0.0)'
        const maxExpr = maxInput?.kind === 'number' ? maxInput.expr : 'float(1.0)'
        const expr = `clamp(${valueExpr}, ${minExpr}, ${maxExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'min' || node.type === 'max' || node.type === 'mod') {
        const inputA = getInput('a') ?? { expr: 'float(0.0)', kind: 'number' as const }
        const inputB = getInput('b') ?? { expr: 'float(0.0)', kind: 'number' as const }
        const combined = combineTypes(inputA.kind, inputB.kind)
        if (combined === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn = node.type === 'min' ? 'min' : node.type === 'max' ? 'max' : 'mod'
        if (combined === 'number') {
          const expr = `${fn}(${inputA.expr}, ${inputB.expr})`
          const name = nextVar('num')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprA = inputA.expr
        let exprB = inputB.expr
        if (combined === 'color') {
          exprA =
            inputA.kind === 'color'
              ? inputA.expr
              : inputA.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB.kind === 'color'
              ? inputB.expr
              : inputB.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (combined === 'vec2') {
          exprA =
            inputA.kind === 'vec2'
              ? inputA.expr
              : inputA.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB.kind === 'vec2'
              ? inputB.expr
              : inputB.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (combined === 'vec3') {
          exprA =
            inputA.kind === 'vec3'
              ? inputA.expr
              : inputA.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB.kind === 'vec3'
              ? inputB.expr
              : inputB.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (combined === 'vec4') {
          exprA =
            inputA.kind === 'vec4'
              ? inputA.expr
              : inputA.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB.kind === 'vec4'
              ? inputB.expr
              : inputB.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `${fn}(${exprA}, ${exprB})`
        const name = nextVar('vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: combined }
        cache.set(key, out)
        return out
      }
      if (node.type === 'step') {
        const edgeInput = getInput('edge')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edgeInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprEdge = edgeInput?.expr ?? 'float(0.0)'
        let exprX = xInput?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprEdge =
            edgeInput?.kind === 'color'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asColor(edgeInput.expr, 'number')
                : 'color(0.0)'
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprEdge =
            edgeInput?.kind === 'vec2'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec2(edgeInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprEdge =
            edgeInput?.kind === 'vec3'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec3(edgeInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprEdge =
            edgeInput?.kind === 'vec4'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec4(edgeInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `step(${exprEdge}, ${exprX})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'fract' ||
        node.type === 'floor' ||
        node.type === 'ceil' ||
        node.type === 'round' ||
        node.type === 'trunc' ||
        node.type === 'exp' ||
        node.type === 'log' ||
        node.type === 'sign' ||
        node.type === 'oneMinus' ||
        node.type === 'negate' ||
        node.type === 'exp2' ||
        node.type === 'log2' ||
        node.type === 'pow2' ||
        node.type === 'pow3' ||
        node.type === 'pow4' ||
        node.type === 'sqrt' ||
        node.type === 'saturate'
      ) {
        const input = getInput('value')
        if (!input || (!isVectorKind(input.kind) && input.kind !== 'number')) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const fn =
          node.type === 'fract'
            ? 'fract'
            : node.type === 'floor'
              ? 'floor'
              : node.type === 'ceil'
                ? 'ceil'
                : node.type === 'round'
                  ? 'round'
                  : node.type === 'trunc'
                    ? 'trunc'
                    : node.type === 'exp'
                      ? 'exp'
                      : node.type === 'exp2'
                        ? 'exp2'
                        : node.type === 'log'
                          ? 'log'
                          : node.type === 'log2'
                            ? 'log2'
                            : node.type === 'sign'
                              ? 'sign'
                              : node.type === 'oneMinus'
                                ? 'oneMinus'
                                : node.type === 'pow2'
                                  ? 'pow2'
                                  : node.type === 'pow3'
                                    ? 'pow3'
                                    : node.type === 'pow4'
                                      ? 'pow4'
                                      : node.type === 'sqrt'
                                        ? 'sqrt'
                                        : node.type === 'saturate'
                                          ? 'saturate'
                                          : 'negate'
        const expr = `${fn}(${input.expr})`
        const name = nextVar(input.kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: input.kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'mix') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const inputT = getInput('t')
        const exprT = inputT?.kind === 'number' ? inputT.expr : 'float(0.5)'
        const typeA = inputA?.kind ?? 'number'
        const typeB = inputB?.kind ?? 'number'
        const combined = combineTypes(typeA, typeB)
        if (combined === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprA = inputA?.expr ?? 'float(0.0)'
        let exprB = inputB?.expr ?? 'float(1.0)'
        if (combined === 'color') {
          exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(1.0)'
        } else if (combined === 'vec2') {
          exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(1.0, 1.0)'
        } else if (combined === 'vec3') {
          exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
        } else if (combined === 'vec4') {
          exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
        } else if (combined === 'number') {
          exprA = inputA?.kind === 'number' ? inputA.expr : 'float(0.0)'
          exprB = inputB?.kind === 'number' ? inputB.expr : 'float(1.0)'
        }
        const expr = `mix(${exprA}, ${exprB}, ${exprT})`
        const name = nextVar(combined === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: combined }
        cache.set(key, out)
        return out
      }
      if (node.type === 'smoothstep') {
        const edge0Input = getInput('edge0')
        const edge1Input = getInput('edge1')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edge0Input?.kind ?? 'number',
          edge1Input?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprEdge0 = edge0Input?.expr ?? 'float(0.0)'
        let exprEdge1 = edge1Input?.expr ?? 'float(1.0)'
        let exprX = xInput?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprEdge0 =
            edge0Input?.kind === 'color'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asColor(edge0Input.expr, 'number')
                : 'color(0.0)'
          exprEdge1 =
            edge1Input?.kind === 'color'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asColor(edge1Input.expr, 'number')
                : 'color(1.0)'
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprEdge0 =
            edge0Input?.kind === 'vec2'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec2(edge0Input.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec2'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec2(edge1Input.expr, 'number')
                : 'vec2(1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprEdge0 =
            edge0Input?.kind === 'vec3'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec3(edge0Input.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec3'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec3(edge1Input.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprEdge0 =
            edge0Input?.kind === 'vec4'
              ? edge0Input.expr
              : edge0Input?.kind === 'number'
                ? asVec4(edge0Input.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprEdge1 =
            edge1Input?.kind === 'vec4'
              ? edge1Input.expr
              : edge1Input?.kind === 'number'
                ? asVec4(edge1Input.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `smoothstep(${exprEdge0}, ${exprEdge1}, ${exprX})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'pow') {
        const baseInput = getInput('base')
        const expInput = getInput('exp')
        const kind = resolveVectorOutputKind([
          baseInput?.kind ?? 'number',
          expInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprBase = baseInput?.expr ?? 'float(0.0)'
        let exprExp = expInput?.expr ?? 'float(1.0)'
        if (kind === 'color') {
          exprBase =
            baseInput?.kind === 'color'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asColor(baseInput.expr, 'number')
                : 'color(0.0)'
          exprExp =
            expInput?.kind === 'color'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asColor(expInput.expr, 'number')
                : 'color(1.0)'
        } else if (kind === 'vec2') {
          exprBase =
            baseInput?.kind === 'vec2'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec2(baseInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprExp =
            expInput?.kind === 'vec2'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec2(expInput.expr, 'number')
                : 'vec2(1.0, 1.0)'
        } else if (kind === 'vec3') {
          exprBase =
            baseInput?.kind === 'vec3'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec3(baseInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprExp =
            expInput?.kind === 'vec3'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec3(expInput.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
        } else if (kind === 'vec4') {
          exprBase =
            baseInput?.kind === 'vec4'
              ? baseInput.expr
              : baseInput?.kind === 'number'
                ? asVec4(baseInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprExp =
            expInput?.kind === 'vec4'
              ? expInput.expr
              : expInput?.kind === 'number'
                ? asVec4(expInput.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
        }
        const expr = `pow(${exprBase}, ${exprExp})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'length') {
        const input = getInput('value')
        const valueExpr =
          input && isVectorKind(input.kind) ? input.expr : 'vec3(0.0, 0.0, 0.0)'
        const expr = `length(${valueExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (node.type === 'smoothstepElement') {
        const lowInput = getInput('low')
        const highInput = getInput('high')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          lowInput?.kind ?? 'number',
          highInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprX = xInput?.expr ?? 'float(0.0)'
        let exprLow = lowInput?.expr ?? 'float(0.0)'
        let exprHigh = highInput?.expr ?? 'float(1.0)'
        if (kind === 'color') {
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
          exprLow =
            lowInput?.kind === 'color'
              ? lowInput.expr
              : lowInput?.kind === 'number'
                ? asColor(lowInput.expr, 'number')
                : 'color(0.0)'
          exprHigh =
            highInput?.kind === 'color'
              ? highInput.expr
              : highInput?.kind === 'number'
                ? asColor(highInput.expr, 'number')
                : 'color(1.0)'
        } else if (kind === 'vec2') {
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprLow =
            lowInput?.kind === 'vec2'
              ? lowInput.expr
              : lowInput?.kind === 'number'
                ? asVec2(lowInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprHigh =
            highInput?.kind === 'vec2'
              ? highInput.expr
              : highInput?.kind === 'number'
                ? asVec2(highInput.expr, 'number')
                : 'vec2(1.0, 1.0)'
        } else if (kind === 'vec3') {
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprLow =
            lowInput?.kind === 'vec3'
              ? lowInput.expr
              : lowInput?.kind === 'number'
                ? asVec3(lowInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprHigh =
            highInput?.kind === 'vec3'
              ? highInput.expr
              : highInput?.kind === 'number'
                ? asVec3(highInput.expr, 'number')
                : 'vec3(1.0, 1.0, 1.0)'
        } else if (kind === 'vec4') {
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprLow =
            lowInput?.kind === 'vec4'
              ? lowInput.expr
              : lowInput?.kind === 'number'
                ? asVec4(lowInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprHigh =
            highInput?.kind === 'vec4'
              ? highInput.expr
              : highInput?.kind === 'number'
                ? asVec4(highInput.expr, 'number')
                : 'vec4(1.0, 1.0, 1.0, 1.0)'
        }
        const expr = `smoothstepElement(${exprX}, ${exprLow}, ${exprHigh})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'stepElement') {
        const edgeInput = getInput('edge')
        const xInput = getInput('x')
        const kind = resolveVectorOutputKind([
          edgeInput?.kind ?? 'number',
          xInput?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        let exprX = xInput?.expr ?? 'float(0.0)'
        let exprEdge = edgeInput?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprX =
            xInput?.kind === 'color'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asColor(xInput.expr, 'number')
                : 'color(0.0)'
          exprEdge =
            edgeInput?.kind === 'color'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asColor(edgeInput.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprX =
            xInput?.kind === 'vec2'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec2(xInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprEdge =
            edgeInput?.kind === 'vec2'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec2(edgeInput.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprX =
            xInput?.kind === 'vec3'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec3(xInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprEdge =
            edgeInput?.kind === 'vec3'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec3(edgeInput.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprX =
            xInput?.kind === 'vec4'
              ? xInput.expr
              : xInput?.kind === 'number'
                ? asVec4(xInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprEdge =
            edgeInput?.kind === 'vec4'
              ? edgeInput.expr
              : edgeInput?.kind === 'number'
                ? asVec4(edgeInput.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const expr = `stepElement(${exprX}, ${exprEdge})`
        const name = nextVar(kind === 'number' ? 'num' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'lessThan' ||
        node.type === 'lessThanEqual' ||
        node.type === 'greaterThan' ||
        node.type === 'greaterThanEqual' ||
        node.type === 'equal' ||
        node.type === 'notEqual'
      ) {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const compareFn =
          node.type === 'lessThan'
            ? 'lessThan'
            : node.type === 'lessThanEqual'
              ? 'lessThanEqual'
              : node.type === 'greaterThan'
                ? 'greaterThan'
                : node.type === 'greaterThanEqual'
                  ? 'greaterThanEqual'
                  : node.type === 'equal'
                    ? 'equal'
                    : 'notEqual'
        let exprA = inputA?.expr ?? 'float(0.0)'
        let exprB = inputB?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const oneExpr =
          kind === 'number'
            ? 'float(1.0)'
            : kind === 'color'
              ? 'color(1.0)'
              : kind === 'vec2'
                ? 'vec2(1.0, 1.0)'
                : kind === 'vec3'
                  ? 'vec3(1.0, 1.0, 1.0)'
                  : 'vec4(1.0, 1.0, 1.0, 1.0)'
        const zeroExpr =
          kind === 'number'
            ? 'float(0.0)'
            : kind === 'color'
              ? 'color(0.0)'
              : kind === 'vec2'
                ? 'vec2(0.0, 0.0)'
                : kind === 'vec3'
                  ? 'vec3(0.0, 0.0, 0.0)'
                  : 'vec4(0.0, 0.0, 0.0, 0.0)'
        const expr = `select(${compareFn}(${exprA}, ${exprB}), ${oneExpr}, ${zeroExpr})`
        const name = nextVar(kind === 'number' ? 'num' : kind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'and' || node.type === 'or') {
        const inputA = getInput('a')
        const inputB = getInput('b')
        const kind = resolveVectorOutputKind([
          inputA?.kind ?? 'number',
          inputB?.kind ?? 'number',
        ])
        if (kind === 'unknown') {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const halfExpr =
          kind === 'number'
            ? 'float(0.5)'
            : kind === 'color'
              ? 'color(0.5)'
              : kind === 'vec2'
                ? 'vec2(0.5, 0.5)'
                : kind === 'vec3'
                  ? 'vec3(0.5, 0.5, 0.5)'
                  : 'vec4(0.5, 0.5, 0.5, 0.5)'
        let exprA = inputA?.expr ?? 'float(0.0)'
        let exprB = inputB?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprA =
            inputA?.kind === 'color'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asColor(inputA.expr, 'number')
                : 'color(0.0)'
          exprB =
            inputB?.kind === 'color'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asColor(inputB.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprA =
            inputA?.kind === 'vec2'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec2(inputA.expr, 'number')
                : 'vec2(0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec2'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec2(inputB.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprA =
            inputA?.kind === 'vec3'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec3(inputA.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
          exprB =
            inputB?.kind === 'vec3'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec3(inputB.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprA =
            inputA?.kind === 'vec4'
              ? inputA.expr
              : inputA?.kind === 'number'
                ? asVec4(inputA.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
          exprB =
            inputB?.kind === 'vec4'
              ? inputB.expr
              : inputB?.kind === 'number'
                ? asVec4(inputB.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const maskA = `step(${halfExpr}, ${exprA})`
        const maskB = `step(${halfExpr}, ${exprB})`
        const expr = node.type === 'and' ? `(${maskA} * ${maskB})` : `max(${maskA}, ${maskB})`
        const name = nextVar(kind === 'number' ? 'num' : kind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }
      if (node.type === 'not') {
        const input = getInput('value')
        const kind = input?.kind ?? 'number'
        if (kind !== 'number' && !isVectorKind(kind)) {
          const out = { expr: 'float(0.0)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        const halfExpr =
          kind === 'number'
            ? 'float(0.5)'
            : kind === 'color'
              ? 'color(0.5)'
              : kind === 'vec2'
                ? 'vec2(0.5, 0.5)'
                : kind === 'vec3'
                  ? 'vec3(0.5, 0.5, 0.5)'
                  : 'vec4(0.5, 0.5, 0.5, 0.5)'
        let exprValue = input?.expr ?? 'float(0.0)'
        if (kind === 'color') {
          exprValue =
            input?.kind === 'color'
              ? input.expr
              : input?.kind === 'number'
                ? asColor(input.expr, 'number')
                : 'color(0.0)'
        } else if (kind === 'vec2') {
          exprValue =
            input?.kind === 'vec2'
              ? input.expr
              : input?.kind === 'number'
                ? asVec2(input.expr, 'number')
                : 'vec2(0.0, 0.0)'
        } else if (kind === 'vec3') {
          exprValue =
            input?.kind === 'vec3'
              ? input.expr
              : input?.kind === 'number'
                ? asVec3(input.expr, 'number')
                : 'vec3(0.0, 0.0, 0.0)'
        } else if (kind === 'vec4') {
          exprValue =
            input?.kind === 'vec4'
              ? input.expr
              : input?.kind === 'number'
                ? asVec4(input.expr, 'number')
                : 'vec4(0.0, 0.0, 0.0, 1.0)'
        }
        const mask = `step(${halfExpr}, ${exprValue})`
        const expr = `oneMinus(${mask})`
        const name = nextVar(kind === 'number' ? 'num' : kind === 'color' ? 'col' : 'vec')
        decls.push(`const ${name} = ${expr};`)
        const out = {
          expr: name,
          kind: kind === 'color' ? ('color' as const) : (kind as typeof kind),
        }
        cache.set(key, out)
        return out
      }
      if (node.type === 'remap' || node.type === 'remapClamp') {
        const input = getInput('value')
        const inLowInput = getInput('inLow')
        const inHighInput = getInput('inHigh')
        const outLowInput = getInput('outLow')
        const outHighInput = getInput('outHigh')
        const kind = input?.kind ?? 'number'
        const fn = node.type === 'remap' ? 'remap' : 'remapClamp'
        if (kind === 'number') {
          const valueExpr = input?.kind === 'number' ? input.expr : 'float(0.0)'
          const inLowExpr = inLowInput?.kind === 'number' ? inLowInput.expr : 'float(0.0)'
          const inHighExpr = inHighInput?.kind === 'number' ? inHighInput.expr : 'float(1.0)'
          const outLowExpr = outLowInput?.kind === 'number' ? outLowInput.expr : 'float(0.0)'
          const outHighExpr =
            outHighInput?.kind === 'number' ? outHighInput.expr : 'float(1.0)'
          const expr = `${fn}(${valueExpr}, ${inLowExpr}, ${inHighExpr}, ${outLowExpr}, ${outHighExpr})`
          const name = nextVar('num')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'number' as const }
          cache.set(key, out)
          return out
        }
        if (kind === 'vec2') {
          const valueExpr = input ? toVec2Expr(input) : 'vec2(0.0, 0.0)'
          const inLowExpr = inLowInput ? toVec2Expr(inLowInput) : 'vec2(0.0, 0.0)'
          const inHighExpr = inHighInput ? toVec2Expr(inHighInput) : 'vec2(1.0, 1.0)'
          const outLowExpr = outLowInput ? toVec2Expr(outLowInput) : 'vec2(0.0, 0.0)'
          const outHighExpr = outHighInput ? toVec2Expr(outHighInput) : 'vec2(1.0, 1.0)'
          const expr = `${fn}(${valueExpr}, ${inLowExpr}, ${inHighExpr}, ${outLowExpr}, ${outHighExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'vec2' as const }
          cache.set(key, out)
          return out
        }
        if (kind === 'vec3' || kind === 'color') {
          const valueExpr = input ? toVec3Expr(input) : 'vec3(0.0, 0.0, 0.0)'
          const inLowExpr = inLowInput ? toVec3Expr(inLowInput) : 'vec3(0.0, 0.0, 0.0)'
          const inHighExpr = inHighInput ? toVec3Expr(inHighInput) : 'vec3(1.0, 1.0, 1.0)'
          const outLowExpr = outLowInput ? toVec3Expr(outLowInput) : 'vec3(0.0, 0.0, 0.0)'
          const outHighExpr = outHighInput ? toVec3Expr(outHighInput) : 'vec3(1.0, 1.0, 1.0)'
          const expr = `${fn}(${valueExpr}, ${inLowExpr}, ${inHighExpr}, ${outLowExpr}, ${outHighExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const out = {
            expr: name,
            kind: kind === 'color' ? ('color' as const) : ('vec3' as const),
          }
          cache.set(key, out)
          return out
        }
        if (kind === 'vec4') {
          const valueExpr = input ? toVec4Expr(input) : 'vec4(0.0, 0.0, 0.0, 1.0)'
          const inLowExpr = inLowInput ? toVec4Expr(inLowInput) : 'vec4(0.0, 0.0, 0.0, 1.0)'
          const inHighExpr = inHighInput ? toVec4Expr(inHighInput) : 'vec4(1.0, 1.0, 1.0, 1.0)'
          const outLowExpr = outLowInput ? toVec4Expr(outLowInput) : 'vec4(0.0, 0.0, 0.0, 1.0)'
          const outHighExpr = outHighInput ? toVec4Expr(outHighInput) : 'vec4(1.0, 1.0, 1.0, 1.0)'
          const expr = `${fn}(${valueExpr}, ${inLowExpr}, ${inHighExpr}, ${outLowExpr}, ${outHighExpr})`
          const name = nextVar('vec')
          decls.push(`const ${name} = ${expr};`)
          const out = { expr: name, kind: 'vec4' as const }
          cache.set(key, out)
          return out
        }
      }
      if (node.type === 'luminance') {
        const input = getInput('value')
        const sourceExpr = !input
          ? 'vec3(0.0, 0.0, 0.0)'
          : input.kind === 'vec3' || input.kind === 'color'
            ? input.expr
            : input.kind === 'vec2'
              ? `vec3(${input.expr}.x, ${input.expr}.y, 0.0)`
              : input.kind === 'vec4'
                ? `vec3(${input.expr}.x, ${input.expr}.y, ${input.expr}.z)`
                : input.kind === 'number'
                  ? asVec3(input.expr, 'number')
                  : 'vec3(0.0, 0.0, 0.0)'
        const expr = `luminance(${sourceExpr})`
        const name = nextVar('num')
        decls.push(`const ${name} = ${expr};`)
        const out = { expr: name, kind: 'number' as const }
        cache.set(key, out)
        return out
      }
      if (
        node.type === 'grayscale' ||
        node.type === 'saturation' ||
        node.type === 'posterize' ||
        node.type === 'sRGBTransferEOTF' ||
        node.type === 'sRGBTransferOETF' ||
        node.type === 'linearToneMapping' ||
        node.type === 'reinhardToneMapping' ||
        node.type === 'cineonToneMapping' ||
        node.type === 'acesFilmicToneMapping' ||
        node.type === 'agxToneMapping' ||
        node.type === 'neutralToneMapping'
      ) {
        const input = getInput('value')
        const sourceExpr = !input
          ? 'vec3(0.0, 0.0, 0.0)'
          : input.kind === 'vec3' || input.kind === 'color'
            ? input.expr
            : input.kind === 'vec2'
              ? `vec3(${input.expr}.x, ${input.expr}.y, 0.0)`
              : input.kind === 'vec4'
                ? `vec3(${input.expr}.x, ${input.expr}.y, ${input.expr}.z)`
                : input.kind === 'number'
                  ? asVec3(input.expr, 'number')
                  : 'vec3(0.0, 0.0, 0.0)'
        let expr = sourceExpr
        if (node.type === 'grayscale') {
          expr = `grayscale(${sourceExpr})`
        } else if (node.type === 'saturation') {
          const amountInput = getInput('amount')
          const amountExpr = amountInput?.kind === 'number' ? amountInput.expr : 'float(1.0)'
          expr = `saturation(${sourceExpr}, ${amountExpr})`
        } else if (node.type === 'posterize') {
          const stepsInput = getInput('steps')
          const stepsExpr = stepsInput?.kind === 'number' ? stepsInput.expr : 'float(4.0)'
          expr = `posterize(${sourceExpr}, ${stepsExpr})`
        } else if (node.type === 'sRGBTransferEOTF') {
          expr = `sRGBTransferEOTF(${sourceExpr})`
        } else if (node.type === 'sRGBTransferOETF') {
          expr = `sRGBTransferOETF(${sourceExpr})`
        } else if (node.type === 'linearToneMapping') {
          expr = `linearToneMapping(${sourceExpr}, float(1))`
        } else if (node.type === 'reinhardToneMapping') {
          expr = `reinhardToneMapping(${sourceExpr}, float(1))`
        } else if (node.type === 'cineonToneMapping') {
          expr = `cineonToneMapping(${sourceExpr}, float(1))`
        } else if (node.type === 'acesFilmicToneMapping') {
          expr = `acesFilmicToneMapping(${sourceExpr}, float(1))`
        } else if (node.type === 'agxToneMapping') {
          expr = `agxToneMapping(${sourceExpr}, float(1))`
        } else {
          expr = `neutralToneMapping(${sourceExpr}, float(1))`
        }
        const name = nextVar('col')
        decls.push(`const ${name} = ${expr};`)
        const kind = input?.kind === 'color' || !input ? ('color' as const) : ('vec3' as const)
        const out = { expr: name, kind }
        cache.set(key, out)
        return out
      }

      if (node.type === 'material' || node.type === 'physicalMaterial') {
        const pin = outputPin ?? 'baseColor'
        const base = getInput('baseColor')
        const tex = getInput('baseColorTexture')
        if (pin === 'baseColor') {
          if (base && tex) {
            const expr = `${asColor(base.expr, base.kind === 'number' ? 'number' : 'color')}.mul(${asColor(
              tex.expr,
              tex.kind === 'number' ? 'number' : 'color',
            )})`
            const name = nextVar('col')
            decls.push(`const ${name} = ${expr};`)
            const out = { expr: name, kind: 'color' as const }
            cache.set(key, out)
            return out
          }
          if (base) {
            const out = {
              expr: asColor(base.expr, base.kind === 'number' ? 'number' : 'color'),
              kind: 'color' as const,
            }
            cache.set(key, out)
            return out
          }
          if (tex) {
            const out = {
              expr: asColor(tex.expr, tex.kind === 'number' ? 'number' : 'color'),
              kind: 'color' as const,
            }
            cache.set(key, out)
            return out
          }
        }
        if (pin === 'roughness' || pin === 'metalness') {
          const input = getInput(pin)
          const out = input ?? { expr: 'float(0.7)', kind: 'number' as const }
          cache.set(key, out)
          return out
        }
      }

      if (node.type === 'output') {
        const input = getInput('baseColor')
        const out =
          input?.kind === 'color'
            ? { expr: input.expr, kind: 'color' as const }
            : input?.kind === 'number'
              ? { expr: asColor(input.expr, 'number'), kind: 'color' as const }
              : { expr: `color(${FALLBACK_COLOR})`, kind: 'color' as const }
        cache.set(key, out)
        return out
      }

      if (node.type === 'vertexOutput') {
        const input = getInput('position')
        const out =
          input?.kind === 'vec3'
            ? { expr: input.expr, kind: 'vec3' as const }
            : input?.kind === 'number'
              ? { expr: asVec3(input.expr, 'number'), kind: 'vec3' as const }
              : { expr: 'vec3(0.0, 0.0, 0.0)', kind: 'vec3' as const }
        cache.set(key, out)
        return out
      }

      const fallback = { expr: 'float(0.0)', kind: 'number' as const }
      cache.set(key, fallback)
      return fallback
    }

    const baseColor = resolveExpr(baseColorConn.from.nodeId, baseColorConn.from.pin)
    const roughnessConn = getOutputConnection(connectionMap, outputNode, 'roughness')
    const metalnessConn = getOutputConnection(connectionMap, outputNode, 'metalness')
    const roughness = roughnessConn
      ? resolveExpr(roughnessConn.from.nodeId, roughnessConn.from.pin)
      : { expr: 'float(0.7)', kind: 'number' as const }
    const metalness = metalnessConn
      ? resolveExpr(metalnessConn.from.nodeId, metalnessConn.from.pin)
      : { expr: 'float(0.1)', kind: 'number' as const }

    const baseColorExpr =
      baseColor.kind === 'color'
        ? baseColor.expr
        : baseColor.kind === 'number'
          ? asColor(baseColor.expr, 'number')
          : `color(${FALLBACK_COLOR})`
    const { standardMaterialNode, physicalMaterialNode, basicMaterialNode } =
      getMaterialNodesFromOutput(outputNode, nodeMap, connectionMap)
    const getStandardConn = (pin: string) => {
      const node = standardMaterialNode ?? physicalMaterialNode
      return node ? connectionMap.get(`${node.id}:${pin}`) : null
    }
    const getStandardNumberExpr = (pin: string) => {
      const conn = getStandardConn(pin)
      if (!conn) return null
      const resolved = resolveExpr(conn.from.nodeId, conn.from.pin)
      return resolved.kind === 'number' ? resolved.expr : null
    }
    const getStandardColorExpr = (pin: string) => {
      const conn = getStandardConn(pin)
      if (!conn) return null
      const resolved = resolveExpr(conn.from.nodeId, conn.from.pin)
      if (resolved.kind === 'color') return resolved.expr
      if (resolved.kind === 'number') return asColor(resolved.expr, 'number')
      return null
    }
    const getStandardNumberLiteral = (pin: string) => {
      const conn = getStandardConn(pin)
      if (!conn) return null
      const source = nodeMap.get(conn.from.nodeId)
      if (source?.type === 'number') {
        return parseNumber(source.value)
      }
      return null
    }
    const getStandardTextureId = (pin: string) => {
      const conn = getStandardConn(pin)
      if (!conn) return null
      const source = nodeMap.get(conn.from.nodeId)
      if (source?.type === 'texture') return source.id
      return null
    }
    const getBasicConn = (pin: string) =>
      basicMaterialNode ? connectionMap.get(`${basicMaterialNode.id}:${pin}`) : null
    const getBasicNumberExpr = (pin: string) => {
      const conn = getBasicConn(pin)
      if (!conn) return null
      const resolved = resolveExpr(conn.from.nodeId, conn.from.pin)
      return resolved.kind === 'number' ? resolved.expr : null
    }
    const getBasicNumberLiteral = (pin: string) => {
      const conn = getBasicConn(pin)
      if (!conn) return null
      const source = nodeMap.get(conn.from.nodeId)
      if (source?.type === 'number') {
        return parseNumber(source.value)
      }
      return null
    }
    const getBasicTextureId = (pin: string) => {
      const conn = getBasicConn(pin)
      if (!conn) return null
      const source = nodeMap.get(conn.from.nodeId)
      if (source?.type === 'texture') return source.id
      return null
    }
    decls.push(`material.colorNode = ${baseColorExpr};`)
    if (materialKind === 'standard' || materialKind === 'physical') {
      decls.push(`material.roughnessNode = ${roughness.expr};`)
      decls.push(`material.metalnessNode = ${metalness.expr};`)
      if (standardMaterialNode || physicalMaterialNode) {
        const emissiveExpr = getStandardColorExpr('emissive')
        if (emissiveExpr) {
          decls.push(`material.emissiveNode = ${emissiveExpr};`)
        }
        const emissiveMapId = getStandardTextureId('emissiveMap')
        if (emissiveMapId) {
          decls.push(`material.emissiveMap = textureFromNode('${emissiveMapId}');`)
        }
        const emissiveIntensity = getStandardNumberLiteral('emissiveIntensity')
        if (emissiveIntensity !== null) {
          decls.push(`material.emissiveIntensity = ${emissiveIntensity.toFixed(3)};`)
        }
        const roughnessMapId = getStandardTextureId('roughnessMap')
        if (roughnessMapId) {
          decls.push(`material.roughnessMap = textureFromNode('${roughnessMapId}');`)
        }
        const metalnessMapId = getStandardTextureId('metalnessMap')
        if (metalnessMapId) {
          decls.push(`material.metalnessMap = textureFromNode('${metalnessMapId}');`)
        }
        const normalMapId = getStandardTextureId('normalMap')
        if (normalMapId) {
          decls.push(`material.normalMap = textureFromNode('${normalMapId}');`)
        }
        const normalScale = getStandardNumberLiteral('normalScale')
        if (normalScale !== null) {
          const value = normalScale.toFixed(3)
          decls.push(`material.normalScale = new Vector2(${value}, ${value});`)
        }
        const aoMapId = getStandardTextureId('aoMap')
        if (aoMapId) {
          decls.push(`material.aoMap = textureFromNode('${aoMapId}');`)
        }
        const aoMapIntensity = getStandardNumberLiteral('aoMapIntensity')
        if (aoMapIntensity !== null) {
          decls.push(`material.aoMapIntensity = ${aoMapIntensity.toFixed(3)};`)
        }
        const envMapId = getStandardTextureId('envMap')
        if (envMapId) {
          decls.push(`material.envMap = textureFromNode('${envMapId}');`)
        }
        const envMapIntensity = getStandardNumberLiteral('envMapIntensity')
        if (envMapIntensity !== null) {
          decls.push(`material.envMapIntensity = ${envMapIntensity.toFixed(3)};`)
        }
        const opacityExpr = getStandardNumberExpr('opacity')
        if (opacityExpr) {
          decls.push(`material.opacityNode = ${opacityExpr};`)
        }
        const alphaTestExpr = getStandardNumberExpr('alphaTest')
        if (alphaTestExpr) {
          decls.push(`material.alphaTestNode = ${alphaTestExpr};`)
        }
        const alphaHashLiteral = getStandardNumberLiteral('alphaHash')
        if (alphaHashLiteral !== null) {
          decls.push(`material.alphaHash = ${alphaHashLiteral > 0.5 ? 'true' : 'false'};`)
        } else if (getStandardConn('alphaHash')) {
          decls.push('material.alphaHash = true;')
        }
        const opacityLiteral = getStandardNumberLiteral('opacity')
        if (opacityLiteral !== null) {
          decls.push(`material.transparent = ${opacityLiteral < 1 ? 'true' : 'false'};`)
        }
        if (materialKind === 'physical') {
          const clearcoatExpr = getStandardNumberExpr('clearcoat')
          if (clearcoatExpr) {
            decls.push(`material.clearcoatNode = ${clearcoatExpr};`)
          }
          const clearcoatLiteral = getStandardNumberLiteral('clearcoat')
          if (clearcoatLiteral !== null) {
            decls.push(`material.clearcoat = ${clearcoatLiteral.toFixed(3)};`)
          }
          const clearcoatRoughnessExpr = getStandardNumberExpr('clearcoatRoughness')
          if (clearcoatRoughnessExpr) {
            decls.push(`material.clearcoatRoughnessNode = ${clearcoatRoughnessExpr};`)
          }
          const clearcoatRoughnessLiteral = getStandardNumberLiteral('clearcoatRoughness')
          if (clearcoatRoughnessLiteral !== null) {
            decls.push(
              `material.clearcoatRoughness = ${clearcoatRoughnessLiteral.toFixed(3)};`,
            )
          }
          const clearcoatNormalId = getStandardTextureId('clearcoatNormal')
          if (clearcoatNormalId) {
            decls.push(
              `material.clearcoatNormalMap = textureFromNode('${clearcoatNormalId}');`,
            )
          }
        }
      }
    }
    if (materialKind === 'basic') {
      const opacityExpr = getBasicNumberExpr('opacity')
      if (opacityExpr) {
        decls.push(`material.opacityNode = ${opacityExpr};`)
      }
      const alphaTestExpr = getBasicNumberExpr('alphaTest')
      if (alphaTestExpr) {
        decls.push(`material.alphaTestNode = ${alphaTestExpr};`)
      }
      const alphaHashLiteral = getBasicNumberLiteral('alphaHash')
      if (alphaHashLiteral !== null) {
        decls.push(`material.alphaHash = ${alphaHashLiteral > 0.5 ? 'true' : 'false'};`)
      } else if (getBasicConn('alphaHash')) {
        decls.push('material.alphaHash = true;')
      }
      const mapId = getBasicTextureId('map')
      if (mapId) {
        decls.push(`material.map = textureFromNode('${mapId}');`)
      }
      const alphaMapId = getBasicTextureId('alphaMap')
      if (alphaMapId) {
        decls.push(`material.alphaMap = textureFromNode('${alphaMapId}');`)
        decls.push('material.transparent = true;')
      }
      const aoMapId = getBasicTextureId('aoMap')
      if (aoMapId) {
        decls.push(`material.aoMap = textureFromNode('${aoMapId}');`)
      }
      const envMapId = getBasicTextureId('envMap')
      if (envMapId) {
        decls.push(`material.envMap = textureFromNode('${envMapId}');`)
      }
      const reflectivity =
        getBasicNumberLiteral('reflectivity') ?? getBasicNumberLiteral('envMapIntensity')
      if (reflectivity !== null) {
        decls.push(`material.reflectivity = ${reflectivity.toFixed(3)};`)
      }
    }
    if (vertexOutputNode) {
      const positionConn = connectionMap.get(`${vertexOutputNode.id}:position`)
      if (positionConn) {
        const positionValue = resolveExpr(
          positionConn.from.nodeId,
          positionConn.from.pin,
        )
        const positionExpr =
          positionValue.kind === 'vec3'
            ? positionValue.expr
            : positionValue.kind === 'number'
              ? asVec3(positionValue.expr, 'number')
              : 'vec3(0.0, 0.0, 0.0)'
        decls.push(`material.positionNode = positionLocal.add(${positionExpr});`)
      } else {
        decls.push('material.positionNode = positionLocal;')
      }
    }

    decls.push('return material;')
    const code = decls.join('\n')
    const usedImports = tslImportNames.filter((name) => {
      const regex = new RegExp(`\\b${name}\\b`, 'g')
      return regex.test(code)
    })
    const importLine = usedImports.length
      ? `const { ${usedImports.join(', ')} } = TSL;`
      : ''
    return code
      .replace(`const { ${tslImportPlaceholder} } = TSL;`, importLine)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const buildMaterialExport = (
    code: string,
    format: 'js' | 'ts',
    style: 'module' | 'snippet',
    includeImports = true,
  ) => {
    const expanded = expandFunctions(nodes, connections, functions)
    const textureIds = expanded.nodes
      .filter((node) => node.type === 'texture')
      .map((node) => node.id)
    const gltfTextureIds = expanded.nodes
      .filter((node) => node.type === 'gltfMaterial')
      .flatMap((node) => {
        const entry = gltfMapRef.current[node.id]
        const materialCount = entry?.materials?.length ?? 0
        if (!materialCount) return []
        const material = entry?.materials?.[
          getMaterialIndex(node, materialCount)
        ] as GltfMaterial | undefined
        if (!material) return []
        const ids: string[] = []
        if (material.map) ids.push(getGltfMaterialTextureId(node.id, 'map'))
        if (material.roughnessMap)
          ids.push(getGltfMaterialTextureId(node.id, 'roughnessMap'))
        if (material.metalnessMap)
          ids.push(getGltfMaterialTextureId(node.id, 'metalnessMap'))
        if (material.emissiveMap)
          ids.push(getGltfMaterialTextureId(node.id, 'emissiveMap'))
        if (material.normalMap)
          ids.push(getGltfMaterialTextureId(node.id, 'normalMap'))
        if (material.aoMap) ids.push(getGltfMaterialTextureId(node.id, 'aoMap'))
        if (material.envMap) ids.push(getGltfMaterialTextureId(node.id, 'envMap'))
        return ids
      })
    const gltfTextureNodeIds = expanded.nodes
      .filter((node) => node.type === 'gltfTexture')
      .filter((node) => (gltfMapRef.current[node.id]?.textures.length ?? 0) > 0)
      .map((node) => getGltfTextureId(node.id))
    const allTextureIds = [...textureIds, ...gltfTextureIds, ...gltfTextureNodeIds]
    const needsBasic = code.includes('MeshBasicNodeMaterial')
    const needsStandard = code.includes('MeshStandardNodeMaterial')
    const needsPhysical = code.includes('MeshPhysicalNodeMaterial')
    const needsVector2 = code.includes('new Vector2')
    const usesTextures = allTextureIds.length > 0
    const materialImports = [
      needsBasic ? 'MeshBasicNodeMaterial' : null,
      needsStandard ? 'MeshStandardNodeMaterial' : null,
      needsPhysical ? 'MeshPhysicalNodeMaterial' : null,
    ].filter(Boolean)
    const materialReturnType = materialImports.length
      ? materialImports.join(' | ')
      : 'unknown'
    const threeImports = [
      usesTextures ? 'Texture' : null,
      needsVector2 ? 'Vector2' : null,
    ].filter(Boolean)
    const exportPrefix = style === 'module' ? 'export ' : ''
    const header =
      format === 'ts'
        ? [
            ...(includeImports ? [`import { TSL } from 'three/tsl';`] : []),
            ...(includeImports && materialImports.length
              ? [`import { ${materialImports.join(', ')} } from 'three/webgpu';`]
              : []),
            ...(includeImports && threeImports.length
              ? [`import { ${threeImports.join(', ')} } from 'three';`]
              : []),
            ``,
            `${exportPrefix}type TSLExportOptions = {`,
            ...(usesTextures ? [`  textures?: Record<string, Texture>;`] : []),
            `  timeUniform?: ReturnType<typeof TSL.uniform>;`,
            `};`,
            ``,
            `${exportPrefix}const textureIds = ${JSON.stringify(allTextureIds, null, 2)};`,
            ``,
            `${exportPrefix}const makeNodeMaterial = (`,
            `  options: TSLExportOptions = {},`,
            `): { material: ${materialReturnType}; uniforms: { time: ReturnType<typeof TSL.uniform> } } => {`,
            ...(usesTextures ? [`  const textures = options.textures ?? {};`] : []),
            `  const timeUniform = options.timeUniform ?? TSL.uniform(0);`,
            ...(usesTextures
              ? [`  const textureFromNode = (id: string) => textures[id] ?? null;`]
              : [`  const textureFromNode = (_id: string) => null;`]),
            ``,
          ]
        : [
            ...(includeImports ? [`import { TSL } from 'three/tsl';`] : []),
            ...(includeImports && materialImports.length
              ? [`import { ${materialImports.join(', ')} } from 'three/webgpu';`]
              : []),
            ...(includeImports && threeImports.length
              ? [`import { ${threeImports.join(', ')} } from 'three';`]
              : []),
            ``,
            `${exportPrefix}const textureIds = ${JSON.stringify(allTextureIds, null, 2)};`,
            ``,
            `${exportPrefix}const makeNodeMaterial = (options = {}) => {`,
            ...(usesTextures ? [`  const textures = options.textures ?? {};`] : []),
            `  const timeUniform = options.timeUniform ?? TSL.uniform(0);`,
            ...(usesTextures
              ? [`  const textureFromNode = (id) => textures[id] ?? null;`]
              : [`  const textureFromNode = (_id) => null;`]),
            ``,
          ]
    const body = code
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n')
    return [
      ...header,
      `  const material = (() => {`,
      body,
      `  })();`,
      `  return { material, uniforms: { time: timeUniform } };`,
      `};`,
    ].join('\n')
  }

  const buildCreateAppLines = (format: 'js' | 'ts', exportPrefix: string) => {
    const signature =
      format === 'ts'
        ? `${exportPrefix}const createApp = (options: TSLAppOptions): { dispose: () => void } => {`
        : `${exportPrefix}const createApp = (options = {}) => {`
    return [
      signature,
      `  const { container, textures = {}, geometryType = 'box', timeUniform: injectedTime } = options;`,
      `  if (!container) {`,
      `    throw new Error('Container is required');`,
      `  }`,
      `  if (!WebGPU.isAvailable()) {`,
      `    container.textContent = 'WebGPU not available';`,
      `    return { dispose: () => {} };`,
      `  }`,
      `  const renderer = new WebGPURenderer({ antialias: true });`,
      `  renderer.setPixelRatio(window.devicePixelRatio || 1);`,
      `  renderer.outputColorSpace = SRGBColorSpace;`,
      `  renderer.toneMapping = NoToneMapping;`,
      `  renderer.toneMappingExposure = 1;`,
      `  const scene = new Scene();`,
      `  scene.background = new Color(0x0e1013);`,
      `  const camera = new PerspectiveCamera(45, 1, 0.1, 100);`,
      `  camera.position.set(3.2, 2.6, 4);`,
      `  camera.lookAt(0, 0, 0);`,
      `  const ambient = new AmbientLight(0xffffff, 0.6);`,
      `  const keyLight = new DirectionalLight(0xffffff, 1.2);`,
      `  keyLight.position.set(4, 6, 2);`,
      `  scene.add(ambient, keyLight);`,
      `  const geometry = (() => {`,
      `    switch (geometryType) {`,
      `      case 'sphere':`,
      `        return new SphereGeometry(0.75, 32, 16);`,
      `      case 'plane':`,
      `        return new PlaneGeometry(1.5, 1.5, 1, 1);`,
      `      case 'torus':`,
      `        return new TorusGeometry(0.6, 0.25, 24, 64);`,
      `      case 'cylinder':`,
      `        return new CylinderGeometry(0.5, 0.5, 1.2, 24);`,
      `      default:`,
      `        return new BoxGeometry(1, 1, 1);`,
      `    }`,
      `  })();`,
      `  const materialResult = makeNodeMaterial({ textures, timeUniform: injectedTime });`,
      `  const material = materialResult?.material ?? materialResult;`,
      `  const uniforms = materialResult?.uniforms ?? { time: injectedTime ?? TSL.uniform(0) };`,
      `  const mesh = new Mesh(geometry, material);`,
      `  scene.add(mesh);`,
      `  const controls = new OrbitControls(camera, renderer.domElement);`,
      `  controls.target.set(0, 0, 0);`,
      `  controls.enableDamping = true;`,
      `  const handleResize = () => {`,
      `    const width = container.clientWidth || 1;`,
      `    const height = container.clientHeight || 1;`,
      `    camera.aspect = width / height;`,
      `    camera.updateProjectionMatrix();`,
      `    renderer.setSize(width, height);`,
      `  };`,
      `  window.addEventListener('resize', handleResize);`,
      `  let disposed = false;`,
      `  const startTime = performance.now();`,
      `  const render = () => {`,
      `    if (disposed) return;`,
      `    uniforms.time.value = (performance.now() - startTime) / 1000;`,
      `    controls.update();`,
      `    renderer.render(scene, camera);`,
      `  };`,
      `  const init = async () => {`,
      `    try {`,
      `      await renderer.init();`,
      `      if (disposed) return;`,
      `      container.appendChild(renderer.domElement);`,
      `      handleResize();`,
      `      renderer.setAnimationLoop(render);`,
      `    } catch (error) {`,
      `      container.textContent = 'WebGPU init failed';`,
      `    }`,
      `  };`,
      `  init();`,
      `  return {`,
      `    dispose: () => {`,
      `      disposed = true;`,
      `      window.removeEventListener('resize', handleResize);`,
      `      renderer.setAnimationLoop(null);`,
      `      controls.dispose();`,
      `      geometry.dispose();`,
      `      material.dispose();`,
      `      renderer.dispose();`,
      `      if (renderer.domElement.parentElement === container) {`,
      `        container.removeChild(renderer.domElement);`,
      `      }`,
      `    },`,
      `  };`,
      `};`,
    ]
  }

  const buildAppExport = (code: string, format: 'js' | 'ts', style: 'module' | 'snippet') => {
    const materialSnippet = buildMaterialExport(code, format, style, false)
    const expanded = expandFunctions(nodes, connections, functions)
    const textureIds = expanded.nodes
      .filter((node) => node.type === 'texture')
      .map((node) => node.id)
    const gltfTextureIds = expanded.nodes
      .filter((node) => node.type === 'gltfMaterial')
      .flatMap((node) => {
        const entry = gltfMapRef.current[node.id]
        const materialCount = entry?.materials?.length ?? 0
        if (!materialCount) return []
        const material = entry?.materials?.[
          getMaterialIndex(node, materialCount)
        ] as GltfMaterial | undefined
        if (!material) return []
        const ids: string[] = []
        if (material.map) ids.push(getGltfMaterialTextureId(node.id, 'map'))
        if (material.roughnessMap)
          ids.push(getGltfMaterialTextureId(node.id, 'roughnessMap'))
        if (material.metalnessMap)
          ids.push(getGltfMaterialTextureId(node.id, 'metalnessMap'))
        if (material.emissiveMap)
          ids.push(getGltfMaterialTextureId(node.id, 'emissiveMap'))
        if (material.normalMap)
          ids.push(getGltfMaterialTextureId(node.id, 'normalMap'))
        if (material.aoMap) ids.push(getGltfMaterialTextureId(node.id, 'aoMap'))
        if (material.envMap) ids.push(getGltfMaterialTextureId(node.id, 'envMap'))
        return ids
      })
    const gltfTextureNodeIds = expanded.nodes
      .filter((node) => node.type === 'gltfTexture')
      .map((node) => getGltfTextureId(node.id))
    const usesTextures =
      textureIds.length + gltfTextureIds.length + gltfTextureNodeIds.length > 0
    const needsVector2 = code.includes('new Vector2')
    const materialImports: string[] = []
    if (code.includes('MeshBasicNodeMaterial')) materialImports.push('MeshBasicNodeMaterial')
    if (code.includes('MeshStandardNodeMaterial')) materialImports.push('MeshStandardNodeMaterial')
    if (code.includes('MeshPhysicalNodeMaterial')) materialImports.push('MeshPhysicalNodeMaterial')
    const webgpuImports = [
      'AmbientLight',
      'BoxGeometry',
      'Color',
      'DirectionalLight',
      'Mesh',
      'PerspectiveCamera',
      'PlaneGeometry',
      'Scene',
      'SphereGeometry',
      'TorusGeometry',
      'CylinderGeometry',
      'WebGPURenderer',
      ...materialImports,
    ]
    const uniqueWebgpuImports = Array.from(new Set(webgpuImports))
    const threeImports = [
      usesTextures ? 'Texture' : null,
      needsVector2 ? 'Vector2' : null,
      'SRGBColorSpace',
      'NoToneMapping',
    ].filter(Boolean) as string[]
    const exportPrefix = style === 'module' ? 'export ' : ''
    const header =
      format === 'ts'
        ? [
            `import { TSL } from 'three/tsl';`,
            `import { ${uniqueWebgpuImports.join(', ')} } from 'three/webgpu';`,
            ...(threeImports.length ? [`import { ${threeImports.join(', ')} } from 'three';`] : []),
            `import WebGPU from 'three/addons/capabilities/WebGPU.js';`,
            `import { OrbitControls } from 'three/addons/controls/OrbitControls.js';`,
            ``,
            `${exportPrefix}type TSLAppOptions = {`,
            `  container: HTMLElement;`,
            ...(usesTextures ? [`  textures?: Record<string, Texture>;`] : []),
            `  geometryType?: 'box' | 'sphere' | 'plane' | 'torus' | 'cylinder';`,
            `  timeUniform?: ReturnType<typeof TSL.uniform>;`,
            `};`,
            ``,
          ]
        : [
            `import { TSL } from 'three/tsl';`,
            `import { ${uniqueWebgpuImports.join(', ')} } from 'three/webgpu';`,
            ...(threeImports.length ? [`import { ${threeImports.join(', ')} } from 'three';`] : []),
            `import WebGPU from 'three/addons/capabilities/WebGPU.js';`,
            `import { OrbitControls } from 'three/addons/controls/OrbitControls.js';`,
            ``,
          ]
    const appBody = buildCreateAppLines(format, exportPrefix)
    return [...header, materialSnippet, '', ...appBody].join('\n')
  }

  useEffect(() => {
    codePreviewRef.current = buildCodePreview()
  }, [graphComputeSignature])

  const executableTSL = useMemo(() => buildExecutableTSL(), [graphComputeSignature])
  const materialExport = useMemo(
    () => buildMaterialExport(executableTSL, exportFormat, 'module'),
    [graphComputeSignature, executableTSL, exportFormat],
  )
  const appExport = useMemo(
    () => buildAppExport(executableTSL, exportFormat, 'module'),
    [graphComputeSignature, executableTSL, exportFormat],
  )
  const appRuntime = useMemo(
    () => {
      const materialSnippet = buildMaterialExport(executableTSL, 'js', 'snippet', false)
      const runtimeHeader = [
        `const {`,
        `  AmbientLight,`,
        `  BoxGeometry,`,
        `  Color,`,
        `  DirectionalLight,`,
        `  Mesh,`,
        `  PerspectiveCamera,`,
        `  PlaneGeometry,`,
        `  Scene,`,
        `  SphereGeometry,`,
        `  TorusGeometry,`,
        `  CylinderGeometry,`,
        `  WebGPURenderer,`,
        `  MeshBasicNodeMaterial,`,
        `  MeshStandardNodeMaterial,`,
        `  MeshPhysicalNodeMaterial,`,
        `  SRGBColorSpace,`,
        `  NoToneMapping,`,
        `  Vector2,`,
        `  OrbitControls,`,
        `  WebGPU,`,
        `  TSL,`,
        `} = runtime;`,
        ``,
      ].join('\n')
      const appBody = [
        ...buildCreateAppLines('js', ''),
        `return createApp;`,
      ].join('\n')
      return [runtimeHeader, materialSnippet, '', appBody].join('\n')
    },
    [graphComputeSignature, executableTSL],
  )
  const tslOutput = useMemo(() => {
    switch (tslOutputKind) {
      case 'material':
        return materialExport
      case 'app':
        return appExport
      case 'gltf':
        return gltfOutputText || 'glTF export is not ready.'
      default:
        return executableTSL
    }
  }, [tslOutputKind, materialExport, appExport, executableTSL, gltfOutputText])

  useEffect(() => {
    if (tslOutputKind !== 'gltf') return
    let cancelled = false
    // Preview effects update mesh materials synchronously in this same commit.
    void Promise.resolve().then(() => exportEditorMeshes(meshesRef.current, false)).then(
      (result) => {
        if (cancelled) return
        if (typeof result === 'string') {
          setGltfOutputText(result)
          return
        }
        const gltf = result as {
          buffers?: Array<{ uri?: string }>
        }
        const next = {
          ...gltf,
          buffers: gltf.buffers?.map((buffer) => {
            if (!buffer?.uri || buffer.uri.length <= 100) return buffer
            const omitted = buffer.uri.length - 100
            return {
              ...buffer,
              uri: `${buffer.uri.slice(0, 100)}... [${omitted} chars omitted]`,
            }
          }),
        }
        const data = JSON.stringify(next, null, 2)
        setGltfOutputText(data)
      },
      (error) => {
        const message = error instanceof Error ? error.message : 'Unknown glTF error'
        if (!cancelled) setGltfOutputText(`// glTF export failed: ${message}`)
      },
    )
    return () => { cancelled = true }
  }, [tslOutputKind, graphSignature, geometrySignature, textureSignature, materialReady])
  const viewerTextures = useMemo(() => {
    const expanded = expandFunctions(nodes, connections, functions)
    const payload: Record<string, { src: string; name?: string }> = {}
    expanded.nodes.forEach((node) => {
      if (node.type === 'texture') {
        if (typeof node.value === 'string' && node.value) {
          payload[node.id] = { src: node.value, name: node.textureName }
        }
        return
      }
      if (node.type === 'gltfTexture') {
        const entry = gltfMapRef.current[node.id]
        const textureCount = entry?.textures.length ?? 0
        if (!textureCount) return
        const tex = entry?.textures[getTextureIndex(node, textureCount)]
        const image = tex?.image as { currentSrc?: string } | undefined
        const src =
          (tex?.source?.data as { currentSrc?: string } | undefined)?.currentSrc ??
          image?.currentSrc ??
          ''
        if (src) {
          payload[getGltfTextureId(node.id)] = { src, name: tex?.name }
        }
      }
    })
    return payload
  }, [graphComputeSignature, gltfVersion])
  const viewerGeometryType = useMemo(() => {
    const expanded = expandFunctions(nodes, connections, functions)
    const nodeMap = buildNodeMap(expanded.nodes)
    const connectionMap = buildConnectionMap(expanded.connections)
    const output = expanded.nodes.find((node) => node.type === 'geometryOutput')
    const connection = output
      ? connectionMap.get(`${output.id}:geometry`)
      : null
    if (connection) {
      const source = nodeMap.get(connection.from.nodeId)
      if (source?.type === 'geometryPrimitive') {
        const value = typeof source.value === 'string' ? source.value : 'box'
        return value || 'box'
      }
    }
    return 'box'
  }, [graphComputeSignature])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; message?: string }
      if (data?.type === 'tsl-viewer-error' && data.message) {
        setToast(`Viewer error: ${data.message}`)
      } else if (data?.type === 'tsl-viewer-ready') {
        setViewerReadyTick((prev) => prev + 1)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (!showCode || tslPanelMode !== 'viewer' || viewerReadyTick === 0) return
    const frame = viewerRef.current
    if (!frame?.contentWindow) return
    frame.contentWindow.postMessage(
      {
        type: 'tsl-code',
        code: appRuntime,
        textures: viewerTextures,
        geometryType: viewerGeometryType,
      },
      '*',
    )
  }, [
    showCode,
    tslPanelMode,
    viewerReadyTick,
    appRuntime,
    viewerTextures,
    viewerGeometryType,
  ])

  const copyTSLExport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tslOutput)
      setToast('TSL export copied')
    } catch {
      setToast('Failed to copy TSL export')
    }
  }, [tslOutput])

  const downloadTSLExport = useCallback(() => {
    const blob = new Blob([tslOutput], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const suffix = exportFormat === 'ts' ? 'ts' : 'js'
    const baseName =
      tslOutputKind === 'app'
        ? 'tsl-app'
        : tslOutputKind === 'material'
          ? 'tsl-material'
          : 'tsl-code'
    link.download = `${baseName}.${suffix}`
    link.click()
    URL.revokeObjectURL(url)
    setToast('TSL export downloaded')
  }, [exportFormat, tslOutput, tslOutputKind])

  const downloadGltfExport = useCallback(() => {
    if (!meshesRef.current.length) {
      setToast('No mesh to export')
      return
    }
    void exportEditorMeshes(meshesRef.current, true).then(
      (result) => {
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'tsl-node-editor.glb'
          link.click()
          URL.revokeObjectURL(url)
          setToast('glTF export downloaded')
          return
        }
        const data = JSON.stringify(result, null, 2)
        const blob = new Blob([data], { type: 'model/gltf+json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'tsl-node-editor.gltf'
        link.click()
        URL.revokeObjectURL(url)
        setToast('glTF export downloaded')
      },
      (error) => {
        const message = error instanceof Error ? error.message : 'Unknown glTF error'
        setToast(`glTF export failed: ${message}`)
      },
    )
  }, [])

  const blockCanvasPointer = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])
  const allowOverlayScroll = useCallback((event: React.WheelEvent) => {
    event.stopPropagation()
  }, [])

  useEffect(() => {
    const {
      root,
      roughnessNode,
      metalnessNode,
      vertexPositionNode,
      materialKind,
      resolveNode: resolveGraphNode,
    } = buildGraph()
    const expanded = expandFunctions(nodes, connections, functions)
    const meshes = meshesRef.current
    const nodeMap = buildNodeMap(expanded.nodes)
    const connectionMap = buildConnectionMap(expanded.connections)
    const output = expanded.nodes.find((node) => node.type === 'output')
    const outputConnection = output ? connectionMap.get(`${output.id}:baseColor`) : undefined
    const source = outputConnection ? nodeMap.get(outputConnection.from.nodeId) : undefined
    const entry = source?.type === 'gltfMaterial' ? gltfMapRef.current[source.id] : undefined
    const importedMaterial = entry && source && outputConnection?.from.pin === 'baseColor'
      ? entry.materials[getMaterialIndex(source, entry.materials.length)]
      : undefined
    const importedPreview = importedMaterial ? cloneImportedTSLMaterial(importedMaterial) : null
    if (importedPreview) {
      isImportedPreviewRef.current = true
      if (importedPreview instanceof MeshStandardNodeMaterial) {
        if (output && connectionMap.has(`${output.id}:roughness`) && roughnessNode?.kind === 'number') {
          importedPreview.roughnessNode = roughnessNode.node
        }
        if (output && connectionMap.has(`${output.id}:metalness`) && metalnessNode?.kind === 'number') {
          importedPreview.metalnessNode = metalnessNode.node
        }
      }
      if (vertexPositionNode) {
        importedPreview.positionNode = positionLocal.add(vertexPositionNode.node)
      }
      materialRef.current?.dispose()
      materialRef.current = importedPreview
      meshes.forEach((mesh) => { mesh.material = importedPreview })
      graphSignatureRef.current = graphSignature
      textureSignatureRef.current = textureSignature
      return
    }
    let material = materialRef.current
    const needsBasic = materialKind === 'basic'
    const needsPhysical = materialKind === 'physical'
    const needsStandard = materialKind === 'standard'
    const needsSwap =
      isImportedPreviewRef.current ||
      !material ||
      (needsBasic && !(material instanceof MeshBasicNodeMaterial)) ||
      (needsPhysical && !(material instanceof MeshPhysicalNodeMaterial)) ||
      (needsStandard && (!(material instanceof MeshStandardNodeMaterial) || material instanceof MeshPhysicalNodeMaterial))
    isImportedPreviewRef.current = false
    let materialChanged = false
    if (needsSwap) {
      const nextMaterial = needsBasic
        ? new MeshBasicNodeMaterial()
        : needsPhysical
          ? new MeshPhysicalNodeMaterial()
          : new MeshStandardNodeMaterial()
      material?.dispose()
      material = nextMaterial
      materialRef.current = nextMaterial
      meshes.forEach((mesh) => {
        mesh.material = nextMaterial
      })
      materialChanged = true
    }
    if (!material) return
    const signatureChanged = graphSignatureRef.current !== graphSignature
    const textureChanged = textureSignatureRef.current !== textureSignature
    if (signatureChanged || textureChanged || materialChanged) {
      material.colorNode = root
      if (material instanceof MeshStandardNodeMaterial) {
        if (roughnessNode?.kind === 'number') {
          material.roughnessNode = roughnessNode.node
        } else {
          material.roughnessNode = float(0.7)
        }
        if (metalnessNode?.kind === 'number') {
          material.metalnessNode = metalnessNode.node
        } else {
          material.metalnessNode = float(0.1)
        }
        const nodeMap = buildNodeMap(expanded.nodes)
        const connectionMap = buildConnectionMap(expanded.connections)
        const outputNode = expanded.nodes.find((node) => node.type === 'output')
        const { standardMaterialNode: standardNode, physicalMaterialNode: physicalNode } =
          getMaterialNodesFromOutput(outputNode, nodeMap, connectionMap)
        const getConn = (pin: string) =>
          standardNode || physicalNode
            ? connectionMap.get(`${(standardNode ?? physicalNode)!.id}:${pin}`)
            : null
        const resolveNumberNode = (pin: string) => {
          const conn = getConn(pin)
          if (!conn) return null
          const resolved = resolveGraphNode(conn.from.nodeId, new Set(), conn.from.pin)
          return resolved.kind === 'number' ? resolved.node : null
        }
        const resolveColorNode = (pin: string) => {
          const conn = getConn(pin)
          if (!conn) return null
          const resolved = resolveGraphNode(conn.from.nodeId, new Set(), conn.from.pin)
          if (resolved.kind === 'color') return resolved.node
          if (resolved.kind === 'number') return color(resolved.node)
          return null
        }
        const resolveTextureFromPin = (pin: string) => {
          const conn = getConn(pin)
          if (!conn) return null
          const source = nodeMap.get(conn.from.nodeId)
          if (source?.type === 'texture') {
            return textureMapRef.current[source.id]?.texture ?? null
          }
          return null
        }
        const getNumberLiteral = (pin: string) => {
          const conn = getConn(pin)
          if (!conn) return null
          const source = nodeMap.get(conn.from.nodeId)
          if (source?.type === 'number') {
            return parseNumber(source.value)
          }
          return null
        }
        const getNormalScale = () => {
          const conn = getConn('normalScale')
          if (!conn) return null
          const source = nodeMap.get(conn.from.nodeId)
          if (source?.type === 'number') {
            const value = parseNumber(source.value)
            return new Vector2(value, value)
          }
          return null
        }
        material.emissiveNode = resolveColorNode('emissive')
        material.emissiveMap = resolveTextureFromPin('emissiveMap')
        const emissiveIntensity = getNumberLiteral('emissiveIntensity')
        if (emissiveIntensity !== null) {
          material.emissiveIntensity = emissiveIntensity
        }
        material.roughnessMap = resolveTextureFromPin('roughnessMap')
        material.metalnessMap = resolveTextureFromPin('metalnessMap')
        material.normalMap = resolveTextureFromPin('normalMap')
        const normalScale = getNormalScale()
        if (normalScale) {
          material.normalScale = normalScale
        }
        material.aoMap = resolveTextureFromPin('aoMap')
        const aoMapIntensity = getNumberLiteral('aoMapIntensity')
        if (aoMapIntensity !== null) {
          material.aoMapIntensity = aoMapIntensity
        }
        material.envMap = resolveTextureFromPin('envMap')
        const envMapIntensity = getNumberLiteral('envMapIntensity')
        if (envMapIntensity !== null) {
          material.envMapIntensity = envMapIntensity
        }
        material.opacityNode = resolveNumberNode('opacity')
        material.alphaTestNode = resolveNumberNode('alphaTest')
        const alphaHashValue = getNumberLiteral('alphaHash')
        material.alphaHash = alphaHashValue !== null ? alphaHashValue > 0.5 : Boolean(getConn('alphaHash'))
        const opacityValue = getNumberLiteral('opacity')
        material.transparent = opacityValue !== null ? opacityValue < 1 : false
        if (material instanceof MeshPhysicalNodeMaterial && physicalNode) {
          material.clearcoatNode = resolveNumberNode('clearcoat')
          material.clearcoatRoughnessNode = resolveNumberNode('clearcoatRoughness')
          material.clearcoatNormalMap = resolveTextureFromPin('clearcoatNormal')
          const clearcoatValue = getNumberLiteral('clearcoat')
          if (clearcoatValue !== null) {
            material.clearcoat = clearcoatValue
          }
          const clearcoatRoughnessValue = getNumberLiteral('clearcoatRoughness')
          if (clearcoatRoughnessValue !== null) {
            material.clearcoatRoughness = clearcoatRoughnessValue
          }
        }
      }
      if (material instanceof MeshBasicNodeMaterial) {
        const nodeMap = buildNodeMap(expanded.nodes)
        const connectionMap = buildConnectionMap(expanded.connections)
        const outputNode = expanded.nodes.find((node) => node.type === 'output')
        const baseColorConn = outputNode
          ? connectionMap.get(`${outputNode.id}:baseColor`)
          : null
        const basicNode =
          baseColorConn && nodeMap.get(baseColorConn.from.nodeId)?.type === 'basicMaterial'
            ? nodeMap.get(baseColorConn.from.nodeId)
            : null
        const getConn = (pin: string) =>
          basicNode ? connectionMap.get(`${basicNode.id}:${pin}`) : null
        const getNumberNodeValue = (pin: string, fallback: number) => {
          const conn = getConn(pin)
          if (!conn) return fallback
          const source = nodeMap.get(conn.from.nodeId)
          if (source?.type === 'number') {
            return parseNumber(source.value)
          }
          return fallback
        }
        const getNumberUniform = (pin: string) => {
          const conn = getConn(pin)
          if (!conn) return null
          const source = nodeMap.get(conn.from.nodeId)
          if (source?.type !== 'number') return null
          const value = parseNumber(source.value)
          return ensureNumberUniform(source, value)
        }
        const resolveTextureFromPin = (pin: string) => {
          const conn = getConn(pin)
          if (!conn) return null
          const source = nodeMap.get(conn.from.nodeId)
          if (source?.type === 'texture') {
            return textureMapRef.current[source.id]?.texture ?? null
          }
          return null
        }
        material.opacityNode = getNumberUniform('opacity')
        material.alphaTestNode = getNumberUniform('alphaTest')
        material.alphaHash = getNumberNodeValue('alphaHash', 0) > 0.5
        material.map = resolveTextureFromPin('map')
        material.alphaMap = resolveTextureFromPin('alphaMap')
        material.aoMap = resolveTextureFromPin('aoMap')
        material.envMap = resolveTextureFromPin('envMap')
        const reflectivityValue = getNumberNodeValue(
          'reflectivity',
          getNumberNodeValue('envMapIntensity', 1),
        )
        material.reflectivity = reflectivityValue
        const opacityValue = getNumberNodeValue('opacity', 1)
        material.transparent = opacityValue < 1 || Boolean(material.alphaMap)
      }
      if (vertexPositionNode) {
        const positionNode =
          vertexPositionNode.kind === 'vec3' || vertexPositionNode.kind === 'color'
            ? vertexPositionNode.node
            : vec3(
                vertexPositionNode.node,
                vertexPositionNode.node,
                vertexPositionNode.node,
              )
        material.positionNode = positionLocal.add(positionNode)
      } else {
        material.positionNode = positionLocal
      }
      material.needsUpdate = true
    }
    graphSignatureRef.current = graphSignature
    textureSignatureRef.current = textureSignature
  }, [materialReady, graphSignature, textureSignature])

  useEffect(() => {
    const scene = sceneRef.current
    const material = materialRef.current
    if (!scene || !material) return
    if (!geometrySignature) return
    const expanded = expandFunctions(nodes, connections, functions)
    const nodeMap = buildNodeMap(expanded.nodes)
    const connectionMap = buildConnectionMap(expanded.connections)
    const output = expanded.nodes.find((node) => node.type === 'geometryOutput')
    const connection = output
      ? connectionMap.get(`${output.id}:geometry`)
      : null
    let nextGeometries: BufferGeometry[] = []
    if (connection) {
      const source = nodeMap.get(connection.from.nodeId)
      if (source?.type === 'gltf') {
        const entry = gltfMapRef.current[source.id]
        if (!entry) return
        const index = getMeshIndex(source, entry.geometries.length)
        nextGeometries = [entry.geometries[index].clone()]
      }
      if (source?.type === 'geometryPrimitive') {
        const value = typeof source.value === 'string' ? source.value : 'box'
        switch (value) {
          case 'sphere':
            nextGeometries = [new SphereGeometry(0.75, 32, 16)]
            break
          case 'plane':
            nextGeometries = [new PlaneGeometry(1.5, 1.5, 1, 1)]
            break
          case 'torus':
            nextGeometries = [new TorusGeometry(0.6, 0.25, 24, 64)]
            break
          case 'cylinder':
            nextGeometries = [new CylinderGeometry(0.5, 0.5, 1.2, 24)]
            break
          default:
            nextGeometries = [new BoxGeometry(1, 1, 1)]
        }
      }
    }
    if (!nextGeometries.length) {
      nextGeometries = [new BoxGeometry(1, 1, 1)]
    }
    meshesRef.current.forEach((mesh) => scene.remove(mesh))
    meshesRef.current = nextGeometries.map((geometry) => new Mesh(geometry, material))
    meshesRef.current.forEach((mesh) => scene.add(mesh))
    geometriesRef.current.forEach((geometry) => geometry.dispose())
    geometriesRef.current = nextGeometries
  }, [geometrySignature])

  useEffect(() => {
    const nodeMap = buildNodeMap(nodes)
    Object.entries(nodeUniformsRef.current).forEach(([id, entry]) => {
      const node = nodeMap.get(id)
      if (!node) return
      if (node.type === 'number' && entry.kind === 'number' && entry.mode === 'manual') {
        entry.uniform.value = parseNumber(node.value)
      }
      if (node.type === 'color' && entry.kind === 'color' && typeof node.value === 'string') {
        if (entry.uniform.value instanceof Color) {
          entry.uniform.value.set(node.value)
        }
      }
    })
  }, [uniformInputSignature])

  useEffect(() => {
    const nodeMap = buildNodeMap(editorNodes)
    const connectionMap = buildConnectionMap(editorConnections)
    const warn: Record<string, string> = {}

    editorConnections.forEach((connection) => {
      const target = nodeMap.get(connection.to.nodeId)
      if (!target) return
      const expected = inputTypes[target.type as keyof typeof inputTypes]?.[
        connection.to.pin as
          | 'a'
          | 'b'
          | 'cond'
          | 'threshold'
          | 't'
          | 'value'
          | 'edge'
          | 'edge0'
          | 'edge1'
          | 'x'
          | 'coord'
          | 'texcoord'
          | 'amplitude'
          | 'pivot'
          | 'amount'
          | 'inLow'
          | 'inHigh'
          | 'outLow'
          | 'outHigh'
          | 'low'
          | 'high'
          | 'octaves'
          | 'lacunarity'
          | 'diminish'
          | 'jitter'
          | 'strength'
          | 'center'
          | 'size'
          | 'steps'
          | 'uv'
          | 'scale'
          | 'rotation'
          | 'min'
          | 'max'
          | 'y'
          | 'z'
          | 'w'
          | 'c0'
          | 'c1'
          | 'c2'
          | 'c3'
          | 'base'
          | 'exp'
          | 'incident'
          | 'speed'
          | 'time'
          | 'normal'
          | 'eta'
          | 'n'
          | 'i'
          | 'nref'
          | 'opacity'
          | 'alphaTest'
          | 'alphaHash'
          | 'map'
          | 'alphaMap'
          | 'aoMap'
          | 'envMap'
          | 'envMapIntensity'
          | 'reflectivity'
          | 'baseColor'
          | 'baseColorTexture'
          | 'roughnessMap'
          | 'metalnessMap'
          | 'emissive'
          | 'emissiveMap'
          | 'emissiveIntensity'
          | 'normalMap'
          | 'normalScale'
          | 'aoMapIntensity'
          | 'roughness'
          | 'metalness'
          | 'position'
          | 'geometry'
      ]
      if (!expected) return
      const actual = inferType(
        connection.from.nodeId,
        connection.from.pin,
        nodeMap,
        connectionMap,
        new Set(),
      )
      if (target.type === 'add' || target.type === 'multiply') {
        const otherPin = connection.to.pin === 'a' ? 'b' : 'a'
        const other = connectionMap.get(`${target.id}:${otherPin}`)
        if (other) {
          const otherType = inferType(
            other.from.nodeId,
            other.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
          const combined = combineTypes(actual, otherType)
          if (combined === 'unknown') {
            warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
          }
        }
        return
      }
      if (target.type === 'min' || target.type === 'max' || target.type === 'mod') {
        const otherPin = connection.to.pin === 'a' ? 'b' : 'a'
        const other = connectionMap.get(`${target.id}:${otherPin}`)
        if (other) {
          const otherType = inferType(
            other.from.nodeId,
            other.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
          const combined = combineTypes(actual, otherType)
          if (combined === 'unknown') {
            warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
          }
        }
        return
      }
      if (target.type === 'distance') {
        const otherPin = connection.to.pin === 'a' ? 'b' : 'a'
        const other = connectionMap.get(`${target.id}:${otherPin}`)
        if (other) {
          const otherType = inferType(
            other.from.nodeId,
            other.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
          if (resolveVectorOutputKind([actual, otherType]) === 'unknown') {
            warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
          }
        }
        return
      }
      if (
        target.type === 'lessThan' ||
        target.type === 'lessThanEqual' ||
        target.type === 'greaterThan' ||
        target.type === 'greaterThanEqual' ||
        target.type === 'equal' ||
        target.type === 'notEqual' ||
        target.type === 'and' ||
        target.type === 'or'
      ) {
        const otherPin = connection.to.pin === 'a' ? 'b' : 'a'
        const other = connectionMap.get(`${target.id}:${otherPin}`)
        if (other) {
          const otherType = inferType(
            other.from.nodeId,
            other.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
          if (resolveVectorOutputKind([actual, otherType]) === 'unknown') {
            warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
          }
        }
        return
      }
      if (target.type === 'dot') {
        const otherPin = connection.to.pin === 'a' ? 'b' : 'a'
        const other = connectionMap.get(`${target.id}:${otherPin}`)
        if (other) {
          const otherType = inferType(
            other.from.nodeId,
            other.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
          const vecA = getVectorKind(actual)
          const vecB = getVectorKind(otherType)
          if (!vecA || !vecB || vecA !== vecB) {
            warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
          }
        }
        return
      }
      if (target.type === 'atan2') {
        const resolvePinType = (pin: string) => {
          const linked = connectionMap.get(`${target.id}:${pin}`)
          if (!linked) return 'number'
          return inferType(
            linked.from.nodeId,
            linked.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
        }
        const yType = connection.to.pin === 'y' ? actual : resolvePinType('y')
        const xType = connection.to.pin === 'x' ? actual : resolvePinType('x')
        if (resolveVectorOutputKind([yType, xType]) === 'unknown') {
          warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
        }
        return
      }
      if (target.type === 'step') {
        const resolvePinType = (pin: string) => {
          const linked = connectionMap.get(`${target.id}:${pin}`)
          if (!linked) return 'number'
          return inferType(
            linked.from.nodeId,
            linked.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
        }
        const edgeType = connection.to.pin === 'edge' ? actual : resolvePinType('edge')
        const xType = connection.to.pin === 'x' ? actual : resolvePinType('x')
        if (resolveVectorOutputKind([edgeType, xType]) === 'unknown') {
          warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
        }
        return
      }
      if (target.type === 'stepElement') {
        const resolvePinType = (pin: string) => {
          const linked = connectionMap.get(`${target.id}:${pin}`)
          if (!linked) return 'number'
          return inferType(
            linked.from.nodeId,
            linked.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
        }
        const edgeType = connection.to.pin === 'edge' ? actual : resolvePinType('edge')
        const xType = connection.to.pin === 'x' ? actual : resolvePinType('x')
        if (resolveVectorOutputKind([edgeType, xType]) === 'unknown') {
          warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
        }
        return
      }
      if (target.type === 'mix' && (connection.to.pin === 'a' || connection.to.pin === 'b')) {
        const otherPin = connection.to.pin === 'a' ? 'b' : 'a'
        const other = connectionMap.get(`${target.id}:${otherPin}`)
        if (other) {
          const otherType = inferType(
            other.from.nodeId,
            other.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
          const combined = combineTypes(actual, otherType)
          if (combined === 'unknown') {
            warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
          }
        }
        return
      }
      if (target.type === 'ifElse') {
        if (connection.to.pin === 'a' || connection.to.pin === 'b') {
          const otherPin = connection.to.pin === 'a' ? 'b' : 'a'
          const other = connectionMap.get(`${target.id}:${otherPin}`)
          if (other) {
            const otherType = inferType(
              other.from.nodeId,
              other.from.pin,
              nodeMap,
              connectionMap,
              new Set(),
            )
            const combined = combineTypes(actual, otherType)
            if (combined === 'unknown') {
              warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
            }
          }
          return
        }
        if (connection.to.pin === 'cond') {
          const inputA = connectionMap.get(`${target.id}:a`)
          const inputB = connectionMap.get(`${target.id}:b`)
          const typeA = inputA
            ? inferType(inputA.from.nodeId, inputA.from.pin, nodeMap, connectionMap, new Set())
            : 'number'
          const typeB = inputB
            ? inferType(inputB.from.nodeId, inputB.from.pin, nodeMap, connectionMap, new Set())
            : 'number'
          const outputKind = combineTypes(typeA, typeB)
          if (outputKind === 'number' && actual !== 'number' && !isVectorKind(actual)) {
            warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'number expected'
          } else if (
            outputKind !== 'number' &&
            isVectorKind(outputKind) &&
            resolveVectorOutputKind([actual, outputKind]) === 'unknown' &&
            actual !== 'number'
          ) {
            warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
          }
          return
        }
      }
      if (target.type === 'smoothstep') {
        const resolvePinType = (pin: string) => {
          const linked = connectionMap.get(`${target.id}:${pin}`)
          if (!linked) return 'number'
          return inferType(
            linked.from.nodeId,
            linked.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
        }
        const edge0 = connection.to.pin === 'edge0' ? actual : resolvePinType('edge0')
        const edge1 = connection.to.pin === 'edge1' ? actual : resolvePinType('edge1')
        const xType = connection.to.pin === 'x' ? actual : resolvePinType('x')
        if (resolveVectorOutputKind([edge0, edge1, xType]) === 'unknown') {
          warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
        }
        return
      }
      if (target.type === 'smoothstepElement') {
        const resolvePinType = (pin: string) => {
          const linked = connectionMap.get(`${target.id}:${pin}`)
          if (!linked) return 'number'
          return inferType(
            linked.from.nodeId,
            linked.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
        }
        const lowType = connection.to.pin === 'low' ? actual : resolvePinType('low')
        const highType = connection.to.pin === 'high' ? actual : resolvePinType('high')
        const xType = connection.to.pin === 'x' ? actual : resolvePinType('x')
        if (resolveVectorOutputKind([lowType, highType, xType]) === 'unknown') {
          warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
        }
        return
      }
      if (target.type === 'pow') {
        const resolvePinType = (pin: string) => {
          const linked = connectionMap.get(`${target.id}:${pin}`)
          if (!linked) return 'number'
          return inferType(
            linked.from.nodeId,
            linked.from.pin,
            nodeMap,
            connectionMap,
            new Set(),
          )
        }
        const baseType = connection.to.pin === 'base' ? actual : resolvePinType('base')
        const expType = connection.to.pin === 'exp' ? actual : resolvePinType('exp')
        if (resolveVectorOutputKind([baseType, expType]) === 'unknown') {
          warn[`${connection.to.nodeId}:${connection.to.pin}`] = 'Type mismatch'
        }
        return
      }
      if (!isAssignableType(actual, expected)) {
        warn[`${connection.to.nodeId}:${connection.to.pin}`] = `${expected} expected`
      }
    })

    setTypeWarnings(warn)
  }, [editorGraphSignature, inputTypes])

  useEffect(() => {
    const loader = new TextureLoader()
    const ktx2Loader = ktx2LoaderRef.current
    const nextMap: Record<string, { src: string; texture: Texture }> = {
      ...textureMapRef.current,
    }
    const activeIds = new Set<string>()
    let changed = false
    nodes.forEach((node) => {
      if (node.type !== 'texture') return
      const src = typeof node.value === 'string' ? node.value : ''
      if (!src) return
      activeIds.add(node.id)
      const existing = nextMap[node.id]
      if (!existing || existing.src !== src) {
        if (isKtx2Texture(node)) {
          if (!ktx2Loader || !ktx2Ready) return
          const tex = ktx2Loader.load(src, () => {
            tex.needsUpdate = true
            setTextureVersion((prev) => prev + 1)
            const material = materialRef.current
            if (material) {
              material.needsUpdate = true
            }
          }) as unknown as Texture
          tex.colorSpace = SRGBColorSpace
          nextMap[node.id] = { src, texture: tex }
          changed = true
          return
        }
        const tex = loader.load(src, () => {
          tex.needsUpdate = true
          setTextureVersion((prev) => prev + 1)
          const material = materialRef.current
          if (material) {
            material.needsUpdate = true
          }
        }) as unknown as Texture
        tex.colorSpace = SRGBColorSpace
        nextMap[node.id] = { src, texture: tex }
        changed = true
      }
    })
    Object.keys(nextMap).forEach((id) => {
      if (!activeIds.has(id)) {
        nextMap[id].texture.dispose()
        delete nextMap[id]
        changed = true
      }
    })
    textureMapRef.current = nextMap
    if (changed) {
      setTextureVersion((prev) => prev + 1)
    }
  }, [textureSourceSignature, ktx2Ready])

  useEffect(() => {
    if (!ktx2Ready) return
    const loader = createEditorGLTFLoader((error) => {
      const message = error instanceof Error ? error.message : String(error)
      setToast(`TSL import uses ordinary glTF fallback: ${message}`)
    }, ktx2LoaderRef.current ?? undefined)
    const nextMap: Record<string, GltfAssetEntry> = {
      ...gltfMapRef.current,
    }
    const activeIds = new Set<string>()
    let changed = false
    nodes.forEach((node) => {
      if (node.type !== 'gltf' && node.type !== 'gltfMaterial' && node.type !== 'gltfTexture') return
      const src = typeof node.value === 'string' ? node.value : ''
      if (!src) return
      activeIds.add(node.id)
      const existing = nextMap[node.id]
      if (!existing || existing.src !== src) {
        if (existing && existing.src !== src) {
          existing.geometries.forEach((geometry) => geometry.dispose())
          existing.materials?.forEach((material) => material.dispose())
          existing.textures?.forEach((texture) => texture.dispose())
        }
        loader.load(
          src,
          (gltf) => {
            void (async () => {
              const found: BufferGeometry[] = []
              const meshNames: string[] = []
              const materialSet = new Set<Material>()
              gltf.scene.traverse((child) => {
                const mesh = child as ThreeMesh
                if (mesh.isMesh && mesh.geometry) {
                  found.push(mesh.geometry as BufferGeometry)
                  meshNames.push(mesh.name || '')
                  const materials = Array.isArray(mesh.material)
                    ? mesh.material
                    : mesh.material
                      ? [mesh.material]
                      : []
                  materials.forEach((mat) => {
                    if (mat) materialSet.add(mat)
                  })
                }
              })
              if (!found.length) {
                setToast('GLTF load failed: no mesh geometry found')
                return
              }
              const geometries = found.map((geometry) => geometry.clone())
              const gltfMaterials = (gltf as { materials?: Material[] }).materials ?? []
              const materials = materialSet.size ? Array.from(materialSet) : gltfMaterials
              let textures: Texture[] = []
              try {
                textures = await gltf.parser.getDependencies('texture')
              } catch {
                textures = (gltf as { textures?: Texture[] }).textures ?? []
              }
              nextMap[node.id] = { src, geometries, materials, meshNames, textures }
              gltfMapRef.current = { ...nextMap }
              setGltfVersion((prev) => prev + 1)
            })()
          },
          undefined,
          (error) => {
            const message =
              error instanceof Error ? error.message : 'Unknown GLTF load error'
            setToast(`GLTF load failed: ${message}`)
          },
        )
        changed = true
      }
    })
    Object.keys(nextMap).forEach((id) => {
      if (!activeIds.has(id)) {
        nextMap[id].geometries.forEach((geometry) => geometry.dispose())
        nextMap[id].materials?.forEach((material) => material.dispose())
        nextMap[id].textures?.forEach((texture) => texture.dispose())
        delete nextMap[id]
        changed = true
      }
    })
    gltfMapRef.current = nextMap
    if (changed) {
      setGltfVersion((prev) => prev + 1)
    }
  }, [gltfSourceSignature, ktx2Ready])

  useEffect(() => {
    const handleResize = () => {
      const container = viewportRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const viewState = viewRef.current
      const next: Record<string, { x: number; y: number }> = {}
      const pins = container.querySelectorAll<HTMLElement>('[data-pin-key]')
      pins.forEach((pin) => {
        const pinRect = pin.getBoundingClientRect()
        const key = pin.dataset.pinKey
        if (!key) return
        const screenX = pinRect.left - rect.left + pinRect.width / 2
        const screenY = pinRect.top - rect.top + pinRect.height / 2
        next[key] = {
          x: (screenX - viewState.x) / viewState.zoom,
          y: (screenY - viewState.y) / viewState.zoom,
        }
      })
      setPinPositions(next)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


  useEffect(() => {
    const container = viewportRef.current
    if (!container) return

    const updateDraggedLinkPaths = (draggedIds: Set<string>) => {
      const svg = container.querySelector<SVGSVGElement>('.node-links')
      if (!svg) return
      const rect = container.getBoundingClientRect()
      const viewState = viewRef.current
      const paths = svg.querySelectorAll<SVGPathElement>('path[data-link-id]')
      paths.forEach((pathEl) => {
        const fromNodeId = pathEl.dataset.fromNodeId
        const toNodeId = pathEl.dataset.toNodeId
        const fromPin = pathEl.dataset.fromPin
        const toPin = pathEl.dataset.toPin
        if (!fromNodeId || !toNodeId || !fromPin || !toPin) return
        if (!draggedIds.has(fromNodeId) && !draggedIds.has(toNodeId)) return
        const fromKey = `${fromNodeId}:output:${fromPin}`
        const toKey = `${toNodeId}:input:${toPin}`
        const fromEl = container.querySelector<HTMLElement>(`[data-pin-key="${fromKey}"]`)
        const toEl = container.querySelector<HTMLElement>(`[data-pin-key="${toKey}"]`)
        if (!fromEl || !toEl) return
        const fromRect = fromEl.getBoundingClientRect()
        const toRect = toEl.getBoundingClientRect()
        const fromScreenX = fromRect.left - rect.left + fromRect.width / 2
        const fromScreenY = fromRect.top - rect.top + fromRect.height / 2
        const toScreenX = toRect.left - rect.left + toRect.width / 2
        const toScreenY = toRect.top - rect.top + toRect.height / 2
        const from = {
          x: (fromScreenX - viewState.x) / viewState.zoom,
          y: (fromScreenY - viewState.y) / viewState.zoom,
        }
        const to = {
          x: (toScreenX - viewState.x) / viewState.zoom,
          y: (toScreenY - viewState.y) / viewState.zoom,
        }
        const dx = Math.max(60, Math.abs(to.x - from.x) * 0.4)
        pathEl.setAttribute(
          'd',
          `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`,
        )
      })
    }

    const applyDragPreview = (clientX: number, clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const rect = container.getBoundingClientRect()
      const viewState = viewRef.current
      const worldX = (clientX - rect.left - viewState.x) / viewState.zoom
      const worldY = (clientY - rect.top - viewState.y) / viewState.zoom
      drag.ids.forEach((id) => {
        const offset = drag.offsets[id]
        if (!offset) return
        const element =
          drag.elements?.[id] ??
          container.querySelector<HTMLElement>(`.node-card[data-node-id="${id}"]`)
        if (!element) return
        if (!drag.elements) {
          drag.elements = {}
        }
        drag.elements[id] = element
        element.style.willChange = 'transform'
        element.style.transform = `translate(${worldX - offset.x}px, ${worldY - offset.y}px)`
      })
      updateDraggedLinkPaths(new Set(drag.ids))
    }

    const clearDragPreview = () => {
      const drag = dragRef.current
      if (!drag?.elements) return
      Object.values(drag.elements).forEach((element) => {
        element.style.willChange = ''
        element.style.transform = ''
      })
    }

    const commitDragUpdate = (clientX: number, clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const rect = container.getBoundingClientRect()
      const viewState = viewRef.current
      const worldX = (clientX - rect.left - viewState.x) / viewState.zoom
      const worldY = (clientY - rect.top - viewState.y) / viewState.zoom
      const draggedIds = new Set(drag.ids)
      setEditorNodesRef.current((prev) =>
        prev.map((node) => {
          if (!draggedIds.has(node.id)) return node
          const offset = drag.offsets[node.id]
          if (!offset) return node
          return {
            ...node,
            x: worldX - offset.x,
            y: worldY - offset.y,
          }
        }),
      )
    }

    const scheduleDragUpdate = (clientX: number, clientY: number) => {
      dragPointerRef.current = { clientX, clientY }
      if (dragRafRef.current !== null) return
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null
        const pointer = dragPointerRef.current
        if (!pointer) return
        applyDragPreview(pointer.clientX, pointer.clientY)
      })
    }

    const schedulePanUpdate = (clientX: number, clientY: number) => {
      panPointerRef.current = { clientX, clientY }
      if (panRafRef.current !== null) return
      panRafRef.current = window.requestAnimationFrame(() => {
        panRafRef.current = null
        const pan = panRef.current
        const pointer = panPointerRef.current
        if (!pan || !pointer) return
        const viewState = viewRef.current
        const nextX = pan.originX + (pointer.clientX - pan.startX)
        const nextY = pan.originY + (pointer.clientY - pan.startY)
        if (viewState.x === nextX && viewState.y === nextY) return
        const nextView = { ...viewState, x: nextX, y: nextY }
        viewRef.current = nextView
        applyViewportTransform(nextView)
      })
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      const pan = panRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const draft = linkDraftRef.current
        if (draft) {
          const next = {
            ...draft,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          }
          linkDraftRef.current = next
          setLinkDraft(next)
        }
        if (drag) {
          if (groupDragRef.current && !groupDragRef.current.moved) {
            const dx = event.clientX - groupDragRef.current.startX
            const dy = event.clientY - groupDragRef.current.startY
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
              groupDragRef.current.moved = true
            }
          }
          scheduleDragUpdate(event.clientX, event.clientY)
        }
        if (pan) {
          schedulePanUpdate(event.clientX, event.clientY)
        }
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      const hadPan = Boolean(panRef.current)
      const hadNodeDrag = Boolean(dragRef.current)
      if (hadNodeDrag) {
        if (dragRafRef.current !== null) {
          window.cancelAnimationFrame(dragRafRef.current)
          dragRafRef.current = null
        }
        clearDragPreview()
        commitDragUpdate(event.clientX, event.clientY)
        dragPointerRef.current = null
      }
      const draft = linkDraftRef.current
      if (draft) {
        const target = event.target as HTMLElement | null
        const inputPin = target?.closest<HTMLElement>('[data-pin-type="input"]')
        if (inputPin) {
          const nodeId = inputPin.dataset.nodeId
          const pin = inputPin.dataset.pinName
          if (nodeId && pin) {
            const currentNodes = nodesRef.current
            const currentConnections = connectionsRef.current
            const nodeMap = buildNodeMap(currentNodes)
            const connectionMap = buildConnectionMap(currentConnections)
            const target = nodeMap.get(nodeId)
            const expected =
              target &&
              inputTypes[target.type as keyof typeof inputTypes]?.[
                pin as
                  | 'a'
                  | 'b'
                  | 'cond'
                  | 'threshold'
                  | 't'
                  | 'value'
                  | 'edge'
                  | 'edge0'
                  | 'edge1'
                  | 'x'
                  | 'coord'
                  | 'texcoord'
                  | 'amplitude'
                  | 'pivot'
                  | 'octaves'
                  | 'lacunarity'
                  | 'diminish'
                  | 'jitter'
                  | 'strength'
                  | 'center'
                  | 'size'
                  | 'uv'
                  | 'scale'
                  | 'rotation'
                  | 'min'
                  | 'max'
                  | 'y'
                  | 'z'
                  | 'w'
                  | 'c0'
                  | 'c1'
                  | 'c2'
                  | 'c3'
                  | 'base'
                  | 'exp'
                  | 'incident'
                  | 'speed'
                  | 'time'
                  | 'normal'
                  | 'eta'
                  | 'n'
                  | 'i'
                  | 'nref'
                  | 'opacity'
                  | 'alphaTest'
                  | 'alphaHash'
                  | 'map'
                  | 'alphaMap'
                  | 'aoMap'
                  | 'envMap'
                  | 'envMapIntensity'
                  | 'reflectivity'
                  | 'baseColor'
                  | 'baseColorTexture'
                  | 'roughnessMap'
                  | 'metalnessMap'
                  | 'emissive'
                  | 'emissiveMap'
                  | 'emissiveIntensity'
                  | 'normalMap'
                  | 'normalScale'
                  | 'aoMapIntensity'
                  | 'roughness'
                  | 'metalness'
                  | 'position'
                  | 'geometry'
              ]
            if (expected) {
              const actual = inferType(
                draft.from.nodeId,
                draft.from.pin,
                nodeMap,
                connectionMap,
                new Set(),
              )
              if (target?.type === 'add' || target?.type === 'multiply') {
                const otherPin = pin === 'a' ? 'b' : 'a'
                const other = connectionMap.get(`${nodeId}:${otherPin}`)
                if (other) {
                  const otherType = inferType(
                    other.from.nodeId,
                    other.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                  const combined = combineTypes(actual, otherType)
                  if (combined === 'unknown') {
                    setToast('Type mismatch')
                    linkDraftRef.current = null
                    setLinkDraft(null)
                    dragRef.current = null
                    return
                  }
                }
              } else if (
                (target?.type === 'min' || target?.type === 'max' || target?.type === 'mod') &&
                (pin === 'a' || pin === 'b')
              ) {
                const otherPin = pin === 'a' ? 'b' : 'a'
                const other = connectionMap.get(`${nodeId}:${otherPin}`)
                if (other) {
                  const otherType = inferType(
                    other.from.nodeId,
                    other.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                  const combined = combineTypes(actual, otherType)
                  if (combined === 'unknown') {
                    setToast('Type mismatch')
                    linkDraftRef.current = null
                    setLinkDraft(null)
                    dragRef.current = null
                    return
                  }
                }
              } else if (target?.type === 'distance' && (pin === 'a' || pin === 'b')) {
                const otherPin = pin === 'a' ? 'b' : 'a'
                const other = connectionMap.get(`${nodeId}:${otherPin}`)
                if (other) {
                  const otherType = inferType(
                    other.from.nodeId,
                    other.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                  if (resolveVectorOutputKind([actual, otherType]) === 'unknown') {
                    setToast('Type mismatch')
                    linkDraftRef.current = null
                    setLinkDraft(null)
                    dragRef.current = null
                    return
                  }
                }
              } else if (
                (target?.type === 'lessThan' ||
                  target?.type === 'lessThanEqual' ||
                  target?.type === 'greaterThan' ||
                  target?.type === 'greaterThanEqual' ||
                  target?.type === 'equal' ||
                  target?.type === 'notEqual' ||
                  target?.type === 'and' ||
                  target?.type === 'or') &&
                (pin === 'a' || pin === 'b')
              ) {
                const otherPin = pin === 'a' ? 'b' : 'a'
                const other = connectionMap.get(`${nodeId}:${otherPin}`)
                if (other) {
                  const otherType = inferType(
                    other.from.nodeId,
                    other.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                  if (resolveVectorOutputKind([actual, otherType]) === 'unknown') {
                    setToast('Type mismatch')
                    linkDraftRef.current = null
                    setLinkDraft(null)
                    dragRef.current = null
                    return
                  }
                }
              } else if (target?.type === 'dot' && (pin === 'a' || pin === 'b')) {
                const otherPin = pin === 'a' ? 'b' : 'a'
                const other = connectionMap.get(`${nodeId}:${otherPin}`)
                if (other) {
                  const otherType = inferType(
                    other.from.nodeId,
                    other.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                  const vecA = getVectorKind(actual)
                  const vecB = getVectorKind(otherType)
                  if (!vecA || !vecB || vecA !== vecB) {
                    setToast('Type mismatch')
                    linkDraftRef.current = null
                    setLinkDraft(null)
                    dragRef.current = null
                    return
                  }
                }
              } else if (target?.type === 'atan2') {
                const resolvePinType = (name: string) => {
                  const linked = connectionMap.get(`${nodeId}:${name}`)
                  if (!linked) return 'number'
                  return inferType(
                    linked.from.nodeId,
                    linked.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                }
                const yType = pin === 'y' ? actual : resolvePinType('y')
                const xType = pin === 'x' ? actual : resolvePinType('x')
                if (resolveVectorOutputKind([yType, xType]) === 'unknown') {
                  setToast('Type mismatch')
                  linkDraftRef.current = null
                  setLinkDraft(null)
                  dragRef.current = null
                  return
                }
              } else if (target?.type === 'step') {
                const resolvePinType = (name: string) => {
                  const linked = connectionMap.get(`${nodeId}:${name}`)
                  if (!linked) return 'number'
                  return inferType(
                    linked.from.nodeId,
                    linked.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                }
                const edgeType = pin === 'edge' ? actual : resolvePinType('edge')
                const xType = pin === 'x' ? actual : resolvePinType('x')
                if (resolveVectorOutputKind([edgeType, xType]) === 'unknown') {
                  setToast('Type mismatch')
                  linkDraftRef.current = null
                  setLinkDraft(null)
                  dragRef.current = null
                  return
                }
              } else if (target?.type === 'stepElement') {
                const resolvePinType = (name: string) => {
                  const linked = connectionMap.get(`${nodeId}:${name}`)
                  if (!linked) return 'number'
                  return inferType(
                    linked.from.nodeId,
                    linked.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                }
                const edgeType = pin === 'edge' ? actual : resolvePinType('edge')
                const xType = pin === 'x' ? actual : resolvePinType('x')
                if (resolveVectorOutputKind([edgeType, xType]) === 'unknown') {
                  setToast('Type mismatch')
                  linkDraftRef.current = null
                  setLinkDraft(null)
                  dragRef.current = null
                  return
                }
              } else if (target?.type === 'mix' && (pin === 'a' || pin === 'b')) {
                const otherPin = pin === 'a' ? 'b' : 'a'
                const other = connectionMap.get(`${nodeId}:${otherPin}`)
                if (other) {
                  const otherType = inferType(
                    other.from.nodeId,
                    other.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                  const combined = combineTypes(actual, otherType)
                  if (combined === 'unknown') {
                    setToast('Type mismatch')
                    linkDraftRef.current = null
                    setLinkDraft(null)
                    dragRef.current = null
                    return
                  }
                }
              } else if (target?.type === 'ifElse') {
                if (pin === 'a' || pin === 'b') {
                  const otherPin = pin === 'a' ? 'b' : 'a'
                  const other = connectionMap.get(`${nodeId}:${otherPin}`)
                  if (other) {
                    const otherType = inferType(
                      other.from.nodeId,
                      other.from.pin,
                      nodeMap,
                      connectionMap,
                      new Set(),
                    )
                    const combined = combineTypes(actual, otherType)
                    if (combined === 'unknown') {
                      setToast('Type mismatch')
                      linkDraftRef.current = null
                      setLinkDraft(null)
                      dragRef.current = null
                      return
                    }
                  }
                } else if (pin === 'cond') {
                  const inputA = connectionMap.get(`${nodeId}:a`)
                  const inputB = connectionMap.get(`${nodeId}:b`)
                  const typeA = inputA
                    ? inferType(
                        inputA.from.nodeId,
                        inputA.from.pin,
                        nodeMap,
                        connectionMap,
                        new Set(),
                      )
                    : 'number'
                  const typeB = inputB
                    ? inferType(
                        inputB.from.nodeId,
                        inputB.from.pin,
                        nodeMap,
                        connectionMap,
                        new Set(),
                      )
                    : 'number'
                  const outputKind = combineTypes(typeA, typeB)
                  if (outputKind === 'number' && actual !== 'number' && !isVectorKind(actual)) {
                    setToast('Type mismatch: number expected')
                    linkDraftRef.current = null
                    setLinkDraft(null)
                    dragRef.current = null
                    return
                  }
                  if (
                    outputKind !== 'number' &&
                    isVectorKind(outputKind) &&
                    resolveVectorOutputKind([actual, outputKind]) === 'unknown' &&
                    actual !== 'number'
                  ) {
                    setToast('Type mismatch')
                    linkDraftRef.current = null
                    setLinkDraft(null)
                    dragRef.current = null
                    return
                  }
                }
              } else if (target?.type === 'smoothstep') {
                const resolvePinType = (name: string) => {
                  const linked = connectionMap.get(`${nodeId}:${name}`)
                  if (!linked) return 'number'
                  return inferType(
                    linked.from.nodeId,
                    linked.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                }
                const edge0Type = pin === 'edge0' ? actual : resolvePinType('edge0')
                const edge1Type = pin === 'edge1' ? actual : resolvePinType('edge1')
                const xType = pin === 'x' ? actual : resolvePinType('x')
                if (resolveVectorOutputKind([edge0Type, edge1Type, xType]) === 'unknown') {
                  setToast('Type mismatch')
                  linkDraftRef.current = null
                  setLinkDraft(null)
                  dragRef.current = null
                  return
                }
              } else if (target?.type === 'smoothstepElement') {
                const resolvePinType = (name: string) => {
                  const linked = connectionMap.get(`${nodeId}:${name}`)
                  if (!linked) return 'number'
                  return inferType(
                    linked.from.nodeId,
                    linked.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                }
                const lowType = pin === 'low' ? actual : resolvePinType('low')
                const highType = pin === 'high' ? actual : resolvePinType('high')
                const xType = pin === 'x' ? actual : resolvePinType('x')
                if (resolveVectorOutputKind([lowType, highType, xType]) === 'unknown') {
                  setToast('Type mismatch')
                  linkDraftRef.current = null
                  setLinkDraft(null)
                  dragRef.current = null
                  return
                }
              } else if (target?.type === 'pow') {
                const resolvePinType = (name: string) => {
                  const linked = connectionMap.get(`${nodeId}:${name}`)
                  if (!linked) return 'number'
                  return inferType(
                    linked.from.nodeId,
                    linked.from.pin,
                    nodeMap,
                    connectionMap,
                    new Set(),
                  )
                }
                const baseType = pin === 'base' ? actual : resolvePinType('base')
                const expType = pin === 'exp' ? actual : resolvePinType('exp')
                if (resolveVectorOutputKind([baseType, expType]) === 'unknown') {
                  setToast('Type mismatch')
                  linkDraftRef.current = null
                  setLinkDraft(null)
                  dragRef.current = null
                  return
                }
              }
              if (!isAssignableType(actual, expected)) {
                setToast(`Type mismatch: ${expected} expected`)
                linkDraftRef.current = null
                setLinkDraft(null)
                dragRef.current = null
                return
              }
            }
            setEditorConnectionsRef.current((prev) => [
              ...prev.filter(
                (connection) =>
                  !(
                    connection.to.nodeId === nodeId &&
                    connection.to.pin === pin
                  ),
              ),
              {
                id: `link-${Date.now()}-${prev.length}`,
                from: draft.from,
                to: { nodeId, pin },
              },
            ])
          }
        }
        linkDraftRef.current = null
        setLinkDraft(null)
      }
      dragRef.current = null
      if (hadNodeDrag) {
        isDraggingNodesRef.current = false
      }
      if (groupDragRef.current?.moved) {
        groupClickSuppressRef.current = { id: groupDragRef.current.id }
      }
      groupDragRef.current = null
      panRef.current = null
      if (hadPan) {
        if (panRafRef.current !== null) {
          window.cancelAnimationFrame(panRafRef.current)
          panRafRef.current = null
        }
        panPointerRef.current = null
        setView(viewRef.current)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!container.contains(event.target as Node)) return
      const target = event.target as HTMLElement | null
      if (target?.closest('.node-card')) return
      if (target?.closest('.node-group-header')) return
      if (target?.closest('.node-group-action')) return
      if (event.button !== 0) return
      setSelectedNodeIds([])
      const viewState = viewRef.current
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: viewState.x,
        originY: viewState.y,
      }
    }

    const handleWheel = (event: WheelEvent) => {
      if (!container.contains(event.target as Node)) return
      event.preventDefault()
      const rect = container.getBoundingClientRect()
      const viewState = viewRef.current
      if (event.ctrlKey) {
        const zoomScale = Math.exp(-event.deltaY * 0.001)
        const nextZoom = Math.min(
          2.5,
          Math.max(0.1, viewState.zoom * zoomScale),
        )
        const cursorX = event.clientX - rect.left
        const cursorY = event.clientY - rect.top
        const factor = nextZoom / viewState.zoom
        const nextX = cursorX - (cursorX - viewState.x) * factor
        const nextY = cursorY - (cursorY - viewState.y) * factor
        const nextView = { x: nextX, y: nextY, zoom: nextZoom }
        viewRef.current = nextView
        applyViewportTransform(nextView)
        setView(nextView)
      } else {
        const nextView = {
          ...viewState,
          x: viewState.x - event.deltaX,
          y: viewState.y - event.deltaY,
        }
        viewRef.current = nextView
        applyViewportTransform(nextView)
        setView(nextView)
      }
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      if (dragRafRef.current !== null) {
        window.cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
      if (panRafRef.current !== null) {
        window.cancelAnimationFrame(panRafRef.current)
        panRafRef.current = null
      }
      clearDragPreview()
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('wheel', handleWheel)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [applyViewportTransform])

  useEffect(() => {
    const container = previewRef.current
    if (!container) return
    let disposed = false

    const scene = new Scene()
    scene.background = new Color(0x0e1013)

    const camera = new PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(3.2, 2.6, 4)
    camera.lookAt(0, 0, 0)

    const geometry = new BoxGeometry(1, 1, 1)
    let material:
      | MeshStandardNodeMaterial
      | MeshPhysicalNodeMaterial
      | MeshBasicNodeMaterial
      | null = null
    let renderer: WebGPURenderer | null = null

    scene.add(new AmbientLight(0xffffff, 0.6))
    const keyLight = new DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(4, 6, 2)
    scene.add(keyLight)

    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      if (renderer) {
        renderer.setSize(width, height, false)
      }
    }

    const resizeObserver = new ResizeObserver(resize)

  const start = async () => {
    try {
      if (!disposed) {
        setStatus('Checking WebGPU...')
      }
      if (!WebGPU.isAvailable()) {
        if (!disposed) {
          setStatus('WebGPU not available')
        }
        return
      }
      if (!disposed) {
        setStatus('Creating renderer...')
      }
      renderer = new WebGPURenderer({ antialias: true })
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.outputColorSpace = SRGBColorSpace
      renderer.toneMapping = NoToneMapping
      renderer.toneMappingExposure = 1
      rendererRef.current = renderer
      container.appendChild(renderer.domElement)

      if (!disposed) {
        setStatus('Initializing scene...')
      }
      material = new MeshStandardNodeMaterial()
      materialRef.current = material
      sceneRef.current = scene
        const mesh = new Mesh(geometry, material)
        meshesRef.current = [mesh]
      geometriesRef.current = [geometry]
      setMaterialReady(true)

      if (!disposed) {
        setStatus('Initializing renderer...')
      }
      await renderer.init()
      if (!disposed) {
        setStatus('Loading texture support...')
      }
      const ktx2Loader = new KTX2Loader().setTranscoderPath('/basis/')
      ktx2Loader.detectSupport(renderer)
      ktx2LoaderRef.current = ktx2Loader
      setKtx2Ready(true)
      if (!disposed) {
        setStatus('Compiling shaders...')
      }
    } catch {
      if (!disposed) {
        setStatus('Renderer init failed')
      }
      return
    }

      meshesRef.current.forEach((mesh) => scene.add(mesh))
      resize()
      resizeObserver.observe(container)

    const startTime = performance.now()
    let lastTick = startTime
    let frames = 0
    let firstFrame = true
    renderer.setAnimationLoop(() => {
      timeUniformRef.current.value = (performance.now() - startTime) / 1000
      renderer?.render(scene, camera)
      if (firstFrame) {
        if (!disposed) {
          setStatus('WebGPU/TSL running')
        }
        firstFrame = false
      }
      frames += 1
      const now = performance.now()
      if (now - lastTick > 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTick))
        if (!disposed) {
          setStatus(`WebGPU/TSL running (${fps} fps)`)
        }
        lastTick = now
        frames = 0
      }
    })
    }

    void start()

    return () => {
      disposed = true
      resizeObserver.disconnect()
      renderer?.setAnimationLoop(null)
      renderer?.dispose()
      ktx2LoaderRef.current?.dispose()
      ktx2LoaderRef.current = null
      rendererRef.current = null
      setKtx2Ready(false)
      meshesRef.current.forEach((mesh) => scene.remove(mesh))
      meshesRef.current = []
      geometriesRef.current.forEach((geometry) => geometry.dispose())
      geometriesRef.current = []
      material?.dispose()
      if (renderer?.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  const displayView = panRef.current ? viewRef.current : view

  const navigateGraph = (ids?: string[]) => {
    const container = viewportRef.current
    if (!container) return
    const visible = editorNodes.filter((node) => !isNodeInCollapsedGroup(node.id) && (!ids || ids.includes(node.id)))
    const boxes = visible.map((node) => {
      const card = container.querySelector<HTMLElement>(`[data-node-id="${node.id}"].node-card`)
      return { x: node.x, y: node.y, width: card?.offsetWidth || 260, height: card?.offsetHeight || 180 }
    })
    // Collapsed groups are graph content too, even when all their cards are hidden.
    editorGroups.filter((group) => group.collapsed && (!ids || group.nodeIds.some((id) => ids.includes(id)))).forEach((group) => {
      const bounds = groupBounds[group.id]
      if (bounds) boxes.push({ ...bounds, height: 56 })
    })
    if (!boxes.length) return
    const left = Math.min(...boxes.map((box) => box.x))
    const top = Math.min(...boxes.map((box) => box.y))
    const width = Math.max(...boxes.map((box) => box.x + box.width)) - left
    const height = Math.max(...boxes.map((box) => box.y + box.height)) - top
    const zoom = Math.min(1, Math.max(0.1, Math.min((container.clientWidth - 64) / width, (container.clientHeight - 64) / height)))
    const next = { x: (container.clientWidth - width * zoom) / 2 - left * zoom, y: (container.clientHeight - height * zoom) / 2 - top * zoom, zoom }
    viewRef.current = next
    applyViewportTransform(next)
    setView(next)
  }
  const zoomGraph = (factor: number) => {
    const container = viewportRef.current
    if (!container) return
    const current = viewRef.current
    const zoom = Math.max(0.1, Math.min(2.5, current.zoom * factor))
    const x = container.clientWidth / 2
    const y = container.clientHeight / 2
    const next = { x: x - (x - current.x) * zoom / current.zoom, y: y - (y - current.y) * zoom / current.zoom, zoom }
    viewRef.current = next
    applyViewportTransform(next)
    setView(next)
  }
  const inspectedNode = editorNodes.find((node) => selectedNodeIds.includes(node.id))

  return (
    <div className={`app workspace${paletteVisible ? '' : ' palette-collapsed'}`} data-compact-panel={compactPanel}>
      <header className="workspace-header">
        <a className="workspace-brand" href="https://github.com/takahirox/tsl-node-editor" target="_blank" rel="noreferrer">TSL <span>Node Editor</span></a>
        <details className="project-menu" onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.currentTarget.open = false
            event.currentTarget.querySelector('summary')?.focus()
          }
        }}>
          <summary>Project</summary>
          <div className="project-popover">
        <section className="panel">
          <h2>Project slots</h2>
          <p className="empty-state">Changes save automatically in this browser. Switch slots to load a project.</p>
          <div className="slot-row">
            <label className="export-format">
              <span>Active slot</span>
              <select
                className="palette-select"
                value={storageSlot}
                onChange={(event) => setStorageSlot(event.target.value)}
              >
                {storageSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="button-row slot-actions">
            <button
              className="palette-button danger compact"
              type="button"
              disabled={storageSlot === 'default'}
              onClick={async () => {
                const target = normalizeSlot(storageSlot)
                if (target === 'default') return
                if (!window.confirm(`Delete slot "${target}"?`)) return
                if (target === storageSlot) {
                  const fallback =
                    storageSlots.find((slot) => slot !== target) ?? 'default'
                  isHydratingRef.current = true
                  await deleteSlot(target)
                  setStorageSlot(fallback)
                  return
                }
                await deleteSlot(target)
              }}
            >
              Delete Slot
            </button>
            <button
              className="palette-button danger compact"
              type="button"
              onClick={async () => {
                const target = normalizeSlot(storageSlot)
                if (!window.confirm(`Clear slot "${target}"?`)) return
                await clearSlot(target)
                Object.values(objectUrlRef.current).forEach((url) => URL.revokeObjectURL(url))
                objectUrlRef.current = {}
                setActiveFunctionId(null)
                setNodes([])
                setConnections([])
                setGroups([])
                setFunctions({})
                setSelectedNodeIds([])
                setToast(`Cleared slot "${target}"`)
              }}
            >
              Clear Slot
            </button>
          </div>
          <div className="slot-row">
            <input
              className="palette-input"
              placeholder="New slot"
              aria-label="New slot name"
              value={newSlotName}
              onChange={(event) => setNewSlotName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const next = normalizeSlot(newSlotName)
                if (!next) return
                const examplePalette = {
                  ...paletteDefaults,
                  ...(exampleGraph.ui?.paletteOpen ?? {}),
                }
                void writeGraphRecord(
                  next,
                  {
                    nodes: exampleGraph.nodes as GraphNode[],
                    connections: exampleGraph.connections as GraphConnection[],
                    groups: (exampleGraph.groups ?? []) as GraphGroup[],
                    functions: (exampleGraph.functions ?? {}) as Record<string, FunctionDefinition>,
                    ui: { paletteOpen: examplePalette },
                  },
                  { silent: true },
                )
                pendingExampleLayoutRef.current = true
                setStorageSlot(next)
                setNewSlotName('')
              }}
            />
            <button
              className="palette-button"
              type="button"
              onClick={async () => {
                const next = normalizeSlot(newSlotName)
                if (!next) return
                const examplePalette = {
                  ...paletteDefaults,
                  ...(exampleGraph.ui?.paletteOpen ?? {}),
                }
                await writeGraphRecord(
                  next,
                  {
                    nodes: exampleGraph.nodes as GraphNode[],
                    connections: exampleGraph.connections as GraphConnection[],
                    groups: (exampleGraph.groups ?? []) as GraphGroup[],
                    functions: (exampleGraph.functions ?? {}) as Record<string, FunctionDefinition>,
                    ui: { paletteOpen: examplePalette },
                  },
                  { silent: true },
                )
                pendingExampleLayoutRef.current = true
                setStorageSlot(next)
                setNewSlotName('')
              }}
              disabled={!newSlotName.trim()}
            >
              Create
            </button>
          </div>
        </section>
          </div>
        </details>
        <div className="history-actions" role="group" aria-label="History">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
        </div>
        <span className="workspace-slot" title="Active project slot">{storageSlot}</span>
        <button className="library-toggle" type="button" aria-pressed={paletteVisible} onClick={() => setPaletteVisible((value) => !value)}>Nodes</button>
        <button className="output-toggle" type="button" aria-pressed={showCode} onClick={() => setShowCode((value) => !value)}>{showCode ? 'Hide output' : 'Code & export'}</button>
      </header>
      <nav className="compact-tabs" aria-label="Workspace panels">
        {['graph', 'nodes', 'preview', 'inspect', 'output'].map((panel) => (
          <button key={panel} type="button" aria-pressed={compactPanel === panel} onClick={() => setCompactPanel(panel)}>{panel === 'inspect' ? 'Inspector' : panel}</button>
        ))}
      </nav>
      <aside className="sidebar" aria-label="Node library">
        {isFunctionEditing ? (
          <section className="panel">
            <h2>Function Editor</h2>
            <div className="function-editor-title">
              {activeFunction?.name ?? 'Unknown Function'}
            </div>
            <div className="button-row">
              <button
                className="palette-button"
                type="button"
                onClick={() => setActiveFunctionId(null)}
              >
                Back to Graph
              </button>
            </div>
            <div className="function-pin-editor">
              <div className="function-pin-section">
                <div className="function-pin-title">Inputs</div>
                {activeFunction?.inputs.length ? (
                  activeFunction.inputs.map((pin, index) => (
                    <div className="function-pin-row" key={`${pin.nodeId}-${pin.name}`}>
                      <input
                        aria-label="Function pin name"
                        className="function-pin-input"
                        defaultValue={pin.name}
                        onBlur={(event) => {
                          const next = event.currentTarget.value
                          const ok = renameFunctionPin('input', index, next)
                          if (!ok) {
                            event.currentTarget.value = pin.name
                          }
                        }}
                      />
                      <div className="function-pin-actions">
                        <button
                          className="function-pin-button"
                          type="button"
                          onClick={() => moveFunctionPin('input', index, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          className="function-pin-button"
                          type="button"
                          onClick={() => moveFunctionPin('input', index, 1)}
                          disabled={index === activeFunction.inputs.length - 1}
                        >
                          Down
                        </button>
                        <button
                          className="function-pin-button danger"
                          type="button"
                          onClick={() => removeFunctionPin('input', index)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="function-pin-empty">No inputs</div>
                )}
              </div>
              <div className="function-pin-section">
                <div className="function-pin-title">Outputs</div>
                {activeFunction?.outputs.length ? (
                  activeFunction.outputs.map((pin, index) => (
                    <div className="function-pin-row" key={`${pin.nodeId}-${pin.name}`}>
                      <input
                        aria-label="Function pin name"
                        className="function-pin-input"
                        defaultValue={pin.name}
                        onBlur={(event) => {
                          const next = event.currentTarget.value
                          const ok = renameFunctionPin('output', index, next)
                          if (!ok) {
                            event.currentTarget.value = pin.name
                          }
                        }}
                      />
                      <div className="function-pin-actions">
                        <button
                          className="function-pin-button"
                          type="button"
                          onClick={() => moveFunctionPin('output', index, -1)}
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          className="function-pin-button"
                          type="button"
                          onClick={() => moveFunctionPin('output', index, 1)}
                          disabled={index === activeFunction.outputs.length - 1}
                        >
                          Down
                        </button>
                        <button
                          className="function-pin-button danger"
                          type="button"
                          onClick={() => removeFunctionPin('output', index)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="function-pin-empty">No outputs</div>
                )}
              </div>
            </div>
          </section>
        ) : null}
        <section className="panel">
          <div className="panel-heading"><h2>Node library</h2><span>Add nodes</span></div>
          <div className="palette">
            <input
              className="palette-search"
              type="search"
              placeholder="Search nodes"
              aria-label="Search nodes"
              value={paletteQuery}
              onChange={(event) => setPaletteQuery(event.target.value)}
            />
            <div className="button-row slot-actions">
              <button
                className="palette-button compact"
                type="button"
                onClick={() => setPaletteOpen((prev) => ({ ...prev, ...allPaletteOpen }))}
                disabled={isPaletteAllExpanded}
              >
                Expand All
              </button>
              <button
                className="palette-button compact"
                type="button"
                onClick={() => setPaletteOpen((prev) => ({ ...prev, ...allPaletteClosed }))}
                disabled={isPaletteAllCollapsed}
              >
                Collapse All
              </button>
            </div>
            {!filteredPaletteGroups.length ? <p className="empty-state">No nodes match “{paletteQuery}”. Try a type such as Color or Texture.</p> : null}
            {filteredPaletteGroups.map((group) => (
              <div key={group.id} className="palette-group">
                <button
                  className="palette-group-toggle"
                  aria-expanded={Boolean(paletteQuery.trim()) || Boolean(paletteOpen[group.id])}
                  type="button"
                  onClick={() =>
                    setPaletteOpen((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }))
                  }
                >
                  <span className="palette-group-caret">
                    {paletteQuery.trim() || paletteOpen[group.id] ? '−' : '+'}
                  </span>
                  <span className="palette-group-title">{group.label}</span>
                </button>
                {paletteQuery.trim() || paletteOpen[group.id] ? (
                  <div className="palette-group-list">
                    {group.types.map((type) => {
                      const item = palette.find((entry) => entry.type === type)
                      if (!item) return null
                      return (
                        <button
                          key={item.type}
                          className="palette-button"
                          onClick={() => { addNode(item.type, item.label); setCompactPanel('graph') }}
                          type="button"
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </aside>
      <main className={`graph-workspace${showCode ? ' output-open' : ''}`} aria-label="Graph workspace">
        <div className="graph-toolbar" role="group" aria-label="Graph actions">
          <strong>{isFunctionEditing ? activeFunction?.name : 'Material graph'}</strong>
          {isFunctionEditing ? <button type="button" onClick={() => setActiveFunctionId(null)}>Back to Graph</button> : null}
          <button type="button" onClick={layoutNodes}>Auto Layout</button>
          <button type="button" onClick={groupSelectedNodes} disabled={!selectedNodeIds.length || isFunctionEditing}>Group Selected</button>
          <button type="button" onClick={ungroupSelectedNodes} disabled={!selectedNodeIds.length || isFunctionEditing}>Ungroup Selected</button>
        </div>
        <div className="viewport graph-viewport" ref={viewportRef} aria-label="Node graph">
          <div className="node-canvas">
            <>
              <svg
                ref={nodeLinksRef}
                className="node-links"
                style={{
                  transform: `translate(${displayView.x}px, ${displayView.y}px) scale(${displayView.zoom})`,
                  transformOrigin: '0 0',
                }}
              >
                {editorConnections.map((link) => {
                  const fromKey = `${link.from.nodeId}:output:${link.from.pin}`
                  const toKey = `${link.to.nodeId}:input:${link.to.pin}`
                  const from = pinPositions[fromKey]
                  const to = pinPositions[toKey]
                  if (!from || !to) return null
                  const dx = Math.max(60, Math.abs(to.x - from.x) * 0.4)
                  const path = `M ${from.x} ${from.y} C ${
                    from.x + dx
                  } ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`
                  return (
                    <path
                      key={link.id}
                      d={path}
                      data-link-id={link.id}
                      data-from-node-id={link.from.nodeId}
                      data-to-node-id={link.to.nodeId}
                      data-from-pin={link.from.pin}
                      data-to-pin={link.to.pin}
                    />
                  )
                })}
                {linkDraft ? (
                  (() => {
                    const fromKey = `${linkDraft.from.nodeId}:output:${linkDraft.from.pin}`
                    const from = pinPositions[fromKey]
                    if (!from) return null
                    const draftX = (linkDraft.x - displayView.x) / displayView.zoom
                    const draftY = (linkDraft.y - displayView.y) / displayView.zoom
                    const dx = Math.max(
                      60,
                      Math.abs(draftX - from.x) * 0.4,
                    )
                    const path = `M ${from.x} ${from.y} C ${
                      from.x + dx
                    } ${from.y}, ${draftX - dx} ${draftY}, ${draftX} ${draftY}`
                    return <path className="draft" d={path} />
                  })()
                ) : null}
              </svg>
          {editorNodes.length === 0 ? (
            <div className="node-empty">Your graph is empty. Open Nodes and search for a node to begin.</div>
          ) : null}
              <div
                ref={nodeWorldRef}
                className="node-world"
                style={{
                  transform: `translate(${displayView.x}px, ${displayView.y}px) scale(${displayView.zoom})`,
                }}
              >
                {editorGroups.map((group) => {
                  const bounds = groupBounds[group.id]
                  if (!bounds) return null
                  return (
                  <div
                    key={group.id}
                    className={`node-group${group.collapsed ? ' collapsed' : ''}`}
                    style={{
                      transform: `translate(${bounds.x}px, ${bounds.y}px)`,
                      width: `${bounds.width}px`,
                      height: group.collapsed ? '56px' : `${bounds.height}px`,
                    }}
                  >
                    <div className="node-group-heading">
                    <button
                      aria-expanded={!group.collapsed}
                      className="node-group-header"
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        if (event.button !== 0) return
                        if (!group.nodeIds.length) return
                        const container = viewportRef.current
                        if (!container) return
                        panRef.current = null
                        const rect = container.getBoundingClientRect()
                        const viewState = viewRef.current
                        const worldX =
                          (event.clientX - rect.left - viewState.x) / viewState.zoom
                        const worldY =
                          (event.clientY - rect.top - viewState.y) / viewState.zoom
                        groupDragRef.current = {
                          id: group.id,
                          startX: event.clientX,
                          startY: event.clientY,
                          moved: false,
                        }
                        const offsets: Record<string, { x: number; y: number }> = {}
                        const elements: Record<string, HTMLElement> = {}
                        group.nodeIds.forEach((id) => {
                          const selectedNode = nodes.find((entry) => entry.id === id)
                          if (!selectedNode) return
                          offsets[id] = {
                            x: worldX - selectedNode.x,
                            y: worldY - selectedNode.y,
                          }
                          const element = container.querySelector<HTMLElement>(
                            `.node-card[data-node-id="${id}"]`,
                          )
                          if (element) {
                            elements[id] = element
                          }
                        })
                        dragRef.current = {
                          ids: group.nodeIds,
                          offsets,
                          elements,
                        }
                        isDraggingNodesRef.current = true
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (groupClickSuppressRef.current?.id === group.id) {
                          groupClickSuppressRef.current = null
                          return
                        }
                        setGroups((prev) =>
                          prev.map((item) =>
                            item.id === group.id
                              ? { ...item, collapsed: !item.collapsed }
                              : item,
                          ),
                        )
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation()
                      }}
                    >
                      <span className="node-group-title">{group.label}</span>
                      <span className="node-group-spacer" />

                      <span className="node-group-toggle">
                        {group.collapsed ? '+' : '-'}
                      </span>
                    </button>
                      <button
                        className="node-group-rename"
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          const next = window.prompt('Rename group', group.label)
                          if (typeof next === 'string') {
                            renameGroup(group.id, next)
                          }
                        }}
                      >
                        Rename
                      </button>
                    </div>
                    <button
                      className="node-group-action"
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        createFunctionFromGroup(group)
                      }}
                    >
                      Make Function
                    </button>
                  </div>
                )
              })}
                {editorNodes.map((node) => {
                  const gltfEntry =
                    node.type === 'gltf' || node.type === 'gltfMaterial' || node.type === 'gltfTexture'
                      ? gltfMapRef.current[node.id]
                      : null
                  const meshCount = node.type === 'gltf' ? gltfEntry?.geometries.length ?? 0 : 0
                  const materialCount =
                    node.type === 'gltfMaterial' ? gltfEntry?.materials.length ?? 0 : 0
                  const textureCount =
                    node.type === 'gltfTexture' ? gltfEntry?.textures.length ?? 0 : 0
                  const selectedMeshIndex =
                    node.type === 'gltf'
                      ? String(getMeshIndex(node, meshCount))
                      : '0'
                  const selectedMaterialIndex =
                    node.type === 'gltfMaterial'
                      ? String(getMaterialIndex(node, materialCount))
                      : '0'
                  const selectedTextureIndex =
                    node.type === 'gltfTexture'
                      ? String(getTextureIndex(node, textureCount))
                      : '0'
                  const numberUpdateMode =
                    node.type === 'number' ? getNumberUpdateMode(node) : 'manual'
                  const numberUpdateSource =
                    node.type === 'number'
                      ? getNumberUpdateSource(node, numberUpdateMode)
                      : 'value'
                  const inputGroups = materialInputGroups[node.type]
                  const renderInputPin = (input: string) => (
                    <div
                      className="node-pin-row"
                      key={`${node.id}-input-${input}`}
                      data-pin-type="input"
                      data-node-id={node.id}
                      data-pin-name={input}
                    >
                      <button
                        className={`pin dot-input${
                          typeWarnings[`${node.id}:${input}`] ? ' pin-warning' : ''
                        }`}
                        aria-label={`Disconnect ${node.label} input ${input}`}
                        title={`Input: ${input}. Click to disconnect; drag an output here to connect.`}
                        data-pin-key={`${node.id}:input:${input}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditorConnections((prev) =>
                            prev.filter(
                              (connection) =>
                                !(
                                  connection.to.nodeId === node.id &&
                                  connection.to.pin === input
                                ),
                            ),
                          )
                        }}
                      />
                      <span className="pin-label">
                        {input}
                        {typeWarnings[`${node.id}:${input}`] ? (
                          <span className="pin-warning-text">
                            {typeWarnings[`${node.id}:${input}`]}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )
                  return (
                    <div
                      className={`node-card${
                        selectedNodeIds.includes(node.id) ? ' selected' : ''
                      }${isNodeInCollapsedGroup(node.id) ? ' node-hidden' : ''}`}
                      key={node.id}
                      data-node-id={node.id}
                      tabIndex={0}
                      aria-label={`${node.label} node`}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedNodeIds((prev) => event.shiftKey ? prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id] : [node.id])
                        }
                      }}
                      style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                      onPointerDown={(event) => {
                        const target = event.target as HTMLElement | null
                        if (
                          target &&
                          (target.tagName === 'INPUT' ||
                            target.tagName === 'BUTTON' ||
                            target.tagName === 'SELECT')
                        ) {
                          return
                        }
                        event.preventDefault()
                        event.stopPropagation()
                        setSelectedNodeIds((prev) => {
                          if (event.shiftKey) {
                            return prev.includes(node.id)
                              ? prev.filter((id) => id !== node.id)
                              : [...prev, node.id]
                          }
                          return prev.includes(node.id) ? prev : [node.id]
                        })
                        const container = viewportRef.current
                        if (!container) return
                        const rect = container.getBoundingClientRect()
                        const viewState = viewRef.current
                        const worldX =
                          (event.clientX - rect.left - viewState.x) /
                          viewState.zoom
                        const worldY =
                          (event.clientY - rect.top - viewState.y) /
                          viewState.zoom
                        const selected = event.shiftKey
                          ? selectedNodeIds.includes(node.id)
                            ? selectedNodeIds.filter((id) => id !== node.id)
                            : [...selectedNodeIds, node.id]
                          : selectedNodeIds.includes(node.id)
                            ? selectedNodeIds
                            : [node.id]
                        const offsets: Record<string, { x: number; y: number }> = {}
                        const elements: Record<string, HTMLElement> = {}
                        selected.forEach((id) => {
                          const selectedNode = editorNodes.find((entry) => entry.id === id)
                          if (!selectedNode) return
                          offsets[id] = {
                            x: worldX - selectedNode.x,
                            y: worldY - selectedNode.y,
                          }
                          const element = container.querySelector<HTMLElement>(
                            `.node-card[data-node-id="${id}"]`,
                          )
                          if (element) {
                            elements[id] = element
                          }
                        })
                        dragRef.current = {
                          ids: selected,
                          offsets,
                          elements,
                        }
                        isDraggingNodesRef.current = true
                      }}
                    >
              <div className={`node-header${node.type === 'function' ? ' node-header-function' : ''}`}>
                <div className="node-title">
                  <div className="node-type">
                    {node.type === 'function' ? 'Function' : node.label}
                  </div>
                  {node.type === 'function' ? (
                    <div className="node-subtitle">{node.label}</div>
                  ) : null}
                </div>
                <div className="node-actions">
                  {node.type === 'function' ? (
                    <button
                      className="node-action"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!node.functionId || !functions[node.functionId]) {
                          setToast('Function not found')
                          return
                        }
                        setActiveFunctionId(node.functionId)
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                  {node.type === 'function' ? (
                    <button
                      className="node-action"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        expandFunctionNode(node)
                      }}
                    >
                      Expand
                    </button>
                  ) : null}
                  <button
                    className="node-action"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      const offset = 24
                      setEditorNodes((prev) => [
                        ...prev,
                        {
                          ...node,
                          id: `${node.type}-${Date.now()}-${prev.length}`,
                          x: node.x + offset,
                          y: node.y + offset,
                        },
                      ])
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="node-action danger"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!isFunctionEditing) {
                        removeFunctionsForNodeIds([node.id])
                      }
                      setEditorNodes((prev) => prev.filter((item) => item.id !== node.id))
                      setEditorConnections((prev) =>
                        prev.filter(
                          (connection) =>
                            connection.from.nodeId !== node.id &&
                            connection.to.nodeId !== node.id,
                        ),
                      )
                      if (!isFunctionEditing) {
                        setGroups((prev) =>
                          prev
                            .map((group) => ({
                              ...group,
                              nodeIds: group.nodeIds.filter((id) => id !== node.id),
                            }))
                            .filter((group) => group.nodeIds.length > 0),
                        )
                      }
                      setSelectedNodeIds((prev) => prev.filter((id) => id !== node.id))
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="node-io">
                <div className="node-inputs">
                  {inputGroups
                    ? inputGroups.map((group) => {
                        const pins = group.pins.filter((pin) =>
                          node.inputs.includes(pin),
                        )
                        if (!pins.length) return null
                        return (
                          <div
                            key={`${node.id}-${group.label}`}
                            className="node-input-group"
                          >
                            <div className="node-input-group-title">
                              {group.label}
                            </div>
                            {pins.map(renderInputPin)}
                          </div>
                        )
                      })
                    : node.inputs.map(renderInputPin)}
                </div>
                <div className="node-outputs">
                  {node.outputs.map((output) => (
                    <div className="node-pin-row" key={output}>
                      <span className="pin-label">{output}</span>
                      <span
                        className="pin dot-output"
                        role="img"
                        aria-label={`${node.label} output ${output}`}
                        title={`Output: ${output}. Drag to an input to connect.`}
                        data-pin-key={`${node.id}:output:${output}`}
                        data-pin-type="output"
                        data-node-id={node.id}
                        data-pin-name={output}
                        onPointerDown={(event) => {
                          event.stopPropagation()
                          const container = viewportRef.current
                          if (!container) return
                          const rect = container.getBoundingClientRect()
                          const next = {
                            from: { nodeId: node.id, pin: output },
                            x: event.clientX - rect.left,
                            y: event.clientY - rect.top,
                          }
                          linkDraftRef.current = next
                          setLinkDraft(next)
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {node.type === 'number' ? (
                <div className="node-control">
                  <label className="node-control-label" htmlFor={`${node.id}-number`}>
                    Value
                  </label>
                  <input
                    id={`${node.id}-number`}
                    className="node-input"
                    type="number"
                    step="0.1"
                    value={
                      typeof node.value === 'string'
                        ? node.value
                        : node.value !== undefined
                          ? String(node.value)
                          : ''
                    }
                    placeholder="0"
                    onBlur={() => {
                      setEditorNodes((prev) =>
                        prev.map((item) => {
                          if (item.id !== node.id) return item
                          const normalized = String(parseNumber(item.value))
                          return { ...item, value: normalized }
                        }),
                      )
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      let next = event.target.value
                      if (
                        next.length > 1 &&
                        next.startsWith('0') &&
                        !next.startsWith('0.') &&
                        !next.startsWith('0,')
                      ) {
                        next = next.replace(/^0+/, '') || '0'
                      }
                      setEditorNodes((prev) =>
                        prev.map((item) =>
                          item.id === node.id ? { ...item, value: next } : item,
                        ),
                      )
                    }}
                  />
                  <label className="node-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(node.slider)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const next = event.target.checked
                        setEditorNodes((prev) =>
                          prev.map((item) =>
                            item.id === node.id ? { ...item, slider: next } : item,
                          ),
                        )
                      }}
                    />
                    Use 0–1 slider
                  </label>
                  {node.slider ? (
                    <input
                      className="node-input slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={String(parseNumber(node.value))}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const next = String(event.target.value)
                        setEditorNodes((prev) =>
                          prev.map((item) =>
                            item.id === node.id ? { ...item, value: next } : item,
                          ),
                        )
                      }}
                    />
                  ) : null}
                  <label
                    className="node-control-label"
                    htmlFor={`${node.id}-update-mode`}
                  >
                    Update
                  </label>
                  <select
                    id={`${node.id}-update-mode`}
                    className="node-input"
                    value={numberUpdateMode}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const nextMode = event.target.value as UniformUpdateMode
                      setEditorNodes((prev) =>
                        prev.map((item) =>
                          item.id === node.id
                            ? {
                                ...item,
                                updateMode: nextMode,
                                updateSource: getDefaultNumberUpdateSource(nextMode),
                              }
                            : item,
                        ),
                      )
                    }}
                  >
                    {numberUpdateModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                  {numberUpdateMode !== 'manual' ? (
                    <>
                      <label
                        className="node-control-label"
                        htmlFor={`${node.id}-update-source`}
                      >
                        Source
                      </label>
                      <select
                        id={`${node.id}-update-source`}
                        className="node-input"
                        value={numberUpdateSource}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                        const nextSource = event.target
                          .value as UniformUpdateSource
                        setEditorNodes((prev) =>
                          prev.map((item) =>
                            item.id === node.id
                              ? { ...item, updateSource: nextSource }
                                : item,
                            ),
                          )
                        }}
                      >
                        {numberUpdateSources[numberUpdateMode].map((source) => (
                          <option key={source.value} value={source.value}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                </div>
              ) : null}
              {node.type === 'color' ? (
                <div className="node-control">
                  <label className="node-control-label" htmlFor={`${node.id}-color`}>
                    Color
                  </label>
                  <input
                    id={`${node.id}-color`}
                    className="node-input"
                    type="color"
                    value={typeof node.value === 'string' ? node.value : DEFAULT_COLOR}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = event.target.value
                      setEditorNodes((prev) =>
                        prev.map((item) =>
                          item.id === node.id ? { ...item, value: next } : item,
                        ),
                      )
                    }}
                  />
                </div>
              ) : null}
              {node.type === 'texture' ? (
                <div className="node-control">
                  <div className="node-control-label">Texture</div>
                  <div className="file-row">
                    <span className="file-name">
                      {node.textureName ? node.textureName : 'No file'}
                    </span>
                    <label className="palette-button file-button">
                      Choose
                      <input
                        id={`${node.id}-texture`}
                        className="node-input file-input"
                        type="file"
                        accept="image/*,.ktx2"
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const existing = objectUrlRef.current[node.id]
                          if (existing) {
                            URL.revokeObjectURL(existing)
                            delete objectUrlRef.current[node.id]
                          }
                          const isKtx2 = file.name.toLowerCase().endsWith('.ktx2')
                          if (isKtx2) {
                            const url = URL.createObjectURL(file)
                            objectUrlRef.current[node.id] = url
                            setEditorNodes((prev) =>
                              prev.map((item) =>
                                item.id === node.id
                                  ? { ...item, value: url, textureName: file.name }
                                  : item,
                              ),
                            )
                            return
                          }
                          const reader = new FileReader()
                          reader.onload = () => {
                            const next =
                              typeof reader.result === 'string' ? reader.result : ''
                            setEditorNodes((prev) =>
                              prev.map((item) =>
                                item.id === node.id
                                  ? { ...item, value: next, textureName: file.name }
                                  : item,
                              ),
                            )
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              {node.type === 'geometryPrimitive' ? (
                <div className="node-control">
                  <label className="node-control-label" htmlFor={`${node.id}-geometry`}>
                    Shape
                  </label>
                  <select
                    id={`${node.id}-geometry`}
                    className="node-input"
                    value={typeof node.value === 'string' ? node.value : 'box'}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = event.target.value
                      setEditorNodes((prev) =>
                        prev.map((item) =>
                          item.id === node.id ? { ...item, value: next } : item,
                        ),
                      )
                    }}
                  >
                    <option value="box">Box</option>
                    <option value="sphere">Sphere</option>
                    <option value="plane">Plane</option>
                    <option value="torus">Torus</option>
                    <option value="cylinder">Cylinder</option>
                  </select>
                </div>
              ) : null}
              {node.type === 'gltf' ? (
                <div className="node-control">
                  <div className="node-control-label">GLTF</div>
                  <label
                    className="node-control-label"
                    htmlFor={`${node.id}-gltf-index`}
                  >
                    Mesh Index
                  </label>
                  <select
                    id={`${node.id}-gltf-index`}
                    className="node-input"
                    value={selectedMeshIndex}
                    disabled={!meshCount}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = event.target.value
                      setEditorNodes((prev) =>
                        prev.map((item) =>
                          item.id === node.id ? { ...item, meshIndex: next } : item,
                        ),
                      )
                    }}
                  >
                    {meshCount
                      ? Array.from({ length: meshCount }, (_, index) => {
                          const name = gltfEntry?.meshNames[index]
                          const label = name ? `${index}: ${name}` : `${index}`
                          return (
                            <option key={index} value={String(index)}>
                              {label}
                            </option>
                          )
                        })
                      : (
                        <option value="" disabled>
                          No meshes loaded
                        </option>
                      )}
                  </select>
                  <div className="file-row">
                    <span className="file-name">
                      {node.assetName ? node.assetName : 'No file'}
                    </span>
                    <label className="palette-button file-button">
                      Choose
                      <input
                        id={`${node.id}-gltf`}
                        className="node-input file-input"
                        type="file"
                        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const buffer = reader.result
                            if (!(buffer instanceof ArrayBuffer)) return
                            const blob = new Blob([buffer], { type: file.type || 'model/gltf-binary' })
                            const existing = objectUrlRef.current[node.id]
                            if (existing) {
                              URL.revokeObjectURL(existing)
                            }
                            const url = URL.createObjectURL(blob)
                            objectUrlRef.current[node.id] = url
                            setEditorNodes((prev) =>
                              prev.map((item) =>
                                item.id === node.id
                                  ? { ...item, value: url, assetName: file.name }
                                  : item,
                              ),
                            )
                          }
                          reader.readAsArrayBuffer(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              {node.type === 'gltfMaterial' ? (
                <div className="node-control">
                  <div className="node-control-label">GLTF Material</div>
                  <label
                    className="node-control-label"
                    htmlFor={`${node.id}-gltf-material-index`}
                  >
                    Material Index
                  </label>
                  <select
                    id={`${node.id}-gltf-material-index`}
                    className="node-input"
                    value={selectedMaterialIndex}
                    disabled={!materialCount}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = event.target.value
                      setEditorNodes((prev) =>
                        prev.map((item) =>
                          item.id === node.id
                            ? { ...item, materialIndex: next }
                            : item,
                        ),
                      )
                    }}
                  >
                    {materialCount
                      ? Array.from({ length: materialCount }, (_, index) => {
                          const material = gltfEntry?.materials[index] as
                            | GltfMaterial
                            | undefined
                          const label = material?.name
                            ? `${index}: ${material.name}`
                            : `${index}`
                          return (
                            <option key={index} value={String(index)}>
                              {label}
                            </option>
                          )
                        })
                      : (
                        <option value="" disabled>
                          No materials loaded
                        </option>
                      )}
                  </select>
                  <div className="file-row">
                    <span className="file-name">
                      {node.assetName ? node.assetName : 'No file'}
                    </span>
                    <label className="palette-button file-button">
                      Choose
                      <input
                        id={`${node.id}-gltf-material`}
                        className="node-input file-input"
                        type="file"
                        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const buffer = reader.result
                            if (!(buffer instanceof ArrayBuffer)) return
                            const blob = new Blob([buffer], {
                              type: file.type || 'model/gltf-binary',
                            })
                            const existing = objectUrlRef.current[node.id]
                            if (existing) {
                              URL.revokeObjectURL(existing)
                            }
                            const url = URL.createObjectURL(blob)
                            objectUrlRef.current[node.id] = url
                            setEditorNodes((prev) =>
                              prev.map((item) =>
                                item.id === node.id
                                  ? {
                                      ...item,
                                      value: url,
                                      assetName: file.name,
                                    }
                                  : item,
                              ),
                            )
                          }
                          reader.readAsArrayBuffer(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              {node.type === 'gltfTexture' ? (
                <div className="node-control">
                  <div className="node-control-label">GLTF Texture</div>
                  <label
                    className="node-control-label"
                    htmlFor={`${node.id}-gltf-texture-index`}
                  >
                    Texture Index
                  </label>
                  <select
                    id={`${node.id}-gltf-texture-index`}
                    className="node-input"
                    value={selectedTextureIndex}
                    disabled={!textureCount}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = event.target.value
                      setEditorNodes((prev) =>
                        prev.map((item) =>
                          item.id === node.id
                            ? { ...item, textureIndex: next }
                            : item,
                        ),
                      )
                    }}
                  >
                    {textureCount
                      ? Array.from({ length: textureCount }, (_, index) => {
                          const tex = gltfEntry?.textures[index]
                          const label = tex?.name ? `${index}: ${tex.name}` : `${index}`
                          return (
                            <option key={index} value={String(index)}>
                              {label}
                            </option>
                          )
                        })
                      : (
                        <option value="" disabled>
                          No textures loaded
                        </option>
                      )}
                  </select>
                  <div className="file-row">
                    <span className="file-name">
                      {node.assetName ? node.assetName : 'No file'}
                    </span>
                    <label className="palette-button file-button">
                      Choose
                      <input
                        id={`${node.id}-gltf-texture`}
                        className="node-input file-input"
                        type="file"
                        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            const buffer = reader.result
                            if (!(buffer instanceof ArrayBuffer)) return
                            const blob = new Blob([buffer], {
                              type: file.type || 'model/gltf-binary',
                            })
                            const existing = objectUrlRef.current[node.id]
                            if (existing) {
                              URL.revokeObjectURL(existing)
                            }
                            const url = URL.createObjectURL(blob)
                            objectUrlRef.current[node.id] = url
                            setEditorNodes((prev) =>
                              prev.map((item) =>
                                item.id === node.id
                                  ? { ...item, value: url, assetName: file.name }
                                  : item,
                              ),
                            )
                          }
                          reader.readAsArrayBuffer(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              <div className="node-id">{node.id}</div>
                    </div>
                  )
                })}
              </div>
            </>

          </div>
        </div>
        <div className="graph-navigation" role="group" aria-label="Graph navigation">
          <button type="button" onClick={() => navigateGraph()}>Fit graph</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomGraph(1 / 1.2)}>−</button>
          <button type="button" onClick={() => zoomGraph(1 / viewRef.current.zoom)} title="Reset zoom to 100%">{Math.round(displayView.zoom * 100)}%</button>
          <button type="button" aria-label="Zoom in" onClick={() => zoomGraph(1.2)}>+</button>
          <span>{editorNodes.length} nodes · {editorConnections.length} links</span>
          <details className="graph-help"><summary>Navigation help</summary><p>Drag background or scroll to pan. Ctrl + scroll to zoom. Drag output pins to inputs; click an input to disconnect. Shift-click nodes for multiple selection. Delete removes selected nodes. Ctrl/Cmd + Z undoes.</p></details>
        </div>
        <section className="output-dock" aria-label="Code and export output">
          {showCode || compactPanel === 'output' ? (
            <div
              className="code-overlay"
              onPointerDown={blockCanvasPointer}
              onPointerMove={blockCanvasPointer}
              onPointerUp={blockCanvasPointer}
            >
              <div className="code-overlay-header">
                <div className="code-overlay-title-group">
                  <div className="code-overlay-title">Output</div>
                  <label className="code-overlay-select">
                    <span>Output</span>
                    <select
                      className="palette-select"
                      value={tslOutputKind}
                      onChange={(event) => {
                        const value = event.target.value
                        if (
                          value === 'material' ||
                          value === 'app' ||
                          value === 'tsl' ||
                          value === 'gltf'
                        ) {
                          setTslOutputKind(value)
                        }
                      }}
                    >
                      <option value="tsl">TSL</option>
                      <option value="material">Material</option>
                      <option value="app">App</option>
                      <option value="gltf">glTF</option>
                    </select>
                  </label>
                </div>
                <div className="code-overlay-actions">
                  {tslPanelMode === 'code' ? (
                    <div className="tsl-export-controls">
                      {tslOutputKind === 'gltf' ? (
                        <button
                          className="palette-button"
                          type="button"
                          onClick={downloadGltfExport}
                        >
                          Download glTF
                        </button>
                      ) : (
                        <>
                          <label className="export-format">
                            <span>Format</span>
                            <select
                              className="palette-select"
                              value={exportFormat}
                              onChange={(event) =>
                                setExportFormat(
                                  event.target.value === 'ts' ? 'ts' : 'js',
                                )
                              }
                            >
                              <option value="js">JS</option>
                              <option value="ts">TS</option>
                            </select>
                          </label>
                          <button
                            className="palette-button"
                            type="button"
                            onClick={copyTSLExport}
                          >
                            Copy output
                          </button>
                          <button
                            className="palette-button"
                            type="button"
                            onClick={downloadTSLExport}
                          >
                            Download output
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                  <button type="button" onClick={() => { setShowCode(false); setCompactPanel('graph') }}>Close output</button>
                  <div className="code-overlay-tabs">
                    <button
                      className={
                        tslPanelMode === 'code'
                          ? 'code-overlay-tab active'
                          : 'code-overlay-tab'
                      }
                      type="button"
                      aria-pressed={tslPanelMode === 'code'}
                      onClick={() => setTslPanelMode('code')}
                    >
                      Code
                    </button>
                    <button
                      className={
                        tslPanelMode === 'viewer'
                          ? 'code-overlay-tab active'
                          : 'code-overlay-tab'
                      }
                      type="button"
                      aria-pressed={tslPanelMode === 'viewer'}
                      onClick={() => setTslPanelMode('viewer')}
                    >
                      Viewer
                    </button>
                  </div>
                </div>
              </div>
              {tslPanelMode === 'viewer' ? (
                <div className="tsl-viewer">
                  <iframe
                    ref={viewerRef}
                    className="viewer-frame"
                    src={`${import.meta.env.BASE_URL}viewer.html`}
                    title="TSL Viewer"
                  />
                </div>
              ) : (
                <div className="tsl-export">
                  <pre className="code-preview" onWheel={allowOverlayScroll}>
                    {tslOutput}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </main>
      <aside className="preview-dock" aria-label="Preview and properties">
        <section className="preview-panel">
          <div className="panel-heading"><h2>Live preview</h2><span>WebGPU</span></div>
          <div className="preview-surface" ref={previewRef} />
          <div className={`status${/failed|not available/i.test(status) ? ' status-error' : ''}`} role="status"><span className="dot" />{status}</div>
        </section>
        <NodeInspector node={inspectedNode} count={editorNodes.filter((node) => selectedNodeIds.includes(node.id)).length}
          connections={editorConnections.filter((link) => link.from.nodeId === inspectedNode?.id || link.to.nodeId === inspectedNode?.id).length}
          warnings={Object.entries(typeWarnings).filter(([key]) => key.startsWith(`${inspectedNode?.id}:`)).map(([pin, warning]) => `${pin.slice((inspectedNode?.id.length ?? 0) + 1)}: ${warning}`)}
          onChange={(patch) => setEditorNodes((prev) => prev.map((node) => node.id === inspectedNode?.id ? { ...node, ...patch } : node))}
          onFocus={() => { setCompactPanel('graph'); requestAnimationFrame(() => navigateGraph(selectedNodeIds)) }} />
      </aside>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}

export default App
