/*  ─── Global Config ─── */
window.S = window.S || {};

S.Config = {
    PATCH : 32,            // patch width & height in px
    NCLASS: 6,

    CLASSES: [
        { id:0, name:'Sand',      rgb:[41,128,185],  hex:'#2980b9' },
        { id:1, name:'Shale',     rgb:[231,76,60],   hex:'#e74c3c' },
        { id:2, name:'Fault',     rgb:[241,196,15],  hex:'#f1c40f' },
        { id:3, name:'Channel',   rgb:[46,204,113],  hex:'#2ecc71' },
        { id:4, name:'Salt',      rgb:[155,89,182],  hex:'#9b59b6' },
        { id:5, name:'Carbonate', rgb:[230,126,34],  hex:'#e67e22' }
    ],

    TRAIN: {
        BATCH : 32,
        LR    : 0.001,
        VAL   : 0.2      // validation split
    }
};