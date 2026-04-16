import { useRef, useEffect, useState, useCallback } from "react";
import { Text, Transformer } from "react-konva";
import type { TextObject } from "../../types/canvas";
import { useCanvasStore } from "../../stores/canvasStore";

interface TextNodeProps {
  obj: TextObject;
  isSelected: boolean;
  autoEdit?: boolean;
  onSelect: () => void;
  onEditDone?: () => void;
  zoom: number;
  stageContainer: HTMLDivElement | null;
}

export function TextNode({
  obj,
  isSelected,
  autoEdit,
  onSelect,
  onEditDone,
  zoom,
  stageContainer,
}: TextNodeProps) {
  const textRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { updateObject, removeObject } = useCanvasStore();

  useEffect(() => {
    if (isSelected && !isEditing && trRef.current && textRef.current) {
      trRef.current.nodes([textRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, isEditing]);

  // Auto-open editor when created via text tool
  useEffect(() => {
    if (autoEdit && !isEditing) {
      // Small delay to let Konva render the node first
      const timer = setTimeout(() => openEditor(), 50);
      return () => clearTimeout(timer);
    }
  }, [autoEdit]);

  const openEditor = useCallback(() => {
    if (!stageContainer || !textRef.current) return;
    setIsEditing(true);

    const textNode = textRef.current;
    const stage = textNode.getStage();
    if (!stage) return;

    // Hide the Konva text while editing
    textNode.hide();
    if (trRef.current) trRef.current.hide();
    textNode.getLayer()?.batchDraw();

    // Use Konva's built-in transform to get the exact screen position
    const transform = textNode.getAbsoluteTransform().copy();
    const origin = transform.point({ x: 0, y: 0 });
    // origin is in pixels relative to the stage container
    const posX = origin.x;
    const posY = origin.y;

    const textarea = document.createElement("textarea");
    stageContainer.appendChild(textarea);

    textarea.value = obj.props.text;
    textarea.style.position = "absolute";
    textarea.style.top = `${posY}px`;
    textarea.style.left = `${posX}px`;
    textarea.style.width = `${(obj.width || 200) * zoom}px`;
    textarea.style.minHeight = `${obj.props.fontSize * zoom * 1.5}px`;
    textarea.style.fontSize = `${obj.props.fontSize * zoom}px`;
    textarea.style.fontFamily = obj.props.fontFamily;
    textarea.style.fontStyle = obj.props.fontStyle.includes("italic") ? "italic" : "normal";
    textarea.style.fontWeight = obj.props.fontStyle.includes("bold") ? "bold" : "normal";
    textarea.style.textDecoration = obj.props.textDecoration || "none";
    textarea.style.color = obj.props.fill;
    textarea.style.textAlign = obj.props.align || "left";
    textarea.style.border = "1px dashed #0078d4";
    textarea.style.borderRadius = "0";
    textarea.style.padding = "2px 4px";
    textarea.style.margin = "0";
    textarea.style.overflow = "hidden";
    textarea.style.background = "transparent";
    textarea.style.outline = "none";
    textarea.style.resize = "none";
    textarea.style.lineHeight = "1.2";
    textarea.style.transformOrigin = "left top";
    textarea.style.zIndex = "10000";

    textarea.focus();

    // Prevent keyboard shortcuts from triggering while typing
    textarea.addEventListener("keyup", (e: KeyboardEvent) => {
      e.stopPropagation();
    }, true);

    const finishEditing = () => {
      const newText = textarea.value.trim();
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
      textNode.show();
      if (trRef.current) trRef.current.show();
      textNode.getLayer()?.batchDraw();
      setIsEditing(false);
      onEditDone?.();

      if (!newText) {
        // Remove empty text objects
        removeObject(obj.id);
      } else if (newText !== obj.props.text) {
        updateObject(obj.id, {
          props: { ...obj.props, text: newText },
        });
      }
    };

    textarea.addEventListener("blur", finishEditing);
    textarea.addEventListener("keydown", (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        finishEditing();
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finishEditing();
      }
    });

    // Auto-resize height
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [obj, zoom, stageContainer, updateObject, removeObject, onEditDone]);

  return (
    <>
      <Text
        ref={textRef}
        id={obj.id}
        x={obj.x}
        y={obj.y}
        text={obj.props.text || " "}
        fontSize={obj.props.fontSize}
        fontFamily={obj.props.fontFamily}
        fontStyle={obj.props.fontStyle}
        textDecoration={obj.props.textDecoration}
        fill={obj.props.fill}
        align={obj.props.align}
        width={obj.width || undefined}
        draggable={isSelected}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={openEditor}
        onDblTap={openEditor}
        onDragEnd={(e) => {
          updateObject(obj.id, {
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={() => {
          const node = textRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          updateObject(obj.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(20, node.width() * scaleX),
            props: {
              ...obj.props,
              fontSize: Math.max(8, obj.props.fontSize * scaleX),
            },
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
      {isSelected && !isEditing && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 20) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
}
