/**
 * A WebGLRenderer that answers questions but draws nothing.
 *
 * jsdom has no GL context, so the app's renderer has to be stubbed — but the
 * viewport asks it things as well as telling it things: the pixel ratio and the
 * drawing buffer size, which is how a fat line knows how wide to be (§17). A
 * stub that only accepts orders passes every test until the day the code asks
 * one question, and then fails every test at once.
 */
export class StubRenderer {
  static renders = 0;

  constructor() {
    this.domElement = document.createElement("canvas");
    this.pixelRatio = 1;
  }

  setPixelRatio(r) { this.pixelRatio = r; }
  getPixelRatio() { return this.pixelRatio; }
  setClearColor() {}
  setSize(w, h) { this.domElement.width = w; this.domElement.height = h; }

  /** Device pixels, the way the real one reports them. */
  getDrawingBufferSize(target) {
    const w = this.domElement.width * this.pixelRatio;
    const h = this.domElement.height * this.pixelRatio;
    return target?.set ? target.set(w, h) : { width: w, height: h };
  }

  render() { StubRenderer.renders++; }
  dispose() {}
}
