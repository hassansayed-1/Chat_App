'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { generateRSAKeys, generateKyberKeys } from '@/lib/crypto';

// Singleton socket to survive React StrictMode double-mounts in development
let _socketSingleton: Socket | null = null;
const getOrCreateSocket = (): Socket => {
  if (!_socketSingleton || _socketSingleton.disconnected) {
    _socketSingleton = io();
  }
  return _socketSingleton;
};

type Message = {
  id: string;
  senderId: string;
  persistentSenderId: string;
  senderName: string;
  roomId: string;
  timestamp: number;
  // Educational Mode Fields
  algorithm?: string;
  key?: string; // Sent in plaintext for educational mode
  encryptedText: string;
  // Secure Mode Fields
  encryptedSessionKeys?: Record<string, string>; // { userId: encryptedSessionKey }
  pqcSessionKeys?: Record<string, { ct: string, encryptedKey: string }>; // { userId: { ct, encryptedKey } }
  mode?: string;
  cryptoMode?: string; // CBC, CTR, ...
};

type DecryptedMessage = Message & {
  decryptedText: string;
};

type ChatMode = 'educational' | 'secure' | 'quantum';

interface ChatContextType {
  socket: Socket | null;
  isConnected: boolean;
  isJoined: boolean;
  joinRoom: (name: string, room: string) => void;
  leaveRoom: () => void;
  roomId: string;
  setRoomId: (id: string) => void;
  userId: string;
  userName: string;
  setUserName: (name: string) => void;
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  messages: DecryptedMessage[];
  addMessage: (msg: DecryptedMessage) => void;
  publicKey: string;
  privateKey: string;
  roomPublicKeys: Record<string, string>; // { userId: publicKey }
  pqcPublicKey: string;
  pqcPrivateKey: string;
  roomPqcPublicKeys: Record<string, string>; // { userId: pqcPublicKey }
  persistentId: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chat_user_name') || '';
    }
    return '';
  });
  const [mode, setMode] = useState<ChatMode>('educational');
  const [persistentId, setPersistentId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('chat_persistent_id');
      if (!id) {
        id = 'user_' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('chat_persistent_id', id);
      }
      return id;
    }
    return '';
  });
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  
  // Save user name when it changes
  useEffect(() => {
    if (userName) {
      localStorage.setItem('chat_user_name', userName);
    }
  }, [userName]);

  // Load messages from localStorage when roomId changes
  useEffect(() => {
    if (typeof window !== 'undefined' && roomId) {
      const stored = localStorage.getItem(`chat_messages_${roomId}`);
      if (stored) {
        try {
          setMessages(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse stored messages', e);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    }
  }, [roomId]);

  // Save messages to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && roomId && messages.length > 0) {
      localStorage.setItem(`chat_messages_${roomId}`, JSON.stringify(messages));
    }
  }, [messages, roomId]);
  
  // RSA Keys
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [roomPublicKeys, setRoomPublicKeys] = useState<Record<string, string>>({});

  // Kyber Keys
  const [pqcPublicKey, setPqcPublicKey] = useState('');
  const [pqcPrivateKey, setPqcPrivateKey] = useState('');
  const [roomPqcPublicKeys, setRoomPqcPublicKeys] = useState<Record<string, string>>({});

  // Initialize Socket and Keys
  useEffect(() => {
    // Generate or load RSA Keys
    const loadKeys = async () => {
      const storedPriv = localStorage.getItem('crypto_lab_privKey');
      const storedPub = localStorage.getItem('crypto_lab_pubKey');
      
      if (storedPriv && storedPub) {
        setPrivateKey(storedPriv);
        setPublicKey(storedPub);
      } else {
        console.log('Generating new RSA keys...');
        const keys = await generateRSAKeys();
        setPrivateKey(keys.privateKey);
        setPublicKey(keys.publicKey);
        localStorage.setItem('crypto_lab_privKey', keys.privateKey);
        localStorage.setItem('crypto_lab_pubKey', keys.publicKey);
      }

      // Kyber
      const storedPqcPriv = localStorage.getItem('crypto_lab_pqcPrivKey');
      const storedPqcPub = localStorage.getItem('crypto_lab_pqcPubKey');
      if (storedPqcPriv && storedPqcPub) {
        setPqcPrivateKey(storedPqcPriv);
        setPqcPublicKey(storedPqcPub);
      } else {
        console.log('Generating new Kyber keys...');
        const keys = generateKyberKeys();
        setPqcPrivateKey(keys.privateKey);
        setPqcPublicKey(keys.publicKey);
        localStorage.setItem('crypto_lab_pqcPrivKey', keys.privateKey);
        localStorage.setItem('crypto_lab_pqcPubKey', keys.publicKey);
      }
    };
    loadKeys();

    // Connect Socket (singleton to avoid double-connect in React StrictMode)
    const newSocket = getOrCreateSocket();
    setSocket(newSocket);

    if (newSocket.connected) {
      setIsConnected(true);
      setUserId(newSocket.id || '');
    }

    const onConnect = () => {
      setIsConnected(true);
      setUserId(newSocket.id || '');
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);

    // Handle receiving public keys
    newSocket.on('receive-public-key', (data: { senderId: string, publicKey: string, pqcPublicKey?: string }) => {
      if (data.publicKey) {
        setRoomPublicKeys(prev => ({
          ...prev,
          [data.senderId]: data.publicKey
        }));
      }
      if (data.pqcPublicKey) {
        setRoomPqcPublicKeys(prev => ({
          ...prev,
          [data.senderId]: data.pqcPublicKey!
        }));
      }
    });

    newSocket.on('user-left', (leavingId: string) => {
      setRoomPublicKeys(prev => {
        const next = { ...prev };
        delete next[leavingId];
        return next;
      });
      setRoomPqcPublicKeys(prev => {
        const next = { ...prev };
        delete next[leavingId];
        return next;
      });
    });

    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('receive-public-key');
      // Do NOT call newSocket.disconnect() — we keep the singleton alive
    };
  }, []); // Only run once on mount

  // Share public key when joining a room
  useEffect(() => {
    if (socket && isConnected && publicKey && pqcPublicKey && isJoined && roomId) {
      socket.emit('share-public-key', { roomId, publicKey, pqcPublicKey });
    }
  }, [socket, isConnected, publicKey, pqcPublicKey, roomId, isJoined]);

  // Listen for new users joining to share our public key with them
  useEffect(() => {
    if (!socket || !publicKey || !roomId || !isJoined) return;
    
    const handleUserJoined = () => {
      // Small delay to ensure the new user has fully joined and is listening
      setTimeout(() => {
        socket.emit('share-public-key', { roomId, publicKey, pqcPublicKey });
      }, 500);
    };

    socket.on('user-joined', handleUserJoined);
    return () => {
      socket.off('user-joined', handleUserJoined);
    };
  }, [socket, publicKey, roomId, isJoined]);

  // Ensure we join the room when socket connects (or reconnects) and we are marked as joined
  useEffect(() => {
    if (socket && isConnected && isJoined && roomId) {
      socket.emit('join-room', roomId);
    }
  }, [socket, isConnected, isJoined, roomId]);

  const joinRoom = (name: string, room: string) => {
    setUserName(name);
    setRoomId(room);
    setIsJoined(true);
    // Immediately emit join-room if socket is already connected
    if (socket && socket.connected) {
      socket.emit('join-room', room);
    }
  };

  const leaveRoom = () => {
    if (socket && roomId) {
      socket.emit('leave-room', roomId);
    }
    // Clear messages from localStorage so next room entry starts fresh
    if (typeof window !== 'undefined' && roomId) {
      localStorage.removeItem(`chat_messages_${roomId}`);
    }
    setIsJoined(false);
    setRoomId('');
    setMessages([]);
    setRoomPublicKeys({});
    setRoomPqcPublicKeys({});
  };

  const addMessage = (msg: DecryptedMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, msg];
      // Limit to last 100 messages to avoid localstorage bloat
      return newMessages.slice(-100);
    });
  };

  return (
    <ChatContext.Provider
      value={{
        socket,
        isConnected,
        isJoined,
        joinRoom,
        leaveRoom,
        roomId,
        setRoomId,
        userId,
        userName,
        setUserName,
        mode,
        setMode,
        messages,
        addMessage,
        publicKey,
        privateKey,
        roomPublicKeys,
        pqcPublicKey,
        pqcPrivateKey,
        roomPqcPublicKeys,
        persistentId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );

};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
