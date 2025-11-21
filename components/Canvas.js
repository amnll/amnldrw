'use client';

import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export default function Canvas({
    color,
    size,
    tool,
    onUndo,
    onRedo,
    onClear,
    onSave,
    undoTrigger,
    redoTrigger,
    clearTrigger,
    saveTrigger,
    setOnlineUsers
}) {
    const canvasRef = useRef(null);
    const [socket, setSocket] = useState(null);

    // Use refs for mutable state to avoid re-renders during drawing
    const isDrawing = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    // Persistent User ID
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        let storedId = localStorage.getItem('drawAppUserId');
        if (!storedId) {
            storedId = Math.random().toString(36).substr(2, 9);
            localStorage.setItem('drawAppUserId', storedId);
        }
        setUserId(storedId);
    }, []);

    // History for Undo/Redo (Local)
    const [history, setHistory] = useState([]);
    const [historyStep, setHistoryStep] = useState(-1);
    const MAX_HISTORY = 50;

    // Initialize Socket
    useEffect(() => {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        const newSocket = io(backendUrl, {
            reconnectionAttempts: 3,
            timeout: 2000,
            autoConnect: true
        });

        newSocket.on('connect', () => {
            console.log('Connected to backend');
        });

        newSocket.on('connect_error', () => {
            console.warn('Backend not reachable. Offline mode.');
            setOnlineUsers('Offline');
        });

        newSocket.on('users_count', (count) => {
            setOnlineUsers(count);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [setOnlineUsers]);

    // Socket Event Listeners
    useEffect(() => {
        if (!socket) return;

        const handleRemoteDraw = (data) => {
            const ctx = canvasRef.current.getContext('2d');
            drawLine(ctx, data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.tool, false);
        };

        const handleRemoteClear = () => {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            saveHistory();
        };

        const handleHistory = (historyData) => {
            const ctx = canvasRef.current.getContext('2d');
            // Clear first to ensure clean slate for history redraw
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            historyData.forEach(data => {
                drawLine(ctx, data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.tool, false);
            });
            saveHistory();
        };

        socket.on('draw', handleRemoteDraw);
        socket.on('clear', handleRemoteClear); // Keep for legacy/admin clear if needed
        socket.on('history', handleHistory);
        socket.on('history_update', handleHistory); // New event for partial updates

        return () => {
            socket.off('draw', handleRemoteDraw);
            socket.off('clear', handleRemoteClear);
            socket.off('history', handleHistory);
            socket.off('history_update', handleHistory);
        };
    }, [socket]);

    // Canvas Setup & Resize
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const resizeCanvas = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            if (canvas.width > 0 && canvas.height > 0) {
                tempCtx.drawImage(canvas, 0, 0);
            }

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            if (tempCanvas.width > 0 && tempCanvas.height > 0) {
                ctx.drawImage(tempCanvas, 0, 0);
            }
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Initial History Save
        saveHistory();

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    // Drawing Logic
    const drawLine = (ctx, x0, y0, x1, y1, color, size, tool, emit = true) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            if (tool === 'marker') {
                const hex = color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
            } else {
                ctx.strokeStyle = color;
            }
        }

        ctx.stroke();

        // Reset to default
        ctx.globalCompositeOperation = 'source-over';

        if (emit && socket && socket.connected) {
            socket.emit('draw', { x0, y0, x1, y1, color, size, tool, userId });
        }
    };

    const startDrawing = (e) => {
        isDrawing.current = true;
        const pos = getCoordinates(e);
        lastPos.current = pos;
    };

    const draw = (e) => {
        if (!isDrawing.current) return;
        const currentPos = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');

        drawLine(ctx, lastPos.current.x, lastPos.current.y, currentPos.x, currentPos.y, color, size, tool, true);
        lastPos.current = currentPos;
    };

    const stopDrawing = () => {
        if (isDrawing.current) {
            isDrawing.current = false;
            saveHistory();
        }
    };

    const getCoordinates = (e) => {
        if (e.touches && e.touches[0]) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    };

    // Undo/Redo/Clear/Save Logic
    const saveHistory = () => {
        const canvas = canvasRef.current;
        const dataUrl = canvas.toDataURL();

        setHistory(prev => {
            const newHistory = prev.slice(0, historyStep + 1);
            newHistory.push(dataUrl);
            if (newHistory.length > MAX_HISTORY) newHistory.shift();
            return newHistory;
        });

        setHistoryStep(prev => Math.min(prev + 1, MAX_HISTORY - 1));
    };

    // Effect triggers for toolbar actions
    useEffect(() => {
        if (undoTrigger === 0) return; // Skip initial render
        if (historyStep > 0) {
            const newStep = historyStep - 1;
            setHistoryStep(newStep);
            const img = new Image();
            img.src = history[newStep];
            img.onload = () => {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.drawImage(img, 0, 0);
            };
        } else if (historyStep === 0) {
            // Clear if at start
            setHistoryStep(-1);
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }, [undoTrigger]);

    useEffect(() => {
        if (redoTrigger === 0) return;
        if (historyStep < history.length - 1) {
            const newStep = historyStep + 1;
            setHistoryStep(newStep);
            const img = new Image();
            img.src = history[newStep];
            img.onload = () => {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.drawImage(img, 0, 0);
            };
        }
    }, [redoTrigger]);

    useEffect(() => {
        if (clearTrigger === 0) return;

        // Optimistic local clear (optional, but waiting for server is safer for sync)
        // const ctx = canvasRef.current.getContext('2d');
        // ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        // saveHistory();

        if (socket && socket.connected) {
            socket.emit('clear_user_history', userId);
        } else {
            // Offline fallback: just clear everything locally
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            saveHistory();
        }
    }, [clearTrigger]);

    useEffect(() => {
        if (saveTrigger === 0) return;
        const link = document.createElement('a');
        link.download = `sketch-${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
    }, [saveTrigger]);

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="block w-full h-full touch-none cursor-crosshair"
        />
    );
}
