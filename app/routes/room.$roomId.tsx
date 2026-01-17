import type { Route } from "./+types/room.$roomId";
import { useEffect, useState, useCallback } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { FirebaseRoomProvider } from "~/lib/room/firebase-context";
import { createRoom, joinRoom, setOrganizer, updateParticipant, checkRoomExists } from "~/lib/firebase/operations";
import { detectStaleParticipants, cleanupStaleParticipants } from "~/lib/firebase/presence";
import type { Workstream, Task } from "~/types/room";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { AlertCircle, Copy, Check, Home } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { formatRoomCode } from "~/lib/utils/room-code";
import {
  useRoomStatus,
  useOrganizerId,
  useParticipants,
  useConnectionStatus,
  useFirebaseRoom
} from "~/lib/room/hooks";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Room ${params.roomId} - Estimation` },
  ];
}

// Generate peer ID
function generatePeerId(): string {
  return `peer-${Math.random().toString(36).substring(2, 11)}`;
}

// Get or create peer ID for this room (persists across page reloads)
function getOrCreatePeerId(roomId: string): string {
  const storageKey = `peerId_${roomId}`;

  // Try to get existing peerId from sessionStorage
  const existingPeerId = sessionStorage.getItem(storageKey);
  if (existingPeerId) {
    return existingPeerId;
  }

  // Generate new peerId and store it
  const newPeerId = generatePeerId();
  sessionStorage.setItem(storageKey, newPeerId);
  return newPeerId;
}

export default function RoomLayout() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const roomId = params.roomId!;

  const [peerId] = useState(() => getOrCreatePeerId(roomId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");

  // Initialize room
  useEffect(() => {
    let mounted = true;

    const initializeRoom = async () => {
      try {
        // First check if room exists and we're already a participant
        const roomExists = await checkRoomExists(roomId);

        if (roomExists) {
          // Room exists - check if we're already a participant
          const participantsRef = await import('firebase/database').then(m => m.ref);
          const getFunc = await import('firebase/database').then(m => m.get);
          const { database } = await import('~/lib/firebase/config');

          const participantRef = participantsRef(database, `rooms/${roomId}/participants/${peerId}`);
          const snapshot = await getFunc(participantRef);

          if (snapshot.exists()) {
            // Already a participant - just continue
            if (mounted) {
              setInitialized(true);
              setLoading(false);
            }
            return;
          }
        }

        // Not a participant yet - check state for creation/joining
        const state = location.state as any;

        if (state?.createRoom) {
          // Creating a new room
          const workstreams = state.workstreams as Workstream[];
          const tasks = state.tasks as Task[];

          // Create room in Firebase
          await createRoom(roomId, peerId, workstreams, tasks);

          // Join as organizer
          await joinRoom(roomId, peerId, "Organizer", true);
        } else if (state?.joinRoom) {
          // Joining existing room with name from state
          const name = state.name as string;

          // Join room
          const success = await joinRoom(roomId, peerId, name, false);

          if (!success) {
            throw new Error("Room not found");
          }
        } else {
          // No state - check if room exists and prompt for name
          if (roomExists) {
            // Room exists, show name dialog
            if (mounted) {
              setLoading(false);
              setShowNameDialog(true);
            }
            return;
          } else {
            // Room doesn't exist
            throw new Error("Room not found. Please check the room code or create a new room.");
          }
        }

        if (mounted) {
          setInitialized(true);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to initialize room:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize room");
          setLoading(false);
        }
      }
    };

    initializeRoom();

    return () => {
      mounted = false;
    };
  }, [roomId, peerId, location.state]);

  const handleJoinWithName = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Please enter your name");
      return;
    }
    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }

    try {
      setLoading(true);
      const success = await joinRoom(roomId, peerId, trimmedName, false);
      if (success) {
        setShowNameDialog(false);
        setInitialized(true);
        setLoading(false);
      } else {
        setNameError("Failed to join room");
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to join room:", err);
      setNameError("Failed to join room");
      setLoading(false);
    }
  };

  if (loading && !showNameDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Connecting to room...</p>
        </div>
      </div>
    );
  }

  if (error || (!initialized && !showNameDialog)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md p-6 space-y-4 border-destructive">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Failed to Connect</h2>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/")} className="w-full">
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  // Show name dialog if needed
  if (showNameDialog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Join Room</CardTitle>
            <CardDescription>
              Enter your name to join room <span className="font-mono font-bold">{formatRoomCode(roomId)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinWithName()}
                className={nameError ? "border-destructive" : ""}
                autoFocus
              />
              {nameError && (
                <p className="text-sm text-destructive">{nameError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/")} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleJoinWithName}
                disabled={!name.trim() || loading}
                className="flex-1"
              >
                {loading ? "Joining..." : "Join Room"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FirebaseRoomProvider roomId={roomId} peerId={peerId}>
      <RoomContent roomId={roomId} peerId={peerId} />
    </FirebaseRoomProvider>
  );
}

function RoomContent({ roomId, peerId }: { roomId: string; peerId: string }) {
  const navigate = useNavigate();
  const status = useRoomStatus(roomId);
  const organizerId = useOrganizerId(roomId);
  const participants = useParticipants(roomId);
  const connectionStatus = useConnectionStatus(roomId);

  const [copied, setCopied] = useState(false);
  const [showOrganizerModal, setShowOrganizerModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const isOrganizer = organizerId === peerId;

  // Stale participant cleanup (organizer only)
  useEffect(() => {
    if (!isOrganizer) return;

    const interval = setInterval(async () => {
      try {
        const staleIds = await detectStaleParticipants(roomId, 6000);
        if (staleIds.length > 0) {
          await cleanupStaleParticipants(roomId, staleIds);
        }
      } catch (err) {
        console.error('Failed to cleanup stale participants:', err);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [isOrganizer, roomId]);

  // Check for organizer disconnect
  useEffect(() => {
    const organizer = participants.find(p => p.peer_id === organizerId);

    // If I'm not the organizer and either:
    // 1. Organizer is missing from participants list (they left)
    // 2. Organizer exists but hasn't sent heartbeat in 6 seconds
    if (peerId !== organizerId) {
      if (!organizer) {
        // Organizer has left the room
        setShowOrganizerModal(true);
      } else {
        const now = Date.now();
        const timeSinceHeartbeat = now - organizer.last_heartbeat;

        if (timeSinceHeartbeat > 6000) {
          setShowOrganizerModal(true);
        } else {
          setShowOrganizerModal(false);
        }
      }
    } else {
      setShowOrganizerModal(false);
    }
  }, [participants, organizerId, peerId]);

  // Navigate based on status
  useEffect(() => {
    const path = window.location.pathname;
    const isOnSessionRoute = path.includes("/session");
    const isOnResultsRoute = path.includes("/results");

    if (status === 'active' && !isOnSessionRoute) {
      navigate(`/room/${roomId}/session`, { replace: true });
    } else if (status === 'results' && !isOnResultsRoute) {
      navigate(`/room/${roomId}/results`, { replace: true });
    } else if (status === 'lobby' && (isOnSessionRoute || isOnResultsRoute)) {
      navigate(`/room/${roomId}`, { replace: true });
    } else if (status === 'ended') {
      navigate('/', { replace: true });
    }
  }, [status, roomId, navigate]);

  const copyRoomCode = useCallback(() => {
    const fullUrl = window.location.href;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleOvertakeOrganizer = useCallback(async () => {
    try {
      await setOrganizer(roomId, peerId, true);
      await updateParticipant(roomId, peerId, { is_organizer: true });
      setShowOrganizerModal(false);
    } catch (err) {
      console.error('Failed to overtake organizer role:', err);
    }
  }, [roomId, peerId]);

  const handleLeaveRoom = useCallback(() => {
    setShowLeaveModal(false);
    navigate('/');
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Room Info */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLeaveModal(true)}
                title="Go to home"
              >
                <Home className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Estimation Room</h1>
                <button
                  onClick={copyRoomCode}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  title={copied ? 'Copied!' : 'Click to copy full room link'}
                >
                  <span className="font-mono">{formatRoomCode(roomId)}</span>
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Participants */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
              </span>
              <TooltipProvider>
                <div className="flex -space-x-2">
                  {participants.slice(0, 5).map((participant) => (
                    <Tooltip key={participant.peer_id}>
                      <TooltipTrigger asChild>
                        <Avatar className="border-2 border-background w-8 h-8 cursor-help">
                          <AvatarFallback className={participant.color}>
                            {participant.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        {participant.name}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {participants.length > 5 && (
                    <Avatar className="border-2 border-background w-8 h-8">
                      <AvatarFallback>+{participants.length - 5}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Leave Room Confirmation Modal */}
      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this room? You can rejoin with the room code later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeaveRoom}>
              Leave Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organizer Disconnect Modal */}
      <Dialog open={showOrganizerModal} onOpenChange={setShowOrganizerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organizer Disconnected</DialogTitle>
            <DialogDescription>
              The organizer has left the session. Would you like to take over as the new organizer?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrganizerModal(false)}>
              Wait
            </Button>
            <Button onClick={handleOvertakeOrganizer}>
              Overtake Organizer Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
