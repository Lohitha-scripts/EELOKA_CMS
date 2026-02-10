document.addEventListener('DOMContentLoaded', () => {
    // --- Backend API base ---
    const API_BASE = window.API_BASE || 'http://localhost:3001/api';
    // Graceful placeholder (avoids broken image icon). Keep it simple—no UI redesign.
    const PLACEHOLDER_IMG =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
              <rect width="100%" height="100%" fill="#f2f2f2"/>
              <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="20" fill="#888">Preview unavailable</text>
            </svg>`
        );

    function setImgFallback(imgEl) {
        if (!imgEl) return;
        imgEl.onerror = null;
        imgEl.src = PLACEHOLDER_IMG;
        imgEl.alt = "Preview unavailable";
    }

    //Header/Footer & Inactivity
    const header = document.querySelector(".header");
    const footer = document.querySelector(".footer");
    const readerControls = document.querySelector(".reader-controls");
    let inactivityTimer;

    function showUI() {
        if (header) header.style.transform = "translateY(0)";
        if (footer) footer.style.transform = "translateY(0)";
        if (readerControls) readerControls.style.transform = "translateY(0)";
        document.body.classList.remove("ui-hidden");
        resetTimer();
    }

    function hideUI() {
        if (header) header.style.transform = "translateY(-100%)";
        if (footer) footer.style.transform = "translateY(100%)";
        if (readerControls) readerControls.style.transform = "translateY(-65px)";
        document.body.classList.add("ui-hidden");
    }

    function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(hideUI, 5000);
    }

    if (header || footer) {
        const events = ["mousemove", "scroll", "click", "touchstart", "keydown"];
        events.forEach(event => {
            document.addEventListener(event, showUI, { passive: true });
        });
        resetTimer();
    }

    // Burger Menu
    const burger = document.querySelector('.burger');
    const navList = document.querySelector('.nav-menu');

    if (burger && navList) {
        burger.addEventListener('click', (e) => {
            e.stopPropagation();
            navList.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (navList.classList.contains('active')) {
                if (!navList.contains(e.target) && !burger.contains(e.target)) {
                    navList.classList.remove('active');
                }
            }
        }, true);
    }

    // --- Data from backend (single source of truth = Drive) ---
    let papersCache = [];
    let availableIsoDates = new Set(); // YYYY-MM-DD

    function isoToDdMmYyyy(iso) {
        const [y, m, d] = iso.split('-');
        return `${d}-${m}-${y}`;
    }

    function isoToPretty(iso) {
        const [y, m, d] = iso.split('-');
        return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleString('default', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    async function fetchPapers() {
        const res = await fetch(`${API_BASE}/papers`);
        const json = await res.json();
        if (!json?.success) throw new Error('Failed to load papers');
        return Array.isArray(json.data) ? json.data : [];
    }

    //Live Date & Init Pagination
    const liveDateEl = document.getElementById('live-date');
    if (liveDateEl) {
        const now = new Date();
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        liveDateEl.innerText = now.toLocaleDateString('en-GB', options);
    }
    // --- Video Modal Logic ---
    const videoModal = document.getElementById('video-modal');
    const videoIframe = document.getElementById('video-iframe');
    const btnCloseVideo = document.getElementById('btn-close-video');
    const YOUTUBE_ID = 'LIVE_VIDEO_ID'; // Placeholder ID, normally from config

    window.openVideoModal = function () {
        if (videoModal && videoIframe) {
            videoModal.style.display = 'flex';
            videoIframe.src = `https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1`;
        }
    };

    if (btnCloseVideo) {
        btnCloseVideo.onclick = () => {
            if (videoModal) videoModal.style.display = 'none';
            if (videoIframe) videoIframe.src = ''; // Stop video
        };
    }

    // Reusable Calendar Logic (Drive-driven: only dates present in API are active/clickable)
    function initCalendar(container) {
        if (!container) return;

        const today = new Date();
        let currentViewDate = new Date(today);

        function render(date) {
            container.innerHTML = '';

            const year = date.getFullYear();
            const month = date.getMonth();

            // Header
            const header = document.createElement('div');
            header.className = 'cal-header';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'cal-nav-btn';
            prevBtn.innerText = '<';
            prevBtn.onclick = (e) => {
                e.stopPropagation();
                date.setMonth(date.getMonth() - 1);
                render(date);
            };

            const selectsDiv = document.createElement('div');
            selectsDiv.className = 'cal-selects';

            const monthSelect = document.createElement('select');
            monthSelect.className = 'cal-dropdown';
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            monthNames.forEach((m, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.innerText = m;
                if (i === month) opt.selected = true;
                monthSelect.appendChild(opt);
            });
            monthSelect.onchange = (e) => {
                date.setMonth(parseInt(e.target.value));
                render(date);
            };
            monthSelect.onclick = (e) => e.stopPropagation();

            const yearSelect = document.createElement('select');
            yearSelect.className = 'cal-dropdown';
            // Keep existing UI (dropdown), but drive it from available dates.
            const years = Array.from(availableIsoDates)
                .map(d => Number(d.slice(0, 4)))
                .sort((a, b) => a - b);
            const uniqueYears = [...new Set(years)];
            // Fallback to current year if cache isn't loaded yet.
            const yrs = uniqueYears.length ? uniqueYears : [year];
            yrs.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.innerText = y;
                if (y === year) opt.selected = true;
                yearSelect.appendChild(opt);
            });
            yearSelect.onchange = (e) => {
                date.setFullYear(parseInt(e.target.value, 10));
                render(date);
            };
            yearSelect.onclick = (e) => e.stopPropagation();

            selectsDiv.appendChild(monthSelect);
            selectsDiv.appendChild(yearSelect);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'cal-nav-btn';
            nextBtn.innerText = '>';
            nextBtn.onclick = (e) => {
                e.stopPropagation();
                date.setMonth(date.getMonth() + 1);
                render(date);
            };

            header.appendChild(prevBtn);
            header.appendChild(selectsDiv);
            header.appendChild(nextBtn);
            container.appendChild(header);

            // Grid
            const grid = document.createElement('div');
            grid.className = 'cal-grid';

            const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
            days.forEach(d => {
                const el = document.createElement('div');
                el.className = 'cal-day-name';
                el.innerText = d;
                grid.appendChild(el);
            });

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            for (let i = 0; i < firstDay; i++) {
                const el = document.createElement('div');
                el.className = 'cal-date empty';
                grid.appendChild(el);
            }

            for (let i = 1; i <= daysInMonth; i++) {
                const el = document.createElement('div');
                el.className = 'cal-date';
                el.innerText = i;

                const dStr = String(i).padStart(2, '0');
                const mStr = String(month + 1).padStart(2, '0');
                const yStr = year;
                const iso = `${yStr}-${mStr}-${dStr}`;

                const isActive = availableIsoDates.has(iso);
                const isToday = iso === new Date().toISOString().slice(0, 10);

                if (isActive) {
                    el.classList.add('active');
                    if (isToday) el.classList.add('today');

                    el.onclick = (e) => {
                        e.stopPropagation();
                        window.openViewer(isoToDdMmYyyy(iso));
                    };
                } else {
                    el.classList.add('disabled');
                }

                grid.appendChild(el);
            }
            container.appendChild(grid);
        }
        render(currentViewDate);
    }

    // Init Homepage Calendar
    const homepageCalendar = document.getElementById('homepage-calendar');
    if (homepageCalendar) {
        // We'll init after papers load, so "active" dates are strictly Drive-driven.
    }

    async function initPaginationAndHero() {
        const gridContainer = document.getElementById('epaper-grid');
        const todayContainer = document.getElementById('today-paper-container');
        const paginationContainer = document.getElementById('pagination-controls');

        if (!gridContainer || !todayContainer) return;

        // Keep UI pagination but balance rows: 10 items/page (5x2) on desktop grid.
        const itemsPerPage = 10;

        // Today’s paper = newest returned by backend (which is Drive-driven).
        const todayPaper = papersCache[0] || null;
        if (!todayPaper) {
            todayContainer.innerHTML = `<div style="padding:16px;">No papers available.</div>`;
            gridContainer.innerHTML = '';
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        const dateStr = isoToDdMmYyyy(todayPaper.date);
        const displayDate = isoToPretty(todayPaper.date);
        const todayIso = todayPaper.date;

        todayContainer.innerHTML = `
            <div onclick="openViewer('${dateStr}')" style="cursor: pointer; height: 100%;">
                <img id="today-preview-img" src="${API_BASE}/papers/${todayIso}/preview" alt="Today's Paper">
                <div class="today-label">
                    <h2>Today's Edition</h2>
                    <p>${displayDate}</p>
                </div>
            </div>
        `;
        const todayImg = document.getElementById("today-preview-img");
        if (todayImg) todayImg.onerror = () => setImgFallback(todayImg);

        // Previous papers = rest (Drive-driven).
        const archiveData = papersCache.slice(1);

        function renderGrid(page) {
            gridContainer.innerHTML = '';

            const start = (page - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = archiveData.slice(start, end);

            pageItems.forEach(item => {
                const dateStr = isoToDdMmYyyy(item.date);
                const [y, m, d] = item.date.split('-');
                const prettyDate = `${d} ${new Date(Number(y), Number(m) - 1, Number(d)).toLocaleString('default', { month: 'short' })} ${y}`;
                const iso = item.date;

                const card = document.createElement('div');
                card.className = 'paper-card';
                card.onclick = () => window.openViewer(dateStr);
                card.innerHTML = `
                    <div class="img-wrapper" style="overflow: hidden;">
                        <img src="${API_BASE}/papers/${iso}/thumbnail" alt="Paper">
                    </div>
                    <div class="paper-info">
                        <h4>Eeloka</h4>
                        <p>${prettyDate}</p>
                    </div>
               `;
                const img = card.querySelector("img");
                if (img) img.onerror = () => setImgFallback(img);
                gridContainer.appendChild(card);
            });

            renderPaginationControl(page);
        }

        function renderPaginationControl(activePage) {
            if (!paginationContainer) return;
            paginationContainer.innerHTML = '';

            const totalPages = Math.ceil(archiveData.length / itemsPerPage);

            // Prev
            if (activePage > 1) {
                const prev = createPageBtn('< Previous', () => renderGrid(activePage - 1));
                paginationContainer.appendChild(prev);
            }

            // Numbers
            for (let p = 1; p <= totalPages; p++) {
                const btn = createPageBtn(p, () => renderGrid(p));
                if (p === activePage) btn.classList.add('active');
                paginationContainer.appendChild(btn);
            }

            // Next
            if (activePage < totalPages) {
                const next = createPageBtn('Next >', () => renderGrid(activePage + 1));
                paginationContainer.appendChild(next);
            }
        }

        function createPageBtn(text, onClick) {
            const btn = document.createElement('button');
            btn.className = 'pagination-btn';
            btn.innerText = text;
            btn.onclick = onClick;
            return btn;
        }

        // Init
        renderGrid(1);
    }    // --- Modal Viewer Logic ---
    const modal = document.getElementById('viewer-modal');
    const modalViewerContainer = document.getElementById('modal-viewer-container');
    const pdfCanvas = document.getElementById('pdf-render-canvas');
    const modalThumbContainer = document.getElementById('modal-thumbnails');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnClipToggle = document.getElementById('btn-clip-toggle');
    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    const modalPrevBtn = document.getElementById('modal-prev-btn');
    const modalNextBtn = document.getElementById('modal-next-btn');
    const modalPageNum = document.getElementById('modal-page-num');
    const btnWatchLive = document.getElementById('btn-watch-live');
    const paperPrevArrow = document.getElementById('paper-prev-arrow');
    const paperNextArrow = document.getElementById('paper-next-arrow');

    // Clipping Elements
    const clippingOverlay = document.getElementById('clipping-overlay');
    const clipResultModal = document.getElementById('clip-result-modal');
    const clippedImage = document.getElementById('clipped-image');
    const btnCloseClipModal = document.getElementById('btn-close-clip-modal');
    const btnDownloadClip = document.getElementById('btn-download-clip');

    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let ctx = pdfCanvas ? pdfCanvas.getContext('2d') : null;
    let currentPaperDate = '';
    let isClippingMode = false;
    let currentPaperIndex = -1;
    let paperArrowTimer = null;

    // --- Exposed Global for onclick in generated HTML ---
    window.openViewer = function (dateStr) {
        currentPaperDate = dateStr;
        // Track current paper index (ISO dates match backend order)
        try {
            const [dd, mm, yyyy] = dateStr.split('-');
            const iso = `${yyyy}-${mm}-${dd}`;
            currentPaperIndex = papersCache.findIndex(p => p.date === iso);
        } catch {
            currentPaperIndex = -1;
        }
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock Body Scroll
        loadPaper(dateStr);
    };

    function closeViewer() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        pdfDoc = null;
        pageNum = 1;
        ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

        // Reset Clipping
        stopClipping();
    }

    function stopClipping() {
        isClippingMode = false;
        if (clippingOverlay) {
            clippingOverlay.style.display = 'none';
            clippingOverlay.innerHTML = '';
        }
        if (btnClipToggle) {
            btnClipToggle.style.background = '';
            btnClipToggle.classList.remove('active');
        }
        const hotspots = document.querySelectorAll('.nav-hotspot, .viewer-paper-arrow');
        hotspots.forEach(h => h.style.pointerEvents = 'auto');
    }

    if (btnCloseModal) btnCloseModal.onclick = closeViewer;

    if (btnWatchLive) {
        btnWatchLive.onclick = () => {
            if (typeof window.openVideoModal === 'function') {
                window.openVideoModal();
            }
        };
    }

    // --- PDF Logic ---
    async function loadPaper(dateStr) {
        try {
            document.title = `E-Paper – ${dateStr}`;
            // Backend is the only source of truth for PDFs (Drive-driven).
            // dateStr is DD-MM-YYYY from UI; backend route expects YYYY-MM-DD, so we convert.
            const [dd, mm, yyyy] = dateStr.split('-');
            const iso = `${yyyy}-${mm}-${dd}`;
            const url = `${API_BASE}/papers/${iso}/pdf`;

            // Fallback for demo if file doesn't exist (simulated by checking if dates match demo)
            // In real app, PDFJS handles 404

            // Disable range/stream to avoid cross-origin/range issues and keep behavior consistent.
            const loadingTask = pdfjsLib.getDocument({
                url,
                disableRange: true,
                disableStream: true
            });
            pdfDoc = await loadingTask.promise;

            // Desktop thumbnails sidebar only (>=1024px). On mobile, keep it empty.
            const isDesktop = window.matchMedia && window.matchMedia("(min-width: 1024px)").matches;
            modalThumbContainer.innerHTML = '';
            if (isDesktop) {
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    const thumb = document.createElement('div');
                    thumb.className = `thumb-item ${i === 1 ? 'active' : ''}`;

                    const canvas = document.createElement('canvas');
                    canvas.className = 'thumb-canvas';
                    thumb.appendChild(canvas);

                    const label = document.createElement('span');
                    label.textContent = `Page ${i}`;
                    thumb.appendChild(label);

                    thumb.onclick = () => queueRenderPage(i);
                    modalThumbContainer.appendChild(thumb);

                    // Render thumbnail from actual PDF page (viewer-only; landing page uses backend preview endpoints).
                    // eslint-disable-next-line no-loop-func
                    pdfDoc.getPage(i).then(page => {
                        const viewport = page.getViewport({ scale: 0.2 });
                        canvas.width = Math.floor(viewport.width);
                        canvas.height = Math.floor(viewport.height);
                        const tctx = canvas.getContext('2d');
                        page.render({ canvasContext: tctx, viewport });
                    });
                }
            }

            renderPage(pageNum);
        } catch (error) {
            console.error(error);
            // Optionally handle error UI
            alert("Could not load PDF for this date.");
            closeViewer();
        }
    }

    function renderPage(num) {
        pageRendering = true;

        pdfDoc.getPage(num).then(function (page) {
            const containerWidth = modalViewerContainer.clientWidth;
            // Calculate scale to fit width with minimal side gutters
            const viewportRaw = page.getViewport({ scale: 1 });
            const scale = containerWidth / viewportRaw.width;
            const viewport = page.getViewport({ scale });

            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            const renderTask = page.render(renderContext);

            renderTask.promise.then(function () {
                pageRendering = false;
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }

                // Reset scroll to top on every page change
                if (modalViewerContainer) {
                    modalViewerContainer.scrollTop = 0;
                }

                // Reset/realign clipping overlay dimensions to match the rendered page.
                alignClippingOverlayToCanvas();
            });
        });

        pageNum = num;
        modalPageNum.innerText = `Page ${num}`;
        updateThumbActiveState(num);
    }

    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    function updateThumbActiveState(num) {
        const thumbs = document.querySelectorAll('.thumb-item');
        thumbs.forEach((t, i) => {
            t.classList.toggle('active', i === num - 1);
            if (i === num - 1) t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

    // --- Navigation ---
    const onPrev = () => { if (pageNum <= 1) return; queueRenderPage(pageNum - 1); };
    const onNext = () => { if (pageNum >= pdfDoc.numPages) return; queueRenderPage(pageNum + 1); };

    if (modalPrevBtn) modalPrevBtn.onclick = onPrev;
    if (modalNextBtn) modalNextBtn.onclick = onNext;

    // Mobile Hotspots
    const spotLeft = document.getElementById('hotspot-left');
    const spotRight = document.getElementById('hotspot-right');
    if (spotLeft) spotLeft.onclick = onPrev;
    if (spotRight) spotRight.onclick = onNext;

    function showPaperArrows() {
        if (paperPrevArrow) paperPrevArrow.style.opacity = '1';
        if (paperNextArrow) paperNextArrow.style.opacity = '1';
        if (paperArrowTimer) clearTimeout(paperArrowTimer);
        paperArrowTimer = setTimeout(() => {
            if (paperPrevArrow) paperPrevArrow.style.opacity = '0';
            if (paperNextArrow) paperNextArrow.style.opacity = '0';
        }, 1000);
    }

    if (paperPrevArrow) {
        paperPrevArrow.onclick = (e) => {
            e.stopPropagation();
            onPrev();
        };
    }

    if (paperNextArrow) {
        paperNextArrow.onclick = (e) => {
            e.stopPropagation();
            onNext();
        };
    }

    if (modalViewerContainer) {
        ['mousemove', 'touchstart'].forEach(evt => {
            modalViewerContainer.addEventListener(evt, showPaperArrows, { passive: true });
        });
    }


    // --- Clipping Tool ---
    let startX, startY, isSelecting = false;
    let rect = {};

    function alignClippingOverlayToCanvas() {
        if (!pdfCanvas || !clippingOverlay) return;
        clippingOverlay.style.left = `${pdfCanvas.offsetLeft}px`;
        clippingOverlay.style.top = `${pdfCanvas.offsetTop}px`;
        clippingOverlay.style.width = `${pdfCanvas.offsetWidth}px`;
        clippingOverlay.style.height = `${pdfCanvas.offsetHeight}px`;
    }

    if (btnClipToggle) {
        btnClipToggle.onclick = () => {
            isClippingMode = !isClippingMode;
            if (isClippingMode) {
                clippingOverlay.innerHTML = ''; // Clean start
                clippingOverlay.style.display = 'block';
                alignClippingOverlayToCanvas();
                btnClipToggle.style.background = 'rgba(255,255,255,0.2)';
                const hotspots = document.querySelectorAll('.nav-hotspot, .viewer-paper-arrow');
                hotspots.forEach(h => h.style.pointerEvents = 'none');
            } else {
                stopClipping();
            }
        };
    }

    // Mouse + touch selection on clipping overlay (mobile + desktop)
    function getPointFromEvent(e) {
        const t = e.touches && e.touches[0] ? e.touches[0] : e;
        return { clientX: t.clientX, clientY: t.clientY };
    }

    function onSelectStart(e) {
        e.preventDefault?.();
        isSelecting = true;
        const bounds = clippingOverlay.getBoundingClientRect();
        const pt = getPointFromEvent(e);
        startX = pt.clientX - bounds.left;
        startY = pt.clientY - bounds.top;

        // Remove existing selection box if any
        clippingOverlay.innerHTML = '';

        const selectionBox = document.createElement('div');
        selectionBox.id = 'selection-box';
        selectionBox.style.border = '2px dashed red';
        selectionBox.style.position = 'absolute';
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        clippingOverlay.appendChild(selectionBox);
    }

    function onSelectMove(e) {
        if (!isSelecting) return;
        e.preventDefault?.();
        const bounds = clippingOverlay.getBoundingClientRect();
        const pt = getPointFromEvent(e);
        const currentX = pt.clientX - bounds.left;
        const currentY = pt.clientY - bounds.top;

        const width = currentX - startX;
        const height = currentY - startY;

        const box = document.getElementById('selection-box');
        if (box) {
            box.style.width = Math.abs(width) + 'px';
            box.style.height = Math.abs(height) + 'px';
            box.style.left = (width < 0 ? currentX : startX) + 'px';
            box.style.top = (height < 0 ? currentY : startY) + 'px';
        }
    }

    function onSelectEnd(e) {
        if (!isSelecting) return;
        e.preventDefault?.();
        isSelecting = false;

        const box = document.getElementById('selection-box');
        if (!box || parseInt(box.style.width) < 10) return; // Ignore tiny clicks

        const bounds = clippingOverlay.getBoundingClientRect();
        const endEvent = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
        const pt = getPointFromEvent(endEvent);
        const endX = pt.clientX - bounds.left;
        const endY = pt.clientY - bounds.top;

        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(startX - endX);
        const h = Math.abs(startY - endY);

        if (!pdfCanvas || w <= 0 || h <= 0) return;

        const scaleX = pdfCanvas.width / bounds.width;
        const scaleY = pdfCanvas.height / bounds.height;
        const sx = x * scaleX;
        const sy = y * scaleY;
        const sw = w * scaleX;
        const sh = h * scaleY;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(pdfCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

        clippedImage.src = tempCanvas.toDataURL('image/png');
        clipResultModal.style.display = 'block';
    }

    clippingOverlay.addEventListener('mousedown', onSelectStart);
    clippingOverlay.addEventListener('mousemove', onSelectMove);
    clippingOverlay.addEventListener('mouseup', onSelectEnd);
    clippingOverlay.addEventListener('mouseleave', onSelectEnd);
    clippingOverlay.addEventListener('touchstart', onSelectStart, { passive: false });
    clippingOverlay.addEventListener('touchmove', onSelectMove, { passive: false });
    clippingOverlay.addEventListener('touchend', onSelectEnd, { passive: false });

    if (btnCloseClipModal) {
        btnCloseClipModal.onclick = () => {
            clipResultModal.style.display = 'none';
            stopClipping();
        };
    }

    // Download Clip
    if (btnDownloadClip) {
        btnDownloadClip.onclick = () => {
            if (!clippedImage || !clippedImage.src) return;
            const link = document.createElement('a');
            link.download = `clip-${currentPaperDate}.png`;
            link.href = clippedImage.src;
            link.click();
        };
    }

    // Share clipped image using existing button
    const btnShare = document.querySelector('.btn-share');
    if (btnShare) {
        btnShare.onclick = async () => {
            if (!clippedImage || !clippedImage.src) return;
            const url = clippedImage.src;
            const shareText = `E-paper clip (${currentPaperDate})`;

            if (navigator.share) {
                try {
                    await navigator.share({ title: 'E-paper clip', text: shareText, url });
                    return;
                } catch {
                    // fall through to WhatsApp-style share
                }
            }

            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`;
            window.open(whatsappUrl, '_blank');
        };
    }

    if (btnDownloadPdf) {
        btnDownloadPdf.onclick = () => {
            const [dd, mm, yyyy] = currentPaperDate.split('-');
            const iso = `${yyyy}-${mm}-${dd}`;
            // Same tab (browser PDF view), per requirement.
            window.location.href = `${API_BASE}/papers/${iso}/pdf`;
        };
    }

    // --- Bootstrap data-driven UI ---
    (async () => {
        try {
            papersCache = await fetchPapers();
            availableIsoDates = new Set(papersCache.map(p => p.date));

            // Now that available dates are known, init calendar + archives.
            const homepageCalendar = document.getElementById('homepage-calendar');
            if (homepageCalendar) initCalendar(homepageCalendar);
            await initPaginationAndHero();
        } catch (e) {
            console.error(e);
            const todayContainer = document.getElementById('today-paper-container');
            if (todayContainer) todayContainer.innerHTML = `<div style="padding:16px;">Failed to load papers.</div>`;
        }
    })();

});  // End DOMContentLoaded
