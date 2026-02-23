'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Ticket, Upload, Download, Trash2, ZoomIn, ZoomOut, Layers, X, ChevronUp, ChevronDown, Sparkles, AlertTriangle, Save, FolderOpen, Plus, Square, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { getTicketCost } from '@/config/ai-models.config';

interface CanvasSize {
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
}

const CANVAS_SIZES: CanvasSize[] = [
  { name: '4K Square (1:1)', width: 3840, height: 3840, aspectRatio: '1:1' },
  { name: '4K Portrait (4:5)', width: 3072, height: 3840, aspectRatio: '4:5' },
  { name: '4K Story (9:16)', width: 2160, height: 3840, aspectRatio: '9:16' },
  { name: '4K Landscape (16:9)', width: 3840, height: 2160, aspectRatio: '16:9' },
];

type AIModel = 'nano-banana-pro' | 'gemini-3-pro-image' | 'seedream-4.5';

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
  visible: boolean;
}

interface AreaSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  isDragging?: boolean;
  isResizing?: boolean;
  resizeHandle?: 'tl' | 'tr' | 'bl' | 'br' | 'move';
}

type SelectionMode = 'area' | 'full';

interface ReferenceImage {
  id: string;
  src: string;
  label: string;
  active: boolean;
  type: 'canvas' | 'area';
  createdAt: number;
}

interface SavedSession {
  id: string;
  name: string;
  timestamp: number;
  canvasSize: CanvasSize;
  layers: any[];
  gridRows: number;
  gridCols: number;
}

interface AdminState {
  isMaintenanceMode: boolean;
}

interface CanvasData {
  id: number;
  name: string | null;
  aspectRatio: string;
  canvasWidth: number;
  canvasHeight: number;
  layers: any;
  panOffset: any;
  zoom: number;
  rotation: number;
  gridRows: number;
  gridCols: number;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}

type ViewState = 'gallery' | 'aspectRatio' | 'editor';

export default function CompositionCanvas() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticketBalance, setTicketBalance] = useState<number>(0);
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false);
  const [adminState, setAdminState] = useState<AdminState>({
    isMaintenanceMode: false,
  });

  // View state management
  const [viewState, setViewState] = useState<ViewState>('gallery');
  const [canvasList, setCanvasList] = useState<CanvasData[]>([]);
  const [currentCanvasId, setCurrentCanvasId] = useState<number | null>(null);
  const [showAspectRatioModal, setShowAspectRatioModal] = useState(false);
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(false);

  // Canvas state
  const [selectedSize, setSelectedSize] = useState<CanvasSize>(CANVAS_SIZES[0]);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  // Layers system
  const [layers, setLayers] = useState<Layer[]>([
    {
      id: 'layer-1',
      name: 'Layer 1',
      images: [],
      selected: true,
      visible: true,
    }
  ]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLayersPanel, setShowLayersPanel] = useState(false);

  // Image resize state
  const [isResizingImage, setIsResizingImage] = useState(false);
  const [imageResizeHandle, setImageResizeHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [imageResizeStart, setImageResizeStart] = useState({ x: 0, y: 0 });
  const [imageResizeOriginal, setImageResizeOriginal] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [hoveredResizeHandle, setHoveredResizeHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  // Refs mirror the resize state for immediate access in mousemove (avoids stale closure)
  const isResizingImageRef = useRef(false);
  const imageResizeHandleRef = useRef<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const imageResizeStartRef = useRef({ x: 0, y: 0 });
  const imageResizeOriginalRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const resizingImageIdRef = useRef<string | null>(null);

  // Pinch-to-zoom refs — persists across re-renders so zoom state updates
  // don't reset the in-progress gesture (fixes "snaps to 500%" bug on iPad)
  const zoomRef = useRef(1);
  const pinchInitialDistanceRef = useRef(0);
  const pinchInitialZoomRef = useRef(1);
  // Single-finger pan refs
  const touchPanActiveRef = useRef(false);
  const touchPanLastRef = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  // Touch image interaction refs (avoids stale closure in touch useEffect)
  const layersRef = useRef<Layer[]>(layers);
  const touchDragActiveRef = useRef(false);
  const touchDragImageIdRef = useRef<string | null>(null);
  const touchDragOffsetRef = useRef({ x: 0, y: 0 });
  const touchResizingRef = useRef(false);
  const touchResizeHandleRef = useRef<'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const touchResizeStartRef = useRef({ x: 0, y: 0 });
  const touchResizeOriginalRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const touchResizeImageIdRef = useRef<string | null>(null);

  // Grid rows/cols kept for DB compatibility only (not exposed in UI)
  const [gridRows, setGridRows] = useState(3);
  const [gridCols, setGridCols] = useState(3);

  // Area selection system
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('full');
  const [areaSelection, setAreaSelection] = useState<AreaSelection | null>(null);
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [areaDrawStart, setAreaDrawStart] = useState({ x: 0, y: 0 });

  // Reference images system
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [canvasRefActive, setCanvasRefActive] = useState(true);
  const [showReferencePanel, setShowReferencePanel] = useState(false);
  const [canvasPreviewSrc, setCanvasPreviewSrc] = useState<string | null>(null);
  const [areaPreviewSrc, setAreaPreviewSrc] = useState<string | null>(null);

  // AI Generation
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedAIModel, setSelectedAIModel] = useState<AIModel>('gemini-3-pro-image');
  const [genQuality, setGenQuality] = useState<'2k' | '4k'>('2k');
  const [genAspectRatio, setGenAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);

  // Session management
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [showSessionsPanel, setShowSessionsPanel] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Auto-save status
  const [isSavingCanvas, setIsSavingCanvas] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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

          // Composition Canvas requires Dev Tier
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

        // Load saved canvases
        await loadCanvases();
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Initialize canvas when size is selected
  useEffect(() => {
    if (!canvasRef.current || !canvasInitialized) return;

    const canvas = canvasRef.current;
    canvas.width = selectedSize.width;
    canvas.height = selectedSize.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    renderCanvas();

    // Capture initial canvas preview
    setTimeout(() => {
      const preview = generateThumbnail();
      if (preview) setCanvasPreviewSrc(preview);
    }, 50);
  }, [selectedSize, canvasInitialized]);

  // Re-render when layers change; also update canvas preview
  useEffect(() => {
    renderCanvas();
    if (canvasInitialized) {
      const preview = generateThumbnail();
      if (preview) setCanvasPreviewSrc(preview);
    }
  }, [layers, areaSelection, selectionMode, canvasInitialized]);

  // Keep refs in sync so touch handlers always see the latest values
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  // Area selection refs — needed so the touch handler (closed over canvasInitialized only)
  // can read current area state without stale closures
  const selectionModeRef = useRef<SelectionMode>('full');
  const areaSelectionRef = useRef<AreaSelection | null>(null);
  const touchAreaDrawingRef = useRef(false);       // true while finger is actively drawing a new rect
  const touchAreaDrawStartRef = useRef({ x: 0, y: 0 }); // canvas-space draw/move origin
  useEffect(() => { selectionModeRef.current = selectionMode; }, [selectionMode]);
  useEffect(() => { areaSelectionRef.current = areaSelection; }, [areaSelection]);

  // Mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || !canvasInitialized) return;

      const rect = canvas.getBoundingClientRect();
      const isOverCanvas =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isOverCanvas) return;

      e.preventDefault();

      // Zoom in/out based on scroll direction
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
      setZoom(newZoom);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [zoom, canvasInitialized]);

  // Touch gesture handler: pinch-to-zoom, single-finger pan, image drag & resize.
  // All mutable state is accessed via refs so closure captures don't go stale.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasInitialized) return;

    // Convert a client-space touch coordinate to canvas-space point
    const getPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Two-finger pinch — cancel any active drag/pan first
        e.preventDefault();
        touchPanActiveRef.current = false;
        touchDragActiveRef.current = false;
        touchResizingRef.current = false;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        pinchInitialDistanceRef.current = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        pinchInitialZoomRef.current = zoomRef.current;
      } else if (e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const point = getPoint(touch.clientX, touch.clientY);
        const currentLayers = layersRef.current;

        // 1. Check resize handles of currently selected image (highest priority)
        const selectedImg = currentLayers
          .flatMap(l => l.selected && l.visible ? l.images : [])
          .find(img => img.selected);

        if (selectedImg) {
          const rect = canvas.getBoundingClientRect();
          const displayScale = rect.width > 0 ? canvas.width / rect.width : 1;
          // Use a larger hit area for touch (fingers are less precise than a cursor)
          const hitArea = Math.max(50, Math.round(24 * displayScale));
          const outset = Math.max(2, Math.round(2 * displayScale));
          const corners: { handle: 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number }[] = [
            { handle: 'tl', x: selectedImg.x - outset, y: selectedImg.y - outset },
            { handle: 'tr', x: selectedImg.x + selectedImg.width + outset, y: selectedImg.y - outset },
            { handle: 'bl', x: selectedImg.x - outset, y: selectedImg.y + selectedImg.height + outset },
            { handle: 'br', x: selectedImg.x + selectedImg.width + outset, y: selectedImg.y + selectedImg.height + outset },
          ];

          for (const { handle, x, y } of corners) {
            if (Math.abs(point.x - x) <= hitArea && Math.abs(point.y - y) <= hitArea) {
              touchResizingRef.current = true;
              touchResizeHandleRef.current = handle;
              touchResizeStartRef.current = point;
              touchResizeOriginalRef.current = {
                x: selectedImg.x, y: selectedImg.y,
                width: selectedImg.width, height: selectedImg.height,
              };
              touchResizeImageIdRef.current = selectedImg.id;
              touchPanActiveRef.current = false;
              touchDragActiveRef.current = false;
              return;
            }
          }
        }

        // 2. Area selection mode — single finger draws / moves / resizes the selection rect
        if (selectionModeRef.current === 'area') {
          touchPanActiveRef.current = false;
          touchDragActiveRef.current = false;
          touchResizingRef.current = false;

          const existing = areaSelectionRef.current;
          if (existing) {
            // Larger hit target for touch (fingers are less precise than a cursor)
            const hitArea = 60;
            const handles = [
              { name: 'tl' as const, x: existing.x,                     y: existing.y },
              { name: 'tr' as const, x: existing.x + existing.width,     y: existing.y },
              { name: 'bl' as const, x: existing.x,                     y: existing.y + existing.height },
              { name: 'br' as const, x: existing.x + existing.width,     y: existing.y + existing.height },
            ];
            for (const handle of handles) {
              if (
                point.x >= handle.x - hitArea && point.x <= handle.x + hitArea &&
                point.y >= handle.y - hitArea && point.y <= handle.y + hitArea
              ) {
                const updated = { ...existing, isResizing: true, resizeHandle: handle.name };
                setAreaSelection(updated);
                areaSelectionRef.current = updated;
                touchAreaDrawStartRef.current = point;
                return;
              }
            }
            // Inside the rect → move it
            if (
              point.x >= existing.x && point.x <= existing.x + existing.width &&
              point.y >= existing.y && point.y <= existing.y + existing.height
            ) {
              const updated = { ...existing, isDragging: true, resizeHandle: 'move' as const };
              setAreaSelection(updated);
              areaSelectionRef.current = updated;
              touchAreaDrawStartRef.current = { x: point.x - existing.x, y: point.y - existing.y };
              return;
            }
          }
          // Outside / no existing rect → draw a new one
          touchAreaDrawingRef.current = true;
          touchAreaDrawStartRef.current = point;
          const newSel = { x: point.x, y: point.y, width: 0, height: 0 };
          setAreaSelection(newSel);
          areaSelectionRef.current = newSel;
          setIsDrawingArea(true);
          return;
        }

        // 3. Check if touching an image body on the selected visible layer
        const allImages: LayerImage[] = [];
        currentLayers.forEach(layer => {
          if (layer.selected && layer.visible) {
            layer.images.forEach(img => allImages.push(img));
          }
        });
        allImages.reverse(); // top-most first

        for (const img of allImages) {
          if (
            point.x >= img.x &&
            point.x <= img.x + img.width &&
            point.y >= img.y &&
            point.y <= img.y + img.height
          ) {
            // Select and start dragging
            setSelectedImageId(img.id);
            setLayers(prev => prev.map(l => ({
              ...l,
              images: l.images.map(i => ({ ...i, selected: i.id === img.id })),
            })));
            touchDragActiveRef.current = true;
            touchDragImageIdRef.current = img.id;
            touchDragOffsetRef.current = { x: point.x - img.x, y: point.y - img.y };
            touchPanActiveRef.current = false;
            touchResizingRef.current = false;
            return;
          }
        }

        // 4. Default: canvas pan
        touchPanActiveRef.current = true;
        touchDragActiveRef.current = false;
        touchResizingRef.current = false;
        touchPanLastRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch zoom
        touchPanActiveRef.current = false;
        touchDragActiveRef.current = false;
        touchResizingRef.current = false;
        if (pinchInitialDistanceRef.current === 0) return;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const scale = currentDistance / pinchInitialDistanceRef.current;
        const newZoom = Math.max(0.1, Math.min(5, pinchInitialZoomRef.current * scale));
        setZoom(newZoom);
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const point = getPoint(touch.clientX, touch.clientY);

        // Area selection: draw / move / resize
        if (selectionModeRef.current === 'area') {
          const existing = areaSelectionRef.current;
          const canvasEl = canvas;

          if (touchAreaDrawingRef.current) {
            // Drawing a new rectangle
            const start = touchAreaDrawStartRef.current;
            const width = point.x - start.x;
            const height = point.y - start.y;
            const newSel = {
              x: width >= 0 ? start.x : point.x,
              y: height >= 0 ? start.y : point.y,
              width: Math.abs(width),
              height: Math.abs(height),
            };
            setAreaSelection(newSel);
            areaSelectionRef.current = newSel;
            return;
          }

          if (existing?.isDragging && existing.resizeHandle === 'move') {
            // Moving the rectangle
            const newX = Math.max(0, Math.min(point.x - touchAreaDrawStartRef.current.x, canvasEl.width - existing.width));
            const newY = Math.max(0, Math.min(point.y - touchAreaDrawStartRef.current.y, canvasEl.height - existing.height));
            const newSel = { ...existing, x: newX, y: newY };
            setAreaSelection(newSel);
            areaSelectionRef.current = newSel;
            return;
          }

          if (existing?.isResizing) {
            // Resizing the rectangle
            let newX = existing.x, newY = existing.y, newW = existing.width, newH = existing.height;
            switch (existing.resizeHandle) {
              case 'br':
                newW = Math.max(50, Math.min(point.x - existing.x, canvasEl.width - existing.x));
                newH = Math.max(50, Math.min(point.y - existing.y, canvasEl.height - existing.y));
                break;
              case 'bl':
                newW = Math.max(50, existing.x + existing.width - point.x);
                newH = Math.max(50, Math.min(point.y - existing.y, canvasEl.height - existing.y));
                newX = existing.x + existing.width - newW;
                break;
              case 'tr':
                newW = Math.max(50, Math.min(point.x - existing.x, canvasEl.width - existing.x));
                newH = Math.max(50, existing.y + existing.height - point.y);
                newY = existing.y + existing.height - newH;
                break;
              case 'tl':
                newW = Math.max(50, existing.x + existing.width - point.x);
                newH = Math.max(50, existing.y + existing.height - point.y);
                newX = existing.x + existing.width - newW;
                newY = existing.y + existing.height - newH;
                break;
            }
            const newSel = { ...existing, x: newX, y: newY, width: newW, height: newH };
            setAreaSelection(newSel);
            areaSelectionRef.current = newSel;
            return;
          }
          return; // Area mode active but nothing to do — don't fall through to pan
        }

        // Touch image resize
        if (touchResizingRef.current && touchResizeImageIdRef.current && touchResizeHandleRef.current) {
          const minSize = 20;
          const snapThreshold = 12;
          const resizingId = touchResizeImageIdRef.current;
          const resizeHandle = touchResizeHandleRef.current;
          const resizeStart = touchResizeStartRef.current;
          const resizeOriginal = touchResizeOriginalRef.current;
          const dx = point.x - resizeStart.x;
          const dy = point.y - resizeStart.y;
          setLayers(prev => prev.map(layer => ({
            ...layer,
            images: layer.images.map(img => {
              if (img.id !== resizingId) return img;
              let { x, y, width, height } = resizeOriginal;
              switch (resizeHandle) {
                case 'br':
                  width = Math.max(minSize, resizeOriginal.width + dx);
                  height = Math.max(minSize, resizeOriginal.height + dy);
                  break;
                case 'bl':
                  width = Math.max(minSize, resizeOriginal.width - dx);
                  x = resizeOriginal.x + resizeOriginal.width - width;
                  height = Math.max(minSize, resizeOriginal.height + dy);
                  break;
                case 'tr':
                  width = Math.max(minSize, resizeOriginal.width + dx);
                  height = Math.max(minSize, resizeOriginal.height - dy);
                  y = resizeOriginal.y + resizeOriginal.height - height;
                  break;
                case 'tl':
                  width = Math.max(minSize, resizeOriginal.width - dx);
                  x = resizeOriginal.x + resizeOriginal.width - width;
                  height = Math.max(minSize, resizeOriginal.height - dy);
                  y = resizeOriginal.y + resizeOriginal.height - height;
                  break;
              }
              // Snap edges to canvas boundaries (like rotation snapping to cardinal angles)
              const edgeSnap = 80; // canvas pixels
              switch (resizeHandle) {
                case 'br':
                  if (Math.abs((x + width) - canvas.width) < edgeSnap) width = canvas.width - x;
                  if (Math.abs((y + height) - canvas.height) < edgeSnap) height = canvas.height - y;
                  break;
                case 'bl':
                  if (Math.abs(x) < edgeSnap) { width = width + x; x = 0; }
                  if (Math.abs((y + height) - canvas.height) < edgeSnap) height = canvas.height - y;
                  break;
                case 'tr':
                  if (Math.abs((x + width) - canvas.width) < edgeSnap) width = canvas.width - x;
                  if (Math.abs(y) < edgeSnap) { height = height + y; y = 0; }
                  break;
                case 'tl':
                  if (Math.abs(x) < edgeSnap) { width = width + x; x = 0; }
                  if (Math.abs(y) < edgeSnap) { height = height + y; y = 0; }
                  break;
              }
              // Snap back to original size when close (mirrors mouse resize behaviour)
              if (
                Math.abs(width - resizeOriginal.width) < snapThreshold &&
                Math.abs(height - resizeOriginal.height) < snapThreshold
              ) {
                width = resizeOriginal.width;
                height = resizeOriginal.height;
                x = resizeOriginal.x;
                y = resizeOriginal.y;
              }
              return { ...img, x, y, width, height };
            }),
          })));
          return;
        }

        // Touch image drag
        if (touchDragActiveRef.current && touchDragImageIdRef.current) {
          const imageId = touchDragImageIdRef.current;
          const offset = touchDragOffsetRef.current;
          setLayers(prev => prev.map(layer => ({
            ...layer,
            images: layer.images.map(img =>
              img.id === imageId
                ? { ...img, x: point.x - offset.x, y: point.y - offset.y }
                : img
            ),
          })));
          return;
        }

        // Canvas pan
        if (touchPanActiveRef.current) {
          const dx = touch.clientX - touchPanLastRef.current.x;
          const dy = touch.clientY - touchPanLastRef.current.y;
          touchPanLastRef.current = { x: touch.clientX, y: touch.clientY };
          setPanOffset({
            x: panOffsetRef.current.x + dx,
            y: panOffsetRef.current.y + dy,
          });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchInitialDistanceRef.current = 0;
      }
      if (e.touches.length === 0) {
        // Finalize area selection draw / move / resize
        if (touchAreaDrawingRef.current) {
          touchAreaDrawingRef.current = false;
          setIsDrawingArea(false);
        }
        const currentArea = areaSelectionRef.current;
        if (currentArea?.isDragging || currentArea?.isResizing) {
          const cleaned = { ...currentArea, isDragging: false, isResizing: false, resizeHandle: undefined };
          setAreaSelection(cleaned);
          areaSelectionRef.current = cleaned;
        }
        touchPanActiveRef.current = false;
        touchDragActiveRef.current = false;
        touchResizingRef.current = false;
        touchDragImageIdRef.current = null;
        touchResizeImageIdRef.current = null;
        touchResizeHandleRef.current = null;
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canvasInitialized]); // All mutable state accessed via refs — no extra deps needed

  // Global move/up listeners for rotation handle (mouse + touch)
  useEffect(() => {
    if (!isRotating) return;

    const getAngleFromClient = (clientX: number, clientY: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
      angle = ((angle % 360) + 360) % 360;
      // Snap to cardinal angles within 5°
      for (const snap of [0, 90, 180, 270, 360]) {
        if (Math.abs(angle - snap) < 5) { angle = snap % 360; break; }
      }
      return angle;
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setRotation(getAngleFromClient(e.clientX, e.clientY));
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        setRotation(getAngleFromClient(e.touches[0].clientX, e.touches[0].clientY));
      }
    };

    const handleGlobalMouseUp = () => setIsRotating(false);
    const handleGlobalTouchEnd = () => setIsRotating(false);

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isRotating]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and fill white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all visible layers in order
    layers.forEach(layer => {
      if (!layer.visible) return; // Skip hidden layers

      layer.images.forEach(img => {
        ctx.drawImage(img.image, img.x, img.y, img.width, img.height);

        // Draw selection outline + resize handles if selected
        if (img.selected) {
          // Compute handle size in canvas pixels relative to display size
          const rect = canvas.getBoundingClientRect();
          const displayScale = rect.width > 0 ? canvas.width / rect.width : 1;
          const hSize = Math.max(16, Math.round(10 * displayScale));
          const outset = Math.max(2, Math.round(2 * displayScale));

          // Dashed selection outline
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = Math.max(2, Math.round(2 * displayScale));
          ctx.setLineDash([Math.round(10 * displayScale), Math.round(5 * displayScale)]);
          ctx.strokeRect(img.x - outset, img.y - outset, img.width + outset * 2, img.height + outset * 2);
          ctx.setLineDash([]);

          // Corner resize handles
          const corners = [
            { x: img.x - outset, y: img.y - outset },
            { x: img.x + img.width + outset, y: img.y - outset },
            { x: img.x - outset, y: img.y + img.height + outset },
            { x: img.x + img.width + outset, y: img.y + img.height + outset },
          ];
          ctx.lineWidth = Math.max(1, Math.round(1.5 * displayScale));
          corners.forEach(corner => {
            ctx.fillStyle = '#10b981';
            ctx.strokeStyle = '#ffffff';
            ctx.fillRect(corner.x - hSize / 2, corner.y - hSize / 2, hSize, hSize);
            ctx.strokeRect(corner.x - hSize / 2, corner.y - hSize / 2, hSize, hSize);
          });
        }
      });
    });

    // Draw area selection if exists
    if (areaSelection && selectionMode === 'area') {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(areaSelection.x, areaSelection.y, areaSelection.width, areaSelection.height);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(areaSelection.x, areaSelection.y, areaSelection.width, areaSelection.height);
      ctx.setLineDash([]);

      // Draw resize handles
      const handleSize = 20;
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      // Corner handles
      const corners = [
        { x: areaSelection.x, y: areaSelection.y }, // TL
        { x: areaSelection.x + areaSelection.width, y: areaSelection.y }, // TR
        { x: areaSelection.x, y: areaSelection.y + areaSelection.height }, // BL
        { x: areaSelection.x + areaSelection.width, y: areaSelection.y + areaSelection.height }, // BR
      ];

      corners.forEach(corner => {
        ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
      });
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't intercept canvas events while rotation handle is active
    if (isRotating) return;

    const point = getCanvasPoint(e);

    // Middle mouse button = Pan (always)
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setLastPos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Check resize handles of selected image first (highest priority)
    // Only images on the currently selected layer can be interacted with.
    const selectedImg = layers.flatMap(l => l.selected && l.visible ? l.images : []).find(img => img.selected);
    if (selectedImg) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const displayScale = rect.width > 0 ? canvas.width / rect.width : 1;
      const hitArea = Math.max(30, Math.round(16 * displayScale));
      const outset = Math.max(2, Math.round(2 * displayScale));

      const corners: { handle: 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number }[] = [
        { handle: 'tl', x: selectedImg.x - outset, y: selectedImg.y - outset },
        { handle: 'tr', x: selectedImg.x + selectedImg.width + outset, y: selectedImg.y - outset },
        { handle: 'bl', x: selectedImg.x - outset, y: selectedImg.y + selectedImg.height + outset },
        { handle: 'br', x: selectedImg.x + selectedImg.width + outset, y: selectedImg.y + selectedImg.height + outset },
      ];

      for (const { handle, x, y } of corners) {
        if (Math.abs(point.x - x) <= hitArea && Math.abs(point.y - y) <= hitArea) {
          const resizeOriginal = { x: selectedImg.x, y: selectedImg.y, width: selectedImg.width, height: selectedImg.height };
          // Set refs immediately (synchronous — not subject to React render batching)
          isResizingImageRef.current = true;
          imageResizeHandleRef.current = handle;
          imageResizeStartRef.current = point;
          imageResizeOriginalRef.current = resizeOriginal;
          resizingImageIdRef.current = selectedImg.id;
          // Also update state for cursor styling / rendering
          setIsResizingImage(true);
          setImageResizeHandle(handle);
          setImageResizeStart(point);
          setImageResizeOriginal(resizeOriginal);
          setSelectedImageId(selectedImg.id);
          return;
        }
      }
    }

    // Area selection mode takes full priority over image drag — images cannot be moved
    // while the area tool is active. This mirrors how selection tools work in Figma/Photoshop.
    if (selectionMode === 'area') {
      if (areaSelection) {
        // Check if clicking on a corner resize handle of the existing selection
        const hitArea = 35;
        const handles = [
          { name: 'tl', x: areaSelection.x, y: areaSelection.y },
          { name: 'tr', x: areaSelection.x + areaSelection.width, y: areaSelection.y },
          { name: 'bl', x: areaSelection.x, y: areaSelection.y + areaSelection.height },
          { name: 'br', x: areaSelection.x + areaSelection.width, y: areaSelection.y + areaSelection.height },
        ];

        for (const handle of handles) {
          if (
            point.x >= handle.x - hitArea &&
            point.x <= handle.x + hitArea &&
            point.y >= handle.y - hitArea &&
            point.y <= handle.y + hitArea
          ) {
            setAreaSelection({
              ...areaSelection,
              isResizing: true,
              resizeHandle: handle.name as 'tl' | 'tr' | 'bl' | 'br'
            });
            setAreaDrawStart(point);
            return;
          }
        }

        // Check if clicking inside the existing area (move it)
        if (
          point.x >= areaSelection.x &&
          point.x <= areaSelection.x + areaSelection.width &&
          point.y >= areaSelection.y &&
          point.y <= areaSelection.y + areaSelection.height
        ) {
          setAreaSelection({
            ...areaSelection,
            isDragging: true,
            resizeHandle: 'move'
          });
          setAreaDrawStart({ x: point.x - areaSelection.x, y: point.y - areaSelection.y });
          return;
        }
      }

      // Default in area mode: start drawing a new selection rectangle
      setIsDrawingArea(true);
      setAreaDrawStart(point);
      setAreaSelection({
        x: point.x,
        y: point.y,
        width: 0,
        height: 0
      });
      return;
    }

    // Check if clicking on an image (for drag) — only when NOT in area selection mode.
    // Only images on the currently selected layer are eligible; clicks on images from
    // other layers fall through to canvas pan, just like clicking empty canvas space.
    let foundImage = false;
    const allImages: Array<{layer: Layer, img: LayerImage}> = [];
    layers.forEach(layer => {
      if (layer.selected && layer.visible) {
        layer.images.forEach(img => {
          allImages.push({ layer, img });
        });
      }
    });
    allImages.reverse();

    for (const {layer, img} of allImages) {
      if (
        point.x >= img.x &&
        point.x <= img.x + img.width &&
        point.y >= img.y &&
        point.y <= img.y + img.height
      ) {
        setSelectedImageId(img.id);
        setLayers(prev => prev.map(l => ({
          ...l,
          images: l.images.map(i => ({...i, selected: i.id === img.id}))
        })));
        setIsDraggingImage(true);
        setDragStart({ x: point.x - img.x, y: point.y - img.y });
        foundImage = true;
        break;
      }
    }

    if (foundImage) return;

    // Default: Pan the canvas (clicking on empty space)
    setSelectedImageId(null);
    setLayers(prev => prev.map(l => ({
      ...l,
      images: l.images.map(i => ({...i, selected: false}))
    })));
    setIsPanning(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // Image resize — read from refs so we never see stale React state
    if (isResizingImageRef.current && resizingImageIdRef.current && imageResizeHandleRef.current) {
      const minSize = 20;
      const snapThreshold = 12; // canvas pixels — snap when within this distance of original size
      const resizingId = resizingImageIdRef.current;
      const resizeHandle = imageResizeHandleRef.current;
      const resizeStart = imageResizeStartRef.current;
      const resizeOriginal = imageResizeOriginalRef.current;
      const dx = point.x - resizeStart.x;
      const dy = point.y - resizeStart.y;
      setLayers(prev => prev.map(layer => ({
        ...layer,
        images: layer.images.map(img => {
          if (img.id !== resizingId) return img;
          let { x, y, width, height } = resizeOriginal;
          switch (resizeHandle) {
            case 'br':
              width = Math.max(minSize, resizeOriginal.width + dx);
              height = Math.max(minSize, resizeOriginal.height + dy);
              break;
            case 'bl':
              width = Math.max(minSize, resizeOriginal.width - dx);
              x = resizeOriginal.x + resizeOriginal.width - width;
              height = Math.max(minSize, resizeOriginal.height + dy);
              break;
            case 'tr':
              width = Math.max(minSize, resizeOriginal.width + dx);
              height = Math.max(minSize, resizeOriginal.height - dy);
              y = resizeOriginal.y + resizeOriginal.height - height;
              break;
            case 'tl':
              width = Math.max(minSize, resizeOriginal.width - dx);
              x = resizeOriginal.x + resizeOriginal.width - width;
              height = Math.max(minSize, resizeOriginal.height - dy);
              y = resizeOriginal.y + resizeOriginal.height - height;
              break;
          }
          // Snap edges to canvas boundaries (like rotation snapping to cardinal angles)
          const canvasEl = canvasRef.current;
          if (canvasEl) {
            const edgeSnap = 80; // canvas pixels — snap when edge is within this distance of canvas boundary
            switch (resizeHandle) {
              case 'br':
                if (Math.abs((x + width) - canvasEl.width) < edgeSnap) width = canvasEl.width - x;
                if (Math.abs((y + height) - canvasEl.height) < edgeSnap) height = canvasEl.height - y;
                break;
              case 'bl':
                if (Math.abs(x) < edgeSnap) { width = width + x; x = 0; }
                if (Math.abs((y + height) - canvasEl.height) < edgeSnap) height = canvasEl.height - y;
                break;
              case 'tr':
                if (Math.abs((x + width) - canvasEl.width) < edgeSnap) width = canvasEl.width - x;
                if (Math.abs(y) < edgeSnap) { height = height + y; y = 0; }
                break;
              case 'tl':
                if (Math.abs(x) < edgeSnap) { width = width + x; x = 0; }
                if (Math.abs(y) < edgeSnap) { height = height + y; y = 0; }
                break;
            }
          }
          // Snap back to original size when close enough (like rotation snapping to cardinal angles)
          if (Math.abs(width - resizeOriginal.width) < snapThreshold && Math.abs(height - resizeOriginal.height) < snapThreshold) {
            width = resizeOriginal.width;
            height = resizeOriginal.height;
            x = resizeOriginal.x;
            y = resizeOriginal.y;
          }
          return { ...img, x, y, width, height };
        })
      })));
      return;
    }

    // Panning
    if (isPanning) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
      setLastPos({ x: e.clientX, y: e.clientY });
      return;
    }

    // Area selection drawing
    if (isDrawingArea && areaSelection) {
      const width = point.x - areaDrawStart.x;
      const height = point.y - areaDrawStart.y;

      setAreaSelection({
        x: width >= 0 ? areaDrawStart.x : point.x,
        y: height >= 0 ? areaDrawStart.y : point.y,
        width: Math.abs(width),
        height: Math.abs(height)
      });
      return;
    }

    // Area selection moving
    if (areaSelection?.isDragging && areaSelection.resizeHandle === 'move') {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const newX = Math.max(0, Math.min(point.x - areaDrawStart.x, canvas.width - areaSelection.width));
      const newY = Math.max(0, Math.min(point.y - areaDrawStart.y, canvas.height - areaSelection.height));

      setAreaSelection({
        ...areaSelection,
        x: newX,
        y: newY
      });
      return;
    }

    // Area selection resizing
    if (areaSelection?.isResizing) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let newX = areaSelection.x;
      let newY = areaSelection.y;
      let newWidth = areaSelection.width;
      let newHeight = areaSelection.height;

      switch (areaSelection.resizeHandle) {
        case 'br': // Bottom-right
          newWidth = Math.max(50, Math.min(point.x - areaSelection.x, canvas.width - areaSelection.x));
          newHeight = Math.max(50, Math.min(point.y - areaSelection.y, canvas.height - areaSelection.y));
          break;
        case 'bl': // Bottom-left
          newWidth = Math.max(50, areaSelection.x + areaSelection.width - point.x);
          newHeight = Math.max(50, Math.min(point.y - areaSelection.y, canvas.height - areaSelection.y));
          newX = areaSelection.x + areaSelection.width - newWidth;
          break;
        case 'tr': // Top-right
          newWidth = Math.max(50, Math.min(point.x - areaSelection.x, canvas.width - areaSelection.x));
          newHeight = Math.max(50, areaSelection.y + areaSelection.height - point.y);
          newY = areaSelection.y + areaSelection.height - newHeight;
          break;
        case 'tl': // Top-left
          newWidth = Math.max(50, areaSelection.x + areaSelection.width - point.x);
          newHeight = Math.max(50, areaSelection.y + areaSelection.height - point.y);
          newX = areaSelection.x + areaSelection.width - newWidth;
          newY = areaSelection.y + areaSelection.height - newHeight;
          break;
      }

      setAreaSelection({
        ...areaSelection,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      });
      return;
    }

    // Layer image dragging
    if (isDraggingImage && selectedImageId) {
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

    // Update hover state for resize handle cursor
    if (!isPanning && !isDrawingArea) {
      const hoveredImg = layers.flatMap(l => l.visible ? l.images : []).find(img => img.selected);
      if (hoveredImg) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const displayScale = rect.width > 0 ? canvas.width / rect.width : 1;
          const hitArea = Math.max(30, Math.round(16 * displayScale));
          const outset = Math.max(2, Math.round(2 * displayScale));
          const corners: { handle: 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number }[] = [
            { handle: 'tl', x: hoveredImg.x - outset, y: hoveredImg.y - outset },
            { handle: 'tr', x: hoveredImg.x + hoveredImg.width + outset, y: hoveredImg.y - outset },
            { handle: 'bl', x: hoveredImg.x - outset, y: hoveredImg.y + hoveredImg.height + outset },
            { handle: 'br', x: hoveredImg.x + hoveredImg.width + outset, y: hoveredImg.y + hoveredImg.height + outset },
          ];
          let found: 'tl' | 'tr' | 'bl' | 'br' | null = null;
          for (const { handle, x, y } of corners) {
            if (Math.abs(point.x - x) <= hitArea && Math.abs(point.y - y) <= hitArea) {
              found = handle;
              break;
            }
          }
          if (found !== hoveredResizeHandle) setHoveredResizeHandle(found);
        }
      } else if (hoveredResizeHandle !== null) {
        setHoveredResizeHandle(null);
      }
    }
  };

  const handleMouseUp = () => {
    const wasDrawingArea = isDrawingArea;
    setIsDraggingImage(false);
    setIsDrawingArea(false);
    setIsPanning(false);
    setIsResizingImage(false);
    setImageResizeHandle(null);
    // Clear refs immediately so next mousemove doesn't see stale resize state
    isResizingImageRef.current = false;
    imageResizeHandleRef.current = null;
    resizingImageIdRef.current = null;
    // Note: isRotating is managed by the global window listener, not here

    // Clear dragging/resizing flags
    if (areaSelection) {
      setAreaSelection({
        ...areaSelection,
        isDragging: false,
        isResizing: false,
        resizeHandle: undefined
      });
    }

    // Capture area preview after drawing or resizing/moving
    if (selectionMode === 'area' && areaSelection && areaSelection.width > 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(1, Math.round(areaSelection.width));
        tempCanvas.height = Math.max(1, Math.round(areaSelection.height));
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, areaSelection.x, areaSelection.y, areaSelection.width, areaSelection.height, 0, 0, tempCanvas.width, tempCanvas.height);
          setAreaPreviewSrc(tempCanvas.toDataURL('image/jpeg', 0.85));
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selectedLayer = layers.find(l => l.selected) || layers[0];

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

          setLayers(prev =>
            prev.map(layer =>
              layer.id === selectedLayer.id
                ? { ...layer, images: [...layer.images, newImage] }
                : layer
            )
          );

          renderCanvas();
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const generateAIImage = async () => {
    if (!aiPrompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsGenerating(true);

    try {
      // Determine generation target (where output gets placed on canvas)
      let targetX = 0, targetY = 0, targetWidth = canvas.width, targetHeight = canvas.height;
      if (selectionMode === 'area' && areaSelection && areaSelection.width > 0) {
        targetX = areaSelection.x;
        targetY = areaSelection.y;
        targetWidth = areaSelection.width;
        targetHeight = areaSelection.height;
      }

      // Collect active reference images (max 8)
      const activeRefs: string[] = [];
      if (canvasRefActive) {
        activeRefs.push(canvas.toDataURL('image/png'));
      }
      referenceImages
        .filter(r => r.active)
        .slice(0, 8 - activeRefs.length)
        .forEach(r => activeRefs.push(r.src));

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          model: selectedAIModel,
          userId: user.id,
          quality: genQuality,
          aspectRatio: genAspectRatio,
          referenceImages: activeRefs.length > 0 ? activeRefs : undefined,
          // syncMode: wait for FAL.ai and return imageUrl directly.
          // Without this, FAL models return a queueId instead of an imageUrl.
          syncMode: true,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setTicketBalance(data.newBalance);

      // Load generated image and place at target position on the selected layer
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const selectedLayer = layers.find(l => l.selected) || layers[0];
        const newImage: LayerImage = {
          id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          image: img,
          x: targetX,
          y: targetY,
          width: targetWidth,
          height: targetHeight,
          selected: false,
        };
        // Compute the full updated layers array synchronously so we can
        // pass it directly to saveCanvas — avoids stale-closure issues with
        // the 2-second auto-save debounce reading old state.
        const updatedLayers = layers.map(layer =>
          layer.id === selectedLayer.id
            ? { ...layer, images: [...layer.images, newImage] }
            : layer
        );
        setLayers(updatedLayers);
        saveCanvas(updatedLayers);
      };
      img.src = data.imageUrl;

    } catch (error: any) {
      console.error('Generation error:', error);
      alert(error.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const addNewLayer = () => {
    // Check layer limit
    if (layers.length >= 35) {
      alert('Maximum layer limit reached! You can have up to 35 layers per session.');
      return;
    }

    const newLayerNumber = layers.length + 1;
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${newLayerNumber}`,
      images: [],
      selected: false,
      visible: true,
    };
    setLayers(prev => [...prev, newLayer]);
  };

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prev =>
      prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l)
    );
  };

  const selectLayer = (layerId: string) => {
    setLayers(prev =>
      prev.map(l => ({
        ...l,
        selected: l.id === layerId,
        images: l.images.map(img => ({ ...img, selected: false }))
      }))
    );
    setSelectedImageId(null);
  };

  const deleteLayer = (layerId: string) => {
    if (layers.length === 1) {
      alert("Cannot delete the last layer");
      return;
    }
    setLayers(prev => {
      const filtered = prev.filter(l => l.id !== layerId);
      if (prev.find(l => l.id === layerId)?.selected) {
        return filtered.map((l, i) => ({ ...l, selected: i === 0 }));
      }
      return filtered;
    });
  };

  const moveLayerUp = (index: number) => {
    if (index >= layers.length - 1) return;
    const newLayers = [...layers];
    [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    setLayers(newLayers);
  };

  const moveLayerDown = (index: number) => {
    if (index <= 0) return;
    const newLayers = [...layers];
    [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
    setLayers(newLayers);
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `composition-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (referenceImages.length >= 50) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        if (!src) return;
        const activeCount = referenceImages.filter(r => r.active).length + (canvasRefActive ? 1 : 0);
        const newRef: ReferenceImage = {
          id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          src,
          label: file.name.replace(/\.[^/.]+$/, ''),
          active: activeCount < 8,
          type: 'area',
          createdAt: Date.now(),
        };
        setReferenceImages(prev => prev.length >= 50 ? prev : [...prev, newRef]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const captureAreaAsReference = () => {
    const canvas = canvasRef.current;
    if (!canvas || !areaSelection || areaSelection.width === 0) return;

    if (referenceImages.length >= 50) {
      alert('Maximum 50 reference images stored. Delete some to add more.');
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.max(1, Math.round(areaSelection.width));
    tempCanvas.height = Math.max(1, Math.round(areaSelection.height));
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, areaSelection.x, areaSelection.y, areaSelection.width, areaSelection.height, 0, 0, tempCanvas.width, tempCanvas.height);
    const src = tempCanvas.toDataURL('image/jpeg', 0.85);

    const activeCount = referenceImages.filter(r => r.active).length + (canvasRefActive ? 1 : 0);
    const newRef: ReferenceImage = {
      id: `ref-${Date.now()}`,
      src,
      label: `Area ${referenceImages.length + 1}`,
      active: activeCount < 8,
      type: 'area',
      createdAt: Date.now(),
    };
    setReferenceImages(prev => [...prev, newRef]);
    // Auto-clear the area selection after saving
    setAreaSelection(null);
    setAreaPreviewSrc(null);
    setSelectionMode('full');
  };

  const toggleReferenceActive = (id: string) => {
    const activeCount = referenceImages.filter(r => r.active).length + (canvasRefActive ? 1 : 0);
    setReferenceImages(prev => prev.map(ref => {
      if (ref.id !== id) return ref;
      if (!ref.active && activeCount >= 8) {
        alert('Maximum 8 reference images can be active at once.');
        return ref;
      }
      return { ...ref, active: !ref.active };
    }));
  };

  const deleteReference = (id: string) => {
    setReferenceImages(prev => prev.filter(r => r.id !== id));
  };

  const saveSession = () => {
    if (!sessionName.trim()) {
      alert('Please enter a session name');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const session: SavedSession = {
      id: `session-${Date.now()}`,
      name: sessionName.trim(),
      timestamp: Date.now(),
      canvasSize: selectedSize,
      layers: layers.map(layer => ({
        id: layer.id,
        name: layer.name,
        selected: layer.selected,
        images: layer.images.map(img => ({
          id: img.id,
          src: canvas.toDataURL(), // Simplified - in production, save each image
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
          selected: img.selected
        }))
      })),
      gridRows,
      gridCols
    };

    const updatedSessions = [...sessions, session];
    setSessions(updatedSessions);
    localStorage.setItem('compositionSessions', JSON.stringify(updatedSessions));

    setShowSaveDialog(false);
    setSessionName('');
    alert('Session saved successfully!');
  };

  const deleteSession = (id: string) => {
    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    localStorage.setItem('compositionSessions', JSON.stringify(updatedSessions));
  };

  const loadSession = (session: SavedSession) => {
    setSelectedSize(session.canvasSize);
    setLayers(session.layers);
    setGridRows(session.gridRows);
    setGridCols(session.gridCols);
    setShowSessionsPanel(false);
  };

  // Canvas management functions
  const loadCanvases = async () => {
    try {
      const res = await fetch('/api/composition-canvas');
      const data = await res.json();
      if (data.success) {
        setCanvasList(data.canvases || []);
      } else {
        console.error('loadCanvases API error:', data.error);
      }
    } catch (error) {
      console.error('Failed to load canvases:', error);
    }
  };

  const createCanvas = async (canvasSize: CanvasSize) => {
    try {
      console.log('Creating canvas with size:', canvasSize);
      const res = await fetch('/api/composition-canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Canvas ${new Date().toLocaleDateString()}`,
          aspectRatio: canvasSize.aspectRatio,
          canvasWidth: canvasSize.width,
          canvasHeight: canvasSize.height
        })
      });

      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);

      if (data.success) {
        setCurrentCanvasId(data.canvas.id);
        setSelectedSize(canvasSize);

        // Initialize with empty layer since new canvas has no images
        const initialLayers: Layer[] = [{
          id: `layer-${Date.now()}`,
          name: 'Layer 1',
          images: [],
          selected: true,
          visible: true
        }];
        setLayers(initialLayers);

        setPanOffset(data.canvas.panOffset);
        setZoom(data.canvas.zoom);
        setRotation(data.canvas.rotation);
        setGridRows(data.canvas.gridRows);
        setGridCols(data.canvas.gridCols);
        setCanvasInitialized(true);
        setViewState('editor');
        setShowAspectRatioModal(false);
        console.log('Canvas created successfully, switching to editor view');
        await loadCanvases();
      } else {
        console.error('API returned success: false', data);
        alert('Failed to create canvas: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create canvas:', error);
      alert('Failed to create canvas: ' + error);
    }
  };

  const loadCanvas = async (canvasId: number) => {
    setIsLoadingCanvas(true);
    try {
      const res = await fetch(`/api/composition-canvas/${canvasId}`);
      const data = await res.json();
      if (data.success) {
        const canvas = data.canvas;
        setCurrentCanvasId(canvas.id);

        // Find matching canvas size or build a custom one from stored dimensions
        const matchingSize = CANVAS_SIZES.find(s => s.aspectRatio === canvas.aspectRatio);
        if (matchingSize) {
          setSelectedSize(matchingSize);
        } else if (canvas.canvasWidth && canvas.canvasHeight) {
          setSelectedSize({
            name: canvas.aspectRatio || 'Custom',
            aspectRatio: canvas.aspectRatio,
            width: canvas.canvasWidth,
            height: canvas.canvasHeight
          });
        }

        // Deserialize layers with images
        const deserializedLayers = await deserializeLayers(canvas.layers || []);
        setLayers(deserializedLayers);

        setPanOffset(canvas.panOffset || { x: 0, y: 0 });
        setZoom(canvas.zoom ?? 1);
        setRotation(canvas.rotation ?? 0);
        setGridRows(canvas.gridRows ?? 3);
        setGridCols(canvas.gridCols ?? 3);
        setCanvasInitialized(true);
        setViewState('editor');
      } else {
        console.error('Failed to load canvas:', data.error);
        alert('Failed to load canvas: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to load canvas:', error);
      alert('Failed to load canvas. Please try again.');
    } finally {
      setIsLoadingCanvas(false);
    }
  };

  const saveCanvas = async (layersOverride?: Layer[]) => {
    if (!currentCanvasId) return;
    setIsSavingCanvas(true);
    try {
      // Serialize layers for storage — use override when called directly with fresh layers
      // (e.g. right after AI generation, to avoid stale-closure issues with the debounce timer)
      const serializedLayers = await serializeLayers(layersOverride ?? layers);

      // Generate thumbnail
      const thumbnail = generateThumbnail();

      const res = await fetch(`/api/composition-canvas/${currentCanvasId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layers: serializedLayers,
          panOffset,
          zoom,
          rotation,
          gridRows,
          gridCols,
          thumbnail
        })
      });
      const data = await res.json();
      if (data.success) {
        setLastSavedAt(new Date());
        await loadCanvases();
      }
    } catch (error) {
      console.error('Failed to save canvas:', error);
    } finally {
      setIsSavingCanvas(false);
    }
  };

  const deleteCanvas = async (canvasId: number) => {
    if (!confirm('Delete this canvas? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/composition-canvas/${canvasId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        await loadCanvases();
        if (currentCanvasId === canvasId) {
          setViewState('gallery');
          setCanvasInitialized(false);
          setCurrentCanvasId(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete canvas:', error);
      alert('Failed to delete canvas');
    }
  };

  const generateThumbnail = (): string | null => {
    if (!canvasRef.current) return null;
    try {
      // Create a smaller version for thumbnail
      const thumbnailCanvas = document.createElement('canvas');
      thumbnailCanvas.width = 400;
      thumbnailCanvas.height = 400;
      const ctx = thumbnailCanvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(canvasRef.current, 0, 0, 400, 400);
      return thumbnailCanvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return null;
    }
  };

  const serializeLayers = async (layers: Layer[]): Promise<any[]> => {
    // Compress each image to JPEG before storing to stay within Prisma's 5MB response limit.
    // Images are downscaled to at most 800px on the longest side at 75% JPEG quality.
    const compressImage = (img: HTMLImageElement): string => {
      // If already a small data URL or an external URL, keep as-is
      if (!img.src.startsWith('data:') || img.src.length < 50000) return img.src;
      const MAX_DIM = 800;
      const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.round((img.naturalWidth || img.width) * scale);
      offscreen.height = Math.round((img.naturalHeight || img.height) * scale);
      const ctx = offscreen.getContext('2d');
      if (!ctx) return img.src;
      ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
      return offscreen.toDataURL('image/jpeg', 0.75);
    };

    return layers.map(layer => ({
      ...layer,
      images: layer.images.map(img => ({
        id: img.id,
        src: compressImage(img.image),
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
        selected: img.selected
      }))
    }));
  };

  const deserializeLayers = async (serializedLayers: any[]): Promise<Layer[]> => {
    // Convert serialized layers back to Layer objects with HTMLImageElement
    const layers: Layer[] = [];

    for (const layer of serializedLayers) {
      const images: LayerImage[] = [];

      for (const imgData of layer.images) {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = imgData.src; // Set src AFTER listeners to avoid race condition with cached/data URLs
        });

        images.push({
          id: imgData.id,
          image: img,
          x: imgData.x,
          y: imgData.y,
          width: imgData.width,
          height: imgData.height,
          selected: imgData.selected
        });
      }

      layers.push({
        id: layer.id,
        name: layer.name,
        images,
        selected: layer.selected,
        visible: layer.visible
      });
    }

    return layers;
  };

  // Auto-save with 2-second debounce whenever canvas state changes
  useEffect(() => {
    if (viewState !== 'editor' || !currentCanvasId || !canvasInitialized) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveCanvas();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [layers, panOffset, zoom, rotation, gridRows, gridCols, viewState, currentCanvasId, canvasInitialized]);

  const activeRefCount = referenceImages.filter(r => r.active).length + (canvasRefActive ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-purple-400 text-xl font-mono">Loading...</div>
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
      <div className="fixed inset-0 bg-[linear-gradient(rgba(168,85,247,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 border-b border-purple-500/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={async () => {
                if (viewState === 'editor') {
                  await saveCanvas();
                  setViewState('gallery');
                  setCanvasInitialized(false);
                  setCurrentCanvasId(null);
                  setLastSavedAt(null);
                  await loadCanvases();
                } else {
                  router.push('/dashboard');
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 h-9 px-3"
            >
              <ArrowLeft size={16} className="mr-1" />
              {viewState === 'editor' ? 'My Canvases' : 'Dashboard'}
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="text-purple-400" size={24} />
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                AI Composition Canvas
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Auto-save status */}
            {viewState === 'editor' && (
              <div className="text-xs text-slate-500 min-w-[90px] text-right">
                {isSavingCanvas ? (
                  <span className="text-purple-400 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    Saving...
                  </span>
                ) : lastSavedAt ? (
                  <span className="text-emerald-500">✓ Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                ) : null}
              </div>
            )}

            {/* Manual Save button (editor only) */}
            {viewState === 'editor' && (
              <button
                onClick={() => saveCanvas()}
                disabled={isSavingCanvas}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 transition-all text-sm font-semibold disabled:opacity-50"
                title="Save Canvas"
              >
                <Save size={16} />
                Save
              </button>
            )}

            <div className="flex items-center gap-2 text-yellow-400 font-bold">
              <Ticket size={18} />
              {ticketBalance} tickets
            </div>
            <Link href="/dashboard">
              <Button className="bg-slate-700 hover:bg-slate-600 h-9 text-sm">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 h-[calc(100vh-70px)]">
        <div className="flex h-full">
          {/* Canvas Area */}
          <div className="flex-1 flex items-center justify-center bg-slate-950/50 overflow-hidden relative">
            {/* Area Selection Mode Hint */}
            {viewState === 'editor' && selectionMode === 'area' && (!areaSelection || areaSelection.width === 0) && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                <div className="bg-purple-900/90 backdrop-blur-sm border-2 border-purple-500/50 rounded-xl px-6 py-4 text-center">
                  <Square className="mx-auto text-purple-400 mb-2" size={32} />
                  <p className="text-white font-bold mb-1">Area Selection Mode</p>
                  <p className="text-xs text-slate-300">Click and drag to draw selection area</p>
                </div>
              </div>
            )}


            {/* Gallery View - Default */}
            {viewState === 'gallery' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm z-40 overflow-y-auto">
                <div className="w-full max-w-7xl px-8 py-12">
                  <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-3">
                      My Canvases
                    </h2>
                    <p className="text-slate-400">Select a canvas to edit or create a new one</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {/* Add New Canvas Card */}
                    <button
                      onClick={() => setShowAspectRatioModal(true)}
                      className="group relative aspect-square border-4 border-dashed border-purple-500/30 rounded-xl bg-slate-900/50 hover:border-purple-400 hover:bg-slate-800/50 transition-all flex items-center justify-center"
                    >
                      <div className="text-center">
                        <Plus className="mx-auto text-purple-400 group-hover:text-purple-300 mb-3" size={48} />
                        <p className="text-white font-bold text-lg group-hover:text-purple-400 transition-colors">
                          New Canvas
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Create composition</p>
                      </div>
                    </button>

                    {/* Existing Canvases */}
                    {canvasList.map((canvas) => (
                      <div
                        key={canvas.id}
                        className={`group relative aspect-square border-2 border-purple-500/30 rounded-xl bg-slate-900 hover:border-purple-400 transition-all overflow-hidden ${isLoadingCanvas ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
                        onClick={() => { if (!isLoadingCanvas) loadCanvas(canvas.id); }}
                      >
                        {/* Thumbnail */}
                        {canvas.thumbnail ? (
                          <img
                            src={canvas.thumbnail}
                            alt={canvas.name || 'Canvas'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-pink-900/20 flex items-center justify-center">
                            <Layers className="text-purple-400/50" size={64} />
                          </div>
                        )}

                        {/* Loading overlay */}
                        {isLoadingCanvas && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                          </div>
                        )}

                        {/* Overlay with info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <p className="text-white font-bold text-sm truncate mb-1">
                              {canvas.name || 'Untitled'}
                            </p>
                            <p className="text-xs text-slate-300">
                              {canvas.aspectRatio} • {new Date(canvas.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLoadingCanvas) deleteCanvas(canvas.id);
                          }}
                          className="absolute top-2 right-2 p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete canvas"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {canvasList.length === 0 && (
                    <div className="text-center mt-12 text-slate-400">
                      <Layers className="mx-auto mb-4 text-slate-600" size={64} />
                      <p className="text-lg mb-2">No canvases yet</p>
                      <p className="text-sm">Click the "New Canvas" button to create your first composition</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Aspect Ratio Selection Modal */}
            {showAspectRatioModal && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
                <div className="bg-slate-900 rounded-2xl border-2 border-purple-500/50 p-8 max-w-5xl">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                      Choose Canvas Size
                    </h2>
                    <button
                      onClick={() => setShowAspectRatioModal(false)}
                      className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <p className="text-slate-400 mb-8 text-center">Select an aspect ratio for your new canvas</p>

                  <div className="flex gap-8 justify-center flex-wrap">
                    {CANVAS_SIZES.map((size) => {
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
                          onClick={() => createCanvas(size)}
                          className="group relative"
                        >
                          <div
                            className="border-4 border-purple-500/30 rounded-lg bg-white hover:border-purple-400 hover:bg-slate-50 transition-all shadow-lg hover:shadow-purple-500/20"
                            style={{
                              width: `${previewWidth}px`,
                              height: `${previewHeight}px`
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-4xl font-black text-purple-600 mb-2">
                                  {size.aspectRatio}
                                </div>
                                <div className="text-xs text-slate-600 font-semibold">
                                  {size.width} × {size.height}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 text-white font-bold group-hover:text-purple-400 transition-colors">
                            {size.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Floating Zoom Controls */}
            {viewState === 'editor' && (
              <div className="absolute left-4 bottom-4 flex flex-col gap-2 z-40">
                <button
                  onClick={() => setZoom(Math.min(zoom + 0.25, 5))}
                  disabled={zoom >= 5}
                  className="p-3 rounded-lg bg-slate-900/95 backdrop-blur-sm hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-purple-500/30 shadow-xl"
                  title="Zoom In"
                >
                  <ZoomIn size={20} className="text-white" />
                </button>

                <button
                  onClick={() => setZoom(Math.max(zoom - 0.25, 0.1))}
                  disabled={zoom <= 0.1}
                  className="p-3 rounded-lg bg-slate-900/95 backdrop-blur-sm hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-purple-500/30 shadow-xl"
                  title="Zoom Out"
                >
                  <ZoomOut size={20} className="text-white" />
                </button>

                {/* Zoom Level Indicator */}
                <div className="px-3 py-2 rounded-lg bg-slate-900/95 backdrop-blur-sm border border-purple-500/30 shadow-xl text-center">
                  <div className="text-xs text-purple-400 font-bold">
                    {Math.round(zoom * 100)}%
                  </div>
                </div>

                {/* Rotation Indicator */}
                {rotation !== 0 && (
                  <div className="px-3 py-2 rounded-lg bg-slate-900/95 backdrop-blur-sm border border-purple-500/30 shadow-xl text-center">
                    <div className="text-xs text-pink-400 font-bold">
                      {Math.round(rotation)}°
                    </div>
                  </div>
                )}

                {/* Reset View Button */}
                <button
                  onClick={() => {
                    setZoom(1);
                    setPanOffset({ x: 0, y: 0 });
                    setRotation(0);
                  }}
                  className="p-3 rounded-lg bg-slate-900/95 backdrop-blur-sm hover:bg-slate-800 transition-all border border-purple-500/30 shadow-xl"
                  title="Reset View (Zoom, Pan, Rotation)"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-purple-400"
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="1"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Layers Panel - Only show in editor */}
            {viewState === 'editor' && (
              <>
                {/* Collapsed Layers Button */}
                {!showLayersPanel && (
                  <button
                    onClick={() => setShowLayersPanel(true)}
                    className="absolute left-4 top-4 px-4 py-2 rounded-lg bg-slate-900/95 backdrop-blur-sm border-2 border-purple-500/50 hover:border-purple-400 shadow-xl z-50 transition-all group"
                    title="Show Layers Panel"
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={18} className="text-purple-400 group-hover:text-purple-300" />
                      <span className="text-sm font-bold text-white">Layers ({layers.length}/35)</span>
                    </div>
                  </button>
                )}

                {/* Expanded Layers Panel */}
                {showLayersPanel && (
                  <div className="absolute left-4 top-4 w-80 bg-slate-900/95 backdrop-blur-sm border-2 border-purple-500/50 rounded-xl shadow-2xl z-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                        <Layers size={16} />
                        Layers ({layers.length}/35)
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={addNewLayer}
                          disabled={layers.length >= 35}
                          className={`text-xs px-2 py-1 rounded transition-all ${
                            layers.length >= 35
                              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                              : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300'
                          }`}
                          title={layers.length >= 35 ? "Maximum 35 layers reached" : "Add new layer"}
                        >
                          + Add
                        </button>
                        <button
                          onClick={() => setShowLayersPanel(false)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                          title="Collapse panel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Layers list with max 3 visible, then scroll */}
                    <div className="space-y-2 overflow-y-auto" style={{ maxHeight: layers.length > 3 ? '280px' : 'auto' }}>
                      {[...layers].reverse().map((layer, displayIndex) => {
                        const actualIndex = layers.length - 1 - displayIndex;
                        return (
                          <div
                            key={layer.id}
                            onClick={() => selectLayer(layer.id)}
                            className={`p-3 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-all ${
                              layer.selected
                                ? 'bg-purple-500/20 border-2 border-purple-500/50 ring-2 ring-purple-400/30'
                                : 'bg-slate-800 border-2 border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveLayerUp(actualIndex);
                                }}
                                disabled={actualIndex === layers.length - 1}
                                className="p-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move layer up"
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
                                title="Move layer down"
                              >
                                <ChevronDown size={12} className="text-white" />
                              </button>
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-bold">{layer.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {layer.images.length} image{layer.images.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLayerVisibility(layer.id);
                              }}
                              className={`p-1 rounded transition-all ${
                                layer.visible
                                  ? 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400'
                                  : 'bg-slate-700/50 hover:bg-slate-700 text-slate-500'
                              }`}
                              title={layer.visible ? "Hide layer" : "Show layer"}
                            >
                              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLayer(layer.id);
                              }}
                              className="p-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300"
                              title="Delete layer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {layers.length > 3 && (
                      <p className="text-[10px] text-slate-500 mt-2 text-center">
                        Scroll to see all {layers.length} layers
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Sessions Panel */}
            {showSessionsPanel && (
              <div className="absolute right-4 top-4 w-80 bg-slate-900/95 backdrop-blur-sm border-2 border-purple-500/50 rounded-xl shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                    <FolderOpen size={16} />
                    Saved Sessions ({sessions.length})
                  </h3>
                  <button
                    onClick={() => setShowSessionsPanel(false)}
                    className="p-1 rounded hover:bg-slate-800"
                  >
                    <X size={16} className="text-slate-400" />
                  </button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No saved sessions yet</p>
                  ) : (
                    sessions.map(session => (
                      <div
                        key={session.id}
                        className="p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-purple-500/50 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-white text-sm">{session.name}</div>
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="p-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400"
                            title="Delete session"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 mb-2">
                          {new Date(session.timestamp).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 mb-2">
                          {session.canvasSize.name} • {session.layers.length} layers
                        </div>
                        <button
                          onClick={() => loadSession(session)}
                          className="w-full px-3 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-xs font-bold"
                        >
                          Load Session
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Save Dialog */}
            {showSaveDialog && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 rounded-2xl border-2 border-purple-500/50 p-6 max-w-md w-full">
                  <h3 className="text-xl font-bold text-purple-400 mb-4">Save Session</h3>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Enter session name..."
                    className="w-full bg-slate-950 border border-purple-500/30 rounded px-3 py-2 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveSession}
                      className="flex-1 px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowSaveDialog(false);
                        setSessionName('');
                      }}
                      className="flex-1 px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div
              className="relative"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isPanning || isRotating ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              {/* Rotation Handle */}
              {viewState === 'editor' && (
                <div
                  className="absolute -top-20 left-1/2 transform -translate-x-1/2 cursor-grab active:cursor-grabbing z-50"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsRotating(true);
                    setLastPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseUp={() => setIsRotating(false)}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsRotating(true);
                  }}
                  title="Drag to rotate canvas"
                >
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-4 border-white shadow-xl flex items-center justify-center transition-transform ${
                    isRotating ? 'scale-110' : 'scale-100'
                  }`}>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                  </div>
                  {/* Handle line connecting to canvas */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-1 h-12 bg-gradient-to-b from-purple-500 to-transparent"></div>

                  {/* Snap indicators */}
                  {isRotating && (
                    <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                      <div className="px-3 py-1 rounded-lg bg-slate-900/95 backdrop-blur-sm border border-purple-500/50 shadow-xl">
                        <div className="text-xs text-purple-400 font-bold">
                          {Math.round(rotation)}°
                          {[0, 90, 180, 270].some(snap => Math.abs(rotation - snap) < 5) && (
                            <span className="ml-2 text-pink-400">⚡ Snapped</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Canvas Element - Only in editor view */}
              {viewState === 'editor' && (
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    // Don't stop rotation when cursor leaves canvas — rotation uses global listeners
                    if (!isRotating) handleMouseUp();
                  }}
                  className={`border-2 border-purple-500/30 shadow-2xl ${
                    isResizingImage
                      ? (imageResizeHandle === 'tl' || imageResizeHandle === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize')
                      : hoveredResizeHandle
                        ? (hoveredResizeHandle === 'tl' || hoveredResizeHandle === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize')
                        : isPanning || isDraggingImage ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '90vw',
                    maxHeight: '80vh',
                    backgroundColor: '#FFFFFF',
                    touchAction: 'none', // prevent browser native pinch-zoom on iOS/iPadOS
                  }}
                />
              )}
            </div>
          </div>

          {/* Right Panel - AI Generation - Only in editor view */}
          {viewState === 'editor' && (
            <div className="w-80 bg-slate-900/90 backdrop-blur-sm border-l border-purple-500/20 p-4 overflow-y-auto flex flex-col gap-4">
              <h2 className="text-lg font-bold text-purple-400">AI Generation</h2>

              {/* Model Dropdown */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-semibold">AI Model</label>
                <select
                  value={selectedAIModel}
                  onChange={(e) => setSelectedAIModel(e.target.value as AIModel)}
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                >
                  <option value="gemini-3-pro-image">Pro Scanner v3</option>
                  <option value="nano-banana-pro">Nano Banana Pro</option>
                  <option value="seedream-4.5">SeeDream 4.5</option>
                </select>
              </div>

              {/* Quality + Aspect Ratio */}
              <div className="grid grid-cols-2 gap-3">
                {/* Quality */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">
                    Resolution
                    {(selectedAIModel === 'nano-banana-pro' || selectedAIModel === 'gemini-3-pro-image') && (
                      <span className="text-yellow-400"> (4K = 2×)</span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['2k', '4k'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setGenQuality(q)}
                        disabled={isGenerating}
                        className={`py-1.5 rounded-lg font-bold uppercase text-xs transition-all ${
                          genQuality === q
                            ? 'bg-cyan-500 text-black'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Dimensions</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['1:1', '4:5', '9:16', '16:9'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setGenAspectRatio(ratio)}
                        disabled={isGenerating}
                        className={`py-1.5 rounded-lg font-bold text-xs transition-all ${
                          genAspectRatio === ratio
                            ? 'bg-fuchsia-500 text-black'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {ratio === '1:1' ? 'Square' : ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mini Screen — Generation Base Preview */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-purple-500/30">
                <h3 className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-1.5">
                  <Eye size={12} />
                  Generation Base
                </h3>
                <div className="rounded overflow-hidden border border-slate-700 bg-slate-900" style={{ minHeight: '80px' }}>
                  {selectionMode === 'area' && areaPreviewSrc ? (
                    <img
                      src={areaPreviewSrc}
                      alt="Area selection preview"
                      className="w-full object-contain"
                      style={{ maxHeight: '140px', backgroundColor: '#0f172a' }}
                    />
                  ) : canvasPreviewSrc ? (
                    <img
                      src={canvasPreviewSrc}
                      alt="Canvas preview"
                      className="w-full object-contain"
                      style={{ maxHeight: '140px', backgroundColor: '#0f172a' }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-20 text-xs text-slate-500">
                      Canvas preview
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {selectionMode === 'area' && areaSelection && areaSelection.width > 0
                    ? `Area: ${Math.round(areaSelection.width)}×${Math.round(areaSelection.height)}px (generation target)`
                    : `Full Canvas: ${selectedSize.width}×${selectedSize.height} (generation target)`}
                </p>
                <div className="flex gap-2 mt-2">
                  <label className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-all flex items-center justify-center gap-2 text-xs font-semibold text-white">
                    <Upload size={14} />
                    Upload
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  </label>
                  <button
                    onClick={downloadCanvas}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 text-xs font-semibold text-white"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>

              {/* Area Selection */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-purple-500/20">
                <h3 className="text-xs font-bold text-purple-400 mb-2">Area Selection</h3>
                {areaSelection && areaSelection.width > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-emerald-400 font-bold">
                      ✓ {Math.round(areaSelection.width)}×{Math.round(areaSelection.height)}px selected
                    </p>
                    <p className="text-[10px] text-slate-400">Drag corners to resize • This is now the generation target</p>
                    <div className="flex gap-2">
                      <button
                        onClick={captureAreaAsReference}
                        className="flex-1 px-2 py-1.5 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-xs font-bold transition-all"
                      >
                        + Save as Reference
                      </button>
                      <button
                        onClick={() => { setAreaSelection(null); setAreaPreviewSrc(null); setSelectionMode('full'); }}
                        className="px-2 py-1.5 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => setSelectionMode(selectionMode === 'area' ? 'full' : 'area')}
                      className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        selectionMode === 'area'
                          ? 'bg-purple-600/40 text-purple-300 ring-1 ring-purple-400'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {selectionMode === 'area' ? '✓ Area Mode — Hold Shift + Drag' : 'Enable Area Mode'}
                    </button>
                    {selectionMode === 'area' && (
                      <p className="text-[10px] text-slate-500 mt-1.5 text-center">Hold Shift and drag on the canvas</p>
                    )}
                  </div>
                )}
              </div>

              {/* Reference Images */}
              <div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setShowReferencePanel(!showReferencePanel)}
                    className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-all border border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-purple-400" />
                      Reference Images
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      activeRefCount >= 8 ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-300'
                    }`}>
                      {activeRefCount}/8
                    </span>
                  </button>
                  {/* Upload reference image without placing on canvas */}
                  <label
                    className="flex items-center justify-center px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer transition-all"
                    title="Upload reference image (no canvas placement)"
                  >
                    <Upload size={14} className="text-purple-400" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleRefImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {showReferencePanel && (
                  <div className="mt-2 p-3 rounded-lg bg-slate-950/80 border border-purple-500/20 space-y-2 max-h-72 overflow-y-auto">
                    <p className="text-[10px] text-slate-500 mb-1">{referenceImages.length}/50 stored • max 8 active per generation</p>

                    {/* Canvas Reference Slot */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                      {canvasPreviewSrc ? (
                        <img src={canvasPreviewSrc} alt="Canvas" className="w-10 h-10 rounded object-cover border border-slate-600 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center shrink-0">
                          <Layers size={14} className="text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white">Full Canvas</div>
                        <div className="text-[10px] text-slate-400">Auto-captured</div>
                      </div>
                      <button
                        onClick={() => {
                          if (!canvasRefActive && activeRefCount >= 8) {
                            alert('Maximum 8 active references at once.');
                            return;
                          }
                          setCanvasRefActive(!canvasRefActive);
                        }}
                        className={`shrink-0 text-xs px-2 py-1 rounded font-bold transition-all ${
                          canvasRefActive
                            ? 'bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50'
                            : 'bg-slate-700 text-slate-500 hover:bg-slate-600 hover:text-slate-300'
                        }`}
                      >
                        {canvasRefActive ? 'On' : 'Off'}
                      </button>
                    </div>

                    {/* Saved Area References */}
                    {referenceImages.length === 0 ? (
                      <p className="text-[10px] text-slate-600 text-center py-3">
                        No area references yet.<br />Select an area and click "+ Save as Reference"
                      </p>
                    ) : (
                      referenceImages.map((ref) => (
                        <div key={ref.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                          <img src={ref.src} alt={ref.label} className="w-10 h-10 rounded object-cover border border-slate-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{ref.label}</div>
                            <div className="text-[10px] text-slate-400">{new Date(ref.createdAt).toLocaleTimeString()}</div>
                          </div>
                          <button
                            onClick={() => toggleReferenceActive(ref.id)}
                            className={`shrink-0 text-xs px-2 py-1 rounded font-bold transition-all ${
                              ref.active
                                ? 'bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50'
                                : 'bg-slate-700 text-slate-500 hover:bg-slate-600 hover:text-slate-300'
                            }`}
                          >
                            {ref.active ? 'On' : 'Off'}
                          </button>
                          <button
                            onClick={() => deleteReference(ref.id)}
                            className="shrink-0 p-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Prompt */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-semibold">Prompt</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want to generate..."
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
                  rows={4}
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={generateAIImage}
                disabled={isGenerating || !aiPrompt.trim()}
                className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/50"
              >
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating...
                    </div>
                    <div className="text-[10px] font-normal opacity-70 flex items-center gap-1">
                      <Layers size={10} />
                      {layers.find(l => l.selected)?.name ?? 'Layer 1'}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles size={16} />
                      Generate
                      <span className="text-xs font-black opacity-90">
                        ({getTicketCost(selectedAIModel, genQuality)} ticket{getTicketCost(selectedAIModel, genQuality) !== 1 ? 's' : ''})
                      </span>
                      {activeRefCount > 0 && <span className="text-xs opacity-75">{activeRefCount} ref{activeRefCount !== 1 ? 's' : ''}</span>}
                    </div>
                    <div className="text-[10px] font-normal opacity-70 flex items-center gap-1">
                      <Layers size={10} />
                      {layers.find(l => l.selected)?.name ?? 'Layer 1'}
                    </div>
                  </div>
                )}
              </button>

              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-700">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <span className="text-purple-400 font-bold">How it works:</span><br />
                  • Active references guide the AI<br />
                  • Area selection = generation target<br />
                  • Output placed as new layer<br />
                  • Max 8 references active at once
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
