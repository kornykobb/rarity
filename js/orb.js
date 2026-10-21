"use strict";
(() => {
  const orbs = new Set();
  const photo = new Image();
  photo.src = "assets/baby-beefer.png";
  let frame = 0,
    stopped = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const draw = (time) => {
    if (stopped) return;
    for (const orb of orbs) {
      if (
        !document.hidden &&
        orb.node.isConnected &&
        orb.node.getClientRects().length
      )
        orb.draw(
          reduced.matches ? 0 : Math.sin(time / 2400) * 0.22,
          reduced.matches ? 0 : time / 1000,
        );
    }
    frame = requestAnimationFrame(draw);
  };
  RG.BeeferOrb = () => {
    const node = document.createElement("canvas");
    node.className = "beefer-orb";
    node.width = node.height = 96;
    node.setAttribute("aria-hidden", "true");
    const gl = node.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      node.classList.add("orb-fallback");
      return node;
    }
    const shader = (type, source) => {
      const item = gl.createShader(type);
      gl.shaderSource(item, source);
      gl.compileShader(item);
      if (!gl.getShaderParameter(item, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(item));
      return item;
    };
    const vertex = shader(
      gl.VERTEX_SHADER,
      `
      attribute vec3 position; attribute vec2 uv;
      uniform float turn; varying vec2 texcoord; varying vec3 normal;
      void main() {
        float c = cos(turn), s = sin(turn);
        normal = vec3(c*position.x+s*position.z, position.y, -s*position.x+c*position.z);
        texcoord = uv;
        gl_Position = vec4(normal.xy*0.90, -normal.z*0.5, 1.0);
      }`,
    );
    const fragment = shader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      uniform sampler2D photo; varying vec2 texcoord; varying vec3 normal;
      void main() {
        vec3 n = normalize(normal), light = normalize(vec3(-0.45,0.6,1.0));
        vec4 face = texture2D(photo, vec2((texcoord.x-0.5)*1.3+0.36, texcoord.y*0.8+0.04));
        vec3 fur = mix(vec3(0.23,0.18,0.13), face.rgb, face.a);
        float diffuse = 0.45+0.55*max(dot(n,light),0.0);
        float gloss = pow(max(dot(reflect(-light,n),vec3(0.0,0.0,1.0)),0.0),32.0)*0.24;
        gl_FragColor = vec4(fur*diffuse+gloss,1.0);
      }`,
    );
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program));
    const vertices = [];
    const point = (u, v) => {
      const angle = (u - 0.5) * Math.PI * 2,
        latitude = v * Math.PI;
      vertices.push(
        Math.sin(latitude) * Math.sin(angle),
        Math.cos(latitude),
        Math.sin(latitude) * Math.cos(angle),
        u,
        1 - v,
      );
    };
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 48; x++) {
        const u = x / 48,
          nextU = (x + 1) / 48,
          v = y / 24,
          nextV = (y + 1) / 24;
        point(u, v);
        point(nextU, v);
        point(u, nextV);
        point(nextU, v);
        point(nextU, nextV);
        point(u, nextV);
      }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.useProgram(program);
    for (const [name, size, offset] of [
      ["position", 3, 0],
      ["uv", 2, 12],
    ]) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 20, offset);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.enable(gl.DEPTH_TEST);
    const turn = gl.getUniformLocation(program, "turn");
    const orb = {
      node,
      draw(angle) {
        gl.viewport(0, 0, 96, 96);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(turn, angle);
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 5);
      },
      dispose() {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
      },
    };
    const ready = () => {
      if (stopped) return;
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          photo,
        );
        node.dataset.renderer = "webgl";
        orbs.add(orb);
        orb.draw(0);
        if (!frame) frame = requestAnimationFrame(draw);
      } catch {
        node.classList.add("orb-fallback");
        orb.dispose();
      }
    };
    if (photo.complete && photo.naturalWidth) ready();
    else photo.addEventListener("load", ready, { once: true });
    return node;
  };
  const noiseSource = `
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float value = 0.0, amp = 0.5;
      for (int i = 0; i < 5; i++) {
        value += amp * noise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        amp *= 0.5;
      }
      return value;
    }`;
  RG.ShaderCanvas = (className, size, body) => {
    const node = document.createElement("canvas");
    node.className = className;
    node.width = node.height = size;
    node.setAttribute("aria-hidden", "true");
    const gl = node.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return null;
    const compile = (type, source) => {
      const item = gl.createShader(type);
      gl.shaderSource(item, source);
      gl.compileShader(item);
      if (!gl.getShaderParameter(item, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(item));
      return item;
    };
    let vertex, fragment, program;
    try {
      vertex = compile(
        gl.VERTEX_SHADER,
        "attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }",
      );
      fragment = compile(
        gl.FRAGMENT_SHADER,
        `precision mediump float;
        uniform float time; uniform vec2 size;
        ${noiseSource}
        ${body}`,
      );
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program));
    } catch {
      return null;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(program, "size"), size, size);
    const time = gl.getUniformLocation(program, "time"),
      values = new Map();
    const surface = {
      node,
      set(name, ...value) {
        values.set(name, value);
      },
      draw(_, seconds) {
        gl.viewport(0, 0, size, size);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(time, seconds % 1000);
        for (const [name, value] of values)
          gl[`uniform${value.length}f`](
            gl.getUniformLocation(program, name),
            ...value,
          );
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose() {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
      },
    };
    node.dataset.renderer = "webgl";
    orbs.add(surface);
    if (!frame && !stopped) frame = requestAnimationFrame(draw);
    return surface;
  };
  RG.SoulOrb = () => {
    const shader = RG.ShaderCanvas(
      "soul-orb-canvas",
      240,
      `uniform vec3 tint;
      void main() {
        vec2 p = gl_FragCoord.xy / size * 2.0 - 1.0;
        p.y += 0.2;
        float t = time;
        float up = smoothstep(-0.15, 0.95, p.y);
        vec2 q = p;
        q.x += (fbm(vec2(p.x * 2.4, p.y * 2.0 - t * 1.3)) - 0.5) * 0.42 * up;
        float wobble = 0.025 * sin(t * 1.7 + p.y * 4.0) + 0.025 * sin(t * 1.3 + p.x * 5.0);
        float d = length(vec2(q.x * (1.0 + 0.45 * up), q.y * (1.0 - 0.3 * up)));
        float tongue = fbm(vec2(q.x * 3.2, q.y * 2.4 - t * 2.1));
        float radius = 0.5 + wobble + up * (tongue - 0.32) * 0.75;
        float edge = d - radius;
        float body = 1.0 - smoothstep(-0.015, 0.015, edge);
        float inner = clamp(-edge / radius, 0.0, 1.0);
        float rim = 1.0 - smoothstep(0.0, 0.3, inner);
        float swirl = fbm(p * 3.0 + vec2(0.0, -t * 0.7) + fbm(p * 2.0 - t * 0.25) * 1.6);
        vec3 deep = tint * 0.14, mid = tint, hot = mix(tint, vec3(1.0), 0.8);
        vec3 color = mix(deep, mid, smoothstep(0.25, 0.8, swirl));
        color = mix(color, hot, pow(inner, 2.2) * 0.55 * (1.0 - up * 0.4));
        color += hot * rim * 0.5;
        color += mix(tint, vec3(1.0), 0.4) * up * tongue * 0.45;
        float spec = smoothstep(0.17, 0.0, length((p - vec2(-0.18, 0.12)) * vec2(1.0, 1.7)));
        color += spec * 0.75;
        float alpha = body * (0.32 + rim * 0.5 + spec * 0.45 + swirl * 0.18 + pow(inner, 3.0) * 0.2);
        alpha *= 1.0 - smoothstep(0.6, 1.15, p.y);
        float glow = exp(-max(edge, 0.0) * 11.0) * 0.32 * (1.0 - body) * (1.0 - smoothstep(0.4, 1.1, p.y));
        color = mix(tint, color, body);
        gl_FragColor = vec4(min(color, 1.0), clamp(alpha + glow, 0.0, 1.0));
      }`,
    );
    if (shader) return shader;
    const node = document.createElement("div");
    node.className = "soul-orb";
    node.setAttribute("aria-hidden", "true");
    return { node, set() {} };
  };
  const nodeShaders = {
    prestige: `
      void main() {
        vec2 p = gl_FragCoord.xy / size * 2.0 - 1.0;
        float t = time;
        float r = length(p), a = atan(p.y, p.x);
        float rays = pow(0.5 + 0.5 * sin(a * 12.0 + t * 0.6), 6.0);
        rays += pow(0.5 + 0.5 * sin(a * 7.0 - t * 0.9 + 1.3), 8.0) * 0.6;
        float metal = fbm(vec2(a * 2.0, r * 4.0 - t * 0.35));
        vec3 dark = vec3(0.42, 0.25, 0.04), gold = vec3(1.0, 0.78, 0.3), shine = vec3(1.0, 0.97, 0.82);
        vec3 color = mix(dark, gold, smoothstep(0.15, 0.85, metal));
        color = mix(color, shine, rays * smoothstep(1.0, 0.15, r) * 0.55);
        color += shine * smoothstep(0.45, 0.0, r) * 0.35;
        float sweep = pow(max(0.0, 1.0 - abs(p.x + p.y * 0.6 - mod(t * 0.9, 5.0) + 2.5) * 2.5), 4.0);
        color += shine * sweep * 0.35;
        gl_FragColor = vec4(min(color, 1.0), 1.0);
      }`,
    essence: `
      void main() {
        vec2 p = gl_FragCoord.xy / size * 2.0 - 1.0;
        float t = time;
        vec3 color = mix(vec3(0.01, 0.02, 0.08), vec3(0.03, 0.07, 0.2), 0.5 - p.y * 0.5);
        for (int i = 0; i < 4; i++) {
          float layer = float(i);
          float scale = 1.5 + layer * 1.1;
          vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p * scale;
          q += vec2(t * (0.12 + layer * 0.07), t * (0.05 + layer * 0.04));
          vec2 id = floor(q), f = fract(q) - 0.5;
          float seed = hash(id + layer * 17.0);
          float grow = 0.5 + 0.5 * sin(t * (0.8 + seed) + seed * 6.28);
          float extent = mix(0.08, 0.36, grow) * step(0.35, seed);
          float square = max(abs(f.x), abs(f.y));
          float fill = smoothstep(extent + 0.02, extent - 0.02, square);
          float depth = 1.0 - layer / 4.0;
          vec3 tone = mix(vec3(0.1, 0.22, 0.6), vec3(0.45, 0.75, 1.0), seed);
          color = mix(color, tone * (0.35 + 0.65 * (1.0 - depth)), fill * (0.25 + 0.5 * (1.0 - depth)));
        }
        color += vec3(0.2, 0.45, 1.0) * smoothstep(0.9, 0.0, length(p)) * 0.12;
        gl_FragColor = vec4(min(color, 1.0), 1.0);
      }`,
  };
  RG.NodeShader = (id) =>
    nodeShaders[id]
      ? RG.ShaderCanvas("body-node-shader", 200, nodeShaders[id])
      : null;
  RG.stopOrbs = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    orbs.forEach((orb) => orb.dispose());
    orbs.clear();
  };
})();
