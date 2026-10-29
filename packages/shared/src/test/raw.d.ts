// Vite and Vitest load "file?raw" imports as the file's text.
declare module '*?raw' {
  const content: string;
  export default content;
}
