'use client';

export default function Toolbar({
    color,
    setColor,
    size,
    setSize,
    tool,
    setTool,
    onUndo,
    onRedo,
    onClear,
    onSave
}) {
    const colors = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#eab308'];

    return (
        <div className="toolbar">
            {/* Paint Palette */}
            <div className="palette-container">
                {colors.map((c) => (
                    <div
                        key={c}
                        className={`paint-blob ${color === c ? 'active' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                    />
                ))}
                <div className="custom-color-wrapper">
                    <input
                        type="color"
                        className="custom-color-input"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        title="Custom Color"
                    />
                </div>
            </div>

            <div className="separator"></div>

            {/* Tools */}
            <div className="tool-group tools">
                <button
                    className={`tool-btn ${tool === 'pencil' ? 'active' : ''}`}
                    onClick={() => setTool('pencil')}
                    title="Pencil"
                >
                    ✏️
                </button>
                <button
                    className={`tool-btn ${tool === 'marker' ? 'active' : ''}`}
                    onClick={() => setTool('marker')}
                    title="Marker"
                >
                    🖊️
                </button>
                <button
                    className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                    onClick={() => setTool('eraser')}
                    title="Eraser"
                >
                    🧼
                </button>
            </div>

            <div className="separator"></div>

            <div className="tool-group">
                <label htmlFor="brush-size" className="sr-only">Size</label>
                <input
                    type="range"
                    id="brush-size"
                    min="1"
                    max="50"
                    value={size}
                    onChange={(e) => setSize(parseInt(e.target.value))}
                />
            </div>

            <div className="separator"></div>

            <div className="tool-group actions">
                <button onClick={onUndo} className="btn" title="Undo">↩️</button>
                <button onClick={onRedo} className="btn" title="Redo">↪️</button>
                <button onClick={onClear} className="btn" title="Clear">🗑️</button>
                <button onClick={onSave} className="btn" title="Save">💾</button>
            </div>
        </div>
    );
}
