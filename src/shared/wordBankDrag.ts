export interface TileRectSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Given the bounding rectangles of the currently placed tiles in the answer tray (in order `0 .. N-1`)
 * and the pointer coordinates `(clientX, clientY)`, compute the exact insertion index (`0 .. N`).
 *
 * Every gap `0 .. N` (before the first tile, between any two tiles, or after the last tile) is
 * treated identically so the UI never leaks which slot is grammatically correct.
 */
export function computeTrayInsertionIndex(
  rects: readonly TileRectSnapshot[],
  clientX: number,
  clientY: number
): number {
  if (rects.length === 0) return 0;

  const rows: Array<{
    top: number;
    bottom: number;
    midY: number;
    items: Array<{ index: number; rect: TileRectSnapshot }>;
  }> = [];

  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i]!;
    const cy = r.top + r.height / 2;
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(cy - lastRow.midY) <= Math.max(14, r.height * 0.6)) {
      lastRow.items.push({ index: i, rect: r });
      lastRow.top = Math.min(lastRow.top, r.top);
      lastRow.bottom = Math.max(lastRow.bottom, r.top + r.height);
      lastRow.midY = (lastRow.top + lastRow.bottom) / 2;
    } else {
      rows.push({
        top: r.top,
        bottom: r.top + r.height,
        midY: cy,
        items: [{ index: i, rect: r }],
      });
    }
  }

  let targetRow = rows[0]!;
  let bestDist = Infinity;
  for (const row of rows) {
    const dist =
      clientY < row.top
        ? row.top - clientY
        : clientY > row.bottom
          ? clientY - row.bottom
          : 0;
    if (dist < bestDist) {
      bestDist = dist;
      targetRow = row;
    }
  }

  for (const item of targetRow.items) {
    const midX = item.rect.left + item.rect.width / 2;
    if (clientX < midX) {
      return item.index;
    }
  }

  const lastInRow = targetRow.items[targetRow.items.length - 1]!;
  return lastInRow.index + 1;
}

export interface AttachWordBankTileGestureOptions {
  chip: HTMLButtonElement;
  word: string;
  source: 'bank' | 'answer';
  answerTray: HTMLElement;
  bankTray: HTMLElement;
  isLocked: () => boolean;
  /** Invoked on a normal tap/click (< 5px pointer movement) or keyboard Enter/Space. */
  onTap: () => void;
  /**
   * Invoked when the tile is dragged and dropped into the answer tray at `insertIndex`
   * (`0 .. remainingPlacedCount`).
   */
  onDropIntoAnswer: (insertIndex: number) => void;
  /**
   * Invoked when an already-placed tile (`source === 'answer'`) is dragged and dropped
   * back onto the bank tray.
   */
  onDropBackToBank?: () => void;
}

const DRAG_THRESHOLD_PX = 5;

/**
 * Attach unified tap + pointer drag-and-drop gestures to a word-bank tile so the learner can:
 * 1. Tap tiles in order as usual, OR
 * 2. Press-and-drag any bank tile directly into ANY gap (`0 .. N`) in the answer tray, OR
 * 3. Press-and-drag any placed tile inside the answer tray to reorder it or drop it back to the bank.
 */
export function attachWordBankTileGesture(opts: AttachWordBankTileGestureOptions): void {
  const { chip, word, source, answerTray, bankTray, isLocked, onTap, onDropIntoAnswer, onDropBackToBank } = opts;

  let suppressNextClick = false;

  chip.addEventListener('click', (e) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isLocked()) return;
    onTap();
  });

  chip.addEventListener('pointerdown', (downEvent: PointerEvent) => {
    if (isLocked() || downEvent.button !== 0) return;

    const startX = downEvent.clientX;
    const startY = downEvent.clientY;
    const initialChipRect = chip.getBoundingClientRect();
    const grabOffsetX = Math.max(8, Math.min(initialChipRect.width - 8, startX - initialChipRect.left));
    const grabOffsetY = Math.max(6, Math.min(initialChipRect.height - 6, startY - initialChipRect.top));

    let dragging = false;
    let floatingEl: HTMLElement | null = null;
    let dropSlotEl: HTMLElement | null = null;
    let placedChips: HTMLElement[] = [];
    let snapshottedRects: TileRectSnapshot[] = [];
    let currentInsertIndex: number | null = null;

    const isCrimson = Boolean(chip.closest('.is-remedial-crimson'));

    const updateFloatingPosition = (clientX: number, clientY: number): void => {
      if (!floatingEl) return;
      const x = Math.round(clientX - grabOffsetX);
      const y = Math.round(clientY - grabOffsetY);
      floatingEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.05)`;
    };

    const updateDropSlot = (nextIndex: number | null): void => {
      if (!dropSlotEl) return;
      if (nextIndex === currentInsertIndex) return;
      currentInsertIndex = nextIndex;

      if (nextIndex === null) {
        dropSlotEl.remove();
        answerTray.classList.remove('is-drop-active');
        return;
      }

      answerTray.classList.add('is-drop-active');
      const refNode = placedChips[nextIndex] ?? null;
      if (refNode) {
        answerTray.insertBefore(dropSlotEl, refNode);
      } else {
        answerTray.appendChild(dropSlotEl);
      }
    };

    const enterDragMode = (clientX: number, clientY: number): void => {
      dragging = true;
      suppressNextClick = true;

      if (source === 'answer') {
        chip.classList.add('is-dragging-hidden');
      } else {
        chip.classList.add('is-dragging-source');
      }

      placedChips = Array.from(
        answerTray.querySelectorAll<HTMLElement>('.duo-wb-tile.placed:not(.is-dragging-hidden)')
      );
      snapshottedRects = placedChips.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });

      dropSlotEl = document.createElement('span');
      dropSlotEl.className = 'duo-wb-drop-slot';
      dropSlotEl.style.width = `${Math.max(26, Math.round(initialChipRect.width * 0.68))}px`;
      dropSlotEl.style.height = `${Math.max(24, Math.round(initialChipRect.height))}px`;

      floatingEl = document.createElement('div');
      floatingEl.className = `duo-wb-drag-floating ${isCrimson ? 'is-crimson' : ''}`;
      floatingEl.textContent = word;
      document.body.appendChild(floatingEl);

      answerTray.classList.add('is-drop-target');
      updateFloatingPosition(clientX, clientY);
    };

    const getStableInsertionIndex = (clientX: number, clientY: number): number => {
      if (currentInsertIndex !== null && dropSlotEl && dropSlotEl.isConnected) {
        const sr = dropSlotEl.getBoundingClientRect();
        if (
          clientX >= sr.left - 5 &&
          clientX <= sr.right + 5 &&
          clientY >= sr.top - 12 &&
          clientY <= sr.bottom + 12
        ) {
          return currentInsertIndex;
        }
      }
      const liveRects: TileRectSnapshot[] =
        placedChips.length > 0
          ? placedChips.map((el) => {
              const r = el.getBoundingClientRect();
              return { left: r.left, top: r.top, width: r.width, height: r.height };
            })
          : snapshottedRects;
      return computeTrayInsertionIndex(liveRects, clientX, clientY);
    };

    const evaluateHoverTarget = (clientX: number, clientY: number): void => {
      const trayRect = answerTray.getBoundingClientRect();
      const bankRect = bankTray.getBoundingClientRect();
      const boundaryY =
        bankRect.top > trayRect.bottom
          ? (trayRect.bottom + bankRect.top) / 2 + 12
          : trayRect.bottom + 28;

      if (source === 'answer') {
        const overBank =
          clientY >= Math.max(boundaryY, bankRect.top - 8) &&
          clientY <= bankRect.bottom + 36;
        if (overBank) {
          updateDropSlot(null);
          return;
        }
        updateDropSlot(getStableInsertionIndex(clientX, clientY));
        return;
      }

      // source === 'bank'
      const overAnswerZone =
        clientY <= boundaryY &&
        clientY >= trayRect.top - 36 &&
        clientX >= trayRect.left - 32 &&
        clientX <= trayRect.right + 32;

      if (overAnswerZone) {
        updateDropSlot(getStableInsertionIndex(clientX, clientY));
      } else {
        updateDropSlot(null);
      }
    };

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        enterDragMode(moveEvent.clientX, moveEvent.clientY);
      }
      moveEvent.preventDefault();
      updateFloatingPosition(moveEvent.clientX, moveEvent.clientY);
      evaluateHoverTarget(moveEvent.clientX, moveEvent.clientY);
    };

    const cleanupListeners = (): void => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      floatingEl?.remove();
      floatingEl = null;
      dropSlotEl?.remove();
      dropSlotEl = null;
      chip.classList.remove('is-dragging-source', 'is-dragging-hidden');
      answerTray.classList.remove('is-drop-target', 'is-drop-active');
    };

    const onPointerUp = (upEvent: PointerEvent): void => {
      const wasDragging = dragging;
      if (wasDragging) {
        evaluateHoverTarget(upEvent.clientX, upEvent.clientY);
      }
      const finalInsertIdx = currentInsertIndex;
      cleanupListeners();

      if (!wasDragging) return;

      // Clear suppressNextClick on next tick in case browser didn't fire click
      setTimeout(() => {
        suppressNextClick = false;
      }, 60);

      if (isLocked()) return;

      if (finalInsertIdx !== null) {
        onDropIntoAnswer(finalInsertIdx);
      } else if (source === 'answer' && onDropBackToBank) {
        onDropBackToBank();
      }
    };

    const onPointerCancel = (): void => {
      cleanupListeners();
      setTimeout(() => {
        suppressNextClick = false;
      }, 60);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  });
}
