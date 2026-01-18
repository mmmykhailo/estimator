import { TooltipPortal } from "@radix-ui/react-tooltip";
import { AlertCircle, Check, Copy, Home } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	Outlet,
	useActionData,
	useLoaderData,
	useNavigate,
	useNavigation,
	useSubmit,
} from "react-router";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { auth, ensureAuth } from "~/lib/firebase/config";
import {
	checkRoomExists,
	createRoom,
	getRoomMetadata,
	joinRoom,
	setOrganizer,
	updateParticipant,
} from "~/lib/firebase/operations";
import {
	cleanupStaleParticipants,
	detectStaleParticipants,
} from "~/lib/firebase/presence";
import { FirebaseRoomProvider } from "~/lib/room/firebase-context";
import {
	useOrganizerId,
	useParticipants,
	useRoomStatus,
} from "~/lib/room/hooks";
import { formatRoomCode } from "~/lib/utils/room-code";
import type { Task, Workstream } from "~/types/room";
import type { Route } from "./+types/room.$roomId";

export function meta({ params }: Route.MetaArgs) {
	return [{ title: `Room ${params.roomId} - Estimation` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const roomId = params.roomId;

	// Wait for auth to be fully ready (including token propagation)
	const user = await ensureAuth();
	const userId = user.uid;

	// Check if room exists
	const roomExists = await checkRoomExists(roomId);

	let roomMetadata = null;
	let isParticipant = false;

	if (roomExists) {
		roomMetadata = await getRoomMetadata(roomId);

		// Check if we're already a participant
		const { ref, get } = await import("firebase/database");
		const { database } = await import("~/lib/firebase/config");
		const participantRef = ref(
			database,
			`rooms/${roomId}/participants/${userId}`,
		);
		const snapshot = await get(participantRef);
		isParticipant = snapshot.exists();
	}

	return {
		roomId,
		userId,
		roomExists,
		roomMetadata,
		isParticipant,
	};
}

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const roomId = params.roomId;
	const formData = await request.formData();
	const actionType = formData.get("_action");

	const userId = auth.currentUser?.uid;
	if (!userId) {
		return { error: "User not authenticated" };
	}

	try {
		switch (actionType) {
			case "create": {
				const workstreamsJson = formData.get("workstreams") as string;
				const tasksJson = formData.get("tasks") as string;
				const workstreams = JSON.parse(workstreamsJson) as Workstream[];
				const tasks = JSON.parse(tasksJson) as Task[];
				await createRoom(roomId, workstreams, tasks);
				return { success: true };
			}

			case "join": {
				const rawName = formData.get("name") as string;
				// Sanitize: only allow letters and spaces, max 32 chars
				const name = rawName
					?.replace(/[^\p{L}\s]/gu, "")
					.trim()
					.slice(0, 32);
				if (!name || name.length < 2) {
					return { error: "Name must be at least 2 characters" };
				}
				const success = await joinRoom(roomId, name);
				if (!success) {
					const roomMetadata = await getRoomMetadata(roomId);
					if (roomMetadata?.status === "ended") {
						return {
							error: "This session has ended. New participants cannot join.",
						};
					}
					return { error: "Failed to join room" };
				}
				return { success: true };
			}

			case "overtake-organizer": {
				await setOrganizer(roomId, userId, true);
				await updateParticipant(roomId, { is_organizer: true });
				return { success: true };
			}

			default:
				return { error: "Unknown action" };
		}
	} catch (error) {
		console.error("Action error:", error);
		return {
			error: error instanceof Error ? error.message : "An error occurred",
		};
	}
}

// Generate peer ID
function generatePeerId(): string {
	return `peer-${Math.random().toString(36).substring(2, 11)}`;
}

// Get or create peer ID for this room (persists across page reloads)
function _getOrCreatePeerId(roomId: string): string {
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
	const loaderData = useLoaderData<typeof clientLoader>();
	const actionData = useActionData<typeof clientAction>();
	const submit = useSubmit();
	const navigation = useNavigation();
	const navigate = useNavigate();

	const { roomId, userId, roomExists, roomMetadata, isParticipant } =
		loaderData;

	const [showNameDialog, setShowNameDialog] = useState(false);
	const [name, setName] = useState(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("userNickname") || "";
			// Sanitize stored value: only letters and spaces, max 32 chars
			return stored.replace(/[^\p{L}\s]/gu, "").slice(0, 32);
		}
		return "";
	});

	const isSubmitting = navigation.state === "submitting";

	// Check if we need to show name dialog or handle errors
	useEffect(() => {
		if (!roomExists) {
			// Room doesn't exist - show error
			return;
		}

		if (roomMetadata?.status === "ended" && !isParticipant) {
			// Room is ended and we're not a participant - show error
			return;
		}

		if (!isParticipant) {
			// Show name dialog if not a participant
			setShowNameDialog(true);
		}
	}, [roomExists, roomMetadata, isParticipant]);

	// Handle successful join
	useEffect(() => {
		if (actionData?.success && showNameDialog) {
			setShowNameDialog(false);
			// If room is active, navigate to session
			if (roomMetadata?.status === "active") {
				navigate(`/room/${roomId}/session`, { replace: true });
			}
		}
	}, [actionData, showNameDialog, roomMetadata, roomId, navigate]);

	const handleJoinWithName = () => {
		const trimmedName = name.trim();
		if (!trimmedName || trimmedName.length < 2) {
			return;
		}

		// Save trimmed name to localStorage
		localStorage.setItem("userNickname", trimmedName);

		const formData = new FormData();
		formData.append("_action", "join");
		formData.append("name", trimmedName);
		submit(formData, { method: "post" });
	};

	// Show error state
	if (!roomExists) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<Card className="max-w-md p-6 space-y-4 border-destructive">
					<div className="flex items-center gap-2 text-destructive">
						<AlertCircle className="h-5 w-5" />
						<h2 className="text-lg font-semibold">Failed to Connect</h2>
					</div>
					<p className="text-sm text-muted-foreground">
						Room not found. Please check the room code or create a new room.
					</p>
					<Button onClick={() => navigate("/")} className="w-full">
						Back to Home
					</Button>
				</Card>
			</div>
		);
	}

	if (roomMetadata?.status === "ended" && !isParticipant) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<Card className="max-w-md p-6 space-y-4 border-destructive">
					<div className="flex items-center gap-2 text-destructive">
						<AlertCircle className="h-5 w-5" />
						<h2 className="text-lg font-semibold">Failed to Connect</h2>
					</div>
					<p className="text-sm text-muted-foreground">
						This session has ended. New participants cannot join.
					</p>
					<Button onClick={() => navigate("/")} className="w-full">
						Back to Home
					</Button>
				</Card>
			</div>
		);
	}

	const nameError = actionData?.error;

	return (
		<FirebaseRoomProvider roomId={roomId} userId={userId}>
			{showNameDialog ? (
				<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>Join Room</CardTitle>
							<CardDescription>
								Enter your name to join room{" "}
								<span className="font-mono font-bold">
									{formatRoomCode(roomId)}
								</span>
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Your Name</Label>
								<Input
									id="name"
									placeholder="e.g. John Doe"
									value={name}
									maxLength={32}
									onChange={(e) => {
										// Only allow letters (including Cyrillic/diacritics) and spaces
										const value = e.target.value.replace(/[^\p{L}\s]/gu, "");
										setName(value);
										localStorage.setItem("userNickname", value);
									}}
									onKeyDown={(e) => e.key === "Enter" && handleJoinWithName()}
									className={nameError ? "border-destructive" : ""}
									autoFocus
									disabled={isSubmitting}
								/>
								{nameError && (
									<p className="text-sm text-destructive">{nameError}</p>
								)}
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => navigate("/")}
									className="flex-1"
									disabled={isSubmitting}
								>
									Cancel
								</Button>
								<Button
									onClick={handleJoinWithName}
									disabled={
										!name.trim() || name.trim().length < 2 || isSubmitting
									}
									className="flex-1"
								>
									{isSubmitting ? "Joining..." : "Join Room"}
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			) : (
				<RoomContent roomId={roomId} userId={userId} />
			)}
		</FirebaseRoomProvider>
	);
}

function RoomContent({
	roomId,
	userId,
}: {
	roomId: string;
	userId: string | null;
}) {
	const navigate = useNavigate();
	const status = useRoomStatus(roomId);
	const organizerId = useOrganizerId(roomId);
	const participants = useParticipants(roomId);

	const [copied, setCopied] = useState(false);
	const [showOrganizerModal, setShowOrganizerModal] = useState(false);
	const [showLeaveModal, setShowLeaveModal] = useState(false);

	const isOrganizer = userId && organizerId ? organizerId === userId : false;

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
				console.error("Failed to cleanup stale participants:", err);
			}
		}, 3000); // Check every 3 seconds

		return () => clearInterval(interval);
	}, [isOrganizer, roomId]);

	// Check for organizer disconnect
	useEffect(() => {
		if (participants === null) {
			return;
		}

		const organizer = participants.find((p) => p.peer_id === organizerId);

		// If I'm not the organizer and either:
		// 1. Organizer is missing from participants list (they left)
		// 2. Organizer exists but hasn't sent heartbeat in 6 seconds
		if (userId !== organizerId) {
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
	}, [participants, organizerId, userId]);

	// Navigate based on status
	useEffect(() => {
		const path = window.location.pathname;
		const isOnSessionRoute = path.includes("/session");
		const isOnRoundResultsRoute = path.includes("/round-results");
		const isOnSummaryRoute = path.includes("/summary");

		if (status === "active" && !isOnSessionRoute) {
			navigate(`/room/${roomId}/session`, { replace: true });
		} else if (status === "results" && !isOnRoundResultsRoute) {
			navigate(`/room/${roomId}/round-results`, { replace: true });
		} else if (
			status === "lobby" &&
			(isOnSessionRoute || isOnRoundResultsRoute)
		) {
			navigate(`/room/${roomId}`, { replace: true });
		} else if (status === "ended" && !isOnSummaryRoute) {
			navigate(`/room/${roomId}/summary`, { replace: true });
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
			if (!userId) throw new Error("User not authenticated");
			await setOrganizer(roomId, userId, true);
			await updateParticipant(roomId, { is_organizer: true });
			setShowOrganizerModal(false);
		} catch (err) {
			console.error("Failed to overtake organizer role:", err);
		}
	}, [roomId, userId]);

	const handleLeaveRoom = useCallback(() => {
		setShowLeaveModal(false);
		navigate("/");
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
									type="button"
									onClick={copyRoomCode}
									className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
									title={copied ? "Copied!" : "Click to copy full room link"}
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
						{!!participants && (
							<div className="flex items-center gap-2">
								<span className="text-sm text-muted-foreground">
									{participants.length}{" "}
									{participants.length === 1 ? "participant" : "participants"}
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
												<TooltipPortal>
													<TooltipContent side="bottom">
														{participant.name}
													</TooltipContent>
												</TooltipPortal>
											</Tooltip>
										))}
										{participants.length > 5 && (
											<Avatar className="border-2 border-background w-8 h-8">
												<AvatarFallback>
													+{participants.length - 5}
												</AvatarFallback>
											</Avatar>
										)}
									</div>
								</TooltipProvider>
							</div>
						)}
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
							Are you sure you want to leave this room? You can rejoin with the
							room code later.
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
							The organizer has left the session. Would you like to take over as
							the new organizer?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowOrganizerModal(false)}
						>
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
