declare module "three" {
  export const AdditiveBlending: any;

  export class Camera {
    position: { z: number };
  }

  export class Scene {
    add: (...args: any[]) => void;
  }

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor(options?: any);
    setPixelRatio: (value: number) => void;
    setClearColor: (color: number, alpha?: number) => void;
    setSize: (width: number, height: number) => void;
    render: (scene: any, camera: any) => void;
    dispose: () => void;
  }

  export class Vector2 {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
  }

  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
  }

  export class PlaneGeometry {
    constructor(width?: number, height?: number);
    dispose: () => void;
  }

  export class ShaderMaterial {
    constructor(params?: any);
    dispose: () => void;
  }

  export class Mesh {
    constructor(geometry?: any, material?: any);
  }
}
