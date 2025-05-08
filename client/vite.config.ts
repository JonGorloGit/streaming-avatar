import { defineConfig } from 'vite';

export default defineConfig({
  plugins:[],
  server:{
    proxy:{
      '/api':'http://localhost:3000'
    }
  }
});

