'use strict';
// Local document processing: all workers, models and fonts are packaged assets.
window.InterpreteDocuments = (() => {
  let pdfModule, ocrScript;
  async function pdf(file, progress) {
    if (!Promise.withResolvers) Promise.withResolvers = () => { let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject}; };
    pdfModule ||= import('/vendor/pdf/pdf.mjs');
    const library=await pdfModule; library.GlobalWorkerOptions.workerSrc='/vendor/pdf/pdf.worker.mjs';
    const loading=library.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,enableXfa:false,useWasm:false,useSystemFonts:true,disableFontFace:true,standardFontDataUrl:'/vendor/pdf/standard_fonts/'});
    let pdfDocument;
    try {
      pdfDocument=await loading.promise;
      const pages=[];let size=0,thumbnail='';
      for(let number=1;number<=Math.min(pdfDocument.numPages,50);number++) {
        progress('Lecture PDF · page '+number+' / '+pdfDocument.numPages);
        const page=await pdfDocument.getPage(number);const content=await page.getTextContent();
        const text=content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('').trim();
        pages.push({number,text:text.slice(0,Math.max(0,200000-size))});size+=text.length;
        if(number===1) {
          const view=page.getViewport({scale:.5}),scale=Math.min(1,600/view.width,800/view.height),viewport=page.getViewport({scale:.5*scale});
          const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;thumbnail=canvas.toDataURL('image/jpeg',.7);
        }
        page.cleanup(); if(size>=200000)break;
      }
      return {text:pages.map(page=>'[Page '+page.number+']\n'+page.text).join('\n\n').slice(0,200000),pages,thumbnail,extraction_method:'pdfjs',extracted_at:new Date().toISOString(),incomplete:pages.length<pdfDocument.numPages||size>200000,page_count:pdfDocument.numPages};
    } finally { await loading.destroy(); }
  }
  function loadOcr() {
    ocrScript ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/ocr/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('Moteur OCR local indisponible.'));document.head.append(script);});return ocrScript;
  }
  async function ocr(file, progress) {
    await loadOcr();let worker;
    try {
      worker=await Tesseract.createWorker('fra+eng',1,{workerPath:'/vendor/ocr/worker.min.js',corePath:'/vendor/ocr/core/tesseract-core-lstm.wasm.js',langPath:'/vendor/ocr/lang',workerBlobURL:false,gzip:true,cacheMethod:'none',logger:value=>progress('OCR local · '+Math.round((value.progress||0)*100)+' %')});
      const result=await worker.recognize(file);
      return {text:result.data.text.slice(0,200000),extraction_method:'tesseract',extracted_at:new Date().toISOString(),ocr_confidence:result.data.confidence,incomplete:result.data.text.length>200000};
    } finally {if(worker)await worker.terminate();}
  }
  return {extract:async(file,progress=()=>{})=>{
    if(file.size>8*1024*1024)throw new Error('Document limité à 8 Mio.');
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''))return pdf(file,progress);
    if(/^image\/(png|jpeg|webp)$/.test(file.type))return ocr(file,progress);
    throw new Error('Extraction disponible pour PDF et images PNG, JPEG, WebP.');
  }};
})();
