'use client';

import { useRef, useEffect, useState } from 'react';

export function PricingShader() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const bgLocRef = useRef<WebGLUniformLocation | null>(null);
  const [bgColor, setBgColor] = useState([0, 0, 0]);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      setBgColor(root.classList.contains('dark') ? [0, 0, 0] : [1, 1, 1]);
    };
    update();
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === 'class') update();
      }
    });
    obs.observe(root, { attributes: true });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const gl = glRef.current;
    const prog = progRef.current;
    const loc = bgLocRef.current;
    if (gl && prog && loc) {
      gl.useProgram(prog);
      gl.uniform3fv(loc, new Float32Array(bgColor));
    }
  }, [bgColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;
    glRef.current = gl;

    const vs = `attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}`;
    const fs = `
      precision highp float;
      uniform float iTime; uniform vec2 iResolution; uniform vec3 uBg;
      mat2 r2d(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
      float v(vec2 a,vec2 b,float s,float sp){return sin(dot(normalize(a),normalize(b))*s+iTime*sp)/100.;}
      vec3 pc(vec2 uv,vec2 c,float r,float w){
        vec2 d=c-uv;float l=length(d);l+=v(d,vec2(0,1),5.,2.);l-=v(d,vec2(1,0),5.,2.);
        return vec3(smoothstep(r-w,r,l)-smoothstep(r,r+w,l));
      }
      void main(){
        vec2 uv=gl_FragCoord.xy/iResolution.xy;uv.x*=1.5;uv.x-=.25;
        float m=0.;vec2 c=vec2(.5);
        m+=pc(uv,c,.35,.035).r;m+=pc(uv,c,.332,.01).r;m+=pc(uv,c,.368,.005).r;
        vec2 v2=r2d(iTime)*uv;vec3 fg=vec3(v2.x,v2.y,.7-v2.y*v2.x);
        vec3 col=mix(uBg,fg,m);col=mix(col,vec3(1),pc(uv,c,.35,.003).r);
        gl_FragColor=vec4(col,1.);
      }`;

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
      return s;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    progRef.current = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tLoc = gl.getUniformLocation(prog, 'iTime');
    const rLoc = gl.getUniformLocation(prog, 'iResolution');
    bgLocRef.current = gl.getUniformLocation(prog, 'uBg');
    gl.uniform3fv(bgLocRef.current, new Float32Array(bgColor));

    let frame: number;
    const render = (time: number) => {
      gl.uniform1f(tLoc, time * 0.001);
      gl.uniform2f(rLoc, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = requestAnimationFrame(render);
    };
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = canvas.parentElement?.offsetHeight ?? window.innerHeight;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    };
    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="bg-bg pointer-events-none absolute inset-0 z-0 block h-full w-full"
    />
  );
}
