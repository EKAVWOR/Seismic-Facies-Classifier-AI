/* ─── Render Facies Map + Overlay ─── */
window.S = window.S || {};

S.Renderer = (() => {

    const { PATCH, CLASSES } = S.Config;

    /**
     *  Draw the colour-coded facies map.
     *  classes : Int32Array (gridRows * gridCols)
     */
    function drawFaciesMap (canvas, classes, gridCols, gridRows) {
        const W = gridCols * PATCH;
        const H = gridRows * PATCH;
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(W, H);

        for (let gr = 0; gr < gridRows; gr++)
            for (let gc = 0; gc < gridCols; gc++) {
                const cls  = classes[gr * gridCols + gc];
                const rgb  = CLASSES[cls].rgb;
                const x0   = gc * PATCH, y0 = gr * PATCH;

                for (let py = 0; py < PATCH; py++)
                    for (let px = 0; px < PATCH; px++) {
                        const i = ((y0+py)*W + (x0+px)) * 4;
                        img.data[i]   = rgb[0];
                        img.data[i+1] = rgb[1];
                        img.data[i+2] = rgb[2];
                        img.data[i+3] = 255;
                    }

                /* thin grid line between patches */
                for (let py = 0; py < PATCH; py++) {
                    const i = ((y0+py)*W + x0) * 4;
                    img.data[i] = img.data[i+1] = img.data[i+2] = 30;
                }
                for (let px = 0; px < PATCH; px++) {
                    const i = (y0*W + (x0+px)) * 4;
                    img.data[i] = img.data[i+1] = img.data[i+2] = 30;
                }
            }

        ctx.putImageData(img, 0, 0);
    }

    /**
     *  Blend original grayscale image with facies colours.
     *  opacity : 0..1
     */
    function drawOverlay (canvas, gray, classes, gridCols, gridRows, padW, padH, opacity) {
        canvas.width  = padW;
        canvas.height = padH;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(padW, padH);

        for (let y = 0; y < padH; y++)
            for (let x = 0; x < padW; x++) {
                const gc  = Math.min((x / PATCH) | 0, gridCols - 1);
                const gr  = Math.min((y / PATCH) | 0, gridRows - 1);
                const cls = classes[gr * gridCols + gc];
                const rgb = CLASSES[cls].rgb;
                const g   = gray[y * padW + x] * 255;

                const i = (y * padW + x) * 4;
                img.data[i]   = g * (1-opacity) + rgb[0] * opacity;
                img.data[i+1] = g * (1-opacity) + rgb[1] * opacity;
                img.data[i+2] = g * (1-opacity) + rgb[2] * opacity;
                img.data[i+3] = 255;
            }

        ctx.putImageData(img, 0, 0);
    }

    /**
     *  Draw original image from gray Float32Array.
     */
    function drawGray (canvas, gray, w, h) {
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(w, h);
        for (let i = 0; i < w*h; i++) {
            const v = gray[i] * 255;
            const j = i * 4;
            img.data[j] = img.data[j+1] = img.data[j+2] = v;
            img.data[j+3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }

    /**
     *  Fill legend container.
     */
    function buildLegend (container) {
        container.innerHTML = '';
        CLASSES.forEach(c => {
            const el = document.createElement('div');
            el.className = 'legend-item';
            el.innerHTML = `<span class="legend-swatch" style="background:${c.hex}"></span>${c.name}`;
            container.appendChild(el);
        });
    }

    /**
     *  Draw statistics bars.
     */
    function buildStats (container, classes, total) {
        container.innerHTML = '';
        const counts = new Array(CLASSES.length).fill(0);
        classes.forEach(c => counts[c]++);

        CLASSES.forEach((cls, i) => {
            const pct = ((counts[i]/total)*100).toFixed(1);
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <span class="stat-label">${cls.name}</span>
                <div class="stat-track">
                    <div class="stat-fill" style="width:${pct}%;background:${cls.hex}"></div>
                </div>
                <span class="stat-pct">${pct}%</span>`;
            container.appendChild(row);
        });
    }

    return { drawFaciesMap, drawOverlay, drawGray, buildLegend, buildStats };

})();