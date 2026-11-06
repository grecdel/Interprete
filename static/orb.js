'use strict';
// Living bubble: one WebGL canvas and one draw call replace the CSS ribbons and particles.
// The material follows the theme (pastel = water, dark = violet electricity, matrix = data,
// investigation = smoke) and the shape follows the assistant's state and the real voice level.
// Without WebGL, or once the context is lost for good, the CSS bubble stays in place.
(() => {
  const companion = document.getElementById('companion'), bubble = document.getElementById('bubble');
  if (!companion || !bubble) return;
  const MATERIALS = {
    pastel: {id: 0, light: '#a3f4ff', mid: '#5198ec', hot: '#d9d4ff', base: '#102b48'},
    dark: {id: 1, light: '#c557ff', mid: '#6135fa', hot: '#ff8bdd', base: '#10041d'},
    matrix: {id: 2, light: '#75ffbc', mid: '#16a46e', hot: '#d4ff93', base: '#02130b'},
    investigation: {id: 3, light: '#e9dccb', mid: '#8f8292', hot: '#f8e1cb', base: '#211e28'}
  };
  const LIFE = 0.7; // Vivacity chosen for 0.7: organic, without distracting from the interview.
  const IDLE_FRAME_MS = 1000 / 30; // Rest and breathing states are drawn at 30 images per second.

  const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  // Shared with Android: scripts/orb_agsl.py turns this GLSL into AGSL for the native overlay bubble.
  const FRAGMENT = `precision highp float;
uniform vec2 uRes;uniform float uTime,uAmp,uEnergy,uAlert,uSeed,uLife;uniform int uMat;
uniform vec3 uLight,uMid,uHot,uBase;
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1.,0.,0.)),f.x),mix(hash3(i+vec3(0.,1.,0.)),hash3(i+vec3(1.,1.,0.)),f.x),f.y),
mix(mix(hash3(i+vec3(0.,0.,1.)),hash3(i+vec3(1.,0.,1.)),f.x),mix(hash3(i+vec3(0.,1.,1.)),hash3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
void main(){
 float px=2./min(uRes.x,uRes.y);
 vec2 uv=(gl_FragCoord.xy-.5*uRes)*px;
 float t=uTime*(.55+.6*uLife)+uSeed;
 float len=length(uv);vec2 dir=uv/max(len,1e-4);
 float wk=(uMat==2?.45:1.)*(.35+.9*uLife);
 float w1=vnoise(vec3(dir*1.3,t*.30))-.5;
 float w2=vnoise(vec3(dir*3.6,t*1.1+4.))-.5;
 float R=.64+.012*sin(t*.8)+wk*(w1*(.05+.10*uAmp)+w2*(.012+.06*uAmp))+uAlert*.018*sin(uTime*7.);
 float d=len-R;
 float inside=1.-smoothstep(-px,px,d);
 vec2 q=uv/R;float r2=min(dot(q,q),1.);float z=sqrt(1.-r2);vec3 n=vec3(q,z);
 float fres=pow(1.-z,2.2);
 float spin=t*(.10+.35*uEnergy);
 vec3 p=n;p.xz=rot(spin)*p.xz;p.yz=rot(.35)*p.yz;
 vec3 L=normalize(vec3(-.45,.55,.7));
 float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),36.);
 vec3 col=uBase;
 if(uMat==0){
  vec3 w=p*2.1+vec3(0.,0.,t*.22);
  float a=fbm(w+fbm(w*1.3+t*.18)*1.6);
  float c=pow(1.-abs(2.*fbm(w*2.2+a*2.+t*.1)-1.),7.);
  col=mix(uBase,uMid,smoothstep(.2,.75,a));
  col=mix(col,uLight,smoothstep(.55,.85,a)*.55);
  col+=c*.55*mix(uLight,vec3(1.),.5);
  col+=uAmp*.22*sin(length(q)*26.-uTime*9.)*(1.-r2)*uLight;
  col+=fres*uLight*1.15+spec*.9;
 }else if(uMat==1){
  vec3 w=p*1.8;
  float f1=fbm(w+vec3(0.,0.,t*.55));
  float f2=fbm(w*1.6+vec3(t*.3,0.,-t*.4)+f1*1.4);
  float f3=fbm(w*2.7-vec3(0.,t*.5,0.)+f2);
  float th=.010+.012*uEnergy;
  float l1=min(th/abs(f2-.5),4.);
  float l2=min(th*.7/abs(f3-.5),4.);
  float flick=.75+.25*vnoise(vec3(uTime*14.,uSeed,0.));
  col=uBase+uMid*.22*smoothstep(.3,.8,f1);
  col+=(uLight*l1*.32+uHot*l2*.22*(.4+uEnergy+uAmp))*flick;
  col+=fres*mix(uMid,uLight,.6)*1.5+spec*.35*uHot;
 }else if(uMat==2){
  float lon=atan(p.x,p.z),lat=asin(clamp(p.y,-1.,1.));
  float dens=mix(5.,11.,smoothstep(60.,320.,min(uRes.x,uRes.y)));
  vec2 gv=vec2(lon*dens/3.14159,lat*dens*1.25/1.5708);
  vec2 cid=floor(gv),cf=fract(gv);
  float sp=.6+hash3(vec3(cid.x,1.,7.))*1.4;
  float v=fract(cid.y*.05+t*.22*sp*(1.+1.6*uEnergy)+hash3(vec3(cid.x,5.,1.)));
  float trail=pow(1.-v,3.);float head=smoothstep(.06,0.,v);
  vec2 bc=floor(cf*vec2(3.,4.));
  float bit=step(.42,hash3(vec3(cid*3.1+bc,floor(uTime*3.+hash3(vec3(cid,9.))*10.))));
  float cm=step(.14,cf.x)*step(cf.x,.86)*step(.1,cf.y)*step(cf.y,.9);
  float g=bit*cm;
  float liquid=fbm(p*2.2+vec3(0.,-t*.15,0.));
  col=uBase+uMid*.18*liquid;
  col+=g*(uMid*trail*1.1+uHot*head*mix(.55,1.6,smoothstep(80.,300.,min(uRes.x,uRes.y))))*(.35+.65*z)*(1.+uAmp*.8);
  col+=fres*uLight*1.05+spec*.25*uLight;
 }else{
  vec3 acc=vec3(0.);float al=0.;
  for(int i=0;i<6;i++){
   float zz=mix(z,-z,(float(i)+.5)/6.);
   vec3 sp=vec3(q,zz);sp.xz=rot(t*.07)*sp.xz;
   vec3 wp=sp*1.5+vec3(0.,-t*.16,0.);
   float dd=fbm(wp+fbm(wp*1.6+t*.08)*1.3);
   dd=smoothstep(.40,.82,dd)*(1.+uAmp*.6);
   acc+=dd*(1.-al)*mix(uMid,uLight,dd);
   al+=dd*.24*(1.-al);
  }
  col=uBase*1.1+acc*.62;
  vec3 eg=p*9.+vec3(0.,-t*.6,0.);
  float em=step(.985,hash3(floor(eg)))*smoothstep(.5,0.,length(fract(eg)-.5));
  col+=em*uHot*(.6+.6*sin(uTime*3.+hash3(floor(eg))*20.))*1.4;
  col+=fres*uLight*.85+spec*.45;
 }
 col+=smoothstep(-.035,0.,d)*mix(uLight,vec3(1.),.3)*.35;
 vec3 alertC=vec3(1.,.62,.38);
 float pulse=.5+.5*sin(uTime*6.5);
 col=mix(col,col*.75+alertC*.45,uAlert*.32*pulse);
 float od=max(d,0.);
 float halo=exp(-od*(10.-3.*uEnergy))*(.22+.28*uAmp+.32*uEnergy+.45*uAlert*pulse);
 vec3 hc=mix(mix(uMid,uLight,.45),alertC,uAlert*.65);
 float motes=0.;
 for(int i=0;i<7;i++){
  float fi=float(i);
  float a=uTime*(.25+.05*fi)*(1.+uEnergy)+fi*.9;
  vec3 o=vec3(cos(a)*R*1.16,0.,sin(a)*R*1.16);
  o.yz=rot(.5+fi*.7)*o.yz;o.xy=rot(fi*1.3)*o.xy;
  float vis=o.z>0.?1.:(1.-inside);
  motes+=vis*exp(-dot(uv-o.xy,uv-o.xy)/(.00012+.00008*uLife))*.9;
 }
 motes*=(.3+.7*uLife);
 vec3 outc=col*inside+hc*halo*(1.-inside)+uLight*motes;
 float alpha=clamp(inside+halo*(1.-inside)+motes,0.,1.);
 gl_FragColor=vec4(outc,alpha);
}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'orb-canvas'; canvas.setAttribute('aria-hidden', 'true');
  bubble.prepend(canvas);
  const seed = Math.random() * 50;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let gl = null, uniforms = {}, raf = 0, rafView = null, lastFrame = 0, lastDraw = 0;
  let amp = 0, energy = 0, alert = 0;
  // Voice level: from an analysed microphone stream when there is one, otherwise short pulses on recognised speech.
  let analyser = null, audioContext = null, samples = null, pulseLevel = 0, pulseAt = 0;

  const hex = value => { const n = parseInt(value.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  function setup() {
    gl = canvas.getContext('webgl', {alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power'});
    if (!gl) return false;
    const shader = (type, source) => {
      const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error('Shader de la bulle refusé.');
      return value;
    };
    try {
      const program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader de la bulle refusé.');
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = {};
      for (const name of ['uRes', 'uTime', 'uAmp', 'uEnergy', 'uAlert', 'uSeed', 'uLife', 'uMat', 'uLight', 'uMid', 'uHot', 'uBase']) uniforms[name] = gl.getUniformLocation(program, name);
      gl.clearColor(0, 0, 0, 0);
      return true;
    } catch { gl = null; return false; }
  }

  function voiceLevel(now) {
    if (analyser) {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0; for (const value of samples) sum += value * value;
      const decibels = 10 * Math.log10(sum / samples.length + 1e-10);
      return Math.max(0, Math.min(1, (decibels + 55) / 40));
    }
    return pulseLevel * Math.max(0, 1 - (now - pulseAt) / 450);
  }
  function visible() {
    const doc = companion.ownerDocument;
    return canvas.isConnected && !doc.hidden && canvas.getClientRects().length > 0;
  }
  function draw(now, delta) {
    const listening = companion.classList.contains('is-listening');
    const targetAmp = listening ? voiceLevel(now) : 0;
    const targetEnergy = companion.classList.contains('is-busy') ? 1 : listening ? 0.15 : 0;
    const targetAlert = companion.classList.contains('has-followup') ? 1 : 0;
    const still = reduceMotion?.matches;
    const fast = still ? 1 : 1 - Math.exp(-delta * (targetAmp > amp ? 14 : 5)), slow = still ? 1 : 1 - Math.exp(-delta * 2.5);
    amp += (targetAmp - amp) * fast; energy += (targetEnergy - energy) * slow; alert += (targetAlert - alert) * slow;
    const ratio = Math.min(companion.ownerDocument.defaultView.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const material = MATERIALS[companion.ownerDocument.documentElement.dataset.theme] || MATERIALS.pastel;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.uRes, width, height); gl.uniform1f(uniforms.uTime, still ? 14 : now / 1000);
    gl.uniform1f(uniforms.uAmp, amp); gl.uniform1f(uniforms.uEnergy, energy); gl.uniform1f(uniforms.uAlert, alert);
    gl.uniform1f(uniforms.uSeed, seed); gl.uniform1f(uniforms.uLife, LIFE); gl.uniform1i(uniforms.uMat, material.id);
    gl.uniform3fv(uniforms.uLight, hex(material.light)); gl.uniform3fv(uniforms.uMid, hex(material.mid));
    gl.uniform3fv(uniforms.uHot, hex(material.hot)); gl.uniform3fv(uniforms.uBase, hex(material.base));
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    return amp > 0.02 || energy > 0.02 || alert > 0.02;
  }
  function frame(now) {
    raf = 0;
    if (!gl || !visible()) return;
    const delta = Math.min(0.1, (now - (lastFrame || now)) / 1000); lastFrame = now;
    // Faster states get every frame; rest is capped at 30 images per second.
    const busy = amp > 0.02 || energy > 0.02 || alert > 0.02 || companion.classList.contains('is-listening');
    if (busy || now - lastDraw >= IDLE_FRAME_MS - 1) { draw(now, Math.max(delta, (now - lastDraw) / 1000)); lastDraw = now; }
    if (reduceMotion?.matches) return; // One still image of the material.
    rafView = companion.ownerDocument.defaultView; raf = rafView.requestAnimationFrame(frame);
  }
  // The companion can move into a floating window: always schedule on the window that shows it.
  function wake() {
    if (!gl) return;
    if (raf && rafView !== companion.ownerDocument.defaultView) { rafView?.cancelAnimationFrame(raf); raf = 0; }
    if (!raf && visible()) { lastFrame = 0; rafView = companion.ownerDocument.defaultView; raf = rafView.requestAnimationFrame(frame); }
  }

  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); gl = null; companion.classList.remove('orb-gl'); });
  canvas.addEventListener('webglcontextrestored', () => { if (setup()) { companion.classList.add('orb-gl'); wake(); } });
  if (!setup()) { canvas.remove(); return; }
  companion.classList.add('orb-gl');

  // Restart on anything that can make the bubble visible or change its state or theme.
  new MutationObserver(wake).observe(companion, {attributes: true, attributeFilter: ['class', 'hidden']});
  new MutationObserver(wake).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  document.addEventListener('visibilitychange', wake);
  reduceMotion?.addEventListener?.('change', wake);
  window.addEventListener('resize', wake);

  window.InterpreteOrb = {
    // A microphone stream (desktop capture) drives the membrane directly.
    attachStream(stream) {
      try {
        this.detachStream();
        const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return;
        audioContext = new Context();
        const node = audioContext.createAnalyser(); node.fftSize = 512;
        audioContext.createMediaStreamSource(stream).connect(node);
        analyser = node; samples = new Float32Array(node.fftSize); wake();
      } catch { this.detachStream(); }
    },
    detachStream() {
      analyser = null; samples = null;
      if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    },
    // Without a stream (browser speech recognition, Android), recognised speech gives short pulses.
    pulse(strength = 0.6) { pulseLevel = Math.max(0, Math.min(1, strength)); pulseAt = performance.now(); wake(); },
    setLevel(value) { this.pulse(value); }
  };
  wake();
})();
