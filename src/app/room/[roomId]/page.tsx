'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import ChatScreen from '@/components/ChatScreen';

export default function RoomPage() {
  const { roomId: paramRoomId } = useParams();
  const router = useRouter();
  const { userName, roomId, isJoined, joinRoom } = useChat();
  const hasJoined = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (!userName) {
      router.push('/');
      return;
    }

    if (paramRoomId && typeof paramRoomId === 'string') {
      // Only call joinRoom if we haven't joined this specific room yet
      if (!hasJoined.current && (!isJoined || roomId !== paramRoomId)) {
        hasJoined.current = true;
        joinRoom(userName, paramRoomId);
      }
    }
  }, [isMounted, paramRoomId, userName, isJoined, joinRoom, router, roomId]);

  // Always show loading during SSR / before mount to prevent hydration mismatch
  if (!isMounted || !isJoined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-white animate-pulse">Entering room...</div>
      </div>
    );
  }

  return <ChatScreen />;
}
