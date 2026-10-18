/* Gallery hover mercury: slow perimeter travel and edge-normal peaks. */
(() => {
  const hero = document.getElementById('works');
  if (!hero) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const canvas = document.createElement('canvas');
  canvas.className = 'atelier-fluid';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', {alpha: true, premultipliedAlpha: false, antialias: false});
  if (!gl) return; // The leather remains a complete background without WebGL.
  const vertex = `attribute vec2 position;
    void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision highp float;
    uniform vec2 size, pointer, rimCenter;
    uniform vec4 card;
    uniform float pixelRatio, opacity, offset;
    float rectangle(vec2 p){
      vec2 q=abs(p-card.xy)-card.zw;
      return length(max(q,0.))+min(max(q.x,q.y),0.);
    }
    float surface(vec2 p){
      float edge=rectangle(p);
      // Closest-point projection is continuous around corners; choosing one
      // edge normal abruptly produced a diagonal seam in the reflected light.
      vec2 boundary=clamp(p,card.xy-card.zw,card.xy+card.zw);
      float cornerDistance=length(abs(boundary-card.xy)-card.zw);
      float cornerSoftness=smoothstep(0.,28.,cornerDistance);
      vec2 edgeV=p-rimCenter;
      float attraction=exp(-dot(edgeV,edgeV)/24000.);
      // Sample the cursor's concentric field on the boundary, then extrude
      // outward so the peaks remain perpendicular to the card surface.
      float teeth=pow(.5+.5*cos(length(boundary-pointer)*.27),3.);
      float thickness=3.+attraction*(14.+teeth*10.*cornerSoftness);
      float rimHeight=7.*sqrt(max(0.,1.-edge/thickness))*smoothstep(0.,2.,edge);
      rimHeight*=smoothstep(.015,.08,attraction);
      return rimHeight;
    }
    float boxLight(vec3 r,vec3 axis,float width,float height){
      vec3 up=normalize(cross(axis,vec3(0.,1.,.01)));
      vec3 side=cross(axis,up);
      return (1.-smoothstep(width*.72,width,abs(dot(r,up))))
        *(1.-smoothstep(height*.72,height,abs(dot(r,side))))
        *smoothstep(.15,.75,dot(r,axis));
    }
    void main(){
      vec2 p=vec2(gl_FragCoord.x, size.y*pixelRatio-gl_FragCoord.y)/pixelRatio+vec2(0.,offset);
      if(rectangle(p)<=0.) discard;
      float h=surface(p);
      if(h<.05) discard;
      float dx=surface(p+vec2(.7,0.))-surface(p-vec2(.7,0.));
      float dy=surface(p+vec2(0.,.7))-surface(p-vec2(0.,.7));
      vec3 n=normalize(vec3(-dx,-dy,1.4));
      vec3 r=reflect(vec3(0.,0.,-1.),n);
      // Use the entrance's dark studio and bright rectangular strip reflections.
      float light=boxLight(r,normalize(vec3(-.7,.7,1.)),.18,.85)*1.55;
      light+=boxLight(r,normalize(vec3(.9,-.25,.7)),.08,.95)*1.3;
      light+=boxLight(r,normalize(vec3(.2,1.,.1)),.75,.13)*.7;
      light+=boxLight(r,normalize(vec3(-1.,-.4,.35)),.035,.8)*1.8;
      float room=.025+.24*smoothstep(-.18,.26,r.y);
      room*=1.-.76*smoothstep(.22,.32,r.x)*(1.-smoothstep(.5,.58,r.x));
      room+=.28*pow(max(0.,dot(r,normalize(vec3(-.3,-.6,1.)))),14.);
      float fresnel=pow(1.-max(n.z,0.),3.);
      float metal=room+light*1.2+fresnel*.32;
      float shade=pow(metal/(1.+metal*.32),.92);
      gl_FragColor=vec4(vec3(shade),opacity*smoothstep(0.,2.,h));
    }`;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Atelier fluid shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['size','pointer','rimCenter','card','pixelRatio','opacity','offset']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  hero.append(canvas);
  let width = 0, height = 0, ratio = 1;
  let pointerX = 0, pointerY = 0, hovered = null;
  let fieldX = 0, fieldY = 0;
  let opacity = 0, frame = 0, last = 0, visible = false;
  let card = [0, 0, 0, 0], arc = 0, targetArc = 0, offset = 0;
  let rimX = 0, rimY = 0;
  function resize() {
    width = hero.clientWidth; height = Math.min(hero.clientHeight, innerHeight);
    ratio = Math.min(devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  new ResizeObserver(resize).observe(hero);
  function locate(event) {
    if (event.pointerType === 'touch') return;
    const previous = hovered;
    hovered = event.target.closest('.work-image');
    if (hovered) {
      const bounds = hero.getBoundingClientRect();
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
      const rect = hovered.getBoundingClientRect();
      const left = rect.left - bounds.left, top = rect.top - bounds.top;
      const distances = [pointerX - left, left + rect.width - pointerX,
        pointerY - top, top + rect.height - pointerY];
      const nearest = distances.indexOf(Math.min(...distances));
      const w = rect.width, h = rect.height;
      card = [left + w / 2, top + h / 2, w / 2, h / 2];
      // Clockwise distance along the perimeter. Interpolate this distance, not
      // an XY chord that would send the liquid through the photograph.
      if (nearest === 0) targetArc = 2*w + 2*h - (pointerY-top);
      else if (nearest === 1) targetArc = w + pointerY-top;
      else if (nearest === 2) targetArc = pointerX-left;
      else targetArc = 2*w + h - (pointerX-left);
      if (previous !== hovered) {
        arc = targetArc; opacity = 0;
        fieldX = pointerX; fieldY = pointerY;
      }
    }
    sync();
  }
  hero.addEventListener('pointermove', locate);
  hero.addEventListener('pointerleave', () => { hovered = null; sync(); });
  window.addEventListener('scroll', () => { hovered = null; sync(); }, {passive: true});
  window.addEventListener('resize', resize);
  function enabled() {
    return visible && !document.hidden && !motion.matches && fine.matches &&
      !document.getElementById('atelier-world').inert;
  }
  function tick(now) {
    frame = 0;
    if (!enabled()) { canvas.style.opacity = '0'; return; }
    canvas.style.opacity = '1';
    const dt = Math.min((now - (last || now)) / 1000, .05);
    last = now;
    opacity += ((hovered ? 1 : 0) - opacity) * (1 - Math.exp(-dt * (hovered ? 2. : 5.)));
    // Ease the magnetic field as well as the liquid mass so peaks never snap
    // to the raw pointer while the rest of the surface is still catching up.
    const fieldEase = 1 - Math.exp(-dt * 1.4);
    fieldX += (pointerX - fieldX) * fieldEase;
    fieldY += (pointerY - fieldY) * fieldEase;
    if (hovered) {
      const w = card[2]*2, h = card[3]*2, perimeter = 2*(w+h);
      const distance = ((targetArc-arc+perimeter*1.5)%perimeter)-perimeter/2;
      arc = (arc + distance*(1-Math.exp(-dt*1.15)) + perimeter)%perimeter;
      const left = card[0]-w/2, top = card[1]-h/2;
      if (arc<w) { rimX=left+arc; rimY=top; }
      else if (arc<w+h) { rimX=left+w; rimY=top+arc-w; }
      else if (arc<2*w+h) { rimX=left+2*w+h-arc; rimY=top+h; }
      else { rimX=left; rimY=top+perimeter-arc; }
      // Round the attraction path through each turn with a quadratic curve.
      // The rendered surface remains clipped outside the photograph.
      const radius = Math.min(24, w/4, h/4);
      const corners = [
        [0, left, top, 0, -1, 1, 0],
        [w, left+w, top, 1, 0, 0, 1],
        [w+h, left+w, top+h, 0, 1, -1, 0],
        [2*w+h, left, top+h, -1, 0, 0, -1]
      ];
      for (const [position, cx, cy, ix, iy, ox, oy] of corners) {
        const delta = ((arc-position+perimeter*1.5)%perimeter)-perimeter/2;
        if (Math.abs(delta) >= radius) continue;
        const t = (delta+radius)/(2*radius);
        rimX = cx-ix*radius*(1-t)**2+ox*radius*t*t;
        rimY = cy-iy*radius*(1-t)**2+oy*radius*t*t;
        break;
      }
    }
    offset = Math.max(0, Math.min(-hero.getBoundingClientRect().top, hero.clientHeight-height));
    canvas.style.top = `${offset}px`;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.size, width, height);
    gl.uniform2f(uniforms.pointer, fieldX, fieldY);
    gl.uniform2f(uniforms.rimCenter, rimX, rimY);
    gl.uniform4fv(uniforms.card, card);
    gl.uniform1f(uniforms.pixelRatio, ratio);
    gl.uniform1f(uniforms.opacity, opacity);
    gl.uniform1f(uniforms.offset, offset);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (hovered || opacity > .001) frame = requestAnimationFrame(tick);
    else { gl.clear(gl.COLOR_BUFFER_BIT); canvas.style.opacity = '0'; }
  }
  function sync() {
    if (enabled() && !frame && (hovered || opacity > .001)) { last = 0; frame = requestAnimationFrame(tick); }
    else if (!enabled()) { cancelAnimationFrame(frame); frame = 0; canvas.style.opacity = '0'; }
  }
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(hero);
  new MutationObserver(sync).observe(document.getElementById('atelier-world'), {attributes: true, attributeFilter: ['inert']});
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  fine.addEventListener('change', sync);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(frame); canvas.style.display = 'none'; });
  resize();
})();
