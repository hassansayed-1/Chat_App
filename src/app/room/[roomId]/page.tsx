'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChat } from '@/context/ChatContext';
import ChatScreen from '@/components/ChatScreen';

export default function RoomPage() {
  const { roomId: paramRoomId } = useParams();
  const router = useRouter();
  const { userName, roomId, setRoomId, isJoined, joinRoom } = useChat();

  useEffect(() => {
    if (!userName) {
      // If no user name, they must join first
      router.push('/');
      return;
    }

    if (paramRoomId && typeof paramRoomId === 'string') {
      if (!isJoined || roomId !== paramRoomId) {
        joinRoom(userName, paramRoomId);
      }
    }
  }, [paramRoomId, userName, isJoined, joinRoom, setRoomId, router, roomId]);

  if (!userName || !isJoined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-white animate-pulse">Entering room...</div>
      </div>
    );
  }

  return <ChatScreen />;
}
