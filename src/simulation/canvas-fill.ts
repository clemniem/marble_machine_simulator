/**
 * Canvas fill pattern logic.
 * Pure functions mapping a linear cursor index to a {row, col} grid position.
 */

import type { FillPattern } from './types.js';

export function cursorToGridPosition(
  cursor: number,
  width: number,
  height: number,
  pattern: FillPattern,
): { row: number; col: number } {
  switch (pattern) {
    case 'left-to-right': {
      const row = Math.floor(cursor / width);
      const col = cursor % width;
      return { row, col };
    }
    case 's-shaped': {
      const row = Math.floor(cursor / width);
      const colInRow = cursor % width;
      const col = row % 2 === 0 ? colInRow : width - 1 - colInRow;
      return { row, col };
    }
    case 'top-to-bottom': {
      const col = Math.floor(cursor / height);
      const row = cursor % height;
      return { row, col };
    }
    case 'spiral': {
      return spiralPosition(cursor, width, height);
    }
  }
}

function spiralPosition(
  index: number,
  width: number,
  height: number,
): { row: number; col: number } {
  let top = 0, bottom = height - 1, left = 0, right = width - 1;
  let count = 0;

  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) {
      if (count === index) return { row: top, col: c };
      count++;
    }
    top++;
    for (let r = top; r <= bottom; r++) {
      if (count === index) return { row: r, col: right };
      count++;
    }
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) {
        if (count === index) return { row: bottom, col: c };
        count++;
      }
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) {
        if (count === index) return { row: r, col: left };
        count++;
      }
      left++;
    }
  }

  return { row: 0, col: 0 };
}

/** Create an empty grid initialized with null. */
export function createEmptyGrid(width: number, height: number): (null)[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
}
