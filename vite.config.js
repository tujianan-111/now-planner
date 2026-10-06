import { defineConfig } from "vite";

const repository = process.env.GITHUB_REPOSITORY;
const repositoryName = repository ? repository.split("/")[1] : "";
const base = process.env.VITE_BASE_PATH || (repositoryName ? `/${repositoryName}/` : "./");

export default defineConfig({
  base,
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022"
  }
});
