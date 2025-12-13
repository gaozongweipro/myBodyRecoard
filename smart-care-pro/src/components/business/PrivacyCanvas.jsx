import React, { useRef, useEffect, useState } from 'react';
import { Undo, Check, X, Eraser, Hand, PenLine, ZoomIn, ZoomOut, Move, Paintbrush } from 'lucide-react';

export default function PrivacyCanvas({ imageFile, onConfirm, onCancel }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [history, setHistory] = useState([]); // Array of ImageData
    const [brushSize, setBrushSize] = useState(15); // Default smaller
    const [ctx, setCtx] = useState(null);
    
    // View State
    const [isBrushActive, setIsBrushActive] = useState(false); // Brush selected = Draw Mode
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    
    // Interaction Refs
    const panStart = useRef(null); // { x, y, initialX, initialY }
    const pinchStart = useRef(null); // { dist, initialScale }

    // Initialize Canvas with Image
    useEffect(() => {
        if (!imageFile || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        setCtx(context);

        const img = new Image();
        img.src = URL.createObjectURL(imageFile);
        img.onload = () => {
            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;
            
            // Fit logic: Contain
            const scale = Math.min(containerWidth / img.width, containerHeight / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            canvas.width = scaledWidth;
            canvas.height = scaledHeight;

            // Draw initial image
            context.drawImage(img, 0, 0, scaledWidth, scaledHeight);
            
            // Save initial state
            setHistory([context.getImageData(0, 0, canvas.width, canvas.height)]);
        };
    }, [imageFile]);

    // --- Helper: Get Position relative to Canvas Internal Coords ---
    const getPos = (clientX, clientY) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    // --- Interaction Handlers ---

    const handleStart = (e) => {
        e.preventDefault(); // Prevent default browser zoom/scroll
        
        const touches = e.touches || [];
        
        // --- MULTI TOUCH (PINCH / ZOOM) ---
        if (touches.length >= 2) {
            // Auto exit brush mode
            if (isBrushActive) setIsBrushActive(false);
            
            const dist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
            
            pinchStart.current = {
                dist,
                initialScale: transform.scale
            };
            return;
        }

        // --- SINGLE TOUCH ---
        const clientX = touches.length > 0 ? touches[0].clientX : e.clientX;
        const clientY = touches.length > 0 ? touches[0].clientY : e.clientY;

        if (isBrushActive) {
            // DRAW MODE
            setIsDrawing(true);
            const { x, y } = getPos(clientX, clientY);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = brushSize; 
        } else {
            // PAN MODE
            panStart.current = {
                x: clientX,
                y: clientY,
                initialX: transform.x,
                initialY: transform.y
            };
        }
    };

    const handleMove = (e) => {
        e.preventDefault();
        const touches = e.touches || [];

        // --- PINCH MOVE ---
        if (touches.length >= 2 && pinchStart.current) {
            const dist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
            
            const scaleFactor = dist / pinchStart.current.dist;
            const newScale = Math.min(Math.max(0.5, pinchStart.current.initialScale * scaleFactor), 4.0);
            
            setTransform(prev => ({ ...prev, scale: newScale }));
            return;
        }

        // --- SINGLE TOUCH MOVE ---
        const clientX = touches.length > 0 ? touches[0].clientX : e.clientX;
        const clientY = touches.length > 0 ? touches[0].clientY : e.clientY;

        if (isBrushActive) {
            if (!isDrawing) return;
            const { x, y } = getPos(clientX, clientY);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            if (!panStart.current) return;
            const dx = clientX - panStart.current.x;
            const dy = clientY - panStart.current.y;
            setTransform(prev => ({
                ...prev,
                x: panStart.current.initialX + dx,
                y: panStart.current.initialY + dy
            }));
        }
    };

    const handleEnd = (e) => {
        // e.preventDefault(); // Optional, sometimes needed
        
        if (isBrushActive && isDrawing) {
            setIsDrawing(false);
            ctx.closePath();
            // Save history
            const newState = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
            setHistory(prev => [...prev, newState]);
        }
        
        // Reset interaction refs
        if (e.touches && e.touches.length === 0) {
            panStart.current = null;
            pinchStart.current = null;
        }
    };

    const handleUndo = () => {
        if (history.length <= 1) return; 
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        const lastState = newHistory[newHistory.length - 1];
        ctx.putImageData(lastState, 0, 0);
    };

    const handleConfirm = () => {
        if (!canvasRef.current) return;
        canvasRef.current.toBlob((blob) => {
            onConfirm(blob);
        }, 'image/jpeg', 0.85);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col h-[100dvh] animate-in fade-in zoom-in-95 duration-300">
            {/* Top Toolbar */}
            <div className="absolute top-0 left-0 right-0 p-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] flex items-center justify-between pointer-events-none z-50">
                <button 
                    onClick={onCancel} 
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white pointer-events-auto active:scale-90 transition-all hover:bg-black/60"
                >
                    <X size={20} />
                </button>
                
                <h2 className="text-white font-bold text-sm bg-black/40 backdrop-blur px-4 py-1.5 rounded-full border border-white/5">
                    隐私涂抹保护
                </h2>

                <button 
                    onClick={handleConfirm} 
                    className="px-5 py-2.5 bg-white text-black text-sm font-bold rounded-full pointer-events-auto shadow-lg active:scale-95 transition-all hover:bg-slate-200"
                >
                    完成
                </button>
            </div>

            {/* Canvas Container */}
            <div 
                ref={containerRef} 
                className="flex-1 overflow-hidden bg-gray-950 flex items-center justify-center relative touch-none"
            >
                <div 
                    style={{ 
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        transformOrigin: 'center center',
                        willChange: 'transform' 
                    }}
                >
                    <canvas 
                        ref={canvasRef}
                        onMouseDown={handleStart}
                        onMouseMove={handleMove}
                        onMouseUp={handleEnd}
                        onMouseLeave={handleEnd}
                        onTouchStart={handleStart}
                        onTouchMove={handleMove}
                        onTouchEnd={handleEnd}
                        className="shadow-2xl bg-white cursor-crosshair box-border block"
                        style={{ cursor: isBrushActive ? 'crosshair' : 'grab' }}
                    />
                </div>
            </div>

            {/* Bottom Toolbar */}
            <div className="absolute bottom-8 left-6 right-6 flex items-end gap-3 pointer-events-none z-50 justify-center">
                
                {/* Main Controls Container */}
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-3 flex items-center gap-4 shadow-2xl pointer-events-auto">
                    
                    {/* Brush Toggle */}
                    <button 
                        onClick={() => setIsBrushActive(!isBrushActive)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isBrushActive 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-110' 
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                    >
                        <Paintbrush size={20} />
                    </button>

                    {/* Size Slider (Visible when brush active) */}
                    <div className={`transition-all duration-300 flex items-center gap-2 overflow-hidden ${isBrushActive ? 'w-32 opacity-100' : 'w-0 opacity-0'}`}>
                         <div className="h-6 w-[1px] bg-white/10 flex-shrink-0" />
                         <div className="flex-1 px-1">
                             <input 
                                type="range" 
                                min="5" 
                                max="50" 
                                step="1"
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                             />
                         </div>
                         <div 
                            className="w-4 h-4 rounded-full bg-white flex-shrink-0 border block" 
                            style={{ transform: `scale(${brushSize/40 + 0.5})` }} 
                         />
                    </div>

                    <div className="h-6 w-[1px] bg-white/10" />

                    {/* Undo */}
                    <button 
                        onClick={handleUndo}
                        disabled={history.length <= 1}
                        className={`w-10 h-10 flex items-center justify-center rounded-full text-white transition-all ${
                            history.length <= 1 ? 'opacity-30' : 'hover:bg-white/10 active:scale-95'
                        }`}
                    >
                        <Undo size={20} />
                    </button>

                </div>

            </div>
            
            {/* Minimal Zoom Hint/Reset */}
             <div className="absolute bottom-32 right-4 pointer-events-auto flex flex-col gap-2">
                 {transform.scale !== 1 && (
                     <button 
                        onClick={() => setTransform({x:0, y:0, scale:1})}
                        className="bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded-full border border-white/10"
                     >
                        重置视图
                     </button>
                 )}
             </div>
        </div>
    );
}
