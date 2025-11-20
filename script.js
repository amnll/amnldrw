// Initialize Socket.io with error handling
let socket;
try {
    if (typeof io !== 'undefined') {
        socket = io({
            reconnectionAttempts: 3,
            timeout: 2000
        });
    }
} catch (e) {
    console.warn('Socket.io not initialized. Running in offline mode.');
}

const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const brushSize = document.getElementById('brush-size');
const clearBtn = document.getElementById('clear-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const saveBtn = document.getElementById('save-btn');
const countValue = document.getElementById('count-value');
const customColorInput = document.getElementById('custom-color');
const userCountDiv = document.getElementById('user-count');

// Update User Count UI for offline mode
if (!socket) {
    countValue.textContent = 'Offline';
    userCountDiv.title = "Backend not connected. Drawing is local only.";
} else {
    socket.on('connect_error', () => {
        countValue.textContent = 'Offline';
    });
}

// Tool buttons
const toolBtns = document.querySelectorAll('.tool-btn');
const paintBlobs = document.querySelectorAll('.paint-blob');

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// State management
let currentSettings = {
    color: '#000000',
    size: 5,
    tool: 'pencil' // pencil, marker, eraser
};

// History for Undo/Redo
let history = [];
let historyStep = -1;
const MAX_HISTORY = 50;

function resizeCanvas() {
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

    updateContextSettings();
}

function updateContextSettings() {
    ctx.lineWidth = currentSettings.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentSettings.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentSettings.color;

        if (currentSettings.tool === 'marker') {
            // Convert hex to rgba for transparency
            const hex = currentSettings.color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
        }
    }
}

function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = getCoordinates(e);
}

function draw(e) {
    if (!isDrawing) return;

    const [x, y] = getCoordinates(e);

    // Draw locally
    drawLine(lastX, lastY, x, y, currentSettings.color, currentSettings.size, currentSettings.tool);

    // Emit to server if connected
    if (socket && socket.connected) {
        socket.emit('draw', {
            x0: lastX,
            y0: lastY,
            x1: x,
            y1: y,
            color: currentSettings.color,
            size: currentSettings.size,
            tool: currentSettings.tool
        });
    }

    [lastX, lastY] = [x, y];
}

function drawLine(x0, y0, x1, y1, color, size, tool) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);

    // Apply settings for this specific stroke
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

    // Reset context to current user settings after drawing remote line
    updateContextSettings();
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        saveHistory();
    }
}

function getCoordinates(e) {
    if (e.type.includes('touch')) {
        return [
            e.touches[0].clientX,
            e.touches[0].clientY
        ];
    }
    return [e.offsetX, e.offsetY];
}

// --- Socket Events ---

if (socket) {
    socket.on('draw', (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.tool);
    });

    socket.on('history', (historyData) => {
        historyData.forEach(data => {
            drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.tool);
        });
    });

    socket.on('clear', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveHistory();
    });

    socket.on('users_count', (count) => {
        countValue.textContent = count;
    });
}

// --- UI Logic ---

// Color Palette
paintBlobs.forEach(blob => {
    blob.addEventListener('click', () => {
        // Remove active class from all
        paintBlobs.forEach(b => b.classList.remove('active'));
        customColorInput.parentElement.classList.remove('active'); // if we wrapped it

        // Add active to clicked
        blob.classList.add('active');
        currentSettings.color = blob.dataset.color;
        updateContextSettings();
    });
});

customColorInput.addEventListener('input', (e) => {
    paintBlobs.forEach(b => b.classList.remove('active'));
    currentSettings.color = e.target.value;
    updateContextSettings();
});

// Tools
toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (btn.id === 'tool-pencil') currentSettings.tool = 'pencil';
        if (btn.id === 'tool-marker') currentSettings.tool = 'marker';
        if (btn.id === 'tool-eraser') currentSettings.tool = 'eraser';

        updateContextSettings();
    });
});

// Other Actions
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveHistory();
    if (socket && socket.connected) {
        socket.emit('clear');
    }
});

// Undo/Redo (Local only)
function saveHistory() {
    historyStep++;
    if (historyStep < history.length) {
        history.length = historyStep;
    }
    history.push(canvas.toDataURL());
    if (history.length > MAX_HISTORY) {
        history.shift();
        historyStep--;
    }
}

undoBtn.addEventListener('click', () => {
    if (historyStep > 0) {
        historyStep--;
        const canvasPic = new Image();
        canvasPic.src = history[historyStep];
        canvasPic.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(canvasPic, 0, 0);
        }
    } else if (historyStep === 0) {
        historyStep = -1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});

redoBtn.addEventListener('click', () => {
    if (historyStep < history.length - 1) {
        historyStep++;
        const canvasPic = new Image();
        canvasPic.src = history[historyStep];
        canvasPic.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(canvasPic, 0, 0);
        }
    }
});

saveBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `sketch-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
});

brushSize.addEventListener('input', (e) => {
    currentSettings.size = e.target.value;
    updateContextSettings();
});

// Event Listeners
window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
canvas.addEventListener('touchend', stopDrawing);

// Init
resizeCanvas();
updateContextSettings();
// Set initial active state
document.querySelector('.paint-blob[data-color="#000000"]').classList.add('active');
