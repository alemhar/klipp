import { useRef, useEffect, useState } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
import type { ImageOverlayObject } from "../../types/canvas";
import { useCanvasStore } from "../../stores/canvasStore";

interface ImageOverlayNodeProps {
  obj: ImageOverlayObject;
  isSelected: boolean;
  onSelect: () => void;
}

export function ImageOverlayNode({ obj, isSelected, onSelect }: ImageOverlayNodeProps) {
  const imageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const { updateObject } = useCanvasStore();

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = obj.props.src;
  }, [obj.props.src]);

  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  if (!image) return null;

  return (
    <>
      <KonvaImage
        ref={imageRef}
        id={obj.id}
        image={image}
        x={obj.x}
        y={obj.y}
        width={obj.width || image.width}
        height={obj.height || image.height}
        draggable={isSelected}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          updateObject(obj.id, {
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={() => {
          const node = imageRef.current;
          if (!node) return;
          updateObject(obj.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(10, node.width() * node.scaleX()),
            height: Math.max(10, node.height() * node.scaleY()),
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          keepRatio={true}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}
