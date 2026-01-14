
export enum NodeStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  RELAY = 'RELAY'
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface ATLASIdentity {
  id: string;
  publicKey: string;
  alias: string;
  settings: {
    sendReadReceipts: boolean;
    stealthMode: boolean;
  };
}

export enum ATLASMessageType {
  CHAT = 'CHAT',
  RECEIPT = 'RECEIPT',
  EMERGENCY = 'EMERGENCY',
  KNOWLEDGE_SHARE = 'KNOWLEDGE_SHARE'
}

export interface ATLASMessage {
  id: string;
  type: ATLASMessageType;
  senderId: string;
  receiverId: string;
  payload: string; 
  signature: string;
  timestamp: number;
  hopCount: number;
  referencedMessageId?: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: 'MEDICAL' | 'SURVIVAL' | 'CIVIC' | 'EDUCATION';
  content: string;
  version: number;
}

export interface ATLASPeer {
  id: string;
  publicKey: string;
  alias: string;
  lastSeen: number;
  status: NodeStatus;
  distance: number;
}

export interface DecryptedMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  isMe: boolean;
  isRead?: boolean;
  type: ATLASMessageType;
}
