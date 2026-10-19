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
        orb.draw(reduced.matches ? 0 : Math.sin(time / 2400) * 0.22);
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
  RG.stopOrbs = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    orbs.forEach((orb) => orb.dispose());
    orbs.clear();
  };
})();
