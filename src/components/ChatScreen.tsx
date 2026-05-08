'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/context/ChatContext';
import { useRouter } from 'next/navigation';
import { Shield, ShieldAlert, Send, KeyRound, Lock, Network, ChevronDown, Check, Zap, LogOut } from 'lucide-react';
import { 
  caesarEncrypt, caesarDecrypt, 
  substitutionEncrypt, substitutionDecrypt, generateSubstitutionKey,
  desEncrypt, desDecrypt, generateDESKey,
  tripleDesEncrypt, tripleDesDecrypt, generate3DESKey,
  aesEncrypt, aesDecrypt, aesGcmEncrypt, aesGcmDecrypt, generateAESKey,
  rc4Encrypt, rc4Decrypt, generateRC4Key,
  rsaEncrypt, rsaDecrypt, generateRSAKeys,
  kyberEncapsulate, kyberDecapsulate
} from '@/lib/crypto';

export default function ChatScreen() {
  const router = useRouter();
  const { 
    socket, isConnected, userId, userName, mode, setMode, 
    messages, addMessage, publicKey, privateKey, roomPublicKeys, roomId,
    pqcPublicKey, pqcPrivateKey, roomPqcPublicKeys, leaveRoom
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [algorithm, setAlgorithm] = useState('AES');
  const [manualKey, setManualKey] = useState('secret_key_123');
  const [manualPrivateKey, setManualPrivateKey] = useState('');
  const [cryptoMode, setCryptoMode] = useState('CBC');
  const [showControls, setShowControls] = useState(false);
  const [isAlgoOpen, setIsAlgoOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorToast]);

  useEffect(() => {
    if (!socket) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleReceiveMessage = (data: any) => {
      let decryptedText = '';
      
      if (data.mode === 'educational') {
        const { encryptedText, algorithm, key, cryptoMode: msgCryptoMode } = data;
        try {
          if (algorithm === 'Caesar') decryptedText = caesarDecrypt(encryptedText, key);
          else if (algorithm === 'Substitution') decryptedText = substitutionDecrypt(encryptedText, key);
          else if (algorithm === 'DES') decryptedText = desDecrypt(encryptedText, key, msgCryptoMode);
          else if (algorithm === 'TripleDES') decryptedText = tripleDesDecrypt(encryptedText, key, msgCryptoMode);
          else if (algorithm === 'AES') {
            if (msgCryptoMode === 'GCM') {
              decryptedText = aesGcmDecrypt(encryptedText, key, data.iv, data.tag);
            } else {
              decryptedText = aesDecrypt(encryptedText, key, msgCryptoMode);
            }
          }
          else if (algorithm === 'RC4') decryptedText = rc4Decrypt(encryptedText, key);
        } catch (e) {
          decryptedText = '[Decryption Failed]';
        }
      } else if (data.mode === 'secure') {
        const { encryptedText, encryptedSessionKeys } = data;
        try {
          const myEncryptedSessionKey = socket?.id ? encryptedSessionKeys?.[socket.id] : undefined;
          if (myEncryptedSessionKey) {
            // 1. Decrypt session key using our private RSA key
            const sessionKey = rsaDecrypt(myEncryptedSessionKey, privateKey);
            if (sessionKey) {
              // 2. Decrypt message using the session key via AES
              decryptedText = aesDecrypt(encryptedText, sessionKey);
            } else {
              decryptedText = '[RSA Decryption Failed - Invalid Key]';
            }
          } else {
            decryptedText = '[No Session Key Provided for You]';
          }
        } catch (e) {
          decryptedText = '[Decryption Failed]';
        }
      } else if (data.mode === 'quantum') {
        const { encryptedText, pqcSessionKeys } = data;
        try {
          const myPqcData = socket?.id ? pqcSessionKeys?.[socket.id] : undefined;
          if (myPqcData) {
            // 1. Decapsulate to get shared secret
            const sharedSecret = kyberDecapsulate(myPqcData.ct, pqcPrivateKey);
            if (sharedSecret) {
              // 2. Decrypt the session key using the shared secret
              const sessionKey = aesDecrypt(myPqcData.encryptedKey, sharedSecret);
              if (sessionKey) {
                // 3. Decrypt message using the session key
                decryptedText = aesDecrypt(encryptedText, sessionKey);
              } else {
                decryptedText = '[Quantum Key Decryption Failed]';
              }
            } else {
              decryptedText = '[Kyber Decapsulation Failed]';
            }
          } else {
            decryptedText = '[No PQC Session Key for You]';
          }
        } catch (e) {
          decryptedText = '[Quantum Decryption Failed]';
        }
      }

      addMessage({
        ...data,
        decryptedText: decryptedText || '[Failed to Decrypt]'
      });
    };

    socket.on('receive-message', handleReceiveMessage);
    return () => {
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [socket, privateKey, addMessage]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !isConnected) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any = {
      id: Math.random().toString(36).substring(2, 9),
      senderName: userName,
      roomId,
      mode
    };

    if (mode === 'educational') {
      let encryptedText = '';
      if (algorithm === 'Caesar') encryptedText = caesarEncrypt(inputText, manualKey);
      else if (algorithm === 'Substitution') encryptedText = substitutionEncrypt(inputText, manualKey);
      else if (algorithm === 'DES') encryptedText = desEncrypt(inputText, manualKey, cryptoMode);
      else if (algorithm === 'TripleDES') encryptedText = tripleDesEncrypt(inputText, manualKey, cryptoMode);
      else if (algorithm === 'AES') {
        if (cryptoMode === 'GCM') {
          const gcmResult = aesGcmEncrypt(inputText, manualKey);
          payload = {
            ...payload,
            algorithm,
            key: manualKey,
            cryptoMode,
            encryptedText: gcmResult.ciphertext,
            iv: gcmResult.iv,
            tag: gcmResult.tag
          };
          // Skip the standard payload assignment
          socket.emit('send-message', payload);
          addMessage({ ...payload, senderId: userId, timestamp: Date.now(), decryptedText: inputText });
          setInputText('');
          setTimeout(() => inputRef.current?.focus(), 10);
          return;
        } else {
          encryptedText = aesEncrypt(inputText, manualKey, cryptoMode);
        }
      }
      else if (algorithm === 'RC4') encryptedText = rc4Encrypt(inputText, manualKey);
 
      payload = {
        ...payload,
        algorithm,
        key: manualKey, // Sent explicitly (Shift/Table/Pass/PubKey)
        ...( (algorithm === 'AES' || algorithm === 'DES' || algorithm === 'TripleDES') ? { cryptoMode } : {} ),
        encryptedText
      };
    } else if (mode === 'secure') {
      // Secure Mode Flow
      // 1. Generate random session key
      const sessionKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // 2. Encrypt message with AES session key
      const encryptedText = aesEncrypt(inputText, sessionKey);

      // 3. Encrypt session key with EVERY recipient's Public Key
      const encryptedSessionKeys: Record<string, string> = {};
      let hasPeers = false;

      Object.keys(roomPublicKeys).forEach(peerId => {
        if (peerId !== userId) {
          encryptedSessionKeys[peerId] = rsaEncrypt(sessionKey, roomPublicKeys[peerId]);
          hasPeers = true;
        }
      });

      if (!hasPeers) {
        setErrorToast('No other user in the room to send a secure message to! (Missing Public Key)');
        return;
      }

        payload = {
          ...payload,
          encryptedText,
          encryptedSessionKeys
        };
      } else if (mode === 'quantum') {
        // Quantum Mode Flow (Hybrid Kyber + AES)
        const sessionKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const encryptedText = aesEncrypt(inputText, sessionKey);
        
        const pqcSessionKeys: Record<string, { ct: string, encryptedKey: string }> = {};
        let hasPeers = false;

        Object.keys(roomPqcPublicKeys).forEach(peerId => {
          if (peerId !== userId) {
            // 1. Encapsulate for peer
            const { ciphertext, sharedSecret } = kyberEncapsulate(roomPqcPublicKeys[peerId]);
            // 2. Wrap the session key with the shared secret
            const encryptedKey = aesEncrypt(sessionKey, sharedSecret);
            
            pqcSessionKeys[peerId] = { ct: ciphertext, encryptedKey };
            hasPeers = true;
          }
        });

        if (!hasPeers) {
          setErrorToast('No other user in the room to send a quantum-secure message to! (Missing PQC Public Key)');
          return;
        }

        payload = {
          ...payload,
          encryptedText,
          pqcSessionKeys
        };
      }

    socket.emit('send-message', payload);
    
    // Add to local messages
    addMessage({
      ...payload,
      senderId: userId,
      timestamp: Date.now(),
      decryptedText: inputText // We know what we sent
    });

    setInputText('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      {/* Custom Error Toast */}
      {errorToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[110] animate-fade-in w-[calc(100%-2rem)] max-w-md">
          <div className="bg-red-500 text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400">
            <ShieldAlert size={20} className="shrink-0" />
            <span className="text-xs sm:text-sm font-semibold leading-tight">{errorToast}</span>
          </div>
        </div>
      )}

      {/* Header Area (Sticky) */}
      <div className="sticky top-0 z-50 shrink-0">
        <header className="glass-panel p-3 sm:p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 sm:p-2 rounded-lg ${mode === 'secure' ? 'bg-blue-500/20 text-blue-400' : mode === 'quantum' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {mode === 'secure' ? <Shield size={18} className="sm:w-6 sm:h-6" /> : mode === 'quantum' ? <Zap size={18} className="sm:w-6 sm:h-6" /> : <ShieldAlert size={18} className="sm:w-6 sm:h-6" />}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold">Chat App</h1>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="hidden xs:inline">{isConnected ? 'Connected' : 'Disconnected'} | </span>{userName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {mode === 'educational' && (
            <button 
              onClick={() => {
                setShowControls(!showControls);
                setIsAlgoOpen(false);
                setIsModeOpen(false);
              }}
              className="p-2 sm:hidden text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700"
              title="Toggle Encryption Settings"
            >
              <KeyRound size={16} className="sm:w-5 sm:h-5" />
            </button>
          )}
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/50 backdrop-blur-sm">
            <button 
              onClick={() => setMode('educational')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-sm font-bold uppercase tracking-tighter transition-all duration-300 ${mode === 'educational' ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Edu
            </button>
            <button 
              onClick={() => setMode('secure')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-sm font-bold uppercase tracking-tighter transition-all duration-300 ${mode === 'secure' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] scale-105' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Secure
            </button>
            <button 
              onClick={() => setMode('quantum')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-sm font-bold uppercase tracking-tighter transition-all duration-300 ${mode === 'quantum' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] scale-105' : 'text-slate-500 hover:text-slate-300'}`}
            >
              PQC
            </button>
          </div>
          
          <button 
            onClick={() => {
              leaveRoom();
              router.push('/');
            }}
            className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/50 hover:bg-red-500/10 rounded-lg border border-slate-700 transition-all"
            title="Leave Room"
          >
            <LogOut size={16} className="sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* Control Panel (Educational Mode Only) */}
      {mode === 'educational' && (
        <div className={`bg-slate-900/40 border-b border-white/5 p-4 sm:p-5 flex flex-wrap gap-4 items-end animate-fade-in relative z-30 shrink-0 shadow-2xl ${showControls ? 'block' : 'hidden sm:flex'}`}>
          <div className="flex-1 min-w-[150px] max-w-xs relative z-[60]">
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Algorithm</label>
            <button 
              type="button"
              onClick={() => {
                setIsAlgoOpen(!isAlgoOpen);
                setIsModeOpen(false);
              }}
              className="w-full glass-input p-2.5 rounded-lg text-sm flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span>{algorithm === 'Caesar' ? 'Caesar Cipher' : algorithm === 'Substitution' ? 'Substitution Cipher' : algorithm}</span>
              <ChevronDown size={16} className={`transition-transform ${isAlgoOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isAlgoOpen && (
              <div className="absolute top-full mt-2 left-0 w-full glass-panel rounded-xl overflow-hidden shadow-2xl z-[100] border border-white/10 animate-fade-in pointer-events-auto">
                {['Caesar', 'Substitution', 'DES', 'TripleDES', 'AES', 'RC4'].map((algo) => (
                  <button
                    key={algo}
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation();
                      setAlgorithm(algo); 
                      setIsAlgoOpen(false); 
                    }}
                    className={`w-full px-4 py-3 text-sm text-left flex items-center justify-between transition-colors cursor-pointer active:bg-white/10 ${algorithm === algo ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-300 hover:bg-white/5'}`}
                  >
                    <span>{algo === 'Caesar' ? 'Caesar Cipher' : algo === 'Substitution' ? 'Substitution Cipher' : algo === 'RC4' ? 'RC4 (Stream Cipher)' : algo}</span>
                    {algorithm === algo && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {algorithm === 'Caesar' && (
            <div className="flex-1 min-w-[150px] max-w-xs">
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Shift Amount</label>
              <input 
                type="number"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                className="w-full glass-input p-2.5 rounded-lg text-sm"
              />
            </div>
          )}

          {algorithm === 'Substitution' && (
            <div className="flex-1 min-w-[300px] max-w-md">
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Alphabet Mapping (26 chars)</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  className="flex-1 glass-input p-2.5 rounded-lg text-sm font-mono"
                  placeholder="abcdefghijklmnopqrstuvwxyz"
                />
                <button 
                  onClick={() => setManualKey(generateSubstitutionKey())}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs"
                >
                  Random
                </button>
              </div>
            </div>
          )}

          {algorithm === 'RC4' && (
            <div className="flex-1 min-w-[200px] max-w-xs">
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">RC4 Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    className="w-full glass-input p-2.5 pl-10 rounded-lg text-sm font-mono"
                    placeholder="Key..."
                  />
                </div>
                <button 
                  onClick={() => setManualKey(generateRC4Key())}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs"
                  title="Generate Random Key"
                >
                  Auto
                </button>
              </div>
            </div>
          )}

          {(algorithm === 'AES' || algorithm === 'DES' || algorithm === 'TripleDES') && (
            <>
              <div className="flex-1 min-w-[200px] max-w-xs">
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      value={manualKey}
                      onChange={(e) => setManualKey(e.target.value)}
                      className="w-full glass-input p-2.5 pl-10 rounded-lg text-sm font-mono"
                      placeholder="Key..."
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if (algorithm === 'AES') setManualKey(generateAESKey());
                      else if (algorithm === 'TripleDES') setManualKey(generate3DESKey());
                      else setManualKey(generateDESKey());
                    }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs"
                    title="Generate Random Key"
                  >
                    Auto
                  </button>
                </div>
              </div>
              <div className="flex-1 min-w-[120px] max-w-xs relative z-[60]">
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Mode</label>
                <button 
                  type="button"
                  onClick={() => {
                    setIsModeOpen(!isModeOpen);
                    setIsAlgoOpen(false);
                  }}
                  className="w-full glass-input p-2.5 rounded-lg text-sm flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <span>{cryptoMode}</span>
                  <ChevronDown size={16} className={`transition-transform ${isModeOpen ? 'rotate-180' : ''}`} />
                </button>

                {isModeOpen && (
                  <div className="absolute top-full mt-2 left-0 w-full glass-panel rounded-xl overflow-hidden shadow-2xl z-[100] border border-white/10 animate-fade-in pointer-events-auto">
                    {['CBC', 'ECB', 'CFB', 'CTR', 'OFB', ...(algorithm === 'AES' ? ['GCM'] : [])].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCryptoMode(m);
                          setIsModeOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-sm text-left flex items-center justify-between transition-colors cursor-pointer active:bg-white/10 ${cryptoMode === m ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300 hover:bg-white/5'}`}
                      >
                        <span>{m === 'GCM' ? 'GCM (Modern)' : m}</span>
                        {cryptoMode === m && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="text-xs text-amber-400/80 bg-amber-400/10 p-2.5 rounded-lg border border-amber-400/20 flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>Key & parameters will be shared.</span>
          </div>
        </div>
      )}

        {/* Secure Mode Info */}
        {mode === 'secure' && (
          <div className="bg-blue-900/10 border-b border-blue-500/20 p-2 sm:p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs sm:text-sm animate-fade-in px-4 sm:px-6">
            <div className="flex items-center gap-2 text-blue-400">
              <Lock size={14} className="shrink-0" />
              <span className="leading-tight"><strong>E2EE Active.</strong> AES + RSA protocol.</span>
            </div>
            <div className="text-[10px] sm:text-xs font-mono text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <KeyRound size={12}/> {publicKey.substring(27, 42)}...
              </span>
              <span className="flex items-center gap-1 text-blue-400/70">
                <Network size={12}/> Peers: {Object.keys(roomPublicKeys).filter(id => id !== userId).length}
              </span>
            </div>
          </div>
        )}

        {/* Quantum Mode Info */}
        {mode === 'quantum' && (
          <div className="bg-purple-600/10 border-b border-purple-500/30 p-2 sm:p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs sm:text-sm animate-fade-in px-4 sm:px-6">
            <div className="flex items-center gap-2 text-purple-300">
              <Zap size={14} className="shrink-0 animate-pulse" />
              <span className="leading-tight font-semibold">Post-Quantum Active <span className="text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded ml-1 border border-purple-500/30 uppercase tracking-tighter">Kyber-768</span></span>
            </div>
            <div className="text-[10px] sm:text-xs font-mono text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-black/20 rounded-full border border-white/5">
                <KeyRound size={12} className="text-purple-500"/> {pqcPublicKey.substring(27, 45)}...
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-black/20 rounded-full border border-white/5">
                <Network size={12} className="text-purple-400"/> Peers: {Object.keys(roomPqcPublicKeys).filter(id => id !== userId).length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 relative z-0">
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === userId;
          return (
            <div key={idx} className={`flex flex-col max-w-[90%] sm:max-w-[80%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} animate-fade-in`}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs sm:text-sm font-semibold text-slate-300">{isMe ? 'You' : msg.senderName}</span>
                <span className="text-[10px] sm:text-xs text-slate-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              
              <div className={`p-3.5 sm:p-5 rounded-2xl relative group ${isMe ? 'bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-tr-none shadow-lg' : 'glass-panel rounded-tl-none shadow-md'}`}>
                {/* Mode Indicator Dot */}
                <div className={`absolute -top-1.5 ${isMe ? '-left-1.5' : '-right-1.5'} w-3 h-3 rounded-full border-2 border-background ${msg.mode === 'quantum' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]' : msg.mode === 'secure' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                
                {/* Decrypted / Plaintext */}
                <div className="text-[14px] sm:text-[16px] leading-relaxed mb-3 text-slate-100 font-medium">
                  {msg.decryptedText}
                </div>
                
                {/* Cryptography Metadata */}
                <div className="mt-2 pt-3 border-t border-white/10 text-[10px] sm:text-xs font-mono bg-black/20 rounded-lg p-2 sm:p-3">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <Network size={12} /> Network Payload:
                  </div>
                  
                  {msg.mode === 'educational' ? (
                    <>
                      <div className="text-red-400/90 break-all"><span className="text-slate-500">Ciphertext:</span> {msg.encryptedText}</div>
                      <div className="text-emerald-400/90 mt-1"><span className="text-slate-500">Algorithm:</span> {msg.algorithm} {msg.cryptoMode && (msg.algorithm === 'AES' || msg.algorithm === 'DES' || msg.algorithm === 'TripleDES') && `(${msg.cryptoMode})`}</div>
                      <div className="text-amber-400/90 break-all line-clamp-1"><span className="text-slate-500">Intercepted Key:</span> {msg.key}</div>
                    </>
                  ) : msg.mode === 'secure' ? (
                    <>
                      <div className="text-blue-400/90 break-all line-clamp-2"><span className="text-slate-500">AES Ciphertext:</span> {msg.encryptedText}</div>
                      <div className="text-purple-400/90 break-all line-clamp-2 mt-1" title={JSON.stringify(msg.encryptedSessionKeys)}>
                        <span className="text-slate-500">RSA Encrypted Session Keys:</span> {Object.keys(msg.encryptedSessionKeys || {}).length} keys attached
                      </div>
                    </>
                  ) : msg.mode === 'quantum' ? (
                    <>
                      <div className="text-blue-400/90 break-all line-clamp-2"><span className="text-slate-500">AES Ciphertext:</span> {msg.encryptedText}</div>
                      <div className="text-purple-400/90 break-all line-clamp-2 mt-1">
                        <span className="text-slate-500">Kyber Encapsulated Keys:</span> {Object.keys(msg.pqcSessionKeys || {}).length} payloads attached
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 italic">No network metadata available.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area (Sticky Bottom) */}
      <footer className="sticky bottom-0 glass-panel p-3 sm:p-5 shrink-0 pb-[safe-area-inset-bottom] z-50">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex sm:block items-center gap-2 relative">
          <input 
            ref={inputRef}
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={mode === 'secure' ? 'Encrypted...' : 'Message...'}
            className="flex-1 sm:w-full bg-slate-900/50 border border-slate-700 rounded-full py-3.5 sm:py-4 px-6 sm:pr-16 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm sm:text-base text-slate-200"
          />
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="sm:absolute sm:right-2 sm:top-1/2 sm:-translate-y-1/2 shrink-0 w-11 h-11 sm:w-12 sm:h-12 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
          >
            <Send size={18} className="sm:w-5 sm:h-5 ml-0.5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
