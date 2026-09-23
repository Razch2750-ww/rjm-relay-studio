export function downloadFile(content:string|Blob,name:string,type="application/json"){
 const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function printReport(html:string){const win=window.open("","_blank");if(!win)throw new Error("Izinkan jendela laporan, lalu coba lagi.");win.document.open();win.document.write(html);win.document.close();win.focus();}
export async function svgPNG(svg:SVGSVGElement,name:string){
 const copy=svg.cloneNode(true) as SVGSVGElement,box=svg.viewBox.baseVal;copy.setAttribute("width",String(box.width));copy.setAttribute("height",String(box.height));
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:"image/svg+xml"}));
 try{const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("SVG gagal dirender."));img.src=url;});const canvas=document.createElement("canvas"),scale=Math.min(2,16000/box.width,16000/box.height);canvas.width=Math.ceil(box.width*scale);canvas.height=Math.ceil(box.height*scale);const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG gagal dibuat.")),"image/png"));downloadFile(blob,name+".png");}finally{URL.revokeObjectURL(url);}
}
