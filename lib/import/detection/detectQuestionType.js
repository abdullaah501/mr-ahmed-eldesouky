import { detectMarker } from "./markerDetector";
import { detectHeuristic } from "./heuristicDetector";

const DEFAULT_THRESHOLD = 0.80;

export function detectQuestionType(block, threshold = DEFAULT_THRESHOLD) {
  const marker = detectMarker(block);

  if (marker) {
    if (marker.type === null) {
      return {
        detectedType: null,
        confidence: 0,
        source: "marker",
        marker: marker.marker,
        warning: "UNKNOWN_MARKER",
      };
    }

    const heuristic = detectHeuristic(block);
    if (heuristic && heuristic.type !== marker.type) {
      return {
        detectedType: marker.type,
        confidence: 1.0,
        source: "marker",
        marker: marker.marker,
        warning: "CONFLICTING_DETECTION",
      };
    }

    return {
      detectedType: marker.type,
      confidence: 1.0,
      source: "marker",
      marker: marker.marker,
    };
  }

  const heuristic = detectHeuristic(block);

  if (!heuristic) {
    return {
      detectedType: null,
      confidence: 0,
      source: "heuristic",
      marker: null,
      warning: "QUESTION_TYPE_UNKNOWN",
    };
  }

  if (heuristic.confidence < threshold) {
    return {
      detectedType: null,
      confidence: heuristic.confidence,
      source: "heuristic",
      marker: null,
      warning: "LOW_DETECTION_CONFIDENCE",
    };
  }

  return {
    detectedType: heuristic.type,
    confidence: heuristic.confidence,
    source: "heuristic",
    marker: null,
  };
}
