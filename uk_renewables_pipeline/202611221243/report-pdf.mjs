// V9.63: deterministic one-page A4 PDF with a real /URI link annotation.
// No third-party PDF dependency. Text is normalised to basic PDF Helvetica WinAnsi-safe ASCII.
const ascii=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^\x20-\x7E]/g,'?');
const literal=value=>ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const splitText=(value,max=70)=>{
  const words=ascii(value).split(/\s+/),rows=[];let line='';
  for(const word of words){
    if(!word)continue;
    if(line.length && line.length+word.length+1>max){rows.push(line);line='';}
    if(word.length>max){
      if(line){rows.push(line);line='';}
      for(let start=0;start<word.length;start+=max)rows.push(word.slice(start,start+max));
    }else line+=(line?' ':'')+word;
  }
  if(line)rows.push(line);
  return rows.length?rows:[''];
};
export function buildA4Pdf(details,{landscape=false}={}){
  if(!details || !details.name)throw new TypeError('Missing project report data');
  const width=landscape?841.89:595.28, height=landscape?595.28:841.89;
  const margin=48,maxChars=landscape?115:75;
  const ops=[],text=(line,y,fontSize=11,x=margin)=>{
    ops.push('BT /F1 '+fontSize+' Tf '+x+' '+y+' Td ('+literal(line)+') Tj ET');
  };
  let y=height-58;
  text('GLOBALGRID2050 / REPD PROJECT REPORT',y,12);y-=29;
  for(const nameLine of splitText(details.name,landscape?70:43)){
    text(nameLine,y,18);y-=24;
  }
  y-=10;
  const fields=[
    ['OPERATOR (REPD)',details.operator],
    ['DEVELOPER',details.developer],
    ['LOCATION',details.location],
    ['CAPACITY',details.capacity+' '+details.capacityUnit],
    ['OFFICIAL STATUS',details.status],
    ['APPLICATION SUBMITTED',details.submitted],
    ['OPERATIONAL DATE',details.operational],
    ['REPD RECORD UPDATED',details.updated],
    ['PLANNING CONSENT',details.consent],
    ['PLANNING AUTHORITY',details.planningAuthority],
    ['PLANNING REFERENCE',details.planningReference],
    ['REPD REFERENCE',details.reference],
    ['DATA SOURCE',details.dataSource]
  ];
  for(const [label,value] of fields){
    if(y<110)break;
    text(label,y,9);y-=15;
    for(const row of splitText(value,maxChars)){if(y<100)break;text(row,y,11,margin+12);y-=15;}
    y-=7;
  }
  y=Math.max(55,Math.min(y-2,95));
  const mapText=details.mapUrl?'OPEN PROJECT MAP (clickable link)':'MAP NOT AVAILABLE';
  text(mapText,y,13);const mapRect=[margin-3,y-4,margin+Math.min(320,mapText.length*8),y+16];
  const stream=ops.join('\n')+'\n';
  const objects=[];
  const add=content=>{objects.push(content);return objects.length;};
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const contents=add('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
  const annotations=[];
  if(details.mapUrl){
    const url=String(details.mapUrl);
    if(!/^https:\/\//i.test(url))throw Error('Unsafe MAP URL');
    annotations.push(add('<< /Type /Annot /Subtype /Link /Rect ['+mapRect.join(' ')+
      '] /Border [0 0 0] /A << /S /URI /URI ('+literal(url)+') >> >>'));
  }
  const page=add('');
  const pages=add('');
  const catalog=add('');
  objects[page-1]='<< /Type /Page /Parent '+pages+' 0 R /MediaBox [0 0 '+width+' '+height+
    '] /Resources << /Font << /F1 '+font+' 0 R >> >> /Contents '+contents+' 0 R'+
    (annotations.length?' /Annots ['+annotations.map(n=>n+' 0 R').join(' ')+']':'')+' >>';
  objects[pages-1]='<< /Type /Pages /Kids ['+page+' 0 R] /Count 1 >>';
  objects[catalog-1]='<< /Type /Catalog /Pages '+pages+' 0 R >>';
  const enc=new TextEncoder(),parts=['%PDF-1.4\n%GG2050\n'],positions=[0];
  let offset=enc.encode(parts[0]).length;
  for(let i=0;i<objects.length;i++){
    const block=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
    positions.push(offset);parts.push(block);offset+=enc.encode(block).length;
  }
  const xref=offset;
  parts.push('xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n');
  for(let i=1;i<positions.length;i++)parts.push(String(positions[i]).padStart(10,'0')+' 00000 n \n');
  parts.push('trailer\n<< /Size '+(objects.length+1)+' /Root '+catalog+
    ' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return enc.encode(parts.join(''));
}
