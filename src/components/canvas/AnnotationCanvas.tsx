import { useRef, useEffect, useState, useCallback } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Line,
  Rect,
  Ellipse,
  Arrow,
  Transformer,
} from "react-konva";
import { Camera } from "lucide-react";
import { useCanvasStore } from "../../stores/canvasStore";
import { useCaptureStore } from "../../stores/captureStore";
import { useUIStore } from "../../stores/uiStore";
import { TextNode } from "./TextNode";
import { ImageOverlayNode } from "./ImageOverlayNode";
import type {
  CanvasObject,
  DrawingObject,
  ShapeObject,
  TextObject,
  ImageOverlayObject,
} from "../../types/canvas";

function generateId() {
  return `obj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function DrawingLine({ obj }: { obj: DrawingObject }) {
  return (
    <Line
      id={obj.id}
      points={obj.props.points}
      stroke={obj.props.stroke}
      strokeWidth={obj.props.strokeWidth}
      opacity={obj.props.opacity}
      tension={0.5}
      lineCap="round"
      lineJoin="round"
      globalCompositeOperation={
        obj.type === "highlighter" ? "multiply" : "source-over"
      }
    />
  );
}

function ShapeNode({
  obj,
  isSelected,
  onSelect,
}: {
  obj: ShapeObject;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const commonProps = {
    ref: shapeRef,
    id: obj.id,
    x: obj.x,
    y: obj.y,
    stroke: obj.props.stroke,
    strokeWidth: obj.props.strokeWidth,
    opacity: obj.props.opacity,
    fill: obj.props.fill || "transparent",
    onClick: onSelect,
    onTap: onSelect,
    draggable: isSelected,
  };

  const renderShape = () => {
    switch (obj.props.shapeType) {
      case "rectangle":
        return (
          <Rect
            {...commonProps}
            width={obj.width || 0}
            height={obj.height || 0}
          />
        );
      case "ellipse":
        return (
          <Ellipse
            {...commonProps}
            radiusX={(obj.width || 0) / 2}
            radiusY={(obj.height || 0) / 2}
            x={(obj.x || 0) + (obj.width || 0) / 2}
            y={(obj.y || 0) + (obj.height || 0) / 2}
          />
        );
      case "arrow":
        return (
          <Arrow
            {...commonProps}
            points={obj.props.points || [0, 0, obj.width || 0, obj.height || 0]}
            pointerLength={10}
            pointerWidth={10}
            fill={obj.props.stroke}
          />
        );
      case "line":
        return (
          <Line
            {...commonProps}
            points={obj.props.points || [0, 0, obj.width || 0, obj.height || 0]}
            lineCap="round"
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {renderShape()}
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

function ShapePreview({ shape }: { shape: ShapeObject }) {
  const commonProps = {
    stroke: shape.props.stroke,
    strokeWidth: shape.props.strokeWidth,
    opacity: shape.props.opacity,
    fill: shape.props.fill || "transparent",
    dash: [5, 5],
  };

  switch (shape.props.shapeType) {
    case "rectangle":
      return (
        <Rect
          x={shape.x}
          y={shape.y}
          width={shape.width || 0}
          height={shape.height || 0}
          {...commonProps}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={(shape.x || 0) + (shape.width || 0) / 2}
          y={(shape.y || 0) + (shape.height || 0) / 2}
          radiusX={(shape.width || 0) / 2}
          radiusY={(shape.height || 0) / 2}
          {...commonProps}
        />
      );
    case "arrow":
      return (
        <Arrow
          x={shape.x}
          y={shape.y}
          points={shape.props.points || [0, 0, 0, 0]}
          pointerLength={10}
          pointerWidth={10}
          {...commonProps}
          fill={shape.props.stroke}
        />
      );
    case "line":
      return (
        <Line
          x={shape.x}
          y={shape.y}
          points={shape.props.points || [0, 0, 0, 0]}
          lineCap="round"
          {...commonProps}
        />
      );
    default:
      return null;
  }
}

export function AnnotationCanvas() {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<number[]>([]);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [previewShape, setPreviewShape] = useState<ShapeObject | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const { zoom, objects, addObject, removeObject, setZoom, setStageRef } = useCanvasStore();
  const { capturedImage } = useCaptureStore();
  const { activeTool, toolOptions } = useUIStore();

  // Resize observer
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load captured image
  useEffect(() => {
    if (!capturedImage) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = `data:image/png;base64,${capturedImage.base64}`;
  }, [capturedImage]);

  // Register stage ref
  useEffect(() => {
    if (stageRef.current) {
      setStageRef(stageRef);
    }
  }, [image, setStageRef]);

  // Clear selection when switching tools
  useEffect(() => {
    if (activeTool !== "select") {
      setSelectedId(null);
    }
  }, [activeTool]);

  const getPointerPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: pos.x / zoom,
      y: pos.y / zoom,
    };
  }, [zoom]);

  // Scroll to zoom
  const handleWheel = useCallback(
    (e: any) => {
      e.evt.preventDefault();
      const scaleBy = 1.1;
      const newZoom =
        e.evt.deltaY < 0
          ? Math.min(zoom * scaleBy, 5)
          : Math.max(zoom / scaleBy, 0.1);
      setZoom(newZoom);
    },
    [zoom, setZoom]
  );

  const handleMouseDown = useCallback(() => {
    const pos = getPointerPos();

    if (activeTool === "pen" || activeTool === "highlighter") {
      setIsDrawing(true);
      setCurrentDrawing([pos.x, pos.y]);
    } else if (activeTool === "shape") {
      setShapeStart(pos);
      setPreviewShape({
        id: "preview",
        type: "shape",
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        props: {
          shapeType: toolOptions.shapeType,
          stroke: toolOptions.strokeColor,
          strokeWidth: toolOptions.strokeWidth,
          fill: toolOptions.filled ? toolOptions.fillColor : "transparent",
          opacity: toolOptions.opacity,
          points: [0, 0, 0, 0],
        },
      });
    } else if (activeTool === "text") {
      // Create a new text object and immediately open editor (Paint-like UX)
      const newId = generateId();
      const textObj: TextObject = {
        id: newId,
        type: "text",
        x: pos.x,
        y: pos.y,
        width: 200,
        props: {
          text: "",
          fontSize: toolOptions.fontSize,
          fontFamily: toolOptions.fontFamily,
          fontStyle: toolOptions.fontStyle,
          textDecoration: toolOptions.textDecoration,
          fill: toolOptions.textColor,
          align: toolOptions.textAlign,
        },
      };
      addObject(textObj);
      setSelectedId(newId);
      setEditingTextId(newId);
    } else if (activeTool === "eraser") {
      const stage = stageRef.current;
      if (!stage) return;
      const clickedShape = stage.getIntersection(stage.getPointerPosition());
      if (clickedShape && clickedShape.id() && clickedShape.id() !== "background-image") {
        removeObject(clickedShape.id());
      }
    } else if (activeTool === "select") {
      const stage = stageRef.current;
      if (!stage) return;
      const clickedShape = stage.getIntersection(stage.getPointerPosition());
      if (clickedShape && clickedShape.id() && clickedShape.id() !== "background-image") {
        setSelectedId(clickedShape.id());
      } else {
        setSelectedId(null);
      }
    }
  }, [activeTool, toolOptions, getPointerPos, addObject, removeObject]);

  const handleMouseMove = useCallback(() => {
    const pos = getPointerPos();

    if (isDrawing && (activeTool === "pen" || activeTool === "highlighter")) {
      setCurrentDrawing((prev) => [...prev, pos.x, pos.y]);
    } else if (shapeStart && activeTool === "shape") {
      const width = pos.x - shapeStart.x;
      const height = pos.y - shapeStart.y;
      setPreviewShape((prev) =>
        prev
          ? {
              ...prev,
              width: Math.abs(width),
              height: Math.abs(height),
              x: width < 0 ? pos.x : shapeStart.x,
              y: height < 0 ? pos.y : shapeStart.y,
              props: {
                ...prev.props,
                points: [0, 0, width, height],
              },
            }
          : null
      );
    }
  }, [isDrawing, shapeStart, activeTool, getPointerPos]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing && (activeTool === "pen" || activeTool === "highlighter")) {
      if (currentDrawing.length >= 4) {
        const drawingObj: DrawingObject = {
          id: generateId(),
          type: activeTool,
          x: 0,
          y: 0,
          props: {
            points: currentDrawing,
            stroke: toolOptions.strokeColor,
            strokeWidth: toolOptions.strokeWidth,
            opacity: activeTool === "highlighter" ? toolOptions.opacity : 1,
          },
        };
        addObject(drawingObj);
      }
      setIsDrawing(false);
      setCurrentDrawing([]);
    } else if (shapeStart && previewShape && activeTool === "shape") {
      if ((previewShape.width || 0) > 2 || (previewShape.height || 0) > 2) {
        const shapeObj: ShapeObject = {
          ...previewShape,
          id: generateId(),
        };
        addObject(shapeObj);
      }
      setShapeStart(null);
      setPreviewShape(null);
    }
  }, [
    isDrawing,
    currentDrawing,
    activeTool,
    toolOptions,
    shapeStart,
    previewShape,
    addObject,
  ]);

  const getCursor = () => {
    switch (activeTool) {
      case "pen":
      case "highlighter":
      case "shape":
        return "crosshair";
      case "text":
        return "text";
      case "eraser":
        return "pointer";
      case "select":
        return "default";
      default:
        return "default";
    }
  };

  const imageX = capturedImage
    ? (containerSize.width / zoom - capturedImage.width) / 2
    : 0;
  const imageY = capturedImage
    ? (containerSize.height / zoom - capturedImage.height) / 2
    : 0;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "hidden",
        backgroundColor: "var(--bg-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {capturedImage && image ? (
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          scaleX={zoom}
          scaleY={zoom}
          style={{ cursor: getCursor() }}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Background image layer */}
          <Layer>
            <KonvaImage
              id="background-image"
              image={image}
              x={imageX}
              y={imageY}
              width={capturedImage.width}
              height={capturedImage.height}
            />
          </Layer>

          {/* Annotations layer */}
          <Layer>
            {objects.map((obj) => {
              if (obj.type === "pen" || obj.type === "highlighter") {
                return <DrawingLine key={obj.id} obj={obj as DrawingObject} />;
              }
              if (obj.type === "shape") {
                return (
                  <ShapeNode
                    key={obj.id}
                    obj={obj as ShapeObject}
                    isSelected={selectedId === obj.id}
                    onSelect={() => {
                      if (activeTool === "select") setSelectedId(obj.id);
                    }}
                  />
                );
              }
              if (obj.type === "text") {
                return (
                  <TextNode
                    key={obj.id}
                    obj={obj as TextObject}
                    isSelected={selectedId === obj.id}
                    autoEdit={editingTextId === obj.id}
                    onSelect={() => {
                      if (activeTool === "select") setSelectedId(obj.id);
                    }}
                    onEditDone={() => setEditingTextId(null)}
                    zoom={zoom}
                    stageContainer={containerRef.current}
                  />
                );
              }
              if (obj.type === "image-overlay") {
                return (
                  <ImageOverlayNode
                    key={obj.id}
                    obj={obj as ImageOverlayObject}
                    isSelected={selectedId === obj.id}
                    onSelect={() => {
                      if (activeTool === "select") setSelectedId(obj.id);
                    }}
                  />
                );
              }
              return null;
            })}

            {/* Live drawing preview */}
            {isDrawing && currentDrawing.length >= 2 && (
              <Line
                points={currentDrawing}
                stroke={toolOptions.strokeColor}
                strokeWidth={toolOptions.strokeWidth}
                opacity={activeTool === "highlighter" ? toolOptions.opacity : 1}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  activeTool === "highlighter" ? "multiply" : "source-over"
                }
              />
            )}

            {/* Shape preview */}
            {previewShape && <ShapePreview shape={previewShape} />}
          </Layer>
        </Stage>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            color: "var(--text-secondary)",
          }}
        >
          <Camera size={48} />
          <p style={{ fontSize: 14 }}>
            Press{" "}
            <kbd
              style={{
                padding: "2px 6px",
                backgroundColor: "var(--bg-toolbar)",
                borderRadius: 4,
                border: "1px solid var(--border-color)",
              }}
            >
              Ctrl+Shift+S
            </kbd>{" "}
            to capture
          </p>
          <p style={{ fontSize: 12 }}>or click the camera icon above</p>
        </div>
      )}
    </div>
  );
}
