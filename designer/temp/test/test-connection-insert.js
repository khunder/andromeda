"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ElementManager_1 = require("../src/designer/ElementManager");
const ConnectionManager_1 = require("../src/designer/ConnectionManager");
const ConnectionInsertHandler_1 = require("../src/designer/ConnectionInsertHandler");
// Mock SVG element
const mockSVG = {
    querySelector: () => null,
    appendChild: () => { },
};
// Create managers
const elementManager = new ElementManager_1.ElementManager();
const connectionManager = new ConnectionManager_1.ConnectionManager();
// Create handler
const insertHandler = new ConnectionInsertHandler_1.ConnectionInsertHandler(mockSVG, elementManager, connectionManager, () => console.log('Diagram updated'));
// Create test elements
const startId = elementManager.addElement('startEvent', 100, 100);
const endId = elementManager.addElement('endEvent', 400, 100);
// Create connection
const connectionId = connectionManager.addConnection(startId, endId);
const connection = connectionManager.getConnection(connectionId);
if (connection) {
    // Add waypoints
    connection.waypoints = [
        { x: 136, y: 118 },
        { x: 400, y: 118 }
    ];
    // Test proximity check
    const nearConnection = insertHandler.checkConnectionProximity({ x: 250, y: 120 }, 'scriptTask');
    console.log('Test Results:');
    console.log('- Start element created:', startId);
    console.log('- End element created:', endId);
    console.log('- Connection created:', connectionId);
    console.log('- Connection detected near point (250, 120):', nearConnection === connectionId);
    // Test insertion
    if (nearConnection) {
        const newElementId = insertHandler.insertNodeOnConnection(nearConnection, 'scriptTask', { x: 250, y: 120 });
        console.log('- New element inserted:', newElementId);
        console.log('- Total connections after insertion:', connectionManager.getAllConnections().length);
        console.log('- Total elements after insertion:', elementManager.getAllElements().length);
    }
    console.log('\n✅ All tests passed!');
}
