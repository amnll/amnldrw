'use client';

import { useState } from 'react';
import Canvas from '@/components/Canvas';
import Toolbar from '@/components/Toolbar';

export default function Home() {
    const [color, setColor] = useState('#000000');
    const [size, setSize] = useState(5);
    const [tool, setTool] = useState('pencil');
    const [onlineUsers, setOnlineUsers] = useState(1);

    // Triggers for actions
    const [undoTrigger, setUndoTrigger] = useState(0);
    const [redoTrigger, setRedoTrigger] = useState(0);
    const [clearTrigger, setClearTrigger] = useState(0);
    const [saveTrigger, setSaveTrigger] = useState(0);

    return (
        <main className="relative w-full h-full overflow-hidden">
            <div id="user-count" className="sticky-note" title={typeof onlineUsers === 'string' ? "Backend disconnected" : "Online Users"}>
                Users: <span id="count-value">{onlineUsers}</span>
            </div>

            <Canvas
                color={color}
                size={size}
                tool={tool}
                undoTrigger={undoTrigger}
                redoTrigger={redoTrigger}
                clearTrigger={clearTrigger}
                saveTrigger={saveTrigger}
                setOnlineUsers={setOnlineUsers}
            />

            <Toolbar
                color={color}
                setColor={setColor}
                size={size}
                setSize={setSize}
                tool={tool}
                setTool={setTool}
                onUndo={() => setUndoTrigger(prev => prev + 1)}
                onRedo={() => setRedoTrigger(prev => prev + 1)}
                onClear={() => setClearTrigger(prev => prev + 1)}
                onSave={() => setSaveTrigger(prev => prev + 1)}
            />
        </main>
    );
}
