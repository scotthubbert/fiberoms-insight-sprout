# FiberOMS ArcGIS MCP Server

This MCP (Model Context Protocol) server provides tools for validating and understanding ArcGIS Maps SDK usage in the FiberOMS Insight PWA project.

## Features

The server provides the following tools:

1. **get_arcgis_class_info** - Get detailed information about ArcGIS SDK classes (MapView, FeatureLayer, etc.)
2. **validate_arcgis_code** - Validate ArcGIS code usage in project files
3. **list_arcgis_classes** - List all available ArcGIS SDK classes
4. **get_project_arcgis_usage** - Analyze how ArcGIS is used across the project
5. **check_arcgis_version** - Check installed ArcGIS SDK versions

## Installation

```bash
cd mcp-server
npm install
```

## Usage in Warp

The server is automatically configured in `.warp/mcp.json`. Warp will load it when you use AI features in this project directory.

### Example Queries

Once configured, you can ask Warp:
- "What properties does MapView have?"
- "Validate the ArcGIS code in src/main.js"
- "How is FeatureLayer used in this project?"
- "What ArcGIS SDK version are we using?"

## Manual Testing

Test the server directly:

```bash
cd mcp-server
npm start
```

Then send MCP protocol messages via stdin.

## Configuration for Other MCP Clients

For Claude Desktop or other MCP clients, add to their config:

```json
{
  "mcpServers": {
    "fiberoms-arcgis": {
      "command": "node",
      "args": ["/absolute/path/to/fiberoms-insight-pwa/mcp-server/index.js"]
    }
  }
}
```

## Extending the Server

To add more ArcGIS API information, edit the `ARCGIS_API_REFERENCE` object in `index.js`.
