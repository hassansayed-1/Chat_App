'use client';

import React, { useState } from 'react';
import { useChat } from '@/context/ChatContext';
import { useRouter } from 'next/navigation';
import { KeyRound, LogIn, User } from 'lucide-react';

export default function JoinScreen() {
  const { joinRoom } = useChat();
  const router = useRouter();
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && room.trim()) {
      joinRoom(name.trim(), room.trim());
      router.push(`/room/${room.trim()}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[100dvh] p-4 sm:p-6 overflow-hidden">
      <div className="glass-panel max-w-md w-full p-6 sm:p-8 rounded-2xl animate-fade-in shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <KeyRound size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Chat App</h1>
          <p className="text-slate-400 text-sm">Join a secure room to start experimenting with cryptography.</p>
        </div>

        <div className="space-y-4" onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(e as any) }}>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Your Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full glass-input p-3 pl-10 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-slate-200 transition-all"
                placeholder="e.g. Hassan"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Room ID</label>
            <div className="relative">
              <LogIn className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full glass-input p-3 pl-10 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-slate-200 font-mono transition-all text-xs sm:text-sm"
                placeholder="e.g. room123 or phone"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Share this Room ID with your partner.</p>
          </div>

          <button 
            type="button"
            onClick={handleJoin}
            className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/25 mt-6"
          >
            Join Secure Room
          </button>
        </div>
      </div>
    </div>
  );
}
