type InspectorNode = {
  id: string
  type: string
  label: string
  inputs: string[]
  outputs: string[]
  value?: string | number
  assetName?: string
  textureName?: string
}

export function NodeInspector({ node, count, connections, warnings, onChange, onFocus }: {
  node?: InspectorNode
  count: number
  connections: number
  warnings: string[]
  onChange: (patch: { label?: string; value?: string }) => void
  onFocus: () => void
}) {
  return (
    <section className="inspector panel" aria-label="Node inspector">
      <div className="panel-heading"><h2>Inspector</h2><span>{count ? `${count} selected` : 'Selection'}</span></div>
      {!node ? (
        <p className="empty-state">Select a node to inspect its properties. Shift-click to select several nodes.</p>
      ) : (
        <>
          <div className="inspector-kind">{node.type}</div>
          {count > 1 ? <p className="empty-state">Showing {node.label}. Group actions apply to all selected nodes.</p> : null}
          <label className="inspector-field">Label
            <input value={node.label} onChange={(event) => onChange({ label: event.target.value })} />
          </label>
          {node.type === 'number' || node.type === 'color' ? (
            <label className="inspector-field">Value
              <input type={node.type === 'color' ? 'color' : 'number'} step="0.1"
                value={node.value ?? (node.type === 'color' ? '#4fb3c8' : '0')}
                onChange={(event) => onChange({ value: event.target.value })} />
            </label>
          ) : null}
          <dl className="inspector-details">
            <dt>Node ID</dt><dd>{node.id}</dd>
            <dt>Inputs</dt><dd>{node.inputs.join(', ') || 'None'}</dd>
            <dt>Outputs</dt><dd>{node.outputs.join(', ') || 'None'}</dd>
            <dt>Connections</dt><dd>{connections}</dd>
            {node.assetName || node.textureName ? <><dt>Asset</dt><dd>{node.assetName || node.textureName}</dd></> : null}
          </dl>
          {warnings.length ? <div className="inspector-warning" role="status">{warnings.join('. ')}</div> : null}
          <button type="button" onClick={onFocus}>Focus selected nodes</button>
          <p className="empty-state">Edit specialized controls, textures and functions directly on the node card.</p>
        </>
      )}
    </section>
  )
}
