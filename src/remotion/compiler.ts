import { useState, useEffect, useMemo, useRef } from "react";
import * as Babel from "@babel/standalone";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
} from "remotion";
import * as RemotionShapes from "@remotion/shapes";
import { Lottie } from "@remotion/lottie";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";

export interface CompilationResult {
  Component: React.ComponentType | null;
  error: string | null;
}

// Parse and prepare code for compilation
function prepareCode(code: string): string {
  // 1. Strip import statements (we inject dependencies)
  let cleaned = code.replace(/^import\s+.*$/gm, "");

  // 2. Remove "export" keywords to make declarations local to the function scope
  cleaned = cleaned.replace(/^export\s+const/gm, "const");
  cleaned = cleaned.replace(/^export\s+default\s+/gm, "");
  cleaned = cleaned.replace(/^export\s+function/gm, "function");

  return cleaned.trim();
}

// Standalone compile function for use outside React components
export function compileCode(code: string): CompilationResult {
  if (!code?.trim()) {
    return { Component: null, error: "No code provided" };
  }

  try {
    const preparedCode = prepareCode(code);
    
    // Transform JSX/TS to JS
    const transpiled = Babel.transform(preparedCode, {
      presets: ["react", "typescript"],
      filename: "dynamic-animation.tsx",
      retainLines: true,
    });

    if (!transpiled.code) {
      return { Component: null, error: "Transpilation failed" };
    }

    const Remotion = {
      AbsoluteFill,
      interpolate,
      useCurrentFrame,
      useVideoConfig,
      spring,
      Sequence,
    };

    // We assume the component is named 'MyAnimation' based on system prompt
    // But we also look for other common patterns if that fails
    let finalCode = transpiled.code;
    
    // Ensure we return the component
    if (!finalCode.includes("return MyAnimation")) {
      if (finalCode.includes("const MyAnimation")) {
        finalCode += "\nreturn MyAnimation;";
      } else if (finalCode.includes("function MyAnimation")) {
        finalCode += "\nreturn MyAnimation;";
      } else {
        // Fallback: try to find the last defined function or const
        const match = finalCode.match(/(?:const|function)\s+(\w+)/g);
        if (match && match.length > 0) {
          const lastMatch = match[match.length - 1];
          const name = lastMatch.split(/\s+/)[1];
          finalCode += `\nreturn ${name};`;
        }
      }
    }

    const createComponent = new Function(
      "React",
      "Remotion",
      "RemotionShapes",
      "Lottie",
      "ThreeCanvas",
      "THREE",
      "AbsoluteFill",
      "interpolate",
      "useCurrentFrame",
      "useVideoConfig",
      "spring",
      "Sequence",
      "useState",
      "useEffect",
      "useMemo",
      "useRef",
      "Rect",
      "Circle",
      "Triangle",
      "Star",
      "Polygon",
      "Ellipse",
      "Heart",
      "Pie",
      "makeRect",
      "makeCircle",
      "makeTriangle",
      "makeStar",
      "makePolygon",
      "makeEllipse",
      "makeHeart",
      "makePie",
      // Transitions
      "TransitionSeries",
      "linearTiming",
      "springTiming",
      "fade",
      "slide",
      "wipe",
      "flip",
      "clockWipe",
      finalCode,
    );

    const Component = createComponent(
      React,
      Remotion,
      RemotionShapes,
      Lottie,
      ThreeCanvas,
      THREE,
      AbsoluteFill,
      interpolate,
      useCurrentFrame,
      useVideoConfig,
      spring,
      Sequence,
      useState,
      useEffect,
      useMemo,
      useRef,
      RemotionShapes.Rect,
      RemotionShapes.Circle,
      RemotionShapes.Triangle,
      RemotionShapes.Star,
      RemotionShapes.Polygon,
      RemotionShapes.Ellipse,
      RemotionShapes.Heart,
      RemotionShapes.Pie,
      RemotionShapes.makeRect,
      RemotionShapes.makeCircle,
      RemotionShapes.makeTriangle,
      RemotionShapes.makeStar,
      RemotionShapes.makePolygon,
      RemotionShapes.makeEllipse,
      RemotionShapes.makeHeart,
      RemotionShapes.makePie,
      // Transitions
      TransitionSeries,
      linearTiming,
      springTiming,
      fade,
      slide,
      wipe,
      flip,
      clockWipe,
    );

    if (typeof Component !== "function") {
      return {
        Component: null,
        error: "Code must be a function that returns a React component",
      };
    }

    return { Component, error: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown compilation error";
    return { Component: null, error: errorMessage };
  }
}
