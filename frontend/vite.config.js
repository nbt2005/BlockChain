import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {localMetadata} from './server/local-metadata.js';

export default defineConfig({
  plugins:[localMetadata({directory:fileURLToPath(new URL('./public/metadata/generated/',import.meta.url))})],
  server:{host:'127.0.0.1',port:5173,strictPort:true,watch:{ignored:['**/public/metadata/generated/**']}}
});
