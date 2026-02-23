'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ticket, Paintbrush, Eraser, Upload, Download, Trash2, Square, Move, ZoomIn, ZoomOut, Undo, Redo, Palette, AlertTriangle, Sparkles, X, ChevronUp, ChevronDown, Layers } from 'lucide-react';
import Link from 'next/link';

interface CanvasSize {
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
}

const CANVAS_SIZES: CanvasSize[] = [
  // 4K Sizes
  { name: '4K Square (1:1)', width: 3840, height: 3840, aspectRatio: '1:1' },
  { name: '4K Portrait (4:5)', width: 3072, height: 3840, aspectRatio: '4:5' },
  { name: '4K Story (9:16)', width: 2160, height: 3840, aspectRatio: '9:16' },
  { name: '4K Landscape (16:9)', width: 3840, height: 2160, aspectRatio: '16:9' },
];

type Tool = 'brush' | 'eraser' | 'pan' | 'select';

interface LayerImage {
  id: string;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
}

interface Layer {
  id: string;
  name: string;
  images: LayerImage[];
  selected: boolean;
  isCanvasLayer: boolean; // Layer 1 is always the canvas/drawing layer
}

interface AdminState {
  isMaintenanceMode: boolean;
}

export default function AICanvas() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Admin auth guard
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticketBalance, setTicketBalance] = useState<number>(0);
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false);
  const [adminState, setAdminState] = useState<AdminState>({
    isMaintenanceMode: false,
  });

  // Canvas state
  const [selectedSize, setSelectedSize] = useState<CanvasSize>(CANVAS_SIZES[0]);
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // History for undo/redo
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isHistoryInitialized, setIsHistoryInitialized] = useState(false);

  // Layers system - Layer 1 is always present (canvas layer)
  const [layers, setLayers] = useState<Layer[]>([
    {
      id: 'layer-1',
      name: 'Layer 1',
      images: [],
      selected: true,
      isCanvasLayer: true
    }
  ]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDraggingLayer, setIsDraggingLayer] = useState(false);
  const [isResizingLayer, setIsResizingLayer] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, layerX: 0, layerY: 0 });
  const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const [showLayersPanelInSidebar, setShowLayersPanelInSidebar] = useState(true);
  const hasInitialized = useRef(false);

  // AI Generation
  const [aiPrompt, setAiPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAIModel, setSelectedAIModel] = useState<'nano-banana-pro' | 'seedream-4.5'>('nano-banana-pro');
  const [canvasInitialized, setCanvasInitialized] = useState(false);

  // Admin auth check — runs once on mount
  useEffect(() => {
    const authStatus = localStorage.getItem('multiverse-admin-auth');
    const savedPassword = sessionStorage.getItem('admin-password');
    if (authStatus === 'true' && savedPassword) {
      setIsAdminAuthenticated(true);
    }
    setIsAdminLoading(false);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      if (response.ok) {
        sessionStorage.setItem('admin-password', adminPassword);
        localStorage.setItem('multiverse-admin-auth', 'true');
        setIsAdminAuthenticated(true);
      } else {
        alert('Invalid admin password');
      }
    } catch {
      alert('Authentication failed');
    }
  };

  // Keyboard shortcuts and scroll zoom
  useEffect(() => {
    let isSpacePressed = false;
    let tempPanMode = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar for temporary pan mode
      if (e.code === 'Space' && !isSpacePressed && currentTool !== 'select') {
        e.preventDefault();
        isSpacePressed = true;
        if (currentTool !== 'pan') {
          tempPanMode = true;
          setCurrentTool('pan');
        }
      }

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
          (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        redo();
      }
      // Reset view with 'H' key (home)
      if (e.key === 'h' || e.key === 'H') {
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isSpacePressed) {
        isSpacePressed = false;
        if (tempPanMode) {
          tempPanMode = false;
          setCurrentTool('brush');
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Only zoom if canvas area is being scrolled
      if (!canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const isOverCanvas =
        e.clientX >= canvasRect.left &&
        e.clientX <= canvasRect.right &&
        e.clientY >= canvasRect.top &&
        e.clientY <= canvasRect.bottom;

      if (!isOverCanvas) return;

      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.25, Math.min(5, zoom + delta));
      setZoom(newZoom);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [historyStep, history, zoom, currentTool]);

  // Touch/pinch zoom for iPad and layer resize
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    let initialDistance = 0;
    let initialZoom = 1;
    let initialLayerSize = { width: 0, height: 0 };
    let isPinchingLayer = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        // Check if an image is selected and touches are on it
        if (selectedImageId && currentTool === 'select') {
          let selectedImage: LayerImage | null = null;
          for (const layer of layers) {
            const img = layer.images.find(i => i.id === selectedImageId);
            if (img) {
              selectedImage = img;
              break;
            }
          }

          if (selectedImage) {
            initialLayerSize = { width: selectedImage.width, height: selectedImage.height };
            isPinchingLayer = true;
            console.log('🖼️ Pinch to resize image');
          }
        }

        if (!isPinchingLayer) {
          initialZoom = zoom;
          isPinchingLayer = false;
          console.log('🔍 Pinch to zoom canvas');
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation(); // Stop event from bubbling

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        const scale = currentDistance / initialDistance;

        if (isPinchingLayer && selectedImageId) {
          // Resize the selected image
          setLayers(prev =>
            prev.map(layer => ({
              ...layer,
              images: layer.images.map(img => {
                if (img.id === selectedImageId) {
                  const newWidth = Math.max(50, initialLayerSize.width * scale);
                  const newHeight = Math.max(50, initialLayerSize.height * scale);
                  return { ...img, width: newWidth, height: newHeight };
                }
                return img;
              })
            }))
          );
        } else {
          // Zoom the canvas - clamp scale changes to prevent extreme jumps
          const clampedScale = Math.max(0.5, Math.min(2, scale)); // Limit scale change
          const newZoom = Math.max(0.25, Math.min(5, initialZoom * clampedScale));
          setZoom(newZoom);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Don't flatten layers automatically - they stay as moveable layers
      isPinchingLayer = false;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoom, selectedImageId, layers, currentTool, history, historyStep]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (!data.authenticated) {
          router.push('/login');
          return;
        }

        setUser(data.user);

        // Fetch subscription status
        const subRes = await fetch('/api/user/subscription');
        const subData = await subRes.json();
        if (subData.success) {
          setHasPromptStudioDev(subData.hasPromptStudioDev);

          // AI Canvas requires Dev Tier
          if (!subData.hasPromptStudioDev) {
            router.push('/prompting-studio/subscribe');
            return;
          }
        }

        // Fetch ticket balance
        const ticketRes = await fetch(`/api/user/tickets?userId=${data.user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) {
          setTicketBalance(ticketData.balance);
        }

        // Fetch admin config
        const adminRes = await fetch('/api/admin/config');
        const adminData = await adminRes.json();
        if (adminRes.ok) {
          setAdminState({
            isMaintenanceMode: !!adminData.isMaintenanceMode,
          });
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Try to load saved session on mount
  useEffect(() => {
    if (!user || hasInitialized.current) return;

    const initSession = async () => {
      // Wait for canvas to be ready
      let retries = 0;
      while (!canvasRef.current && retries < 10) {
        console.log(`⏳ Waiting for canvas ref... (attempt ${retries + 1}/10)`);
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      if (!canvasRef.current) {
        console.error('❌ Canvas ref not available after 10 retries');
        hasInitialized.current = true;
        return;
      }

      console.log('✓ Canvas ref ready, loading state...');
      const loaded = await loadCanvasState();

      if (loaded) {
        setCanvasInitialized(true);
        // Trigger a re-render to show loaded layers
        setTimeout(() => {
          renderCanvas();
        }, 100);
      }

      hasInitialized.current = true;
    };

    initSession();
  }, [user]);

  // Initialize canvas when size is selected
  useEffect(() => {
    if (!canvasRef.current || !canvasInitialized) return;

    const canvas = canvasRef.current;
    canvas.width = selectedSize.width;
    canvas.height = selectedSize.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Only create fresh canvas if not already initialized from saved state
    if (!isHistoryInitialized) {
      // Fill with white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Save initial state to history
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([imageData]);
      setHistoryStep(0);
      setIsHistoryInitialized(true);
    }
  }, [selectedSize, canvasInitialized, isHistoryInitialized]);

  // Auto-save to IndexedDB (much larger storage limits)
  useEffect(() => {
    if (!isHistoryInitialized || !user) return;

    // Debounce saves to avoid too frequent writes
    const timeoutId = setTimeout(() => {
      saveCanvasState();
    }, 2000); // Save 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [layers, historyStep, zoom, panOffset, selectedSize, referenceImages, aiPrompt, selectedAIModel]);

  // Save immediately before page unload/refresh
  useEffect(() => {
    if (!user || !canvasInitialized) return;

    const handleBeforeUnload = () => {
      // Synchronous save attempt before page closes
      if (isHistoryInitialized) {
        saveCanvasState();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, canvasInitialized, isHistoryInitialized, layers, history, historyStep]);

  const saveToHistory = () => {
    if (!canvasRef.current || !isHistoryInitialized) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Remove any history after current step (when making new edit after undo)
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(imageData);

    // Limit history to 50 steps
    if (newHistory.length > 50) {
      newHistory.shift();
      setHistory(newHistory);
      // Don't increment historyStep when we've hit the limit
    } else {
      setHistory(newHistory);
      setHistoryStep(historyStep + 1);
    }
  };

  const undo = () => {
    if (historyStep <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newStep = historyStep - 1;
    ctx.putImageData(history[newStep], 0, 0);
    setHistoryStep(newStep);
  };

  const redo = () => {
    if (historyStep >= history.length - 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newStep = historyStep + 1;
    ctx.putImageData(history[newStep], 0, 0);
    setHistoryStep(newStep);
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Account for zoom when calculating position
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    if (currentTool === 'pan') {
      setIsPanning(true);
      // Store screen coordinates for panning (not canvas coordinates)
      setLastPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (currentTool === 'select') {
      // Check if clicking on an image
      let foundImage = false;

      // Get all images from all layers (reversed for top-to-bottom checking)
      const allImages: Array<{layer: Layer, img: LayerImage}> = [];
      layers.forEach(layer => {
        layer.images.forEach(img => {
          allImages.push({ layer, img });
        });
      });
      allImages.reverse();

      for (const {layer, img} of allImages) {
        const handleSize = 20;
        const hitArea = 35; // Larger hit detection area

        if (img.selected) {
          // Check all 4 corners for resize handles
          // Top-left
          if (
            point.x >= img.x - hitArea &&
            point.x <= img.x + hitArea &&
            point.y >= img.y - hitArea &&
            point.y <= img.y + hitArea
          ) {
            setIsResizingLayer(true);
            setResizeCorner('tl');
            setResizeStart({
              x: point.x,
              y: point.y,
              width: img.width,
              height: img.height,
              layerX: img.x,
              layerY: img.y
            });
            foundImage = true;
            break;
          }
          // Top-right
          if (
            point.x >= img.x + img.width - hitArea &&
            point.x <= img.x + img.width + hitArea &&
            point.y >= img.y - hitArea &&
            point.y <= img.y + hitArea
          ) {
            setIsResizingLayer(true);
            setResizeCorner('tr');
            setResizeStart({
              x: point.x,
              y: point.y,
              width: img.width,
              height: img.height,
              layerX: img.x,
              layerY: img.y
            });
            foundImage = true;
            break;
          }
          // Bottom-left
          if (
            point.x >= img.x - hitArea &&
            point.x <= img.x + hitArea &&
            point.y >= img.y + img.height - hitArea &&
            point.y <= img.y + img.height + hitArea
          ) {
            setIsResizingLayer(true);
            setResizeCorner('bl');
            setResizeStart({
              x: point.x,
              y: point.y,
              width: img.width,
              height: img.height,
              layerX: img.x,
              layerY: img.y
            });
            foundImage = true;
            break;
          }
          // Bottom-right
          if (
            point.x >= img.x + img.width - hitArea &&
            point.x <= img.x + img.width + hitArea &&
            point.y >= img.y + img.height - hitArea &&
            point.y <= img.y + img.height + hitArea
          ) {
            setIsResizingLayer(true);
            setResizeCorner('br');
            setResizeStart({
              x: point.x,
              y: point.y,
              width: img.width,
              height: img.height,
              layerX: img.x,
              layerY: img.y
            });
            foundImage = true;
            break;
          }
        }

        // Check if clicking on image body
        if (
          point.x >= img.x &&
          point.x <= img.x + img.width &&
          point.y >= img.y &&
          point.y <= img.y + img.height
        ) {
          // Select this image
          setSelectedImageId(img.id);
          setLayers(prev => prev.map(l => ({
            ...l,
            images: l.images.map(i => ({...i, selected: i.id === img.id}))
          })));
          setIsDraggingLayer(true);
          setDragStart({ x: point.x - img.x, y: point.y - img.y });
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        // Deselect all
        setSelectedImageId(null);
        setLayers(prev => prev.map(l => ({
          ...l,
          images: l.images.map(i => ({...i, selected: false}))
        })));
      }
      return;
    }

    setIsDrawing(true);
    setLastPos(point);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && !isPanning && !isDraggingLayer && !isResizingLayer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = getCanvasPoint(e);

    if (isPanning) {
      // Simple 1:1 panning using screen coordinates
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;

      setPanOffset({
        x: panOffset.x + dx,
        y: panOffset.y + dy
      });

      setLastPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isResizingLayer && selectedImageId && resizeCorner) {
      // Resize the selected image from different corners (maintain aspect ratio)
      const deltaX = point.x - resizeStart.x;
      const deltaY = point.y - resizeStart.y;
      const aspectRatio = resizeStart.width / resizeStart.height;

      setLayers(prev =>
        prev.map(layer => ({
          ...layer,
          images: layer.images.map(img => {
            if (img.id === selectedImageId) {
              let newX = img.x;
              let newY = img.y;
              let newWidth = img.width;
              let newHeight = img.height;

              // Use the larger delta to maintain aspect ratio
              const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

              switch (resizeCorner) {
                case 'br': // Bottom-right: grow/shrink from top-left
                  newHeight = Math.max(50, resizeStart.height + delta);
                  newWidth = newHeight * aspectRatio;
                  break;
                case 'bl': // Bottom-left: grow/shrink, adjust x
                  newHeight = Math.max(50, resizeStart.height + delta);
                  newWidth = newHeight * aspectRatio;
                  newX = resizeStart.layerX + (resizeStart.width - newWidth);
                  break;
                case 'tr': // Top-right: grow/shrink, adjust y
                  newHeight = Math.max(50, resizeStart.height - delta);
                  newWidth = newHeight * aspectRatio;
                  newY = resizeStart.layerY + (resizeStart.height - newHeight);
                  break;
                case 'tl': // Top-left: grow/shrink, adjust x and y
                  newHeight = Math.max(50, resizeStart.height - delta);
                  newWidth = newHeight * aspectRatio;
                  newX = resizeStart.layerX + (resizeStart.width - newWidth);
                  newY = resizeStart.layerY + (resizeStart.height - newHeight);
                  break;
              }

              return { ...img, x: newX, y: newY, width: newWidth, height: newHeight };
            }
            return img;
          })
        }))
      );
      return;
    }

    if (isDraggingLayer && selectedImageId) {
      // Move the selected image
      setLayers(prev =>
        prev.map(layer => ({
          ...layer,
          images: layer.images.map(img =>
            img.id === selectedImageId
              ? { ...img, x: point.x - dragStart.x, y: point.y - dragStart.y }
              : img
          )
        }))
      );
      return;
    }

    if (!isDrawing) return;

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(point.x, point.y);

    if (currentTool === 'brush') {
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (currentTool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = brushSize * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    ctx.stroke();
    setLastPos(point);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      saveToHistory();
    }
    // Don't flatten layers automatically - they stay as moveable layers
    setIsDrawing(false);
    setIsPanning(false);
    setIsDraggingLayer(false);
    setIsResizingLayer(false);
    setResizeCorner(null);
  };

  const clearCanvas = () => {
    if (!confirm('Clear the entire canvas? This cannot be undone.')) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selectedLayer = getSelectedLayer();

    // Upload each file as an image to the selected layer
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          // Calculate size to fit within canvas
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
          const width = img.width * scale;
          const height = img.height * scale;
          const x = (canvas.width - width) / 2;
          const y = (canvas.height - height) / 2;

          const newImage: LayerImage = {
            id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            image: img,
            x,
            y,
            width,
            height,
            selected: false,
          };

          // Add image to selected layer
          setLayers(prev =>
            prev.map(layer =>
              layer.id === selectedLayer.id
                ? { ...layer, images: [...layer.images, newImage] }
                : layer
            )
          );

          renderCanvas();

          // Save immediately
          setTimeout(() => saveCanvasState(), 100);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  // Render canvas with all layers
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw from history (Layer 1 - canvas layer)
    if (history[historyStep]) {
      ctx.putImageData(history[historyStep], 0, 0);
    }

    // Draw all layers in order (skip Layer 1 as it's the canvas itself)
    layers.forEach(layer => {
      if (layer.isCanvasLayer) return; // Skip canvas layer

      // Draw all images in this layer
      layer.images.forEach(img => {
        ctx.drawImage(img.image, img.x, img.y, img.width, img.height);

        // Draw selection outline if selected
        if (img.selected) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 5]);
          ctx.strokeRect(img.x - 2, img.y - 2, img.width + 4, img.height + 4);
          ctx.setLineDash([]);

          // Draw corner handles (larger and more visible)
          const handleSize = 20;
          ctx.fillStyle = '#10b981';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;

          // Bottom-right resize handle (larger and more prominent)
          ctx.fillRect(img.x + img.width - handleSize / 2, img.y + img.height - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(img.x + img.width - handleSize / 2, img.y + img.height - handleSize / 2, handleSize, handleSize);

          // Other corner handles (just for visual feedback, not interactive)
          ctx.fillRect(img.x - handleSize / 2, img.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(img.x - handleSize / 2, img.y - handleSize / 2, handleSize, handleSize);
          ctx.fillRect(img.x + img.width - handleSize / 2, img.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(img.x + img.width - handleSize / 2, img.y - handleSize / 2, handleSize, handleSize);
          ctx.fillRect(img.x - handleSize / 2, img.y + img.height - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(img.x - handleSize / 2, img.y + img.height - handleSize / 2, handleSize, handleSize);
        }
      });
    });
  };

  // Re-render when layers change
  useEffect(() => {
    renderCanvas();
  }, [layers, historyStep]);

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-canvas-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const moveLayerUp = (index: number) => {
    if (index <= 0) return; // Already at the top
    const newLayers = [...layers];
    [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
    setLayers(newLayers);
  };

  const moveLayerDown = (index: number) => {
    if (index >= layers.length - 1) return; // Already at the bottom
    const newLayers = [...layers];
    [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    setLayers(newLayers);
  };

  const flattenAllLayers = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Restore base canvas from history
    if (history[historyStep]) {
      ctx.putImageData(history[historyStep], 0, 0);
    }

    // Draw all images from all layers permanently to canvas
    layers.forEach(layer => {
      if (!layer.isCanvasLayer) {
        layer.images.forEach(img => {
          ctx.drawImage(img.image, img.x, img.y, img.width, img.height);
        });
      }
    });

    // Save to history and clear all images from non-canvas layers
    saveToHistory();
    setLayers(prev => prev.map(layer =>
      layer.isCanvasLayer ? layer : { ...layer, images: [] }
    ));
    setSelectedImageId(null);
  };

  const handleLayerDragStart = (e: React.DragEvent, index: number) => {
    setDraggedLayerIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleLayerDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedLayerIndex === null || draggedLayerIndex === index) return;

    const newLayers = [...layers];
    const draggedLayer = newLayers[draggedLayerIndex];
    newLayers.splice(draggedLayerIndex, 1);
    newLayers.splice(index, 0, draggedLayer);

    setLayers(newLayers);
    setDraggedLayerIndex(index);
  };

  const handleLayerDragEnd = () => {
    setDraggedLayerIndex(null);
  };

  // Get currently selected layer
  const getSelectedLayer = () => {
    return layers.find(l => l.selected) || layers[0];
  };

  // Get all images across all layers (for compatibility)
  const getAllImages = (): LayerImage[] => {
    return layers.flatMap(layer => layer.images);
  };

  // Select a layer
  const selectLayer = (layerId: string) => {
    setLayers(prev =>
      prev.map(l => ({ ...l, selected: l.id === layerId }))
    );
    setSelectedImageId(null);
  };

  // Add new empty layer
  const addNewLayer = () => {
    const newLayerNumber = layers.length + 1;
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${newLayerNumber}`,
      images: [],
      selected: false,
      isCanvasLayer: false
    };
    setLayers(prev => [...prev, newLayer]);
  };

  // Delete a layer (can't delete Layer 1)
  const deleteLayer = (layerId: string) => {
    if (layerId === 'layer-1') {
      alert("Can't delete Layer 1 (canvas layer)");
      return;
    }
    setLayers(prev => {
      const filtered = prev.filter(l => l.id !== layerId);
      // If deleted layer was selected, select Layer 1
      if (prev.find(l => l.id === layerId)?.selected) {
        return filtered.map(l => ({ ...l, selected: l.id === 'layer-1' }));
      }
      return filtered;
    });
  };

  const startEditingLayerName = (layer: Layer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLayerId(layer.id);
    setEditingLayerName(layer.name);
  };

  const saveLayerName = () => {
    if (editingLayerId) {
      setLayers(prev =>
        prev.map(l => l.id === editingLayerId ? { ...l, name: editingLayerName.trim() || l.name } : l)
      );
    }
    setEditingLayerId(null);
    setEditingLayerName('');
  };

  const handleLayerNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveLayerName();
    } else if (e.key === 'Escape') {
      setEditingLayerId(null);
      setEditingLayerName('');
    }
  };

  // Save current canvas as reference image
  const saveCanvasAsReference = () => {
    if (referenceImages.length >= 8) {
      alert('Maximum 8 reference images allowed');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create a temporary canvas with current state + layers
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Draw base canvas
    if (history[historyStep]) {
      tempCtx.putImageData(history[historyStep], 0, 0);
    }

    // Draw all images from all layers
    layers.forEach(layer => {
      if (!layer.isCanvasLayer) {
        layer.images.forEach(img => {
          tempCtx.drawImage(img.image, img.x, img.y, img.width, img.height);
        });
      }
    });

    // Convert to data URL
    const dataUrl = tempCanvas.toDataURL('image/png');
    setReferenceImages(prev => [...prev, dataUrl]);
  };

  // Remove reference image
  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  // Upload reference image directly
  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (referenceImages.length + files.length > 8) {
      alert(`Can only add ${8 - referenceImages.length} more image(s). Maximum 8 total.`);
      return;
    }

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setReferenceImages(prev => {
          if (prev.length >= 8) return prev;
          return [...prev, dataUrl];
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  // Generate AI image
  const generateAIImage = async () => {
    if (!aiPrompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    if (referenceImages.length === 0) {
      alert('Please save at least one reference image first');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          model: selectedAIModel,
          referenceImages: referenceImages,
          userId: user.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      // Load generated image and add as layer
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Calculate size to fit within canvas
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (canvas.width - width) / 2;
        const y = (canvas.height - height) / 2;

        // Add AI generated image to the selected layer
        const selectedLayer = getSelectedLayer();
        const newImage: LayerImage = {
          id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          image: img,
          x,
          y,
          width,
          height,
          selected: false,
        };

        setLayers(prev =>
          prev.map(layer =>
            layer.id === selectedLayer.id
              ? { ...layer, images: [...layer.images, newImage] }
              : layer
          )
        );
      };
      img.src = data.imageUrl;

    } catch (error: any) {
      console.error('Generation error:', error);
      alert(error.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save canvas state to IndexedDB (much larger storage than localStorage)
  const saveCanvasState = async () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas || !user) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create a temp canvas to capture current state without layers
      // (layers are saved separately)
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Draw current history state (base canvas without layers)
      if (history[historyStep]) {
        tempCtx.putImageData(history[historyStep], 0, 0);
      }

      // Convert canvas to blob (more efficient than data URL)
      const canvasBlob = await new Promise<Blob>((resolve) => {
        tempCanvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      // Serialize layers with blobs
      const serializedLayers = await Promise.all(
        layers.map(async (layer) => {
          // Serialize all images in this layer
          const serializedImages = await Promise.all(
            layer.images.map(async (img) => {
              // Convert image to blob
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = img.image.width;
              tempCanvas.height = img.image.height;
              const tempCtx = tempCanvas.getContext('2d');
              tempCtx?.drawImage(img.image, 0, 0);

              const imageBlob = await new Promise<Blob>((resolve) => {
                tempCanvas.toBlob((blob) => resolve(blob!), 'image/png');
              });

              return {
                id: img.id,
                imageBlob,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                selected: img.selected
              };
            })
          );

          return {
            id: layer.id,
            name: layer.name,
            images: serializedImages,
            selected: layer.selected,
            isCanvasLayer: layer.isCanvasLayer
          };
        })
      );

      const state = {
        canvasBlob,
        layers: serializedLayers,
        selectedSize,
        zoom,
        panOffset,
        historyStep,
        referenceImages,
        aiPrompt,
        selectedAIModel,
        timestamp: Date.now()
      };

      // Open IndexedDB
      const dbRequest = indexedDB.open('ai-canvas-db', 1);

      dbRequest.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('canvas-sessions')) {
          db.createObjectStore('canvas-sessions', { keyPath: 'userId' });
        }
      };

      dbRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['canvas-sessions'], 'readwrite');
        const store = transaction.objectStore('canvas-sessions');

        store.put({ userId: user.id, ...state });

        transaction.oncomplete = () => {
          console.log('✅ Canvas state saved to IndexedDB', {
            canvasSize: selectedSize,
            layerCount: layers.length,
            referenceImageCount: referenceImages.length
          });
        };
      };

      dbRequest.onerror = (error) => {
        console.error('❌ Failed to save canvas state to IndexedDB:', error);
      };
    } catch (error) {
      console.error('Failed to save canvas state:', error);
    }
  };

  // Load canvas state from IndexedDB
  const loadCanvasState = async () => {
    try {
      if (!user) return false;

      return new Promise<boolean>((resolve) => {
        const dbRequest = indexedDB.open('ai-canvas-db', 1);

        dbRequest.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('canvas-sessions')) {
            db.createObjectStore('canvas-sessions', { keyPath: 'userId' });
          }
        };

        dbRequest.onsuccess = async (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['canvas-sessions'], 'readonly');
          const store = transaction.objectStore('canvas-sessions');
          const getRequest = store.get(user.id);

          getRequest.onsuccess = async () => {
            const state = getRequest.result;
            if (!state) {
              console.log('ℹ️ No saved canvas state found in IndexedDB');
              resolve(false);
              return;
            }

            console.log('📂 Loading canvas state from IndexedDB...', {
              canvasSize: state.selectedSize,
              layerCount: state.layers?.length || 0,
              hasCanvasBlob: !!state.canvasBlob
            });

            const canvas = canvasRef.current;
            if (!canvas) {
              console.error('❌ Canvas ref not available yet');
              resolve(false);
              return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              console.error('❌ Canvas context not available');
              resolve(false);
              return;
            }

            console.log('✓ Canvas ref and context ready');

            try {
              console.log('Step 1: Restoring canvas size...');
              // Restore canvas size first
              if (state.selectedSize) {
                canvas.width = state.selectedSize.width;
                canvas.height = state.selectedSize.height;
                console.log('✓ Canvas size restored:', state.selectedSize);
              }

              console.log('Step 2: Loading canvas image...');
              // Load the base canvas image from blob
              if (state.canvasBlob) {
                const img = new Image();
                const url = URL.createObjectURL(state.canvasBlob);
                await new Promise((res, rej) => {
                  img.onload = res;
                  img.onerror = rej;
                  img.src = url;
                });
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                console.log('✓ Canvas image loaded');
              } else {
                // No saved canvas, create white background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                console.log('✓ Created white background');
              }

              console.log('Step 3: Loading layers...');
              // Restore layers
              if (state.layers && state.layers.length > 0) {
                const loadedLayers: Layer[] = [];
                for (let i = 0; i < state.layers.length; i++) {
                  const layerData = state.layers[i];
                  console.log(`  Loading layer ${i + 1}/${state.layers.length}...`);

                  // Load all images for this layer
                  const loadedImages: LayerImage[] = [];
                  if (layerData.images && layerData.images.length > 0) {
                    for (let j = 0; j < layerData.images.length; j++) {
                      const imgData = layerData.images[j];
                      const img = new Image();
                      const url = URL.createObjectURL(imgData.imageBlob);
                      await new Promise((res, rej) => {
                        img.onload = res;
                        img.onerror = rej;
                        img.src = url;
                      });
                      URL.revokeObjectURL(url);

                      loadedImages.push({
                        id: imgData.id,
                        image: img,
                        x: imgData.x,
                        y: imgData.y,
                        width: imgData.width,
                        height: imgData.height,
                        selected: imgData.selected
                      });
                    }
                  }

                  loadedLayers.push({
                    id: layerData.id,
                    name: layerData.name,
                    images: loadedImages,
                    selected: layerData.selected,
                    isCanvasLayer: layerData.isCanvasLayer || false
                  });
                }
                setLayers(loadedLayers);
                console.log('✓ All layers loaded:', loadedLayers.length);
              }

              console.log('Step 4: Saving to history...');
              // Save to history after loading canvas
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              setHistory([imageData]);
              setHistoryStep(state.historyStep || 0);
              setIsHistoryInitialized(true);
              console.log('✓ History initialized');

              console.log('Step 5: Restoring other state...');
              // Restore other state
              if (state.selectedSize) setSelectedSize(state.selectedSize);
              if (state.zoom) setZoom(state.zoom);
              if (state.panOffset) setPanOffset(state.panOffset);
              if (state.referenceImages) setReferenceImages(state.referenceImages);
              if (state.aiPrompt) setAiPrompt(state.aiPrompt);
              if (state.selectedAIModel) setSelectedAIModel(state.selectedAIModel);
              console.log('✓ Other state restored');

              console.log('✅ Canvas state loaded successfully from IndexedDB');
              resolve(true);
            } catch (error) {
              console.error('❌ Error restoring canvas state:', error);
              resolve(false);
            }
          };

          getRequest.onerror = () => {
            console.error('Failed to load canvas state from IndexedDB');
            resolve(false);
          };
        };

        dbRequest.onerror = () => {
          console.error('Failed to open IndexedDB');
          resolve(false);
        };
      });
    } catch (error) {
      console.error('Failed to load canvas state:', error);
      return false;
    }
  };

  if (isAdminLoading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-purple-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500 mb-2">
              ADMIN ACCESS ONLY
            </h1>
            <p className="text-slate-500 text-sm">This page is restricted to administrators</p>
          </div>
          <form onSubmit={handleAdminLogin} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-violet-500 focus:outline-none mb-4"
            />
            <Button type="submit" className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-bold">
              ACCESS PAGE
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  const isAdmin = user?.email === "dirtysecretai@gmail.com";

  if (adminState.isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="text-center p-12 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm max-w-md">
          <AlertTriangle className="mx-auto text-yellow-500 mb-4 animate-pulse" size={64} />
          <h1 className="text-2xl font-black text-yellow-400 mb-3">MAINTENANCE MODE</h1>
          <p className="text-slate-400 text-sm">
            AI Design Studio is temporarily offline for maintenance. We'll be back soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050810] text-white overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 border-b border-emerald-500/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/prototype">
              <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 h-9 px-3">
                <ArrowLeft size={16} className="mr-1" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="text-emerald-400" size={24} />
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                AI Canvas
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-yellow-400 font-bold">
              <Ticket size={18} />
              {ticketBalance} tickets
            </div>
            <Link href="/admin/prototype">
              <Button className="bg-slate-700 hover:bg-slate-600 h-9 text-sm">
                Prototype Lab
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 h-[calc(100vh-70px)]">
        <div className="flex h-full">
          {/* Left Toolbar */}
          <div className="w-20 bg-slate-900/90 backdrop-blur-sm border-r border-emerald-500/20 flex flex-col items-center py-4 gap-2">
            {/* Layers Toggle Button */}
            <div className="relative">
              <button
                onClick={() => setShowLayersPanelInSidebar(!showLayersPanelInSidebar)}
                className={`p-3 rounded-lg transition-all ${
                  showLayersPanelInSidebar ? 'bg-purple-600' : 'bg-slate-800 hover:bg-slate-700'
                }`}
                title={`${showLayersPanelInSidebar ? 'Hide' : 'Show'} layers panel`}
              >
                <Layers size={20} className="text-purple-400" />
              </button>
              {layers.length > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">{layers.length}</span>
                </div>
              )}
            </div>

            <div className="w-full h-px bg-emerald-500/20 my-2" />

            {/* Canvas Size Buttons - Always visible */}
            <div className="w-full px-2 space-y-2">
              {CANVAS_SIZES.map((size) => (
                <button
                  key={size.name}
                  onClick={() => {
                    setSelectedSize(size);
                    if (!canvasInitialized) {
                      setCanvasInitialized(true);
                    } else if (selectedSize.name !== size.name) {
                      // Reset to just Layer 1 when changing size
                      setLayers([{
                        id: 'layer-1',
                        name: 'Layer 1',
                        images: [],
                        selected: true,
                        isCanvasLayer: true
                      }]);
                      setSelectedImageId(null);
                      setIsHistoryInitialized(false);
                    }
                  }}
                  className={`w-full p-2 text-left rounded-lg transition-all text-[10px] ${
                    selectedSize.name === size.name
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title={`${size.width}×${size.height}`}
                >
                  <div className="font-bold text-[11px]">{size.aspectRatio}</div>
                  <div className="text-[9px] opacity-75 mt-0.5">
                    {size.width}×{size.height}
                  </div>
                </button>
              ))}
            </div>

            <div className="w-full h-px bg-emerald-500/20 my-2" />

            {/* Tools */}
            <button
              onClick={() => setCurrentTool('brush')}
              className={`p-3 rounded-lg transition-all ${
                currentTool === 'brush' ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title="Brush"
            >
              <Paintbrush size={20} className="text-white" />
            </button>

            <button
              onClick={() => setCurrentTool('eraser')}
              className={`p-3 rounded-lg transition-all ${
                currentTool === 'eraser' ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title="Eraser"
            >
              <Eraser size={20} className="text-white" />
            </button>

            <button
              onClick={() => setCurrentTool('pan')}
              className={`p-3 rounded-lg transition-all ${
                currentTool === 'pan' ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title="Pan"
            >
              <Move size={20} className="text-white" />
            </button>

            <button
              onClick={() => setCurrentTool('select')}
              className={`p-3 rounded-lg transition-all ${
                currentTool === 'select' ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title="Select & Move Images"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
                <path d="M13 13l6 6"></path>
              </svg>
            </button>

            <div className="w-full h-px bg-emerald-500/20 my-2" />

            {/* Undo/Redo */}
            <div className="relative group">
              <button
                onClick={undo}
                disabled={historyStep <= 0}
                className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title={`Undo (${historyStep} steps available)`}
              >
                <Undo size={20} className="text-white" />
              </button>
              {historyStep > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] font-bold text-black">{historyStep}</span>
                </div>
              )}
            </div>

            <div className="relative group">
              <button
                onClick={redo}
                disabled={historyStep >= history.length - 1}
                className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title={`Redo (${history.length - 1 - historyStep} steps available)`}
              >
                <Redo size={20} className="text-white" />
              </button>
              {historyStep < history.length - 1 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] font-bold text-black">{history.length - 1 - historyStep}</span>
                </div>
              )}
            </div>

            <div className="w-full h-px bg-emerald-500/20 my-2" />

            {/* Actions */}
            <label className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-all" title="Upload Image">
              <Upload size={20} className="text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={downloadCanvas}
              className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all"
              title="Download"
            >
              <Download size={20} className="text-white" />
            </button>

            <button
              onClick={clearCanvas}
              className="p-3 rounded-lg bg-red-600/20 hover:bg-red-600/40 transition-all"
              title="Clear Canvas"
            >
              <Trash2 size={20} className="text-red-400" />
            </button>

            <div className="w-full h-px bg-emerald-500/20 my-2" />

            {/* Zoom Controls */}
            <button
              onClick={() => setZoom(Math.min(zoom + 0.25, 5))}
              disabled={zoom >= 5}
              className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Zoom In"
            >
              <ZoomIn size={20} className="text-white" />
            </button>

            <button
              onClick={() => setZoom(Math.max(zoom - 0.25, 0.25))}
              disabled={zoom <= 0.25}
              className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Zoom Out"
            >
              <ZoomOut size={20} className="text-white" />
            </button>

            <div className="w-full h-px bg-emerald-500/20 my-2" />

            {/* Reset View */}
            <button
              onClick={() => {
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="p-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 transition-all"
              title="Reset View to Center"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="1"></circle>
              </svg>
            </button>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 flex items-center justify-center bg-slate-950/50 overflow-hidden relative">
            {/* Canvas Selection Screen */}
            {!canvasInitialized && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm z-40">
                <div className="text-center">
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mb-4">
                    Choose Your Canvas
                  </h2>
                  <p className="text-slate-400 mb-8">Select an aspect ratio to get started</p>

                  <div className="flex gap-8 justify-center flex-wrap max-w-5xl mx-auto">
                    {CANVAS_SIZES.map((size) => {
                      // Calculate preview box dimensions based on aspect ratio
                      let previewWidth = 200;
                      let previewHeight = 200;

                      if (size.aspectRatio === '1:1') {
                        previewWidth = 200;
                        previewHeight = 200;
                      } else if (size.aspectRatio === '4:5') {
                        previewWidth = 200;
                        previewHeight = 250;
                      } else if (size.aspectRatio === '9:16') {
                        previewWidth = 180;
                        previewHeight = 320;
                      } else if (size.aspectRatio === '16:9') {
                        previewWidth = 320;
                        previewHeight = 180;
                      }

                      return (
                        <button
                          key={size.name}
                          onClick={() => {
                            setSelectedSize(size);
                            setCanvasInitialized(true);
                          }}
                          className="group relative"
                        >
                          {/* Canvas preview box */}
                          <div
                            className="border-4 border-emerald-500/30 rounded-lg bg-white hover:border-emerald-400 hover:bg-slate-50 transition-all shadow-lg hover:shadow-emerald-500/20"
                            style={{
                              width: `${previewWidth}px`,
                              height: `${previewHeight}px`
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-4xl font-black text-emerald-600 mb-2">
                                  {size.aspectRatio}
                                </div>
                                <div className="text-xs text-slate-600 font-semibold">
                                  {size.width} × {size.height}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Label */}
                          <div className="mt-4 text-white font-bold group-hover:text-emerald-400 transition-colors">
                            {size.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Layers Panel - Top Left */}
            {showLayersPanelInSidebar && (
              <div className="absolute left-4 top-4 w-80 bg-slate-900/95 backdrop-blur-sm border-2 border-purple-500/50 rounded-xl shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                    <Layers size={16} />
                    Layers ({layers.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={addNewLayer}
                      className="text-xs px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 transition-all"
                      title="Add new empty layer"
                    >
                      + Add Layer
                    </button>
                    <button
                      onClick={flattenAllLayers}
                      className="text-xs px-2 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 transition-all"
                      title="Merge all layers to canvas"
                    >
                      Flatten All
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {[...layers].reverse().map((layer, displayIndex) => {
                    const actualIndex = layers.length - 1 - displayIndex;
                    return (
                      <div
                        key={layer.id}
                        draggable
                        onDragStart={(e) => handleLayerDragStart(e, actualIndex)}
                        onDragOver={(e) => handleLayerDragOver(e, actualIndex)}
                        onDragEnd={handleLayerDragEnd}
                        onClick={() => selectLayer(layer.id)}
                        className={`p-3 rounded-lg text-xs flex items-center gap-2 cursor-move transition-all ${
                          layer.selected
                            ? 'bg-emerald-500/20 border-2 border-emerald-500/50 ring-2 ring-emerald-400/30'
                            : 'bg-slate-800 border-2 border-slate-700 hover:border-slate-600'
                        } ${draggedLayerIndex === actualIndex ? 'opacity-50' : ''}`}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveLayerUp(actualIndex);
                            }}
                            disabled={actualIndex === layers.length - 1}
                            className="p-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move layer up (toward front)"
                          >
                            <ChevronUp size={12} className="text-white" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveLayerDown(actualIndex);
                            }}
                            disabled={actualIndex === 0}
                            className="p-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move layer down (toward back)"
                          >
                            <ChevronDown size={12} className="text-white" />
                          </button>
                        </div>
                        <div className="flex-1">
                          {editingLayerId === layer.id ? (
                            <input
                              type="text"
                              value={editingLayerName}
                              onChange={(e) => setEditingLayerName(e.target.value)}
                              onBlur={saveLayerName}
                              onKeyDown={handleLayerNameKeyDown}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full bg-slate-950 border border-emerald-500/50 rounded px-2 py-1 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          ) : (
                            <div
                              onClick={(e) => startEditingLayerName(layer, e)}
                              className="cursor-text hover:bg-slate-700/30 rounded px-1 -mx-1"
                            >
                              <div className="text-white font-bold">
                                {layer.name}
                                {layer.isCanvasLayer && <span className="text-purple-400 ml-1">(Canvas)</span>}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {actualIndex === layers.length - 1 ? '(Top)' : actualIndex === 0 ? '(Bottom)' : ''} • {layer.images.length} image{layer.images.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLayer(layer.id);
                          }}
                          disabled={layer.isCanvasLayer}
                          className="p-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={layer.isCanvasLayer ? "Can't delete canvas layer" : "Delete layer"}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                  • Click to select a layer<br />
                  • Upload images to selected layer<br />
                  • Use Select tool to move/resize images<br />
                  • Drag corner handle to resize (desktop)<br />
                  • Pinch to resize selected image (iPad)<br />
                  • Top layers appear in front
                </p>
              </div>
            )}

            {/* Pan offset indicator */}
            {(Math.abs(panOffset.x) > 10 || Math.abs(panOffset.y) > 10 || zoom !== 1) && (
              <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-sm border border-purple-500/30 rounded-lg px-3 py-2">
                <p className="text-xs text-purple-400 font-mono">
                  Zoom: {Math.round(zoom * 100)}% | Pan: {Math.round(panOffset.x)}, {Math.round(panOffset.y)}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Press H to reset view
                </p>
              </div>
            )}

            {/* Image selected indicator (mobile) */}
            {selectedImageId && currentTool === 'select' && (
              <div className="absolute top-4 right-4 z-10 bg-emerald-900/90 backdrop-blur-sm border border-emerald-500/50 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-400 font-bold">
                  Image Selected
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Pinch to resize
                </p>
              </div>
            )}

            <div
              className="relative"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className={`border-2 border-emerald-500/30 shadow-2xl ${
                  isResizingLayer && resizeCorner === 'br' ? 'cursor-nwse-resize' :
                  isResizingLayer && resizeCorner === 'tl' ? 'cursor-nwse-resize' :
                  isResizingLayer && resizeCorner === 'tr' ? 'cursor-nesw-resize' :
                  isResizingLayer && resizeCorner === 'bl' ? 'cursor-nesw-resize' :
                  currentTool === 'select' ? 'cursor-pointer' :
                  currentTool === 'pan' ? 'cursor-move' :
                  'cursor-crosshair'
                }`}
                style={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '90vw',
                  maxHeight: '80vh',
                  touchAction: 'none',
                  backgroundColor: '#FFFFFF'
                }}
              />
            </div>
          </div>

          {/* Right Panel - Properties */}
          <div className="w-72 bg-slate-900/90 backdrop-blur-sm border-l border-emerald-500/20 p-4 overflow-y-auto">
            <h2 className="text-lg font-bold text-emerald-400 mb-4">Properties</h2>

            {/* Brush Settings */}
            {currentTool === 'brush' && (
              <div className="mb-6">
                <label className="text-xs text-slate-400 mb-2 block">Brush Size: {brushSize}px</label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full"
                />

                <label className="text-xs text-slate-400 mb-2 block mt-4">Brush Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-12 h-12 rounded border-2 border-emerald-500/30 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  />
                </div>

                {/* Common Colors */}
                <div className="grid grid-cols-6 gap-2 mt-3">
                  {['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setBrushColor(color)}
                      className={`w-8 h-8 rounded border-2 transition-all ${
                        brushColor === color ? 'border-emerald-400 scale-110' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {currentTool === 'eraser' && (
              <div className="mb-6">
                <label className="text-xs text-slate-400 mb-2 block">Eraser Size: {brushSize * 2}px</label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {/* Canvas Info */}
            <div className="p-4 rounded-lg bg-slate-950/50 border border-emerald-500/20">
              <h3 className="text-sm font-bold text-emerald-400 mb-2">Canvas Info</h3>
              <div className="text-xs text-slate-400 space-y-1">
                <p><span className="text-white">Size:</span> {selectedSize.name}</p>
                <p><span className="text-white">Dimensions:</span> {selectedSize.width}×{selectedSize.height}</p>
                <p><span className="text-white">Aspect Ratio:</span> {selectedSize.aspectRatio}</p>
                <p><span className="text-white">Zoom:</span> {Math.round(zoom * 100)}%</p>
                <p><span className="text-white">Tool:</span> {currentTool}</p>
              </div>
            </div>

            {/* History Info */}
            <div className="p-4 rounded-lg bg-slate-950/50 border border-teal-500/20 mt-4">
              <h3 className="text-sm font-bold text-teal-400 mb-2">Edit History</h3>
              <div className="text-xs text-slate-400 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Current Step:</span>
                  <span className="text-white font-mono">{historyStep + 1}/{history.length}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all"
                    style={{ width: `${((historyStep + 1) / history.length) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-emerald-400">← {historyStep} undo</span>
                  <span className="text-teal-400">{history.length - 1 - historyStep} redo →</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Shortcuts: Ctrl+Z (undo), Ctrl+Y (redo)
                </p>
              </div>
            </div>


            {/* Keyboard Shortcuts */}
            <div className="p-4 rounded-lg bg-slate-950/50 border border-cyan-500/20 mt-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-2">Shortcuts</h3>
              <div className="text-xs text-slate-400 space-y-1">
                <p><kbd className="px-1 py-0.5 bg-slate-800 rounded text-[10px]">Space</kbd> Hold to pan</p>
                <p><kbd className="px-1 py-0.5 bg-slate-800 rounded text-[10px]">H</kbd> Reset view</p>
                <p><kbd className="px-1 py-0.5 bg-slate-800 rounded text-[10px]">Ctrl+Z</kbd> Undo</p>
                <p><kbd className="px-1 py-0.5 bg-slate-800 rounded text-[10px]">Ctrl+Y</kbd> Redo</p>
                <p><kbd className="px-1 py-0.5 bg-slate-800 rounded text-[10px]">Scroll</kbd> Zoom</p>
              </div>
            </div>

            {/* AI Generation */}
            <div className="mt-6 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h3 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                <Sparkles size={16} />
                AI Generation
              </h3>

              {/* Model Selection */}
              <div className="mb-3">
                <label className="text-xs text-slate-400 mb-2 block">AI Model</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedAIModel('nano-banana-pro')}
                    className={`px-3 py-2 rounded text-xs font-bold transition-all ${
                      selectedAIModel === 'nano-banana-pro'
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Nano Banana Pro
                  </button>
                  <button
                    onClick={() => setSelectedAIModel('seedream-4.5')}
                    className={`px-3 py-2 rounded text-xs font-bold transition-all ${
                      selectedAIModel === 'seedream-4.5'
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    SeeDream 4.5
                  </button>
                </div>
              </div>

              {/* Prompt Input */}
              <div className="mb-3">
                <label className="text-xs text-slate-400 mb-1 block">Prompt</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want to generate..."
                  className="w-full bg-slate-950 border border-purple-500/30 rounded px-3 py-2 text-white text-xs resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                  rows={3}
                />
              </div>

              {/* Reference Images Counter */}
              <div className="mb-2 p-2 rounded bg-slate-950/50 border border-purple-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Reference Images:</span>
                  <span className={`text-sm font-bold ${referenceImages.length === 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {referenceImages.length}/8
                  </span>
                </div>
              </div>

              {/* Reference Image Actions */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={saveCanvasAsReference}
                  disabled={referenceImages.length >= 8}
                  className="px-3 py-2 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Canvas
                </button>
                <label className="px-3 py-2 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-xs font-bold transition-all cursor-pointer text-center disabled:opacity-50">
                  Upload Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleReferenceImageUpload}
                    disabled={referenceImages.length >= 8}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Reference Images */}
              {referenceImages.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs text-slate-400 mb-2 block">Reference Images</label>
                  <div className="grid grid-cols-4 gap-2">
                    {referenceImages.map((imgUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={imgUrl}
                          alt={`Reference ${index + 1}`}
                          className="w-full h-16 object-cover rounded border border-purple-500/30"
                        />
                        <button
                          onClick={() => removeReferenceImage(index)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={generateAIImage}
                disabled={isGenerating || !aiPrompt.trim() || referenceImages.length === 0}
                className="w-full px-4 py-2 rounded bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating...' : `Generate with ${selectedAIModel === 'nano-banana-pro' ? 'Nano Banana Pro' : 'SeeDream 4.5'}`}
              </button>

              <p className="text-[10px] text-slate-500 mt-3">
                Generated images will be added as new layers
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
