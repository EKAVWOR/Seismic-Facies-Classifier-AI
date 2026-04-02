/* ─── Main Application Controller ─── */
window.S = window.S || {};

(function () {
    'use strict';

    const { Config, SyntheticData, PatchExtractor, CNN, Renderer } = S;

    /* ─── DOM refs ─── */
    const $  = id => document.getElementById(id);
    const btnTrain    = $('btn-train');
    const btnSave     = $('btn-save');
    const btnLoad     = $('btn-load');
    const btnDemo     = $('btn-demo');
    const btnClassify = $('btn-classify');
    const inpEpochs   = $('inp-epochs');
    const inpSamples  = $('inp-samples');
    const fileInput   = $('file-input');
    const dropZone    = $('drop-zone');
    const rngOpacity  = $('rng-opacity');

    const cvOriginal  = $('cv-original');
    const cvFacies    = $('cv-facies');
    const cvOverlay   = $('cv-overlay');

    /* ─── State ─── */
    let extractedData = null;   // from PatchExtractor
    let classResults  = null;   // { classes, confidences }
    let chartHistory  = null;

    /* ========================================
       STEP 1  ──  Train
    ======================================== */

    btnTrain.addEventListener('click', async () => {
        const epochs         = parseInt(inpEpochs.value) || 15;
        const samplesPerCls  = parseInt(inpSamples.value) || 500;

        btnTrain.disabled = true;
        btnTrain.textContent = '⏳ Generating data…';

        // generate synthetic patches
        await sleep(50);                            // let UI update
        const data = SyntheticData.generate(samplesPerCls);

        btnTrain.textContent = '⏳ Training…';
        show('train-progress');
        chartHistory = null;

        CNN.build();

        await CNN.train(data, {
            epochs,
            onEpochEnd (epoch, logs, history) {
                chartHistory = history;
                const pct = ((epoch+1)/epochs*100).toFixed(0);
                $('bar-fill').style.width       = pct + '%';
                $('m-epoch').textContent         = `${epoch+1} / ${epochs}`;
                $('m-loss').textContent           = logs.loss.toFixed(4);
                $('m-acc').textContent            = (logs.acc*100).toFixed(1) + '%';
                $('m-val').textContent            = (logs.val_acc*100).toFixed(1) + '%';
                drawChart(history, epochs);
            }
        });

        btnTrain.disabled    = false;
        btnTrain.textContent = '🧠 Re-train Model';
        show('train-done');
        show('btn-save');
        enableClassify();
    });

    /* ── Save / Load ── */
    btnSave.addEventListener('click', async () => {
        try { await CNN.save(); alert('Model saved to browser storage.'); }
        catch(e){ alert(e.message); }
    });
    btnLoad.addEventListener('click', async () => {
        try {
            await CNN.load();
            show('train-done');
            show('btn-save');
            enableClassify();
            alert('Model loaded!');
        } catch(e) { alert('No saved model found.'); }
    });

    /* ========================================
       STEP 2  ──  Upload / Demo
    ======================================== */

    /* drag & drop */
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
    dropZone.addEventListener('dragleave', ()=> dropZone.classList.remove('over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('over');
        if (e.dataTransfer.files.length) loadImageFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) loadImageFile(fileInput.files[0]);
    });

    function loadImageFile (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => putImage(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function putImage (img) {
        cvOriginal.width  = img.width;
        cvOriginal.height = img.height;
        cvOriginal.getContext('2d').drawImage(img, 0, 0);
        extractedData = PatchExtractor.extract(cvOriginal);

        $('img-info').textContent =
            `📐 ${img.width}×${img.height}px   ` +
            `🔲 ${extractedData.count} patches   ` +
            `📏 ${extractedData.gridCols}×${extractedData.gridRows} grid`;
        show('img-info');
        enableClassify();
    }

    /* demo image */
    btnDemo.addEventListener('click', () => {
        const cols = 12, rows = 10;
        const { data, width, height } = SyntheticData.generateDemoImage(cols, rows);

        // draw on original canvas
        Renderer.drawGray(cvOriginal, data, width, height);

        // also extract patches properly
        extractedData = PatchExtractor.extract(cvOriginal);

        $('img-info').textContent =
            `📐 ${width}×${height}px   ` +
            `🔲 ${extractedData.count} patches   ` +
            `📏 ${extractedData.gridCols}×${extractedData.gridRows} grid`;
        show('img-info');
        enableClassify();
    });

    /* ========================================
       STEP 3  ──  Classify
    ======================================== */

    btnClassify.addEventListener('click', async () => {
        if (!CNN.ready() || !extractedData) return;

        btnClassify.disabled    = true;
        btnClassify.textContent = '⏳ Classifying…';

        await sleep(50);

        classResults = await CNN.predict(extractedData.patches, extractedData.count);

        /* draw facies map */
        Renderer.drawFaciesMap(
            cvFacies,
            classResults.classes,
            extractedData.gridCols,
            extractedData.gridRows
        );

        /* draw overlay */
        updateOverlay();

        /* legend */
        Renderer.buildLegend($('legend-items'));
        show('legend');

        /* stats */
        Renderer.buildStats($('stats-bars'), classResults.classes, extractedData.count);
        show('stats');

        /* show opacity slider */
        show('lbl-opacity');

        btnClassify.disabled    = false;
        btnClassify.textContent = '🔬 Re-classify';
    });

    /* opacity slider */
    rngOpacity.addEventListener('input', () => {
        $('val-opacity').textContent = rngOpacity.value + ' %';
        if (classResults) updateOverlay();
    });

    function updateOverlay () {
        Renderer.drawOverlay(
            cvOverlay,
            extractedData.gray,
            classResults.classes,
            extractedData.gridCols,
            extractedData.gridRows,
            extractedData.padW,
            extractedData.padH,
            rngOpacity.value / 100
        );
    }

    /* ========================================
       Training Chart  (simple canvas lines)
    ======================================== */

    function drawChart (h, totalEpochs) {
        const cv  = $('chart');
        const ctx = cv.getContext('2d');
        const W   = cv.width, H = cv.height;
        const pad = { l:50, r:20, t:20, b:30 };
        const gW  = W - pad.l - pad.r;
        const gH  = H - pad.t - pad.b;

        ctx.clearRect(0,0,W,H);

        // axes
        ctx.strokeStyle = '#334155';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t);
        ctx.lineTo(pad.l, H-pad.b);
        ctx.lineTo(W-pad.r, H-pad.b);
        ctx.stroke();

        // labels
        ctx.fillStyle = '#64748b';
        ctx.font      = '11px sans-serif';
        ctx.fillText('0', pad.l-14, H-pad.b+4);
        ctx.fillText('1', pad.l-14, pad.t+4);
        ctx.fillText('Epoch', W/2, H-4);

        const n = h.acc.length;
        if (n < 2) return;

        function line (arr, color, maxV) {
            ctx.strokeStyle = color;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            arr.forEach((v,i) => {
                const x = pad.l + (i/(totalEpochs-1)) * gW;
                const y = pad.t + gH - (v/maxV) * gH;
                i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
            });
            ctx.stroke();
        }

        const maxLoss = Math.max(...h.loss, ...h.valLoss) * 1.1 || 1;
        line(h.acc,     '#22c55e', 1);
        line(h.valAcc,  '#86efac', 1);
        line(h.loss,    '#ef4444', maxLoss);
        line(h.valLoss, '#fca5a5', maxLoss);

        // mini legend
        const items = [
            ['Acc','#22c55e'],['ValAcc','#86efac'],
            ['Loss','#ef4444'],['ValLoss','#fca5a5']
        ];
        items.forEach(([t,c],i) => {
            const x = pad.l + 10 + i*80;
            ctx.fillStyle = c;
            ctx.fillRect(x,pad.t+2,12,3);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px sans-serif';
            ctx.fillText(t, x+16, pad.t+7);
        });
    }

    /* ========================================
       Helpers
    ======================================== */
    function show (id) { $(id).classList.remove('hidden'); }
    function hide (id) { $(id).classList.add('hidden'); }
    function sleep (ms) { return new Promise(r => setTimeout(r, ms)); }

    function enableClassify () {
        btnClassify.disabled = !(CNN.ready() && extractedData);
    }

})();