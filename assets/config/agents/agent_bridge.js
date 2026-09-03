/**
 * Google Antigravity Native SDK v2026.5
 * Lightweight Agent Bridge & Node Configuration Router
 */
const fs = require('fs');
const path = require('path');

function verifyAgentNode(nodeName, configPath) {
  try {
    const fullPath = path.resolve(__dirname, path.basename(configPath));
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `Config file not found at ${fullPath}` };
    }
    const rawData = fs.readFileSync(fullPath, 'utf8');
    const parsedData = JSON.parse(rawData);
    if (parsedData.agent_name !== nodeName) {
      return { success: false, error: `Name mismatch: expected ${nodeName}, got ${parsedData.agent_name}` };
    }
    return { success: true, agentName: parsedData.agent_name, role: parsedData.role };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function runDiagnostics() {
  console.log("=== AI WORKFORCE INTEGRATION DIAGNOSTICS ===");
  try {
    const connectionsPath = path.resolve(__dirname, 'agent_connections.json');
    if (!fs.existsSync(connectionsPath)) {
      console.error("ERROR: agent_connections.json manifest is missing.");
      process.exit(1);
    }
    const connections = JSON.parse(fs.readFileSync(connectionsPath, 'utf8'));
    console.log(`Workspace Reference: ${connections.workspace_reference}`);
    
    let allPass = true;
    Object.keys(connections.nodes).forEach(key => {
      const node = connections.nodes[key];
      const name = key.split('_').slice(2).join('_'); // extracts Sage, Flora, Orbit
      const verification = verifyAgentNode(name, node.config_path);
      
      if (verification.success) {
        console.log(`[PASS] ${key} is securely anchored.`);
        console.log(`       Role: ${verification.role}`);
      } else {
        console.error(`[FAIL] ${key} configuration check failed: ${verification.error}`);
        allPass = false;
      }
    });
    
    if (!allPass) {
      process.exit(1);
    }
  } catch (e) {
    console.error(`Fatal diagnostic exception: ${e.message}`);
    process.exit(1);
  }
}

// If run directly, execute diagnostics check
if (require.main === module) {
  runDiagnostics();
}

module.exports = {
  verifyAgentNode,
  runDiagnostics
};
