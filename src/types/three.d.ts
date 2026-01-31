declare module "three" {
  export const AdditiveBlending: any;
  export const DoubleSide: any;

  export class Camera {
    position: { z: number };
  }

  export class OrthographicCamera extends Camera {
    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number);
  }

  export class Scene {
    add: (...args: any[]) => void;
    remove: (...args: any[]) => void;
  }

  export class Color {
    constructor(color?: number | string);
  }

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor(options?: any);
    setPixelRatio: (value: number) => void;
    setClearColor: (color: number | Color, alpha?: number) => void;
    setSize: (width: number, height: number, updateStyle?: boolean) => void;
    render: (scene: any, camera: any) => void;
    dispose: () => void;
    forceContextLoss: () => void;
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

  export class BufferGeometry {
    setAttribute: (name: string, attribute: any) => void;
    dispose: () => void;
  }

  export class BufferAttribute {
    constructor(array: Float32Array | Uint16Array, itemSize: number);
  }

  export class Material {
    dispose: () => void;
  }

  export class ShaderMaterial extends Material {
    constructor(params?: any);
  }

  export class RawShaderMaterial extends Material {
    constructor(params?: any);
  }

  export class Mesh {
    geometry: any;
    material: any;
    constructor(geometry?: any, material?: any);
  }
}
