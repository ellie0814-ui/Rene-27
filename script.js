// ===== SCRAPBOOK PAGE FLIP ENGINE =====
//
// Page structure (how spreads map to DOM pages):
// - Page 1: Front=Cover, Back=Title-Left
// - Page 2: Front=Title-Right, Back=January-Left
// - Page 3: Front=January-Right, Back=February-Left
// - ... and so on
//
// When viewing a spread:
// - LEFT side shows: flipped page's BACK
// - RIGHT side shows: next unflipped page's FRONT
//
// currentSpread values:
// 0 = Cover (closed book, seeing page 1 front)
// 1 = Title spread (page 1 back + page 2 front)
// 2 = January spread (page 2 back + page 3 front)
// ... etc

// ===== STATE =====
let currentSpread = 0;  // 0 = cover showing
const totalPages = 14;
let isAnimating = false;

// Drag state
let isDragging = false;
let startX = 0;
let currentX = 0;
let draggedPage = null;
let dragDirection = null;

// Config
const DRAG_THRESHOLD = 60;
const ANIMATION_DURATION = 800;

// ===== DOM =====
const book = document.querySelector('.book');
const pages = document.querySelectorAll('.page');
const swipeHint = document.querySelector('.swipe-hint');

// ===== INIT =====
function init() {
    setupDragListeners();
    setupKeyboardListeners();
    updatePageZIndex();
    console.log('Scrapbook initialized. Total pages:', totalPages);
}

// ===== Z-INDEX MANAGEMENT =====
// Critical for correct page display!
function updatePageZIndex() {
    const flippedCount = currentSpread;

    pages.forEach((page, index) => {
        const pageNum = index + 1;

        if (index < flippedCount) {
            // This page is flipped (on the left side)
            // Higher index = more recently flipped = on top
            page.style.zIndex = index + 1;
        } else {
            // This page is not flipped (on the right side or not visible)
            // Lower index = next to flip = on top
            page.style.zIndex = totalPages - index;
        }
    });

    // Debug output
    console.log(`Spread ${currentSpread}:`,
        currentSpread === 0 ? 'Front Cover' :
        currentSpread >= totalPages ? 'Back Cover' :
        `Left=Page${currentSpread} back, Right=Page${currentSpread + 1} front`
    );
}

// ===== DRAG LISTENERS =====
function setupDragListeners() {
    book.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    book.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
    document.addEventListener('touchcancel', handleDragEnd);

    book.addEventListener('contextmenu', e => e.preventDefault());
}

// ===== KEYBOARD =====
function setupKeyboardListeners() {
    document.addEventListener('keydown', e => {
        if (isAnimating || isDragging) return;
        if (e.key === 'ArrowRight') flipToNextSpread();
        if (e.key === 'ArrowLeft') flipToPrevSpread();
    });
}

// ===== DRAG HANDLERS =====
function handleDragStart(e) {
    if (isAnimating) return;

    isDragging = true;
    startX = getEventX(e);
    currentX = startX;

    if (swipeHint) swipeHint.classList.add('hidden');
    e.preventDefault();
}

function handleDragMove(e) {
    if (!isDragging) return;

    currentX = getEventX(e);
    const deltaX = currentX - startX;

    // Determine direction and get page to flip
    if (!draggedPage) {
        if (deltaX < -10) {
            // Dragging left = flip forward
            dragDirection = 'forward';
            draggedPage = getPageToFlipForward();
        } else if (deltaX > 10) {
            // Dragging right = flip backward
            dragDirection = 'backward';
            draggedPage = getPageToFlipBackward();
        }

        if (draggedPage) {
            draggedPage.classList.add('dragging', 'flipping');
        }
    }

    if (draggedPage) {
        applyDragRotation(deltaX);
    }

    e.preventDefault();
}

function handleDragEnd() {
    if (!isDragging) return;

    isDragging = false;
    const deltaX = currentX - startX;

    if (draggedPage) {
        draggedPage.classList.remove('dragging');

        if (Math.abs(deltaX) > DRAG_THRESHOLD) {
            completeFlip();
        } else {
            cancelFlip();
        }
    }

    draggedPage = null;
    dragDirection = null;
}

// ===== ROTATION DURING DRAG =====
function applyDragRotation(deltaX) {
    if (!draggedPage) return;

    let rotation;
    const maxDrag = 300;
    const clampedDelta = Math.max(-maxDrag, Math.min(maxDrag, deltaX));

    if (dragDirection === 'forward') {
        // Rotate from 0 to -180
        const progress = Math.abs(clampedDelta) / maxDrag;
        rotation = -progress * 180;
    } else {
        // Rotate from -180 to 0
        const progress = Math.abs(clampedDelta) / maxDrag;
        rotation = -180 + progress * 180;
    }

    draggedPage.style.transform = `rotateY(${rotation}deg)`;
}

// ===== COMPLETE FLIP =====
function completeFlip() {
    if (!draggedPage) return;

    const page = draggedPage;
    isAnimating = true;

    // Check if we're flipping back from back cover BEFORE changing state
    const wasAtBackCover = dragDirection === 'backward' && currentSpread >= totalPages;

    // Clear inline transform, let CSS handle it
    page.style.transform = '';

    if (dragDirection === 'forward') {
        page.classList.add('flipped');
        currentSpread++;
    } else {
        page.classList.remove('flipped');
        currentSpread--;
    }

    // Delay book state change when coming from back cover
    // This lets the page flip start before the book repositions
    if (wasAtBackCover) {
        setTimeout(() => {
            updateBookState();
        }, 150);
    } else {
        updateBookState();
    }

    setTimeout(() => {
        page.classList.remove('flipping');
        isAnimating = false;
    }, ANIMATION_DURATION);
}

// ===== CANCEL FLIP =====
function cancelFlip() {
    if (!draggedPage) return;

    const page = draggedPage;
    isAnimating = true;

    // Return to original state
    if (dragDirection === 'forward') {
        page.style.transform = 'rotateY(0deg)';
    } else {
        page.style.transform = 'rotateY(-180deg)';
    }

    setTimeout(() => {
        page.style.transform = '';
        page.classList.remove('flipping');
        isAnimating = false;
    }, ANIMATION_DURATION);
}

// ===== KEYBOARD FLIP =====
function flipToNextSpread() {
    const page = getPageToFlipForward();
    if (!page || isAnimating) return;

    isAnimating = true;
    page.classList.add('flipping');
    page.classList.add('flipped');
    currentSpread++;

    if (swipeHint) swipeHint.classList.add('hidden');

    updateBookState();

    setTimeout(() => {
        page.classList.remove('flipping');
        isAnimating = false;
    }, ANIMATION_DURATION);
}

function flipToPrevSpread() {
    const page = getPageToFlipBackward();
    if (!page || isAnimating) return;

    const wasAtBackCover = currentSpread >= totalPages;

    isAnimating = true;
    page.classList.add('flipping');
    page.classList.remove('flipped');
    currentSpread--;

    // Delay book state change when coming from back cover
    // This lets the page flip start before the book repositions
    if (wasAtBackCover) {
        setTimeout(() => {
            updateBookState();
        }, 150);
    } else {
        updateBookState();
    }

    setTimeout(() => {
        page.classList.remove('flipping');
        isAnimating = false;
    }, ANIMATION_DURATION);
}

// ===== HELPERS =====
function getPageToFlipForward() {
    // The page at index currentSpread is the next to flip
    if (currentSpread >= totalPages) return null;
    return pages[currentSpread];
}

function getPageToFlipBackward() {
    // The page at index currentSpread-1 is the last flipped
    if (currentSpread <= 0) return null;
    return pages[currentSpread - 1];
}

function updateBookState() {
    // Update open/closed state
    // Book is OPEN when viewing spreads (between front and back cover)
    // Book is CLOSED when at front cover (0) or back cover (totalPages)
    if (currentSpread > 0 && currentSpread < totalPages) {
        book.classList.add('open');
        book.classList.remove('closed-back');
    } else if (currentSpread >= totalPages) {
        // Back cover - close immediately
        // Page 14 flips naturally, its back IS the back cover
        book.classList.remove('open');
        book.classList.add('closed-back');
    } else {
        // Front cover
        book.classList.remove('open');
        book.classList.remove('closed-back');
    }

    // Update z-index for all pages
    updatePageZIndex();
}

function getEventX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
}

// ===== START =====
document.addEventListener('DOMContentLoaded', init);
