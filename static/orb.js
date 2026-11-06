'use strict';
// Living bubble: one WebGL canvas and one draw call replace the CSS ribbons and particles.
// A ball at the centre and the material in orbit around it: water streams, a plasma ball with
// bolts leaping out, glyph rings, smoke wisps, flame ribbons and embers. Each state has its own
// motion: slow at rest, voice-driven while listening, a fast vortex and a scanning ring during
// analysis, a heartbeat and a shock wave when a follow-up is ready. and the shape follows the assistant's state and the real voice level.
// Without WebGL, or once the context is lost for good, the CSS bubble stays in place.
(() => {
  const companion = document.getElementById('companion'), bubble = document.getElementById('bubble');
  if (!companion || !bubble) return;
  const MATERIALS = {
    pastel: {id: 0, light: '#8ff3ff', mid: '#22b8e8', hot: '#ffffff', base: '#0b4f9c'},
    dark: {id: 1, light: '#ff4fe0', mid: '#a326ff', hot: '#ffd2ff', base: '#14031f'},
    matrix: {id: 2, light: '#b9ffd8', mid: '#1fd58a', hot: '#eafff3', base: '#020c07'},
    investigation: {id: 3, light: '#ece9e4', mid: '#9a959a', hot: '#ffffff', base: '#16151a'},
    fire: {id: 4, light: '#ff9a1f', mid: '#f0400f', hot: '#ffeeb0', base: '#8c1208'}
  };
  const LIFE = 0.7; // Vivacity chosen for 0.7: organic, without distracting from the interview.
  const IDLE_FRAME_MS = 1000 / 30; // Rest and breathing states are drawn at 30 images per second.

  const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  // Shared with Android: scripts/orb_agsl.py turns this GLSL into AGSL for the native overlay bubble.
  const FRAGMENT = `precision highp float;
uniform vec2 uRes;uniform float uTime,uAmp,uEnergy,uAlert,uListen,uSeed,uLife;uniform int uMat;
uniform vec3 uLight,uMid,uHot,uBase;
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1.,0.,0.)),f.x),mix(hash3(i+vec3(0.,1.,0.)),hash3(i+vec3(1.,1.,0.)),f.x),f.y),
mix(mix(hash3(i+vec3(0.,0.,1.)),hash3(i+vec3(1.,0.,1.)),f.x),mix(hash3(i+vec3(0.,1.,1.)),hash3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
// An orbit seen at an angle: an ellipse of radius a, flattened by squash, rotated by tilt.
// x: coverage, y: position along the stream (0 head, 1 tail), z: 1 in front of the ball, w: across (-1..1).
vec4 orbit(vec2 uv,float a,float squash,float tilt,float head,float arc,float width,float px){
 vec2 p=rot2(-tilt)*uv;
 vec2 c=vec2(p.x,p.y/squash);
 float th=atan(c.y,c.x);
 float along=mod(head-th,6.2832)/max(arc,.01);
 float scale=mix(1.,squash,abs(sin(th)));
 float d=(length(c)-a)*scale;
 float w=width*(1.-smoothstep(.15,1.,along));
 float cover=smoothstep(w+px,w-px,abs(d))*step(along,1.);
 return vec4(cover,along,1.-step(0.,c.y),d/max(w,1e-3));
}
void main(){
 float px=2./min(uRes.x,uRes.y);
 vec2 uv=(gl_FragCoord.xy-.5*uRes)*px;
 float t=uTime*(.55+.6*uLife)+uSeed;
 float r=length(uv);vec2 dir=uv/max(r,1e-4);
 float ang=atan(uv.y,uv.x);
 // State rhythm: rest is slow, listening follows the voice, analysis spins, a follow-up beats.
 float pace=.45+.4*uListen+2.4*uEnergy+.6*uAmp;
 float beat=fract(uTime*.85);
 float thump=exp(-beat*7.)*uAlert;
 float R=(.33+.012*sin(t*.8)+uAmp*.025)*(1.+.08*thump);
 vec2 q=uv/R;float z=sqrt(max(0.,1.-dot(q,q)));
 float ball=smoothstep(R+px,R-px,r);
 vec3 L=normalize(vec3(-.45,.6,.65));
 vec3 ballC=vec3(0.);float ballA=0.;
 vec3 backC=vec3(0.);float backA=0.;
 vec3 frontC=vec3(0.);float frontA=0.;
 vec3 glowC=vec3(0.);
 if(uMat==1){
  // Electricity: the plasma ball, and bolts that leap out of it at random.
  float RE=R*1.45;
  float inside=smoothstep(RE+.03,RE-.1,r);
  float haze=fbm(vec3(uv*2.4,t*.3));
  ballC=mix(uBase*2.,uMid*.28,haze)*inside*(.3+.7*smoothstep(0.,RE,r));ballA=inside*.75;
  float bolts=0.;
  for(int i=0;i<3;i++){
   float fi=float(i);
   vec3 p=vec3(uv*(1.5+fi*.8),t*(.9+fi*.35)*(.7+.6*pace)+fi*7.);
   float f=fbm(p+fbm(p*1.7)*.9)+(vnoise(p*9.)-.5)*.07;
   float w=.005+.004*uEnergy+.003*uAmp;
   float dist=abs(f-.5);
   bolts+=(smoothstep(w*1.6,0.,dist)*1.4+w*.6/(dist+w))*(.8-fi*.2);
  }
  bolts*=inside*smoothstep(.0,.3,r);
  // Bolts out of the ball: each flashes briefly along a jagged, branching path.
  float leap=0.;
  for(int i=0;i<6;i++){
   float fi=float(i);
   float cyc=uTime*(.9+.4*hash3(vec3(fi,1.,1.)))*(1.+1.6*uEnergy+2.*uAmp)+hash3(vec3(fi,7.,3.));
   float id=floor(cyc),life=fract(cyc);
   float chance=.32+.7*uListen*uAmp+.4*uEnergy+.5*uAlert*step(beat,.2);
   float on=step(hash3(vec3(fi,id,5.)),chance);
   float flash=on*smoothstep(0.,.04,life)*smoothstep(.4,.12,life)*(.7+.3*vnoise(vec3(uTime*30.,fi,id)));
   float a=6.2832*hash3(vec3(fi,id,2.))+uEnergy*t*.8;
   vec2 db=vec2(cos(a),sin(a));
   float len=.22+.28*hash3(vec3(fi,id,9.))+.15*uAmp;
   float s=dot(uv,db)-RE*.92;
   float perp=dot(uv,vec2(-db.y,db.x));
   float sn=clamp(s/len,0.,1.);
   float off=(fbm(vec3(s*7.,id+fi*3.,1.))-.5)*.24*(sn+.15)+(vnoise(vec3(s*34.,id,fi))-.5)*.025;
   float w=.0045*(1.-sn*.6);
   float span=step(0.,s)*smoothstep(len,len*.75,s);
   float d1=abs(perp-off);
   float side=hash3(vec3(fi,id,4.))>.5?1.:-1.;
   float bs=max(s-len*.4,0.);
   float off2=off+side*bs*.9+(vnoise(vec3(s*28.,id,fi+4.))-.5)*.03;
   float d2=abs(perp-off2);
   float branch=step(len*.4,s)*smoothstep(len*.9,len*.6,s);
   leap+=flash*span*(smoothstep(w*2.,0.,d1)*1.5+w*.9/(d1+w)+branch*(smoothstep(w*1.6,0.,d2)+w*.5/(d2+w)));
  }
  float jitter=(vnoise(vec3(dir*5.,t*4.))-.5)*.08*(1.+uEnergy+uAmp)+(vnoise(vec3(dir*17.,t*7.))-.5)*.025;
  float rim=.005/(abs(r-RE-jitter)+.005);
  float rimCore=smoothstep(.012,.0,abs(r-RE-jitter));
  // Analysis: a bright arc runs round the rim like a scanner.
  float scan=uEnergy*smoothstep(.75,1.,cos(ang-uTime*5.))*1.6;
  float flick=.65+.35*vnoise(vec3(uTime*19.,uSeed,1.));
  vec3 white=mix(uHot,vec3(1.),.65);
  bolts+=leap;
  ballC+=(uLight*min(bolts,2.)*.55+white*smoothstep(.8,1.6,bolts)*.9+uLight*rim*(.35+scan)+white*rimCore*(.9+scan))*flick*(1.+thump*.8);
  glowC=uMid*exp(-max(r-RE,0.)*10.)*.35*(.6+uEnergy+uAmp+thump)*smoothstep(RE-.12,RE,r);
  ballA=max(ballA,clamp(max(ballC.r,max(ballC.g,ballC.b)),0.,1.));
 }else{
  // Core ball.
  vec3 n=normalize(vec3(q,z+.001));
  float dif=dot(n,L);
  float spin=t*.15*pace;
  vec2 sxz=rot2(spin)*vec2(q.x,z);vec3 sp=vec3(sxz.x,q.y,sxz.y);
  if(uMat==0){
   float wob=.02*sin(3.*ang+t*1.7)+.014*sin(5.*ang-t*2.3)+uAmp*.03*sin(7.*ang+t*7.);
   ball=smoothstep(R+wob+px,R+wob-px,r);
   vec3 c=mix(uMid,uLight,step(.25,dif));
   c=mix(c,uBase*1.2,step(dif,-.25)*.7);
   float s=fbm(vec3(q*2.2,t*.5));
   c=mix(c,mix(uLight,vec3(1.),.6),smoothstep(.02,.0,abs(s-.55))*step(.1,z));
   c=mix(c,vec3(1.),smoothstep(.93,.97,dot(reflect(-L,n),vec3(0.,0.,1.))));
   c=mix(c,mix(uLight,vec3(1.),.4),smoothstep(R-.03,R,r));
   ballC=c;
  }else if(uMat==2){
   vec2 sg=vec2(atan(sp.x,sp.z)*2.6,asin(clamp(sp.y,-1.,1.))*3.2);
   vec2 sc=floor(sg),sf=fract(sg);
   float bit=step(.5,hash3(vec3(sc*2.3+floor(sf*vec2(3.,4.))*.7,floor(uTime*(2.+4.*uEnergy)+hash3(vec3(sc,4.))*9.))))*step(.12,sf.x)*step(sf.x,.88)*step(.1,sf.y)*step(sf.y,.9);
   ballC=uBase*1.5+uMid*bit*(.35+.65*z)*(.9+uAmp)+uLight*pow(1.-z,3.)*.7;
  }else if(uMat==3){
   float sw=fbm(sp*2.2+vec3(0.,0.,t*.2));
   float sw2=fbm(sp*4.5+sw*2.-vec3(t*.15));
   vec3 c=mix(uMid,uBase,smoothstep(.3,.75,sw2));
   float curl=abs(fract(sw2*5.+sw*2.)-.5)*2.;
   c=mix(c,uLight*.9,smoothstep(.12,.0,curl)*.4);
   c=mix(c,uLight,pow(1.-z,2.)*.55);
   c*=.75+.35*dif;
   ballC=c;
  }else{
   float heat=clamp(fbm(sp*3.+vec3(0.,0.,t*.45))*.9+fbm(sp*6.-vec3(t*.35))*.45+uAmp*.2,0.,1.);
   vec3 c=mix(uMid,uLight,smoothstep(.3,.7,heat));
   c=mix(c,uHot,smoothstep(.65,.95,heat));
   ballC=mix(uBase,c,.55+.45*z)*(1.+thump*.5);
   glowC=uMid*exp(-max(r-R,0.)*9.)*.5;
  }
  ballA=ball;ballC*=ball;
  // Streams in orbit around the ball.
  for(int i=0;i<3;i++){
   float fi=float(i);
   float vis=fi<.5?1.:fi<1.5?clamp(.55+uListen*.2+uAmp+uEnergy,0.,1.):clamp(uAmp*1.5+uEnergy*1.2+uAlert*.5,0.,1.);
   float a=R*(1.32+.2*fi)+uEnergy*.02*sin(t*3.+fi);
   float squash=.3+.12*fi+.05*sin(t*.2+fi);
   float tilt=.55-.5*fi+.25*sin(t*.07+fi*2.);
   float head=t*(.8+.3*fi)*pace+fi*2.1;
   float arc=1.5+.7*fi+uEnergy*2.2+uAmp*.8;
   float width=(uMat==3?.07:uMat==4?.045:.03)*(1.-fi*.15)*(.75+.5*uAmp+.25*uEnergy);
   // Smoke and flame ribbons wave and drift; water stays crisp.
   float wv=uMat==3?.07:uMat==4?.035:.012;
   vec2 ouv=uv+(vec2(fbm(vec3(uv*3.,t*.5+fi)),fbm(vec3(uv*3.+7.,t*.5+fi)))-.5)*wv;
   vec4 o=orbit(ouv,a,squash,tilt,head,arc,width*(uMat==3?1.5:1.),px);
   vec3 sc;float sa=o.x*vis;
   if(uMat==0){
    // Water stream: toon shaded, a white streak along it, the tail breaking into drops.
    sc=mix(uLight,uMid,smoothstep(-.2,1.,o.w));
    sc=mix(sc,vec3(1.),smoothstep(.25,0.,abs(o.w+.45))*.85);
    float drops=step(.45,vnoise(vec3(o.y*22.,fi,t*.5)));
    sa*=mix(1.,drops,smoothstep(.55,.8,o.y));
   }else if(uMat==2){
    // Data ring: glyphs travelling along the orbit, the leading one bright.
    float g=o.y*arc*14.;
    float cell=fract(g),cid=floor(g);
    float row=step(0.,o.w);
    float bit=step(.42,hash3(vec3(cid,fi+row*3.,floor(uTime*(4.+6.*uEnergy)))+vec3(floor(cell*3.),floor(fract(o.w*.5+.5)*4.),0.)*.31));
    float lit=bit*step(.15,cell)*step(cell,.85);
    sc=mix(uMid,mix(uLight,vec3(1.),.6),smoothstep(.12,0.,o.y))*lit*1.4;
    sa*=max(lit,.15);
   }else if(uMat==3){
    // Smoke stream: soft and textured, thinning out as it trails away.
    float tex=fbm(vec3(o.y*5.-t*.4,o.w*1.5,fi+t*.1));
    sc=mix(uLight,uMid,smoothstep(.35,.75,tex));
    sc=mix(sc,uBase,smoothstep(.6,.9,tex)*.6);
    float curl=abs(fract(tex*5.+o.y*3.)-.5)*2.;
    sc=mix(sc,mix(uLight,vec3(1.),.3),smoothstep(.12,.0,curl)*.5);
    sa*=smoothstep(.25,.55,tex+.25*(1.-o.y))*(1.-o.y*.6)*smoothstep(1.,.15,abs(o.w));
   }else{
    // Fire stream: a ribbon of flame flickering along the orbit.
    float fl=fbm(vec3(o.y*7.-t*3.,o.w*1.4,fi+t*.6));
    float I=clamp((1.-o.y)*.9+fl*.7-abs(o.w)*.8,0.,1.);
    sc=mix(uBase,uMid,smoothstep(.15,.45,I));
    sc=mix(sc,uLight,smoothstep(.45,.75,I));
    sc=mix(sc,uHot,smoothstep(.8,1.,I));
    sa*=smoothstep(.12,.35,I);
   }
   sc*=sa;
   if(o.z>.5){frontC=frontC+sc*(1.-frontA);frontA=frontA+sa*(1.-frontA);}
   else{backC=backC+sc*(1.-backA);backA=backA+sa*(1.-backA);}
  }
  if(uMat==4){
   // Embers thrown out of the burning ball.
   for(int i=0;i<6;i++){
    float fi=float(i);
    float cyc=uTime*(.5+.3*hash3(vec3(fi,2.,2.)))*pace+hash3(vec3(fi,8.,1.));
    float id=floor(cyc),life=fract(cyc);
    float a=6.2832*hash3(vec3(fi,id,3.));
    vec2 e=vec2(cos(a),sin(a))*(R+life*(.25+.2*hash3(vec3(fi,id,6.))))+vec2(0.,life*life*.12);
    float spark=smoothstep(.012,.0,length(uv-e))*(1.-life);
    frontC+=uHot*spark;frontA=max(frontA,spark);
   }
  }
 }
 // Analysis: a thin scanning ring sweeps round the ball.
 float ringR=R*1.18;
 float scanRing=uEnergy*smoothstep(.006,.0,abs(r-ringR))*smoothstep(.5,1.,cos(ang-uTime*4.5))*(uMat==1?0.:1.);
 // Follow-up ready: a heartbeat and a shock wave leaving the ball.
 float waveR=R*(uMat==1?1.45:1.)+beat*.45;
 float wave=uAlert*smoothstep(.02,.0,abs(r-waveR))*(1.-beat)*.9;
 vec3 warm=mix(uLight,vec3(1.,.66,.4),.45);
 vec3 fx=uLight*scanRing+warm*wave;
 float fxA=clamp(scanRing+wave,0.,1.);
 float glowA=clamp(max(glowC.r,max(glowC.g,glowC.b)),0.,1.);
 vec3 col=frontC+(1.-frontA)*(ballC+(1.-ballA)*(backC+glowC*(1.-backA)));
 float alpha=frontA+(1.-frontA)*(ballA+(1.-ballA)*(backA+(1.-backA)*glowA));
 col+=fx*(1.-alpha*.5);alpha=clamp(max(alpha,fxA),0.,1.);
 gl_FragColor=vec4(col,alpha);
}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'orb-canvas'; canvas.setAttribute('aria-hidden', 'true');
  bubble.prepend(canvas);
  const seed = Math.random() * 50;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let gl = null, uniforms = {}, raf = 0, rafView = null, lastFrame = 0, lastDraw = 0;
  let amp = 0, energy = 0, alert = 0, listen = 0;
  // Voice level: from an analysed microphone stream when there is one, otherwise short pulses on recognised speech.
  let analyser = null, audioContext = null, samples = null, pulseLevel = 0, pulseAt = 0;

  const hex = value => { const n = parseInt(value.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  // Software or emulated GPUs (SwiftShader, llvmpipe, Android emulator…) can freeze the page:
  // the CSS bubble stays there, unless the viewer asked for WebGL (localStorage "interprete-orb" = "webgl").
  function softwareRenderer(context) {
    try {
      const info = context.getExtension('WEBGL_debug_renderer_info');
      const name = String(context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER));
      // Emulated or virtual GPUs (Android emulator, VMs) are listed too: they can freeze the whole device.
      return /swiftshader|llvmpipe|softpipe|software|basic render|emulator|gfxstream|translator|virgl|vmware|virtualbox|parallels/i.test(name);
    } catch { return false; }
  }
  function forced() { try { return localStorage.getItem('interprete-orb') === 'webgl'; } catch { return false; } }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function setup() {
    // On Android, ask the app first: creating a context on an emulated GPU can already crash the renderer.
    try { if (window.InterpreteNative?.emulatedGpu?.() && !forced()) return false; } catch { /* Older bridge: carry on. */ }
    gl = canvas.getContext('webgl', {alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power'});
    if (!gl) return false;
    if (softwareRenderer(gl) && !forced()) { gl.getExtension('WEBGL_lose_context')?.loseContext(); gl = null; return false; }
    const shader = (type, source) => { const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value); return value; };
    try {
      const program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      // Compile without blocking the page when the browser allows it; the CSS bubble shows meanwhile.
      const parallel = gl.getExtension('KHR_parallel_shader_compile');
      if (parallel) {
        const limit = performance.now() + 8000;
        while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
          if (performance.now() > limit) throw new Error('Shader de la bulle trop lent à préparer.');
          await pause(50);
        }
      } else await pause(0);
      if (!gl || !gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader de la bulle refusé.');
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = {};
      for (const name of ['uRes', 'uTime', 'uAmp', 'uEnergy', 'uAlert', 'uListen', 'uSeed', 'uLife', 'uMat', 'uLight', 'uMid', 'uHot', 'uBase']) uniforms[name] = gl.getUniformLocation(program, name);
      gl.clearColor(0, 0, 0, 0);
      return true;
    } catch { gl?.getExtension('WEBGL_lose_context')?.loseContext(); gl = null; return false; }
  }
  // Watchdog: if the device cannot keep about 12 images per second, return to the CSS bubble for good.
  let watchStart = 0, watchFrames = 0, watched = false;
  function giveUp() {
    if (raf) { rafView?.cancelAnimationFrame(raf); raf = 0; }
    companion.classList.remove('orb-gl');
    const context = gl; gl = null; context?.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  }
  function watch(now, delta) {
    if (watched || reduceMotion?.matches) return;
    if (!watchStart || delta > .5) { watchStart = now; watchFrames = 0; return; }
    watchFrames++;
    const elapsed = (now - watchStart) / 1000;
    if (elapsed >= 2.5) { watched = true; if (watchFrames / elapsed < 12) giveUp(); }
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
    listen += ((listening ? 1 : 0) - listen) * slow;
    // Phones have dense screens: 1.5 pixels per CSS pixel is enough for a small bubble.
    const ratio = Math.min(companion.ownerDocument.defaultView.devicePixelRatio || 1, window.InterpreteNative ? 1.5 : 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const material = MATERIALS[companion.ownerDocument.documentElement.dataset.theme] || MATERIALS.pastel;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.uRes, width, height); gl.uniform1f(uniforms.uTime, still ? 14 : now / 1000);
    gl.uniform1f(uniforms.uAmp, amp); gl.uniform1f(uniforms.uEnergy, energy); gl.uniform1f(uniforms.uAlert, alert); gl.uniform1f(uniforms.uListen, listen);
    gl.uniform1f(uniforms.uSeed, seed); gl.uniform1f(uniforms.uLife, LIFE); gl.uniform1i(uniforms.uMat, material.id);
    gl.uniform3fv(uniforms.uLight, hex(material.light)); gl.uniform3fv(uniforms.uMid, hex(material.mid));
    gl.uniform3fv(uniforms.uHot, hex(material.hot)); gl.uniform3fv(uniforms.uBase, hex(material.base));
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    return amp > 0.02 || energy > 0.02 || alert > 0.02 || listen > 0.02;
  }
  function frame(now) {
    raf = 0;
    if (!gl || !visible()) return;
    const delta = Math.min(0.1, (now - (lastFrame || now)) / 1000); lastFrame = now;
    // Faster states get every frame; rest is capped at 30 images per second.
    const busy = amp > 0.02 || energy > 0.02 || alert > 0.02 || companion.classList.contains('is-listening');
    if (busy || now - lastDraw >= IDLE_FRAME_MS - 1) { const since = (now - lastDraw) / 1000; draw(now, Math.max(delta, since)); lastDraw = now; watch(now, since); if (!gl) return; }
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
  canvas.addEventListener('webglcontextrestored', () => { setup().then(ready => { if (ready) { companion.classList.add('orb-gl'); wake(); } }); });
  setup().then(ready => { if (!ready) { canvas.remove(); return; } companion.classList.add('orb-gl'); wake(); });

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
