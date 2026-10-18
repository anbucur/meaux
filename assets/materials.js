// A continuous mercury surface: magnetic peaks grow from the same mesh.
let fluidCanvas, fluidGL, fluidProgram, fluidCount = 0;
const materialMotion = matchMedia('(prefers-reduced-motion: reduce)');
const materialField = {strength: 0, target: 0, x: .5, y: .5};
const materialExit = {startedAt: null};
let fluidUniforms = {};
const liquidVertex = `
precision highp float;
attribute vec2 aUV;
uniform vec2 uSize,uPointer;
uniform float uStrength,uOpen,uBurst;
varying vec3 vNormal,vPosition;
varying float vFerro;
const float PI=3.14159265359;
vec3 orient(vec3 p){
  float c=cos(-.27),s=sin(-.27);
  p.xy=mat2(c,-s,s,c)*p.xy;
  p.yz=mat2(.955,-.296,.296,.955)*p.yz;
  return p;
}
vec3 surface(vec2 uv,out float ferro){
  float a=uv.x*2.*PI,b=uv.y*2.*PI;
  float ring=.76+.055*sin(3.*a+.6)+.025*cos(5.*a);
  float tube=.155+.045*sin(2.*a-.8)+.018*cos(3.*a);
  vec3 anchor=orient(vec3(cos(a)*ring*1.16,sin(a)*ring,0.));
  float d=length(anchor.xy-uPointer);
  float magnet=exp(-d*d/0.19)*uStrength;
  float outside=smoothstep(.1,.8,cos(b));
  ferro=clamp(magnet+uBurst*outside*.25,0.,1.);
  float cells=pow(max(0.,cos(a*42.+.55*sin(b*3.))),10.)*pow(max(0.,cos(b*7.)),8.);
  float rise=(magnet*.21+uBurst*.34*outside)*cells;
  float r=tube+rise;
  vec3 p=vec3((ring+r*cos(b))*cos(a)*1.16,(ring+r*cos(b))*sin(a),r*sin(b));
  p=orient(p);
  p.xy+=(uPointer-anchor.xy)*magnet*.055;
  return p*(1.+uOpen*1.85);
}
void main(){
  float f,fx,fy;
  vec3 p=surface(aUV,f);
  vec3 du=surface(aUV+vec2(.00035,0.),fx)-surface(aUV-vec2(.00035,0.),fy);
  vec3 dv=surface(aUV+vec2(0.,.00035),fx)-surface(aUV-vec2(0.,.00035),fy);
  vNormal=normalize(cross(du,dv));vPosition=p;vFerro=f;
  float fit=min(uSize.x*.87,uSize.y*.86);
  gl_Position=vec4(p.xy*fit/uSize,-p.z*.5,1.);
}`;
const liquidFragment = `
precision highp float;
uniform float uOpen;
varying vec3 vNormal,vPosition;
varying float vFerro;
float boxLight(vec3 r,vec3 axis,float width,float height){
  vec3 up=normalize(cross(axis,vec3(0.,1.,.01)));
  vec3 side=cross(axis,up);
  return (1.-smoothstep(width*.72,width,abs(dot(r,up))))
       *(1.-smoothstep(height*.72,height,abs(dot(r,side))))
       *smoothstep(.15,.75,dot(r,axis));
}
void main(){
  vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
  vec3 view=normalize(vec3(0.,0.,3.8)-vPosition);
  vec3 r=reflect(-view,n);
  float fres=pow(1.-max(0.,dot(n,view)),3.);
  float light=boxLight(r,normalize(vec3(-.7,.7,1.)),.18,.85)*1.55;
  light+=boxLight(r,normalize(vec3(.9,-.25,.7)),.08,.95)*1.3;
  light+=boxLight(r,normalize(vec3(.2,1.,.1)),.75,.13)*.7;
  // A dark studio reflected between bright rectangular strip lights.
  float room=.025+.24*smoothstep(-.18,.26,r.y);
  room*=1.-.76*smoothstep(.22,.32,r.x)*(1.-smoothstep(.5,.58,r.x));
  room+=.28*pow(max(0.,dot(r,normalize(vec3(-.3,-.6,1.)))),14.);
  light+=boxLight(r,normalize(vec3(-1.,-.4,.35)),.035,.8)*1.8;
  float metal=room+light*1.2+fres*.32;
  float dark=mix(1.,.18,smoothstep(.08,.8,vFerro));
  float shade=metal*dark+light*vFerro*.45;
  shade=pow(shade/(1.+shade*.32),.92);
  gl_FragColor=vec4(vec3(shade),1.);
}`;

function initFluidLandingCanvas(){
  fluidCanvas=document.getElementById('vault-fluid-canvas');
  fluidGL=fluidCanvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
  const fallback=()=>document.getElementById('leather-vault').classList.add('material-fallback');
  if(!fluidGL){fallback();return;}
  const gl=fluidGL;
  const compile=(type,source)=>{
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  try{
    fluidProgram=gl.createProgram();
    gl.attachShader(fluidProgram,compile(gl.VERTEX_SHADER,liquidVertex));
    gl.attachShader(fluidProgram,compile(gl.FRAGMENT_SHADER,liquidFragment));
    gl.linkProgram(fluidProgram);
    if(!gl.getProgramParameter(fluidProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(fluidProgram));
  }catch(error){console.warn('Liquid material unavailable:',error.message);fluidProgram=null;fallback();return;}
  gl.useProgram(fluidProgram);
  const around=560,across=112,vertices=[],indices=[];
  for(let i=0;i<=around;i++)for(let j=0;j<=across;j++)vertices.push(i/around,j/across);
  for(let i=0;i<around;i++)for(let j=0;j<across;j++){
    const a=i*(across+1)+j,b=a+across+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const vertexBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  const attr=gl.getAttribLocation(fluidProgram,'aUV');
  gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
  const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);fluidCount=indices.length;
  for(const name of ['uSize','uPointer','uStrength','uOpen','uBurst'])fluidUniforms[name]=gl.getUniformLocation(fluidProgram,name);
  gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
  const resize=()=>{
    const dpr=Math.min(devicePixelRatio||1,1.5);
    fluidCanvas.width=Math.round(innerWidth*dpr);fluidCanvas.height=Math.round(innerHeight*dpr);
    gl.viewport(0,0,fluidCanvas.width,fluidCanvas.height);renderFluidLandingSurface();
  };
  resize();addEventListener('resize',resize);
  const attract=event=>{
    if(vaultIsOpen||materialMotion.matches)return;
    mouse.x=event.clientX;mouse.y=event.clientY;
    materialField.target=1;
  };
  addEventListener('pointermove',attract,{passive:true});
  addEventListener('pointerdown',attract,{passive:true});
  addEventListener('pointerup',event=>{if(event.pointerType==='touch')materialField.target=0;},{passive:true});
  document.documentElement.addEventListener('pointerleave',()=>{materialField.target=0;});
  addEventListener('blur',()=>{materialField.target=0;});
  fluidCanvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fluidProgram=null;fallback();});
}

function renderFluidLandingSurface(){
  if(!fluidProgram||vaultIsOpen||document.hidden)return;
  const gl=fluidGL,W=innerWidth,H=innerHeight;
  const entering=materialExit.startedAt!==null;
  const enterButton=document.getElementById('enter-atelier-btn');
  const settling=enterButton.matches(':hover')||document.activeElement===enterButton;
  const target=settling||entering?0:materialField.target;
  materialField.strength+=(target-materialField.strength)*(settling?.028:.055);
  const elapsed=entering?(performance.now()-materialExit.startedAt)/1000:0;
  const burst=entering?1-Math.pow(1-Math.min(1,elapsed/.2),3):0;
  const progress=entering?Math.max(0,Math.min(1,(elapsed-.10)/.42)):0;
  const opening=entering?progress*progress*(3-2*progress):Math.max(0,vaultSpring.openProgress);
  const fit=Math.min(W*.87,H*.86);
  materialField.x+=(mouse.x/W-materialField.x)*.065;
  materialField.y+=(mouse.y/H-materialField.y)*.065;
  const px=materialMotion.matches?W*.72:materialField.x*W;
  const py=materialMotion.matches?H*.2:materialField.y*H;
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(fluidProgram);
  gl.uniform2f(fluidUniforms.uSize,W,H);
  gl.uniform2f(fluidUniforms.uPointer,(px-W/2)*2/fit,(H/2-py)*2/fit);
  gl.uniform1f(fluidUniforms.uStrength,materialMotion.matches||entering?0:materialField.strength);
  gl.uniform1f(fluidUniforms.uBurst,materialMotion.matches?0:burst);
  gl.uniform1f(fluidUniforms.uOpen,opening);
  gl.drawElements(gl.TRIANGLES,fluidCount,gl.UNSIGNED_SHORT,0);
}

function beginMaterialExit(){
  materialExit.startedAt=performance.now();
  materialField.strength=0;materialField.target=0;
  document.getElementById('leather-vault').classList.add('is-entering');
  document.getElementById('atelier-world').classList.add('is-arriving');
  document.getElementById('enter-atelier-btn').setAttribute('aria-disabled','true');
}

function resetMaterialExit(){
  materialExit.startedAt=null;materialField.strength=0;materialField.target=0;
  document.getElementById('leather-vault').classList.remove('is-entering');
  document.getElementById('atelier-world').classList.remove('is-arriving');
  document.getElementById('enter-atelier-btn').removeAttribute('aria-disabled');
}
