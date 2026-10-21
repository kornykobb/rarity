"use strict";
(() => {
  const entries = new Map();
  let attempted = false;
  let gpu = null,
    frame = 0,
    lastFrame = 0;
  const materials = ["diamond", "ruby", "uranium", "mythril", "adamantite"];
  function initialize() {
    if (gpu) return gpu;
    if (attempted) return null;
    attempted = true;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return null;
    const vertex = `attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
    const fragment = `precision mediump float;
      varying vec2 uv; uniform sampler2D mask; uniform vec3 fillColor, strokeColor;
      uniform float time, material, surface; uniform vec2 aspect;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      float fbm(vec2 p){
        float v=0.,a=.5;
        for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}
        return v;
      }
      vec3 diamond(vec2 p,float t,out float glow){
        vec2 w=p+vec2(fbm(p*1.2+t*.12),fbm(p*1.2+3.1-t*.1))*.9;
        float caustic=pow(1.-abs(sin((fbm(w*1.8)+t*.06)*11.)),7.);
        caustic+=pow(1.-abs(sin((fbm(w*2.6+4.)-t*.05)*9.)),9.)*.6;
        vec2 g=floor(p*5.);float s=hash(g);
        float twinkle=pow(max(0.,sin(t*2.3+s*40.)),24.)*step(.82,s);
        vec2 f=fract(p*5.)-.5;
        float star=twinkle*smoothstep(.22,0.,length(f))*(1.+smoothstep(.06,0.,min(abs(f.x),abs(f.y)))*2.);
        glow=caustic*.55+star;
        return mix(fillColor*.3,vec3(.86,.97,1.),clamp(caustic,0.,1.))+star;
      }
      vec3 ruby(vec2 p,float t,out float glow){
        float f=fbm(p*1.5+vec2(0.,-t*.22)+fbm(p*2.2+t*.09)*1.5);
        float veins=pow(1.-abs(f*2.-1.),9.);
        float ember=pow(fbm(p*3.+vec2(t*.2,-t*.4)),3.)*1.4;
        glow=veins*.7+ember*.3;
        return mix(vec3(.22,0.,.03),fillColor*1.05,f)+vec3(1.,.5,.45)*veins*.8+vec3(1.,.3,.2)*ember*.25;
      }
      vec3 uranium(vec2 p,float t,out float glow){
        float pulse=.78+.22*sin(t*1.6);
        float field=smoothstep(.35,.78,fbm(p*.8+vec2(0.,-t*.22)));
        vec2 b=p*2.2+vec2(0.,-t*.35);
        vec2 id=floor(b),f=fract(b)-.5;
        vec2 offset=(vec2(hash(id+1.),hash(id+2.))-.5)*.3;
        float r=.13+.08*hash(id);
        float d=length(f-offset);
        float show=step(.68,hash(id+3.));
        float bubble=show*(smoothstep(r,r-.03,d)*.22+smoothstep(.022,0.,abs(d-r))*.78);
        glow=field*pulse*.45+bubble*.5;
        return mix(vec3(.015,.07,.015),vec3(.32,.92,.14),field*pulse)+vec3(.82,1.,.55)*bubble*.6;
      }
      vec3 mythril(vec2 p,float t,out float glow){
        vec2 q=p+vec2(fbm(p+t*.08),fbm(p+5.2-t*.08))*1.6;
        float silk=.5+.5*sin(q.x*3.5+q.y*2.+t*.55);
        float sheen=pow(silk,7.);
        glow=sheen*.6+silk*.12;
        return mix(fillColor*.38,vec3(.93,.9,1.),silk*.7)+vec3(.75,.7,1.)*sheen*.35;
      }
      vec3 adamantite(vec2 p,float t,out float glow){
        float brushed=noise(vec2(p.x*1.2,p.y*30.))*.6+noise(vec2(p.x*2.5,p.y*60.))*.4;
        vec2 q=p+vec2(fbm(p*.6+t*.05),fbm(p*.6+4.-t*.05))*2.2;
        float band=sin(q.x*1.5+q.y*.9+t*.45);
        float aurora=pow(1.-abs(band),3.)*smoothstep(.3,.75,fbm(q*1.1+t*.04));
        vec3 prism=.55+.45*cos(6.2831*(vec3(0.,.33,.67)+q.x*.14+q.y*.09+t*.07));
        float crack=pow(1.-abs(fbm(p*2.2+vec2(t*.12,-t*.08))*2.-1.),22.);
        float sweep=pow(max(0.,1.-abs(fract(p.x*.3+p.y*.17-t*.08)-.5)*4.),3.);
        glow=aurora*.85+crack*.8+sweep*.45;
        vec3 steel=mix(vec3(.02,.025,.04),vec3(.14,.17,.24),brushed);
        return steel+prism*aurora*.95+mix(prism,vec3(1.),.6)*crack*.9+vec3(.85,.92,1.)*sweep*.4;
      }
      void main(){
        vec2 p=uv*aspect;float t=time;float glow=0.;vec3 color;
        if(material<.5)color=diamond(p,t,glow);
        else if(material<1.5)color=ruby(p,t,glow);
        else if(material<2.5)color=uranium(p,t,glow);
        else if(material<3.5)color=mythril(p,t,glow);
        else color=adamantite(p,t,glow);
        vec4 m=texture2D(mask,uv);
        float strength=material>3.5?1.6:1.;
        float body=surface>.5&&m.r>.01?(.05+glow*.24)*strength:0.;
        float rim=m.g;
        float alpha=max(body,rim);
        if(alpha<.01)discard;
        vec3 edge=mix(strokeColor,color*1.25+.12,.75);
        if(material>3.5)edge=color*1.6+.25;
        vec3 tone=surface>.5?mix(color,edge,rim/alpha):mix(strokeColor*.55,color,.35);
        gl_FragColor=vec4(clamp(tone,0.,1.)*alpha,alpha);
      }`;
    function shader(type, source) {
      const result = gl.createShader(type);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS))
        throw new Error("Achievement shader compile failed");
      return result;
    }
    try {
      const program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      const uniforms = Object.fromEntries(
        ["mask", "fillColor", "strokeColor", "time", "material", "aspect", "surface"].map(
          (name) => [name, gl.getUniformLocation(program, name)],
        ),
      );
      gl.uniform1i(uniforms.mask, 0);
      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        gpu = null;
        entries.forEach((entry) =>
          entry.host.removeAttribute("data-shader-ready"),
        );
      });
      gpu = { canvas, gl, program, texture, uniforms };
      return gpu;
    } catch {
      return null;
    }
  }
  const color = (hex) =>
    [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  function raster(entry, box) {
    const css = getComputedStyle(entry.host),
      ratio = Math.min(2, devicePixelRatio || 1);
    const fontSize = parseFloat(css.fontSize),
      lineHeight = parseFloat(css.lineHeight) || fontSize * 1.2;
    const key = [
      entry.surface ? "surface" : entry.host.textContent,
      box.width,
      box.height,
      css.font,
    ].join("|");
    if (entry.key === key) return;
    entry.key = key;
    const pad = 4,
      mask = document.createElement("canvas");
    mask.width = Math.min(1024, Math.ceil((box.width + pad * 2) * ratio));
    mask.height = Math.min(256, Math.ceil((box.height + pad * 2) * ratio));
    const ctx = mask.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    if (entry.surface) {
      mask.width = Math.min(1024, Math.ceil(box.width * ratio));
      mask.height = Math.min(1024, Math.ceil(box.height * ratio));
      const surface = mask.getContext("2d");
      surface.fillStyle = "rgb(22,0,0)";
      surface.fillRect(0, 0, mask.width, mask.height);
      surface.strokeStyle = "#00ff00";
      surface.lineWidth = 2 * ratio;
      surface.strokeRect(
        ratio,
        ratio,
        mask.width - 2 * ratio,
        mask.height - 2 * ratio,
      );
      entry.mask = mask;
      entry.canvas.width = mask.width;
      entry.canvas.height = mask.height;
      entry.canvas.style.width = `${mask.width / ratio}px`;
      entry.canvas.style.height = `${mask.height / ratio}px`;
      return;
    }
    const available =
      box.width -
      (parseFloat(css.paddingRight) || 0) -
      (parseFloat(css.paddingLeft) || 0);
    const words = entry.text.split(/\s+/),
      lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > available) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    lines.forEach((text, index) => {
      const x = pad + (parseFloat(css.paddingLeft) || 0),
        y =
          pad +
          index * lineHeight +
          (() => {
            const metrics = ctx.measureText(text);
            const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.9;
            const descent = metrics.fontBoundingBoxDescent || fontSize * 0.2;
            return (lineHeight - ascent - descent) / 2 + ascent;
          })();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#00ff00";
      ctx.strokeText(text, x, y);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#fff";
      ctx.fillText(text, x, y);
      ctx.globalCompositeOperation = "source-over";
    });
    entry.mask = mask;
    entry.canvas.width = mask.width;
    entry.canvas.height = mask.height;
    entry.canvas.style.width = `${mask.width / ratio}px`;
    entry.canvas.style.height = `${mask.height / ratio}px`;
  }
  function render(now) {
    frame = 0;
    if (document.hidden) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = false;
    for (const [host, entry] of entries) {
      if (!host.isConnected || !entry.canvas.isConnected) {
        observer.unobserve(host);
        resized.unobserve(host);
        entries.delete(host);
        continue;
      }
      if (!entry.visible) continue;
      visible = true;
      if (now - lastFrame < 33) continue;
      const box = host.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const state = initialize();
      if (!state) continue;
      raster(entry, box);
      const { gl, canvas, uniforms } = state,
        w = entry.mask.width,
        h = entry.mask.height;
      gl.viewport(0, 0, w, h);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindTexture(gl.TEXTURE_2D, state.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        entry.mask,
      );
      gl.uniform3fv(uniforms.fillColor, color(entry.tier.fill));
      gl.uniform3fv(uniforms.strokeColor, color(entry.tier.stroke));
      gl.uniform1f(uniforms.time, reduced ? 4 : now / 1000);
      gl.uniform1f(uniforms.material, materials.indexOf(entry.tier.shader));
      gl.uniform1f(uniforms.surface, entry.surface ? 1 : 0);
      const cellSize = entry.surface ? 64 : 18;
      gl.uniform2f(
        uniforms.aspect,
        Math.max(3, w / cellSize),
        Math.max(2, h / cellSize),
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      const ctx = entry.canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
      entry.canvas.dataset.renderer = "webgl";
      entry.canvas.dataset.material = entry.tier.shader;
      host.dataset.shaderReady = "true";
    }
    if (now - lastFrame >= 33) lastFrame = now;
    if (visible && !reduced) frame = requestAnimationFrame(render);
  }
  const wake = () => {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  };
  const observer = new IntersectionObserver((changes) => {
    changes.forEach((change) => {
      const entry = entries.get(change.target);
      if (entry) entry.visible = change.isIntersecting;
    });
    wake();
  });
  const resized = new ResizeObserver(() => {
    entries.forEach((entry) => (entry.key = ""));
    wake();
  });
  document.addEventListener("visibilitychange", wake);
  RG.AchievementShader = (host, tier, surface = false) => {
    if (!tier.shader) return;
    const canvas = RG.el(
      "canvas",
      `achievement-shader${surface ? " achievement-shader-surface" : ""}`,
    );
    canvas.setAttribute("aria-hidden", "true");
    const entry = {
      host,
      canvas,
      tier,
      text: host.textContent,
      key: "",
      visible: host.isConnected && host.getClientRects().length > 0,
      surface,
    };
    host.classList.add("achievement-shader-host");
    host.append(canvas);
    entries.set(host, entry);
    observer.observe(host);
    resized.observe(host);
    wake();
  };
  RG.AchievementSurface = (host, tier) =>
    RG.AchievementShader(host, tier, true);
  RG.stopAchievementShaders = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    observer.disconnect();
    resized.disconnect();
    entries.clear();
    document.removeEventListener("visibilitychange", wake);
  };
})();
