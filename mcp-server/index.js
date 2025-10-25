#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");

// ArcGIS Maps SDK API reference data
const ARCGIS_API_REFERENCE = {
  classes: {
    MapView: {
      description: "2D view for displaying Map with layers in 2D",
      properties: ["center", "zoom", "scale", "rotation", "extent", "padding"],
      methods: ["goTo", "hitTest", "toMap", "toScreen", "when"],
      events: ["click", "pointer-move", "drag", "mouse-wheel"],
    },
    SceneView: {
      description: "3D view for displaying Map or WebScene",
      properties: ["center", "camera", "zoom", "viewingMode", "environment"],
      methods: ["goTo", "hitTest", "toMap", "toScreen", "when"],
      events: ["click", "pointer-move", "drag", "mouse-wheel"],
    },
    Map: {
      description: "Container for layers with no coordinate system",
      properties: ["layers", "basemap", "ground"],
      methods: ["add", "addMany", "remove", "removeMany", "findLayerById"],
    },
    WebMap: {
      description: "Web map with coordinate system and operational layers",
      properties: ["layers", "basemap", "portalItem", "initialViewProperties"],
      methods: ["load", "save", "updateFrom"],
    },
    FeatureLayer: {
      description: "Layer to visualize and query features",
      properties: ["url", "fields", "objectIdField", "geometryType", "renderer", "popupTemplate"],
      methods: ["queryFeatures", "queryObjectIds", "applyEdits", "refresh"],
    },
    GraphicsLayer: {
      description: "Layer for client-side graphics",
      properties: ["graphics", "elevationInfo"],
      methods: ["add", "addMany", "remove", "removeAll"],
    },
    Graphic: {
      description: "Display point, line, or polygon graphics",
      properties: ["geometry", "symbol", "attributes", "popupTemplate"],
    },
  },
  modules: {
    "esri/config": {
      description: "Global esri configuration",
      properties: ["apiKey", "assetsPath", "portalUrl", "request"],
    },
    "esri/geometry": {
      types: ["Point", "Polyline", "Polygon", "Extent", "Multipoint"],
    },
    "esri/layers": {
      types: ["FeatureLayer", "GraphicsLayer", "TileLayer", "MapImageLayer", "GeoJSONLayer"],
    },
  },
  version: "4.32.0",
};

// Create the MCP server
const server = new Server(
  {
    name: "fiberoms-arcgis-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool: Get ArcGIS API info
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_arcgis_class_info",
        description: "Get information about an ArcGIS Maps SDK class (e.g., MapView, FeatureLayer, Graphic)",
        inputSchema: {
          type: "object",
          properties: {
            className: {
              type: "string",
              description: "The name of the ArcGIS class (e.g., MapView, FeatureLayer)",
            },
          },
          required: ["className"],
        },
      },
      {
        name: "validate_arcgis_code",
        description: "Validate ArcGIS Maps SDK code usage in the project",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Relative path to the file to validate",
            },
          },
          required: ["filePath"],
        },
      },
      {
        name: "list_arcgis_classes",
        description: "List all available ArcGIS Maps SDK classes",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_project_arcgis_usage",
        description: "Analyze how ArcGIS Maps SDK is used in the project",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "check_arcgis_version",
        description: "Check the installed ArcGIS Maps SDK version",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Tool implementation
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_arcgis_class_info": {
        const { className } = args;
        const classInfo = ARCGIS_API_REFERENCE.classes[className];

        if (!classInfo) {
          return {
            content: [
              {
                type: "text",
                text: `Class "${className}" not found. Use list_arcgis_classes to see available classes.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  className,
                  ...classInfo,
                  sdkVersion: ARCGIS_API_REFERENCE.version,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_arcgis_classes": {
        const classes = Object.keys(ARCGIS_API_REFERENCE.classes);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  classes,
                  sdkVersion: ARCGIS_API_REFERENCE.version,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "validate_arcgis_code": {
        const { filePath } = args;
        const fullPath = path.join(PROJECT_ROOT, filePath);

        try {
          const content = await fs.readFile(fullPath, "utf-8");
          const issues = [];

          // Check for common mistakes
          if (content.includes("new MapView") && !content.includes('container:')) {
            issues.push("MapView constructor requires a 'container' property");
          }

          if (content.includes("new Map") && content.includes("center")) {
            issues.push("Map class doesn't have a 'center' property. Use MapView or SceneView instead.");
          }

          // Check for missing imports
          const usedClasses = Object.keys(ARCGIS_API_REFERENCE.classes).filter(
            (className) => content.includes(className)
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    file: filePath,
                    usedClasses,
                    issues: issues.length > 0 ? issues : ["No issues found"],
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error reading file: ${error.message}`,
              },
            ],
          };
        }
      }

      case "get_project_arcgis_usage": {
        const srcPath = path.join(PROJECT_ROOT, "src");
        const files = await fs.readdir(srcPath);
        const jsFiles = files.filter((f) => f.endsWith(".js"));

        const usage = {};

        for (const file of jsFiles) {
          const content = await fs.readFile(path.join(srcPath, file), "utf-8");
          const usedClasses = Object.keys(ARCGIS_API_REFERENCE.classes).filter(
            (className) => content.includes(className)
          );

          if (usedClasses.length > 0) {
            usage[file] = usedClasses;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  projectUsage: usage,
                  sdkVersion: ARCGIS_API_REFERENCE.version,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "check_arcgis_version": {
        const packageJsonPath = path.join(PROJECT_ROOT, "package.json");
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  installedVersion: packageJson.dependencies["@arcgis/core"],
                  referenceVersion: ARCGIS_API_REFERENCE.version,
                  mapComponents: packageJson.dependencies["@arcgis/map-components"],
                  calciteComponents: packageJson.dependencies["@esri/calcite-components"],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FiberOMS ArcGIS MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
