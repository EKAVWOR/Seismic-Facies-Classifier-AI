/* ─── TensorFlow.js CNN Model ─── */
window.S = window.S || {};

S.CNN = (() => {

    const { PATCH, NCLASS, TRAIN } = S.Config;
    let model = null;

    /* ====== Build ====== */

    function build () {
        model = tf.sequential();

        model.add(tf.layers.conv2d({
            inputShape: [PATCH, PATCH, 1],
            filters: 32, kernelSize: 3, padding:'same', activation:'relu'
        }));
        model.add(tf.layers.batchNormalization());
        model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

        model.add(tf.layers.conv2d({
            filters: 64, kernelSize: 3, padding:'same', activation:'relu'
        }));
        model.add(tf.layers.batchNormalization());
        model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

        model.add(tf.layers.conv2d({
            filters: 128, kernelSize: 3, padding:'same', activation:'relu'
        }));
        model.add(tf.layers.batchNormalization());
        model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

        model.add(tf.layers.flatten());
        model.add(tf.layers.dense({ units: 128, activation:'relu' }));
        model.add(tf.layers.dropout({ rate: 0.4 }));
        model.add(tf.layers.dense({ units: NCLASS, activation:'softmax' }));

        model.compile({
            optimizer: tf.train.adam(TRAIN.LR),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        console.log('CNN built');
        model.summary();
        return model;
    }

    /* ====== Train ====== */

    /**
     *  data  = { patches: Float32Array[], labels: number[] }
     *  opts  = { epochs, onEpochEnd(epoch, logs) }
     */
    async function train (data, opts) {

        if (!model) build();

        const N   = data.patches.length;
        const flat = new Float32Array(N * PATCH * PATCH);
        data.patches.forEach((p, i) => flat.set(p, i * PATCH * PATCH));

        const xs = tf.tensor4d(flat, [N, PATCH, PATCH, 1]);
        const ys = tf.oneHot(tf.tensor1d(data.labels, 'int32'), NCLASS).toFloat();

        const history = { loss:[], acc:[], valLoss:[], valAcc:[] };

        await model.fit(xs, ys, {
            epochs: opts.epochs || 15,
            batchSize: TRAIN.BATCH,
            validationSplit: TRAIN.VAL,
            shuffle: true,
            callbacks: {
                onEpochEnd: async (epoch, logs) => {
                    history.loss.push(logs.loss);
                    history.acc.push(logs.acc);
                    history.valLoss.push(logs.val_loss);
                    history.valAcc.push(logs.val_acc);
                    if (opts.onEpochEnd) opts.onEpochEnd(epoch, logs, history);
                    await tf.nextFrame();          // let UI update
                }
            }
        });

        xs.dispose();
        ys.dispose();

        return history;
    }

    /* ====== Predict ====== */

    /**
     *  patchesFlat : Float32Array  (N * PATCH * PATCH)
     *  N           : number of patches
     *  returns { classes: Int32Array, confidences: Float32Array }
     */
    async function predict (patchesFlat, N) {
        const input  = tf.tensor4d(patchesFlat, [N, PATCH, PATCH, 1]);
        const pred   = model.predict(input);

        const classes     = await pred.argMax(-1).array();
        const maxConf     = await pred.max(-1).array();

        input.dispose();
        pred.dispose();

        return {
            classes:      new Int32Array(classes),
            confidences:  new Float32Array(maxConf)
        };
    }

    /* ====== Save / Load (localStorage) ====== */

    async function save () {
        if (!model) throw new Error('No model to save');
        await model.save('localstorage://seismic-cnn');
        console.log('Model saved to localStorage');
    }

    async function load () {
        model = await tf.loadLayersModel('localstorage://seismic-cnn');
        model.compile({
            optimizer: tf.train.adam(TRAIN.LR),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        console.log('Model loaded from localStorage');
    }

    function ready () { return model !== null; }

    return { build, train, predict, save, load, ready };

})();