/* ─── Image → Patches ─── */
window.S = window.S || {};

S.PatchExtractor = (() => {

    const { PATCH } = S.Config;

    /**
     *  Takes an HTMLCanvasElement with the loaded image,
     *  returns { gray, patches, gridCols, gridRows, padW, padH }
     *
     *  gray    : Float32Array  (padW * padH)   0-1
     *  patches : Float32Array  (N * PATCH*PATCH) flat
     */
    function extract (canvas) {

        const ctx = canvas.getContext('2d');
        const w   = canvas.width;
        const h   = canvas.height;
        const img = ctx.getImageData(0, 0, w, h);

        /* ---- pad to multiples of PATCH ---- */
        const padW = w + ((PATCH - w % PATCH) % PATCH);
        const padH = h + ((PATCH - h % PATCH) % PATCH);

        /* ---- convert to grayscale & pad ---- */
        const gray = new Float32Array(padW * padH);   // zero-padded

        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                gray[y * padW + x] =
                    (0.299 * img.data[i] +
                     0.587 * img.data[i+1] +
                     0.114 * img.data[i+2]) / 255;
            }

        /* ---- extract patches row-major ---- */
        const gridCols = padW / PATCH;
        const gridRows = padH / PATCH;
        const N        = gridCols * gridRows;
        const patches  = new Float32Array(N * PATCH * PATCH);

        for (let gr = 0; gr < gridRows; gr++)
            for (let gc = 0; gc < gridCols; gc++) {
                const idx = gr * gridCols + gc;
                const off = idx * PATCH * PATCH;
                for (let py = 0; py < PATCH; py++)
                    for (let px = 0; px < PATCH; px++)
                        patches[off + py * PATCH + px] =
                            gray[(gr*PATCH + py) * padW + (gc*PATCH + px)];
            }

        return { gray, patches, gridCols, gridRows, padW, padH, count: N };
    }

    return { extract };

})();