"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogueStyle, Design } from "@/types";

export interface DesignCanvasProps {
  style: CatalogueStyle;
  design: Design;
  onDesignChange: (d: Design) => void;
}

const PX = 240; // print area width (matches catalogue seed)
const PY = 320; // print area height

export function DesignCanvas({ style, design, onDesignChange }: DesignCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const movingRef = useRef(false);
  const resizingRef = useRef(false);
  const start = useRef<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });

  function clamp(v: number, min: number, max: number) {
    return Math.min(max, Math.max(min, v));
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!wrapRef.current) return;

      if (movingRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        onDesignChange({
          ...design,
          x: clamp(design.x + (e.clientX - start.current.x) / rect.width, 0, 100),
          y: clamp(design.y + (e.clientY - start.current.y) / rect.height, 0, 100),
        });
        start.current.x = e.clientX;
        start.current.y = e.clientY;
      }

      if (resizingRef.current) {
        const delta = (e.clientY - start.current.y) / (wrapRef.current.offsetHeight / 100);
        onDesignChange({ ...design, scale: clamp(design.scale + delta, 0.2, 3) });
      }
    }
    function onUp() {
      movingRef.current = false;
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [design, onDesignChange]);

  const onMoveStart = (e: React.MouseEvent) => {
    start.current = { x: e.clientX, y: e.clientY, scale: design.scale };
    movingRef.current = true;
    resizingRef.current = false;
  };

  const onResizeStart = (e: React.MouseEvent) => {
    start.current = { x: e.clientX, y: e.clientY, scale: design.scale };
    resizingRef.current = true;
    movingRef.current = false;
    e.stopPropagation();
  };

  // Position the text so it stays centred on its anchor point inside the print area.
  const textX = design.x;
  const textY = design.y;

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full max-w-[320px] aspect-[1/1.333] select-none"
    >
      {/* Shirt silhouette as a coloured box with collar/neck */}
      <div
        className="absolute inset-0 rounded-b-[28px] shadow-lg"
        style={{
          backgroundColor: style.colours.length ? style.colours[0].hex : "#f5f5f5",
          borderTopLeftRadius: "28px",
          borderTopRightRadius: "28px",
        }}
      >
        {/* Collar */}
        <div
          className="absolute top-[-14px] left-1/2 -translate-x-1/2 w-10 h-6 rounded-b-full"
          style={{ backgroundColor: style.colours[0]?.hex ?? "#f5f5f5" }}
        />
      </div>

      {/* Print area ( centred on the shirt body ) */}
      <div
        className="absolute left-1/2 top-10 -translate-x-1/2 bg-neutral-100/40 border border-dashed border-neutral-400/40 rounded"
        style={{ width: PX, height: PY, transform: "translateX(-50%)" }}
      />

      {/* Design layer (text or logo) */}
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      >
        {design.text ? (
          <div
            className="absolute whitespace-nowrap pointer-events-auto cursor-move"
            style={{
              left: `${textX}%`,
              top: `${textY}%`,
              transform: `translate(-50%, -50%) scale(${design.scale})`,
              fontFamily: design.font,
              color: design.colour,
              fontSize: 48,
              lineHeight: 1,
              userSelect: "none",
            }}
            onMouseDown={onMoveStart}
          >
            {design.text}
          </div>
        ) : null}

        {design.logo_path ? (
          <img
            src={`${
              process.env.NEXT_PUBLIC_SUPABASE_URL
            }/storage/v1/object/public/tsh-logos/${design.logo_path}`}
            alt="logo preview"
            className="absolute pointer-events-auto cursor-move"
            style={{
              left: `${textX}%`,
              top: `${textY}%`,
              width: `${design.scale * 120}px`,
              height: "auto",
              transform: "translate(-50%, -50%)",
              userSelect: "none",
            }}
            draggable={false}
            onMouseDown={onMoveStart}
          />
        ) : null}

        {/* Resize handle (only when there is a design) */}
        {(design.text || design.logo_path) && (
          <div
            className="absolute w-4 h-4 bg-neutral-800 rounded-full cursor-ns-resize"
            style={{
              left: `${textX}%`,
              top: `${textY + 8}%`,
              transform: "translate(-50%, -50%)",
            }}
            onMouseDown={onResizeStart}
          />
        )}
      </div>
    </div>
  );
}
