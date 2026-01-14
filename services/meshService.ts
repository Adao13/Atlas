
import { ATLASPeer, ATLASMessage, NodeStatus } from '../types';

/**
 * ATLAS Mesh Network Layer
 * Implements a virtual P2P discovery and Store-and-Forward simulation.
 */
class MeshNetwork {
  private peers: Map<string, ATLASPeer> = new Map();
  private messageStore: Map<string, ATLASMessage> = new Map();
  private subscribers: ((peers: ATLASPeer[]) => void)[] = [];

  constructor() {
    this.simulateDiscovery();
  }

  // Gossip Protocol: Broadcast message to neighbors
  public async broadcast(message: ATLASMessage) {
    console.log(`[MESH] Broadcasting message ${message.id} from ${message.senderId}`);
    this.messageStore.set(message.id, message);
  }

  public getPeers(): ATLASPeer[] {
    return Array.from(this.peers.values());
  }

  public subscribePeers(callback: (peers: ATLASPeer[]) => void) {
    this.subscribers.push(callback);
    callback(this.getPeers());
  }

  private simulateDiscovery() {
    const mockPeers: ATLASPeer[] = [
      { id: 'atls_node_1', alias: 'Delta-9', publicKey: 'pk_delta', lastSeen: Date.now(), status: NodeStatus.ONLINE, distance: 1.2 },
      { id: 'atls_node_2', alias: 'Shadow-Root', publicKey: 'pk_shadow', lastSeen: Date.now(), status: NodeStatus.RELAY, distance: 4.5 },
      { id: 'atls_node_3', alias: 'Nexus-One', publicKey: 'pk_nexus', lastSeen: Date.now(), status: NodeStatus.ONLINE, distance: 0.8 },
      { id: 'atls_node_4', alias: 'Ghost-P2P', publicKey: 'pk_ghost', lastSeen: Date.now(), status: NodeStatus.ONLINE, distance: 2.1 },
    ];

    mockPeers.forEach(p => this.peers.set(p.id, p));
    
    // Simulate nodes moving in and out of range
    setInterval(() => {
      this.peers.forEach(peer => {
        // Randomly fluctuate distance to simulate signal movement
        const drift = (Math.random() - 0.5) * 0.1;
        peer.distance = Math.max(0.1, Math.min(10, peer.distance + drift));
        peer.lastSeen = Date.now();
        
        // Occasionally nodes go offline
        if (Math.random() > 0.98) peer.status = NodeStatus.OFFLINE;
        else if (Math.random() > 0.95) peer.status = NodeStatus.ONLINE;
      });

      this.subscribers.forEach(cb => cb(this.getPeers()));
    }, 3000);
  }
}

export const MeshService = new MeshNetwork();
