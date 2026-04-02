/* ─── Synthetic Seismic Patch Generator ─── */
window.S = window.S || {};

S.SyntheticData = (() => {

    const { PATCH, NCLASS } = S.Config;

    /* ---- helper: clamp 0-1 ---- */
    const clamp = v => Math.max(0, Math.min(1, v));

    /* ====== Per-class generators ====== */

    function genSand (sz) {
        const d = new Float32Array(sz * sz);
        const f = 0.08 + Math.random() * 0.15;          // low freq
        const p = Math.random() * Math.PI * 2;
        const a = 0.03 + Math.random() * 0.04;
        const b = 0.42 + Math.random() * 0.14;
        for (let y = 0; y < sz; y++) {
            const lv = b + a * Math.sin(f * y + p);
            for (let x = 0; x < sz; x++)
                d[y * sz + x] = clamp(lv + (Math.random() - .5) * .06);
        }
        return d;
    }

    function genShale (sz) {
        const d = new Float32Array(sz * sz);
        const f1 = 0.35 + Math.random() * .4;
        const f2 = f1 * (2.3 + Math.random());
        const p  = Math.random() * Math.PI * 2;
        const a  = 0.18 + Math.random() * .14;
        for (let y = 0; y < sz; y++) {
            const lv = 0.5 + a * Math.sin(f1*y + p) + a*.25*Math.sin(f2*y + p*1.4);
            for (let x = 0; x < sz; x++)
                d[y*sz+x] = clamp(lv + (Math.random()-.5)*.04);
        }
        return d;
    }

    function genFault (sz) {
        const d = new Float32Array(sz * sz);
        const freq  = 0.22 + Math.random() * .18;
        const amp   = 0.14 + Math.random() * .10;
        const slope = 0.3  + Math.random() * .8;
        const off   = 3    + Math.random() * 6;
        const fx0   = sz * (.25 + Math.random() * .5);
        for (let y = 0; y < sz; y++)
            for (let x = 0; x < sz; x++) {
                const line = fx0 + (y - sz/2) * slope;
                const yy   = x > line ? y + off : y;
                d[y*sz+x]  = clamp(.5 + amp*Math.sin(freq*yy) + (Math.random()-.5)*.04);
            }
        return d;
    }

    function genChannel (sz) {
        const d   = new Float32Array(sz * sz);
        const cx  = sz*(.25 + Math.random()*.5);
        const cy  = sz*(.25 + Math.random()*.5);
        const cur = 0.004 + Math.random() * .012;
        const b   = 0.38 + Math.random() * .12;
        for (let y = 0; y < sz; y++)
            for (let x = 0; x < sz; x++) {
                const r2 = (x-cx)**2 + (y-cy)**2;
                d[y*sz+x] = clamp(b + .32*Math.exp(-r2*cur) + .08*Math.sin(y*.2) + (Math.random()-.5)*.05);
            }
        return d;
    }

    function genSalt (sz) {
        /* chaotic noise, lightly smoothed */
        const raw = Float32Array.from({length:sz*sz}, () => Math.random());
        const d   = new Float32Array(sz*sz);
        for (let y = 0; y < sz; y++)
            for (let x = 0; x < sz; x++) {
                let s = 0, c = 0;
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y+dy, nx = x+dx;
                        if (ny>=0 && ny<sz && nx>=0 && nx<sz) { s += raw[ny*sz+nx]; c++; }
                    }
                d[y*sz+x] = s/c;
            }
        return d;
    }

    function genCarbonate (sz) {
        const d = new Float32Array(sz*sz);
        const b = 0.48 + Math.random()*.1;
        for (let y = 0; y < sz; y++)
            for (let x = 0; x < sz; x++)
                d[y*sz+x] = clamp(b + .03*Math.sin(y*.14) + (Math.random()-.5)*.07);
        // scattered bright spots
        const n = 3 + Math.floor(Math.random()*6);
        for (let i = 0; i < n; i++) {
            const sx = Math.random()*sz|0, sy = Math.random()*sz|0;
            const r = 1 + Math.random()*2.5, br = .2+Math.random()*.2;
            for (let y = Math.max(0,sy-4); y < Math.min(sz,sy+5); y++)
                for (let x = Math.max(0,sx-4); x < Math.min(sz,sx+5); x++) {
                    const dist = Math.hypot(x-sx,y-sy);
                    if (dist < r) d[y*sz+x] = clamp(d[y*sz+x] + br*(1-dist/r));
                }
        }
        return d;
    }

    const GEN = [genSand, genShale, genFault, genChannel, genSalt, genCarbonate];

    /* ====== Public API ====== */

    /**
     *  Returns { patches: Float32Array[], labels: number[] }
     *  each patch is Float32Array(PATCH*PATCH), values 0-1
     */
    function generate (samplesPerClass) {
        const patches = [], labels = [];
        for (let c = 0; c < NCLASS; c++)
            for (let i = 0; i < samplesPerClass; i++) {
                patches.push(GEN[c](PATCH));
                labels.push(c);
            }
        // Fisher-Yates shuffle
        for (let i = patches.length - 1; i > 0; i--) {
            const j = Math.random() * (i+1) | 0;
            [patches[i],patches[j]] = [patches[j],patches[i]];
            [labels[i], labels[j]] = [labels[j], labels[i]];
        }
        return { patches, labels };
    }

    /* ====== Demo seismic section ====== */

    function generateDemoImage (cols, rows) {
        /*  cols x rows   in patches  →  pixel image  */
        const W = cols * PATCH, H = rows * PATCH;
        const data = new Float32Array(W * H);

        // decide which facies goes where
        for (let gr = 0; gr < rows; gr++)
            for (let gc = 0; gc < cols; gc++) {
                let cls;
                if (gr < rows * .35)                           cls = 1; // shale top
                else if (gr < rows*.65 && gc < cols*.5)        cls = 0; // sand mid-left
                else if (gr < rows*.65)                        cls = 3; // channel mid-right
                else if (gc < cols*.45)                        cls = 4; // salt bot-left
                else                                           cls = 5; // carbonate bot-right

                // add a fault stripe
                if (gc >= Math.floor(cols*.4) && gc <= Math.floor(cols*.45))
                    cls = 2;

                const patch = GEN[cls](PATCH);
                const x0 = gc * PATCH, y0 = gr * PATCH;
                for (let py = 0; py < PATCH; py++)
                    for (let px = 0; px < PATCH; px++)
                        data[(y0+py)*W + (x0+px)] = patch[py*PATCH+px];
            }
        return { data, width: W, height: H };
    }

    return { generate, generateDemoImage };

})();