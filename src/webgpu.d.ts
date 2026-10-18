interface GPUBlendComponent {
  srcFactor: string;
  dstFactor: string;
  operation: string;
}

interface GPUBlendState {
  color: GPUBlendComponent;
  alpha: GPUBlendComponent;
}

interface GPUCompilationMessage {
  type: string;
  message: string;
}

interface GPUCompilationInfo {
  messages: GPUCompilationMessage[];
}

interface GPUShaderModule {
  getCompilationInfo(): Promise<GPUCompilationInfo>;
}

interface GPUBuffer {
  destroy(): void;
}

interface GPUTextureView {}

interface GPUTexture {
  createView(): GPUTextureView;
  destroy(): void;
}

interface GPUSampler {}

interface GPUBindGroup {}

interface GPUBindGroupLayout {}

interface GPUPipelineLayout {}

interface GPURenderPipeline {}

interface GPUCommandBuffer {}

interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, group: GPUBindGroup, dynamicOffsets?: number[]): void;
  draw(vertexCount: number): void;
  end(): void;
}

interface GPUCommandEncoder {
  beginRenderPass(descriptor: unknown): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPUQueue {
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number,
  ): void;
  writeTexture(destination: unknown, data: Uint8Array, dataLayout: unknown, size: unknown): void;
  copyExternalImageToTexture(source: unknown, destination: unknown, copySize: number[]): void;
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

interface GPUDevice {
  createShaderModule(descriptor: { label?: string; code: string }): GPUShaderModule;
  createBindGroupLayout(descriptor: unknown): GPUBindGroupLayout;
  createPipelineLayout(descriptor: { bindGroupLayouts: GPUBindGroupLayout[] }): GPUPipelineLayout;
  createRenderPipeline(descriptor: unknown): GPURenderPipeline;
  createBuffer(descriptor: unknown): GPUBuffer;
  createBindGroup(descriptor: unknown): GPUBindGroup;
  createSampler(descriptor: unknown): GPUSampler;
  createTexture(descriptor: unknown): GPUTexture;
  createCommandEncoder(): GPUCommandEncoder;
  destroy(): void;
  queue: GPUQueue;
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}

type GPUTextureFormat = string;

interface GPU {
  requestAdapter(options?: { powerPreference?: string }): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

interface GPUCanvasContext {
  configure(configuration: unknown): void;
  getCurrentTexture(): GPUTexture;
}

interface Navigator {
  gpu?: GPU;
}

declare const GPUShaderStage: { VERTEX: number; FRAGMENT: number };
declare const GPUBufferUsage: { UNIFORM: number; COPY_DST: number };
declare const GPUTextureUsage: {
  TEXTURE_BINDING: number;
  COPY_DST: number;
  RENDER_ATTACHMENT: number;
};
