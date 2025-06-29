#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as path from 'path';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type definitions for our links data
interface Link {
  title: string;
  url: string;
  description: string;
  category: string;
}

interface LinksData {
  [category: string]: {
    [section: string]: Link[];
  };
}

const server = new Server(
  {
    name: 'arcgis-calcite-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Load your links data
const linksPath = path.join(__dirname, 'resources', 'links.json');
const linksData: LinksData = JSON.parse(fs.readFileSync(linksPath, 'utf8'));

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [];
  
  for (const [category, items] of Object.entries(linksData)) {
    resources.push({
      uri: `links://${category}`,
      mimeType: 'application/json',
      name: `${category} links`,
      description: `All ${category} related links and resources`,
    });
  }
  
  return { resources };
});

// Read specific resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const category = uri.replace('links://', '');
  
  if (linksData[category]) {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'application/json',
          text: JSON.stringify(linksData[category], null, 2),
        },
      ],
    };
  } else {
    throw new Error(`Unknown resource: ${uri}`);
  }
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_links',
        description: 'Search for links by keyword or category',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for links',
            },
            category: {
              type: 'string',
              description: 'Optional category filter (arcgis, calcite)',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'search_links') {
    const { query, category } = args as { query: string; category?: string };
    const results: (Link & { category: string; section: string })[] = [];
    
    const searchIn = category ? { [category]: linksData[category] } : linksData;
    
    for (const [cat, sections] of Object.entries(searchIn)) {
      if (sections) {
        for (const [section, links] of Object.entries(sections)) {
          if (Array.isArray(links)) {
            for (const link of links) {
              if (
                link.title.toLowerCase().includes(query.toLowerCase()) ||
                link.description.toLowerCase().includes(query.toLowerCase())
              ) {
                results.push({ ...link, category: cat, section });
              }
            }
          }
        }
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
  
  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  try {
    console.error('Starting MCP server...');
    const transport = new StdioServerTransport();
    console.error('Transport created, attempting connection...');
    
    await server.connect(transport);
    console.error('ArcGIS Calcite MCP server running on stdio');
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});

