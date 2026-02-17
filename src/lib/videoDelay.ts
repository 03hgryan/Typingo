/**
 * Video delay using WebGL texture buffering.
 * Adapted from Audio-Video-Delay Chrome extension.
 * Captures frames from <video> elements via texImage2D (works cross-origin),
 * buffers them as GPU textures, and renders delayed on an overlay canvas.
 */

const DEFAULT_VIDEO_DELAY_MS = 5000;
const TEXTURE_POOL_SIZE = 4;

interface FrameData {
  texture: WebGLTexture;
  timestamp: number;
}

class DelayedVideoInstance {
  private video: HTMLVideoElement;
  private delay: number;
  private active = true;

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private positionAttr = 0;
  private texCoordAttr = 0;
  private textureUniform: WebGLUniformLocation | null = null;

  private availableTextures: WebGLTexture[] = [];
  private usedTextures = new Set<WebGLTexture>();

  private initialFrame: FrameData | null = null;
  private currentFrame: FrameData | null = null;
  private delayedFrame: FrameData | null = null;
  private lastDrawnTimestamp = 0;
  private startTime = 0;

  private pendingTimeouts: number[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private visibleTab = !document.hidden;
  private tabWasHidden = false;
  private visibilityHandler: (() => void) | null = null;
  private emptiedHandler: (() => void) | null = null;

  constructor(video: HTMLVideoElement, delay: number) {
    this.video = video;
    this.delay = delay;
    this.startTime = performance.now();

    this.createCanvas();
    if (!this.gl) return;

    this.setupWebGL();
    this.createTextures();
    this.captureInitialFrame();
    this.addEventListeners();
    this.startLoops();

    // Hide original video after first frame renders
    setTimeout(() => {
      this.video.style.setProperty("opacity", "0", "important");
    }, 17);
  }

  // ─── Canvas & WebGL Setup ───

  private createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.style.setProperty("pointer-events", "none", "important");
    this.canvas.style.setProperty("object-fit", "contain", "important");

    this.gl = this.canvas.getContext("webgl2") || this.canvas.getContext("webgl");
    if (!this.gl) return;

    if (this.video.parentNode) {
      this.video.parentNode.insertBefore(this.canvas, this.video.nextSibling);
    }

    this.updateCanvasDimensions();
  }

  private setupWebGL() {
    const gl = this.gl!;

    const vsSrc = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
    const fsSrc = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `;

    const vs = this.createShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return;

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) return;

    this.positionAttr = gl.getAttribLocation(this.program, "a_position");
    this.texCoordAttr = gl.getAttribLocation(this.program, "a_texCoord");
    this.textureUniform = gl.getUniformLocation(this.program, "u_texture");

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), gl.STATIC_DRAW);
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private createTextures() {
    const gl = this.gl!;
    for (let i = 0; i < TEXTURE_POOL_SIZE; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.availableTextures.push(tex);
    }
  }

  private getTexture(): WebGLTexture {
    if (this.availableTextures.length > 0) {
      const tex = this.availableTextures.pop()!;
      this.usedTextures.add(tex);
      return tex;
    }
    // Fallback: create new texture
    const gl = this.gl!;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.usedTextures.add(tex);
    return tex;
  }

  private returnTexture(tex: WebGLTexture) {
    if (!this.usedTextures.has(tex)) return;
    this.usedTextures.delete(tex);
    if (this.availableTextures.length < TEXTURE_POOL_SIZE) {
      this.availableTextures.push(tex);
    } else if (this.gl) {
      this.gl.deleteTexture(tex);
    }
  }

  // ─── Event Listeners ───

  private addEventListeners() {
    this.resizeObserver = new ResizeObserver(() => this.updateCanvasDimensions());
    this.resizeObserver.observe(this.video);

    this.video.addEventListener("resize", () => this.updateCanvasDimensions());

    this.visibilityHandler = () => {
      this.visibleTab = !document.hidden;
      if (!this.visibleTab) this.tabWasHidden = true;
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private updateCanvasDimensions() {
    if (!this.canvas || !this.video) return;

    const style = window.getComputedStyle(this.video);
    const rect = this.video.getBoundingClientRect();

    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;

    if (style.position === "absolute" || style.position === "fixed") {
      this.canvas.style.position = style.position;
      this.canvas.style.top = style.top;
      this.canvas.style.left = style.left;
      this.canvas.style.right = style.right;
      this.canvas.style.bottom = style.bottom;
    } else {
      this.canvas.style.position = "absolute";
      this.canvas.style.top = "0";
      this.canvas.style.left = "0";
    }

    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.canvas.style.transform = style.transform;
    this.canvas.style.zIndex = style.zIndex;
    this.canvas.style.margin = style.margin;

    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  // ─── Frame Capture & Rendering ───

  private captureInitialFrame() {
    if (!this.video || this.video.readyState < 2 || !this.gl) return;

    const gl = this.gl;
    const tex = this.getTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);

    this.initialFrame = { texture: tex, timestamp: performance.now() };
    this.drawFrame(tex);
  }

  private captureFrame(): FrameData | null {
    if (!this.video || this.video.readyState < 2 || !this.gl) return null;

    try {
      const gl = this.gl;
      const tex = this.getTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
      return { texture: tex, timestamp: performance.now() };
    } catch {
      return null;
    }
  }

  private drawFrame(texture: WebGLTexture) {
    if (!this.gl || !texture || !this.gl.isTexture(texture)) return;

    const gl = this.gl;
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionAttr);
    gl.vertexAttribPointer(this.positionAttr, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordAttr);
    gl.vertexAttribPointer(this.texCoordAttr, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.textureUniform, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ─── Main Loops ───

  private startLoops() {
    // Render loop: draws the delayed frame
    const renderLoop = () => {
      if (!this.active) return;
      requestAnimationFrame(renderLoop);

      if (!this.visibleTab) return;

      try {
        const now = performance.now();
        if (now - this.startTime < this.delay + 17) {
          // Still in initial buffer period — show frozen first frame
          if (this.initialFrame) this.drawFrame(this.initialFrame.texture);
        } else if (this.delayedFrame && this.delayedFrame.timestamp > this.lastDrawnTimestamp - 34) {
          this.drawFrame(this.delayedFrame.texture);
          this.lastDrawnTimestamp = this.delayedFrame.timestamp;
        }
      } catch {}
    };

    // Capture loop: grabs frames and schedules them for delayed display
    const captureLoop = () => {
      if (!this.active) return;
      requestAnimationFrame(captureLoop);

      if (!this.visibleTab || this.video.paused || this.video.ended) return;

      // Handle tab returning from hidden state
      if (this.tabWasHidden) {
        this.tabWasHidden = false;
        // Reset initial frame to current
        if (this.initialFrame?.texture) this.returnTexture(this.initialFrame.texture);
        const tex = this.getTexture();
        if (this.gl) {
          this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
          this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.video);
        }
        this.initialFrame = { texture: tex, timestamp: performance.now() };
        this.startTime = performance.now();
      }

      const frame = this.captureFrame();
      if (!frame) return;

      this.currentFrame = frame;
      this.scheduleFrameDelay(frame);
    };

    requestAnimationFrame(renderLoop);
    requestAnimationFrame(captureLoop);
  }

  private scheduleFrameDelay(frame: FrameData) {
    const adjustedDelay = this.delay - (performance.now() - frame.timestamp) - 2;

    const timeoutId = window.setTimeout(
      () => {
        if (!this.active) return;
        this.pendingTimeouts = this.pendingTimeouts.filter((id) => id !== timeoutId);

        if (this.delayedFrame?.texture) this.returnTexture(this.delayedFrame.texture);
        this.delayedFrame = frame;
      },
      Math.max(0, adjustedDelay),
    );

    this.pendingTimeouts.push(timeoutId);
  }

  // ─── Cleanup ───

  stop() {
    this.active = false;

    // Clear pending timeouts
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts = [];

    // Restore video visibility
    if (this.video) {
      this.video.style.setProperty("opacity", "1", "important");
      setTimeout(() => {
        this.video.style.setProperty("opacity", "1", "important");
      }, 17);
    }

    // Remove event listeners
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Remove canvas
    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;

    // Cleanup WebGL resources
    setTimeout(() => {
      if (!this.gl) return;

      // Delete frame textures
      if (this.currentFrame?.texture) this.gl.deleteTexture(this.currentFrame.texture);
      if (this.delayedFrame?.texture) this.gl.deleteTexture(this.delayedFrame.texture);
      if (this.initialFrame?.texture) this.gl.deleteTexture(this.initialFrame.texture);

      this.availableTextures.forEach((t) => {
        if (this.gl!.isTexture(t)) this.gl!.deleteTexture(t);
      });
      this.usedTextures.forEach((t) => {
        if (this.gl!.isTexture(t)) this.gl!.deleteTexture(t);
      });

      if (this.program) {
        const shaders = this.gl.getAttachedShaders(this.program);
        shaders?.forEach((s) => {
          this.gl!.detachShader(this.program!, s);
          this.gl!.deleteShader(s);
        });
        this.gl.deleteProgram(this.program);
      }
      if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
      if (this.texCoordBuffer) this.gl.deleteBuffer(this.texCoordBuffer);

      const ext = this.gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();

      this.availableTextures = [];
      this.usedTextures.clear();
      this.currentFrame = null;
      this.delayedFrame = null;
      this.initialFrame = null;
      this.gl = null;
      this.program = null;
    }, 34);
  }
}

// ─── Public API ───

export class VideoDelayer {
  private instances = new Map<HTMLVideoElement, DelayedVideoInstance>();
  private observer: MutationObserver | null = null;
  private callbacks = new Map<HTMLVideoElement, number>();
  private active = false;
  private delayMs = DEFAULT_VIDEO_DELAY_MS;

  start(delayMs?: number) {
    if (delayMs != null) this.delayMs = delayMs;
    this.active = true;
    document.querySelectorAll("video").forEach((v) => this.waitForFrame(v as HTMLVideoElement));

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) this.waitForFrame(node);
          else if (node instanceof Element) {
            node.querySelectorAll("video").forEach((v) => this.waitForFrame(v as HTMLVideoElement));
          }
        });
      });
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  stop() {
    this.active = false;

    // Cancel pending frame callbacks
    this.callbacks.forEach((callbackId, video) => {
      try {
        video.cancelVideoFrameCallback(callbackId);
      } catch {}
    });
    this.callbacks.clear();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.instances.forEach((instance) => instance.stop());
    this.instances.clear();
  }

  private waitForFrame(video: HTMLVideoElement) {
    if (this.instances.has(video) || this.callbacks.has(video) || !this.active) return;

    const setup = () => {
      if (!("requestVideoFrameCallback" in video)) return;

      const callbackId = video.requestVideoFrameCallback(() => {
        this.callbacks.delete(video);
        if (video.paused || !this.active) return;
        this.delayVideo(video);
      });

      this.callbacks.set(video, callbackId);
    };

    setup();

    const onPlay = () => {
      if (!video.paused && !this.callbacks.has(video) && !this.instances.has(video)) {
        setup();
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("loadstart", onPlay);
  }

  private delayVideo(video: HTMLVideoElement) {
    if (this.instances.has(video) || !this.active) return;
    const instance = new DelayedVideoInstance(video, this.delayMs);
    this.instances.set(video, instance);
  }
}
