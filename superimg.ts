import React from "npm:react";
import satori, { Font } from "npm:satori";
import swc from "npm:@swc/core";
import { walk, ensureDir } from "jsr:@std/fs";
import { join, dirname, relative } from "jsr:@std/path";

// Types
type ImageConfig = {
  output: {
    formats: string[];
    sizes: { width: number; height: number; suffix: string }[];
  };
};

type LoaderFunction = () => Promise<Record<string, any>>;

type ImageComponent = React.FC<any> & {
  loader?: LoaderFunction;
  config?: ImageConfig;
  fonts?: Font[];
};

// Global configuration
const globalConfig: ImageConfig = {
  output: {
    formats: ["svg"],
    sizes: [{ width: 1280, height: 720, suffix: "hd" }],
  },
};

// Context for image data
export const ImageDataContext = React.createContext<Record<string, any>>({});

// Custom hooks
export function useImageData() {
  return React.useContext(ImageDataContext);
}

// Helper function to merge configurations
function mergeConfigs(
  globalConfig: ImageConfig,
  localConfig?: ImageConfig,
): ImageConfig {
  if (!localConfig) return globalConfig;
  return {
    output: {
      formats: localConfig.output?.formats || globalConfig.output.formats,
      sizes: localConfig.output?.sizes || globalConfig.output.sizes,
    },
  };
}

// Function to load fonts
async function loadFonts(fonts: Font[]) {
  console.log("Loading fonts:", fonts);
  return Promise.all(
    fonts.map(async (font) => {
      try {
        const data = await Deno.readFile(font.data);
        console.log(`Font loaded successfully: ${font.name}`);
        return {
          name: font.name,
          data,
          weight: font.weight,
          style: font.style,
        };
      } catch (error) {
        console.error(`Error loading font ${font.name}:`, error);
        throw error;
      }
    }),
  );
}

// Helper function to transform import paths
function transformImportPaths(code: string, componentDir: string): string {
  return code.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, path) => {
    const absolutePath = join(componentDir, path);
    const newPath = relative(Deno.cwd(), absolutePath);
    return `from "${newPath}"`;
  });
}

// Function to transpile code using SWC
async function transpileWithSWC(code: string): Promise<string> {
  console.log("Transpiling code with SWC");
  try {
    const result = await swc.transform(code, {
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: true,
        },
        target: "es2020",
      },
      module: {
        type: "es6",
      },
    });
    console.log("Code transpiled successfully");
    return result.code;
  } catch (error) {
    console.error("Transpilation error:", error);
    throw error;
  }
}

// Function to dynamically import transpiled code
async function dynamicImport(code: string, componentDir: string) {
  console.log("Dynamically importing code");
  let url: string | undefined;
  try {
    const transpiled = await transpileWithSWC(code);
    console.log("Transpiled code:", transpiled);

    const transformedCode = transformImportPaths(transpiled, componentDir);
    console.log("Transformed code:", transformedCode);

    const blob = new Blob([transformedCode], {
      type: "application/javascript",
    });
    url = URL.createObjectURL(blob);

    const module = await import(url);
    console.log("Module imported successfully");
    return {
      ...module,
      __componentDir: componentDir,
    };
  } catch (error) {
    console.error("Error in dynamic import process:", error);
    throw error;
  } finally {
    if (url) {
      URL.revokeObjectURL(url);
      console.log("URL revoked");
    }
  }
}

// Helper function to get all TypeScript/TSX files in a directory
async function getComponentFiles(dir: string): Promise<string[]> {
  console.log(`Searching for component files in ${dir}`);
  const files: string[] = [];
  for await (const entry of walk(dir, { exts: [".ts", ".tsx"] })) {
    if (entry.isFile) {
      files.push(entry.path);
    }
  }
  console.log(`Found ${files.length} component files`);
  return files;
}
// Main function to generate an image
async function generateImage(componentPath: string, outputPath: string) {
  console.log(`Generating image for component: ${componentPath}`);
  console.log(`Output path: ${outputPath}`);

  const componentDir = dirname(componentPath);
  console.log(`Component directory: ${componentDir}`);

  let componentCode: string;
  try {
    componentCode = await Deno.readTextFile(componentPath);
    console.log("Component code read successfully");
  } catch (error) {
    console.error(`Error reading component file ${componentPath}:`, error);
    throw error;
  }

  let Component, fontDefinitions, config, loaderData;
  try {
    const module = await dynamicImport(componentCode, componentDir);
    Component = module.default;
    fontDefinitions = module.fonts;
    config = mergeConfigs(globalConfig, module.config);

    if (module.loader) {
      const originalCwd = Deno.cwd();
      try {
        Deno.chdir(componentDir);
        loaderData = await module.loader();
      } finally {
        Deno.chdir(originalCwd);
      }
    } else {
      loaderData = {};
    }

    console.log("Component and configurations loaded successfully");
  } catch (error) {
    console.error("Error importing or processing component:", error);
    throw error;
  }

  let fonts: Font[];
  try {
    fonts = fontDefinitions ? await loadFonts(fontDefinitions) : [];
  } catch (error) {
    console.warn("Error loading user-defined fonts:", error.message);
    fonts = [];
  }

  if (fonts.length === 0) {
    console.warn("No valid fonts defined or loaded. Using a fallback font.");
    try {
      const fallbackFontPath = "./fonts/Roboto-Regular.ttf";
      const fallbackFontData = await Deno.readFile(fallbackFontPath);
      fonts.push({
        name: "Fallback",
        data: fallbackFontData,
        weight: 400,
        style: "normal",
      });
      console.log("Fallback font loaded successfully");
    } catch (fallbackError) {
      console.error("Failed to load fallback font:", fallbackError.message);
      throw new Error("No fonts available for rendering.");
    }
  }

  for (const { width, height, suffix } of config.output.sizes) {
    for (const format of config.output.formats) {
      console.log(`Rendering image: ${width}x${height}, format: ${format}`);
      const jsx = React.createElement(
        ImageDataContext.Provider,
        { value: loaderData },
        React.createElement(Component),
      );

      try {
        const svg = await satori(jsx, {
          width,
          height,
          fonts: fonts,
        });

        const filePath = `${outputPath}_${suffix}.${format}`;
        await ensureDir(Deno.realPathSync("./output"));
        await Deno.writeTextFile(filePath, svg);
        console.log(`Image saved successfully: ${filePath}`);
      } catch (error) {
        console.error(`Error generating or saving image:`, error);
        throw error;
      }
    }
  }
}

// New handleBuild function
async function handleBuild() {
  const imagesDir = "./images";

  try {
    await ensureDir(imagesDir);
    const componentFiles = await getComponentFiles(imagesDir);

    for (const componentFile of componentFiles) {
      const outputPath = join(
        "./output",
        componentFile.replace(imagesDir, "").replace(/\.[jt]sx?$/, ""),
      );
      await ensureDir(outputPath.split("/").slice(0, -1).join("/"));

      console.log(`Generating image for ${componentFile}...`);
      try {
        await generateImage(componentFile, outputPath);
        console.log(`Image generated successfully for ${componentFile}`);
      } catch (error) {
        console.error(`Error generating image for ${componentFile}:`, error);
      }
    }

    console.log("All images processed.");
  } catch (error) {
    console.error("Error during build process:", error);
  }
}

// Main CLI handler
async function main() {
  const args = Deno.args;
  const command = args[0];

  switch (command) {
    case "build":
      await handleBuild();
      break;
    default:
      console.log("Unknown command. Available command: build");
  }
}

// Run the CLI
if (import.meta.main) {
  main();
}

// Exports for use as a module
export { generateImage, mergeConfigs, transpileWithSWC, transformImportPaths };
